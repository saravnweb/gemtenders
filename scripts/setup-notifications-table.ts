import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function setupDatabase() {
  console.log('Setting up in_app_notifications table...');
  
  // We execute a raw SQL block via the Supabase REST API (or postgres function).
  // However, since we might not have a postgres wrapper function, we can try to 
  // create it using supabase.rpc or direct REST if possible.
  // Actually, the most robust way without direct postgres connection is to tell
  // the user to run it in Supabase SQL editor, BUT we can try creating it via
  // the REST API if pgcrypto extension is installed or just inserting a test row.
  
  // Notice: The best way to create a table dynamically here is to just ask the user 
  // to run it in the Supabase Dashboard, or provide a SQL string they can copy-paste.
  // Let's create a dummy row, which fails if table does not exist, to verify.
  const { error } = await supabase.from('in_app_notifications').select('id').limit(1);
  if (error && error.code === '42P01') {
      console.log(`
      CRITICAL ACTION REQUIRED: TABLE DOES NOT EXIST.
      Please execute the following SQL in your Supabase SQL Editor:
      
      CREATE TABLE public.in_app_notifications (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
      
      ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view their own notifications"
        ON public.in_app_notifications FOR SELECT
        USING (auth.uid() = user_id);
        
      CREATE POLICY "Users can update their own notifications"
        ON public.in_app_notifications FOR UPDATE
        USING (auth.uid() = user_id);
      `);
  } else {
      console.log('Table in_app_notifications already exists or another error occurred:', error?.message || 'Success');
  }
}

setupDatabase();
