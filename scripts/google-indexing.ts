import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { INDIAN_STATES } from '../lib/locations-client.js';
import { CATEGORIES } from '../lib/categories.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gemtenders.org';

const args = process.argv.slice(2);
const LIMIT   = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '200', 10);
const DRY_RUN = args.includes('--dry-run');
const BATCH   = 20;

// Google Indexing API setup
const credentialsStr = process.env.GOOGLE_INDEXING_CREDENTIALS;
let credentials = null;
try {
  credentials = credentialsStr ? JSON.parse(credentialsStr) : null;
} catch (e) {
  if (!DRY_RUN) console.error('✗ ERROR: Failed to parse GOOGLE_INDEXING_CREDENTIALS. Ensure it is a valid JSON string.');
}

const jwtClient = credentials ? new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/indexing']
}) : null;

async function submitToGoogle(url: string) {
  if (!jwtClient) {
    throw new Error('Google Indexing Credentials missing or invalid in .env.local');
  }

  // Ensure the client is authorized
  try {
    await jwtClient.authorize();
  } catch (authErr: any) {
    throw new Error(`Auth Error: ${authErr.message}`);
  }
  
  const indexing = google.indexing({ version: 'v3', auth: jwtClient });
  
  const response = await indexing.urlNotifications.publish({
    requestBody: {
      url: url,
      type: 'URL_UPDATED',
    },
  });

  return response.data;
}

async function indexHubPages() {
  console.log(`\n>>> [INDEXING] Starting Hub Pages Indexing...`);
  
  const hubUrls: string[] = [
    SITE_URL,
    `${SITE_URL}/explore`,
    `${SITE_URL}/bids`,
    `${SITE_URL}/pricing`,
    `${SITE_URL}/about`,
  ];

  // Add all States
  INDIAN_STATES.forEach(state => {
    hubUrls.push(`${SITE_URL}/explore?state=${encodeURIComponent(state)}`);
  });

  // Add all Categories
  CATEGORIES.forEach(cat => {
    hubUrls.push(`${SITE_URL}/explore?category=${encodeURIComponent(cat.id)}`);
  });

  console.log(`    Found ${hubUrls.length} hub pages to index.`);

  let processedCount = 0;
  for (const url of hubUrls) {
    if (DRY_RUN) {
      console.log(`    [DRY-RUN] hub -> ${url}`);
      processedCount++;
      continue;
    }

    try {
      await submitToGoogle(url);
      console.log(`    ✓ Hub Indexed: ${url}`);
      processedCount++;
      // Small delay to avoid hitting rate limits too fast
      await new Promise(r => setTimeout(r, 200));
    } catch (e: any) {
      console.error(`    ✗ Hub Error (${url}):`, e.message);
      if (e.message?.includes('quota')) {
        console.error('    [!!!] Google Indexing quota exceeded.');
        return processedCount;
      }
    }
  }
  return processedCount;
}

async function runIndexing() {
  console.log(`\n>>> [INDEXING] Starting Google Indexing run.`);
  console.log(`    Limit: ${LIMIT} | Dry-run: ${DRY_RUN}\n`);

  if (!credentials && !DRY_RUN) {
    console.error('✗ ERROR: GOOGLE_INDEXING_CREDENTIALS not found in .env.local');
    console.log('    Skipping actual submission. Run with --dry-run for testing logic.');
    return;
  }

  // --- Step 1: Index Hubs (if requested) ---
  const includeHubs = args.includes('--hubs');
  let hubCount = 0;
  if (includeHubs) {
    hubCount = await indexHubPages();
  }

  // --- Step 2: Index Tenders ---
  let totalProcessed = 0, totalIndexed = 0, offset = 0;
  const tenderLimit = LIMIT - hubCount;

  if (tenderLimit <= 0 && !DRY_RUN) {
    console.log('[INDEXING] Quota filled by hubs. Skipping tenders.');
  } else {
    console.log(`\n>>> [INDEXING] Fetching up to ${tenderLimit > 0 ? tenderLimit : LIMIT} tenders...`);
    
    while (totalProcessed < (tenderLimit > 0 ? tenderLimit : LIMIT)) {
      const pageSize = Math.min(BATCH, (tenderLimit > 0 ? tenderLimit : LIMIT) - totalProcessed);

      // Fetch tenders that are not indexed and have been enriched with AI summary
      const { data: tenders, error } = await supabase
        .from('tenders')
        .select(`id, bid_number, slug, title`)
        .eq('is_indexed', false)
        .not('ai_summary', 'is', null)
        .gte('end_date', new Date().toISOString()) // Only index active ones
        .order('created_at', { ascending: false }) // Index newest first
        .range(offset, offset + pageSize - 1);

      if (error) { 
        if (error.message.includes('is_indexed')) {
          console.error('\n[!!!] DATABASE ERROR: Column "is_indexed" is missing.');
          console.log('      Please run the following SQL in Supabase Dashboard:');
          console.log('\n      ALTER TABLE tenders ADD COLUMN is_indexed BOOLEAN DEFAULT false;');
          console.log('      ALTER TABLE tenders ADD COLUMN indexed_at TIMESTAMPTZ;');
          console.log('      CREATE INDEX idx_tenders_is_indexed ON tenders(is_indexed) WHERE is_indexed = false;\n');
        } else {
          console.error('[INDEXING] DB error:', error.message); 
        }
        break; 
      }
      if (!tenders?.length) { 
        console.log('[INDEXING] No pending tenders to index.'); 
        break; 
      }

      console.log(`>>> [INDEXING] Batch of ${tenders.length}...`);

      for (const tender of tenders) {
        totalProcessed++;
        const tenderUrl = `${SITE_URL}/bids/${tender.slug}`;

        if (DRY_RUN) {
          console.log(`    [DRY-RUN] tender -> ${tender.bid_number} -> ${tenderUrl}`);
          continue;
        }

        try {
          await submitToGoogle(tenderUrl);

          const { error: upErr } = await supabase
            .from('tenders')
            .update({ 
              is_indexed: true, 
              indexed_at: new Date().toISOString() 
            })
            .eq('id', tender.id);

          if (upErr) {
            console.error(`    ✗ Failed to mark ${tender.bid_number} as indexed:`, upErr.message);
          } else {
            console.log(`    ✓ Indexed: ${tender.bid_number}`);
            totalIndexed++;
          }
          // Small delay
          await new Promise(r => setTimeout(r, 200));
        } catch (e: any) {
          console.error(`    ✗ ${tender.bid_number} Error:`, e.message);
          if (e.message?.includes('quota')) {
            console.error('    [!!!] Google Indexing quota exceeded. Ending run.');
            return;
          }
        }
      }

      offset += tenders.length;
      if (tenders.length < pageSize) break;
    }
  }

  console.log(`\n>>> [INDEXING] Done.`);
  console.log(`    Hubs Processed: ${hubCount}`);
  console.log(`    Tenders Processed: ${totalProcessed} | Successfully Indexed: ${totalIndexed}`);
}

runIndexing().catch(console.error);
