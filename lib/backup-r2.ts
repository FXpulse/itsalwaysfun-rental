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

import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

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

export interface R2PruneResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  scanned?: number;
  deleted?: number;
  keys_deleted?: string[];
}

/** Delete R2 backup files older than `retentionDays`.
 *
 *  Filename pattern: `backup-YYYY-MM-DD.json` (matches the weekly-backup
 *  upload format). Files that don't match the pattern are left alone —
 *  we never delete blindly by lastModified.
 *
 *  Returns counts. If R2 env vars are missing, returns { skipped: true }. */
export async function pruneOldBackupsFromR2(
  retentionDays: number,
): Promise<R2PruneResult> {
  const bucket = process.env.R2_BUCKET;
  const c = getClient();
  if (!c || !bucket) {
    return { ok: true, skipped: true, reason: "R2 env vars not configured" };
  }

  const cutoffMs = Date.now() - retentionDays * 86400000;
  const toDelete: string[] = [];
  let scanned = 0;

  try {
    let continuationToken: string | undefined = undefined;
    do {
      const res: any = await c.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of res.Contents || []) {
        scanned++;
        const key = obj.Key as string;
        const m = key.match(/^backup-(\d{4})-(\d{2})-(\d{2})\.json$/);
        if (!m) continue;
        const fileTime = new Date(
          `${m[1]}-${m[2]}-${m[3]}T00:00:00Z`,
        ).getTime();
        if (fileTime < cutoffMs) toDelete.push(key);
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    if (toDelete.length === 0) {
      return { ok: true, scanned, deleted: 0, keys_deleted: [] };
    }

    // DeleteObjectsCommand max 1000 keys per call — batch if needed
    const batches: string[][] = [];
    for (let i = 0; i < toDelete.length; i += 1000) {
      batches.push(toDelete.slice(i, i + 1000));
    }
    for (const batch of batches) {
      await c.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      );
    }

    return { ok: true, scanned, deleted: toDelete.length, keys_deleted: toDelete };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e), scanned };
  }
}
