// Tenant-aware timezone formatting.
//
// EVERY server-rendered timestamp in the app should go through these
// helpers so it displays in the tenant's local timezone — not Vercel's
// UTC and not the viewer's browser locale.
//
// Client components can also use these helpers; they take an explicit
// `tenantTimezone` string so server components can pass it down as a
// prop without depending on request context.
//
// IANA identifiers only (e.g. "America/New_York", not "EST"). The DB
// stores timezone on `tenants.timezone` and getTenantInfo() returns it.

import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_TENANT_TIMEZONE = "America/New_York";

/** Curated list of US-relevant timezones shown in the tenant settings
 *  dropdown. Keep sorted by typical population for easy picking. */
export const US_TIMEZONES = [
  { id: "America/New_York", label: "Eastern (New York, Miami, Atlanta)" },
  { id: "America/Chicago", label: "Central (Chicago, Houston, Dallas)" },
  { id: "America/Denver", label: "Mountain (Denver, Salt Lake City)" },
  { id: "America/Phoenix", label: "Mountain — no DST (Arizona)" },
  { id: "America/Los_Angeles", label: "Pacific (Los Angeles, Seattle)" },
  { id: "America/Anchorage", label: "Alaska" },
  { id: "Pacific/Honolulu", label: "Hawaii" },
  { id: "America/Puerto_Rico", label: "Puerto Rico / Atlantic" },
];

/** True if the given string is a valid IANA timezone identifier on this
 *  Node runtime. Used to defensively validate input before persisting. */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function normalizeDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** Date + time, e.g. "Jun 2, 2026, 2:10 PM". */
export function formatDateTimeInTz(
  input: string | Date | null | undefined,
  tenantTimezone: string = DEFAULT_TENANT_TIMEZONE,
): string {
  const d = normalizeDate(input);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tenantTimezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Date only, e.g. "Jun 2, 2026". */
export function formatDateInTz(
  input: string | Date | null | undefined,
  tenantTimezone: string = DEFAULT_TENANT_TIMEZONE,
): string {
  const d = normalizeDate(input);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tenantTimezone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Long date, e.g. "Tuesday, June 2, 2026". */
export function formatDateLongInTz(
  input: string | Date | null | undefined,
  tenantTimezone: string = DEFAULT_TENANT_TIMEZONE,
): string {
  const d = normalizeDate(input);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tenantTimezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** Time only, e.g. "2:10 PM". */
export function formatTimeInTz(
  input: string | Date | null | undefined,
  tenantTimezone: string = DEFAULT_TENANT_TIMEZONE,
): string {
  const d = normalizeDate(input);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tenantTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** ISO date string (YYYY-MM-DD) for the tenant's "today". Useful for
 *  scheduling crons/reports that should fire on the tenant's calendar
 *  day, not UTC's. */
export function todayInTz(tenantTimezone: string = DEFAULT_TENANT_TIMEZONE): string {
  // en-CA returns YYYY-MM-DD format
  return new Intl.DateTimeFormat("en-CA", { timeZone: tenantTimezone }).format(new Date());
}

/** Read tenant.timezone from DB for the given tenant_id. Returns the
 *  default ("America/New_York") if the tenant or column lookup fails.
 *  Use this in server contexts that don't have a request scope (crons,
 *  emails from background jobs, etc.). */
export async function getTenantTimezone(tenantId: string | null | undefined): Promise<string> {
  if (!tenantId) return DEFAULT_TENANT_TIMEZONE;
  try {
    const supabase = createAdminClient({ unscoped: true });
    const { data } = await supabase
      .from("tenants")
      .select("timezone")
      .eq("id", tenantId)
      .maybeSingle();
    const tz = (data as any)?.timezone;
    if (tz && isValidTimezone(tz)) return tz;
  } catch {}
  return DEFAULT_TENANT_TIMEZONE;
}
