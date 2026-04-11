/**
 * PDF Enricher — Full field extraction from already-stored PDF files
 *
 * For tenders where the PDF is already in Supabase storage but fields like
 * estimated_value, state, ministry_name, category etc. are missing.
 * Downloads each PDF from Supabase storage, parses it, and writes ALL fields.
 *
 * Usage:
 *   npm run pdf-enrich                        # all un-enriched tenders with PDFs
 *   npm run pdf-enrich -- --limit=100         # first N tenders
 *   npm run pdf-enrich -- --concurrency=2     # parallel (default 1)
 *   npm run pdf-enrich -- --all               # re-enrich even already-enriched
 *   npm run pdf-enrich -- --bid=GEM-2026-B-7414758   # single tender
 *   npm run pdf-enrich -- --reset             # clear checkpoint and restart
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { extractTenderDataGroq } from '../lib/groq-ai.js';
import { getComputedFields } from '../lib/computed-fields.js';
import { normalizeState, normalizeCity, extractCityStateFromConsigneeTable } from '../lib/locations.js';

// pdf-parse v2 changed API: new PDFParse({ data: buffer }).getText()
const require  = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result?.text ?? '';
  } finally {
    await parser.destroy?.();
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const LIMIT       = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1]       || '50000', 10);
const CONCURRENCY = parseInt(argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '1',     10);
const ALL         = argv.includes('--all');
const FIX_TITLES  = argv.includes('--fix-titles');
const RESET       = argv.includes('--reset');
// Accept both slash form (GEM/2026/B/7414758) and dash form (GEM-2026-B-7414758)
const BID_RAW     = argv.find(a => a.startsWith('--bid='))?.split('=').slice(1).join('=') ?? null;
const BID_ARG     = BID_RAW ? BID_RAW.replace(/^GEM-(\d{4})-([A-Z])-/i, 'GEM/$1/$2/') : null;
const CHECKPOINT  = path.join(process.cwd(), 'pdf-enrich-progress.json');
const BUCKET      = 'tender-documents';

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Checkpoint ───────────────────────────────────────────────────────────────
function saveCheckpoint(done: number, lastId: string) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ done, lastId, updatedAt: new Date().toISOString() }));
}
function loadCheckpoint(): { done: number; lastId: string } {
  if (RESET || !fs.existsSync(CHECKPOINT)) return { done: 0, lastId: '' };
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8')); }
  catch { return { done: 0, lastId: '' }; }
}

// ─── Progress Display ─────────────────────────────────────────────────────────
function renderProgress(done: number, total: number, stats: { ok: number; fail: number; skip: number }, startTime: number) {
  const pct     = total > 0 ? ((done / total) * 100).toFixed(1) : '0.0';
  const elapsed = (Date.now() - startTime) / 1000; // seconds
  const rate    = elapsed > 0 ? (done / elapsed * 60).toFixed(0) : '0'; // per minute
  const remaining = total - done;
  const etaSec  = done > 0 ? (elapsed / done) * remaining : 0;
  const etaStr  = etaSec < 60
    ? `${Math.round(etaSec)}s`
    : etaSec < 3600
      ? `${Math.round(etaSec / 60)}m`
      : `${(etaSec / 3600).toFixed(1)}h`;

  const bar = buildBar(done, total, 20);
  process.stdout.write(
    `\r${bar} [${done}/${total}] ${pct}%  ok=${stats.ok} fail=${stats.fail} skip=${stats.skip}  ${rate}/min  ETA ${etaStr}   `
  );
}

function buildBar(done: number, total: number, width: number): string {
  if (total === 0) return `[${'░'.repeat(width)}]`;
  const filled = Math.min(width, Math.max(0, Math.round((done / total) * width)));
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
}

// ─── Silence noisy sub-module logs ───────────────────────────────────────────
function silenceLogs<T>(fn: () => Promise<T>): Promise<T> {
  const origLog  = console.log;
  const origWarn = console.warn;
  console.log  = () => {};
  console.warn = () => {};
  return fn().finally(() => {
    console.log  = origLog;
    console.warn = origWarn;
  });
}

// ─── Title helpers ────────────────────────────────────────────────────────────
function isBadTitle(title: string): boolean {
  return /^[\d,\s]+$/.test(title?.trim() ?? '');
}

function slugify(bidNumber: string, title: string): string {
  const cleanBid   = bidNumber.replace(/\//g, '-').toLowerCase();
  const cleanTitle = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  return `${cleanBid}-${cleanTitle}`.slice(0, 120);
}

// ─── Build DB Payload ─────────────────────────────────────────────────────────
function buildPayload(ai: any, existing: any): Record<string, any> {
  const p: Record<string, any> = {};

  const setIfPresent = (key: string, val: any) => {
    if (val !== null && val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0)) {
      p[key] = val;
    }
  };

  if (ai.emd_amount !== null && ai.emd_amount !== undefined) p.emd_amount = ai.emd_amount;
  // Always write estimated_value (even 0) so the IS NULL filter marks this tender as processed
  p.estimated_value = ai.estimated_value ?? 0;
  setIfPresent('epbg_percentage',    ai.epbg_percentage);
  setIfPresent('min_turnover_lakhs', ai.min_turnover_lakhs);
  setIfPresent('experience_years',   ai.experience_years);
  setIfPresent('delivery_days',      ai.delivery_days);
  setIfPresent('num_consignees',     ai.num_consignees);
  setIfPresent('quantity',           ai.quantity);
  setIfPresent('pre_bid_date',       ai.pre_bid_date);
  setIfPresent('opening_date',       ai.dates?.bid_opening_date);

  if (ai.eligibility?.msme) p.eligibility_msme = true;
  if (ai.eligibility?.mii)  p.eligibility_mii  = true;

  setIfPresent('mse_relaxation',              ai.relaxations?.mse_experience);
  setIfPresent('mse_turnover_relaxation',     ai.relaxations?.mse_turnover);
  setIfPresent('startup_relaxation',          ai.relaxations?.startup_experience);
  setIfPresent('startup_turnover_relaxation', ai.relaxations?.startup_turnover);
  setIfPresent('documents_required',          ai.documents_required);
  setIfPresent('category',                    ai.category);
  setIfPresent('procurement_type',            ai.procurement_type);
  setIfPresent('keywords',                    ai.keywords);

  if (!existing.ai_summary && ai.technical_summary) p.ai_summary = ai.technical_summary;

  if (isBadTitle(existing.title) && ai.tender_title) {
    p.title = ai.tender_title;
    p.slug  = slugify(existing.bid_number, ai.tender_title);
  }

  const auth = ai.authority;
  if (auth) {
    if (!existing.ministry_name     && auth.ministry)      p.ministry_name     = auth.ministry;
    if (!existing.department_name   && auth.department)    p.department_name   = auth.department;
    if (!existing.organisation_name && auth.organisation)  p.organisation_name = auth.organisation;
    if (!existing.office_name       && auth.office)        p.office_name       = auth.office;
    if (!existing.state) {
      const st = auth.state || auth.consignee_state;
      const normalizedState = st ? normalizeState(st) : null;
      if (normalizedState) p.state = normalizedState;
    }
    if (!existing.city) {
      const ct = auth.city || auth.consignee_city;
      const normalizedCity = ct ? normalizeCity(ct) : null;
      if (normalizedCity) p.city = normalizedCity;
    }
  }

  Object.assign(p, getComputedFields({
    emd_amount:         ai.emd_amount,
    eligibility_msme:   ai.eligibility?.msme,
    eligibility_mii:    ai.eligibility?.mii,
    estimated_value:    ai.estimated_value,
    min_turnover_lakhs: ai.min_turnover_lakhs,
    startup_relaxation: ai.relaxations?.startup_experience,
    epbg_percentage:    ai.epbg_percentage,
  }));

  return p;
}

// ─── Process One Tender ────────────────────────────────────────────────────────
async function processTender(
  tender: { id: string; bid_number: string; pdf_url: string; [key: string]: any },
  stats: { ok: number; fail: number; skip: number },
  logLine: (msg: string) => void,
): Promise<void> {
  const fileName = tender.bid_number.replace(/\//g, '-') + '.pdf';

  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(fileName);
  if (dlErr || !blob) {
    logLine(`  FAIL ${tender.bid_number}: download — ${dlErr?.message}`);
    stats.fail++;
    return;
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.length < 1000) {
    logLine(`  SKIP ${tender.bid_number}: tiny PDF (${buffer.length}B)`);
    stats.skip++;
    return;
  }

  let pdfText = '';
  try {
    pdfText = await silenceLogs(() => parsePdf(buffer));
  } catch (e: any) {
    logLine(`  FAIL ${tender.bid_number}: pdf-parse — ${e.message}`);
    stats.fail++;
    return;
  }

  if (pdfText.length < 50) {
    logLine(`  SKIP ${tender.bid_number}: no text (${pdfText.length} chars)`);
    stats.skip++;
    return;
  }

  const aiData = await silenceLogs(() => extractTenderDataGroq(pdfText));
  if (!aiData) {
    logLine(`  FAIL ${tender.bid_number}: Groq null`);
    stats.fail++;
    return;
  }

  const payload = buildPayload(aiData, tender);

  // Code-level fallback: if state/city still missing, extract from consignee table via regex + PIN map
  if (!payload.state && !tender.state) {
    const { city, state } = extractCityStateFromConsigneeTable(pdfText);
    if (state) payload.state = state;
    if (city && !payload.city && !tender.city) payload.city = city;
  }
  const { error: dbErr } = await supabase.from('tenders').update(payload).eq('id', tender.id);

  if (dbErr) {
    logLine(`  FAIL ${tender.bid_number}: DB — ${dbErr.message}`);
    stats.fail++;
  } else {
    const tags = [
      aiData.estimated_value  ? `val=${(aiData.estimated_value/100000).toFixed(0)}L` : null,
      aiData.authority?.state ? `${aiData.authority.state}` : null,
      aiData.category         ? aiData.category : null,
    ].filter(Boolean).join(' ');
    logLine(`  OK  ${tender.bid_number} | ${(buffer.length / 1024).toFixed(0)}KB | ${tags}`);
    stats.ok++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  process.stdout.write(`\n>>> [PDF-ENRICH] Mode: ${ALL ? 'ALL' : BID_ARG ? `bid=${BID_ARG}` : 'unenriched'} | concurrency=${CONCURRENCY}\n\n`);

  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY not set. Exiting.');
    process.exit(1);
  }

  const { done: checkpointDone } = loadCheckpoint();
  let sessionDone = 0;  // tracks only this run's progress (for the bar)
  const stats     = { ok: 0, fail: 0, skip: 0 };
  const startTime = Date.now();

  let query = supabase
    .from('tenders')
    .select('id, bid_number, title, slug, pdf_url, ai_summary, state, city, ministry_name, department_name, organisation_name, office_name, estimated_value, emd_amount, eligibility_msme, eligibility_mii, category')
    .not('pdf_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (BID_ARG)         query = query.eq('bid_number', BID_ARG);
  else if (FIX_TITLES) query = query.filter('title', 'match', '^[\\d,\\s]+$');
  else if (!ALL)       query = query.is('estimated_value', null);

  const { data: tenders, error } = await query;
  if (error || !tenders?.length) {
    console.log('No tenders found.', error?.message ?? '');
    return;
  }

  const total = tenders.length;
  process.stdout.write(`>>> Found ${total} tenders to process.\n\n`);

  // Buffer log lines so they print above the progress bar
  const pendingLines: string[] = [];
  function logLine(msg: string) {
    pendingLines.push(msg);
  }
  function flushLines() {
    if (pendingLines.length === 0) return;
    process.stdout.write('\r' + ' '.repeat(100) + '\r'); // clear progress line
    for (const line of pendingLines) process.stdout.write(line + '\n');
    pendingLines.length = 0;
  }

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = tenders.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(t => processTender(t as any, stats, logLine)));

    sessionDone += batch.length;
    saveCheckpoint(checkpointDone + sessionDone, batch[batch.length - 1].id);

    flushLines();
    renderProgress(sessionDone, total, stats, startTime);

    if (i + CONCURRENCY < total) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  flushLines();
  const totalMin = ((Date.now() - startTime) / 60000).toFixed(1);
  process.stdout.write(`\n\n>>> Done in ${totalMin}m — ok=${stats.ok} fail=${stats.fail} skip=${stats.skip}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
