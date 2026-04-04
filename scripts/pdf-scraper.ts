/**
 * PDF Scraper — Downloads and stores GeM tender PDFs
 *
 * Anti-ban measures:
 *   - Concurrency defaults to 1 (sequential, safe)
 *   - Random delay between every request (--delay=2 means 2–4s jitter)
 *   - Session refresh every 50 requests
 *   - Checkpoint file to resume without re-scraping
 *   - Proxy support via HTTPS_PROXY env var or --proxy= flag
 *
 * Usage:
 *   npm run pdf-scrape                            # sequential, 2s delay
 *   npm run pdf-scrape -- --limit=200             # first N tenders
 *   npm run pdf-scrape -- --delay=5               # 5–10s random delay (stealthier)
 *   npm run pdf-scrape -- --concurrency=2         # 2 parallel (use with caution)
 *   npm run pdf-scrape -- --no-ai                 # skip Groq (PDF download only)
 *   npm run pdf-scrape -- --reset                 # clear checkpoint and restart
 *   HTTPS_PROXY=http://user:pass@host:port npm run pdf-scrape
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { extractTenderDataGroq } from '../lib/groq-ai.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// ─── Config ───────────────────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const LIMIT       = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1]       || '50000', 10);
const CONCURRENCY = parseInt(argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '1',     10);
const DELAY_SEC   = parseFloat(argv.find(a => a.startsWith('--delay='))?.split('=')[1]     || '2');
const PROXY_URL   = argv.find(a => a.startsWith('--proxy='))?.split('=').slice(1).join('=')
                    || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
const NO_AI       = argv.includes('--no-ai');
const ALL         = argv.includes('--all');
const RESET       = argv.includes('--reset');
const BUCKET      = 'tender-documents';
const CHECKPOINT  = path.join(process.cwd(), 'pdf-scrape-progress.json');

// ─── HTTP Agent (proxy-aware) ─────────────────────────────────────────────────
let httpsAgent: any;
if (PROXY_URL) {
  httpsAgent = new HttpsProxyAgent(PROXY_URL);
  console.log(`>>> [PROXY] Using proxy: ${PROXY_URL.replace(/:([^@]+)@/, ':***@')}`);
} else {
  httpsAgent = new https.Agent({ rejectUnauthorized: false });
}

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Checkpoint ───────────────────────────────────────────────────────────────
function saveCheckpoint(lastBidNumber: string, done: number) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ lastBidNumber, done, updatedAt: new Date().toISOString() }));
}

function loadCheckpoint(): { lastBidNumber: string; done: number } | null {
  try {
    if (fs.existsSync(CHECKPOINT)) return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8'));
  } catch {}
  return null;
}

// ─── Session ──────────────────────────────────────────────────────────────────
let gemCookies = '';
let requestCount = 0;

async function refreshSession(): Promise<void> {
  const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
    httpsAgent,
    headers: BASE_HEADERS,
    timeout: 30000,
  });
  gemCookies = res.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
  if (!gemCookies) throw new Error('Failed to obtain GeM session cookies');
}

async function maybeRefreshSession(): Promise<void> {
  if (requestCount % 50 === 0) {
    try { await refreshSession(); } catch { /* keep old cookies */ }
  }
  requestCount++;
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
function jitteredDelay(): Promise<void> {
  // Random delay between DELAY_SEC and 2×DELAY_SEC milliseconds
  const ms = Math.floor(DELAY_SEC * 1000 + Math.random() * DELAY_SEC * 1000);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n>>> [PDF-SCRAPER] Starting PDF download run.`);
  console.log(`  Limit: ${LIMIT} | Concurrency: ${CONCURRENCY} | Delay: ${DELAY_SEC}–${DELAY_SEC * 2}s | AI: ${!NO_AI}`);
  if (!PROXY_URL) console.log(`  Proxy: none (set HTTPS_PROXY or --proxy= to route through a proxy)`);
  console.log();

  // Handle checkpoint
  if (RESET && fs.existsSync(CHECKPOINT)) {
    fs.unlinkSync(CHECKPOINT);
    console.log('>>> Checkpoint cleared.\n');
  }
  const checkpoint = loadCheckpoint();
  let skipUntil = checkpoint?.lastBidNumber ?? null;
  let doneCount = checkpoint?.done ?? 0;
  if (skipUntil) console.log(`>>> Resuming after: ${skipUntil} (${doneCount} already done)\n`);

  // Fetch pending tenders
  let query = supabase
    .from('tenders')
    .select('id, bid_number, title, details_url, ai_summary')
    .gte('end_date', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (!ALL) query = query.is('pdf_url', null);

  const { data: tenders, error } = await query;
  if (error || !tenders?.length) {
    console.log('No tenders found to process.', error?.message);
    return;
  }

  // Skip already-processed tenders from checkpoint
  let startIdx = 0;
  if (skipUntil) {
    const idx = tenders.findIndex(t => t.bid_number === skipUntil);
    startIdx = idx === -1 ? 0 : idx + 1;
  }
  const pending = tenders.slice(startIdx);
  console.log(`>>> Found ${tenders.length} tenders total, processing ${pending.length} (skipping ${startIdx} done).\n`);

  await refreshSession();

  let downloaded = 0;
  let failed     = 0;

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);

    // Sequential within batch when concurrency=1 (default), parallel otherwise
    const tasks = batch.map((tender) => async () => {
      await maybeRefreshSession();

      const bId = tender.details_url?.split('/').pop();
      if (!bId) { failed++; return; }

      const headers = {
        ...BASE_HEADERS,
        Referer: 'https://bidplus.gem.gov.in/all-bids',
        Cookie: gemCookies,
      };

      try {
        // ── Download PDF ─────────────────────────────────────────────────────
        const pdfRes = await axios.get(
          `https://bidplus.gem.gov.in/showbidDocument/${bId}`,
          { httpsAgent, headers, responseType: 'arraybuffer', timeout: 30000 }
        );

        const buffer = Buffer.from(pdfRes.data);
        if (buffer.length < 1000) {
          console.log(`  ~ ${tender.bid_number}: too small (${buffer.length}B), skipping`);
          failed++;
          return;
        }

        // ── Upload to Supabase ───────────────────────────────────────────────
        const fileName = `${tender.bid_number.replace(/\//g, '-')}.pdf`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

        if (uploadErr || !uploadData) {
          console.error(`  ✗ ${tender.bid_number}: Upload failed — ${uploadErr?.message}`);
          failed++;
          return;
        }

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
        const updatePayload: Record<string, any> = { pdf_url: urlData.publicUrl };

        // ── AI enrichment from PDF text ──────────────────────────────────────
        if (!NO_AI && !tender.ai_summary) {
          try {
            const parsed = await pdfParse(buffer, { max: 0 });
            const pdfText: string = parsed.text || '';
            if (pdfText.length > 50) {
              const aiData = await extractTenderDataGroq(pdfText);
              if (aiData) {
                if (aiData.technical_summary) updatePayload.ai_summary = aiData.technical_summary;
                if (aiData.keywords?.length)  updatePayload.keywords = aiData.keywords;
                if (aiData.emd_amount != null) updatePayload.emd_amount = aiData.emd_amount;
                if (aiData.eligibility) {
                  updatePayload.eligibility_msme = aiData.eligibility.msme || false;
                  updatePayload.eligibility_mii  = aiData.eligibility.mii  || false;
                }
                if (aiData.documents_required?.length) updatePayload.documents_required = aiData.documents_required;
                if (aiData.relaxations) {
                  if (aiData.relaxations.mse_experience)  updatePayload.mse_relaxation = aiData.relaxations.mse_experience;
                  if (aiData.relaxations.mse_turnover)    updatePayload.mse_turnover_relaxation = aiData.relaxations.mse_turnover;
                  if (aiData.relaxations.startup_experience) updatePayload.startup_relaxation = aiData.relaxations.startup_experience;
                  if (aiData.relaxations.startup_turnover)   updatePayload.startup_turnover_relaxation = aiData.relaxations.startup_turnover;
                }
              }
            }
          } catch (e: any) {
            console.warn(`  [AI] ${tender.bid_number}: ${e.message}`);
          }
        }

        await supabase.from('tenders').update(updatePayload).eq('id', tender.id);
        downloaded++;
        doneCount++;
        saveCheckpoint(tender.bid_number, doneCount);

        const aiTag = updatePayload.ai_summary ? ' +AI' : '';
        console.log(`  ✓ [${doneCount}] ${tender.bid_number} | ${(buffer.length / 1024).toFixed(0)}KB${aiTag}`);

      } catch (e: any) {
        console.warn(`  ✗ ${tender.bid_number}: ${e.message}`);
        failed++;
      }

      // Rate-limiting delay after every request
      await jitteredDelay();
    });

    if (CONCURRENCY === 1) {
      for (const task of tasks) await task();
    } else {
      await Promise.all(tasks.map(t => t()));
    }
  }

  console.log(`\n>>> [PDF-SCRAPER] Done. Downloaded: ${downloaded} | Failed: ${failed}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
