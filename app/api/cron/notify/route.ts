import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch all active saved searches
    const { data: searches } = await supabase
      .from('saved_searches')
      .select('user_id, name, query_params')
      .eq('is_alert_enabled', true);

    // 2. Fetch all topic follows
    const { data: topicFollows } = await supabase
      .from('topic_follows')
      .select('user_id, follow_type, follow_value');

    // 3. Fetch unnotified tenders
    const { data: tenders, error } = await supabase
      .from('tenders')
      .select(`
        id, bid_number, slug, title, department,
        ministry_name, department_name, organisation_name,
        state, city, ai_summary, relevant_categories,
        gemarpts_result, end_date
      `)
      .eq('notification_sent', false)
      .not('ai_summary', 'is', null)
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    const allTenders = tenders ?? [];

    // 4. Count matches per user
    const userMatchCount = new Map<string, number>(); // user_id → count

    for (const tender of allTenders) {
      const textToSearch = [
        tender.title,
        tender.ai_summary,
        tender.relevant_categories,
        tender.gemarpts_result,
        tender.department,
        tender.ministry_name,
        tender.organisation_name,
        tender.department_name,
      ].filter(Boolean).join(' ').toLowerCase();

      const matchedUsers = new Set<string>();

      // Check saved searches
      for (const search of searches ?? []) {
        const params = search.query_params || {};
        let matches = false;

        if (params.q) {
          const kws = params.q.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
          if (kws.length > 0) matches = kws.some((kw: string) => textToSearch.includes(kw));
        }
        if (matches && params.states?.length > 0) {
          if (!tender.state || !params.states.some((st: string) => st.toLowerCase() === tender.state.toLowerCase())) matches = false;
        }
        if (matches && params.cities?.length > 0) {
          if (!tender.city || !params.cities.some((ct: string) => tender.city?.toLowerCase().includes(ct.toLowerCase()))) matches = false;
        }

        if (matches) matchedUsers.add(search.user_id);
      }

      // Check topic follows
      for (const follow of topicFollows ?? []) {
        let isMatch = false;
        if (follow.follow_type === 'ministry' && tender.ministry_name)
          isMatch = tender.ministry_name.toLowerCase().includes(follow.follow_value.toLowerCase());
        else if (follow.follow_type === 'state' && tender.state)
          isMatch = tender.state.toLowerCase() === follow.follow_value.toLowerCase();
        else if (follow.follow_type === 'org' && tender.organisation_name)
          isMatch = tender.organisation_name.toLowerCase().includes(follow.follow_value.toLowerCase());

        if (isMatch) matchedUsers.add(follow.user_id);
      }

      for (const userId of matchedUsers) {
        userMatchCount.set(userId, (userMatchCount.get(userId) ?? 0) + 1);
      }
    }

    // 5. Send ONE digest notification per user
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gemtenders.org';
    let notifiedUsers = 0;

    for (const [userId, count] of userMatchCount.entries()) {
      if (count === 0) continue;
      await supabase.from('in_app_notifications').insert({
        user_id: userId,
        title: `${count} new tender${count > 1 ? 's' : ''} added today`,
        message: `${count} tender${count > 1 ? 's' : ''} matched your saved alerts. Tap to explore.`,
        link: `${siteUrl}/?tab=foryou&sort=newest`,
      });
      notifiedUsers++;
    }

    // 6. Mark all processed tenders as notified
    if (allTenders.length > 0) {
      const ids = allTenders.map(t => t.id);
      await supabase.from('tenders').update({ notification_sent: true }).in('id', ids);
    }

    console.log(`[CRON] Done. Tenders: ${allTenders.length} | Users notified: ${notifiedUsers}`);
    return NextResponse.json({ ok: true, tenders: allTenders.length, notifiedUsers });

  } catch (err: any) {
    console.error('[CRON] Fatal:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
