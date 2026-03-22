import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Trigger customized email/notification logic based on user keywords.
 * 
 * @param tenderData The enriched tender data object
 */
export async function triggerKeywordNotifications(tenderData: any) {
  try {
    if (!process.env.SMTP_HOST) {
        console.warn(`[NOTIFICATIONS] SMTP_HOST not configured. Notification will not be sent for ${tenderData.bid_number}`);
        return;
    }

    console.log(`[NOTIFICATIONS] Checking keywords for tender ${tenderData.bid_number}`);
    
    // 1. Fetch saved searches 
    const { data: searches, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('is_alert_enabled', true);

    if (error || !searches) return;

    // 2. Match tender details
    const textToSearch = [
        tenderData.title,
        tenderData.ai_summary,
        tenderData.department,
        tenderData.ministry_name,
        tenderData.organisation_name,
        tenderData.department_name
    ].filter(Boolean).join(' ').toLowerCase();

    const matchedUserIds = new Map(); // user_id -> matched queries array

    for (const search of searches) {
      let matches = false;
      const params = search.query_params || {};
      
      // Keywords check
      if (params.q) {
          const kws = params.q.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
          if (kws.length > 0) {
              matches = kws.some((kw: string) => textToSearch.includes(kw));
          }
      }

      // States check
      if (matches && params.states && params.states.length > 0) {
          if (!tenderData.state || !params.states.some((st: string) => st.toLowerCase() === tenderData.state.toLowerCase())) {
              matches = false;
          }
      }

      // Cities check
      if (matches && params.cities && params.cities.length > 0) {
          if (!tenderData.city || !params.cities.some((ct: string) => tenderData.city?.toLowerCase().includes(ct.toLowerCase()))) {
              matches = false;
          }
      }

      if (matches) {
          if (!matchedUserIds.has(search.user_id)) {
              matchedUserIds.set(search.user_id, []);
          }
          matchedUserIds.get(search.user_id).push(search.name);
      }
    }

    if (matchedUserIds.size === 0) {
        console.log(`[NOTIFICATIONS] No matches found for ${tenderData.bid_number}`);
        return;
    }

    // 3. Queue emails, in-app notifications, and WhatsApp
    for (const [userId, matchedQueries] of matchedUserIds.entries()) {
      try {
        const { data: userAuth } = await supabase.auth.admin.getUserById(userId);
        const email = userAuth?.user?.email;
        
        // Fetch phone number for WhatsApp
        const { data: profile } = await supabase.from('profiles').select('phone_number').eq('id', userId).single();
        const phoneNumber = profile?.phone_number;
        
        console.log(`[NOTIFICATIONS] Match found for user ${userId} on ${tenderData.bid_number}`);
        
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gemtenders.org';
        const tenderLink = `${siteUrl}/bids/${tenderData.slug || tenderData.bid_number}`;
        const notificationTitle = `New Tender Match: ${tenderData.bid_number}`;
        
        // --- IN-APP NOTIFICATION ---
        await supabase.from('in_app_notifications').insert({
           user_id: userId,
           title: notificationTitle,
           message: `Matches: ${matchedQueries.join(', ')} - ${tenderData.department || 'Unknown Dept'}`,
           link: tenderLink,
        });

        // --- EMAIL ---
        if (email && process.env.SMTP_HOST) {
          const mailOptions = {
            from: process.env.EMAIL_FROM || '"GeM Tenders" <noreply@gemtenders.org>',
            to: email,
            subject: notificationTitle,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0f172a;">A new tender matched your keywords!</h2>
                <p><strong>Keyword Monitors Triggered:</strong> ${matchedQueries.join(', ')}</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <h3 style="color: #1e40af;">${tenderData.title || tenderData.bid_number}</h3>
                <p><strong>Department:</strong> ${tenderData.department || 'N/A'}</p>
                <p><strong>State:</strong> ${tenderData.state || 'N/A'} - <strong>City:</strong> ${tenderData.city || 'N/A'}</p>
                <p><strong>EMD:</strong> ${tenderData.emd_amount ? '₹' + tenderData.emd_amount.toLocaleString() : 'No EMD / Not Specified'}</p>
                <p><strong>Closes on:</strong> ${tenderData.end_date ? new Date(tenderData.end_date).toLocaleString() : 'N/A'}</p>
                <br />
                <a href="${tenderLink}" style="display: inline-block; padding: 12px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Tender Details</a>
                <br /><br />
                <p style="font-size: 12px; color: #64748b; margin-top: 30px;">You are receiving this because you subscribed to keywords on GeM Tenders. You can manage your alerts from your dashboard.</p>
              </div>
            `
          };

          await transporter.sendMail(mailOptions);
          console.log(`[NOTIFICATIONS] Email sent to ${email} for ${tenderData.bid_number}`);
        }

        // --- WHATSAPP ---
        if (phoneNumber) {
            // Note: Drop in your chosen WhatsApp API implementation here (e.g., Twilio, Interakt)
            console.log(`[NOTIFICATIONS] Sending WhatsApp to ${phoneNumber} (API implementation required)`);
            /* Example pseudo-code for Twilio or Interakt:
            await fetch('https://api.interakt.ai/v1/public/message/', {
               method: 'POST',
               headers: { 'Authorization': `Basic ${process.env.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  phoneNumber,
                  type: 'Template',
                  template: { name: 'tender_alert', languageCode: 'en', bodyValues: [tenderData.bid_number, tenderLink] }
               })
            });
            */
        }
        
      } catch (e: any) {
        console.error(`[NOTIFICATIONS] Error sending notifications to user ${userId}:`, e.message);
      }
    }
    
  } catch (error) {
    console.error(`[NOTIFICATIONS] Error triggering notifications:`, error);
  }
}
