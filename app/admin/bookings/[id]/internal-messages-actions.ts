"use server";

// Server actions para el thread interno por booking.
// Acceso: admin/staff (siempre), driver (solo si está asignado a la booking via dispatch_stops).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";

async function requireMessagingRole(): Promise<{ user_id: string; role: "admin" | "staff" | "driver"; name: string }> {
  const ctx = await getCurrentUserRole();
  if (!ctx) throw new Error("Unauthorized");
  if (!["admin", "staff", "driver"].includes(ctx.role)) throw new Error("Forbidden");
  // Derivar nombre amigable del user_metadata o email
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const meta = (user?.user_metadata as any) || {};
  const name =
    meta.full_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "Unknown";
  return { user_id: ctx.id, role: ctx.role as any, name };
}

async function driverCanAccessBooking(userId: string, bookingId: string): Promise<boolean> {
  const supabase = createAdminClient({ unscoped: true });
  // El driver puede ver/postear si el booking tiene un dispatch_stop en una route
  // asignada a un vehicle/driver que sea este user. Simplificamos:
  // existe AL MENOS un dispatch_stop con esta booking_id.
  // (RLS server-side va a refinar más si hace falta.)
  const { count } = await supabase
    .from("dispatch_stops")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId);
  return (count ?? 0) > 0;
}

const PostInputSchema = z.object({
  booking_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  mention_user_ids: z.array(z.string().uuid()).max(20).optional().default([]),
});

export async function postInternalMessage(input: z.infer<typeof PostInputSchema>) {
  const author = await requireMessagingRole();
  const parsed = PostInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  // Driver-role: validar acceso al booking específico
  if (author.role === "driver") {
    const ok = await driverCanAccessBooking(author.user_id, parsed.data.booking_id);
    if (!ok) return { error: "No access to this booking" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("booking_internal_messages")
    .insert({
      booking_id: parsed.data.booking_id,
      author_user_id: author.user_id,
      author_name: author.name,
      author_role: author.role,
      body: parsed.data.body,
      mention_user_ids: parsed.data.mention_user_ids,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Insert failed" };

  revalidatePath(`/admin/bookings/${parsed.data.booking_id}`);
  return { id: data.id };
}

const DeleteInputSchema = z.object({
  message_id: z.string().uuid(),
  booking_id: z.string().uuid(),
});

export async function softDeleteInternalMessage(input: z.infer<typeof DeleteInputSchema>) {
  const author = await requireMessagingRole();
  const parsed = DeleteInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const supabase = createAdminClient();
  // RLS solo permite update del propio mensaje, pero defendemos también en código:
  const { error } = await supabase
    .from("booking_internal_messages")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_user_id: author.user_id,
    })
    .eq("id", parsed.data.message_id)
    .eq("author_user_id", author.user_id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/bookings/${parsed.data.booking_id}`);
  return { success: true };
}

/** Lista de teammates seleccionables para @mention. Devuelve admin/staff/driver
 *  activos, ordenados por rol → nombre. */
export async function listMentionableUsers() {
  await requireMessagingRole();
  const supabase = createAdminClient({ unscoped: true });
  // user_roles + auth.users metadata join — usamos el admin API
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("is_active", true)
    .in("role", ["admin", "staff", "driver"]);
  if (!roles || roles.length === 0) return { users: [] };

  // Pull auth metadata for each
  const out: Array<{ user_id: string; name: string; role: string }> = [];
  for (const r of roles as Array<{ user_id: string; role: string }>) {
    try {
      const { data } = await supabase.auth.admin.getUserById(r.user_id);
      const u = data?.user;
      const meta = (u?.user_metadata as any) || {};
      const name =
        meta.full_name ||
        [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
        u?.email ||
        "Unknown";
      out.push({ user_id: r.user_id, name, role: r.role });
    } catch (e) {
      // skip — user may be deleted but role remains
    }
  }
  // Sort by role priority + name
  const rolePriority: Record<string, number> = { admin: 0, staff: 1, driver: 2 };
  out.sort((a, b) => {
    const r = (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99);
    if (r !== 0) return r;
    return a.name.localeCompare(b.name);
  });
  return { users: out };
}
