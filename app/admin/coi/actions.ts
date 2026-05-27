"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { uploadImage, deleteImage } from "@/lib/storage/upload";
import { sendTemplated } from "@/lib/email/send-template";
import { isEmailConfigured } from "@/lib/email/send";
import { getTenantBusinessName } from "@/lib/tenant/business";

export async function uploadCoi(requestId: string, formData: FormData) {
  const me = await requireAdmin();
  const file = formData.get("coi_file") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };

  const supabase = createAdminClient();
  const { data: req } = await supabase
    .from("coi_requests")
    .select("id, booking_id, venue_name, coi_file_path, requested_by_email")
    .eq("id", requestId)
    .single();
  if (!req) return { error: "Request not found" };

  // If a previous file exists, delete it first (clean overwrite)
  if (req.coi_file_path) {
    await deleteImage("site-assets", req.coi_file_path);
  }

  const upload = await uploadImage({
    bucket: "site-assets",
    file,
    pathPrefix: `coi/${req.booking_id}`,
    filenameHint: `coi-${req.venue_name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40)}`,
  });
  if ("error" in upload) return { error: upload.error };

  const { error } = await supabase
    .from("coi_requests")
    .update({
      coi_file_url: upload.url,
      coi_file_path: upload.path,
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
      uploaded_by: me.email,
    })
    .eq("id", requestId);
  if (error) return { error: error.message };

  // Email customer that COI is ready
  if (isEmailConfigured()) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
    const brand = await getTenantBusinessName();
    try {
      await sendTemplated({
        key: "coi_ready",
        to: req.requested_by_email,
        vars: {
          venueName: req.venue_name,
          coiUrl: upload.url,
          portalUrl: `${baseUrl}/portal/bookings/${req.booking_id}`,
        },
        fallback: () => ({
          subject: `📄 Your Certificate of Insurance is ready (${req.venue_name})`,
          html: `<p>Hi,</p>
<p>Your Certificate of Insurance for <strong>${req.venue_name}</strong> is ready.</p>
<p><a href="${upload.url}" style="background:#1a1a6e;color:white;padding:8px 14px;border-radius:4px;text-decoration:none;font-weight:bold;">Download COI (PDF)</a></p>
<p>You can also find it anytime in your <a href="${baseUrl}/portal/bookings/${req.booking_id}">booking page</a>.</p>
<p>Forward it to your venue as requested.</p>
<p>— The ${brand} team</p>`,
          text: `Your COI for ${req.venue_name} is ready: ${upload.url}\nPortal: ${baseUrl}/portal/bookings/${req.booking_id}`,
        }),
        tags: [{ name: "type", value: "coi_ready" }],
      });
    } catch (e) {
      console.error("[COI ready email failed, non-fatal]", e);
    }
  }

  revalidatePath("/admin/coi");
  revalidatePath(`/portal/bookings/${req.booking_id}`);
  return { success: true, url: upload.url };
}

export async function markCoiDelivered(requestId: string, note: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("coi_requests")
    .update({
      status: "delivered_to_venue",
      delivered_at: new Date().toISOString(),
      admin_notes: note || null,
    })
    .eq("id", requestId);
  if (error) return { error: error.message };
  revalidatePath("/admin/coi");
  return { success: true };
}

export async function cancelCoiRequest(requestId: string, reason: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("coi_requests")
    .update({
      status: "cancelled",
      admin_notes: reason || "Cancelled by admin",
    })
    .eq("id", requestId);
  if (error) return { error: error.message };
  revalidatePath("/admin/coi");
  return { success: true };
}

/** Global on/off for the COI request checkbox on the public checkout.
 *  Stored in site_settings.coi_request_enabled. Default = enabled. */
export async function setCoiRequestEnabled(enabled: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { key: "coi_request_enabled", value: enabled ? "true" : "false" },
      { onConflict: "key" },
    );
  if (error) return { error: error.message };
  revalidatePath("/admin/coi");
  revalidatePath("/order-by-date");
  return { success: true };
}
