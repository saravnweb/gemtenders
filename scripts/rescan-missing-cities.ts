import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { extractTenderDataOllama as extractTenderDataRegex } from '../lib/ollama';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  console.log("Fetching all active tenders missing a city...");
  
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

    try {
      const extracted = await extractTenderDataRegex(text);
      const newCity = extracted?.authority?.city;
      
      if (newCity && newCity.length > 0) {
        await supabase.from('tenders').update({ city: newCity }).eq('id', t.id);
        updatedCount++;
        console.log(`[${updatedCount}] Updated ${t.bid_number} -> ${newCity}`);
      } else {
        if (i % 50 === 0) console.log(`Processed ${i}/${tenders.length}`);
      }
    } catch (err) {
      // Ignored
    }
  }

  console.log(`\nFinished rescanning! Successfully recovered ${updatedCount} extremely verified cities from ${tenders.length} unknown tenders.`);
}

run();
