import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import axios from 'axios';
import https from 'https';

const HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });

async function refreshSolrSession() {
  const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
    httpsAgent: HTTPS_AGENT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });
  const solrCookies = res.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
  const solrCsrf = (res.data as string).match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/)?.[1] || '';
  return { solrCookies, solrCsrf };
}

async function probe(bidNumber: string) {
  console.log(`Probing SOLR for ${bidNumber}...`);
  const { solrCookies, solrCsrf } = await refreshSolrSession();
  
  const form = new URLSearchParams();
  form.append('payload', JSON.stringify({
    page: 1,
    param: { searchbid: bidNumber },
    filter: {},
  }));
  form.append('csrf_bd_gem_nk', solrCsrf);

  const r = await axios.post('https://bidplus.gem.gov.in/all-bids-data', form.toString(), {
    httpsAgent: HTTPS_AGENT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://bidplus.gem.gov.in/all-bids',
      'Cookie': solrCookies,
    },
    timeout: 20000,
  });

  const doc = r.data?.response?.response?.docs?.[0];
  if (!doc) {
    console.log("No document found for this bid number.");
    return;
  }
  console.log(JSON.stringify(doc, null, 2));
}

const bid = process.argv[2] || 'GEM/2025/B/7007118';
probe(bid).catch(console.error);
