/**
 * Leaf Detail Enricher — Full HTML leaf page extraction
 *
 * SOLR enrichment only gives us category/ministry/dept/quantity.
 * This script fetches each tender's individual HTML page from GeM to extract:
 *   estimated_value, emd_amount, epbg_percentage, min_turnover_lakhs,
 *   experience_years, delivery_days, num_consignees, opening_date,
 *   pre_bid_date, eligibility_msme, eligibility_mii, mse_relaxation,
 *   startup_relaxation, documents_required, organisation_name, office_name
 *
 * Leaf page URL: https://bidplus.gem.gov.in/bidding/bid/bidBoeShow/{b_id}
 * b_id is extracted from the stored details_url column.
 *
 * Usage:
 *   npm run leaf-enrich                        # all unenriched active tenders
 *   npm run leaf-enrich -- --limit=200         # first N tenders
 *   npm run leaf-enrich -- --concurrency=3     # parallel leaf fetches
 *   npm run leaf-enrich -- --no-groq           # Cheerio-only (no AI cost)
 *   npm run leaf-enrich -- --reset             # clear checkpoint and restart
 *   npm run leaf-enrich -- --all               # re-process already tried tenders
 *
 * DB Migration (run once in Supabase SQL editor):
 *   ALTER TABLE tenders ADD COLUMN IF NOT EXISTS leaf_tried_at TIMESTAMPTZ DEFAULT NULL;
 *   CREATE INDEX IF NOT EXISTS idx_tenders_leaf_tried ON tenders(leaf_tried_at) WHERE leaf_tried_at IS NULL;
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

process.on('unhandledRejection', (reason) => {
  console.error('\n UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('\n UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { getComputedFields } from '../lib/computed-fields.js';
import { normalizeState, normalizeCity, pinToState, cityToState } from '../lib/locations.js';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const LIMIT       = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1]       || '50000', 10);
const CONCURRENCY = parseInt(argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '3',     10);
const BATCH_SIZE  = 5;
const RESET       = argv.includes('--reset');
const ALL         = argv.includes('--all');
const NO_GROQ     = argv.includes('--no-groq');
const CHECKPOINT  = path.join(process.cwd(), 'leaf-enrich-progress.json');
const SINCE_ARG   = argv.find(a => a.startsWith('--since='))?.split('=')[1] ?? null;
const SINCE_DATE: string | null = (() => {
  if (!SINCE_ARG) return null;
  const m = SINCE_ARG.match(/^(\d+)(h|d)$/);
  if (!m) return null;
  const ms = parseInt(m[1]) * (m[2] === 'h' ? 3600000 : 86400000);
  return new Date(Date.now() - ms).toISOString();
})();

// bidBoeShow requires buyer login → 404 with public session.
// getBidResultView is the publicly accessible bid detail page (confirmed working).
const LEAF_URL    = (bId: string) => `https://bidplus.gem.gov.in/bidding/bid/getBidResultView/${bId}`;
const HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

// Session refresh every N tenders to avoid cookie expiry
const SESSION_REFRESH_INTERVAL = 150;
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TenderRow = {
  id: string;
  bid_number: string;
  title: string;
  details_url: string;
  state: string | null;
  city: string | null;
  ministry_name: string | null;
  department_name: string | null;
  min_turnover_lakhs: number | null;
  ai_summary: string | null;
};

type LeafData = {
  // Financial (available only if bidBoeShow works; fallback via Groq from raw_text)
  estimated_value?: number | null;
  emd_amount?: number | null;
  epbg_percentage?: number | null;
  delivery_days?: number | null;
  pre_bid_date?: string | null;
  eligibility_msme?: boolean;
  eligibility_mii?: boolean;
  mse_relaxation?: string | null;
  startup_relaxation?: string | null;
  documents_required?: string[];
  // Available from getBidResultView buyer section
  min_turnover_lakhs?: number | null;
  experience_years?: number | null;
  num_consignees?: number | null;
  opening_date?: string | null;
  organisation_name?: string | null;
  office_name?: string | null;
  state?: string | null;
  city?: string | null;
  ministry_name?: string | null;
  department_name?: string | null;
  raw_text?: string;
  past_experience_required?: string | null;
  // AI-generated
  ai_summary?: string | null;
  keywords?: string[];
};

// ─── Session ──────────────────────────────────────────────────────────────────
let gemCookies = '';

async function refreshSession(): Promise<boolean> {
  try {
    const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
      httpsAgent: HTTPS_AGENT,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 20000,
    });
    gemCookies = res.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
    return !!gemCookies;
  } catch {
    return false;
  }
}

// ─── Leaf Page Fetch & Parse ──────────────────────────────────────────────────
function extractNumeric(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[,\u20B9\s]/g, '');
  const match = cleaned.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function parseIndianDate(str: string): string | null {
  if (!str) return null;
  const cleaned = str.trim();
  try {
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch { /* fall through */ }
  // DD-Mon-YYYY
  const m = cleaned.match(/(\d{1,2})[-\/](\w{3,})[-\/](\d{4})/);
  if (m) {
    try {
      const d = new Date(`${m[1]} ${m[2]} ${m[3]}`);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch { /* ignore */ }
  }
  return null;
}

function parseLeafHtml(html: string): LeafData {
  const $ = cheerio.load(html);
  const data: LeafData = {};

  // Capture raw text for Groq fallback
  data.raw_text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);

  // Walk all table rows — match header cell text to known field names
  $('tr').each((_, row) => {
    const cells = $(row).find('th, td');
    if (cells.length < 2) return;

    const header = cells.eq(0).text().trim().toLowerCase();
    const value  = cells.eq(cells.length - 1).text().trim();

    if (!header || !value) return;

    if (header.includes('estimated bid value') || header.includes('estimated value')) {
      data.estimated_value = extractNumeric(value);
    } else if (header.includes('emd amount') || /earnest money/.test(header)) {
      data.emd_amount = extractNumeric(value);
    } else if (header.includes('epbg') || header.includes('performance bank guarantee')) {
      data.epbg_percentage = extractNumeric(value);
    } else if (header.includes('minimum average annual turnover') || header.includes('annual turnover')) {
      data.min_turnover_lakhs = extractNumeric(value);
    } else if (header.includes('experience') && !header.includes('work')) {
      data.experience_years = extractNumeric(value);
    } else if (header.includes('delivery period') || header.includes('completion period')) {
      data.delivery_days = extractNumeric(value);
    } else if (header.includes('bid opening date') || header.includes('opening date')) {
      data.opening_date = parseIndianDate(value);
    } else if (/pre.?bid/.test(header)) {
      data.pre_bid_date = parseIndianDate(value);
    } else if (header.includes('organisation name') || header.includes('organization name')) {
      if (!data.organisation_name) data.organisation_name = value;
    } else if (header.includes('office name') || header.includes('consignee office')) {
      if (!data.office_name) data.office_name = value;
    } else if (header.includes('mse relaxation') || header.includes('mse experience')) {
      data.mse_relaxation = value;
    } else if (header.includes('startup relaxation') || header.includes('startup experience')) {
      data.startup_relaxation = value;
    }
  });

  // ── getBidResultView: span > strong labels (turnover, experience) ──
  $('span strong').each((_, el) => {
    const label = $(el).text().trim().toLowerCase();
    const val   = $(el).next('span').text().trim();
    if (!val) return;
    if (label.includes('average turn over') || label.includes('average turnover')) {
      const n = parseFloat(val.replace(/lakhs?/i, '').replace(/,/g, '').trim());
      if (!isNaN(n) && n > 0) data.min_turnover_lakhs = n > 9999 ? Math.round(n / 1000) / 100 : n;
    } else if (label.includes('experience with gov')) {
      const n = parseFloat(val.replace(/,/g, '').trim());
      if (!isNaN(n) && n > 0) data.experience_years = n;
    } else if (label.includes('project experience required') || label.includes('past experience')) {
      // "Yes" / "No" / "Yes - 2 Years" etc.
      data.past_experience_required = val;
    } else if (label.includes('bid opening date') || label.includes('opening date')) {
      data.opening_date = parseIndianDate(val);
    }
  });

  // ── getBidResultView: p > strong labels (ministry, dept, org, office, address) ──
  $('p strong').each((_, el) => {
    const label = $(el).text().trim().toLowerCase().replace(/:\s*$/, '').trim();
    const val   = $(el).next('span').text().trim();
    if (!val) return;
    if      (label === 'ministry')                             data.ministry_name    = val;
    else if (label === 'department')                           data.department_name  = val;
    else if (label === 'organisation' || label === 'organization') data.organisation_name = val;
    else if (label === 'office')                               data.office_name      = val;
    else if (label === 'address') {
      // Format: "...,CityName,STATE NAME,PINCODE,India,..."
      const parts = val.split(',').map(p => p.trim()).filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        if (/^\d{6}$/.test(parts[i])) {
          data.state = normalizeState(parts[i - 1]) || pinToState(parts[i]);
          data.city  = normalizeCity(parts[i - 2]) || null;
          break;
        }
      }
      if (!data.state) {
        const pin = val.match(/\b(\d{6})\b/);
        if (pin) data.state = pinToState(pin[1]);
      }
      if (data.city && !data.state) data.state = cityToState(data.city);
    }
  });

  // MSME / MII eligibility — badges, labels, or body text
  const bodyText = data.raw_text.toLowerCase();
  if (
    $('[class*="msme"]').length > 0 ||
    $('[id*="msme"]').length > 0 ||
    bodyText.includes('msme eligible') ||
    bodyText.includes('mse eligible') ||
    /eligibility.*msme|msme.*eligib/.test(bodyText)
  ) {
    data.eligibility_msme = true;
  }
  if (
    $('[class*="mii"]').length > 0 ||
    bodyText.includes('make in india') ||
    /class.*ii|class ii item/.test(bodyText)
  ) {
    data.eligibility_mii = true;
  }

  // Documents required — list items near a "documents" heading
  const docs: string[] = [];
  $('th, td, h4, h5, strong').filter((_, el) =>
    $(el).text().toLowerCase().includes('document')
  ).each((_, el) => {
    const container = $(el).closest('table, div, section');
    container.find('li').each((_, li) => {
      const txt = $(li).text().trim();
      if (txt.length > 3 && txt.length < 300) docs.push(txt);
    });
  });
  if (docs.length > 0) data.documents_required = [...new Set(docs)].slice(0, 20);

  // Consignees — count data rows in the consignee table
  $('table').each((_, tbl) => {
    const text = $(tbl).text().toLowerCase();
    if (text.includes('consignee') || text.includes('delivery location')) {
      const rows = $(tbl).find('tr').length;
      if (rows > 1) data.num_consignees = rows - 1;
      return false; // stop after first match
    }
  });

  return data;
}

function countExtractedFields(d: LeafData): number {
  return [
    d.estimated_value, d.emd_amount, d.epbg_percentage, d.min_turnover_lakhs,
    d.experience_years, d.delivery_days, d.opening_date, d.num_consignees,
  ].filter(v => v !== null && v !== undefined).length;
}

// ─── Groq Fallback ────────────────────────────────────────────────────────────
type GroqLeafResult = Omit<LeafData, 'raw_text'>;

async function enrichWithGroq(rawText: string): Promise<GroqLeafResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are extracting structured fields from a GeM (Government e-Marketplace) tender detail page.
Extract the following fields from the text below. Return ONLY valid JSON — no markdown, no explanation.

Text:
${rawText.slice(0, 6000)}

Return a single JSON object:
{
  "min_turnover_lakhs": <number in lakhs as-given or null — from "Average Turn Over of Last 3 Years">,
  "experience_years": <number of years or null>,
  "opening_date": <ISO date string or null — from "Bid Opening Date / Time">,
  "num_consignees": <integer count of delivery locations or null>,
  "estimated_value": <number in INR or null>,
  "emd_amount": <number in INR or null>,
  "epbg_percentage": <number percent or null>,
  "delivery_days": <number of days or null — convert months to days if needed>,
  "pre_bid_date": <ISO date string or null>,
  "eligibility_msme": <true if MSME/MSE eligible, false otherwise>,
  "eligibility_mii": <true if Make in India / MII required, false otherwise>,
  "mse_relaxation": <string describing MSE relaxation or null>,
  "startup_relaxation": <string describing startup relaxation or null>,
  "documents_required": [<list of required document names, max 10>],
  "organisation_name": <string or null>,
  "office_name": <string or null>,
  "state": <Indian state name inferred from Address or Ministry/Dept field, or null>,
  "city": <city name inferred from Address field, or null>,
  "past_experience_required": <"Yes", "No", or short string like "Yes - 2 Years" from "Project Experience Required" field, or null>
}

Rules:
- min_turnover_lakhs: keep as-given in lakhs (do not convert)
- estimated_value: if shown in lakhs multiply by 100000, in crores multiply by 10000000
- state: use full official state name (e.g. "Maharashtra" not "MH")
- Return null for any field not clearly present in the text`;

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.0,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw Object.assign(new Error('rate-limited'), { retryable: true });
      return null;
    }

    const data = await res.json() as any;
    const content: string = data.choices?.[0]?.message?.content || '';
    return JSON.parse(content) as GroqLeafResult;
  } catch (e: any) {
    if (e.retryable) throw e;
    return null;
  }
}

// ─── AI Summary Generator ────────────────────────────────────────────────────
async function generateSummary(
  rawText: string,
  title: string,
): Promise<{ ai_summary: string | null; keywords: string[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ai_summary: null, keywords: [] };

  const prompt = `You are a procurement analyst. Given the text of a GeM (Government e-Marketplace) tender detail page, write a concise summary and extract keywords.

Tender title: ${title}

Page text:
${rawText.slice(0, 5000)}

Return ONLY valid JSON:
{
  "ai_summary": "<2-3 sentence summary: what is being procured, who needs it, any key requirements like MSME/MII eligibility or turnover>",
  "keywords": ["<5-10 relevant keywords for search>"]
}`;

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return { ai_summary: null, keywords: [] };
    const data = await res.json() as any;
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return {
      ai_summary: parsed.ai_summary || null,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch {
    return { ai_summary: null, keywords: [] };
  }
}

// ─── HTTP Leaf Fetch ──────────────────────────────────────────────────────────
async function fetchLeafPage(bId: string): Promise<string | null> {
  try {
    const r = await axios.get(LEAF_URL(bId), {
      httpsAgent: HTTPS_AGENT,
      headers: {
        Cookie:    gemCookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer':    'https://bidplus.gem.gov.in/all-bids',
        'Accept':     'text/html,application/xhtml+xml',
      },
      timeout: 20000,
      responseType: 'text',
    });

    if (r.status !== 200 || !r.data || typeof r.data !== 'string') return null;
    // Detect redirect to login page — getBidResultView always contains 'BID DETAILS'
    const lower = (r.data as string).toLowerCase();
    if (!lower.includes('bid details') && !lower.includes('average turn over') && !lower.includes('ministry')) {
      return null;
    }
    return r.data as string;
  } catch {
    return null;
  }
}

// ─── Checkpoint ────────────────────────────────────────────────────────────────
function loadCheckpoint(): { offset: number; totalDone: number } {
  if (RESET || !fs.existsSync(CHECKPOINT)) return { offset: 0, totalDone: 0 };
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8')); }
  catch { return { offset: 0, totalDone: 0 }; }
}
function saveCheckpoint(offset: number, totalDone: number) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ offset, totalDone, updatedAt: new Date().toISOString() }));
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Process Single Tender ────────────────────────────────────────────────────
async function processTender(
  tender: TenderRow,
  stats: { ok: number; fail: number; groqUsed: number; empty: number }
): Promise<void> {
  const bId = tender.details_url?.split('/').pop();
  if (!bId || !/^\d+$/.test(bId)) {
    // Non-numeric bId (RA-type suffix) — mark tried, skip
    await supabase.from('tenders').update({ leaf_tried_at: new Date().toISOString() }).eq('id', tender.id);
    stats.empty++;
    return;
  }

  const html = await fetchLeafPage(bId);
  if (!html) {
    await supabase.from('tenders').update({ leaf_tried_at: new Date().toISOString() }).eq('id', tender.id);
    stats.fail++;
    return;
  }

  const leafData = parseLeafHtml(html);
  const cheerioFields = countExtractedFields(leafData);

  // Groq fallback when Cheerio extraction yields too few fields
  if (!NO_GROQ && cheerioFields < 2 && leafData.raw_text && leafData.raw_text.length > 200) {
    try {
      const groqResult = await enrichWithGroq(leafData.raw_text);
      if (groqResult) {
        for (const [k, v] of Object.entries(groqResult)) {
          const key = k as keyof LeafData;
          if (leafData[key] === null || leafData[key] === undefined) {
            (leafData as any)[key] = v;
          }
        }
        stats.groqUsed++;
      }
    } catch (e: any) {
      if (e.retryable) {
        await sleep(15000);
        try {
          const groqResult = await enrichWithGroq(leafData.raw_text!);
          if (groqResult) {
            for (const [k, v] of Object.entries(groqResult)) {
              const key = k as keyof LeafData;
              if (leafData[key] === null || leafData[key] === undefined) {
                (leafData as any)[key] = v;
              }
            }
            stats.groqUsed++;
          }
        } catch { /* give up on this tender */ }
      }
    }
  }

  // AI summary — generate if missing (uses raw HTML text, no PDF needed)
  if (!NO_GROQ && !tender.ai_summary && leafData.raw_text && leafData.raw_text.length > 200) {
    try {
      const { ai_summary, keywords } = await generateSummary(leafData.raw_text, tender.title);
      if (ai_summary) leafData.ai_summary = ai_summary;
      if (keywords.length) leafData.keywords = keywords;
    } catch { /* non-critical, continue */ }
  }

  // Build DB update payload — only include fields with actual values
  const payload: Record<string, any> = {
    leaf_tried_at: new Date().toISOString(),
  };

  const fields: (keyof LeafData)[] = [
    'estimated_value', 'emd_amount', 'epbg_percentage', 'min_turnover_lakhs',
    'experience_years', 'delivery_days', 'num_consignees', 'opening_date',
    'pre_bid_date', 'eligibility_msme', 'eligibility_mii', 'mse_relaxation',
    'startup_relaxation', 'documents_required', 'organisation_name', 'office_name',
    'state', 'city', 'ministry_name', 'department_name',
    'past_experience_required', 'raw_text', 'ai_summary', 'keywords',
  ];

  // Fields that should not overwrite existing DB values
  const protectedFields = new Set<keyof LeafData>(['state', 'city', 'ministry_name', 'department_name', 'min_turnover_lakhs', 'ai_summary', 'keywords']);

  for (const f of fields) {
    const val = leafData[f];
    if (val === null || val === undefined) continue;
    // Don't overwrite if the DB already has a value for this field
    if (protectedFields.has(f) && (tender as any)[f]) continue;
    payload[f] = val;
  }

  // Computed derived fields
  const computed = getComputedFields({
    emd_amount:         leafData.emd_amount,
    eligibility_msme:   leafData.eligibility_msme,
    eligibility_mii:    leafData.eligibility_mii,
    estimated_value:    leafData.estimated_value,
    min_turnover_lakhs: leafData.min_turnover_lakhs,
    startup_relaxation: leafData.startup_relaxation,
    epbg_percentage:    leafData.epbg_percentage,
  });
  Object.assign(payload, computed);

  const { error } = await supabase.from('tenders').update(payload).eq('id', tender.id);
  if (error) {
    console.error(`\n  DB error for ${tender.bid_number}: ${error.message}`);
    stats.fail++;
  } else {
    stats.ok++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n>>> [LEAF-ENRICH] Full leaf page extraction`);
  console.log(`    Limit: ${LIMIT} | Batch: ${BATCH_SIZE} | Concurrency: ${CONCURRENCY}`);
  console.log(`    Groq fallback: ${NO_GROQ ? 'DISABLED' : 'ENABLED'}`);
  console.log(`    Mode: ${ALL ? 'ALL tenders' : 'un-tried only'}\n`);

  process.stdout.write('Establishing GeM session... ');
  const sessionOk = await refreshSession();
  if (!sessionOk) {
    console.error('Failed to get session cookies. Check network.');
    process.exit(1);
  }
  console.log('Session ready');

  let { offset, totalDone } = loadCheckpoint();
  if (offset > 0) console.log(`>>> Resuming from offset ${offset}\n`);

  const stats     = { ok: 0, fail: 0, groqUsed: 0, empty: 0 };
  const startTime = Date.now();
  const FETCH_SIZE = 300;
  let sessionCounter = 0;

  while (totalDone < LIMIT) {
    const fetchSize = Math.min(FETCH_SIZE, LIMIT - totalDone);

    let query = supabase
      .from('tenders')
      .select('id, bid_number, title, details_url, state, city, ministry_name, department_name, min_turnover_lakhs, ai_summary')
      .gte('end_date', new Date().toISOString())
      .not('details_url', 'is', null)
      .order('created_at', { ascending: false });

    if (!ALL) {
      query = query.is('leaf_tried_at', null);
    }
    if (SINCE_DATE) {
      query = query.gte('created_at', SINCE_DATE);
    }

    const { data: tenders, error } = await query.range(0, fetchSize - 1);

    if (error) {
      console.error(`\n  DB error: ${error.message}`);
      break;
    }
    if (!tenders?.length) {
      console.log('\n>>> No more tenders to process.');
      break;
    }

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n[done=${totalDone}] ${tenders.length} fetched | elapsed=${elapsed}m`);

    const subBatches: TenderRow[][] = [];
    for (let i = 0; i < tenders.length; i += BATCH_SIZE) {
      subBatches.push(tenders.slice(i, i + BATCH_SIZE) as TenderRow[]);
    }

    for (let ci = 0; ci < subBatches.length; ci += CONCURRENCY) {
      const chunk = subBatches.slice(ci, ci + CONCURRENCY);

      await Promise.all(chunk.map(async (batch) => {
        for (const tender of batch) {
          await processTender(tender, stats);
          sessionCounter++;

          if (sessionCounter % SESSION_REFRESH_INTERVAL === 0) {
            await refreshSession();
          }

          await sleep(500 + Math.random() * 400);
        }
      }));

      process.stdout.write(`\r  ok=${stats.ok} fail=${stats.fail} groq=${stats.groqUsed} empty=${stats.empty}   `);

      if (ci + CONCURRENCY < subBatches.length) {
        await sleep(800 + Math.random() * 400);
      }
    }

    totalDone += tenders.length;
    offset    += tenders.length;
    saveCheckpoint(offset, totalDone);

    const rate = (stats.ok / Math.max((Date.now() - startTime) / 60000, 0.01)).toFixed(0);
    console.log(`\n  ok=${stats.ok} fail=${stats.fail} groq=${stats.groqUsed} empty=${stats.empty} | rate=${rate}/min`);
  }

  const totalMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n>>> [LEAF-ENRICH] Done in ${totalMin}m`);
  console.log(`    ok=${stats.ok} | fail=${stats.fail} | groq_used=${stats.groqUsed} | skipped=${stats.empty} | total=${totalDone}`);
}

main().catch(console.error);
