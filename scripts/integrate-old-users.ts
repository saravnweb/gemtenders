import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function integrateUsers() {
  console.log("🔍 Fetching authenticated users from Supabase Auth...");
  
  let users: any[] = [];
  try {
     const res = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
     if (res.error) throw res.error;
     users = res.data?.users || [];
  } catch (err: any) {
     console.error("❌ Error fetching auth.users (ensure your service role key is valid):", err.message);
     return;
  }
  
  console.log(`📊 Found ${users.length} authenticated users.`);
  
  let integrated = 0;
  for (const user of users) {
     // Check if user exists in public.profiles
     const { data, error: checkError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle(); // maybeSingle avoids error if zero rows

     if (!data) {
        // Create fallback profile for older users without one
        const { error: insertError } = await supabaseAdmin
           .from('profiles')
           .insert({
              id: user.id,
              full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Member',
              membership_plan: 'free'
           });
           
        if (insertError) {
           console.error(`❌ Failed to create profile for ${user.email}:`, insertError.message);
        } else {
           console.log(`✅ Integrated ${user.email} into profiles table.`);
           integrated++;
        }
     }
  }
  
  console.log(`\n🎉 Scan complete! ${integrated} legacy users were successfully integrated into the profiles table and will now appear in the admin stats.`);
}

integrateUsers();
