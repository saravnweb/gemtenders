import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data } = await supabase.storage.from('tender-documents').list('', { limit: 3 });
if (!data?.length) { console.log('No files found'); process.exit(); }

for (const file of data) {
  const fileName = file.name;
  console.log('\nFile:', fileName, '| Size:', file.metadata?.size ?? 'unknown');

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  const url = `${base}/storage/v1/object/public/tender-documents/${fileName}`;
  console.log('URL:', url);

  const res = await fetch(url);
  console.log('Status:', res.status, '| Content-Type:', res.headers.get('content-type'));
  const buf = Buffer.from(await res.arrayBuffer());
  console.log('Size bytes:', buf.length);
  console.log('First 5 bytes (hex):', buf.slice(0, 5).toString('hex'), '← should be 255044462d for %PDF-');
}
