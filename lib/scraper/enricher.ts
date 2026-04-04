import { createClient } from '@supabase/supabase-js';
import https from 'https';
import axios from 'axios';
import { createRequire } from 'module';
import { extractTenderDataGroq } from '../groq-ai';
import { normalizeState, normalizeCity, cityToState } from '../locations';
import { detectCategory } from '../categories';
import { parseGeMDate } from './gem-scraper';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' };

// ─── Session management ───────────────────────────────────────────────────────

async function getSession(): Promise<string> {
  const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
    httpsAgent,
    headers: HEADERS,
    timeout: 30000,
  });
  const setCookie = res.headers['set-cookie'];
  if (!Array.isArray(setCookie) || setCookie.length === 0) throw new Error('No cookies from GeM session');
  return setCookie.map((c: string) => c.split(';')[0]).join('; ');
}

// ─── HTML field extraction ────────────────────────────────────────────────────

function parseHtmlFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  // Extract <strong>Label:</strong> <span>Value</span> pairs
  for (const [, label, value] of html.matchAll(/<strong>([^<]+):<\/strong>\s*<span>([\s\S]*?)<\/span>/g)) {
    const key = label.trim().toLowerCase().replace(/\s+/g, '_');
    const val = value.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (val) fields[key] = val;
  }
  return fields;
}

function parseCityStateFromAddress(html: string): { city: string | null; state: string | null } {
  const match = html.match(/Address:\s*([\s\S]*?)(?:Ministry:|<\/p>|$)/i);
  if (!match) return { city: null, state: null };

  const addressText = match[1].replace(/<[^>]+>/g, '').trim();
  const parts = addressText.split(',').map(p => p.trim()).filter(Boolean);

  // Format (from end): India, Pincode(6-digits), State, District, City, ...
  if (parts.length < 5) return { city: null, state: null };

  const fromEnd = [...parts].reverse();
  const pinIdx = fromEnd.findIndex(p => /^\d{6}$/.test(p));

  if (pinIdx === -1) {
    // No pincode found — try last 3 from end (skip "India")
    const state = normalizeState(fromEnd[1] || null);
    const city = normalizeCity(fromEnd[2] || null);
    return { state, city };
  }

  const state = normalizeState(fromEnd[pinIdx + 1] || null);
  const city = normalizeCity(fromEnd[pinIdx + 3] || null);
  return { state, city };
}

function detectBidType(bidNo: string, title: string): string {
  if (/\/RA\//i.test(bidNo) || /reverse\s*auction/i.test(title)) return 'Reverse Auction';
  if (/custom\s*bid/i.test(title)) return 'Custom Bid';
  return 'Open Bid';
}

// ─── Main enrichment run ──────────────────────────────────────────────────────

export async function runEnrichment(limit: number = 20, reprocess: boolean = false) {
  console.log(`\n>>> [ENRICHER] Starting enrichment run. Processing up to ${limit} tenders...\n`);

  let query = supabase
    .from('tenders')
    .select('id, bid_number, details_url')
    .is('pdf_url', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!reprocess) {
    query = query.gte('end_date', new Date().toISOString());
  }

  const { data: pending, error } = await query;

  if (error || !pending || pending.length === 0) {
    console.log('>>> [ENRICHER] No pending tenders found.');
    return { success: true, processed: 0 };
  }

  console.log(`>>> [ENRICHER] Found ${pending.length} tenders to enrich.`);

  let cookies = await getSession();
  let requestCount = 0;
  let successCount = 0;

  const CONCURRENCY = 3;

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (tender) => {
      // Refresh session every 50 requests
      if (requestCount > 0 && requestCount % 50 === 0) {
        try { cookies = await getSession(); } catch { /* keep old */ }
      }
      requestCount++;

      const bId = tender.details_url?.split('/').pop();
      if (!bId) return;

      const gemHeaders = {
        ...HEADERS,
        Referer: 'https://bidplus.gem.gov.in/all-bids',
        Cookie: cookies,
      };

      try {
        // ── Step 1: HTML enrichment ──────────────────────────────────────────
        let htmlFields: Record<string, string> = {};
        let cityState: { city: string | null; state: string | null } = { city: null, state: null };

        try {
          const htmlRes = await axios.get(
            `https://bidplus.gem.gov.in/bidding/bid/getBidResultView/${bId}`,
            { httpsAgent, headers: gemHeaders, timeout: 20000 }
          );

          if (typeof htmlRes.data === 'string' && htmlRes.data.includes('BID DETAILS')) {
            htmlFields = parseHtmlFields(htmlRes.data);
            cityState = parseCityStateFromAddress(htmlRes.data);
          }
        } catch (e: any) {
          console.warn(`  [HTML] ${tender.bid_number}: ${e.message}`);
        }

        // ── Step 2: PDF download ─────────────────────────────────────────────
        let pdfPublicUrl: string | null = null;
        let pdfText = '';

        try {
          const pdfRes = await axios.get(
            `https://bidplus.gem.gov.in/showbidDocument/${bId}`,
            { httpsAgent, headers: gemHeaders, responseType: 'arraybuffer', timeout: 30000 }
          );

          const buffer = Buffer.from(pdfRes.data);
          if (buffer.length > 1000) {
            const fileName = `${tender.bid_number.replace(/\//g, '-')}.pdf`;
            const { data: uploadData } = await supabase.storage
              .from('tender-documents')
              .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

            if (uploadData) {
              const { data: urlData } = supabase.storage.from('tender-documents').getPublicUrl(uploadData.path);
              pdfPublicUrl = urlData.publicUrl;
            }

            try {
              const parsed = await pdfParse(buffer, { max: 0 });
              pdfText = parsed.text || '';
            } catch { /* pdf parse failed, continue without text */ }
          }
        } catch (e: any) {
          console.warn(`  [PDF] ${tender.bid_number}: ${e.message}`);
        }

        // ── Step 3: AI enrichment from PDF text ──────────────────────────────
        let aiData: any = null;
        if (pdfText.length > 50) {
          try {
            aiData = await extractTenderDataGroq(pdfText);
          } catch { /* AI failed, continue */ }
        }

        // ── Step 4: Build update payload ─────────────────────────────────────
        const updatePayload: any = {};

        if (pdfPublicUrl) updatePayload.pdf_url = pdfPublicUrl;

        // HTML-derived fields (fast, no AI needed)
        if (htmlFields['ministry']) updatePayload.ministry_name = htmlFields['ministry'];
        if (htmlFields['department']) updatePayload.department_name = htmlFields['department'];

        if (cityState.city) updatePayload.city = cityState.city;
        if (cityState.state) updatePayload.state = cityState.state;

        // AI-derived fields (summary, keywords, category — things not in the HTML)
        if (aiData) {
          const auth = aiData.authority;
          if (!updatePayload.ministry_name && auth?.ministry) updatePayload.ministry_name = auth.ministry;
          if (!updatePayload.department_name && auth?.department) updatePayload.department_name = auth.department;
          if (auth?.organisation) updatePayload.organisation_name = auth.organisation;
          if (auth?.office) updatePayload.office_name = auth.office;

          if (!updatePayload.city && (auth?.consignee_city || auth?.city))
            updatePayload.city = normalizeCity(auth.consignee_city || auth.city);
          if (!updatePayload.state && (auth?.consignee_state || auth?.state))
            updatePayload.state = normalizeState(auth.consignee_state || auth.state);

          // Infer state from city if still missing
          if (updatePayload.city && !updatePayload.state)
            updatePayload.state = cityToState(updatePayload.city);

          if (aiData.tender_title) updatePayload.title = aiData.tender_title;
          if (aiData.emd_amount != null) updatePayload.emd_amount = aiData.emd_amount;
          if (aiData.quantity != null) updatePayload.quantity = aiData.quantity;
          if (aiData.technical_summary) updatePayload.ai_summary = aiData.technical_summary;
          if (aiData.eligibility) {
            updatePayload.eligibility_msme = aiData.eligibility.msme || false;
            updatePayload.eligibility_mii = aiData.eligibility.mii || false;
          }
          if (aiData.relaxations) {
            updatePayload.mse_relaxation = aiData.relaxations.mse_experience || null;
            updatePayload.mse_turnover_relaxation = aiData.relaxations.mse_turnover || null;
            updatePayload.startup_relaxation = aiData.relaxations.startup_experience || null;
            updatePayload.startup_turnover_relaxation = aiData.relaxations.startup_turnover || null;
          }
          if (aiData.documents_required?.length) updatePayload.documents_required = aiData.documents_required;

          updatePayload.category = aiData.category
            || detectCategory((aiData.tender_title || '') + ' ' + (aiData.technical_summary || ''))
            || null;
          updatePayload.bid_type = detectBidType(tender.bid_number, aiData.tender_title || '');
          if (aiData.procurement_type) updatePayload.procurement_type = aiData.procurement_type;
          if (aiData.keywords?.length) updatePayload.keywords = aiData.keywords;

          if (aiData.dates) {
            const od = parseGeMDate(aiData.dates.bid_opening_date); if (od) updatePayload.opening_date = od;
            const sd = parseGeMDate(aiData.dates.bid_start_date);   if (sd) updatePayload.start_date = sd;
            const ed = parseGeMDate(aiData.dates.bid_end_date);     if (ed) updatePayload.end_date = ed;
          }
        }

        // Skip if tender expired by AI-parsed end_date
        if (updatePayload.end_date && new Date(updatePayload.end_date).getTime() < Date.now()) {
          console.log(`  ! Skipping expired ${tender.bid_number}`);
          return;
        }

        if (Object.keys(updatePayload).length === 0) {
          console.log(`  ~ No data extracted for ${tender.bid_number}`);
          return;
        }

        await supabase.from('tenders').update(updatePayload).eq('id', tender.id);
        successCount++;
        console.log(`  ✓ ${tender.bid_number} | pdf=${!!pdfPublicUrl} ai=${!!aiData} city=${updatePayload.city || '-'}`);

      } catch (err: any) {
        console.error(`  ✗ ${tender.bid_number}:`, err.message);
      }
    }));
  }

  console.log(`\n>>> [ENRICHER] Done. ${successCount}/${pending.length} enriched.\n`);
  return { success: true, processed: successCount };
}
