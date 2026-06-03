"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Camera,
  X,
  Edit3,
  Trash2,
  Check,
  Loader2,
  ImageIcon,
  RotateCcw,
} from "lucide-react";
import { uploadProofPhoto, saveProof, deleteProof } from "./proof-actions";
import { formatDateTimeInTz } from "@/lib/tenant/timezone";

interface PhotoSpec {
  url: string;
  caption: string;
  sort_order: number;
}

export interface ProofData {
  id: string;
  booking_id: string;
  phase: "delivery" | "pickup";
  captured_at: string;
  captured_by: string | null;
  customer_signature_url: string | null;
  customer_signature_name: string | null;
  photos: PhotoSpec[];
  condition_notes: string | null;
}

export function ProofCapture({
  bookingId,
  phase,
  existing,
  tz = "America/New_York",
}: {
  bookingId: string;
  phase: "delivery" | "pickup";
  existing: ProofData | null;
  tz?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [photos, setPhotos] = useState<PhotoSpec[]>(existing?.photos || []);
  const [signatureName, setSignatureName] = useState(
    existing?.customer_signature_name || "",
  );
  const [notes, setNotes] = useState(existing?.condition_notes || "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [signatureChanged, setSignatureChanged] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const c = canvasRef.current;
    if (!c) return;
    // High-DPI scaling
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
    }
  }, [editing]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setSignatureChanged(true);
  }

  function stopDrawing() {
    setDrawing(false);
  }

  function clearSignature() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    setSignatureChanged(false);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    // Wrap in try/catch so a thrown server action doesn't become an
    // unhandled promise rejection (the previous IIFE had no .catch, which
    // is how Sentry was getting `Cannot use 'in' operator on undefined`).
    (async () => {
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("photo", file);
          let r: any;
          try {
            r = await uploadProofPhoto(bookingId, phase, fd);
          } catch (e: any) {
            // Server action threw — fall back to a structured error
            r = { error: e?.message || "Upload failed (network or auth)" };
          }
          // r could legitimately be undefined if the action implicitly
          // returns void on an unexpected path; treat that as a generic error
          const err = r && typeof r === "object" && "error" in r ? r.error : null;
          if (err) {
            toast.error(`${file.name}: ${err}`);
            continue;
          }
          if (r && typeof r === "object" && "url" in r && r.url) {
            const url = r.url as string;
            setPhotos((prev) => [
              ...prev,
              { url, caption: "", sort_order: prev.length },
            ]);
          } else {
            toast.error(`${file.name}: upload returned no URL`);
          }
        }
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    })();
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCaption(idx: number, caption: string) {
    setPhotos((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, caption } : p)),
    );
  }

  function handleSave() {
    const fd = new FormData();
    fd.append("booking_id", bookingId);
    fd.append("phase", phase);
    fd.append("photos", JSON.stringify(photos));
    fd.append("customer_signature_name", signatureName);
    fd.append("condition_notes", notes);

    if (signatureChanged && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      fd.append("signature_dataurl", dataUrl);
    }

    startTransition(async () => {
      let r: any;
      try {
        r = await saveProof(fd);
      } catch (e: any) {
        toast.error(e?.message || "Save failed (network or auth)");
        return;
      }
      const err = r && typeof r === "object" && "error" in r ? r.error : null;
      if (err) {
        toast.error(err);
        return;
      }
      toast.success(`${phase === "delivery" ? "Delivery" : "Pickup"} proof saved`);
      setEditing(false);
      setSignatureChanged(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!existing) return;
    if (!confirm(`Delete ${phase} proof? Photos + signature will be removed.`)) return;
    startTransition(async () => {
      let r: any;
      try {
        r = await deleteProof(existing.id, bookingId);
      } catch (e: any) {
        toast.error(e?.message || "Delete failed (network or auth)");
        return;
      }
      const err = r && typeof r === "object" && "error" in r ? r.error : null;
      if (err) {
        toast.error(err);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }

  // ─── DISPLAY MODE ─────────────────────────────────────────────────
  if (!editing) {
    if (!existing) {
      return (
        <div className="card border-dashed border-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-brand-navy flex items-center gap-2">
                <Camera className="h-4 w-4" />
                {phase === "delivery" ? "Delivery proof" : "Pickup proof"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Photos + customer signature at {phase === "delivery" ? "drop-off" : "return"}
              </p>
            </div>
            <button onClick={() => setEditing(true)} className="btn-primary text-sm">
              <Camera className="h-4 w-4 inline mr-1" /> Capture
            </button>
          </div>
        </div>
      );
    }

    // Show existing proof read-only
    return (
      <div className="card">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-brand-navy flex items-center gap-2">
              <Camera className="h-4 w-4" />
              {phase === "delivery" ? "Delivery proof" : "Pickup proof"}
              <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5 font-normal">
                ✓ Captured
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {existing.captured_by || "unknown"} on{" "}
              {formatDateTimeInTz(existing.captured_at, tz)}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-slate-600 hover:text-brand-navy"
              title="Edit"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 text-red-600 hover:text-red-800"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {existing.photos && existing.photos.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-3">
            {existing.photos.map((p, i) => (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square relative bg-slate-100 rounded overflow-hidden hover:opacity-80"
              >
                <Image
                  src={p.url}
                  alt={p.caption || `Photo ${i + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {p.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                    {p.caption}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}

        {existing.customer_signature_url && (
          <div className="bg-slate-50 rounded p-2 mb-2">
            <div className="text-xs text-slate-500 mb-1">Customer signature:</div>
            <div className="flex items-center gap-3">
              <Image
                src={existing.customer_signature_url}
                alt="Customer signature"
                width={200}
                height={80}
                className="bg-white border border-slate-200 rounded"
                unoptimized
              />
              {existing.customer_signature_name && (
                <div className="text-sm">
                  <div className="font-semibold">{existing.customer_signature_name}</div>
                  <div className="text-xs text-slate-500">printed name</div>
                </div>
              )}
            </div>
          </div>
        )}

        {existing.condition_notes && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm">
            <div className="text-xs font-semibold text-amber-900 mb-1">Notes:</div>
            <p className="text-amber-900 whitespace-pre-wrap">{existing.condition_notes}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── EDIT MODE ────────────────────────────────────────────────────
  return (
    <div className="card border-2 border-blue-300 bg-blue-50/30">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-brand-navy flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Capture {phase} proof
        </h3>
        <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Photos */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 mb-2">
          Photos ({photos.length})
        </label>

        {photos.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-2">
            {photos.map((p, i) => (
              <div key={i} className="relative bg-slate-100 rounded overflow-hidden">
                <div className="aspect-square relative">
                  <Image
                    src={p.url}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <input
                  type="text"
                  value={p.caption}
                  onChange={(e) => updateCaption(i, e.target.value)}
                  placeholder="Caption"
                  className="w-full text-[10px] px-1 py-0.5 bg-white border-t border-slate-200"
                />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-slate-300 rounded-md py-3 text-sm text-slate-600 hover:border-brand-navy hover:bg-white inline-flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4" /> Add photos (camera or files)
            </>
          )}
        </button>
      </div>

      {/* Signature canvas */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-700">
            Customer signature
          </label>
          <button
            type="button"
            onClick={clearSignature}
            className="text-xs text-slate-500 hover:text-brand-navy inline-flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Clear
          </button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className="w-full h-32 border-2 border-slate-300 rounded-md bg-white touch-none cursor-crosshair"
          style={{ touchAction: "none" }}
        />
        <input
          type="text"
          value={signatureName}
          onChange={(e) => setSignatureName(e.target.value)}
          placeholder="Customer printed name"
          className="input mt-2"
        />
        {existing?.customer_signature_url && !signatureChanged && (
          <p className="text-xs text-slate-500 mt-1">
            ℹ️ Existing signature kept. Sign above to replace.
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Condition notes (optional)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Setup location, customer requests, anything noteworthy..."
          className="input"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={pending || uploading}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Check className="h-4 w-4" />
          {pending ? "Saving..." : "Save proof"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
