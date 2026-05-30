"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/api/authenticate";

export async function createApiKey(formData: FormData): Promise<
  { ok: true; full_key: string; key_prefix: string } | { error: string }
> {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };

  const name = (formData.get("name") || "").toString().trim();
  if (!name) return { error: "name_required" };

  const rawScopes = formData.getAll("scope") as string[];
  const scopes = rawScopes.length === 0 ? ["bookings:read"] : rawScopes;

  const expiresIn = (formData.get("expires_in") || "never").toString();
  let expires_at: string | null = null;
  if (expiresIn === "30d") expires_at = new Date(Date.now() + 30 * 86_400_000).toISOString();
  else if (expiresIn === "90d") expires_at = new Date(Date.now() + 90 * 86_400_000).toISOString();
  else if (expiresIn === "1y") expires_at = new Date(Date.now() + 365 * 86_400_000).toISOString();

  const { full_key, key_hash, key_prefix } = generateApiKey();

  const supabase = createAdminClient();
  const { error } = await supabase.from("tenant_api_keys").insert({
    name,
    key_hash,
    key_prefix,
    scopes,
    expires_at,
    created_by_email: me.email,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/api-keys");
  return { ok: true, full_key, key_prefix };
}

export async function revokeApiKey(id: string, reason: string = "manual_revoke") {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("tenant_api_keys")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/api-keys");
  return { ok: true };
}
