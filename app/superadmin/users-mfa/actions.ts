"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { resetMfaForUser } from "@/lib/auth/recovery-codes";

const InputSchema = z.object({
  userId: z.string().uuid(),
});

export async function resetUserMfaAction(
  input: z.infer<typeof InputSchema>,
): Promise<{ success: true } | { error: string }> {
  const me = await getSuperadminUser();
  if (!me) redirect("/admin/login?error=not_superadmin");

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const r = await resetMfaForUser(parsed.data.userId);
  if (!r.ok) return { error: r.error || "Reset failed" };

  revalidatePath("/superadmin/users-mfa");
  return { success: true };
}
