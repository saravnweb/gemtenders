/**
 * Cron: /api/cron/deadline-remind
 *
 * Runs daily (recommended: 8 AM IST via Vercel/external scheduler).
 * Finds tenders expiring in the next 24-48 hours and notifies:
 *   1. Users who explicitly saved the tender (saved_tenders)
 *   2. Users whose saved_searches keyword alerts match the tender
 *   3. Users who follow the tender's ministry / org / state (topic_follows)
 *
 * Deduplication: tracks every (user_id, tender_id) pair in `deadline_reminders`
 * so a user is never reminded about the same tender twice.
 *
 * In-app notification format:
 *   • Saved tender (1): "⏰ Closes tomorrow: [Title]"
 *   • Keyword/follow (1 match): "⏰ Closes tomorrow: [Title]"
 *   • Keyword/follow (N>1 matches): "⏰ N matched tenders close tomorrow"
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gemtenders.org';

  // ── 1. Find tenders closing in the next 24–48 hours ───────────────────────
  const now   = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { data: expiringTenders, error: tErr } = await supabase
    .from('tenders')
    .select(`
      id, bid_number, slug, title, department,
      ministry_name, department_name, organisation_name,
      state, city, ai_summary, relevant_categories, gemarpts_result, end_date
    `)
    .gte('end_date', in24h.toISOString())
    .lte('end_date', in48h.toISOString())
    .eq('is_archived', false);

  if (tErr) {
    console.error('[DEADLINE] tender query error:', tErr.message);
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }

  if (!expiringTenders?.length) {
    console.log('[DEADLINE] No tenders expiring in 24-48h.');
    return NextResponse.json({ ok: true, expiringTenders: 0, notificationsSent: 0 });
  }

  const tenderIds = expiringTenders.map(t => t.id);
  const tenderMap = new Map(expiringTenders.map(t => [t.id, t]));

  // ── 2. Load already-reminded pairs so we never double-notify ──────────────
  const { data: alreadyReminded } = await supabase
    .from('deadline_reminders')
    .select('user_id, tender_id')
    .in('tender_id', tenderIds);

  const remindedSet = new Set(
    (alreadyReminded ?? []).map(r => `${r.user_id}:${r.tender_id}`)
  );
  const notYetReminded = (userId: string, tenderId: string) =>
    !remindedSet.has(`${userId}:${tenderId}`);

  // ── 3. Load all data sources in parallel ──────────────────────────────────
  const [
    { data: savedTenders },
    { data: searches },
    { data: topicFollows },
  ] = await Promise.all([
    supabase
      .from('saved_tenders')
      .select('user_id, tender_id')
      .in('tender_id', tenderIds),
    supabase
      .from('saved_searches')
      .select('user_id, query_params, notification_frequency')
      .eq('is_alert_enabled', true),
    supabase
      .from('topic_follows')
      .select('user_id, follow_type, follow_value'),
  ]);

  // ── 4. Build reminder maps ─────────────────────────────────────────────────
  // savedReminderMap: user_id → tender_ids[] (from explicit saves)
  // matchReminderMap: user_id → Set<tender_id> (from keyword/topic matches)
  const savedReminderMap = new Map<string, string[]>();
  const matchReminderMap = new Map<string, Set<string>>();

  // Source A: saved_tenders
  for (const st of savedTenders ?? []) {
    if (!notYetReminded(st.user_id, st.tender_id)) continue;
    if (!savedReminderMap.has(st.user_id)) savedReminderMap.set(st.user_id, []);
    savedReminderMap.get(st.user_id)!.push(st.tender_id);
  }

  // Source B: saved_searches + topic_follows
  for (const tender of expiringTenders) {
    const textToSearch = [
      tender.title, tender.ai_summary, tender.relevant_categories,
      tender.gemarpts_result, tender.department,
      tender.ministry_name, tender.organisation_name, tender.department_name,
    ].filter(Boolean).join(' ').toLowerCase();

    // keyword alerts
    for (const search of searches ?? []) {
      // skip if 'off' (though 'off' = is_alert_enabled=false, extra guard)
      if ((search.notification_frequency ?? 'daily') === 'off') continue;
      if (!notYetReminded(search.user_id, tender.id)) continue;
      // skip if already in saved reminders for this user+tender
      if (savedReminderMap.get(search.user_id)?.includes(tender.id)) continue;

      const params = search.query_params || {};
      let matches = false;
      if (params.q) {
        const kws = params.q.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
        if (kws.length > 0) matches = kws.some((kw: string) => textToSearch.includes(kw));
      }
      if (matches && params.states?.length > 0) {
        if (!tender.state || !params.states.some((st: string) => st.toLowerCase() === tender.state.toLowerCase()))
          matches = false;
      }
      if (matches && params.cities?.length > 0) {
        if (!tender.city || !params.cities.some((ct: string) => tender.city?.toLowerCase().includes(ct.toLowerCase())))
          matches = false;
      }

      if (matches) {
        if (!matchReminderMap.has(search.user_id)) matchReminderMap.set(search.user_id, new Set());
        matchReminderMap.get(search.user_id)!.add(tender.id);
      }
    }

    // topic follows
    for (const follow of topicFollows ?? []) {
      if (!notYetReminded(follow.user_id, tender.id)) continue;
      if (savedReminderMap.get(follow.user_id)?.includes(tender.id)) continue;
      if (matchReminderMap.get(follow.user_id)?.has(tender.id)) continue;

      let isMatch = false;
      if (follow.follow_type === 'ministry' && tender.ministry_name)
        isMatch = tender.ministry_name.toLowerCase().includes(follow.follow_value.toLowerCase());
      else if (follow.follow_type === 'state' && tender.state)
        isMatch = tender.state.toLowerCase() === follow.follow_value.toLowerCase();
      else if (follow.follow_type === 'org' && tender.organisation_name)
        isMatch = tender.organisation_name.toLowerCase().includes(follow.follow_value.toLowerCase());

      if (isMatch) {
        if (!matchReminderMap.has(follow.user_id)) matchReminderMap.set(follow.user_id, new Set());
        matchReminderMap.get(follow.user_id)!.add(tender.id);
      }
    }
  }

  // ── 5. Build notification rows and reminder records ────────────────────────
  const inAppRows: object[] = [];
  const reminderRows: object[] = [];

  // From explicit saves — one notification per tender (high intent)
  for (const [userId, tIds] of savedReminderMap.entries()) {
    for (const tId of tIds) {
      const t = tenderMap.get(tId)!;
      inAppRows.push({
        user_id: userId,
        title: `⏰ Closes tomorrow: ${truncate(t.title, 60)}`,
        message: `A tender you saved is closing in less than 48 hours. Don't miss the deadline.`,
        link: `${siteUrl}/bids/${t.slug}`,
      });
      reminderRows.push({ user_id: userId, tender_id: tId });
    }
  }

  // From keyword/topic matches — grouped per user
  for (const [userId, tIdSet] of matchReminderMap.entries()) {
    const tIds = [...tIdSet];
    const count = tIds.length;

    if (count === 1) {
      const t = tenderMap.get(tIds[0])!;
      inAppRows.push({
        user_id: userId,
        title: `⏰ Closes tomorrow: ${truncate(t.title, 60)}`,
        message: `A tender matching your alerts is closing in less than 48 hours.`,
        link: `${siteUrl}/bids/${t.slug}`,
      });
    } else {
      inAppRows.push({
        user_id: userId,
        title: `⏰ ${count} matched tenders close tomorrow`,
        message: `${count} tenders from your alerts are closing in less than 48 hours. Tap to review.`,
        link: `${siteUrl}/?tab=foryou&sort=deadline`,
      });
    }

    for (const tId of tIds) {
      reminderRows.push({ user_id: userId, tender_id: tId });
    }
  }

  // ── 6. Persist ─────────────────────────────────────────────────────────────
  if (inAppRows.length > 0) {
    const { error: notifErr } = await supabase
      .from('in_app_notifications')
      .insert(inAppRows);
    if (notifErr) {
      console.error('[DEADLINE] notification insert error:', notifErr.message);
      return NextResponse.json({ error: notifErr.message }, { status: 500 });
    }
  }

  if (reminderRows.length > 0) {
    // ON CONFLICT DO NOTHING — safe to re-run
    const { error: remErr } = await supabase
      .from('deadline_reminders')
      .upsert(reminderRows, { onConflict: 'user_id,tender_id', ignoreDuplicates: true });
    if (remErr) {
      console.error('[DEADLINE] reminder record error:', remErr.message);
      // Non-fatal: notifications already sent; log and continue
    }
  }

  // ── 7. Summary ─────────────────────────────────────────────────────────────
  const summary = {
    expiringTenders: expiringTenders.length,
    savedTenderUsers: savedReminderMap.size,
    matchedAlertUsers: matchReminderMap.size,
    notificationsSent: inAppRows.length,
    reminderRecordsWritten: reminderRows.length,
  };
  console.log('[DEADLINE]', summary);
  return NextResponse.json({ ok: true, ...summary });
}
