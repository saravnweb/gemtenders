
import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });

async function debugSolr(bidNumber: string) {
    console.log(`>>> Debugging SOLR for: ${bidNumber}`);
    
    const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
      httpsAgent: HTTPS_AGENT,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const cookies = res.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
    const csrf    = (res.data as string).match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/)?.[1] || '';
    
    if (!cookies || !csrf) {
        console.error("Failed to get session");
        return;
    }

    const payload = JSON.stringify({
        page: 1,
        param: { searchBid: bidNumber, searchType: 'fullText' },
        filter: { bidStatusType: 'all', byType: 'all', sort: 'Bid-End-Date-Oldest' },
    });

    const form = new URLSearchParams();
    form.append('payload', payload);
    form.append('csrf_bd_gem_nk', csrf);

    const r = await axios.post('https://bidplus.gem.gov.in/all-bids-data', form.toString(), {
        httpsAgent: HTTPS_AGENT,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://bidplus.gem.gov.in/all-bids',
            'Cookie': cookies,
        },
    });

    const docs = r.data?.response?.response?.docs || [];
    if (docs.length > 0) {
        fs.writeFileSync('solr-full-doc.json', JSON.stringify(docs[0], null, 2));
        console.log(`Success! Full doc saved to solr-full-doc.json. Found ${docs.length} matches.`);
    } else {
        console.log("No docs found.");
    }
}

// Using a known valid bid number
debugSolr('GEM/2026/B/7387620');
