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

    // 4. Aggregate matches by category
    // user_id → count of keyword-matched tenders
    const userKeywordCount = new Map<string, number>();
    // user_id → ministry_name → count
    const userMinistryCount = new Map<string, Map<string, number>>();
    // user_id → org_name → count
    const userOrgCount = new Map<string, Map<string, number>>();
    // user_id → state → count
    const userStateCount = new Map<string, Map<string, number>>();

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

      // Keyword alert matches
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

        if (matches) {
          userKeywordCount.set(search.user_id, (userKeywordCount.get(search.user_id) ?? 0) + 1);
        }
      }

      // Topic follow matches — grouped by follow_value per user
      for (const follow of topicFollows ?? []) {
        if (follow.follow_type === 'ministry' && tender.ministry_name) {
          if (tender.ministry_name.toLowerCase().includes(follow.follow_value.toLowerCase())) {
            if (!userMinistryCount.has(follow.user_id)) userMinistryCount.set(follow.user_id, new Map());
            const m = userMinistryCount.get(follow.user_id)!;
            m.set(follow.follow_value, (m.get(follow.follow_value) ?? 0) + 1);
          }
        } else if (follow.follow_type === 'org' && tender.organisation_name) {
          if (tender.organisation_name.toLowerCase().includes(follow.follow_value.toLowerCase())) {
            if (!userOrgCount.has(follow.user_id)) userOrgCount.set(follow.user_id, new Map());
            const m = userOrgCount.get(follow.user_id)!;
            m.set(follow.follow_value, (m.get(follow.follow_value) ?? 0) + 1);
          }
        } else if (follow.follow_type === 'state' && tender.state) {
          if (tender.state.toLowerCase() === follow.follow_value.toLowerCase()) {
            if (!userStateCount.has(follow.user_id)) userStateCount.set(follow.user_id, new Map());
            const m = userStateCount.get(follow.user_id)!;
            m.set(follow.follow_value, (m.get(follow.follow_value) ?? 0) + 1);
          }
        }
      }
    }

    // 5. Build grouped notifications
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gemtenders.org';
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    });
    const notifications: object[] = [];

    // One notification for all keyword alert matches
    for (const [userId, count] of userKeywordCount.entries()) {
      notifications.push({
        user_id: userId,
        title: `${count} tender${count > 1 ? 's' : ''} matched your alerts`,
        message: `${count} new tender${count > 1 ? 's' : ''} matched your keyword alerts on ${today}. Tap to explore.`,
        link: `${siteUrl}/?tab=foryou&sort=newest`,
      });
    }

    // One notification per ministry the user follows
    for (const [userId, ministries] of userMinistryCount.entries()) {
      for (const [ministry, count] of ministries.entries()) {
        notifications.push({
          user_id: userId,
          title: `${count} new tender${count > 1 ? 's' : ''} in ${ministry}`,
          message: `${count} tender${count > 1 ? 's' : ''} added to ${ministry} on ${today}.`,
          link: `${siteUrl}/?q=${encodeURIComponent(ministry)}`,
        });
      }
    }

    // One notification per organisation the user follows
    for (const [userId, orgs] of userOrgCount.entries()) {
      for (const [org, count] of orgs.entries()) {
        notifications.push({
          user_id: userId,
          title: `${count} new tender${count > 1 ? 's' : ''} from ${org}`,
          message: `${count} tender${count > 1 ? 's' : ''} published by ${org} on ${today}.`,
          link: `${siteUrl}/?q=${encodeURIComponent(org)}`,
        });
      }
    }

    // One notification per state the user follows
    for (const [userId, states] of userStateCount.entries()) {
      for (const [state, count] of states.entries()) {
        notifications.push({
          user_id: userId,
          title: `${count} new tender${count > 1 ? 's' : ''} in ${state}`,
          message: `${count} tender${count > 1 ? 's' : ''} added in ${state} on ${today}.`,
          link: `${siteUrl}/?q=${encodeURIComponent(state)}`,
        });
      }
    }

    // 6. Bulk insert
    if (notifications.length > 0) {
      const { error: insertError } = await supabase.from('in_app_notifications').insert(notifications);
      if (insertError) throw new Error(insertError.message);
    }

    // 7. Mark all processed tenders as notified
    if (allTenders.length > 0) {
      await supabase.from('tenders').update({ notification_sent: true }).in('id', allTenders.map(t => t.id));
    }

    const summary = {
      tenders: allTenders.length,
      notificationsInserted: notifications.length,
      keywordUsers: userKeywordCount.size,
      ministryNotifications: [...userMinistryCount.values()].reduce((a, m) => a + m.size, 0),
      orgNotifications: [...userOrgCount.values()].reduce((a, m) => a + m.size, 0),
      stateNotifications: [...userStateCount.values()].reduce((a, m) => a + m.size, 0),
    };
    console.log('[CRON] Done.', summary);
    return NextResponse.json({ ok: true, ...summary });

  } catch (err: any) {
    console.error('[CRON] Fatal:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
