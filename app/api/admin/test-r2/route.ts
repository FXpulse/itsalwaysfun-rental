// GET /api/admin/test-r2
// Quick diagnostic that uploads a tiny test file to R2 and returns
// what happened. Admin-only. Lets us see env var presence + upload
// result without digging into Vercel logs.

import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { uploadBackupToR2 } from "@/lib/backup-r2";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Show which env vars Vercel thinks are set (just presence, not values)
  const envPresence = {
    R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET || null,
    R2_ACCOUNT_ID_length: (process.env.R2_ACCOUNT_ID || "").length,
    R2_ACCESS_KEY_ID_length: (process.env.R2_ACCESS_KEY_ID || "").length,
    R2_SECRET_ACCESS_KEY_length: (process.env.R2_SECRET_ACCESS_KEY || "").length,
  };

  // Try uploading a 16-byte test file
  const filename = `test-r2-${Date.now()}.json`;
  const body = Buffer.from(JSON.stringify({ test: true, at: new Date().toISOString() }));
  const result = await uploadBackupToR2(filename, body);

  return NextResponse.json({
    env: envPresence,
    upload_result: result,
    instruction:
      "If upload_result.ok is true, check Cloudflare R2 → " +
      (process.env.R2_BUCKET || "(no bucket env)") +
      " for the file '" +
      filename +
      "'.",
  });
}
