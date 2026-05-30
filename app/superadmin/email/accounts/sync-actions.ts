"use server";

import { revalidatePath } from "next/cache";
import { getSuperadminUser } from "@/lib/auth/superadmin";

/** Operator-facing manual sync trigger.
 *
 *  Calls the cron endpoint internally using CRON_SECRET from env. Lets the
 *  superadmin force a sync without having to copy CRON_SECRET out of Vercel. */
export async function manualSync(): Promise<
  { ok: true; results: any } | { ok: false; error: string }
> {
  const user = await getSuperadminUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://getrentalflow.com";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { ok: false, error: "CRON_SECRET env var not set" };

  try {
    const res = await fetch(`${baseUrl}/api/cron/email-sync`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: `cron returned ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };
    }
    revalidatePath("/superadmin/email/accounts");
    revalidatePath("/superadmin/email");
    return { ok: true, results: data };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
