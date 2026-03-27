/**
 * Cleanup Expired Tenders
 *
 * Run daily (e.g. via cron or Vercel cron job).
 *
 * Step 1 — Archive: mark all tenders past their end_date as is_archived=true
 *           and stamp archived_at if not already set.
 * Step 2 — Delete: remove tenders that have been archived for more than 15 days.
 *           15-day window exists to track Reverse Auction (RA) outcomes.
 *
 * Usage:
 *   npm run cleanup
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ARCHIVE_AFTER_DAYS = 0;   // archive as soon as end_date passes
const DELETE_AFTER_DAYS  = 15;  // delete 15 days after archiving

async function main() {
  const now = new Date().toISOString();
  const deleteThreshold = new Date(Date.now() - DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  console.log(`\n>>> [CLEANUP] ${new Date().toLocaleString()}`);
  console.log(`    Archive threshold : end_date < now`);
  console.log(`    Delete threshold  : archived_at < ${deleteThreshold}\n`);

  // ── Step 1: Archive tenders past their end_date ───────────────────────────
  const { data: archived, error: archiveErr } = await supabase
    .from('tenders')
    .update({ is_archived: true, archived_at: now })
    .lt('end_date', now)
    .eq('is_archived', false)
    .select('id');

  if (archiveErr) {
    console.error('Archive error:', archiveErr.message);
  } else {
    console.log(`  Archived : ${archived?.length ?? 0} tenders`);
  }

  // ── Step 2: Delete tenders archived more than 15 days ago ─────────────────
  const { data: deleted, error: deleteErr } = await supabase
    .from('tenders')
    .delete()
    .lt('archived_at', deleteThreshold)
    .select('id');

  if (deleteErr) {
    console.error('Delete error:', deleteErr.message);
  } else {
    console.log(`  Deleted  : ${deleted?.length ?? 0} tenders (archived > ${DELETE_AFTER_DAYS} days ago)`);
  }

  console.log('\n>>> Done.\n');
}

main().catch(console.error);
