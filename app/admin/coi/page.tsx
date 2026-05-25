import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { ShieldCheck } from "lucide-react";
import { CoiPanel } from "./CoiPanel";

export const dynamic = "force-dynamic";

export interface CoiRow {
  id: string;
  booking_id: string;
  venue_name: string;
  venue_address: string | null;
  additional_insured: string | null;
  special_instructions: string | null;
  requested_by_email: string;
  status: "requested" | "uploaded" | "delivered_to_venue" | "cancelled";
  coi_file_url: string | null;
  admin_notes: string | null;
  requested_at: string;
  uploaded_at: string | null;
  delivered_at: string | null;
  // Joined from bookings
  booking_event_date: string;
  booking_customer_name: string;
  booking_customer_phone: string | null;
}

export default async function AdminCoiPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  // Join bookings for context
  const { data: rows } = await supabase
    .from("coi_requests")
    .select(
      `*, bookings ( event_date, customer_first_name, customer_last_name, customer_phone )`,
    )
    .order("status")
    .order("requested_at", { ascending: false });

  const list: CoiRow[] = ((rows as any[]) || []).map((r) => ({
    ...r,
    booking_event_date: r.bookings?.event_date || "",
    booking_customer_name:
      `${r.bookings?.customer_first_name || ""} ${r.bookings?.customer_last_name || ""}`.trim(),
    booking_customer_phone: r.bookings?.customer_phone || null,
  }));

  const counts = {
    requested: list.filter((r) => r.status === "requested").length,
    uploaded: list.filter((r) => r.status === "uploaded").length,
    delivered: list.filter((r) => r.status === "delivered_to_venue").length,
    cancelled: list.filter((r) => r.status === "cancelled").length,
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <ShieldCheck className="h-6 w-6" /> Certificates of Insurance (COI)
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Customers request COIs at checkout when their venue requires proof of
        insurance. Generate the COI with your broker, upload here — customer
        gets emailed automatically + can download from their portal.
      </p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat label="Pending request" value={String(counts.requested)} accent={counts.requested > 0} />
        <Stat label="Uploaded" value={String(counts.uploaded)} />
        <Stat label="Delivered" value={String(counts.delivered)} />
        <Stat label="Cancelled" value={String(counts.cancelled)} />
      </div>

      {list.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>No COI requests yet.</p>
          <p className="text-xs mt-2">
            They'll appear here when customers check the "My venue requires a
            Certificate of Insurance" box at checkout.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <CoiPanel key={r.id} request={r} />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-6 text-center">
        Need to disable the COI option at checkout? Toggle{" "}
        <code>coi_request_enabled</code> in{" "}
        <Link href="/admin/site" className="underline">Website content → legal</Link>.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card py-3 ${accent ? "bg-amber-50 border-amber-200" : ""}`}>
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold text-brand-navy mt-1">{value}</div>
    </div>
  );
}
