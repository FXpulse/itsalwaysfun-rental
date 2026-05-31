"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") throw new Error("Unauthorized");
  return me;
}

const TAG_COLORS = [
  "#6d28d9", // violet
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // rose
  "#4f46e5", // indigo
  "#65a30d", // lime
  "#7c3aed", // purple
];

function colorForTag(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

export async function addCustomerTag(
  email: string,
  tagName: string,
  notes?: string,
): Promise<{ ok: true } | { error: string }> {
  const me = await requireAdmin();
  const normalized_email = email.trim().toLowerCase();
  const normalized_tag = tagName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  if (!normalized_email || !normalized_tag) return { error: "email_and_tag_required" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("customer_tags").insert({
    customer_email: normalized_email,
    tag_name: normalized_tag,
    tag_color: colorForTag(normalized_tag),
    notes: notes?.trim() || null,
    created_by_email: me.email,
  });
  if (error && error.code !== "23505") return { error: error.message };
  // 23505 = unique violation, that means already exists. Treat as success (idempotent).

  revalidatePath(`/admin/customers/${encodeURIComponent(normalized_email)}`);
  revalidatePath(`/admin/customers`);
  return { ok: true };
}

export async function removeCustomerTag(email: string, tagName: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase
    .from("customer_tags")
    .delete()
    .eq("customer_email", email.trim().toLowerCase())
    .eq("tag_name", tagName.trim().toLowerCase());

  revalidatePath(`/admin/customers/${encodeURIComponent(email)}`);
  revalidatePath(`/admin/customers`);
  return { ok: true };
}

/** List of distinct tag names already used in this tenant — for autocomplete. */
export async function listExistingTags(): Promise<string[]> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customer_tags")
    .select("tag_name")
    .order("tag_name");
  const seen = new Set<string>();
  for (const r of (data as any[]) || []) seen.add(r.tag_name);
  return Array.from(seen);
}
