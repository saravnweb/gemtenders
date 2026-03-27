/**
 * Probe Solr API for ALL available fields on a specific bid.
 * Uses fl=* to request every field Solr has stored for the document.
 */
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
const csrf = (s.data as string).match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/)?.[1];
console.log('csrf:', csrf ? 'ok' : 'MISSING');

// Search for a specific bid number using the Solr API
const BID_NO = 'GEM/2025/B/7007118';
const form = new URLSearchParams();
form.append('payload', JSON.stringify({
  page: 1,
  param: { searchParam: 'searchbid', search: BID_NO },
  filter: {},
}));
form.append('csrf_bd_gem_nk', csrf!);

const r = await axios.post('https://bidplus.gem.gov.in/all-bids-data', form.toString(), {
  httpsAgent: agent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://bidplus.gem.gov.in/all-bids',
    'Cookie': cookies,
  },
  timeout: 20000,
});

const docs = r.data?.response?.response?.docs || [];
console.log(`\nFound ${docs.length} docs for bid ${BID_NO}`);

if (docs[0]) {
  console.log('\nALL FIELDS in this doc:');
  for (const [k, v] of Object.entries(docs[0])) {
    if (v !== null && v !== undefined && JSON.stringify(v) !== '[]') {
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
  }
}

// Also try a broader search to see all field names across multiple docs
const form2 = new URLSearchParams();
form2.append('payload', JSON.stringify({ page: 1, param: { searchParam: 'searchbid' }, filter: {} }));
form2.append('csrf_bd_gem_nk', csrf!);

const r2 = await axios.post('https://bidplus.gem.gov.in/all-bids-data', form2.toString(), {
  httpsAgent: agent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest',
    'Cookie': cookies,
  },
  timeout: 20000,
});

const allDocs = r2.data?.response?.response?.docs || [];
const allKeys = new Set<string>();
allDocs.forEach((d: any) => Object.keys(d).forEach(k => allKeys.add(k)));
console.log('\nALL UNIQUE FIELD NAMES across first page of results:');
console.log([...allKeys].sort().join('\n'));

// Check if there's an "expand" or "facets" with more data
const extra = r2.data?.response;
if (extra) {
  const extraKeys = Object.keys(extra).filter(k => k !== 'response');
  if (extraKeys.length) console.log('\nExtra response keys:', extraKeys);
}
