// SaaS-owner-facing email configuration.
//
// Two distinct email surfaces in this codebase:
//
//   1. TENANT → CUSTOMER:  per-tenant From + Reply-To via
//      `getTenantEmailConfig(tenantId)` — customer sees the tenant's brand.
//
//   2. PLATFORM → OPERATOR (Ludmila → tenant owner): this module.
//      Onboarding nudges, dunning, beta lifecycle, weekly-backup notice,
//      beta-feedback notification. The operator always sees the same
//      address regardless of which tenant they own — that's how they
//      know it's the platform talking, not their own tenant.
//
// Canonical address: info@getrentalflow.com (set 2026-06-17).
//
// To change: set SAAS_OWNER_EMAIL env var. Otherwise the hardcoded
// fallback ships.

const DEFAULT_SAAS_OWNER_EMAIL = "info@getrentalflow.com";
const DEFAULT_SAAS_OWNER_DISPLAY = "RentalFlow";

/** Returns the From + Reply-To pair for any email sent BY the SaaS owner
 *  (Ludmila → tenant operator). */
export function getSaasOwnerEmailConfig(): {
  from: string;
  replyTo: string;
} {
  const addr = process.env.SAAS_OWNER_EMAIL || DEFAULT_SAAS_OWNER_EMAIL;
  const display = process.env.SAAS_OWNER_DISPLAY || DEFAULT_SAAS_OWNER_DISPLAY;
  return {
    from: `${display} <${addr}>`,
    replyTo: addr,
  };
}

/** Where do platform-side notifications (beta feedback, backup links,
 *  cron alerts) get delivered? */
export function getSaasOwnerInbox(): string {
  return (
    process.env.BETA_FEEDBACK_EMAIL ||
    process.env.SAAS_OWNER_EMAIL ||
    DEFAULT_SAAS_OWNER_EMAIL
  );
}
