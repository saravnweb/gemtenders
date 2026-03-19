import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfLib = require('pdf-parse');
const pdfFn = typeof pdfLib === 'function' ? pdfLib : pdfLib.default || pdfLib.PDFParse;

const res = await fetch('https://tlregrteeeqwvptgpiib.supabase.co/storage/v1/object/public/tender-documents/GEM-2025-B-6573774.pdf');
const buf = Buffer.from(await res.arrayBuffer());
const parsed = await pdfFn(buf);

console.log('Pages:', parsed.numpages);
console.log('Text length:', parsed.text?.length);
console.log('Text preview:', parsed.text?.substring(0, 500));
