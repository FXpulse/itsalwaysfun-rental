// Storage upload helper — server-side only (uses service role to bypass RLS).
// Uploads a File from FormData to a Supabase Storage bucket, returns the public URL.

import { createAdminClient } from "@/lib/supabase/admin";

interface UploadOptions {
  bucket: "product-images" | "site-assets";
  file: File;
  pathPrefix?: string;     // e.g. "products" or "logos"
  filenameHint?: string;   // e.g. "all-star-sports-arena" — used in stored filename
}

export async function uploadImage(opts: UploadOptions): Promise<
  | { url: string; path: string }
  | { error: string }
> {
  const { bucket, file, pathPrefix, filenameHint } = opts;

  if (!file || file.size === 0) {
    return { error: "No file provided" };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "File too large (max 5 MB)" };
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

  // Get the public URL
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

  return { url: pub.publicUrl, path };
}

export async function deleteImage(
  bucket: "product-images" | "site-assets",
  path: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
