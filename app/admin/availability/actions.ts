"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { BlockDateInputSchema } from "@/lib/validation";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function blockDate(input: {
  product_id: string;
  blocked_date: string;
  reason?: string | null;
}) {
  const user = await requireAdmin();
  const parsed = BlockDateInputSchema.safeParse({
    product_id: input.product_id,
    blocked_date: input.blocked_date,
    reason: input.reason || null,
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    return { error: "Tenant context missing" };
  }

  const supabase = createAdminClient();
  // Verify the product belongs to the caller's tenant before blocking.
  // The blocked_dates table now requires tenant_id (NOT NULL) — supplying
  // it from the caller's tenant context also prevents an admin on one
  // tenant from blocking dates on a foreign tenant's product.
  const { data: prod } = await supabase
    .from("products")
    .select("id")
    .eq("id", parsed.data.product_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!prod) {
    return { error: "Product not found" };
  }

  const { error } = await supabase.from("blocked_dates").insert({
    tenant_id: tenantId,
    product_id: parsed.data.product_id,
    blocked_date: parsed.data.blocked_date,
    reason: parsed.data.reason,
    created_by: user.email,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "This date is already blocked for this product." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/availability");
  return { success: true };
}

export async function unblockDate(blockId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("blocked_dates").delete().eq("id", blockId);
  if (error) return { error: error.message };
  revalidatePath("/admin/availability");
  return { success: true };
}
