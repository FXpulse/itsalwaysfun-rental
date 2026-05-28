// Off-cloud backup upload to Cloudflare R2 (or any S3-compatible bucket).
// Called by /api/cron/weekly-backup AFTER the JSON is uploaded to Supabase
// Storage, so we have backups in TWO independent places. If the Supabase
// project is ever lost, the R2 copy is the survivor.
//
// Setup (one-time):
//   1. Cloudflare Dashboard → R2 → Create Bucket (name: rentalflow-backups)
//   2. R2 → Manage R2 API Tokens → Create Token
//      Permissions: Object Read & Write, only for the rentalflow-backups bucket
//   3. Copy the credentials, set as Vercel env vars:
//        R2_ACCOUNT_ID         (found in R2 dashboard sidebar)
//        R2_ACCESS_KEY_ID      (from token creation)
//        R2_SECRET_ACCESS_KEY  (from token creation)
//        R2_BUCKET             (the bucket name you created)
//   4. Redeploy. Next weekly backup will push to R2 too.
//
// If env vars aren't set: this function returns { skipped: true } and the
// weekly backup keeps working with just the Supabase Storage copy.

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function getClient(): S3Client | null {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export interface R2UploadResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  bucket?: string;
  key?: string;
}

/** Upload the backup JSON to R2. Idempotent: overwrites if key exists. */
export async function uploadBackupToR2(
  filename: string,
  data: Buffer | Uint8Array,
): Promise<R2UploadResult> {
  const bucket = process.env.R2_BUCKET;
  const c = getClient();
  if (!c || !bucket) {
    return { ok: true, skipped: true, reason: "R2 env vars not configured" };
  }

  try {
    await c.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: filename,
        Body: data,
        ContentType: "application/json",
        Metadata: {
          source: "weekly-backup-cron",
          uploaded_at: new Date().toISOString(),
        },
      }),
    );
    return { ok: true, bucket, key: filename };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) };
  }
}
