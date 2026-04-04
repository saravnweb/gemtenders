import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getStats() {
    console.log("\n📊 --- TENDER TRACK RECORD --- 📊\n");

    const { count: total, error: totalErr } = await supabase
        .from('tenders')
        .select('*', { count: 'estimated', head: true });

    if (totalErr) {
        console.error("❌ Error fetching total count:", totalErr.message);
    }

    // PDFs
    const { count: hasPdf, error: pdfErr } = await supabase
        .from('tenders')
        .select('*', { count: 'estimated', head: true })
        .not('pdf_url', 'is', null);

    const { count: missingPdf, error: missingPdfErr } = await supabase
        .from('tenders')
        .select('*', { count: 'estimated', head: true })
        .is('pdf_url', null);

    // AI Summaries
    const { count: hasAiSummary, error: aiErr } = await supabase
        .from('tenders')
        .select('*', { count: 'estimated', head: true })
        .not('ai_summary', 'is', null);

    // EMD amounts extracted
    const { count: hasEmd, error: emdErr } = await supabase
        .from('tenders')
        .select('*', { count: 'estimated', head: true })
        .not('emd_amount', 'is', null);

    // State & City coverage
    const { count: hasState, error: stateErr } = await supabase
        .from('tenders')
        .select('*', { count: 'estimated', head: true })
        .not('state', 'is', null);

    const { count: hasCity, error: cityErr } = await supabase
        .from('tenders')
        .select('*', { count: 'estimated', head: true })
        .not('city', 'is', null);

    // Enrichment attempts
    const { count: enrichmentTried, error: triedErr } = await supabase
        .from('tenders')
        .select('*', { count: 'estimated', head: true })
        .not('enrichment_tried_at', 'is', null);
    
    // Bid number validity
    const { count: nullBidNumber, error: bidErr } = await supabase
        .from('tenders')
        .select('*', { count: 'estimated', head: true })
        .is('bid_number', null);

    const missingState = (total || 0) - (hasState || 0);
    const missingCity  = (total || 0) - (hasCity  || 0);

    console.log(`✅ Total Tenders Found:       ${total ?? 0}`);
    console.log(`📄 Tenders with PDF URL:      ${hasPdf ?? 0} (${total ? Math.round((hasPdf || 0) / total * 100) : 0}%)`);
    console.log(`⏳ Missing PDF Link:           ${missingPdf ?? 0}`);
    console.log(`🤖 Tenders with AI Summary:   ${hasAiSummary ?? 0} (${total ? Math.round((hasAiSummary || 0) / total * 100) : 0}%)`);
    console.log(`🔄 Enrichment Tried:          ${enrichmentTried ?? 0} (${total ? Math.round((enrichmentTried || 0) / total * 100) : 0}%)`);
    console.log(`💰 Tenders with EMD Extracted:${hasEmd ?? 0} (${total ? Math.round((hasEmd || 0) / total * 100) : 0}%)`);
    console.log(`🗺️  Tenders with State:        ${hasState ?? 0} (${total ? Math.round((hasState || 0) / total * 100) : 0}%) | Missing: ${missingState}`);
    console.log(`🏙️  Tenders with City:         ${hasCity  ?? 0} (${total ? Math.round((hasCity  || 0) / total * 100) : 0}%) | Missing: ${missingCity}`);
    console.log(`🛑 Tenders with NULL Bid #:   ${nullBidNumber ?? 0}`);

    if (missingPdf && missingPdf > 0) {
        console.log(`\n💡 TIP: Run 'npm run enrich -- --limit=${Math.min(missingPdf, 20)}' to process PDFs & AI!`);
    } else if (hasPdf && hasPdf > (hasAiSummary || 0)) {
        console.log(`\n💡 TIP: You have PDFs but missing AI summaries. Ensure your extraction script parses them.`);
    } else {
        console.log(`\n🎉 All tenders are fully enriched!`);
    }
    console.log("\n-------------------------------\n");
}

getStats();
