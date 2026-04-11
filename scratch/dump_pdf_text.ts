
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function dumpPdfText(bid: string) {
    const fileName = bid.replace(/\//g, '-') + '.pdf';
    const { data: blob, error } = await supabase.storage.from('tender-documents').download(fileName);
    
    if (error || !blob) {
        console.error("Error:", error?.message);
        return;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    console.log("PDF TEXT START >>>");
    console.log(result.text.substring(0, 2000));
    console.log("<<< PDF TEXT END");
}

dumpPdfText('GEM/2026/B/7390332');
