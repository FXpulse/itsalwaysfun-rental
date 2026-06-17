// Beta program window helpers.
//
// "First 90 calendar days" structure (decision 2026-06-17): anyone who signs
// up while BETA_PROGRAM_END_AT is in the future gets:
//   - 90-day trial (vs default 30)
//   - tenants.beta_program = true
//   - tenants.beta_program_joined_at = signup timestamp
//
// No promo code, no count cap, no special post-beta pricing.
//
// To extend or end the program: change BETA_PROGRAM_END_AT in Vercel env
// (production scope) and redeploy. To kill it immediately: clear the env var.

const BETA_TRIAL_DAYS = 90;
const DEFAULT_TRIAL_DAYS = 30;

/** Returns true if a NEW signup right now qualifies for the beta program. */
export function isBetaProgramActive(): boolean {
  const raw = process.env.BETA_PROGRAM_END_AT;
  if (!raw) return false;
  const endAt = new Date(raw);
  if (isNaN(endAt.getTime())) return false;
  return endAt.getTime() > Date.now();
}

/** Returns the trial day count this signup should get. 90 if beta active, 30 otherwise. */
export function trialDaysForNewSignup(): number {
  return isBetaProgramActive() ? BETA_TRIAL_DAYS : DEFAULT_TRIAL_DAYS;
}

/** Returns the beta-program metadata to attach to a new tenant row. Empty
 *  object if beta not active so the spread is safe. */
export function betaProgramTenantFields(): {
  beta_program?: boolean;
  beta_program_joined_at?: string;
} {
  if (!isBetaProgramActive()) return {};
  return {
    beta_program: true,
    beta_program_joined_at: new Date().toISOString(),
  };
}

/** Returns the program's end date for display on /beta landing. null if inactive. */
export function betaProgramEndAt(): Date | null {
  const raw = process.env.BETA_PROGRAM_END_AT;
  if (!raw) return null;
  const endAt = new Date(raw);
  if (isNaN(endAt.getTime()) || endAt.getTime() < Date.now()) return null;
  return endAt;
}
