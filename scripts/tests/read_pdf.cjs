const fs = require('fs');
const pdf = require('pdf-parse');

async function parsePDF(filePath) {
    try {
        let dataBuffer = fs.readFileSync(filePath);
        let data = await pdf(dataBuffer);
        console.log("--- PDF CONTENT START ---");
        // Print first 5000 chars to avoid overwhelming output, or the whole thing if we want.
        // Let's print the whole thing to see all fields, we can truncate if needed but let's see.
        console.log(data.text);
        console.log("--- PDF CONTENT END ---");
    } catch (e) {
        console.error("Error reading PDF:", e);
    }
}

const args = process.argv.slice(2);
if (args.length > 0) {
    parsePDF(args[0]);
} else {
    console.log("Please provide a PDF file path.");
}
