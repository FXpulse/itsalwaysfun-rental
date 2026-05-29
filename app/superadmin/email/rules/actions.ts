// app/superadmin/email/rules/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import type { RuleConditionGroup, RuleActionBlock } from "@/lib/email/types";

async function requireAuth() {
  const user = await getSuperadminUser();
  if (!user) throw new Error("Unauthorized");
}

export async function createRule(
  account_id: string, name: string, priority: number,
  condition_jsonb: RuleConditionGroup, action_jsonb: RuleActionBlock,
) {
  await requireAuth();
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("email_rules").insert({
    account_id, name, priority, condition_jsonb, action_jsonb, is_active: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/superadmin/email/rules");
}

export async function toggleRule(id: string, is_active: boolean) {
  await requireAuth();
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("email_rules").update({ is_active }).eq("id", id);
  revalidatePath("/superadmin/email/rules");
}

export async function deleteRule(id: string) {
  await requireAuth();
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("email_rules").delete().eq("id", id);
  revalidatePath("/superadmin/email/rules");
}
