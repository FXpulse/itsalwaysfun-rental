"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Upload,
  Link as LinkIcon,
  ArrowUp,
  ArrowDown,
  Star,
  Image as ImageIcon,
} from "lucide-react";
import {
  uploadProductGalleryImage,
  addProductImageByUrl,
  deleteProductImage,
  reorderProductImage,
  setPrimaryProductImage,
} from "./images-actions";

export interface GalleryImage {
  id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
}

export function GalleryManager({
  productId,
  primaryUrl,
  images,
}: {
  productId: string;
  primaryUrl: string | null;
  images: GalleryImage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addingUrl, setAddingUrl] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [altValue, setAltValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    router.refresh();
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    const r = await uploadProductGalleryImage(productId, fd);
    setUploading(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success("Image added to gallery");
    refresh();
  }

  function handleAddUrl(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("image_url", urlValue);
    if (altValue) fd.append("alt_text", altValue);
    startTransition(async () => {
      const r = await addProductImageByUrl(productId, fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Image added");
      setUrlValue("");
      setAltValue("");
      setAddingUrl(false);
      refresh();
    });
  }

  function handleDelete(img: GalleryImage) {
    if (!confirm("Remove this image from the gallery? Cannot undo.")) return;
    startTransition(async () => {
      const r = await deleteProductImage(img.id, productId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Removed");
      refresh();
    });
  }

  function handleReorder(img: GalleryImage, direction: "up" | "down") {
    startTransition(async () => {
      const r = await reorderProductImage(img.id, productId, direction);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      refresh();
    });
  }

  function handleSetPrimary(img: GalleryImage) {
    startTransition(async () => {
      const r = await setPrimaryProductImage(img.id, productId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Set as primary cover image");
      refresh();
    });
  }

  return (
    <div className="card mt-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy flex items-center gap-2">
            <ImageIcon className="h-5 w-5" /> Photo gallery ({images.length})
          </h2>
          <p className="text-xs text-slate-500">
            Extra photos shown on the product detail page as a clickable carousel.
            The image with the gold star is the <strong>primary cover</strong>{" "}
            (used on cards, search, the carousel default).
          </p>
        </div>
        {!addingUrl && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || pending}
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => setAddingUrl(true)}
              className="inline-flex items-center gap-2 text-sm border border-slate-300 rounded px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              <LinkIcon className="h-4 w-4" /> Add by URL
            </button>
          </div>
        )}
      </div>

      {/* Add by URL form */}
      {addingUrl && (
        <form
          onSubmit={handleAddUrl}
          className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 space-y-2"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Image URL *</label>
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://example.com/bouncer-2.jpg"
                required
                className="input"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Alt text (optional)</label>
              <input
                type="text"
                value={altValue}
                onChange={(e) => setAltValue(e.target.value)}
                placeholder="Side view"
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-sm">
              {pending ? "Adding..." : "Add to gallery"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingUrl(false);
                setUrlValue("");
                setAltValue("");
              }}
              className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Gallery grid */}
      {images.length === 0 ? (
        <div className="text-center text-slate-400 py-8 text-sm border-2 border-dashed border-slate-200 rounded">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No gallery photos yet. The primary cover image still shows everywhere
          — adding extras here just gives customers more views on the product page.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img, idx) => {
            const isPrimary = primaryUrl && img.image_url === primaryUrl;
            return (
              <div
                key={img.id}
                className={`relative rounded-lg overflow-hidden border-2 ${
                  isPrimary ? "border-amber-400 ring-2 ring-amber-200" : "border-slate-200"
                }`}
              >
                <div className="aspect-square bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.image_url}
                    alt={img.alt_text || ""}
                    className="w-full h-full object-cover"
                  />
                </div>
                {isPrimary && (
                  <div className="absolute top-1 left-1 bg-amber-400 text-brand-navy text-[10px] font-bold rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-current" /> Primary
                  </div>
                )}
                <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => handleReorder(img, "up")}
                      disabled={pending || idx === 0}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      title="Move left"
                    >
                      <ArrowUp className="h-3 w-3 -rotate-90" />
                    </button>
                    <button
                      onClick={() => handleReorder(img, "down")}
                      disabled={pending || idx === images.length - 1}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                      title="Move right"
                    >
                      <ArrowDown className="h-3 w-3 -rotate-90" />
                    </button>
                  </div>
                  <div className="flex gap-0.5">
                    {!isPrimary && (
                      <button
                        onClick={() => handleSetPrimary(img)}
                        disabled={pending}
                        className="p-1 hover:bg-amber-100 rounded text-amber-700"
                        title="Set as primary cover"
                      >
                        <Star className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(img)}
                      disabled={pending}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
