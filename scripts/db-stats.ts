import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const { supabase } = await import('../lib/supabase');

async function getStats() {
    console.log("\n📊 --- TENDER TRACK RECORD --- 📊\n");

    const { count: total } = await supabase
        .from('tenders')
        .select('*', { count: 'exact', head: true });

    // PDFs
    const { count: hasPdf } = await supabase
        .from('tenders')
        .select('*', { count: 'exact', head: true })
        .not('pdf_url', 'is', null);

    const { count: missingPdf } = await supabase
        .from('tenders')
        .select('*', { count: 'exact', head: true })
        .is('pdf_url', null);

    // AI Summaries
    const { count: hasAiSummary } = await supabase
        .from('tenders')
        .select('*', { count: 'exact', head: true })
        .not('ai_summary', 'is', null);

    // EMD amounts extracted
    const { count: hasEmd } = await supabase
        .from('tenders')
        .select('*', { count: 'exact', head: true })
        .not('emd_amount', 'is', null);

    console.log(`✅ Total Tenders Found:    ${total || 0}`);
    console.log(`📄 Tenders with PDF URL:   ${hasPdf || 0} (${total ? Math.round((hasPdf || 0) / total * 100) : 0}%)`);
    console.log(`⏳ Missing PDF Link:       ${missingPdf || 0}`);
    console.log(`🤖 Tenders with AI Summary:${hasAiSummary || 0} (${total ? Math.round((hasAiSummary || 0) / total * 100) : 0}%)`);
    console.log(`💰 Tenders with EMD Extracted: ${hasEmd || 0} (${total ? Math.round((hasEmd || 0) / total * 100) : 0}%)`);

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
