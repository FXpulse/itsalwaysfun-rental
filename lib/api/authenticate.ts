// API key authentication for /api/v1/* endpoints.
// Verifies the Authorization: Bearer rfk_xxx header against tenant_api_keys.

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ApiKeyAuth {
  tenant_id: string;
  key_id: string;
  scopes: string[];
}

const KEY_PREFIX = "rfk_";

export function generateApiKey(): { full_key: string; key_hash: string; key_prefix: string } {
  // 32 bytes → 43 base64url chars
  const random = randomBytes(32).toString("base64url");
  const full_key = `${KEY_PREFIX}${random}`;
  const key_hash = sha256(full_key);
  // Display prefix: rfk_ + first 8 chars of random
  const key_prefix = `${KEY_PREFIX}${random.slice(0, 8)}`;
  return { full_key, key_hash, key_prefix };
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Authenticates an /api/v1/* request. Returns the tenant + scopes on success,
 * or a NextResponse 401/403 on failure.
 */
export async function authenticateApiKey(
  req: NextRequest,
  requiredScope?: string,
): Promise<ApiKeyAuth | NextResponse> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: "missing_authorization", detail: "Send: Authorization: Bearer rfk_..." },
      { status: 401 },
    );
  }
  const token = auth.slice(7).trim();
  if (!token.startsWith(KEY_PREFIX)) {
    return NextResponse.json({ error: "invalid_token_format" }, { status: 401 });
  }

  const key_hash = sha256(token);
  const supabase = createAdminClient({ unscoped: true });
  const { data: row } = await supabase
    .from("tenant_api_keys")
    .select("id, tenant_id, scopes, expires_at, revoked_at")
    .eq("key_hash", key_hash)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  if (row.revoked_at) {
    return NextResponse.json({ error: "token_revoked" }, { status: 401 });
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "token_expired" }, { status: 401 });
  }

  if (requiredScope) {
    // Granted if exact match, wildcard "*", OR (for any X:read) the user has X:read scope
    const scopes = Array.isArray(row.scopes) ? row.scopes : [];
    const has = scopes.includes(requiredScope) || scopes.includes("*");
    if (!has) {
      return NextResponse.json(
        { error: "insufficient_scope", required: requiredScope, granted: scopes },
        { status: 403 },
      );
    }
  }

  // Fire-and-forget last_used update (best effort, don't await)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
             req.headers.get("x-real-ip") || null;
  supabase.from("tenant_api_keys")
    .update({ last_used_at: new Date().toISOString(), last_used_ip: ip })
    .eq("id", row.id)
    .then(() => {});

  return {
    tenant_id: row.tenant_id,
    key_id: row.id,
    scopes: row.scopes || [],
  };
}
