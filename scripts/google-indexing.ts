import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

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
const credentials = process.env.GOOGLE_INDEXING_CREDENTIALS 
  ? JSON.parse(process.env.GOOGLE_INDEXING_CREDENTIALS) 
  : null;

const jwtClient = credentials ? new google.auth.JWT(
  credentials.client_email,
  null as any,
  credentials.private_key,
  ['https://www.googleapis.com/auth/indexing'],
  null
) : null;

async function submitToGoogle(url: string) {
  if (!jwtClient) {
    throw new Error('Google Indexing Credentials missing in .env.local');
  }

  const indexing = google.indexing({ version: 'v1', auth: jwtClient });
  
  const response = await indexing.urlNotifications.publish({
    requestBody: {
      url: url,
      type: 'URL_UPDATED',
    },
  });

  return response.data;
}

async function runIndexing() {
  console.log(`\n>>> [INDEXING] Starting Google Indexing run.`);
  console.log(`    Limit: ${LIMIT} | Dry-run: ${DRY_RUN}\n`);

  if (!credentials && !DRY_RUN) {
    console.error('✗ ERROR: GOOGLE_INDEXING_CREDENTIALS not found in .env.local');
    console.log('    Skipping actual submission. Run with --dry-run for testing logic.');
    return;
  }

  let totalProcessed = 0, totalIndexed = 0, offset = 0;

  while (totalProcessed < LIMIT) {
    const pageSize = Math.min(BATCH, LIMIT - totalProcessed);

    // Fetch tenders that are not indexed and have been enriched with AI summary
    const { data: tenders, error } = await supabase
      .from('tenders')
      .select(`id, bid_number, slug, title, is_indexed`)
      .eq('is_indexed', false)
      .not('ai_summary', 'is', null)
      .gte('end_date', new Date().toISOString()) // Only index active ones
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) { 
      console.error('[INDEXING] DB error:', error.message); 
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
        console.log(`    [DRY-RUN] Would index: ${tender.bid_number} -> ${tenderUrl}`);
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
      } catch (e: any) {
        console.error(`    ✗ ${tender.bid_number} Error:`, e.message);
        // If quota exceeded, stop the run
        if (e.message?.includes('quota')) {
          console.error('    [!!!] Google Indexing quota exceeded. Ending run.');
          return;
        }
      }
    }

    offset += tenders.length;
    if (tenders.length < pageSize) break;
  }

  console.log(`\n>>> [INDEXING] Done. Processed: ${totalProcessed} | Indexed Successfully: ${totalIndexed}`);
}

runIndexing().catch(console.error);
