import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import axios from 'axios';
import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
  httpsAgent: agent,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  timeout: 30000,
});

const cookies = res.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
const csrf = (res.data as string).match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/)?.[1];
console.log('csrf:', csrf ? 'ok' : 'MISSING');

const form = new URLSearchParams();
form.append('payload', JSON.stringify({ page: 1, param: { searchParam: 'searchbid' }, filter: {} }));
form.append('csrf_bd_gem_nk', csrf!);

const r2 = await axios.post('https://bidplus.gem.gov.in/all-bids-data', form.toString(), {
  httpsAgent: agent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://bidplus.gem.gov.in/all-bids',
    'Cookie': cookies,
  },
  timeout: 30000,
});

const doc = r2.data?.response?.response?.docs?.[0];
if (doc) {
  console.log('\nALL FIELDS:');
  console.log(Object.keys(doc).join('\n'));
  console.log('\nSAMPLE VALUES (non-empty):');
  for (const [k, v] of Object.entries(doc)) {
    if (v !== null && v !== undefined && JSON.stringify(v) !== '[]') {
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
  }
}
