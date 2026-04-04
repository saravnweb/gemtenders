import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
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

async function run() {
  const { data } = supabase.storage.from("tender-documents").getPublicUrl("GEM-2026-B-7375630.pdf");
  const text = await parsePdfFromUrl(data.publicUrl);
  
  if (!text) return console.log("Failed to fetch PDF");

  let details = text;
  
  // Cut off at standard GeM Disclaimers (often "Disclaimer/अस्वीकरण")
  const disclaimerMatch = text.match(/Disclaimer\/?अस्वीकरण|Disclaimer/i);
  if (disclaimerMatch && disclaimerMatch.index !== undefined) {
      details = text.substring(0, disclaimerMatch.index).trim();
  }

  // Also cut off the very top header which is usually standard 
  // e.g., "Bid Document/ बिड दस्तावेज़"
  const docBody = details.replace(/Bid Document\/.*?\n/i, '');

  fs.writeFileSync('test-details.txt', docBody);
  console.log("Saved test-details.txt, length:", docBody.length);
}

run();
