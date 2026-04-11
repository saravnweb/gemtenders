
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { extractTenderDataGroq } from '../../lib/groq-ai.js';
import { normalizeState, isIndianState } from '../../lib/locations-client.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET = 'tender-documents';

async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result?.text ?? '';
  } finally {
    await parser.destroy?.();
  }
}

function extractViaRegex(text: string) {
    // Regexes to extract from the standard GeM Bid block
    const ministryMatch = text.match(/Ministry\/State\s+Name\s+([A-Za-z\s&,]+?)(?=\n|\r| \/| \/|$)/i);
    const deptMatch = text.match(/Department\s+Name\s+([A-Za-z\s&,]+?)(?=\n|\r| \/| \/|$)/i);
    const orgMatch = text.match(/Organisation\s+Name\s+([A-Za-z\s&,]+?)(?=\n|\r| \/| \/|$)/i);

    return {
        ministry: ministryMatch ? ministryMatch[1].trim() : null,
        department: deptMatch ? deptMatch[1].trim() : null,
        organisation: orgMatch ? orgMatch[1].trim() : null
    };
}

async function fixMinistryTruncation() {
    console.log("\n>>> [FIX-MINISTRY-TRUNCATION] Starting correction process...\n");

    const { data: tenders, error } = await supabase
        .from('tenders')
        .select('id, bid_number, ministry_name, organisation_name, department_name, pdf_url, state')
        .or('ministry_name.ilike.Ministry of ,ministry_name.eq.Ministry of');

    if (error) {
        console.error("❌ Error fetching tenders:", error.message);
        return;
    }

    if (!tenders || tenders.length === 0) {
        console.log("✅ No incomplete ministries found.");
        return;
    }

    console.log(`🔍 Found ${tenders.length} tenders with incomplete "Ministry of" name.`);
    console.log("------------------------------------------------------------");

    let fixedCount = 0;

    for (const tender of tenders) {
        console.log(`\n📄 Processing [${tender.bid_number}]...`);
        
        if (!tender.pdf_url) {
            console.log(`   ⚠️ No PDF URL available. Skipping.`);
            continue;
        }

        const fileName = tender.bid_number.replace(/\//g, '-') + '.pdf';
        
        try {
            const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(fileName);
            if (dlErr || !blob) {
                console.log(`   ❌ Download failed.`);
                continue;
            }

            const buffer = Buffer.from(await blob.arrayBuffer());
            const pdfText = await parsePdf(buffer);
            
            if (pdfText.length < 50) {
                console.log(`   ⚠️ No text extraction possible.`);
                continue;
            }

            const regexData = extractViaRegex(pdfText);
            console.log(`   📝 Regex Match: Ministry="${regexData.ministry || '-'}" | Dept="${regexData.department || '-'}"`);

            let finalMinistry: string | null = null;
            let finalDept = regexData.department;
            let finalOrg = regexData.organisation;
            let finalState = tender.state;

            if (regexData.ministry && regexData.ministry.toLowerCase() !== 'ministry of') {
                if (isIndianState(regexData.ministry)) {
                    finalState = normalizeState(regexData.ministry);
                    finalMinistry = null;
                } else {
                    finalMinistry = regexData.ministry;
                }
            }

            // Fallback to AI
            if (!finalMinistry && !finalState) {
                console.log(`   🧠 Falling back to AI...`);
                const aiData = await extractTenderDataGroq(pdfText);
                if (aiData?.authority) {
                    const aiMin = aiData.authority.ministry;
                    if (aiMin && aiMin.toLowerCase() !== 'ministry of') {
                        if (isIndianState(aiMin)) {
                            finalState = normalizeState(aiMin);
                            finalMinistry = null;
                        } else {
                            finalMinistry = aiMin;
                        }
                    }
                    if (!finalDept) finalDept = aiData.authority.department;
                    if (!finalOrg) finalOrg = aiData.authority.organisation;
                }
            }

            // If Ministry was "Ministry of", we definitely want to change it, 
            // even if the new ministry is null (because it's a state tender).
            const isTruncated = tender.ministry_name?.toLowerCase().trim() === 'ministry of';
            const ministryChanged = isTruncated; // If it was "Ministry of", it's ALWAYS a change to anything else or null
            const stateChanged = finalState !== tender.state;
            const deptChanged = finalDept && finalDept !== tender.department_name && finalDept !== 'N/a';

            if (ministryChanged || stateChanged || deptChanged) {
                console.log(`   ✨ RESOLVED: Ministry="${finalMinistry || '-'}" | State="${finalState || tender.state}" | Dept="${finalDept || '-'}"`);
                
                const update: any = {
                    ministry_name: finalMinistry || null,
                    state: finalState || tender.state,
                    department_name: finalDept || tender.department_name,
                    organisation_name: finalOrg || tender.organisation_name
                };

                const { error: upErr } = await supabase.from('tenders').update(update).eq('id', tender.id);

                if (upErr) {
                    console.log(`   ❌ DB Error: ${upErr.message}`);
                } else {
                    console.log(`   ✅ UPDATED.`);
                    fixedCount++;
                }
            } else {
                console.log(`   ⚠️ Could not resolve better name.`);
            }

        } catch (e: any) {
            console.error(`   💥 Error: ${e.message}`);
        }
    }

    console.log("\n============================================================");
    console.log(`🏁 FINISHED. Fixed ${fixedCount} out of ${tenders.length}.`);
    console.log("============================================================\n");
}

fixMinistryTruncation();
