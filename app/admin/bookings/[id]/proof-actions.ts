"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin } from "@/lib/auth/roles";
import { uploadImage } from "@/lib/storage/upload";
import { z } from "zod";

const PROOF_PATH = "booking-proofs";

interface PhotoSpec {
  url: string;
  caption: string;
  sort_order: number;
}

const SaveProofSchema = z.object({
  booking_id: z.string().uuid(),
  phase: z.enum(["delivery", "pickup"]),
  customer_signature_name: z.string().max(200).optional().nullable(),
  condition_notes: z.string().max(2000).optional().nullable(),
});

/** Upload a photo for a booking proof. Returns its public URL. */
export async function uploadProofPhoto(
  bookingId: string,
  phase: "delivery" | "pickup",
  formData: FormData,
) {
  const me = await requireStaffOrAdmin();
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return { error: "No file" };

  const r = await uploadImage({
    bucket: "site-assets",
    file,
    pathPrefix: `${PROOF_PATH}/${bookingId}/${phase}`,
    filenameHint: `${phase}-photo`,
  });
  if ("error" in r) return { error: r.error };
  return { success: true, url: r.url };
}

/** Save the full proof — photos + signature + notes. Upserts the booking_proofs
 *  row uniquely keyed on (booking_id, phase). */
export async function saveProof(formData: FormData) {
  const me = await requireStaffOrAdmin();

  const parsed = SaveProofSchema.safeParse({
    booking_id: String(formData.get("booking_id") || ""),
    phase: String(formData.get("phase") || "delivery"),
    customer_signature_name: String(formData.get("customer_signature_name") || "") || null,
    condition_notes: String(formData.get("condition_notes") || "") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  // Photos: JSON-stringified array from the client
  let photos: PhotoSpec[] = [];
  try {
    const photosRaw = formData.get("photos");
    if (photosRaw && typeof photosRaw === "string") {
      photos = JSON.parse(photosRaw);
    }
  } catch {}

  // Signature: base64 data URL from client canvas, decoded to PNG bytes
  let signatureUrl: string | null = null;
  const sigData = formData.get("signature_dataurl") as string | null;
  if (sigData && sigData.startsWith("data:image/")) {
    const base64 = sigData.split(",")[1] || "";
    if (base64.length > 100) {
      const buf = Buffer.from(base64, "base64");
      const supabase = createAdminClient();
      const path = `${PROOF_PATH}/${parsed.data.booking_id}/${parsed.data.phase}-signature-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("site-assets")
        .upload(path, buf, {
          contentType: "image/png",
          cacheControl: "3600",
          upsert: false,
        });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
        signatureUrl = pub.publicUrl;
      } else {
        console.error("[signature upload failed]", upErr);
      }
    }
  }

  const supabase = createAdminClient();

  // Upsert: try update first, insert if not exists
  const { data: existing } = await supabase
    .from("booking_proofs")
    .select("id, customer_signature_url")
    .eq("booking_id", parsed.data.booking_id)
    .eq("phase", parsed.data.phase)
    .maybeSingle();

  const updateData: any = {
    captured_by: me.email,
    captured_at: new Date().toISOString(),
    photos,
    customer_signature_name: parsed.data.customer_signature_name,
    condition_notes: parsed.data.condition_notes,
  };
  if (signatureUrl) updateData.customer_signature_url = signatureUrl;

  if (existing) {
    const { error } = await supabase
      .from("booking_proofs")
      .update(updateData)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("booking_proofs").insert({
      booking_id: parsed.data.booking_id,
      phase: parsed.data.phase,
      ...updateData,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/bookings/${parsed.data.booking_id}`);
  return { success: true };
}

export async function deleteProof(proofId: string, bookingId: string) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("booking_proofs").delete().eq("id", proofId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

// ─── DAMAGE TRACKING ─────────────────────────────────────────────────────
const DamageSchema = z.object({
  booking_id: z.string().uuid(),
  inventory_item_id: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(500),
  severity: z.enum(["minor", "moderate", "major"]),
  cost_dollars: z.number().min(0),
  customer_responsible: z.boolean(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function recordDamage(formData: FormData) {
  const me = await requireStaffOrAdmin();
  const parsed = DamageSchema.safeParse({
    booking_id: String(formData.get("booking_id") || ""),
    inventory_item_id: (formData.get("inventory_item_id") as string) || null,
    description: String(formData.get("description") || ""),
    severity: String(formData.get("severity") || "minor"),
    cost_dollars: parseFloat(String(formData.get("cost_dollars") || "0")) || 0,
    customer_responsible: formData.get("customer_responsible") === "on",
    notes: (formData.get("notes") as string) || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  // Optional photo
  let photoUrl: string | null = null;
  const photo = formData.get("photo") as File | null;
  if (photo && photo.size > 0) {
    const r = await uploadImage({
      bucket: "site-assets",
      file: photo,
      pathPrefix: `damages/${parsed.data.booking_id}`,
      filenameHint: "damage",
    });
    if (!("error" in r)) photoUrl = r.url;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("booking_damages").insert({
    booking_id: parsed.data.booking_id,
    inventory_item_id: parsed.data.inventory_item_id,
    description: parsed.data.description,
    severity: parsed.data.severity,
    cost_cents: Math.round(parsed.data.cost_dollars * 100),
    customer_responsible: parsed.data.customer_responsible,
    covered_by_protection: parsed.data.covered_by_protection,
    notes: parsed.data.notes,
    photo_url: photoUrl,
    recorded_by: me.email,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/bookings/${parsed.data.booking_id}`);
  return { success: true };
}

export async function toggleDamageCovered(
  damageId: string,
  bookingId: string,
  currentlyCovered: boolean,
) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("booking_damages")
    .update({ covered_by_protection: !currentlyCovered })
    .eq("id", damageId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

export async function toggleDamageCharged(damageId: string, bookingId: string, currentlyCharged: boolean) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("booking_damages")
    .update({ charged_to_customer: !currentlyCharged })
    .eq("id", damageId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

export async function toggleDamageResolved(damageId: string, bookingId: string, currentlyResolved: boolean) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("booking_damages")
    .update({ resolved: !currentlyResolved })
    .eq("id", damageId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

export async function deleteDamage(damageId: string, bookingId: string) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("booking_damages").delete().eq("id", damageId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}
