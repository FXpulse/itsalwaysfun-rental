"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Upload,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Pencil,
  X,
} from "lucide-react";
import {
  uploadBanner,
  updateBanner,
  toggleBannerActive,
  deleteBanner,
  reorderBanner,
} from "./actions";
import type { BannerRow } from "./page";

export function BannersManager({ banners }: { banners: BannerRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function refresh() {
    router.refresh();
  }

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      const r = await uploadBanner(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Banner uploaded");
      formRef.current?.reset();
      refresh();
    });
  }

  function handleToggle(b: BannerRow) {
    startTransition(async () => {
      const r = await toggleBannerActive(b.id, b.is_active);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      refresh();
    });
  }

  function handleDelete(b: BannerRow) {
    if (!confirm("Delete this banner? This cannot be undone.")) return;
    startTransition(async () => {
      const r = await deleteBanner(b.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Deleted");
      refresh();
    });
  }

  function handleMove(b: BannerRow, direction: "up" | "down") {
    startTransition(async () => {
      const r = await reorderBanner(b.id, direction);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      refresh();
    });
  }

  function handleEdit(formData: FormData) {
    if (!editing) return;
    startTransition(async () => {
      const r = await updateBanner(editing.id, formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Updated");
      setEditing(null);
      refresh();
    });
  }

  return (
    <>
      {/* Upload form */}
      <form ref={formRef} action={handleUpload} className="card mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
          Upload new banner
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs text-slate-600 mb-1">
              Image (1920×600 recommended, max 5 MB) <span className="text-red-500">*</span>
            </label>
            <input
              ref={fileInputRef}
              name="image"
              type="file"
              required
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Alt text (accessibility)
            </label>
            <input
              name="alt_text"
              type="text"
              className="input"
              placeholder="Summer sale banner"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Click-through URL (optional)
            </label>
            <input
              name="link_url"
              type="text"
              className="input"
              placeholder="/rentals or https://..."
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary inline-flex items-center gap-2 justify-center"
          >
            <Upload className="h-4 w-4" /> {pending ? "Uploading..." : "Upload banner"}
          </button>
        </div>
      </form>

      {/* Banner list */}
      {banners.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          No banners yet. Upload your first one above.
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b, i) => (
            <div
              key={b.id}
              className={`card flex items-center gap-4 p-3 ${!b.is_active ? "opacity-50" : ""}`}
            >
              {/* Thumbnail */}
              <div className="w-32 h-20 relative bg-slate-100 rounded overflow-hidden flex-shrink-0">
                <Image
                  src={b.image_url}
                  alt={b.alt_text || "banner"}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{b.alt_text || "(no alt text)"}</div>
                {b.link_url && (
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{b.link_url}</span>
                  </div>
                )}
                <div className="text-xs text-slate-400 mt-1">
                  Position {i + 1} · {b.is_active ? "Active" : "Hidden"}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleMove(b, "up")}
                  disabled={pending || i === 0}
                  className="p-2 hover:bg-slate-100 rounded disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp className="h-4 w-4 text-slate-600" />
                </button>
                <button
                  onClick={() => handleMove(b, "down")}
                  disabled={pending || i === banners.length - 1}
                  className="p-2 hover:bg-slate-100 rounded disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown className="h-4 w-4 text-slate-600" />
                </button>
                <button
                  onClick={() => setEditing(b)}
                  className="p-2 hover:bg-slate-100 rounded"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4 text-slate-600" />
                </button>
                <button
                  onClick={() => handleToggle(b)}
                  className="p-2 hover:bg-slate-100 rounded"
                  title={b.is_active ? "Hide from carousel" : "Show in carousel"}
                >
                  {b.is_active ? (
                    <Eye className="h-4 w-4 text-slate-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(b)}
                  className="p-2 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-brand-navy">Edit banner</h2>
              <button
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form action={handleEdit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Alt text</label>
                <input
                  name="alt_text"
                  type="text"
                  defaultValue={editing.alt_text || ""}
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Click-through URL</label>
                <input
                  name="link_url"
                  type="text"
                  defaultValue={editing.link_url || ""}
                  className="input"
                  placeholder="/rentals or https://..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={pending} className="btn-primary flex-1">
                  {pending ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
