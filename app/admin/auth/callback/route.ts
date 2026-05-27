// Handles Supabase OAuth redirect for admin login (Google, etc).
// Exchanges code for session, then verifies the user has an active row in
// user_roles. If not, signs them out and redirects back to /admin/login
// with an error param — keeps random Google accounts out of the admin.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/admin/dashboard";

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/login?error=missing_code", url.origin),
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Verify user has an active admin/staff/driver role. If not, kick them out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/admin/login?error=no_session", url.origin),
    );
  }

  const admin = createAdminClient();
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!roleRow || !roleRow.is_active) {
    // Sign out so they don't have a dangling session
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/admin/login?error=no_role", url.origin),
    );
  }

  // Drivers go to /driver, everyone else to the requested next (or dashboard)
  const dest = roleRow.role === "driver" ? "/driver" : next;
  return NextResponse.redirect(new URL(dest, url.origin));
}
