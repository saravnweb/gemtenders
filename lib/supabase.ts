import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(">>> [SUPABASE] ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
} else {
  console.log(">>> [SUPABASE] Initialized with URL:", supabaseUrl);
}

export const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');
