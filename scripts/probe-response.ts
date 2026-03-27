import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import axios from 'axios';
import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

const s = await axios.get('https://bidplus.gem.gov.in/all-bids', {
  httpsAgent: agent,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  timeout: 20000,
});
const cookies = s.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
console.log('Session cookies:', cookies.slice(0, 80));

// Try PDF URL with session cookies
const r = await axios.get('https://bidplus.gem.gov.in/showbidDocument/8720660', {
  httpsAgent: agent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Cookie': cookies,
    'Referer': 'https://bidplus.gem.gov.in/all-bids',
    'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
  },
  responseType: 'arraybuffer',
  maxRedirects: 10,
  timeout: 15000,
}).catch((e: any) => { console.log('Error:', e.message); return null; });

if (r) {
  console.log('\n=== showbidDocument/8720660 ===');
  console.log('Status:', r.status);
  console.log('Content-Type:', r.headers['content-type']);
  console.log('Content-Length:', r.headers['content-length']);
  console.log('Content-Disposition:', r.headers['content-disposition']);
  console.log('Actual body bytes:', (r.data as Buffer).byteLength);
  const preview = Buffer.from(r.data as Buffer).slice(0, 300).toString('utf8');
  console.log('Body preview:', preview);
}

// Also try with Accept: application/json to see if there's an API variant
const r2 = await axios.get('https://bidplus.gem.gov.in/showbidDocument/8720660', {
  httpsAgent: agent,
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Cookie': cookies,
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  responseType: 'text',
  maxRedirects: 5,
  timeout: 10000,
}).catch((e: any) => { console.log('JSON variant error:', e.message); return null; });

if (r2) {
  console.log('\n=== JSON variant ===');
  console.log('Status:', r2.status);
  console.log('Content-Type:', r2.headers['content-type']);
  console.log('Body:', String(r2.data).slice(0, 300));
}
