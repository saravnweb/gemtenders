/**
 * Migration: add notification_frequency column to saved_searches
 *
 * Run:  npx ts-node -r tsconfig-paths/register scripts/maintenance/add-frequency-column.ts
 *
 * Values: 'daily' (default) | 'weekly'
 *   daily  → email sent every day the cron runs (existing behaviour)
 *   weekly → email sent only on Mondays, looking back 7 days
 *
 * 'off' is handled by the existing is_alert_enabled = false flag.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SQL = `
-- Add email notification frequency preference to saved_searches.
-- 'daily'  = send every day (existing behaviour, default)
-- 'weekly' = send only on Mondays with a 7-day lookback window
ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS notification_frequency TEXT
    NOT NULL DEFAULT 'daily'
    CHECK (notification_frequency IN ('daily', 'weekly'));

-- Back-fill existing rows (they already behave as daily)
UPDATE public.saved_searches
  SET notification_frequency = 'daily'
  WHERE notification_frequency IS NULL;
`;

async function run() {
  console.log('Checking notification_frequency column on saved_searches...');

  // Try to read the column
  const { data, error } = await supabase
    .from('saved_searches')
    .select('notification_frequency')
    .limit(1);

  if (error?.message?.includes('notification_frequency')) {
    // Column does not exist
    console.log('\n⚠️  COLUMN DOES NOT EXIST.\n');
    console.log('Run the following SQL in your Supabase SQL Editor:\n');
    console.log('─'.repeat(60));
    console.log(SQL);
    console.log('─'.repeat(60));
  } else if (error) {
    console.error('Unexpected error:', error.message);
  } else {
    console.log('✓ notification_frequency column already exists on saved_searches.');
    console.log('  Sample value:', data?.[0]?.notification_frequency ?? '(no rows)');
  }
}

run().catch(console.error);
