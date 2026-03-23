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
        await triggerKeywordNotifications(tender);

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
}

runNotifications().catch(console.error);
