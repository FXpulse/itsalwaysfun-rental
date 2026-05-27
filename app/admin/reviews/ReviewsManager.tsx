"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  X,
  Upload,
  Eye,
  EyeOff,
  Award,
} from "lucide-react";
import {
  createReview,
  updateReview,
  deleteReview,
  toggleFeatured,
  toggleActive,
  uploadReviewPhoto,
} from "./actions";
import type { ReviewRow } from "./page";

const SOURCES = [
  { value: "google", label: "Google", icon: "🟢" },
  { value: "facebook", label: "Facebook", icon: "🔵" },
  { value: "yelp", label: "Yelp", icon: "🔴" },
  { value: "instagram", label: "Instagram", icon: "🟣" },
  { value: "email", label: "Email", icon: "📧" },
  { value: "manual", label: "Other / Manual", icon: "✍️" },
];

export function ReviewsManager({ reviews }: { reviews: ReviewRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ReviewRow | null>(null);
  const [creating, setCreating] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const r = editing
        ? await updateReview(editing.id, formData)
        : await createReview(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(editing ? "Review updated" : "Review added");
      setEditing(null);
      setCreating(false);
      router.refresh();
    });
  }

  function handleDelete(r: ReviewRow) {
    if (!confirm(`Delete review from "${r.customer_name}"? Cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteReview(r.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }

  function handleToggleFeatured(r: ReviewRow) {
    startTransition(async () => {
      const result = await toggleFeatured(r.id, !r.is_featured);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(r.is_featured ? "Removed from carousel" : "Added to carousel");
      router.refresh();
    });
  }

  function handleToggleActive(r: ReviewRow) {
    startTransition(async () => {
      const result = await toggleActive(r.id, !r.is_active);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(r.is_active ? "Hidden from site" : "Now visible on site");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add review
        </button>
      </div>

      {reviews.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="mb-2">No reviews yet.</p>
          <p className="text-xs">
            Copy quotes from your Google Maps page, Facebook, or email replies and
            paste them here. You decide which ones appear on the public site.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              onEdit={() => {
                setEditing(r);
                setCreating(false);
              }}
              onDelete={() => handleDelete(r)}
              onToggleFeatured={() => handleToggleFeatured(r)}
              onToggleActive={() => handleToggleActive(r)}
              pending={pending}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <Modal
          title={editing ? `Edit review` : "Add review"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          <ReviewForm
            review={editing}
            pending={pending}
            onSubmit={handleSubmit}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}

function ReviewCard({
  review,
  onEdit,
  onDelete,
  onToggleFeatured,
  onToggleActive,
  pending,
}: {
  review: ReviewRow;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFeatured: () => void;
  onToggleActive: () => void;
  pending: boolean;
}) {
  const source = SOURCES.find((s) => s.value === review.source);
  return (
    <div
      className={`card border-2 ${
        !review.is_active
          ? "border-slate-200 opacity-60"
          : review.is_featured
            ? "border-amber-300 bg-amber-50/30"
            : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-3 mb-2">
        {review.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.photo_url}
            alt={review.customer_name}
            className="h-10 w-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold flex-shrink-0">
            {review.customer_name[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-brand-navy text-sm">{review.customer_name}</strong>
            {review.is_featured && review.is_active && (
              <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
                <Award className="h-3 w-3" /> Featured
              </span>
            )}
            {!review.is_active && (
              <span className="text-[10px] bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">
                Hidden
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            {review.customer_location && <>{review.customer_location} · </>}
            <span title={source?.label}>{source?.icon}</span>
            {review.reviewed_at && (
              <span>· {new Date(review.reviewed_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-0.5 mb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
            }`}
          />
        ))}
      </div>

      <p className="text-sm text-slate-700 mb-3 line-clamp-4">"{review.review_text}"</p>

      <div className="flex justify-between items-center text-xs">
        <div className="flex gap-2">
          <button
            onClick={onToggleFeatured}
            disabled={pending || !review.is_active}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
              review.is_featured
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
            title={review.is_featured ? "Remove from carousel" : "Add to homepage carousel"}
          >
            <Award className="h-3 w-3" />
            {review.is_featured ? "Featured" : "Feature"}
          </button>
          <button
            onClick={onToggleActive}
            disabled={pending}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
              review.is_active
                ? "border border-slate-300 text-slate-600 hover:bg-slate-50"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
            title={review.is_active ? "Hide from site" : "Show on site"}
          >
            {review.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {review.is_active ? "Visible" : "Hidden"}
          </button>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1 text-slate-600 hover:text-brand-navy">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={onDelete} className="p-1 text-red-600 hover:text-red-800">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewForm({
  review,
  pending,
  onSubmit,
  onCancel,
}: {
  review: ReviewRow | null;
  pending: boolean;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState(review?.photo_url || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("photo", file);
    const r = await uploadReviewPhoto(fd);
    setUploading(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    if (r.url) {
      setPhotoUrl(r.url);
      toast.success("Photo uploaded");
    }
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Customer name *</label>
          <input
            name="customer_name"
            required
            defaultValue={review?.customer_name || ""}
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Location</label>
          <input
            name="customer_location"
            defaultValue={review?.customer_location || ""}
            className="input"
            placeholder="City, ST"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-600 mb-1">Review text *</label>
        <textarea
          name="review_text"
          required
          rows={4}
          minLength={10}
          maxLength={3000}
          defaultValue={review?.review_text || ""}
          className="input"
          placeholder={`"The bounce house was perfect for my son's birthday — they delivered on time, set up safely, and cleanup was a breeze. Will definitely book again!"`}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Rating *</label>
          <select
            name="rating"
            defaultValue={review?.rating ?? 5}
            className="input"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Source *</label>
          <select
            name="source"
            defaultValue={review?.source || "google"}
            className="input"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.icon} {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Date</label>
          <input
            name="reviewed_at"
            type="date"
            defaultValue={review?.reviewed_at || ""}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-600 mb-1">
          Source URL (optional — link to original review)
        </label>
        <input
          name="source_url"
          type="url"
          defaultValue={review?.source_url || ""}
          className="input"
          placeholder="https://maps.google.com/?cid=..."
        />
      </div>

      <div>
        <label className="block text-xs text-slate-600 mb-1">
          Customer photo (optional)
        </label>
        <div className="flex gap-2 items-start">
          <input
            name="photo_url"
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="input flex-1"
            placeholder="https://... or upload →"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-3 w-3" />
            {uploading ? "Uploading..." : "Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
          />
        </div>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="Preview"
            className="h-16 w-16 rounded-full object-cover mt-2"
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Sort order</label>
          <input
            name="sort_order"
            type="number"
            defaultValue={review?.sort_order ?? 100}
            className="input"
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              name="is_featured"
              type="checkbox"
              defaultChecked={review?.is_featured ?? false}
              className="h-4 w-4"
            />
            Featured (carousel)
          </label>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={review ? review.is_active : true}
              className="h-4 w-4"
            />
            Visible on site
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t">
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          {pending ? "Saving..." : review ? "Save changes" : "Add review"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
