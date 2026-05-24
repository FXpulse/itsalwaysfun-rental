import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function PortalProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  // Get latest booking to pre-fill if no metadata exists yet
  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("bookings")
    .select(
      "customer_first_name, customer_last_name, customer_phone, customer_address",
    )
    .ilike("customer_email", user.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta = user.user_metadata || {};
  const initial = {
    first_name: meta.first_name || latest?.customer_first_name || "",
    last_name: meta.last_name || latest?.customer_last_name || "",
    phone: meta.phone || latest?.customer_phone || "",
    address: meta.address || latest?.customer_address || "",
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Profile</h1>
      <p className="text-sm text-slate-500 mb-6">
        Saved info pre-fills your booking forms — no more re-typing each time.
      </p>

      <div className="card mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Account
        </h2>
        <p className="text-sm">
          <strong>Email:</strong> {user.email}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Sign in by email — no password to remember.
        </p>
      </div>

      <ProfileForm initial={initial} />
    </div>
  );
}
