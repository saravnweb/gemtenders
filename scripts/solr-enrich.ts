/**
 * SOLR + Groq Enricher — No PDF Required
 *
 * GeM PDFs are server-blocked (Content-Length: 0, all approaches fail).
 * This script uses two data sources:
 *
 *   1. GeM SOLR API  — structured fields: category_name, ministry, department,
 *                       quantity, bid_type, high_value flag
 *   2. Groq AI       — ai_summary, keywords, procurement_type, inferred state/city
 *                       (prompted with title + SOLR category + ministry + dept)
 *
 * Usage:
 *   npm run solr-enrich                          # all unenriched active tenders
 *   npm run solr-enrich -- --limit=500           # first N tenders
 *   npm run solr-enrich -- --concurrency=5       # more parallel Groq calls
 *   npm run solr-enrich -- --reset               # clear checkpoint and restart
 *   npm run solr-enrich -- --all                 # include already-enriched tenders
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { detectCategory } from '../lib/categories.js';
import { normalizeState, normalizeCity, cityToState } from '../lib/locations.js';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const LIMIT       = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1]       || '50000', 10);
const CONCURRENCY = parseInt(argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '3',     10);
const BATCH_SIZE  = 10;   // tenders per Groq call (smaller = more reliable JSON parsing)
const RESET       = argv.includes('--reset');
const ALL         = argv.includes('--all');   // re-enrich even already-enriched tenders
const CHECKPOINT  = path.join(process.cwd(), 'solr-enrich-progress.json');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const HTTPS_AGENT  = new https.Agent({ rejectUnauthorized: false });
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TenderRow = {
  id: string;
  bid_number: string;
  title: string;
  department: string | null;
  details_url: string | null;
  quantity: number | null;
  ministry_name: string | null;
  department_name: string | null;
  state: string | null;
  city: string | null;
};

type SolrDoc = {
  b_bid_number?: string[];
  b_category_name?: string[];
  bd_category_name?: string[];
  ba_official_details_minName?: string[];
  ba_official_details_deptName?: string[];
  b_total_quantity?: number[];
  b_bid_type?: number[];   // 1=Open, 2=RA
  is_high_value?: boolean;
};

type GroqResult = {
  id: string;
  ai_summary: string | null;
  keywords: string[];
  procurement_type: 'Goods' | 'Services' | 'Works' | null;
  state: string | null;
  city: string | null;
};

// ─── SOLR Session ─────────────────────────────────────────────────────────────
let solrCookies = '';
let solrCsrf    = '';

async function refreshSolrSession(): Promise<boolean> {
  try {
    const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
      httpsAgent: HTTPS_AGENT,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 20000,
    });
    solrCookies = res.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
    solrCsrf    = (res.data as string).match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/)?.[1] || '';
    return !!(solrCookies && solrCsrf);
  } catch {
    return false;
  }
}

async function querySolr(bidNumber: string): Promise<SolrDoc | null> {
  if (!solrCsrf) {
    const ok = await refreshSolrSession();
    if (!ok) return null;
  }

  const form = new URLSearchParams();
  form.append('payload', JSON.stringify({
    page: 1,
    param: { searchParam: 'searchbid', search: bidNumber },
    filter: {},
  }));
  form.append('csrf_bd_gem_nk', solrCsrf);

  try {
    const r = await axios.post('https://bidplus.gem.gov.in/all-bids-data', form.toString(), {
      httpsAgent: HTTPS_AGENT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://bidplus.gem.gov.in/all-bids',
        'Cookie': solrCookies,
      },
      timeout: 15000,
    });

    const docs: SolrDoc[] = r.data?.response?.response?.docs || [];
    // Find exact bid_number match
    return docs.find(d => d.b_bid_number?.[0] === bidNumber) || null;
  } catch (e: any) {
    // CSRF expired — refresh next call
    if (e.response?.status === 403 || e.response?.status === 419) {
      solrCsrf = '';
    }
    return null;
  }
}

function solrBidType(doc: SolrDoc, bidNo: string): string {
  if (/\/RA\//i.test(bidNo)) return 'Reverse Auction';
  if (doc.b_bid_type?.[0] === 2) return 'Reverse Auction';
  return 'Open Bid';
}

// ─── Groq batch call ─────────────────────────────────────────────────────────
async function callGroq(tenders: (TenderRow & { gem_category?: string })[]) : Promise<GroqResult[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const input = tenders.map(t => ({
    id:       t.id,
    title:    t.title,
    category: t.gem_category || '',
    ministry: t.ministry_name || '',
    dept:     t.department || '',
  }));

  const prompt = `You are a procurement analyst for Indian government tenders (GeM portal).
For each tender, return a JSON array. Return ONLY valid JSON — no markdown, no explanation.

Tenders:
${JSON.stringify(input)}

For each item return:
[{
  "id": "<same id>",
  "ai_summary": "1–2 sentences: what is being procured, for which ministry/dept, and why it matters to vendors (max 150 chars)",
  "keywords": ["6 to 8 specific English keywords for this tender"],
  "procurement_type": "Goods or Services or Works",
  "state": "Indian state name inferred from dept/ministry field (e.g. 'Maharashtra' if dept mentions it), or null if unclear",
  "city": "City inferred from dept/ministry field, or null if unclear"
}]

Rules:
- ai_summary must be action-oriented and useful for a vendor deciding to bid
- Extract state/city ONLY when clearly present in ministry or dept string (e.g. "Andhra Pradesh", "Delhi", "Mumbai")
- For state: use full official state name (e.g. "Uttar Pradesh" not "UP")`;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw Object.assign(new Error('rate-limited'), { retryable: true });
    throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  const content: string = data.choices?.[0]?.message?.content || '';
  const arrMatch = content.match(/\[[\s\S]*\]/);
  if (!arrMatch) throw new Error(`No JSON array in Groq response: ${content.slice(0, 300)}`);
  return JSON.parse(arrMatch[0]) as GroqResult[];
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────
function loadCheckpoint(): { offset: number; totalDone: number } {
  if (RESET || !fs.existsSync(CHECKPOINT)) return { offset: 0, totalDone: 0 };
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8')); }
  catch { return { offset: 0, totalDone: 0 }; }
}
function saveCheckpoint(offset: number, totalDone: number) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ offset, totalDone, updatedAt: new Date().toISOString() }));
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Process a sub-batch ──────────────────────────────────────────────────────
async function processBatch(
  batch: TenderRow[],
  stats: { ok: number; fail: number; solrHit: number }
): Promise<void> {
  const now = new Date().toISOString();

  // Step 1: Query SOLR for each tender (sequentially to avoid hammering)
  const enrichedBatch: (TenderRow & { gem_category?: string; solrDoc?: SolrDoc })[] = [];
  for (const tender of batch) {
    const doc = await querySolr(tender.bid_number);
    const gemCategory = doc?.b_category_name?.[0] || doc?.bd_category_name?.[0] || undefined;
    if (doc) stats.solrHit++;
    enrichedBatch.push({ ...tender, gem_category: gemCategory, solrDoc: doc });
    await sleep(200); // gentle rate-limit on SOLR
  }

  // Step 2: Groq batch call
  let results: GroqResult[] = [];
  try {
    results = await callGroq(enrichedBatch);
  } catch (e: any) {
    if (e.retryable) {
      await sleep(15000);
      try { results = await callGroq(enrichedBatch); }
      catch { /* fall through */ }
    }
  }
  const resultMap = new Map(results.map(r => [r.id, r]));

  // Step 3: Build update payloads
  await Promise.all(enrichedBatch.map(async (tender) => {
    const groq = resultMap.get(tender.id);
    const doc  = tender.solrDoc;

    // Category: detectCategory locally (fast), or from SOLR
    const localCategory = detectCategory(tender.title);
    const gemCategory   = tender.gem_category || null;

    // State/city: prefer existing DB values, then Groq inference, then normalize
    let state = tender.state;
    let city  = tender.city;
    if (!state && groq?.state) state = normalizeState(groq.state);
    if (!city  && groq?.city)  city  = normalizeCity(groq.city);
    if (city && !state) {
      const inferred = cityToState(city);
      if (inferred) state = inferred;
    }

    const payload: Record<string, any> = {
      enrichment_tried_at: now,
      bid_type:     doc ? solrBidType(doc, tender.bid_number) : (/\/RA\//i.test(tender.bid_number) ? 'Reverse Auction' : 'Open Bid'),
      category:     localCategory || null,
    };

    // SOLR structured fields
    if (doc) {
      if (!tender.ministry_name    && doc.ba_official_details_minName?.[0])
        payload.ministry_name    = doc.ba_official_details_minName[0];
      if (!tender.department_name  && doc.ba_official_details_deptName?.[0])
        payload.department_name  = doc.ba_official_details_deptName[0];
      if (!tender.quantity         && doc.b_total_quantity?.[0])
        payload.quantity         = doc.b_total_quantity[0];
      // Store the GeM catalog category in ai_summary prefix if no existing summary
    }

    // Groq enrichment
    if (groq) {
      if (groq.ai_summary)       payload.ai_summary       = gemCategory
        ? `[${gemCategory}] ${groq.ai_summary}`
        : groq.ai_summary;
      if (groq.keywords?.length) payload.keywords         = groq.keywords;
      if (groq.procurement_type) payload.procurement_type = groq.procurement_type;
    }

    if (state) payload.state = state;
    if (city)  payload.city  = city;

    const { error } = await supabase.from('tenders').update(payload).eq('id', tender.id);
    if (error) {
      console.error(`\n  DB error for ${tender.bid_number}: ${error.message}`);
      stats.fail++;
    } else {
      stats.ok++;
    }
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n>>> [SOLR-ENRICH] PDF-free enrichment via SOLR API + Groq AI`);
  console.log(`    Limit: ${LIMIT} | Batch: ${BATCH_SIZE} | Concurrency: ${CONCURRENCY}`);
  console.log(`    Mode: ${ALL ? 'ALL tenders (including enriched)' : 'unenriched only'}\n`);

  if (!process.env.GROQ_API_KEY) {
    console.error('ERROR: GROQ_API_KEY not set in .env.local');
    process.exit(1);
  }

  // Pre-warm SOLR session
  process.stdout.write('Connecting to GeM SOLR API... ');
  const solrOk = await refreshSolrSession();
  console.log(solrOk ? '✅ Connected' : '⚠️  SOLR unavailable (will skip structured fields)');

  let { offset, totalDone } = loadCheckpoint();
  if (offset > 0) console.log(`>>> Resuming from offset ${offset}\n`);

  const stats     = { ok: 0, fail: 0, solrHit: 0 };
  const startTime = Date.now();
  const FETCH_SIZE = BATCH_SIZE * CONCURRENCY * 2;

  while (totalDone < LIMIT) {
    const fetchSize = Math.min(FETCH_SIZE, LIMIT - totalDone);

    let query = supabase
      .from('tenders')
      .select('id, bid_number, title, department, details_url, quantity, ministry_name, department_name, state, city')
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + fetchSize - 1);

    if (!ALL) {
      query = query.is('ai_summary', null).is('enrichment_tried_at', null);
    }

    const { data: tenders, error } = await query;
    if (error) { console.error('DB error:', error.message); break; }
    if (!tenders?.length) { console.log('\n>>> No more tenders to enrich.'); break; }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`[offset=${offset}] ${tenders.length} fetched | done=${totalDone} | elapsed=${elapsed}m | SOLR hits=${stats.solrHit}`);

    const subBatches: TenderRow[][] = [];
    for (let i = 0; i < tenders.length; i += BATCH_SIZE) {
      subBatches.push(tenders.slice(i, i + BATCH_SIZE) as TenderRow[]);
    }

    for (let ci = 0; ci < subBatches.length; ci += CONCURRENCY) {
      const chunk = subBatches.slice(ci, ci + CONCURRENCY);
      await Promise.all(chunk.map(b => processBatch(b, stats)));
      process.stdout.write(`\r  ok=${stats.ok} fail=${stats.fail} solr_hits=${stats.solrHit}   `);
      if (ci + CONCURRENCY < subBatches.length) await sleep(1000);
    }

    totalDone += tenders.length;
    offset    += tenders.length;
    saveCheckpoint(offset, totalDone);

    const rate = (stats.ok / Math.max((Date.now() - startTime) / 60000, 0.01)).toFixed(0);
    console.log(`\n  ok=${stats.ok} fail=${stats.fail} solr_hits=${stats.solrHit} | rate=${rate}/min\n`);
  }

  const totalMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n>>> [SOLR-ENRICH] Done in ${totalMin}m`);
  console.log(`    ok=${stats.ok} | fail=${stats.fail} | SOLR hits=${stats.solrHit} | total=${totalDone}`);
}

main().catch(console.error);
