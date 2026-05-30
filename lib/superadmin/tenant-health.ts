// Per-tenant health scoring.
//
// Combines subscription state, payment history, activity signals, and
// support load into a 0-100 score + risk band. Used by:
//   - /superadmin/tenants (sort + filter + badges)
//   - /superadmin/health (heatmap)
//   - Dashboard widget
//
// Scoring is pure — no I/O. Caller fetches the inputs and passes them in.

export interface TenantHealthInputs {
  // Subscription
  subscription_status: string | null;
  plan: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  suspended_at: string | null;
  created_at: string;
  // Activity signals
  bookings_last_30d: number;
  bookings_lifetime: number;
  // Support load
  open_tickets: number;
  resolved_tickets: number;
  // Engagement
  last_admin_activity_at: string | null;  // null = never logged in
}

export interface TenantHealthResult {
  score: number;                            // 0-100
  band: "healthy" | "watch" | "at_risk" | "churning";
  band_color: "emerald" | "blue" | "amber" | "rose" | "slate";
  signals: TenantHealthSignal[];           // top 3 contributors
  hint: string;                            // 1-line operator action
  predicted_churn_at: string | null;       // ISO date or null if not predicted to churn
  churn_confidence: "low" | "medium" | "high" | null;
}

export interface TenantHealthSignal {
  label: string;
  delta: number;                            // points contributed (+ or -)
  color: "positive" | "warning" | "negative";
}

export function scoreTenant(i: TenantHealthInputs): TenantHealthResult {
  let score = 50; // neutral baseline
  const signals: TenantHealthSignal[] = [];

  // ── Subscription health (-40 to +30) ──
  if (i.suspended_at) {
    score -= 40;
    signals.push({ label: "Account suspended", delta: -40, color: "negative" });
  } else if (i.subscription_status === "active") {
    score += 25;
    signals.push({ label: "Paying customer", delta: +25, color: "positive" });
  } else if (i.subscription_status === "trialing") {
    const trialEnds = i.trial_ends_at ? new Date(i.trial_ends_at).getTime() : 0;
    const daysLeft = (trialEnds - Date.now()) / 86_400_000;
    if (daysLeft < 0) {
      score -= 15;
      signals.push({ label: "Trial expired, no payment", delta: -15, color: "negative" });
    } else if (daysLeft < 5) {
      score += 5;
      signals.push({ label: `${Math.round(daysLeft)}d left in trial`, delta: +5, color: "warning" });
    } else {
      score += 15;
      signals.push({ label: "In active trial", delta: +15, color: "positive" });
    }
  } else if (i.subscription_status === "past_due") {
    score -= 25;
    signals.push({ label: "Payment failed", delta: -25, color: "negative" });
  } else if (i.subscription_status === "canceled" || i.cancel_at_period_end) {
    score -= 30;
    signals.push({ label: "Cancelling at period end", delta: -30, color: "negative" });
  }

  // Founder plan = always healthy
  if (i.plan === "founder") {
    score = Math.max(score, 95);
    return {
      score,
      band: "healthy",
      band_color: "emerald",
      signals: [{ label: "Founder plan", delta: 100, color: "positive" }],
      hint: "Founder plan — always healthy",
      predicted_churn_at: null,
      churn_confidence: null,
    };
  }

  // ── Booking velocity (-15 to +20) ──
  const accountAgeDays = Math.max(1, (Date.now() - new Date(i.created_at).getTime()) / 86_400_000);
  if (i.bookings_lifetime === 0 && accountAgeDays > 14) {
    score -= 15;
    signals.push({ label: "Zero bookings in 2+ weeks", delta: -15, color: "negative" });
  } else if (i.bookings_last_30d >= 10) {
    score += 20;
    signals.push({ label: `${i.bookings_last_30d} bookings/30d 🔥`, delta: +20, color: "positive" });
  } else if (i.bookings_last_30d >= 3) {
    score += 10;
    signals.push({ label: `${i.bookings_last_30d} bookings/30d`, delta: +10, color: "positive" });
  } else if (i.bookings_lifetime > 5 && i.bookings_last_30d === 0) {
    score -= 10;
    signals.push({ label: "No bookings in 30d (was active)", delta: -10, color: "warning" });
  }

  // ── Support load (-10 to +5) ──
  if (i.open_tickets >= 3) {
    score -= 10;
    signals.push({ label: `${i.open_tickets} open tickets`, delta: -10, color: "warning" });
  } else if (i.open_tickets === 0 && i.resolved_tickets > 0) {
    score += 5;
    signals.push({ label: "Tickets resolved cleanly", delta: +5, color: "positive" });
  }

  // ── Engagement (-15 to +5) ──
  if (i.last_admin_activity_at) {
    const daysSinceActive = (Date.now() - new Date(i.last_admin_activity_at).getTime()) / 86_400_000;
    if (daysSinceActive > 30) {
      score -= 15;
      signals.push({ label: `Inactive ${Math.round(daysSinceActive)}d`, delta: -15, color: "negative" });
    } else if (daysSinceActive < 3) {
      score += 5;
      signals.push({ label: "Active this week", delta: +5, color: "positive" });
    }
  } else if (accountAgeDays > 7) {
    score -= 10;
    signals.push({ label: "Never logged in", delta: -10, color: "negative" });
  }

  // Clamp + band
  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: TenantHealthResult["band"] =
    score >= 75 ? "healthy" :
    score >= 50 ? "watch" :
    score >= 25 ? "at_risk" :
    "churning";
  const band_color: TenantHealthResult["band_color"] =
    band === "healthy" ? "emerald" :
    band === "watch" ? "blue" :
    band === "at_risk" ? "amber" :
    "rose";

  // Sort signals by absolute impact, top 3
  signals.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topSignals = signals.slice(0, 3);

  // Operator hint
  const hint = computeHint({ band, signals, inputs: i });

  // Predict churn date — based on band + specific signals.
  // The model is intentionally simple (deterministic, no training data needed):
  // - cancel_at_period_end → current_period_end is the churn date (high conf)
  // - past_due → ~8 days from current_period_end (dunning auto-cancels at day 8)
  // - at_risk band → 60 days
  // - churning band → 30 days
  // - watch + zero-bookings warning → 90 days
  const { predicted_churn_at, churn_confidence } = predictChurn({ band, inputs: i });

  return { score, band, band_color, signals: topSignals, hint, predicted_churn_at, churn_confidence };
}

function predictChurn({
  band, inputs,
}: {
  band: TenantHealthResult["band"];
  inputs: TenantHealthInputs;
}): { predicted_churn_at: string | null; churn_confidence: "low" | "medium" | "high" | null } {
  const cpe = inputs.current_period_end ? new Date(inputs.current_period_end) : null;
  if (inputs.cancel_at_period_end && cpe) {
    return { predicted_churn_at: cpe.toISOString(), churn_confidence: "high" };
  }
  if (inputs.subscription_status === "past_due" && cpe) {
    const churn = new Date(cpe.getTime() + 8 * 86_400_000);
    return { predicted_churn_at: churn.toISOString(), churn_confidence: "high" };
  }
  if (band === "churning") {
    return { predicted_churn_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), churn_confidence: "medium" };
  }
  if (band === "at_risk") {
    return { predicted_churn_at: new Date(Date.now() + 60 * 86_400_000).toISOString(), churn_confidence: "low" };
  }
  return { predicted_churn_at: null, churn_confidence: null };
}

function computeHint({
  band, signals, inputs,
}: {
  band: TenantHealthResult["band"];
  signals: TenantHealthSignal[];
  inputs: TenantHealthInputs;
}): string {
  if (band === "healthy") return "All green — nothing to do";
  if (inputs.subscription_status === "past_due") return "Reach out about the failed payment within 24h";
  if (inputs.cancel_at_period_end) return "Cancellation save call — offer pause or discount";
  if (inputs.bookings_lifetime === 0) return "Onboarding stalled — send activation help";
  if (inputs.open_tickets >= 3) return "Multiple open tickets — escalate manually";
  if (signals.some((s) => s.label.startsWith("Never logged in"))) return "No login since signup — re-engagement email";
  if (signals.some((s) => s.label.startsWith("Inactive"))) return "Send a check-in email + offer office hours";
  if (band === "at_risk") return "Schedule a 15-min support call this week";
  return "Monitor weekly";
}
