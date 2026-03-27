import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { count: total } = await sb.from('tenders').select('*', { count: 'exact', head: true });
const { count: enriched } = await sb.from('tenders').select('*', { count: 'exact', head: true }).not('ai_summary', 'is', null);
const { count: needWork } = await sb.from('tenders').select('*', { count: 'exact', head: true }).is('ai_summary', null).gte('end_date', new Date().toISOString());

console.log('Total tenders:', total);
console.log('Have ai_summary:', enriched);
console.log('Need enrichment (active, no ai_summary):', needWork);

const { data: sample } = await sb.from('tenders').select('bid_number, ai_summary, enrichment_tried_at, end_date').order('created_at', { ascending: false }).limit(8);
console.log('\nLatest 8 in DB:');
sample?.forEach(r => console.log(' ', r.bid_number, '| ai_summary:', r.ai_summary ? 'SET' : 'NULL', '| tried_at:', r.enrichment_tried_at ? 'SET' : 'NULL', '| end:', r.end_date?.slice(0,10)));
