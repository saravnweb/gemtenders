import { supabase } from '../supabase';
import { extractTenderData } from '../gemini';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export async function runEnrichment(limit: number = 20) {
  console.log(`\n>>> [ENRICHER] Starting enrichment run. Processing up to ${limit} tenders...\n`);

  const { data: pendingTenders, error } = await supabase
    .from('tenders')
    .select('id, bid_number, details_url')
    .is('pdf_url', null)
    .order('created_at', { ascending: true })
    .limit(limit);

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

  for (const tender of pendingTenders) {
    const pdfLink = tender.details_url || `https://bidplus.gem.gov.in/showbiddata/${tender.bid_number}`;
    let pdfPublicUrl: string | null = null;
    let aiData: any = null;

    try {
      let buffer: Buffer | undefined;
      const downloadPage = await context.newPage();

      try {
        const downloadPromise = downloadPage.waitForEvent('download', { timeout: 15000 });
        const gotoPromise = downloadPage.goto(pdfLink, { waitUntil: 'load', timeout: 15000 });
        
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
      } catch (e) {
        // Fallback
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

        const parserFunc = typeof pdf === 'function' ? pdf : (pdf as any).default;
        const textData = await parserFunc(buffer);
        const extractedText = textData.text || '';

        if (extractedText.length > 50) {
          aiData = await extractTenderData(extractedText);
        }

        const auth = aiData?.authority;
        const updatePayload: any = { pdf_url: pdfPublicUrl };

        if (aiData) {
          updatePayload.title = aiData.tender_title;
          updatePayload.ministry_name = auth?.ministry;
          updatePayload.department_name = auth?.department;
          updatePayload.organisation_name = auth?.organisation;
          updatePayload.office_name = auth?.office;
          updatePayload.state = auth?.state;
          updatePayload.city = auth?.city;
          updatePayload.emd_amount = aiData.emd_amount;
          updatePayload.quantity = aiData.quantity;
          updatePayload.ai_summary = aiData.technical_summary;
          updatePayload.opening_date = aiData.dates?.bid_opening_date;
        }

        await supabase.from('tenders').update(updatePayload).eq('id', tender.id);
        successCount++;
      }
    } catch (err) {
      console.error(err);
    }
  }

  await browser.close();
  return { success: true, processed: successCount };
}
