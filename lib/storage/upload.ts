// Storage upload helper — server-side only (uses service role to bypass RLS).
// Public buckets → returns the permanent public URL.
// Private buckets → returns the storage path; use getSignedUrl() to view it.

import { createAdminClient } from "@/lib/supabase/admin";

export type BucketName = "product-images" | "site-assets" | "w9-forms";

interface UploadOptions {
  bucket: BucketName;
  file: File;
  pathPrefix?: string;     // e.g. "products" or "logos"
  filenameHint?: string;   // e.g. "all-star-sports-arena" — used in stored filename
}

// Buckets whose objects are NOT publicly accessible — always served via signed URLs.
const PRIVATE_BUCKETS: ReadonlySet<BucketName> = new Set<BucketName>(["w9-forms"]);

export async function uploadImage(opts: UploadOptions): Promise<
  | { url: string; path: string }
  | { error: string }
> {
  const { bucket, file, pathPrefix, filenameHint } = opts;

  if (!file || file.size === 0) {
    return { error: "No file provided" };
  }

  // PDFs (W9s, contracts) can be up to 10 MB; images cap at 5 MB.
  const maxBytes = file.type === "application/pdf" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    const mb = Math.floor(maxBytes / (1024 * 1024));
    return { error: `File too large (max ${mb} MB)` };
  }

  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "application/pdf",  // For W9 forms etc.
  ];
  if (!allowedMimes.includes(file.type)) {
    return { error: `Unsupported file type: ${file.type}` };
  }

  // Build a unique filename: <prefix>/<hint>_<timestamp>.<ext>
  const ext = file.name.split(".").pop() || "png";
  const safeHint = (filenameHint || "image")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 60);
  const filename = `${safeHint}_${Date.now()}.${ext}`;
  const path = pathPrefix ? `${pathPrefix}/${filename}` : filename;

  const supabase = createAdminClient();

  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, fileBytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return { error: `Upload failed: ${error.message}` };
  }

  // Private bucket: don't fabricate a public URL — caller must call getSignedUrl
  // when displaying. Return the storage path in `url` to keep existing callsites
  // (which persist `r.url` to DB columns like w9_url) working as before.
  if (PRIVATE_BUCKETS.has(bucket)) {
    return { url: path, path };
  }
  // Public bucket: return the permanent public URL
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: pub.publicUrl, path };
}

/** Generate a time-limited signed URL for a file in a private bucket.
 *  Default expiry: 1 hour. Used for admin viewing of W9s etc. */
export async function getSignedUrl(
  bucket: BucketName,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!path) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("[getSignedUrl]", bucket, path, error);
    return null;
  }
  return data?.signedUrl || null;
}

export async function deleteImage(
  bucket: BucketName,
  path: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
