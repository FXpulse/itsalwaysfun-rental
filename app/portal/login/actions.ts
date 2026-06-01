"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ensureCustomerProfile, linkReferrer } from "@/lib/loyalty";

/** Run post-login hookup that the magic-link callback used to do.
 *  Called after successful OTP verification on the client. */
export async function postLoginHookup() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "no_session" };

    await ensureCustomerProfile(user.id);

    const refCookie = cookies().get("iaf_ref")?.value;
    if (refCookie) {
      await linkReferrer(user.id, refCookie);
      cookies().set("iaf_ref", "", { maxAge: 0, path: "/" });
    }

    return { ok: true };
  } catch (e: any) {
    console.error("postLoginHookup error:", e);
    return { ok: false, error: e?.message || String(e) };
  }
}
