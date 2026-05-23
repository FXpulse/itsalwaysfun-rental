"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit, X, Upload, ImageOff } from "lucide-react";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
  uploadCategoryImage,
} from "./actions";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  image_url: string | null;
}

export function CategoriesManager({
  categories,
  productCounts,
}: {
  categories: Category[];
  productCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<any>,
    label: string,
  ) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${label} successfully`);
        setShowAdd(false);
        setEditing(null);
        router.refresh();
      }
    });
  }

  function handleToggle(c: Category) {
    startTransition(async () => {
      const result = await toggleCategoryActive(c.id, c.is_active);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(c.is_active ? "Set inactive" : "Set active");
        router.refresh();
      }
    });
  }

  function handleDelete(c: Category) {
    if (!confirm(`Delete category "${c.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteCategory(c.id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`Deleted "${c.name}"`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setShowAdd(true);
            setEditing(null);
          }}
          className="btn-accent inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add category
        </button>
      </div>

      {showAdd && (
        <CategoryFormCard
          title="Add new category"
          onClose={() => setShowAdd(false)}
          onSubmit={(e) => handleSubmit(e, createCategory, "Created")}
          submitLabel="Create"
          pending={pending}
        />
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-700 w-12">#</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700 w-16">Image</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Slug</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Products</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const count = productCounts[c.name] || 0;
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{c.display_order}</td>
                  <td className="px-4 py-3">
                    {c.image_url ? (
                      <Image
                        src={c.image_url}
                        alt={c.name}
                        width={40}
                        height={40}
                        className="object-cover rounded"
                        unoptimized
                      />
                    ) : (
                      <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-300">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.slug}</td>
                  <td className="px-4 py-3">{count}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(c)}
                      disabled={pending}
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded
                        ${c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}
                        hover:opacity-80`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                      {c.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditing(c);
                        setShowAdd(false);
                      }}
                      className="text-brand-navy hover:underline text-sm inline-flex items-center gap-1"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={pending || count > 0}
                      title={count > 0 ? `Cannot delete — ${count} products use this` : "Delete category"}
                      className="text-red-600 hover:underline text-sm inline-flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed disabled:no-underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <CategoryFormCard
          title={`Edit "${editing.name}"`}
          onClose={() => setEditing(null)}
          onSubmit={(e) => handleSubmit(e, updateCategory.bind(null, editing.id), "Updated")}
          submitLabel="Save changes"
          pending={pending}
          initial={editing}
          showImageUpload
        />
      )}
    </div>
  );
}

function CategoryImageUploader({ category }: { category: Category }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(category.image_url);
  const [pending, setPending] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPending(true);
    const formData = new FormData();
    formData.append("image", file);

    const result = await uploadCategoryImage(category.id, formData);
    setPending(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ("url" in result && result.url) {
      setPreview(result.url);
      toast.success("Category image updated");
      router.refresh();
    }
  }

  return (
    <div className="flex items-start gap-4 mb-4 pb-4 border-b border-slate-200">
      <div className="bg-slate-50 rounded border border-slate-200 w-24 h-24 flex items-center justify-center flex-shrink-0">
        {preview ? (
          <Image
            src={preview}
            alt="Category"
            width={96}
            height={96}
            className="object-cover rounded w-full h-full"
            unoptimized
          />
        ) : (
          <ImageOff className="h-6 w-6 text-slate-300" />
        )}
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Category image
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Shown on home page category card · 1:1 ratio recommended · max 5 MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="inline-flex items-center gap-2 text-sm bg-white border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {pending ? "Uploading..." : preview ? "Replace image" : "Upload image"}
        </button>
      </div>
    </div>
  );
}

function CategoryFormCard({
  title,
  onClose,
  onSubmit,
  submitLabel,
  pending,
  initial,
  showImageUpload = false,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  pending: boolean;
  initial?: Category;
  showImageUpload?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-brand-navy">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {showImageUpload && initial && <CategoryImageUploader category={initial} />}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              name="name"
              required
              defaultValue={initial?.name || ""}
              className="input"
              disabled={pending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Slug <span className="text-xs text-slate-400">(URL-safe)</span>
            </label>
            <input
              name="slug"
              required
              defaultValue={initial?.slug || ""}
              pattern="^[a-z0-9-]+$"
              placeholder="bounce-houses"
              className="input font-mono"
              disabled={pending}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input
            name="description"
            defaultValue={initial?.description || ""}
            placeholder="Shown on category page"
            className="input"
            disabled={pending}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Display order</label>
            <input
              name="display_order"
              type="number"
              min={0}
              max={999}
              defaultValue={initial?.display_order ?? 0}
              className="input"
              disabled={pending}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                name="is_active"
                type="checkbox"
                defaultChecked={initial?.is_active ?? true}
                className="w-4 h-4 rounded text-brand-navy"
                disabled={pending}
              />
              Active (visible on public site)
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving..." : submitLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900"
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
