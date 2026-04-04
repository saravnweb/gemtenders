/**
 * Supabase Storage Cleanup Script
 * 
 * Deletes all files in the 'tender-documents' bucket to free up space.
 * 
 * Usage:
 *   npx tsx scripts/maintenance/cleanup-storage-pdfs.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET_NAME = 'tender-documents';

async function main() {
  console.log(`\n🧹 [CLEANUP] Starting cleanup for bucket "${BUCKET_NAME}"...`);

  let totalDeleted = 0;
  let batchCount = 0;

  while (true) {
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 100 });

    if (listError) {
      console.error(`❌ Error listing files: ${listError.message}`);
      break;
    }

    if (!files || files.length === 0) {
      console.log(`\n✅ Done! No more files found in "${BUCKET_NAME}".`);
      break;
    }

    const filePaths = files.map(f => f.name);
    const { data: deleted, error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error(`❌ Error deleting batch: ${deleteError.message}`);
      break;
    }

    totalDeleted += deleted?.length || 0;
    batchCount++;
    process.stdout.write(`\r   Deleted: ${totalDeleted} files across ${batchCount} batches...`);
  }

  console.log(`\n\n🎉 Cleanup complete. Freed up space from ${totalDeleted} files.\n`);
}

main().catch(console.error);
