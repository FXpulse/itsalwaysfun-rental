"use client";

// Sección de inspecciones para el booking detail page.
// Muestra historial + permite crear nueva inspección (delivery / pickup / spot_check)
// usando el template sugerido para el producto del booking.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { createInspection } from "@/app/admin/inspections/actions";

interface TemplateItem { key: string; label: string }
interface Template { id: string; name: string; items: TemplateItem[] }

interface InspectionRecord {
  id: string;
  type: "delivery" | "pickup" | "spot_check";
  overall_status: "pending" | "passed" | "failed" | "passed_with_issues";
  performed_at: string;
  inspector_name: string | null;
  items_result: Array<{ key: string; label: string; status: "pass" | "fail" | "skip"; notes?: string | null }>;
  notes: string | null;
}

interface Props {
  bookingId: string;
  bookingStatus: string;
  suggestedTemplate: Template | null;
  inspections: InspectionRecord[];
}

interface ItemDraft {
  key: string;
  label: string;
  status: "pass" | "fail" | "skip";
  notes: string;
}

export function BookingInspectionsSection({
  bookingId,
  bookingStatus,
  suggestedTemplate,
  inspections,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeType, setActiveType] = useState<"delivery" | "pickup" | "spot_check" | null>(null);
  const [inspectorName, setInspectorName] = useState("");
  const [overallNotes, setOverallNotes] = useState("");
  const [draft, setDraft] = useState<ItemDraft[]>([]);

  const isClosed = ["cancelled", "completed", "no_show"].includes(bookingStatus);

  function startInspection(type: "delivery" | "pickup" | "spot_check") {
    if (!suggestedTemplate) {
      toast.error("No inspection template defined. Create one at /admin/inspections first.");
      return;
    }
    setActiveType(type);
    setDraft(
      suggestedTemplate.items.map((it) => ({
        key: it.key,
        label: it.label,
        status: "pass",
        notes: "",
      }))
    );
  }

  function cancelDraft() {
    setActiveType(null);
    setDraft([]);
    setInspectorName("");
    setOverallNotes("");
  }

  function setItemStatus(idx: number, status: "pass" | "fail" | "skip") {
    setDraft((prev) => prev.map((it, i) => (i === idx ? { ...it, status } : it)));
  }
  function setItemNotes(idx: number, notes: string) {
    setDraft((prev) => prev.map((it, i) => (i === idx ? { ...it, notes } : it)));
  }

  function submitInspection() {
    if (!activeType) return;
    if (draft.length === 0) return;

    startTransition(async () => {
      const r = await createInspection({
        booking_id: bookingId,
        template_id: suggestedTemplate?.id || null,
        type: activeType,
        inspector_name: inspectorName.trim() || null,
        items_result: draft.map((it) => ({
          key: it.key,
          label: it.label,
          status: it.status,
          notes: it.notes.trim() || null,
          photo_urls: [],
        })),
        notes: overallNotes.trim() || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const overall = (r as any).overall_status;
      toast.success(
        overall === "failed"
          ? "Inspection saved — issues flagged"
          : overall === "passed_with_issues"
            ? "Inspection saved — minor notes"
            : "Inspection passed ✓"
      );
      cancelDraft();
      router.refresh();
    });
  }

  function statusBadge(status: InspectionRecord["overall_status"]) {
    const cfg = {
      passed: { bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle2 },
      passed_with_issues: { bg: "bg-amber-100", text: "text-amber-800", icon: AlertTriangle },
      failed: { bg: "bg-red-100", text: "text-red-800", icon: XCircle },
      pending: { bg: "bg-slate-100", text: "text-slate-600", icon: ClipboardCheck },
    }[status] || { bg: "bg-slate-100", text: "text-slate-600", icon: ClipboardCheck };
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${cfg.bg} ${cfg.text}`}>
        <Icon className="h-3 w-3" />
        {status.replace(/_/g, " ")}
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-slate-500" />
          <h2 className="font-bold text-slate-800">Condition inspections</h2>
        </div>
        {!activeType && !isClosed && (
          <div className="flex gap-2">
            <button
              onClick={() => startInspection("delivery")}
              className="text-xs rounded-md bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700"
            >
              + Delivery
            </button>
            <button
              onClick={() => startInspection("pickup")}
              className="text-xs rounded-md bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700"
            >
              + Pickup
            </button>
            <button
              onClick={() => startInspection("spot_check")}
              className="text-xs rounded-md bg-slate-600 text-white px-3 py-1.5 hover:bg-slate-700"
            >
              + Spot check
            </button>
          </div>
        )}
      </div>

      {/* Active draft */}
      {activeType && draft.length > 0 && (
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-800">
              New {activeType.replace("_", " ")} inspection
              {suggestedTemplate && (
                <span className="text-xs text-slate-500 ml-2">({suggestedTemplate.name})</span>
              )}
            </h3>
            <button
              onClick={cancelDraft}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          <input
            type="text"
            value={inspectorName}
            onChange={(e) => setInspectorName(e.target.value)}
            placeholder="Inspector name (driver/admin)"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            maxLength={120}
          />

          <div className="space-y-2">
            {draft.map((it, idx) => (
              <div key={it.key} className="bg-white rounded p-3 border border-slate-200">
                <div className="flex items-center gap-2 justify-between">
                  <span className="text-sm font-medium">{it.label}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setItemStatus(idx, "pass")}
                      className={`text-xs px-2 py-1 rounded ${it.status === "pass" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    >Pass</button>
                    <button
                      onClick={() => setItemStatus(idx, "fail")}
                      className={`text-xs px-2 py-1 rounded ${it.status === "fail" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    >Fail</button>
                    <button
                      onClick={() => setItemStatus(idx, "skip")}
                      className={`text-xs px-2 py-1 rounded ${it.status === "skip" ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    >Skip</button>
                  </div>
                </div>
                {(it.status === "fail" || it.notes) && (
                  <input
                    type="text"
                    value={it.notes}
                    onChange={(e) => setItemNotes(idx, e.target.value)}
                    placeholder={it.status === "fail" ? "What's wrong? (required for fails)" : "Optional notes"}
                    className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    maxLength={500}
                  />
                )}
              </div>
            ))}
          </div>

          <textarea
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
            placeholder="Overall notes (optional)"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            maxLength={2000}
          />

          <div className="flex gap-2">
            <button
              onClick={submitInspection}
              disabled={pending}
              className="rounded-md bg-brand-navy text-white px-4 py-2 text-sm font-medium hover:bg-brand-navy-dark disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save inspection"}
            </button>
            <button
              onClick={cancelDraft}
              disabled={pending}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {inspections.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-500">
          No inspections yet. Run one at delivery and another at pickup to document condition.
          {!suggestedTemplate && (
            <div className="mt-2">
              <a href="/admin/inspections/new" className="text-brand-navy hover:underline">
                Create your first template →
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {inspections.map((insp) => {
            const fails = insp.items_result.filter((r) => r.status === "fail");
            return (
              <div key={insp.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium capitalize">
                      {insp.type.replace("_", " ")}
                    </span>
                    {statusBadge(insp.overall_status)}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(insp.performed_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mb-2">
                  Inspector: {insp.inspector_name || "—"}
                </div>
                {fails.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-xs">
                    <strong className="text-red-700">Failed items:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {fails.map((f) => (
                        <li key={f.key}>
                          {f.label}
                          {f.notes && <span className="text-slate-600"> — {f.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {insp.notes && (
                  <p className="text-xs text-slate-600 italic mt-2">{insp.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
