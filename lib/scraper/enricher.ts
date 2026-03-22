import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
import { extractTenderData } from '../gemini';
import { triggerKeywordNotifications } from '../notifications';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { normalizeState, normalizeCity } from '../locations';
import { parseGeMDate } from './gem-scraper';


export async function runEnrichment(limit: number = 20, reprocess: boolean = false) {
  console.log(`\n>>> [ENRICHER] Starting enrichment run. Processing up to ${limit} tenders...\n`);

  let query = supabase
    .from('tenders')
    .select('id, bid_number, details_url')
    .is('pdf_url', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!reprocess) {
    query = query.gte('end_date', new Date().toISOString());
  }

  const { data: pendingTenders, error } = await query;

  if (error || !pendingTenders || pendingTenders.length === 0) {
    return { success: true, processed: 0, message: "No pending tenders found." };
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-gpu'
    ],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  let successCount = 0;
  const CONCURRENCY = 1; // Download and AI process 1 PDF at a time locally to prevent socket timeout
  const chunks = [];
  for (let i = 0; i < pendingTenders.length; i += CONCURRENCY) {
    chunks.push(pendingTenders.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (tender) => {
    const pdfLink = tender.details_url || `https://bidplus.gem.gov.in/showbiddata/${tender.bid_number}`;
    let pdfPublicUrl: string | null = null;
    let aiData: any = null;

    try {
      let buffer: Buffer | undefined;
      const downloadPage = await context.newPage();

      try {
        let downloadPromise = downloadPage.waitForEvent('download', { timeout: 15000 });
        let gotoPromise = downloadPage.goto(pdfLink, { waitUntil: 'load', timeout: 15000 }).catch(e => {
          // Playwright intentionally aborts navigation if it results in a download
          return null;
        });
        
        const result = await Promise.race([
          downloadPromise.then(d => ({ type: 'download', data: d })),
          gotoPromise.then(() => ({ type: 'page' }))
        ]);

        if (result.type === 'download' && 'data' in result) {
          const download = result.data as any;
          const tempPath = path.join(process.cwd(), 'tmp', `admin_enr_${tender.bid_number.replace(/\//g, '-')}.pdf`);
          await download.saveAs(tempPath);
          buffer = fs.readFileSync(tempPath);
          fs.unlinkSync(tempPath);
        } else {
          const response = await context.request.get(pdfLink).catch(() => null);
          if (response) {
            const contentType = response.headers()['content-type'] || '';
            const body = await response.body();
            if (contentType.includes('pdf')) buffer = Buffer.from(body);
          }
        }
      } catch (e: any) {
        // Fallback
        const response = await context.request.get(pdfLink).catch(() => null);
        if (response) {
          const contentType = response.headers()['content-type'] || '';
          const body = await response.body();
          if (contentType.includes('pdf')) buffer = Buffer.from(body);
        }
      } finally {
        await downloadPage.close();
      }

      if (buffer && buffer.length > 1000) {
        const fileName = `${tender.bid_number.replace(/\//g, '-')}.pdf`;
        const { data: uploadData } = await supabase.storage
          .from('tender-documents')
          .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

        if (uploadData) {
          const { data: urlData } = supabase.storage.from('tender-documents').getPublicUrl(uploadData.path);
          pdfPublicUrl = urlData.publicUrl;
        }

        const _lib: any = await import('pdf-parse');
        const pdfLib = _lib.default || _lib;
        const ParserClass = pdfLib.PDFParse || pdfLib;
        
        let extractedText = '';
        if (typeof ParserClass === 'function' && ParserClass.toString().includes('class')) {
          const instance = new ParserClass({ data: buffer, max: 5 });
          const result = await instance.getText();
          extractedText = result.text || '';
          await instance.destroy?.();
        } else {
          const fn = typeof pdfLib === 'function' ? pdfLib : pdfLib.default;
          const textData = await fn(buffer, { max: 5 });
          extractedText = textData.text || '';
        }

        if (extractedText.length > 50) {
          aiData = await extractTenderData(extractedText.substring(0, 6000));
        }

        const auth = aiData?.authority;
        const updatePayload: any = { pdf_url: pdfPublicUrl };

        if (aiData) {
          updatePayload.title = aiData.tender_title;
          updatePayload.ministry_name = auth?.ministry;
          updatePayload.department_name = auth?.department;
          updatePayload.organisation_name = auth?.organisation;
          updatePayload.office_name = auth?.office;
          updatePayload.state = normalizeState(auth?.consignee_state || auth?.state);
          updatePayload.city = normalizeCity(auth?.consignee_city || auth?.city);
          updatePayload.emd_amount = aiData.emd_amount;
          updatePayload.quantity = aiData.quantity;
          updatePayload.ai_summary = aiData.technical_summary;
          if (aiData.dates) {
            if (aiData.dates.bid_opening_date) updatePayload.opening_date = parseGeMDate(aiData.dates.bid_opening_date) || aiData.dates.bid_opening_date;
            if (aiData.dates.bid_start_date) updatePayload.start_date = parseGeMDate(aiData.dates.bid_start_date) || aiData.dates.bid_start_date;
            if (aiData.dates.bid_end_date) updatePayload.end_date = parseGeMDate(aiData.dates.bid_end_date) || aiData.dates.bid_end_date;
          }
        }

        const nowMs = Date.now();
        if (updatePayload.end_date && new Date(updatePayload.end_date).getTime() < nowMs) {
          console.warn(`    ! DB discovered expired date ${updatePayload.end_date} for ${tender.bid_number}. Deleting...`);
          await supabase.from('tenders').delete().eq('id', tender.id);
          successCount++;
          return;
        }

        await supabase.from('tenders').update(updatePayload).eq('id', tender.id);
        
        // Trigger user keyword notifications (future integration)
        await triggerKeywordNotifications({
          id: tender.id,
          bid_number: tender.bid_number,
          ...updatePayload
        });

        successCount++;
      }
    } catch (err) {
      console.error(`    ✗ Error scraping ${tender.bid_number}:`, err);
    }
  }));
}

  await browser.close();
  return { success: true, processed: successCount };
}
