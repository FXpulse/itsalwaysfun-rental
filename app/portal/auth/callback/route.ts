// Handles Supabase magic-link redirect. Exchanges the code for a session,
// ensures a customer_profile exists, links referrer if a ref cookie is set,
// then redirects to the portal dashboard (or the original ?next= target).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ensureCustomerProfile, linkReferrer } from "@/lib/loyalty";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/portal";

  if (!code) {
    return NextResponse.redirect(new URL("/portal/login?error=missing_code", url.origin));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/portal/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Ensure profile + ref hookup (best-effort, don't block login)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await ensureCustomerProfile(user.id);
      const refCookie = cookies().get("iaf_ref")?.value;
      if (refCookie) {
        await linkReferrer(user.id, refCookie);
        // Clear cookie so it's not re-used
        cookies().set("iaf_ref", "", { maxAge: 0, path: "/" });
      }
    }
  } catch (e) {
    console.error("Post-login hookup error", e);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
