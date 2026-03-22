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
  console.log("Fetching tenders lacking comprehensive raw text...");
  
  // Find tenders that either don't have ai_summary OR the summary is very short
  const { data: tenders, error } = await supabase
    .from('tenders')
    .select('id, bid_number, pdf_url, ai_summary')
    .gte('end_date', new Date().toISOString());

  if (error || !tenders) {
    console.error("Error fetching tenders:", error);
    return;
  }

  // Force upgrade everything to JSON format unless it already looks like a JSON string.
  const targets = tenders.filter(t => !t.ai_summary || !t.ai_summary.startsWith('{"'));

  console.log(`Found ${targets.length} active tenders requiring raw text updates. Processing...`);

  let updatedCount = 0;
  
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    
    let url = t.pdf_url;
    if (!url) {
      const fileName = t.bid_number.replace(/\//g, "-") + ".pdf";
      const { data } = supabase.storage.from("tender-documents").getPublicUrl(fileName);
      url = data.publicUrl;
    }

    const text = await parsePdfFromUrl(url);
    if (!text) {
      continue;
    }

    try {
      const extracted = await extractTenderDataRegex(text);
      const newSummary = extracted?.technical_summary;
      
      if (newSummary && newSummary.length > 200) {
        await supabase.from('tenders').update({ ai_summary: newSummary }).eq('id', t.id);
        updatedCount++;
        console.log(`[${updatedCount}] Updated raw text for ${t.bid_number}`);
      }
    } catch (err) {
      // Ignored
    }
  }

  console.log(`\nFinished converting! Successfully injected raw text into ${updatedCount} tenders.`);
}

run();
