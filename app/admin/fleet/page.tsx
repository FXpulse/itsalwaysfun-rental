import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { FleetManager } from "./FleetManager";
import { BulkUploadButton } from "@/components/admin/BulkUploadButton";
import { bulkUploadVehicles, bulkUploadTrailers } from "../bulk-upload/actions";

export const dynamic = "force-dynamic";

export interface VehicleRow {
  id: string;
  name: string;
  vehicle_type: "truck" | "van" | "pickup" | "other";
  requires_trailer: boolean;
  capacity_notes: string | null;
  vin: string | null;
  license_tag: string | null;
  is_active: boolean;
}

export interface TrailerRow {
  id: string;
  name: string;
  capacity_notes: string | null;
  vin: string | null;
  license_tag: string | null;
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
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-brand-navy">Fleet</h1>
        <div className="flex gap-2">
          <BulkUploadButton
            label="Bulk vehicles"
            templateUrl="/api/templates/vehicles"
            uploadAction={bulkUploadVehicles}
            description="Bulk add vehicles from a CSV."
          />
          <BulkUploadButton
            label="Bulk trailers"
            templateUrl="/api/templates/trailers"
            uploadAction={bulkUploadTrailers}
            description="Bulk add trailers from a CSV."
          />
        </div>
      </div>
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
