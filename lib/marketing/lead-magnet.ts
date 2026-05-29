// Server-side handler for "lead magnet" submissions from /free-tools/* pages.
// Single entry point: saveLeadMagnetSignup().
//
// Side effects in order (fail-open after Supabase):
//   1. Insert into lead_magnet_signups (source of truth).
//   2. Lookup-or-create the contact in GHL + add tags.
//   3. Send a transactional email to the user with their summary.
//
// Anything after the Supabase write that fails is logged to Sentry but
// returns success to the caller — the lead is captured either way.

import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isGhlConfigured,
  lookupContactByEmail,
  upsertContact,
  addContactTags,
} from "@/lib/ghl/client";
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
  /** Tags to add to the GHL contact. Always includes `<toolName>-user`. */
  extra_tags?: string[];
}

export async function saveLeadMagnetSignup(
  input: LeadMagnetSubmission,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const supabase = createAdminClient({ unscoped: true });

  // Step 1 — persist (this MUST succeed for us to claim capture)
  const { data, error } = await supabase
    .from("lead_magnet_signups")
    .insert({
      email: input.email.toLowerCase().trim(),
      tool_name: input.toolName,
      source: input.source || null,
      payload_json: input.payload,
      marketing_opt_in: input.marketingOptIn,
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
  const tags = [`${input.toolName}-user`, ...(input.extra_tags || [])];
  if (input.marketingOptIn) tags.push("rf-marketing-opt-in");

  // Step 2 — GHL (fail-open)
  syncToGhl(signupId, input.email, tags).catch((e) => {
    Sentry.captureException(e, { tags: { stage: "ghl_sync" } });
  });

  // Step 3 — transactional email (fail-open)
  sendTransactional(input.email, input.email_subject, input.email_html).catch((e) => {
    Sentry.captureException(e, { tags: { stage: "transactional_email" } });
  });

  return { success: true, id: signupId };
}

async function syncToGhl(
  signupId: string,
  email: string,
  tags: string[],
): Promise<void> {
  if (!isGhlConfigured()) return;

  const existing = await lookupContactByEmail(email);
  let contactId: string | null = null;

  if (existing && "contact" in existing && existing.contact) {
    contactId = (existing.contact as any).id;
  } else {
    const created = await upsertContact({ email, tags, firstName: "", lastName: "" });
    if (created && "contact" in created && created.contact) {
      contactId = (created.contact as any).id;
    }
  }

  if (contactId) {
    await addContactTags(contactId, tags);
    const supabase = createAdminClient({ unscoped: true });
    await supabase
      .from("lead_magnet_signups")
      .update({ ghl_synced_at: new Date().toISOString(), ghl_contact_id: contactId })
      .eq("id", signupId);
  }
}

async function sendTransactional(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!isEmailConfigured()) return;
  await sendEmail({ to, subject, html });
}
