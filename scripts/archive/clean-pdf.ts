import fs from 'fs';

function run() {
  const file = "test-pdf-analysis.txt";
  if (!fs.existsSync(file)) return console.log("File not found");

  const text = fs.readFileSync(file, 'utf-8');

  // Remove lines that are purely page numbers or "-- 1 of 6 --"
  let lines = text.split('\n').filter(line => {
    if (line.match(/^\s*\d*\s*\/\s*\d*\s*$/)) return false; // "1 / 6"
    if (line.match(/^\s*--\s*\d+\s*of\s*\d+\s*--\s*$/i)) return false; // "-- 1 of 6 --"
    return true;
  });

  // Strip all Devanagari characters
  // \u0900-\u097F covers Devanagari unicode block
  const cleanedText = lines.map(line => line.replace(/[\u0900-\u097F]/g, '')).join('\n');
  
  // Format cleanup:
  // Remove multiple spaces/tabs
  let formatted = cleanedText.replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').trim();
  
  // Since GeM labels are usually like //Bid Details
  // Let's replace "//" and "/" with clean structures if appropriate, or just keep the text
  fs.writeFileSync('clean-pdf-output.txt', formatted);
  console.log("Cleaned text saved. Length:", formatted.length);
}

run();
