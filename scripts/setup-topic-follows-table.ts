import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function setup() {
  console.log('Checking topic_follows table...');
  const { error } = await supabase.from('topic_follows').select('id').limit(1);

  if (error && error.code === '42P01') {
    console.log(`
TABLE DOES NOT EXIST. Run the following SQL in your Supabase SQL Editor:

CREATE TABLE public.topic_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  follow_type TEXT NOT NULL CHECK (follow_type IN ('ministry', 'state', 'org')),
  follow_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, follow_type, follow_value)
);

CREATE INDEX idx_topic_follows_user ON public.topic_follows(user_id);
CREATE INDEX idx_topic_follows_type_value ON public.topic_follows(follow_type, follow_value);

ALTER TABLE public.topic_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own follows"
  ON public.topic_follows FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
`);
  } else {
    console.log('topic_follows table already exists:', error?.message || 'OK');
  }
}

setup();
