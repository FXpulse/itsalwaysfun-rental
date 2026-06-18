// Server-side handler for "lead magnet" submissions from /free-tools/* pages.
// Single entry point: saveLeadMagnetSignup().
//
// Side effects in order (fail-open after Supabase):
//   1. Insert into lead_magnet_signups (source of truth).
//   2. Send a transactional email to the user with their summary.
//
// Anything after the Supabase write that fails is logged to Sentry but
// returns success to the caller — the lead is captured either way.
//
// Why no GHL push: lead magnets live on getrentalflow.com apex, not on a
// tenant's site. The leads are RentalFlow SaaS prospects, not IAF customers.
// They belong in our own marketing list, not in a tenant's CRM. Outbound
// nurture happens via our own scheduled emails or by exporting CSV to GHL
// outbound pipeline manually.

import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";

export interface LeadMagnetSubmission {
  email: string;
  toolName: string;
  source?: string;
  payload: Record<string, any>;
  marketingOptIn: boolean;
  /** Subject line + HTML for the transactional email we send the user. */
  email_subject: string;
  email_html: string;
  /** Extra tags stored on the lead row for later filtering/segmenting. */
  extra_tags?: string[];
}

export async function saveLeadMagnetSignup(
  input: LeadMagnetSubmission,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const supabase = createAdminClient({ unscoped: true });

  // Step 1 — persist (this MUST succeed for us to claim capture)
  const tags = [`${input.toolName}-user`, ...(input.extra_tags || [])];
  if (input.marketingOptIn) tags.push("rf-marketing-opt-in");

  const { data, error } = await supabase
    .from("lead_magnet_signups")
    .insert({
      email: input.email.toLowerCase().trim(),
      tool_name: input.toolName,
      source: input.source || null,
      payload_json: input.payload,
      marketing_opt_in: input.marketingOptIn,
      tags,
    })
    .select("id")
    .single();

  if (error || !data) {
    Sentry.captureException(error || new Error("insert returned no row"), {
      tags: { lead_magnet: input.toolName },
    });
    return { success: false, error: "save_failed" };
  }

  const signupId = data.id as string;

  // Step 2 — transactional email (fail-open)
  sendTransactional(input.email, input.email_subject, input.email_html).catch((e) => {
    Sentry.captureException(e, { tags: { stage: "transactional_email" } });
  });

  return { success: true, id: signupId };
}

async function sendTransactional(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!isEmailConfigured()) return;
  await sendEmail({ to, subject, html });
}
