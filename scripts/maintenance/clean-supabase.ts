import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAndCleanCandidates() {
  console.log("Fetching all tenders from Supabase...");
  // Use pagination if there are more than 5000, but limit to 10000 for safety
  const { data, error } = await supabase
    .from('tenders')
    .select('id, title, bid_number, start_date, end_date, department, slug')
    .limit(10000);

  if (error) {
      console.error("Error fetching data:", error);
      return;
  }
  
  if (!data) return;

  const anomalies = {
      missingOrGenericTitle: [] as any[],
      identicalDates: [] as any[],
      missingDates: [] as any[],
      missingBidNumber: [] as any[],
      allBad: [] as any[]
  };

  data.forEach(t => {
      let isBad = false;
      const titleLower = t.title?.toLowerCase().trim() || '';
      
      const noTitle = !t.title || titleLower === '' || titleLower === 'not available' || titleLower === 'tender';
      if (noTitle) { anomalies.missingOrGenericTitle.push(t); isBad = true; }

      const idenDates = t.start_date && t.end_date && t.start_date === t.end_date;
      if (idenDates) { anomalies.identicalDates.push(t); isBad = true; }

      const missDates = !t.start_date || !t.end_date || t.start_date.includes('1970-01-01') || t.end_date.includes('1970-01-01');
      if (missDates) { anomalies.missingDates.push(t); isBad = true; }

      const missBid = !t.bid_number || t.bid_number.trim() === '' || t.bid_number.toLowerCase().includes('not available');
      if (missBid) { anomalies.missingBidNumber.push(t); isBad = true; }

      if (isBad) {
          if (!anomalies.allBad.find(b => b.id === t.id)) {
              anomalies.allBad.push(t);
          }
      }
  });

  console.log("--- Report ---");
  console.log("Total records fetched:", data.length);
  console.log("Records with missing/generic title:", anomalies.missingOrGenericTitle.length);
  console.log("Records with identical start and end dates (likely parsing error):", anomalies.identicalDates.length);
  console.log("Records with missing/1970 dates:", anomalies.missingDates.length);
  console.log("Records with missing bid number:", anomalies.missingBidNumber.length);
  console.log("Total Unique Bad Records:", anomalies.allBad.length);

  fs.writeFileSync('tmp-bad-tenders.json', JSON.stringify(anomalies.allBad, null, 2));
  console.log("Saved all bad records to tmp-bad-tenders.json");
  
  // Clean them up right now
  if (anomalies.allBad.length > 0) {
      console.log(`Deleting ${anomalies.allBad.length} bad records...`);
      const chunks = [];
      let i = 0;
      while (i < anomalies.allBad.length) {
          chunks.push(anomalies.allBad.slice(i, i + 100));
          i += 100;
      }

      for (const chunk of chunks) {
          const ids = chunk.map((c: any) => c.id);
          const { error } = await supabase.from('tenders').delete().in('id', ids);
          if (error) {
              console.error("Error deleting a chunk:", error);
          } else {
              console.log(`Deleted chunk of ${ids.length} records`);
          }
      }
      console.log("Clean up complete!");
  } else {
      console.log("No bad records to clean.");
  }
}

findAndCleanCandidates();
