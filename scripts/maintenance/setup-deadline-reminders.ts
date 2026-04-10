/**
 * Migration: create deadline_reminders table
 *
 * Run:  npx ts-node -r tsconfig-paths/register scripts/maintenance/setup-deadline-reminders.ts
 *
 * It will print the SQL to paste into Supabase → SQL Editor if the table is missing,
 * or confirm the table already exists.
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
-- Track which (user, tender) pairs have already received a deadline reminder.
-- Prevents duplicate notifications on repeated cron runs.
CREATE TABLE IF NOT EXISTS public.deadline_reminders (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tender_id   UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  reminded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tender_id)
);

CREATE INDEX IF NOT EXISTS idx_deadline_reminders_tender ON public.deadline_reminders(tender_id);
CREATE INDEX IF NOT EXISTS idx_deadline_reminders_user  ON public.deadline_reminders(user_id);

-- RLS: only the cron (service role) writes; users have no direct access.
ALTER TABLE public.deadline_reminders ENABLE ROW LEVEL SECURITY;
`;

async function run() {
  console.log('Checking deadline_reminders table...');
  const { error } = await supabase.from('deadline_reminders').select('id').limit(1);

  if (error?.code === '42P01') {
    console.log('\n⚠️  TABLE DOES NOT EXIST.\n');
    console.log('Run the following SQL in your Supabase SQL Editor:\n');
    console.log('─'.repeat(60));
    console.log(SQL);
    console.log('─'.repeat(60));
  } else if (error) {
    console.error('Unexpected error:', error.message);
  } else {
    console.log('✓ deadline_reminders table already exists.');
  }
}

run().catch(console.error);
