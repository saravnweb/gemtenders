const fs = require('fs');
const content = fs.readFileSync('scripts_output.txt', 'utf16le');
fs.writeFileSync('error_decoded_utf8.txt', content, 'utf8');
