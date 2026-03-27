/**
 * Bulk Enricher — axios + Gemini inline PDF  (or raw_text from DB)
 *
 * Without --from-raw-text:
 *   Fetches PDF bytes directly from GeM using axios, sends to Gemini.
 *
 * With --from-raw-text:
 *   Reads the `raw_text` column (pre-scraped by scrape-leaf-pages.ts) and
 *   feeds it directly to Groq AI — no PDF download, no browser required.
 *   This is faster, cheaper, and works even when GeM blocks PDF access.
 *
 * Usage:
 *   npm run bulk-enrich                              # 500 tenders, Gemini PDF
 *   npm run bulk-enrich -- --from-raw-text           # use raw_text from DB
 *   npm run bulk-enrich -- --limit=1000              # process up to 1000
 *   npm run bulk-enrich -- --workers=5               # 5 concurrent fetches
 *   npm run bulk-enrich -- --reset                   # clear checkpoint and restart
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import https from 'https';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { extractTenderDataFromPdfBytes } from '../lib/gemini';
import { normalizeState, normalizeCity, extractCityStateFromConsigneeTable, cityToState } from '../lib/locations';
import { detectCategory } from '../lib/categories';

// SSL bypass — Indian government portals often have cert issues
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const args          = process.argv.slice(2);
const LIMIT         = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]   || '500',  10);
const WORKERS       = parseInt(args.find(a => a.startsWith('--workers='))?.split('=')[1] || '3',    10);
const BATCH_SIZE    = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1]   || '100',  10);
const RESET         = args.includes('--reset');
const FROM_RAW_TEXT = args.includes('--from-raw-text'); // skip PDF; use raw_text from DB
const CHECKPOINT    = path.join(process.cwd(), 'bulk-enrich-progress.json');
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── GeM Session ─────────────────────────────────────────────────────────────
async function getGeMSession(): Promise<{ cookies: string }> {
  const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
    httpsAgent,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
    timeout: 30000,
  });
  const rawCookies: string[] = [];
  const setCookie = res.headers['set-cookie'];
  if (Array.isArray(setCookie)) setCookie.forEach(c => rawCookies.push(c.split(';')[0]));
  return { cookies: rawCookies.join('; ') };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseGeMDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const dateMatch = dateStr.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (!dateMatch) return null;
    const [, day, month, year] = dateMatch;
    const timeMatch = dateStr.match(/(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?/i);
    let h = '00', m = '00', s = '00';
    if (timeMatch) {
      h = timeMatch[1].padStart(2, '0');
      m = timeMatch[2];
      if (timeMatch[3]) s = timeMatch[3];
      if (timeMatch[4]?.toUpperCase() === 'PM' && parseInt(h) < 12) h = String(parseInt(h) + 12).padStart(2, '0');
      if (timeMatch[4]?.toUpperCase() === 'AM' && h === '12') h = '00';
    }
    return `${year}-${month}-${day}T${h}:${m}:${s}.000Z`;
  } catch { return null; }
}

function detectBidType(bidNo: string, title: string): string {
  if (/\/RA\//i.test(bidNo) || /reverse\s*auction/i.test(title)) return 'Reverse Auction';
  if (/custom\s*bid/i.test(title)) return 'Custom Bid';
  return 'Open Bid';
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

// ─── Worker: fetch PDF + Gemini enrich ───────────────────────────────────────
async function processOne(
  tender: { id: string; bid_number: string; details_url: string; title: string | null },
  session: { cookies: string },
  workerId: number,
): Promise<'ok' | 'no-pdf' | 'no-ai' | 'error'> {
  try {
    // ── Fetch PDF bytes via plain HTTP (no browser) ───────────────────────
    const resp = await axios.get(tender.details_url, {
      httpsAgent,
      responseType: 'arraybuffer',
      headers: {
        Cookie: session.cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Referer: 'https://bidplus.gem.gov.in/all-bids',
      },
      timeout: 15000,
    });

    const ct = (resp.headers['content-type'] || '').toLowerCase();
    const buffer = Buffer.from(resp.data as ArrayBuffer);

    if (!ct.includes('pdf') || buffer.length < 1000) {
      await supabase.from('tenders').update({ enrichment_tried_at: new Date().toISOString() }).eq('id', tender.id);
      console.log(`\n  [W${workerId}] no-pdf (${ct}) ${tender.bid_number}`);
      return 'no-pdf';
    }

    console.log(`\n  [W${workerId}] PDF ${buffer.length}b — sending to Gemini...`);

    // ── Gemini reads the PDF inline ───────────────────────────────────────
    const aiData = await extractTenderDataFromPdfBytes(buffer);
    if (!aiData) {
      await supabase.from('tenders').update({ enrichment_tried_at: new Date().toISOString() }).eq('id', tender.id);
      return 'no-ai';
    }

    // ── Upload to Supabase Storage ────────────────────────────────────────
    const fileName = `${tender.bid_number.replace(/\//g, '-')}.pdf`;
    let pdfPublicUrl: string | null = null;

    const { data: uploadData } = await supabase.storage
      .from('tender-documents')
      .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

    if (uploadData) {
      const { data: urlData } = supabase.storage.from('tender-documents').getPublicUrl(uploadData.path);
      pdfPublicUrl = urlData.publicUrl;
    }

    // ── Build update payload ──────────────────────────────────────────────
    const auth = aiData.authority;
    const updatePayload: any = {
      pdf_url:           pdfPublicUrl || tender.details_url,
      ai_summary:        aiData.technical_summary,
      title:             aiData.tender_title || tender.title,
      ministry_name:     auth?.ministry     || null,
      department_name:   auth?.department   || null,
      organisation_name: auth?.organisation || null,
      office_name:       auth?.office       || null,
      state:             normalizeState(auth?.consignee_state || auth?.state),
      city:              normalizeCity(auth?.consignee_city  || auth?.city),
    };

    // Regex fallback when AI misses city/state
    if (!updatePayload.city || !updatePayload.state) {
      const loc = extractCityStateFromConsigneeTable(aiData.technical_summary || '');
      if (!updatePayload.city  && loc.city)  updatePayload.city  = loc.city;
      if (!updatePayload.state && loc.state) updatePayload.state = loc.state;
      if (updatePayload.city && !updatePayload.state) {
        const inferred = cityToState(updatePayload.city);
        if (inferred) updatePayload.state = inferred;
      }
    }

    Object.assign(updatePayload, {
      emd_amount:        aiData.emd_amount || null,
      quantity:          aiData.quantity   || null,
      eligibility_msme:  aiData.eligibility?.msme || false,
      eligibility_mii:   aiData.eligibility?.mii  || false,
      mse_relaxation:             aiData.relaxations?.mse_experience     || null,
      mse_turnover_relaxation:    aiData.relaxations?.mse_turnover       || null,
      startup_relaxation:         aiData.relaxations?.startup_experience || null,
      startup_turnover_relaxation: aiData.relaxations?.startup_turnover  || null,
      documents_required: aiData.documents_required || [],
      category:     aiData.category || detectCategory((aiData.tender_title || '') + ' ' + (aiData.technical_summary || '')) || null,
      bid_type:     detectBidType(tender.bid_number, aiData.tender_title || ''),
      procurement_type: aiData.procurement_type || null,
      keywords:     aiData.keywords || [],
      enrichment_tried_at: new Date().toISOString(),
    });

    if (aiData.dates) {
      const od = parseGeMDate(aiData.dates.bid_opening_date); if (od) updatePayload.opening_date = od;
      const sd = parseGeMDate(aiData.dates.bid_start_date);   if (sd) updatePayload.start_date   = sd;
      const ed = parseGeMDate(aiData.dates.bid_end_date);
      if (ed && new Date(ed) > new Date()) updatePayload.end_date = ed;
    }

    // Archive if discovered expired
    if (updatePayload.end_date && new Date(updatePayload.end_date).getTime() < Date.now()) {
      await supabase.from('tenders').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', tender.id);
      return 'ok';
    }

    await supabase.from('tenders').update(updatePayload).eq('id', tender.id);
    return 'ok';

  } catch (e: any) {
    console.error(`\n  [W${workerId}] ERROR ${tender.bid_number}: ${e.message}`);
    await supabase.from('tenders').update({ enrichment_tried_at: new Date().toISOString() }).eq('id', tender.id);
    return 'error';
  }
}

// ─── Raw-text enrichment (no PDF) ────────────────────────────────────────────
async function processOneFromRawText(
  tender: { id: string; bid_number: string; title: string | null; raw_text: string },
  workerId: number,
): Promise<'ok' | 'no-ai' | 'error'> {
  try {
    const { extractTenderDataGroq } = await import('../lib/groq-ai.js') as any;
    console.log(`\n  [W${workerId}] Groq enriching from raw_text: ${tender.bid_number}`);
    const aiData = await extractTenderDataGroq(tender.raw_text);
    if (!aiData) {
      await supabase.from('tenders').update({ enrichment_tried_at: new Date().toISOString() }).eq('id', tender.id);
      return 'no-ai';
    }

    const auth = aiData.authority;
    const updatePayload: any = {
      ai_summary:        aiData.technical_summary,
      title:             aiData.tender_title || tender.title,
      ministry_name:     auth?.ministry     || null,
      department_name:   auth?.department   || null,
      organisation_name: auth?.organisation || null,
      office_name:       auth?.office       || null,
      state:             normalizeState(auth?.consignee_state || auth?.state),
      city:              normalizeCity(auth?.consignee_city  || auth?.city),
      emd_amount:        aiData.emd_amount || null,
      quantity:          aiData.quantity   || null,
      eligibility_msme:  aiData.eligibility?.msme || false,
      eligibility_mii:   aiData.eligibility?.mii  || false,
      mse_relaxation:              aiData.relaxations?.mse_experience  || null,
      mse_turnover_relaxation:     aiData.relaxations?.mse_turnover    || null,
      startup_relaxation:          aiData.relaxations?.startup_experience || null,
      startup_turnover_relaxation: aiData.relaxations?.startup_turnover  || null,
      documents_required: aiData.documents_required || [],
      category:     aiData.category || detectCategory((aiData.tender_title || '') + ' ' + (aiData.technical_summary || '')) || null,
      bid_type:     detectBidType(tender.bid_number, aiData.tender_title || ''),
      procurement_type: aiData.procurement_type || null,
      keywords:     aiData.keywords || [],
      enrichment_tried_at: new Date().toISOString(),
    };

    // City fallback
    if (!updatePayload.city || !updatePayload.state) {
      const loc = extractCityStateFromConsigneeTable(tender.raw_text);
      if (!updatePayload.city  && loc.city)  updatePayload.city  = loc.city;
      if (!updatePayload.state && loc.state) updatePayload.state = loc.state;
      if (updatePayload.city && !updatePayload.state) {
        const inferred = cityToState(updatePayload.city);
        if (inferred) updatePayload.state = inferred;
      }
    }

    if (aiData.dates) {
      const od = parseGeMDate(aiData.dates.bid_opening_date); if (od) updatePayload.opening_date = od;
      const sd = parseGeMDate(aiData.dates.bid_start_date);   if (sd) updatePayload.start_date   = sd;
      const ed = parseGeMDate(aiData.dates.bid_end_date);
      if (ed && new Date(ed) > new Date()) updatePayload.end_date = ed;
    }

    await supabase.from('tenders').update(updatePayload).eq('id', tender.id);
    return 'ok';
  } catch (e: any) {
    console.error(`\n  [W${workerId}] ERROR ${tender.bid_number}: ${e.message}`);
    await supabase.from('tenders').update({ enrichment_tried_at: new Date().toISOString() }).eq('id', tender.id);
    return 'error';
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (FROM_RAW_TEXT) {
    console.log(`\n>>> [BULK-ENRICH] Mode: --from-raw-text (no PDF download, Groq AI on raw_text)`);
    console.log(`    Limit: ${LIMIT} | Workers: ${WORKERS}\n`);

    let { offset, totalDone } = loadCheckpoint();
    if (offset > 0) console.log(`>>> Resuming from offset ${offset}\n`);

    let totalOk = 0, totalFail = 0;
    const startTime = Date.now();

    while (totalDone < LIMIT) {
      const fetchSize = Math.min(BATCH_SIZE, LIMIT - totalDone);
      const { data: tenders, error } = await supabase
        .from('tenders')
        .select('id, bid_number, title, raw_text')
        .is('ai_summary', null)
        .not('raw_text', 'is', null)
        .gte('end_date', new Date().toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + fetchSize - 1);

      if (error) { console.error('DB error:', error.message); break; }
      if (!tenders?.length) { console.log('\n>>> No more tenders with raw_text to enrich.'); break; }

      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`[Batch offset=${offset}] ${tenders.length} tenders | Done: ${totalDone} | Elapsed: ${elapsed}m`);

      const queue = [...tenders] as any[];
      let ok = 0, fail = 0;

      await Promise.all(
        Array.from({ length: WORKERS }, async (_, wid) => {
          while (true) {
            const t = queue.shift();
            if (!t) break;
            const result = await processOneFromRawText(t, wid + 1);
            if (result === 'ok') ok++; else fail++;
            process.stdout.write(`\r  ok=${ok} fail=${fail} | total: ${totalOk + ok}`);
          }
        })
      );

      totalOk += ok; totalFail += fail;
      totalDone += tenders.length;
      offset    += tenders.length;
      saveCheckpoint(offset, totalDone);
      console.log(`\n  Batch done. Enriched: ${totalOk} | Failed: ${totalFail}\n`);
    }

    const totalMin = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`\n>>> [BULK-ENRICH] Done in ${totalMin}m`);
    console.log(`    Enriched: ${totalOk} | Failed: ${totalFail}`);
    return;
  }

  console.log(`\n>>> [BULK-ENRICH] Starting with ${WORKERS} concurrent workers (axios + Gemini PDF).`);
  console.log(`    Limit: ${LIMIT} | Batch: ${BATCH_SIZE}\n`);

  console.log('>>> Initialising GeM session...');
  const session = await getGeMSession();
  console.log('>>> GeM session ready.\n');

  let { offset, totalDone } = loadCheckpoint();
  if (offset > 0) console.log(`>>> Resuming from offset ${offset} (${totalDone} previously done)\n`);

  let totalOk = 0, totalNoPdf = 0, totalFail = 0;
  const startTime = Date.now();

  while (totalDone < LIMIT) {
    const fetchSize = Math.min(BATCH_SIZE, LIMIT - totalDone);

    const { data: tenders, error } = await supabase
      .from('tenders')
      .select('id, bid_number, details_url, title')
      .is('ai_summary', null)
      .is('enrichment_tried_at', null)
      .gte('end_date', new Date().toISOString())
      .not('details_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + fetchSize - 1);

    if (error) { console.error('DB error:', error.message); break; }
    if (!tenders?.length) { console.log('\n>>> No more tenders to process.'); break; }

    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`[Batch offset=${offset}] ${tenders.length} tenders | Done: ${totalDone} | Elapsed: ${elapsed}m`);

    // Distribute tenders across workers (simple concurrent queue)
    const queue = [...tenders];
    let ok = 0, noPdf = 0, fail = 0;

    await Promise.all(
      Array.from({ length: WORKERS }, async (_, workerId) => {
        while (true) {
          const tender = queue.shift();
          if (!tender) break;
          const result = await processOne(tender, session, workerId + 1);
          if (result === 'ok') ok++;
          else if (result === 'no-pdf') noPdf++;
          else fail++;
          process.stdout.write(`\r  ok=${ok} no-pdf=${noPdf} fail=${fail} | total enriched: ${totalOk + ok}`);
        }
      })
    );

    totalOk += ok; totalNoPdf += noPdf; totalFail += fail;
    totalDone += tenders.length;
    offset    += tenders.length;
    saveCheckpoint(offset, totalDone);

    const rate = totalOk > 0 ? (totalOk / ((Date.now() - startTime) / 60000)).toFixed(1) : '0';
    console.log(`\n  Batch done. Enriched: ${totalOk} | No-PDF: ${totalNoPdf} | Errors: ${totalFail} | Rate: ${rate}/min\n`);
  }

  const totalMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n>>> [BULK-ENRICH] Done in ${totalMin}m`);
  console.log(`    Enriched: ${totalOk} | No PDF: ${totalNoPdf} | Failed: ${totalFail} | Total processed: ${totalDone}`);
}

main().catch(console.error);
