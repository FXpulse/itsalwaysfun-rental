// Helpers for setup + teardown in Playwright e2e tests.
//
// Strategy: each test that needs auth creates its own throwaway user via the
// Supabase Admin API (service role) at beforeAll, deletes it at afterAll.
// No shared seed user — each run is isolated, so flakes from concurrent
// runs are impossible.
//
// IMPORTANT: these helpers use the SUPABASE_SERVICE_ROLE_KEY which MUST be
// the TEST project's key (see playwright.config.ts webServer.env). Never
// run these against production — the cleanup would delete real users.

import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.TEST_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!url || !key) {
    throw new Error(
      "E2E helpers require NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or TEST_* equivalents) to be set.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Pick the IAF (default) tenant id. Tests don't need multi-tenant unless
 *  they're explicitly verifying tenant isolation. */
const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";

export interface TestUser {
  email: string;
  password: string;
  userId: string;
}

/** Create a throwaway admin user. Returns the credentials + user id. */
export async function createTestAdmin(): Promise<TestUser> {
  const admin = getAdmin();
  const stamp = Date.now();
  const email = `e2e-admin-${stamp}@example.test`;
  const password = `Test_${stamp}!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "E2E", last_name: "Admin" },
  });
  if (error || !data.user) {
    throw new Error(`createTestAdmin failed: ${error?.message}`);
  }

  // Add user_roles row so middleware/role checks pass.
  const { error: roleErr } = await admin.from("user_roles").insert({
    user_id: data.user.id,
    tenant_id: DEFAULT_TENANT_ID,
    role: "admin",
    is_active: true,
  });
  if (roleErr) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(`createTestAdmin role insert failed: ${roleErr.message}`);
  }

  return { email, password, userId: data.user.id };
}

/** Delete a test user. Idempotent — safe to call from afterAll even if
 *  the test crashed before getting a userId (pass null/undefined). */
export async function deleteTestUser(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  const admin = getAdmin();
  // Supabase query builders are thenables (no .catch chain), so the
  // safest cleanup pattern is try/catch around the await.
  try {
    await admin.from("user_roles").delete().eq("user_id", userId);
  } catch {
    /* ignore — cleanup is best-effort */
  }
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {
    /* ignore */
  }
}

/** Pick a real product slug so wizard tests have something to click into.
 *  Falls back to the first active product if no specific slug exists. */
export async function getAnyActiveProductSlug(): Promise<string | null> {
  const admin = getAdmin();
  const { data } = await admin
    .from("products")
    .select("slug")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data as { slug: string } | null)?.slug ?? null;
}
