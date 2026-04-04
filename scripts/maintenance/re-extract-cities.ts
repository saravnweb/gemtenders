import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

import { normalizeCity } from '../../lib/locations';

async function parsePdfFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const _lib: any = await import('pdf-parse');
    const pdfLib = _lib.default || _lib;
    const ParserClass = pdfLib.PDFParse || pdfLib;
    let text = '';
    if (typeof ParserClass === 'function' && ParserClass.toString().includes('class')) {
      const instance = new ParserClass({ data: buf, max: 5 });
      const result = await instance.getText();
      text = result.text || '';
      await instance.destroy?.();
    } else {
      const fn = typeof pdfLib === 'function' ? pdfLib : pdfLib.default;
      const parsed = await fn(buf, { max: 5 });
      text = parsed.text || '';
    }
    return text.trim() || null;
  } catch (e: any) {
    return null;
  }
}

async function run() {
  const { data: tenders, error } = await supabase
    .from('tenders')
    .select('id, bid_number, pdf_url')
    .gte('end_date', new Date().toISOString())
    .is('city', null);

  if (error || !tenders) {
    console.error("Error fetching tenders:", error);
    return;
  }

  console.log(`Found ${tenders.length} active tenders missing a city. Processing...`);

  let updatedCount = 0;
  
  for (let i = 0; i < tenders.length; i++) {
    const t = tenders[i];
    
    // Construct public URL if missing
    let url = t.pdf_url;
    if (!url) {
      const fileName = t.bid_number.replace(/\//g, "-") + ".pdf";
      const { data } = supabase.storage.from("tender-documents").getPublicUrl(fileName);
      url = data.publicUrl;
    }

    const text = await parsePdfFromUrl(url);
    if (!text) {
      if (i % 50 === 0) console.log(`Processed ${i}/${tenders.length}`);
      continue;
    }

    // New extraction logic
    let city = null;

    // 1. District
    const distMatch = text.match(/\bDistrict\b\s*[:\-]?\s*([^\n]+)/i);
    if (distMatch) {
      const d = distMatch[1].trim();
      if (d.toUpperCase() !== 'NA') city = d;
    }

    // 2. City
    if (!city || city.toUpperCase() === 'NA') {
      const cityMatch = text.match(/\bCity\b\s*[:\-]?\s*([^\n]+)/i);
      if (cityMatch) {
        const c = cityMatch[1].trim();
        if (c.toUpperCase() !== 'NA') city = c;
      }
    }

    // 3. Masked string
    if (!city || city.toUpperCase() === 'NA') {
      const maskedCityMatch = text.match(/\*{5,}([A-Z][a-zA-Z\s]+)\b/);
      if (maskedCityMatch) {
        const putativeCity = maskedCityMatch[1].trim();
        if (putativeCity.length > 2 && putativeCity.length < 30) {
          city = putativeCity;
        }
      }
    }

    if (city && city.toUpperCase() !== 'NA') {
      const normalized = normalizeCity(city);
      if (normalized) {
        await supabase.from('tenders').update({ city: normalized }).eq('id', t.id);
        updatedCount++;
        console.log(`[${updatedCount}] Updated ${t.bid_number} -> ${normalized}`);
      }
    }
  }

  console.log(`Finished processing. Updated ${updatedCount} tenders with new cities!`);
}

run();
