import fs from 'fs';

async function run() {
  const file = "C:\\Users\\sarav\\Downloads\\GEM-2026-B-7351326.pdf";
  if (!fs.existsSync(file)) return console.log("File not found:", file);

  const buf = fs.readFileSync(file);
  const _lib: any = await import('pdf-parse');
  const pdfLib = _lib.default || _lib;
  const ParserClass = pdfLib.PDFParse || pdfLib;
  
  let text = '';
  if (typeof ParserClass === 'function' && ParserClass.toString().includes('class')) {
    const instance = new ParserClass({ data: buf, max: 10 });
    const result = await instance.getText();
    text = result.text || '';
    await instance.destroy?.();
  } else {
    const fn = typeof pdfLib === 'function' ? pdfLib : pdfLib.default;
    const parsed = await fn(buf, { max: 10 });
    text = parsed.text || '';
  }

  fs.writeFileSync('test-pdf-analysis.txt', text);
  console.log("Saved test-pdf-analysis.txt, length:", text.length);
}

run();
