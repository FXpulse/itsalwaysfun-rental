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

  // Try www first (canonical), then apex as fallback
  const candidates = [
    baseUrl,
    "https://www.getrentalflow.com",
    "https://getrentalflow.com",
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  let lastErr = "no candidate URL worked";
  for (const url of candidates) {
    try {
      const res = await fetch(`${url}/api/cron/email-sync`, {
        method: "GET",
        headers: { Authorization: `Bearer ${cronSecret}` },
        cache: "no-store",
        redirect: "follow",
      });
      const text = await res.text();
      if (!res.ok) {
        lastErr = `${url} → ${res.status}: ${text.slice(0, 200)}`;
        continue;
      }
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        lastErr = `${url} → ${res.status}: non-JSON response: ${text.slice(0, 200)}`;
        continue;
      }
      revalidatePath("/superadmin/email/accounts");
      revalidatePath("/superadmin/email");
      return { ok: true, results: data };
    } catch (e: any) {
      lastErr = `${url} → fetch threw: ${String(e?.message || e)}`;
    }
  }
  return { ok: false, error: lastErr };
}
