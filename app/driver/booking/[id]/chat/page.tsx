// Per-booking team chat — driver-side full thread + inspection access.
// Drives the InternalMessagesThread + BookingInspectionsSection components
// that admin uses, with driver permissions.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { listMentionableUsers } from "@/app/admin/bookings/[id]/internal-messages-actions";
import { suggestTemplateForBooking } from "@/app/admin/inspections/actions";
import { InternalMessagesThread } from "@/app/admin/bookings/[id]/InternalMessagesThread";
import { BookingInspectionsSection } from "@/app/admin/bookings/[id]/BookingInspectionsSection";

export const dynamic = "force-dynamic";

export default async function DriverBookingChatPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();
  const me = await getCurrentUserRole();
  if (!me) notFound();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, customer_first_name, customer_last_name, event_date, product_name, booking_status")
    .eq("id", params.id)
    .maybeSingle();
  if (!booking) notFound();

  const [{ data: messagesRows }, mentionRes, { data: inspectionRows }, suggestedRes] = await Promise.all([
    supabase
      .from("booking_internal_messages")
      .select("id, body, author_user_id, author_name, author_role, mention_user_ids, created_at, deleted_at, edited_at")
      .eq("booking_id", params.id)
      .order("created_at", { ascending: true }),
    listMentionableUsers().catch(() => ({ users: [] })),
    supabase
      .from("booking_inspections")
      .select("id, type, overall_status, performed_at, inspector_name, items_result, notes")
      .eq("booking_id", params.id)
      .order("performed_at", { ascending: false }),
    suggestTemplateForBooking(params.id).catch(() => ({ template: null })),
  ]);

  const messages = (messagesRows as any[]) || [];
  const mentionableUsers = ((mentionRes as any)?.users as any[]) || [];
  const inspections = (inspectionRows as any[]) || [];
  const suggestedTemplate = (suggestedRes as any)?.template || null;

  const fullName = `${(booking as any).customer_first_name} ${(booking as any).customer_last_name}`.trim();

  return (
    <div>
      <div className="mb-4">
        <Link href="/driver/inbox" className="text-sm text-slate-500 hover:underline inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Inbox
        </Link>
      </div>

      <div className="mb-4">
        <h1 className="text-lg font-bold text-brand-navy">{fullName}</h1>
        <p className="text-xs text-slate-500">
          {(booking as any).product_name} · {(booking as any).event_date}
        </p>
      </div>

      {/* Chat thread */}
      <div className="mb-6">
        <InternalMessagesThread
          bookingId={(booking as any).id}
          currentUserId={me.id}
          initialMessages={messages}
          mentionableUsers={mentionableUsers}
        />
      </div>

      {/* Inspection section */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" /> Inspections
        </h2>
        <BookingInspectionsSection
          bookingId={(booking as any).id}
          bookingStatus={(booking as any).booking_status || ""}
          suggestedTemplate={suggestedTemplate}
          inspections={inspections}
        />
      </div>
    </div>
  );
}
