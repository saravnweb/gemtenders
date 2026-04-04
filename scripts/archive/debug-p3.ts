import axios from 'axios';
import https from 'https';
import fs from 'fs';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function check() {
  const bId = '8720660';
  const url = `https://bidplus.gem.gov.in/showbiddata/${bId}`;
  
  console.log(`Checking ${url}...`);
  try {
    const res = await axios.get(url, {
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });
    console.log(`Status: ${res.status}`);
    const html = res.data;
    console.log(`HTML Length: ${html.length}`);
    fs.writeFileSync('tmp/test-p3.html', html);
    console.log(`Saved to tmp/test-p3.html`);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    if (e.response) console.error(`Status: ${e.response.status}`);
  }
}

check();
