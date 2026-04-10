import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const credsStr = process.env.GOOGLE_INDEXING_CREDENTIALS;
if (!credsStr) {
  console.log('No GOOGLE_INDEXING_CREDENTIALS found');
  process.exit(1);
}

try {
  const creds = JSON.parse(credsStr);
  console.log('JSON Parse: SUCCESS');
  console.log('Client Email:', creds.client_email);
  console.log('Private Key length:', creds.private_key?.length);
  console.log('Contains literal newlines (\\n):', creds.private_key?.includes('\n'));
  console.log('Contains slash-n (\\\\n):', creds.private_key?.includes('\\n'));
  
  if (creds.private_key && creds.private_key.includes('\\n')) {
    console.log('FIX NEEDED: Private key contains literal \\n characters.');
  }
} catch (e: any) {
  console.log('JSON Parse: FAILED');
  console.log('Error:', e.message);
}
