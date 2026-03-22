import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

import { createClient } from '@supabase/supabase-js';
import { detectCategory } from '../lib/categories';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Extract extra text signals from the stored ai_summary JSON */
function extractAiSummaryText(ai_summary: string | null): string {
  if (!ai_summary) return '';
  try {
    const parsed = JSON.parse(ai_summary);
    // Pull the most useful classification signals from the AI summary JSON
    return [
      parsed['ITEM CATEGORY'],
      parsed['AI_INSIGHT'],
      parsed['insight'],
      parsed['CONSIGNEES/REPORTING OFFICER AND QUANTITY'],
    ].filter(Boolean).join(' ');
  } catch {
    return ai_summary; // raw string fallback
  }
}

function detectBidType(bidNo: string, title: string): string {
  if (/\/RA\//i.test(bidNo) || /reverse\s*auction/i.test(title)) return 'Reverse Auction';
  if (/custom\s*bid/i.test(title)) return 'Custom Bid';
  return 'Open Bid';
}

async function categorizeTenders() {
  console.log(`\n>>> [CATEGORIZER] Starting local categorization of all tenders.`);

  let offset = 0;
  const PAGE_SIZE = 1000;
  const CHUNK = 200;
  let totalTenders = 0;
  let totalCategorized = 0;
  let totalUncategorized = 0;

  while (true) {
    const { data: tenders, error } = await supabase
      .from('tenders')
      .select('id, bid_number, title, ai_summary')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching tenders:', error.message);
      break;
    }

    if (!tenders || tenders.length === 0) break;

    console.log(`\nProcessing batch of ${tenders.length} tenders...`);
    totalTenders += tenders.length;

    const categoryGroups = new Map<string, string[]>();
    const bidTypeGroups = new Map<string, string[]>();
    let batchCategorized = 0;
    let batchUncategorized = 0;

    for (const tender of tenders) {
      const bidType = detectBidType(tender.bid_number || '', tender.title || '');

      // Pass 1: title + raw ai_summary
      let categoryId = detectCategory(`${tender.title} ${tender.ai_summary || ''}`);

      // Pass 2: extract structured fields from ai_summary JSON for a richer signal
      if (!categoryId) {
        const aiText = extractAiSummaryText(tender.ai_summary);
        if (aiText) categoryId = detectCategory(`${tender.title} ${aiText}`);
      }

      if (categoryId) {
        if (!categoryGroups.has(categoryId)) categoryGroups.set(categoryId, []);
        categoryGroups.get(categoryId)!.push(tender.id);
        batchCategorized++;
      } else {
        batchUncategorized++;
      }

      if (!bidTypeGroups.has(bidType)) bidTypeGroups.set(bidType, []);
      bidTypeGroups.get(bidType)!.push(tender.id);
    }

    // Update categories in chunks of 200
    let batchUpdated = 0;
    for (const [categoryId, ids] of categoryGroups.entries()) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { error: err } = await supabase.from('tenders').update({ category: categoryId }).in('id', chunk);
        if (err) console.error(`  Error updating category ${categoryId}:`, err.message);
        else batchUpdated += chunk.length;
      }
    }

    // Update bid_type in chunks of 200
    for (const [bidType, ids] of bidTypeGroups.entries()) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { error: err } = await supabase.from('tenders').update({ bid_type: bidType }).in('id', chunk);
        if (err) console.error(`  Error updating bid_type ${bidType}:`, err.message);
      }
    }

    totalCategorized += batchUpdated;
    totalUncategorized += batchUncategorized;
    console.log(`  Categorized: ${batchCategorized} | Uncategorized: ${batchUncategorized} | DB updated: ${batchUpdated}`);

    offset += PAGE_SIZE;
  }

  console.log(`\n>>> [CATEGORIZER] Done.`);
  console.log(`    Total tenders : ${totalTenders}`);
  console.log(`    Categorized   : ${totalCategorized}`);
  console.log(`    Uncategorized : ${totalUncategorized} (titles too generic to match — will be AI-classified on next crawl)`);
}

categorizeTenders().catch(console.error);
