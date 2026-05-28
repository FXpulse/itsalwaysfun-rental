// Date formatting helpers for emails.
// Customer-facing emails use MM/DD/YYYY (US numeric) to avoid YYYY-MM-DD
// ISO ambiguity. Centralized so we can swap formats globally if a tenant
// needs DD/MM/YYYY (EU) later.

/** Format a date string ("YYYY-MM-DD" or full ISO) as MM/DD/YYYY.
 *  Returns "" if input is empty/invalid. No timezone math — slices the
 *  date portion directly so calendar-day stays correct across zones. */
export function formatDateUS(input: string | null | undefined): string {
  if (!input) return "";
  const datePart = String(input).split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return String(input);
  const [y, m, d] = parts;
  if (!y || !m || !d) return String(input);
  return `${m}/${d}/${y}`;
}

/** Pretty long form ("March 15, 2026") for places where we want a more
 *  human-readable display. */
export function formatDateLong(input: string | null | undefined): string {
  if (!input) return "";
  const datePart = String(input).split("T")[0];
  try {
    return new Date(datePart + "T00:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return formatDateUS(input);
  }
}
