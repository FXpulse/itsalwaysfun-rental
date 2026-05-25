import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { FleetManager } from "./FleetManager";

export const dynamic = "force-dynamic";

export interface VehicleRow {
  id: string;
  name: string;
  vehicle_type: "truck" | "van" | "pickup" | "other";
  requires_trailer: boolean;
  capacity_notes: string | null;
  is_active: boolean;
}

export interface TrailerRow {
  id: string;
  name: string;
  capacity_notes: string | null;
  is_active: boolean;
}

export default async function AdminFleetPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const [{ data: vehicles }, { data: trailers }] = await Promise.all([
    supabase.from("vehicles").select("*").order("name"),
    supabase.from("trailers").select("*").order("name"),
  ]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Fleet</h1>
      <p className="text-sm text-slate-500 mb-6">
        Vehicles + trailers used for dispatch routes. Configure once, assign per
        event day in <a href="/admin/dispatch" className="text-brand-navy underline">Dispatch</a>.
      </p>
      <FleetManager
        vehicles={(vehicles as VehicleRow[]) || []}
        trailers={(trailers as TrailerRow[]) || []}
      />
    </div>
  );
}
