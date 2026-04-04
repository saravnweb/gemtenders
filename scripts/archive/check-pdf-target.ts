import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function parsePdfFromUrl(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const _lib: any = await import('pdf-parse');
  const pdfLib = _lib.default || _lib;
  const ParserClass = pdfLib.PDFParse || pdfLib;
  if (typeof ParserClass === 'function' && ParserClass.toString().includes('class')) {
    const instance = new ParserClass({ data: buf, max: 5 });
    const result = await instance.getText();
    await instance.destroy?.();
    return result.text || '';
  } else {
    const fn = typeof pdfLib === 'function' ? pdfLib : pdfLib.default;
    const parsed = await fn(buf, { max: 5 });
    return parsed.text || '';
  }
}

async function check() {
  // Check the table columns first
  console.log("Checking tenders table schema...");
  const { data: cols } = await supabase.from('tenders').select('*').limit(1);
  if (cols && cols.length > 0) {
    console.log("Columns:", Object.keys(cols[0]));
  }

  // Get a PDF text
  const { data } = supabase.storage.from("tender-documents").getPublicUrl("GEM-2026-B-7375630.pdf");
  const text = await parsePdfFromUrl(data.publicUrl);
  
  if (text) {
    const snippetIndex = text.indexOf("Disclaimer");
    if (snippetIndex !== -1) {
       console.log("Found Disclaimer at index:", snippetIndex);
       console.log("Text surrounding Disclaimer:\n", text.substring(snippetIndex - 50, snippetIndex + 100));
    } else {
       console.log("Disclaimer NOT found.");
       console.log("End of PDF:\n", text.substring(text.length - 200));
    }
  }
}

check();
