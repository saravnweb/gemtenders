import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import { City } from 'country-state-city';
import { normalizeState, normalizeCity, cityToState, INDIAN_STATES } from '../lib/locations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const CONCURRENCY  = 5;
const BATCH        = 200;

// Valid Indian city names (lowercase) for cross-validation
const VALID_CITIES = new Set(
  (City.getCitiesOfCountry('IN') || []).map(c => c.name.toLowerCase())
);

// ── PDF fetch + extract consignee section ─────────────────────────────────────
async function getConsigneeSection(pdfUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pdfUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return null;

    const _lib: any = await import('pdf-parse');
    const pdfLib = _lib.default || _lib;
    const ParserClass = pdfLib.PDFParse || pdfLib;
    let text = '';
    if (typeof ParserClass === 'function' && ParserClass.toString().includes('class')) {
      const instance = new ParserClass({ data: buf, max: 3 });
      const result = await instance.getText();
      text = result.text || '';
      await instance.destroy?.();
    } else {
      const fn = typeof pdfLib === 'function' ? pdfLib : pdfLib.default;
      const parsed = await fn(buf, { max: 3 });
      text = parsed.text || '';
    }

    if (!text) return null;

    // Strip GeM asterisk masking
    text = text.replace(/\*+/g, ' ').replace(/\s+/g, ' ');

    // Find and extract only the Consignees/Reporting Officer section
    const idx = text.search(/consignee|reporting\s*officer|पता\s*\/?\s*address/i);
    if (idx === -1) return text.substring(0, 600); // fallback: top of doc

    return text.substring(idx, idx + 800).trim();
  } catch (e: any) {
    console.error(`    pdf error: ${e.message}`);
    return null;
  }
}

// ── Groq AI: extract city + state from consignee text ────────────────────────
async function aiExtractLocation(
  text: string
): Promise<{ city: string | null; state: string | null }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const prompt = `You are extracting the DELIVERY LOCATION from an Indian government GeM tender consignee section.

Rules:
- "state" must be one of India's 28 states or 8 Union Territories. Return the full official name (e.g. "Madhya Pradesh", "Jammu And Kashmir"). NEVER use a ministry, department, railway zone, PSU, or organisation name.
- "city" must be a real Indian city, town, or district. NEVER use words like "Bid", "Not Mentioned", "Not Specified", "N/A", "Sector", "Project", "Division", "Energy", "Railways", "Defence", or any organisation name.
- If you are not confident, return null for that field. Do not guess.

Reply ONLY with valid JSON: {"state": "...", "city": "..."}

Consignee section:
${text.substring(0, 700)}`;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
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
    const waitMs = Math.min(
      parseFloat(err?.error?.message?.match(/([\d.]+)ms/)?.[1] ?? '3000') + 500,
      10000
    );
    console.warn(`    Rate limit. Waiting ${waitMs}ms...`);
    await new Promise(r => setTimeout(r, waitMs));
    return aiExtractLocation(text);
  }

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

  const json   = await res.json();
  const raw    = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

  return {
    city:  parsed.city  && parsed.city  !== 'null' ? parsed.city  : null,
    state: parsed.state && parsed.state !== 'null' ? parsed.state : null,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────
const BAD_VALUE = /^(null|n\/a|na|not\s*(mentioned|specified|available|applicable)|none|bid|sector|project|energy|steel|railways|defence|ministry|department|division|north|south|east|west|central|affairs|natural|fertilizers|culture|nagar)$/i;

function validateState(s: string | null): string | null {
  if (!s) return null;
  const normalized = normalizeState(s);
  if (!normalized || !INDIAN_STATES.has(normalized)) return null;
  return normalized;
}

function validateCity(c: string | null): string | null {
  if (!c) return null;
  if (BAD_VALUE.test(c.trim())) return null;
  if (INDIAN_STATES.has(c)) return null; // state name is not a city
  const normalized = normalizeCity(c);
  if (!normalized || normalized.length < 3) return null;
  return normalized;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fixLocationsPdf() {
  console.log('\n>>> [FIX-PDF] AI-powered location extraction from PDFs...\n');

  let offset = 0;
  let totalFixed = 0, bothFixed = 0, stateFixed = 0, cityFixed = 0, skipped = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('tenders')
      .select('id, bid_number, pdf_url, state, city')
      .or('state.is.null,city.is.null')
      .not('pdf_url', 'is', null)
      .range(offset, offset + BATCH - 1);

    if (error) { console.error('DB error:', error.message); break; }
    if (!rows?.length) break;

    console.log(`    Batch ${offset + 1}–${offset + rows.length}...`);

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY);

      await Promise.all(chunk.map(async (row) => {
        if (!row.pdf_url) { skipped++; return; }

        // Step 1: get consignee section from PDF
        const section = await getConsigneeSection(row.pdf_url);
        if (!section || section.trim().length < 20) { skipped++; return; }

        // Step 2: ask Groq
        let aiCity: string | null = null;
        let aiState: string | null = null;
        try {
          const result = await aiExtractLocation(section);
          aiCity  = validateCity(result.city);
          aiState = validateState(result.state);
        } catch (e: any) {
          console.error(`    ✗ AI error ${row.bid_number}: ${e.message}`);
          skipped++;
          return;
        }

        // Step 3: cross-validate city against state using DB
        if (aiCity) {
          const dbState = cityToState(aiCity); // null if unknown or ambiguous
          if (dbState) {
            if (!aiState || dbState !== aiState) {
              // DB has a definitive state for this city — trust it over AI
              aiState = validateState(dbState);
            }
            // If dbState === aiState: agree — keep both as-is
          }
          // If dbState is null: city not in DB or ambiguous — keep aiState as-is
        }

        // Step 4: build update — only fill missing fields
        const update: Record<string, string> = {};
        if (!row.state && aiState) update.state = aiState;
        if (!row.city  && aiCity)  update.city  = aiCity;

        if (!Object.keys(update).length) { skipped++; return; }

        const { error: upErr } = await supabase
          .from('tenders').update(update).eq('id', row.id);

        if (upErr) {
          console.error(`    ✗ DB ${row.bid_number}: ${upErr.message}`);
          return;
        }

        const fCity  = 'city'  in update;
        const fState = 'state' in update;
        if (fCity && fState) bothFixed++;
        else if (fState) stateFixed++;
        else if (fCity)  cityFixed++;
        totalFixed++;

        console.log(
          `    ✓ ${row.bid_number} → state: ${update.state ?? row.state ?? '–'} | city: ${update.city ?? row.city ?? '–'}`
        );
      }));
    }

    offset += rows.length;
    if (rows.length < BATCH) break;
  }

  console.log(`\n>>> [FIX-PDF] Done.`);
  console.log(`    ✓ Total updated:           ${totalFixed}`);
  console.log(`      Both state+city fixed:   ${bothFixed}`);
  console.log(`      State only:              ${stateFixed}`);
  console.log(`      City only:               ${cityFixed}`);
  console.log(`      Skipped (no data/match): ${skipped}`);
}

fixLocationsPdf().catch(console.error);
