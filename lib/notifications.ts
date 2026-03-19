import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Trigger customized email/notification logic based on user keywords.
 * (Future integration placeholder)
 * 
 * @param tenderData The enriched tender data object
 */
export async function triggerKeywordNotifications(tenderData: any) {
  try {
    console.log(`[NOTIFICATIONS] Checking keywords for tender ${tenderData.bid_number} (future integration)`);
    
    // Future integration logic:
    // 1. Fetch user keyword subscriptions from the 'user_subscriptions' or similar table.
    // 2. Compare user keywords with the extracted tender details 
    //    (e.g., tender title, categories, summary).
    // 3. Queue emails via Resend/SendGrid or insert into a 'notifications' table for matched users.
    
    // Example implementation draft:
    /*
    const { data: users } = await supabase.from('users').select('email, keywords');
    for (const user of users) {
      if (!user.keywords || user.keywords.length === 0) continue;
      
      const matchFound = user.keywords.some(kw => 
        tenderData.title?.toLowerCase().includes(kw.toLowerCase()) ||
        tenderData.ai_summary?.toLowerCase().includes(kw.toLowerCase()) ||
        tenderData.relevant_categories?.some(cat => cat.toLowerCase().includes(kw.toLowerCase()))
      );

      if (matchFound) {
        console.log(`[NOTIFICATIONS] Match found for user ${user.email} on ${tenderData.bid_number}`);
        // await queueEmail(user.email, tenderData);
      }
    }
    */
    
  } catch (error) {
    console.error(`[NOTIFICATIONS] Error triggering notifications:`, error);
  }
}
