import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

process.on('unhandledRejection', (reason) => {
  console.error('\n🛑 UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('\n🛑 UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

import { createClient } from '@supabase/supabase-js';
import { State } from 'country-state-city';
import { normalizeState, normalizeCity, cityToState, INDIAN_STATES } from '../../lib/locations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const CONCURRENCY  = 5;
const BATCH        = 200;

const argv      = process.argv.slice(2);
const SINCE_ARG = argv.find(a => a.startsWith('--since='))?.split('=')[1] ?? null;
const SINCE_DATE: string | null = (() => {
  if (!SINCE_ARG) return null;
  const m = SINCE_ARG.match(/^(\d+)(h|d)$/);
  if (!m) return null;
  const ms = parseInt(m[1]) * (m[2] === 'h' ? 3600000 : 86400000);
  return new Date(Date.now() - ms).toISOString();
})();

function isValidState(s: string | null | undefined): boolean {
  if (!s) return false;
  return INDIAN_STATES.has(s);
}

// Bad words that indicate AI hallucinated a ministry/org name as a city
const CITY_BLACKLIST = /ministry|department|railways|railway|defence|education|finance|health|agriculture|government|central|national|india|bharat|public|works|division|directorate|commission|board|authority|corporation|council|institute|university|college|school/i;

function isValidCity(c: string | null | undefined): boolean {
  if (!c || c.trim().length < 3) return false;
  if (INDIAN_STATES.has(c)) return false;        // state name ≠ city
  if (CITY_BLACKLIST.test(c)) return false;       // ministry/org name ≠ city
  return true;
}

/** Gather all meaningful text from a row for AI context */
function blobsFromRow(row: any): string {
  const parts: string[] = [];

  if (row.ai_summary) {
    try {
      const params = JSON.parse(row.ai_summary);
      for (const v of Object.values(params)) {
        if (typeof v === 'string') parts.push(v);
      }
    } catch { parts.push(row.ai_summary); }
  }

  for (const f of ['office_name', 'organisation_name', 'department_name', 'ministry_name', 'title']) {
    if (row[f]) parts.push(row[f]);
  }

  // Strip GeM's asterisk masking (e.g. "**********Alwar" → "Alwar")
  return parts.join(' ').replace(/\*+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Ask Groq to extract only city and state from text */
async function aiExtractLocation(text: string): Promise<{ city: string | null; state: string | null }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const prompt = `You are extracting the delivery/consignee LOCATION from an Indian government tender.

From the text below, identify:
- "state": The Indian STATE or Union Territory where goods will be delivered. Must be one of India's 28 states or 8 UTs. NEVER use a ministry, department, railway zone, PSU, or organisation name as state.
- "city": The Indian CITY or DISTRICT of delivery. Must be a real Indian city/town/district. NEVER use "Railways", "Education", "Defence", or any organisation/department name as city.

If you cannot confidently identify a real geographic state or city, return null for that field.

Reply ONLY with valid JSON: {"state": "...", "city": "..."}

Text: ${text.substring(0, 800)}`;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 64,
    }),
  });

  if (res.status === 429) {
    const err = await res.json();
    const waitMs = Math.min(parseFloat(err?.error?.message?.match(/([\d.]+)ms/)?.[1] ?? '3000') + 500, 10000);
    await new Promise(r => setTimeout(r, waitMs));
    return aiExtractLocation(text);
  }

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const raw  = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  return { city: parsed.city ?? null, state: parsed.state ?? null };
}

async function fixLocations() {
  console.log('\n>>> [FIX-LOCATIONS] Starting AI-powered location repair...\n');

  let offset = 0;
  let totalFixed = 0, stateFixed = 0, cityFixed = 0, bothFixed = 0, skipped = 0;

  while (true) {
    // Fetch rows where either state or city is missing
    let rows: any[] | null = null;
    let retries = 3;
    while (retries > 0) {
      let q = supabase
        .from('tenders')
        .select('id, bid_number, state, city, ai_summary, office_name, organisation_name, department_name, ministry_name, title')
        .or('state.is.null,city.is.null');
      if (SINCE_DATE) q = q.gte('created_at', SINCE_DATE);
      const { data, error: fetchErr } = await q.range(0, BATCH - 1);

      if (fetchErr) {
        console.error(`\n  DB error (retries=${retries}): ${fetchErr.message}`);
        if (fetchErr.message.includes('timeout')) {
          retries--;
          await sleep(5000);
          continue;
        }
        break;
      }
      rows = data;
      break;
    }

    if (!rows || rows.length === 0) {
      console.log('>>> No more location-deficient tenders to repair.');
      break;
    }

    console.log(`    Batch ${offset + 1}–${offset + rows.length} (${rows.length} rows)...`);

    // Process in parallel chunks
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY);

      await Promise.all(chunk.map(async (row) => {
        try {
          const missingState = !row.state;
          const missingCity  = !row.city;
          const update: Record<string, string | null> = {};

          // ── Free pass: city known → infer state via DB lookup ──────────────
          if (!missingCity && missingState) {
            const inferred = cityToState(row.city);
            if (inferred && isValidState(inferred)) {
              update.state = inferred;
            }
          }

          // ── AI pass: ask Groq for missing fields ────────────────────────────
          if ((missingCity && !update.city) || (missingState && !update.state)) {
            const text = blobsFromRow(row);
            if (!text.trim()) { skipped++; return; }

            try {
              let { city, state } = await aiExtractLocation(text);

              // Normalize
              city  = city  ? normalizeCity(city)   : null;
              state = state ? normalizeState(state)  : null;

              // Validate against DB — reject ministry/org names masquerading as locations
              if (missingCity  && !update.city  && city  && isValidCity(city))   update.city  = city;
              if (missingState && !update.state && state && isValidState(state))  update.state = state;

              // Cross-validate city against country-state-city DB
              if (update.city) {
                const dbState = cityToState(update.city); // null = unknown or city spans multiple states
                if (dbState && missingState) {
                  // DB gives a definitive, unambiguous state — always trust it
                  update.state = dbState;
                }
              }
            } catch (e: any) {
              console.error(`    ✗ AI error for ${row.bid_number}: ${e.message}`);
              return;
            }
          }

          // Don't overwrite existing values with null
          if (!update.city)  delete update.city;
          if (!update.state) delete update.state;

          if (Object.keys(update).length === 0) { skipped++; return; }

          const { error: upErr } = await supabase.from('tenders').update(update).eq('id', row.id);
          if (upErr) {
            console.error(`    ✗ DB error ${row.bid_number}: ${upErr.message}`);
            return;
          }

          const fixedCity  = 'city'  in update;
          const fixedState = 'state' in update;
          if (fixedCity && fixedState) bothFixed++;
          else if (fixedState) stateFixed++;
          else if (fixedCity)  cityFixed++;
          totalFixed++;

          console.log(`    ✓ ${row.bid_number} → state: ${update.state ?? row.state ?? '–'} | city: ${update.city ?? row.city ?? '–'}`);
        } catch (e: any) {
          console.error(`    ✗ Fatal error for ${row.bid_number}: ${e.message}`);
        }
      }));
    }

    offset += rows.length;
    if (rows.length < BATCH) break;
  }

  console.log(`\n>>> [FIX-LOCATIONS] Done.`);
  console.log(`    ✓ Total updated:           ${totalFixed}`);
  console.log(`      State fixed:             ${stateFixed + bothFixed}`);
  console.log(`      City fixed:              ${cityFixed  + bothFixed}`);
  console.log(`      Skipped (no data found): ${skipped}`);
}

fixLocations().catch(console.error);
