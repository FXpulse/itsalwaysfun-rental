// GHL API wrapper — outbound calls.
//
// AGENCY MODEL (clarified 2026-06-17):
//   - GHL_API_KEY (master agency PIT) is platform-side, ONE token that
//     accesses all sub-accounts under our agency.
//   - locationId is PER-TENANT. Pass it explicitly to each call.
//   - For backward compat, if no locationId is passed, the call uses
//     GHL_LOCATION_ID env. Migrate callers to pass tenant context —
//     see lib/ghl/tenant-config.ts.

const BASE = process.env.GHL_API_BASE || "https://services.leadconnectorhq.com";
const VERSION = process.env.GHL_API_VERSION || "2021-07-28";

function authHeaders(): HeadersInit {
  const key = process.env.GHL_API_KEY || "";
  return {
    Authorization: `Bearer ${key}`,
    Version: VERSION,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/** True iff the master GHL credentials are configured. Doesn't check any
 *  specific tenant's location — that gate is in getTenantGhlConfig(). */
export function isGhlConfigured() {
  const key = process.env.GHL_API_KEY || "";
  return key.startsWith("pit-");
}

function resolveLocationId(override?: string): string | null {
  return override || process.env.GHL_LOCATION_ID || null;
}

/** Find a contact by email. Returns contact object or null. */
export async function lookupContactByEmail(
  email: string,
  opts?: { locationId?: string },
) {
  if (!isGhlConfigured()) return { error: "ghl_not_configured" };
  const locationId = resolveLocationId(opts?.locationId);
  if (!locationId) return { error: "ghl_location_not_set" };

  const params = new URLSearchParams({
    locationId,
    query: email,
    limit: "1",
  });

  try {
    const r = await fetch(`${BASE}/contacts/?${params}`, { headers: authHeaders() });
    if (!r.ok) {
      return { error: `http_${r.status}`, details: await r.text() };
    }
    const data = await r.json();
    const contact = (data.contacts || [])[0] || null;
    return contact ? { contact } : { error: "contact_not_found" };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Create or upsert a contact. */
export async function upsertContact(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  tags?: string[];
  locationId?: string;
}) {
  if (!isGhlConfigured()) return { error: "ghl_not_configured" };
  const locationId = resolveLocationId(input.locationId);
  if (!locationId) return { error: "ghl_location_not_set" };

  try {
    const r = await fetch(`${BASE}/contacts/upsert`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        locationId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        address1: input.address,
        tags: input.tags,
      }),
    });
    const body = await r.json();
    if (!r.ok) return { error: `http_${r.status}`, details: body };
    return { contact: body.contact };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Add a note (e.g. booking details) to a contact. */
export async function addContactNote(contactId: string, body: string) {
  if (!isGhlConfigured()) return { error: "ghl_not_configured" };

  try {
    const r = await fetch(`${BASE}/contacts/${contactId}/notes`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ body, userId: null }),
    });
    if (!r.ok) return { error: `http_${r.status}`, details: await r.text() };
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Update an opportunity's stage (e.g. to "Confirmed" on payment success). */
export async function updateOpportunityStage(opportunityId: string, stageId: string) {
  if (!isGhlConfigured()) return { error: "ghl_not_configured" };

  try {
    const r = await fetch(`${BASE}/opportunities/${opportunityId}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ pipelineStageId: stageId }),
    });
    if (!r.ok) return { error: `http_${r.status}`, details: await r.text() };
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Add tag(s) to a contact. */
export async function addContactTags(contactId: string, tags: string[]) {
  if (!isGhlConfigured()) return { error: "ghl_not_configured" };

  try {
    const r = await fetch(`${BASE}/contacts/${contactId}/tags`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ tags }),
    });
    if (!r.ok) return { error: `http_${r.status}`, details: await r.text() };
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
