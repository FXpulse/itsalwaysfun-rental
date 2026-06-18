"use server";

import { redirect } from "next/navigation";
import { getSuperadminUser } from "@/lib/auth/superadmin";
import { generateRecoveryCodes } from "@/lib/auth/recovery-codes";

export async function generateMyRecoveryCodes(): Promise<
  { codes: string[] } | { error: string }
> {
  const me = await getSuperadminUser();
  if (!me) redirect("/admin/login?error=not_superadmin");

  try {
    const codes = await generateRecoveryCodes(me.id, 10);
    return { codes };
  } catch (e: any) {
    return { error: e?.message || "Failed to generate codes" };
  }
}
