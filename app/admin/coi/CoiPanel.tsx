"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  CheckCircle2,
  ExternalLink,
  X,
  Calendar,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import {
  uploadCoi,
  markCoiDelivered,
  cancelCoiRequest,
} from "./actions";
import type { CoiRow } from "./page";

const STATUS_LABEL: Record<string, string> = {
  requested: "Pending — generate + upload",
  uploaded: "Uploaded — customer notified",
  delivered_to_venue: "Delivered to venue ✓",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800 border-amber-300",
  uploaded: "bg-blue-100 text-blue-800 border-blue-300",
  delivered_to_venue: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-slate-200 text-slate-600 border-slate-300",
};

export function CoiPanel({ request: r }: { request: CoiRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [showDelivered, setShowDelivered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("coi_file", file);
    const result = await uploadCoi(r.id, fd);
    setUploading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("COI uploaded + emailed to customer");
    router.refresh();
  }

  function handleMarkDelivered() {
    startTransition(async () => {
      const result = await markCoiDelivered(r.id, deliveryNote);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Marked as delivered to venue");
      setShowDelivered(false);
      router.refresh();
    });
  }

  function handleCancel() {
    if (!cancelReason.trim()) {
      toast.error("Add a reason for cancellation");
      return;
    }
    startTransition(async () => {
      const result = await cancelCoiRequest(r.id, cancelReason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Request cancelled");
      setShowCancel(false);
      router.refresh();
    });
  }

  return (
    <div
      className={`card border-l-4 ${
        r.status === "requested"
          ? "border-l-amber-500"
          : r.status === "uploaded"
            ? "border-l-blue-500"
            : r.status === "delivered_to_venue"
              ? "border-l-green-500"
              : "border-l-slate-300 opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <strong className="text-brand-navy">{r.venue_name}</strong>
            <span
              className={`text-xs rounded px-2 py-0.5 border ${STATUS_STYLES[r.status]}`}
            >
              {STATUS_LABEL[r.status]}
            </span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Event {r.booking_event_date}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {r.booking_customer_name}
            </span>
            {r.booking_customer_phone && (
              <a href={`tel:${r.booking_customer_phone}`} className="inline-flex items-center gap-1 hover:text-brand-navy">
                <Phone className="h-3 w-3" /> {r.booking_customer_phone}
              </a>
            )}
            <a href={`mailto:${r.requested_by_email}`} className="inline-flex items-center gap-1 hover:text-brand-navy">
              <Mail className="h-3 w-3" /> {r.requested_by_email}
            </a>
          </div>
        </div>
        <Link
          href={`/admin/bookings/${r.booking_id}`}
          className="text-xs text-brand-navy hover:underline whitespace-nowrap"
        >
          Open booking →
        </Link>
      </div>

      <div className="bg-slate-50 rounded p-3 mb-3 text-xs space-y-1.5">
        {r.venue_address && (
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Venue address:</strong> {r.venue_address}
            </div>
          </div>
        )}
        <div>
          <strong>Additional insured:</strong>{" "}
          {r.additional_insured || (
            <em className="text-slate-500">use venue name</em>
          )}
        </div>
        {r.special_instructions && (
          <div className="bg-white border border-slate-200 rounded p-2 mt-2">
            <strong className="block text-slate-700 mb-1">Special instructions:</strong>
            <p className="text-slate-600 whitespace-pre-line">{r.special_instructions}</p>
          </div>
        )}
        {r.admin_notes && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
            <strong className="block text-blue-900 mb-1">Admin notes:</strong>
            <p className="text-blue-800 whitespace-pre-line">{r.admin_notes}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {r.status !== "cancelled" && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || pending}
              className="inline-flex items-center gap-2 bg-brand-navy text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-brand-navy-dark disabled:opacity-50"
            >
              <Upload className="h-3 w-3" />
              {uploading
                ? "Uploading..."
                : r.coi_file_url
                  ? "Replace COI"
                  : "Upload COI (PDF)"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
          </>
        )}

        {r.coi_file_url && (
          <a
            href={r.coi_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 border border-slate-300 text-sm rounded px-3 py-1.5 hover:bg-slate-50 text-slate-700"
          >
            <FileText className="h-3 w-3" />
            View current COI
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {r.status === "uploaded" && (
          <button
            type="button"
            onClick={() => setShowDelivered(true)}
            disabled={pending}
            className="inline-flex items-center gap-1 bg-green-600 text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-green-700"
          >
            <CheckCircle2 className="h-3 w-3" /> Mark delivered to venue
          </button>
        )}

        {r.status !== "cancelled" && r.status !== "delivered_to_venue" && (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            disabled={pending}
            className="inline-flex items-center gap-1 border border-red-300 text-red-700 text-sm font-semibold rounded px-3 py-1.5 hover:bg-red-50"
          >
            <X className="h-3 w-3" /> Cancel request
          </button>
        )}
      </div>

      {/* Inline modal: mark delivered */}
      {showDelivered && (
        <div className="mt-3 bg-white border border-green-200 rounded p-3 space-y-2">
          <label className="block text-xs text-slate-600">
            Delivery note (optional — e.g. "emailed to facilities@school.edu")
          </label>
          <input
            type="text"
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            placeholder="Sent to venue contact on 2026-..."
            className="input text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleMarkDelivered}
              disabled={pending}
              className="bg-green-600 text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-green-700"
            >
              {pending ? "Saving..." : "Confirm delivered"}
            </button>
            <button
              onClick={() => setShowDelivered(false)}
              className="text-xs text-slate-600 hover:text-slate-900 px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="mt-3 bg-white border border-red-200 rounded p-3 space-y-2">
          <label className="block text-xs text-slate-600">
            Cancellation reason (shown to admin only)
          </label>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Venue actually didn't need COI, customer cancelled booking"
            autoFocus
            className="input text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={pending}
              className="bg-red-600 text-white text-sm font-semibold rounded px-3 py-1.5 hover:bg-red-700"
            >
              {pending ? "Cancelling..." : "Confirm cancel"}
            </button>
            <button
              onClick={() => setShowCancel(false)}
              className="text-xs text-slate-600 hover:text-slate-900 px-2"
            >
              Keep open
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
