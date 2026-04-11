/**
 * Playwright PDF Downloader
 *
 * Uses a real Chromium browser session to download GeM bid PDFs, bypassing
 * the anti-automation block that causes direct HTTP requests to return 0-byte files.
 *
 * After download, extracts PDF text and runs Groq AI to fill emd_amount,
 * ai_summary, eligibility, city, state, and other enrichment fields.
 *
 * Usage:
 *   npm run playwright-pdf                      # all tenders missing PDF (up to 500)
 *   npm run playwright-pdf -- --limit=10        # first N tenders
 *   npm run playwright-pdf -- --delay=5000      # 5s between downloads
 *   npm run playwright-pdf -- --reset           # clear checkpoint and restart
 *   npm run playwright-pdf -- --all             # reprocess tenders that already have pdf_url
 *   npm run playwright-pdf -- --headful         # open visible Chrome window (debug)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
chromium.use(stealthPlugin());

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { extractTenderDataGroq } from '../lib/groq-ai.js';
import { normalizeState, normalizeCity, normalizeMinistry, cityToState } from '../lib/locations.js';
import { detectCategory } from '../lib/categories.js';

function parseGeMDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const dateMatch = dateStr.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      const timeMatch = dateStr.match(/(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?/i);
      let hours = '00', minutes = '00', seconds = '00';
      if (timeMatch) {
        hours   = timeMatch[1].padStart(2, '0');
        minutes = timeMatch[2];
        if (timeMatch[3]) seconds = timeMatch[3];
        const ampm = timeMatch[4]?.toUpperCase();
        if (ampm === 'PM' && parseInt(hours) < 12) hours = (parseInt(hours) + 12).toString().padStart(2, '0');
        else if (ampm === 'AM' && parseInt(hours) === 12) hours = '00';
      }
      return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`).toISOString();
    }
  } catch { /* fallthrough */ }
  return null;
}

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// ─── Config ──────────────────────────────────────────────────────────────────
const argv      = process.argv.slice(2);
const LIMIT_ARG = argv.find(a => a.startsWith('--limit='))?.split('=')[1];
const LIMIT     = LIMIT_ARG ? parseInt(LIMIT_ARG, 10) : null; // null = no limit
const DELAY     = parseInt(argv.find(a => a.startsWith('--delay='))?.split('=')[1]  || '3000', 10);
const HEADFUL   = argv.includes('--headful');
const RESET     = argv.includes('--reset');
const ALL       = argv.includes('--all');

const CHECKPOINT    = path.join(process.cwd(), 'playwright-pdf-progress.json');
const TMP_DIR       = path.join(process.cwd(), 'tmp');
const SESSION_EVERY = 80; // relaunch browser every N tenders

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Checkpoint ───────────────────────────────────────────────────────────────
function loadCheckpoint(): { done: number } {
  if (RESET || !fs.existsSync(CHECKPOINT)) return { done: 0 };
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8')); }
  catch { return { done: 0 }; }
}
function saveCheckpoint(done: number) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ done, updatedAt: new Date().toISOString() }));
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Browser helpers ──────────────────────────────────────────────────────────
async function launchBrowser() {
  const browser = await chromium.launch({
    headless: !HEADFUL,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    acceptDownloads: true,
  });

  return { browser, context };
}

async function establishSession(context: Awaited<ReturnType<typeof launchBrowser>>['context']) {
  const page = await context.newPage();
  try {
    await page.goto('https://bidplus.gem.gov.in/all-bids', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
  } catch {
    // Session page may partially load — cookies still get set
  } finally {
    await page.close();
  }
}

// ─── PDF download via browser ─────────────────────────────────────────────────
async function downloadPdfBuffer(
  context: Awaited<ReturnType<typeof launchBrowser>>['context'],
  bId: string,
  bidNumber: string,
): Promise<Buffer | null> {
  const pdfUrl = `https://bidplus.gem.gov.in/showbidDocument/${bId}`;
  const page   = await context.newPage();

  try {
    const downloadPromise = page.waitForEvent('download', { timeout: 35000 });

    try {
      await page.goto(pdfUrl, { waitUntil: 'load', timeout: 30000 });
    } catch {
      // Navigation may "fail" because the browser immediately triggers a file download
      // instead of loading an HTML page — this is expected and not an error.
    }

    const download = await downloadPromise;

    // Save to temp file, read into buffer, then clean up
    const tmpPath = path.join(TMP_DIR, `${bidNumber.replace(/\//g, '-')}_tmp.pdf`);
    await download.saveAs(tmpPath);

    if (!fs.existsSync(tmpPath)) return null;
    const buffer = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);

    return buffer.length > 500 ? buffer : null;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

// ─── Supabase upload ──────────────────────────────────────────────────────────
async function uploadToSupabase(buffer: Buffer, bidNumber: string): Promise<string | null> {
  const fileName = `${bidNumber.replace(/\//g, '-')}.pdf`;
  const { data, error } = await supabase.storage
    .from('tender-documents')
    .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

  if (error || !data) return null;
  const { data: urlData } = supabase.storage.from('tender-documents').getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ─── AI enrichment from PDF text ─────────────────────────────────────────────
function detectBidType(bidNo: string): string {
  if (/\/RA\//i.test(bidNo)) return 'Reverse Auction';
  return 'Open Bid';
}

async function buildAiPayload(pdfText: string, bidNumber: string): Promise<Record<string, any>> {
  const payload: Record<string, any> = {};
  try {
    const aiData = await extractTenderDataGroq(pdfText);
    if (!aiData) return payload;

    const auth = aiData.authority;
    if (auth?.ministry)    payload.ministry_name     = normalizeMinistry(auth.ministry);
    if (auth?.department)  payload.department_name   = auth.department;
    if (auth?.organisation) payload.organisation_name = normalizeMinistry(auth.organisation);
    if (auth?.office)      payload.office_name       = auth.office;

    if (auth?.consignee_city || auth?.city)
      payload.city = normalizeCity(auth.consignee_city || auth.city);
    if (auth?.consignee_state || auth?.state)
      payload.state = normalizeState(auth.consignee_state || auth.state);
    if (payload.city && !payload.state)
      payload.state = cityToState(payload.city);

    if (aiData.tender_title)       payload.title            = aiData.tender_title;
    if (aiData.emd_amount != null) payload.emd_amount       = aiData.emd_amount;
    if (aiData.quantity    != null) payload.quantity         = aiData.quantity;
    if (aiData.technical_summary)  payload.ai_summary       = aiData.technical_summary;

    if (aiData.eligibility) {
      payload.eligibility_msme = aiData.eligibility.msme || false;
      payload.eligibility_mii  = aiData.eligibility.mii  || false;
    }
    if (aiData.relaxations) {
      payload.mse_relaxation              = aiData.relaxations.mse_experience   || null;
      payload.mse_turnover_relaxation     = aiData.relaxations.mse_turnover     || null;
      payload.startup_relaxation          = aiData.relaxations.startup_experience || null;
      payload.startup_turnover_relaxation = aiData.relaxations.startup_turnover || null;
    }
    if (aiData.documents_required?.length)
      payload.documents_required = aiData.documents_required;

    payload.category = aiData.category
      || detectCategory((aiData.tender_title || '') + ' ' + (aiData.technical_summary || ''))
      || null;
    payload.bid_type = detectBidType(bidNumber);

    if (aiData.procurement_type) payload.procurement_type = aiData.procurement_type;
    if (aiData.keywords?.length)  payload.keywords          = aiData.keywords;

    if (aiData.dates) {
      const od = parseGeMDate(aiData.dates.bid_opening_date); if (od) payload.opening_date = od;
      const sd = parseGeMDate(aiData.dates.bid_start_date);   if (sd) payload.start_date   = sd;
      const ed = parseGeMDate(aiData.dates.bid_end_date);     if (ed) payload.end_date      = ed;
    }
  } catch (e: any) {
    console.warn(`  [AI] ${bidNumber}: ${e.message}`);
  }
  return payload;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n>>> [PLAYWRIGHT-PDF] Browser-based PDF downloader');
  console.log(`    Limit: ${LIMIT ?? 'ALL'} | Delay: ${DELAY}ms | Headful: ${HEADFUL}`);
  console.log(`    Mode: ${ALL ? 'ALL (reprocess)' : 'missing pdf_url only'}\n`);

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  // ── Query tenders ──────────────────────────────────────────────────────────
  let query = supabase
    .from('tenders')
    .select('id, bid_number, details_url')
    .not('details_url', 'is', null)
    .order('created_at', { ascending: false });

  if (LIMIT) query = query.limit(LIMIT);

  if (!ALL) query = query.is('pdf_url', null);

  const { data: tenders, error } = await query;
  if (error || !tenders?.length) {
    console.log('No tenders to process.');
    return;
  }
  console.log(`>>> Found ${tenders.length} tenders to process.\n`);

  let { done } = loadCheckpoint();
  if (done >= tenders.length) {
    done = 0;
    saveCheckpoint(0);
  }
  const toProcess = tenders.slice(done);
  if (done > 0) console.log(`>>> Resuming from ${done}\n`);

  const stats = { ok: 0, fail: 0, skip: 0 };

  // ── Launch browser ─────────────────────────────────────────────────────────
  let { browser, context } = await launchBrowser();
  process.stdout.write('Establishing GeM session... ');
  await establishSession(context);
  console.log('ready\n');

  for (let i = 0; i < toProcess.length; i++) {
    const tender = toProcess[i];
    const bId    = tender.details_url?.split('/').pop();

    // RA-type bIds are non-numeric — skip (different URL pattern)
    if (!bId || !/^\d+$/.test(bId)) {
      console.log(`  ~ Skip non-numeric bId: ${tender.bid_number}`);
      stats.skip++;
      done++;
      saveCheckpoint(done);
      continue;
    }

    process.stdout.write(`  [${done + 1}/${tenders.length}] ${tender.bid_number} ... `);

    // ── Session refresh every N tenders ──────────────────────────────────────
    if (i > 0 && i % SESSION_EVERY === 0) {
      process.stdout.write('\n>>> Refreshing browser session...\n');
      await browser.close();
      ({ browser, context } = await launchBrowser());
      await establishSession(context);
    }

    // ── Download PDF ──────────────────────────────────────────────────────────
    const buffer = await downloadPdfBuffer(context, bId, tender.bid_number);

    if (!buffer) {
      console.log('FAILED (no download)');
      stats.fail++;
      done++;
      saveCheckpoint(done);
      await sleep(DELAY);
      continue;
    }

    process.stdout.write(`${(buffer.length / 1024).toFixed(0)}KB `);

    // ── Upload to Supabase ────────────────────────────────────────────────────
    const pdfPublicUrl = await uploadToSupabase(buffer, tender.bid_number);
    if (!pdfPublicUrl) {
      console.log('FAILED (upload)');
      stats.fail++;
      done++;
      saveCheckpoint(done);
      await sleep(DELAY);
      continue;
    }

    // ── Extract PDF text + AI enrichment ─────────────────────────────────────
    let aiPayload: Record<string, any> = {};
    try {
      const parsed = await pdfParse(buffer, { max: 0 });
      const pdfText = parsed.text || '';
      if (pdfText.length > 50) {
        aiPayload = await buildAiPayload(pdfText, tender.bid_number);
      }
    } catch {
      // PDF parse failed — continue without AI data
    }

    // ── Save to DB ────────────────────────────────────────────────────────────
    const updatePayload = { pdf_url: pdfPublicUrl, enrichment_tried_at: new Date().toISOString(), ...aiPayload };
    await supabase.from('tenders').update(updatePayload).eq('id', tender.id);

    const emd = aiPayload.emd_amount != null ? ` emd=₹${aiPayload.emd_amount}` : '';
    console.log(`OK${emd}`);
    stats.ok++;
    done++;
    saveCheckpoint(done);

    await sleep(DELAY + Math.floor(Math.random() * 1000));
  }

  await browser.close();

  console.log(`\n>>> [PLAYWRIGHT-PDF] Done.`);
  console.log(`    ok=${stats.ok} | fail=${stats.fail} | skipped=${stats.skip}`);
  console.log(`    Run 'npm run stats' to see updated coverage.\n`);
}

main().catch(console.error);
