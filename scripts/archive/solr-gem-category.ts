/**
 * SOLR → gem_category Backfill — Zero AI Cost
 *
 * Queries GeM SOLR for every tender where gem_category IS NULL.
 * Extracts b_category_name / bd_category_name and writes it to the
 * gem_category column.  Also backfills bid_type, ministry_name,
 * department_name, quantity — all free from SOLR.
 *
 * No Groq / Gemini / LLM calls whatsoever.
 * CONCURRENCY parallel SOLR sessions keep throughput high.
 *
 * Usage:
 *   npm run gem-category                        # all tenders with gem_category IS NULL
 *   npm run gem-category -- --limit=10000       # first N
 *   npm run gem-category -- --concurrency=6     # more parallel SOLR workers
 *   npm run gem-category -- --all               # re-process even rows that already have a value
 */

import dotenv from 'dotenv';
import { normalizeMinistry } from '../lib/locations-client.js';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import https from 'https';

// ─── Config ───────────────────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const LIMIT       = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1]       || '200000', 10);
const CONCURRENCY = parseInt(argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '4',      10);
const FETCH_SIZE  = CONCURRENCY * 30; // rows per DB round-trip
const ALL         = argv.includes('--all');
const SOLR_DELAY  = 150; // ms between SOLR requests per worker
// ─────────────────────────────────────────────────────────────────────────────

const HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TenderRow = {
  id: string;
  bid_number: string;
  quantity: number | null;
  ministry_name: string | null;
  department_name: string | null;
};

type SolrDoc = {
  b_bid_number?: string[];
  b_category_name?: string[];
  bd_category_name?: string[];
  ba_official_details_minName?: string[];
  ba_official_details_deptName?: string[];
  b_total_quantity?: number[];
  b_bid_type?: number[];
};

// ─── Per-Worker SOLR Session ──────────────────────────────────────────────────
class SolrSession {
  private cookies = '';
  private csrf    = '';

  async refresh(): Promise<boolean> {
    try {
      const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
        httpsAgent: HTTPS_AGENT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 20000,
      });
      this.cookies = res.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
      this.csrf    = (res.data as string).match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/)?.[1] || '';
      return !!(this.cookies && this.csrf);
    } catch {
      return false;
    }
  }

  async query(bidNumber: string): Promise<SolrDoc | null> {
    if (!this.csrf) {
      if (!await this.refresh()) return null;
    }

    const form = new URLSearchParams();
    form.append('payload', JSON.stringify({
      page: 1,
      param: { searchParam: 'searchbid', search: bidNumber },
      filter: {},
    }));
    form.append('csrf_bd_gem_nk', this.csrf);

    try {
      const r = await axios.post('https://bidplus.gem.gov.in/all-bids-data', form.toString(), {
        httpsAgent: HTTPS_AGENT,
        headers: {
          'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type':     'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer':          'https://bidplus.gem.gov.in/all-bids',
          'Cookie':           this.cookies,
        },
        timeout: 15000,
      });

      const docs: SolrDoc[] = r.data?.response?.response?.docs || [];
      return docs.find(d => d.b_bid_number?.[0] === bidNumber) || null;
    } catch (e: any) {
      if (e.response?.status === 403 || e.response?.status === 419) {
        this.csrf = ''; // will refresh on next call
      }
      return null;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function solrBidType(doc: SolrDoc, bidNo: string): string {
  if (/\/RA\//i.test(bidNo))       return 'Reverse Auction';
  if (doc.b_bid_type?.[0] === 2)   return 'Reverse Auction';
  return 'Open Bid';
}

// ─── Worker ───────────────────────────────────────────────────────────────────
async function processSlice(
  tenders: TenderRow[],
  session: SolrSession,
  stats: { ok: number; fail: number; solrHit: number }
): Promise<void> {
  for (const tender of tenders) {
    const doc         = await session.query(tender.bid_number);
    const gemCategory = doc?.b_category_name?.[0] || doc?.bd_category_name?.[0] || '';

    if (doc) stats.solrHit++;

    const payload: Record<string, any> = {
      // Empty string = "tried but no category found"; NULL = "never tried"
      gem_category: gemCategory,
    };

    if (doc) {
      payload.bid_type = solrBidType(doc, tender.bid_number);

      if (!tender.ministry_name   && doc.ba_official_details_minName?.[0])
        payload.ministry_name   = normalizeMinistry(doc.ba_official_details_minName[0]);
      if (!tender.department_name && doc.ba_official_details_deptName?.[0])
        payload.department_name = doc.ba_official_details_deptName[0];
      if (!tender.quantity        && doc.b_total_quantity?.[0])
        payload.quantity        = doc.b_total_quantity[0];
    }

    const { error } = await supabase.from('tenders').update(payload).eq('id', tender.id);
    if (error) {
      console.error(`\n  DB error [${tender.bid_number}]: ${error.message}`);
      stats.fail++;
    } else {
      stats.ok++;
    }

    await sleep(SOLR_DELAY);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n>>> [GEM-CATEGORY] SOLR backfill — zero AI cost`);
  console.log(`    Limit=${LIMIT} | Concurrency=${CONCURRENCY} | SOLR delay=${SOLR_DELAY}ms/worker`);
  console.log(`    Mode: ${ALL ? 'ALL tenders (re-process existing)' : 'gem_category IS NULL only'}\n`);

  // Warm up CONCURRENCY SOLR sessions in parallel
  process.stdout.write(`Connecting ${CONCURRENCY} SOLR sessions... `);
  const sessions = Array.from({ length: CONCURRENCY }, () => new SolrSession());
  const ok       = await Promise.all(sessions.map(s => s.refresh()));
  const active   = sessions.filter((_, i) => ok[i]);
  if (!active.length) {
    console.error('\nERROR: No SOLR session could be established. Check connectivity.');
    process.exit(1);
  }
  console.log(`${active.length}/${CONCURRENCY} connected\n`);

  const stats     = { ok: 0, fail: 0, solrHit: 0, total: 0 };
  const startTime = Date.now();
  let   offset    = 0; // only advanced when --all (IS NULL mode self-terminates)
  let   round     = 0;

  while (stats.total < LIMIT) {
    const fetchSize = Math.min(FETCH_SIZE, LIMIT - stats.total);

    let query = supabase
      .from('tenders')
      .select('id, bid_number, quantity, ministry_name, department_name')
      .order('created_at', { ascending: false })
      .limit(fetchSize);

    if (!ALL) {
      query = query.is('gem_category', null);
    } else {
      query = query.range(offset, offset + fetchSize - 1);
    }

    const { data: tenders, error } = await query;
    if (error) { console.error('DB fetch error:', error.message); break; }
    if (!tenders?.length) { console.log('>>> No more tenders to process.'); break; }

    round++;
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    const rate    = stats.ok > 0
      ? Math.round(stats.ok / ((Date.now() - startTime) / 60000)).toFixed(0)
      : '–';
    const eta     = stats.ok > 0 && LIMIT < 200000
      ? `ETA ~${((LIMIT - stats.total) / (stats.ok / ((Date.now() - startTime) / 60000))).toFixed(0)}m`
      : '';
    console.log(`[round ${round}] fetched=${tenders.length} | processed=${stats.total} | elapsed=${elapsed}m | rate=${rate}/min | solr=${stats.solrHit} ${eta}`);

    // Distribute across workers
    const slices: TenderRow[][] = Array.from({ length: active.length }, () => []);
    (tenders as TenderRow[]).forEach((t, i) => slices[i % active.length].push(t));

    await Promise.all(slices.map((slice, i) => processSlice(slice, active[i], stats)));

    stats.total += tenders.length;
    if (ALL) offset += tenders.length;

    const hitRate = ((stats.solrHit / stats.total) * 100).toFixed(1);
    console.log(`  ok=${stats.ok} fail=${stats.fail} solr_hits=${stats.solrHit} (${hitRate}%)\n`);
  }

  const totalMin = ((Date.now() - startTime) / 60000).toFixed(1);
  const hitRate  = stats.total > 0 ? ((stats.solrHit / stats.total) * 100).toFixed(1) : '0';
  console.log(`\n>>> [GEM-CATEGORY] Done in ${totalMin}m`);
  console.log(`    ok=${stats.ok} | fail=${stats.fail} | SOLR hits=${stats.solrHit} | total=${stats.total}`);
  console.log(`    SOLR hit rate: ${hitRate}%`);
}

main().catch(console.error);
