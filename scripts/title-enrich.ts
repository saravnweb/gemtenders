/**
 * Title-based Groq Enricher — No PDF, No Browser
 *
 * Enriches tenders using only title + department already in DB.
 * Sends batches of 15 to Groq, extracts ai_summary / keywords /
 * procurement_type / ministry_name / department_name.
 * Category is detected locally via detectCategory() (no API cost).
 *
 * Usage:
 *   npm run title-enrich                          # all active unenriched tenders
 *   npm run title-enrich -- --limit=5000          # first 5000
 *   npm run title-enrich -- --concurrency=5       # more parallel Groq calls
 *   npm run title-enrich -- --reset               # clear checkpoint and restart
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { detectCategory } from '../lib/categories.js';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const LIMIT       = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1]       || '50000', 10);
const CONCURRENCY = parseInt(argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '3',     10);
const BATCH_SIZE  = 15;   // tenders per Groq call
const RESET       = argv.includes('--reset');
const CHECKPOINT  = path.join(process.cwd(), 'title-enrich-progress.json');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const CATEGORY_IDS = ['it','civil','electrical','medical','furniture','vehicles','manpower',
  'security','transport','printing','catering','textile','maintenance','pipes-hardware',
  'cleaning','events-training','supplies','survey-consulting','water-environment','defence'];
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
  quantity: number | null;
};

type GroqResult = {
  id: string;
  ai_summary: string | null;
  keywords: string[];
  procurement_type: 'Goods' | 'Works' | 'Services' | null;
  ministry_name: string | null;
  department_name: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function detectBidType(bidNo: string): string {
  return /\/RA\//i.test(bidNo) ? 'Reverse Auction' : 'Open Bid';
}

function loadCheckpoint(): { offset: number; totalDone: number } {
  if (RESET || !fs.existsSync(CHECKPOINT)) return { offset: 0, totalDone: 0 };
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8')); }
  catch { return { offset: 0, totalDone: 0 }; }
}

function saveCheckpoint(offset: number, totalDone: number) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ offset, totalDone, updatedAt: new Date().toISOString() }));
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Groq batch call ─────────────────────────────────────────────────────────
async function callGroq(tenders: TenderRow[]): Promise<GroqResult[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const input = tenders.map(t => ({
    id: t.id,
    title: t.title,
    dept: t.department || '',
  }));

  const prompt = `You are a procurement data expert for Indian government tenders (GeM portal).
For each tender below, return a JSON array. Return ONLY valid JSON — no markdown, no explanation.

Tenders:
${JSON.stringify(input)}

Return exactly this structure for each item:
[{
  "id": "<same id as input>",
  "ai_summary": "1-sentence: what is being procured and for which organisation (max 120 chars)",
  "keywords": ["5 to 7 specific English keywords relevant to this tender"],
  "procurement_type": "Goods or Works or Services",
  "ministry_name": "ministry name extracted from dept field, or null",
  "department_name": "department name extracted from dept field, or null"
}]`;

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
    // Rate limited — back off and let caller retry
    if (res.status === 429) throw Object.assign(new Error('rate-limited'), { retryable: true });
    throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  const content: string = data.choices?.[0]?.message?.content || '';

  // Extract JSON array from response (handles both plain array and wrapped object)
  const arrMatch = content.match(/\[[\s\S]*\]/);
  if (!arrMatch) throw new Error(`No JSON array in Groq response: ${content.slice(0, 300)}`);

  const parsed = JSON.parse(arrMatch[0]) as GroqResult[];
  return parsed;
}

// ─── Process one sub-batch ────────────────────────────────────────────────────
async function processBatch(
  batch: TenderRow[],
  stats: { ok: number; fail: number }
): Promise<void> {
  const now = new Date().toISOString();
  let results: GroqResult[] = [];

  try {
    results = await callGroq(batch);
  } catch (e: any) {
    if (e.retryable) {
      // Back off 15s and retry once
      await sleep(15000);
      try { results = await callGroq(batch); }
      catch { /* fall through to mark tried */ }
    }
    if (!results.length) {
      // Mark all as tried so we don't loop forever
      await Promise.all(batch.map(t =>
        supabase.from('tenders').update({ enrichment_tried_at: now }).eq('id', t.id)
      ));
      stats.fail += batch.length;
      return;
    }
  }

  // Build a map for fast lookup
  const resultMap = new Map(results.map(r => [r.id, r]));

  await Promise.all(batch.map(async (tender) => {
    const r = resultMap.get(tender.id);
    const category = detectCategory(tender.title) ??
      (r && CATEGORY_IDS.includes(r.procurement_type as string) ? null : null);

    const payload: Record<string, any> = {
      bid_type:            detectBidType(tender.bid_number),
      category:            detectCategory(tender.title),
      enrichment_tried_at: now,
    };

    if (r) {
      if (r.ai_summary)       payload.ai_summary       = r.ai_summary;
      if (r.keywords?.length) payload.keywords         = r.keywords;
      if (r.procurement_type) payload.procurement_type = r.procurement_type;
      if (r.ministry_name)    payload.ministry_name    = r.ministry_name;
      if (r.department_name)  payload.department_name  = r.department_name;
    }

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
  console.log(`\n>>> [TITLE-ENRICH] Groq enrichment without PDF.`);
  console.log(`    Limit: ${LIMIT} | Batch/call: ${BATCH_SIZE} | Concurrency: ${CONCURRENCY}\n`);

  if (!process.env.GROQ_API_KEY) {
    console.error('ERROR: GROQ_API_KEY not set in .env.local');
    process.exit(1);
  }

  let { offset, totalDone } = loadCheckpoint();
  if (offset > 0) console.log(`>>> Resuming from offset ${offset} (${totalDone} previously done)\n`);

  const stats      = { ok: 0, fail: 0 };
  const startTime  = Date.now();
  const FETCH_SIZE = BATCH_SIZE * CONCURRENCY * 2;   // rows per DB round-trip

  while (totalDone < LIMIT) {
    const fetchSize = Math.min(FETCH_SIZE, LIMIT - totalDone);

    const { data: tenders, error } = await supabase
      .from('tenders')
      .select('id, bid_number, title, department, quantity')
      .is('ai_summary', null)
      .is('enrichment_tried_at', null)
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + fetchSize - 1);

    if (error) { console.error('DB error:', error.message); break; }
    if (!tenders?.length) { console.log('\n>>> No more tenders to enrich.'); break; }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`[offset=${offset}] ${tenders.length} fetched | done=${totalDone} | elapsed=${elapsed}m`);

    // Split into sub-batches and process CONCURRENCY at a time
    const subBatches: TenderRow[][] = [];
    for (let i = 0; i < tenders.length; i += BATCH_SIZE) {
      subBatches.push(tenders.slice(i, i + BATCH_SIZE));
    }

    for (let ci = 0; ci < subBatches.length; ci += CONCURRENCY) {
      const chunk = subBatches.slice(ci, ci + CONCURRENCY);
      await Promise.all(chunk.map(b => processBatch(b, stats)));
      process.stdout.write(`\r  ok=${stats.ok} fail=${stats.fail}   `);
      // 1 second between bursts to respect Groq rate limits
      if (ci + CONCURRENCY < subBatches.length) await sleep(1000);
    }

    totalDone += tenders.length;
    offset    += tenders.length;
    saveCheckpoint(offset, totalDone);

    const rate = (stats.ok / Math.max((Date.now() - startTime) / 60000, 0.01)).toFixed(0);
    console.log(`\n  Enriched: ${stats.ok} | Failed: ${stats.fail} | Rate: ${rate}/min\n`);
  }

  const totalMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n>>> [TITLE-ENRICH] Done in ${totalMin}m`);
  console.log(`    Enriched: ${stats.ok} | Failed: ${stats.fail} | Total processed: ${totalDone}`);
}

main().catch(console.error);
