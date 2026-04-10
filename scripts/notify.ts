import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const args = process.argv.slice(2);
const LIMIT   = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5000', 10);
const DRY_RUN = args.includes('--dry-run');
const BATCH   = 100;

async function runNotifications() {
  const { triggerKeywordNotifications } = await import('../lib/notifications');

  console.log(`\n>>> [NOTIFY] Starting notification run.`);
  console.log(`    Limit: ${LIMIT} | Dry-run: ${DRY_RUN}\n`);

  let totalProcessed = 0, totalNotified = 0, offset = 0;

  while (totalProcessed < LIMIT) {
    const pageSize = Math.min(BATCH, LIMIT - totalProcessed);

    const { data: tenders, error } = await supabase
      .from('tenders')
      .select(`
        id, bid_number, slug, title, department,
        ministry_name, department_name, organisation_name, office_name,
        state, city, emd_amount, end_date, ai_summary,
        relevant_categories, gemarpts_result
      `)
      .eq('notification_sent', false)
      .not('ai_summary', 'is', null)
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) { console.error('[NOTIFY] DB error:', error.message); break; }
    if (!tenders?.length) { console.log('[NOTIFY] No pending tenders.'); break; }

    console.log(`>>> [NOTIFY] Batch of ${tenders.length}...`);

    for (const tender of tenders) {
      totalProcessed++;

      if (DRY_RUN) {
        console.log(`    [DRY-RUN] ${tender.bid_number} (state: ${tender.state ?? 'null'}, city: ${tender.city ?? 'null'})`);
        continue;
      }

      try {
        await triggerKeywordNotifications(tender, { skipInApp: true });

        const { error: upErr } = await supabase
          .from('tenders')
          .update({ notification_sent: true })
          .eq('id', tender.id);

        if (upErr) {
          console.error(`    ✗ Failed to mark ${tender.bid_number}:`, upErr.message);
        } else {
          console.log(`    ✓ ${tender.bid_number} (state: ${tender.state ?? '–'}, city: ${tender.city ?? '–'})`);
          totalNotified++;
        }
      } catch (e: any) {
        console.error(`    ✗ ${tender.bid_number}:`, e.message);
        // notification_sent stays false → retries next run
      }
    }

    offset += tenders.length;
    if (tenders.length < pageSize) break;
  }

  console.log(`\n>>> [NOTIFY] Done. Processed: ${totalProcessed} | Notified: ${totalNotified}`);

  // ── RA notification pass ───────────────────────────────────────────────────
  // Fetch tenders with an active RA that haven't been RA-notified yet
  console.log(`\n>>> [NOTIFY] Running RA notification pass...`);
  let raNotified = 0;

  const { data: raTenders, error: raErr } = await supabase
    .from('tenders')
    .select(`
      id, bid_number, slug, title, department,
      ministry_name, department_name, organisation_name, office_name,
      state, city, emd_amount, end_date, ai_summary,
      ra_number, ra_end_date
    `)
    .not('ra_number', 'is', null)
    .eq('ra_notified', false)
    .gte('ra_end_date', new Date().toISOString());

  if (raErr) {
    console.error('[NOTIFY] RA query error:', raErr.message);
  } else if (!raTenders?.length) {
    console.log('[NOTIFY] No pending RA notifications.');
  } else {
    console.log(`>>> [NOTIFY] ${raTenders.length} tenders with active RAs to notify.`);
    for (const tender of raTenders) {
      if (DRY_RUN) {
        console.log(`    [DRY-RUN] RA for ${tender.bid_number} → RA: ${tender.ra_number} closes ${tender.ra_end_date}`);
        continue;
      }
      try {
        await triggerKeywordNotifications(tender, { urgent: true, skipInApp: true });
        const { error: upErr } = await supabase
          .from('tenders')
          .update({ ra_notified: true })
          .eq('id', tender.id);
        if (upErr) {
          console.error(`    ✗ Failed to mark RA notified for ${tender.bid_number}:`, upErr.message);
        } else {
          console.log(`    ✓ RA notification sent: ${tender.bid_number} → ${tender.ra_number}`);
          raNotified++;
        }
      } catch (e: any) {
        console.error(`    ✗ RA ${tender.bid_number}:`, e.message);
      }
    }
    console.log(`>>> [NOTIFY] RA pass done. Notified: ${raNotified}`);
  }
}

runNotifications().catch(console.error);
