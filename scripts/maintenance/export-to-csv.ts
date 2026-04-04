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

async function exportAllTenders() {
  console.log("Fetching all open tenders from the database to export...");
  
  let allTenders: any[] = [];
  let page = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('tenders')
      .select('bid_number, title, department, state, start_date, end_date, details_url')
      .order('end_date', { ascending: true })
      .range(page * limit, (page + 1) * limit - 1);
      
    if (error) {
      console.error("Error fetching tenders:", error);
      break;
    }
    
    if (!data || data.length === 0) {
        break;
    }
    
    allTenders = allTenders.concat(data);
    page++;
    console.log(`Fetched ${allTenders.length} tenders...`);
  }
  
  console.log(`Total active tenders fetched: ${allTenders.length}`);
  
  // Create CSV content
  const headers = ['Bid Number', 'Title', 'Department', 'State', 'Start Date', 'End Date', 'Link'];
  
  // Escape CSV rules: wrap in quotes and escape internal quotes by doubling them
  function escapeCSV(val: any) {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  
  const csvRows = allTenders.map(t => [
      escapeCSV(t.bid_number),
      escapeCSV(t.title),
      escapeCSV(t.department),
      escapeCSV(t.state),
      escapeCSV(t.start_date),
      escapeCSV(t.end_date),
      escapeCSV(t.details_url)
  ].join(','));
  
  const csvContent = [headers.join(','), ...csvRows].join('\n');
  
  fs.writeFileSync('tenders_cross_check.csv', csvContent);
  console.log("Export complete! File saved as 'tenders_cross_check.csv'");
}

exportAllTenders();
