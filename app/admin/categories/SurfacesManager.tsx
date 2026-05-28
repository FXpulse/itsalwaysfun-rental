"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit, X } from "lucide-react";
import {
  createSurface,
  updateSurface,
  toggleSurfaceActive,
  deleteSurface,
} from "./surface-actions";

interface Surface {
  id: string;
  value: string;
  label: string;
  display_order: number;
  is_active: boolean;
}

export function SurfacesManager({ surfaces }: { surfaces: Surface[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Surface | null>(null);

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
    action: (fd: FormData) => Promise<any>,
    label: string,
  ) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await action(fd);
      if (r?.error) {
        toast.error(r.error);
      } else {
        toast.success(`${label} successfully`);
        setShowAdd(false);
        setEditing(null);
        router.refresh();
      }
    });
  }

  function handleToggle(s: Surface) {
    startTransition(async () => {
      const r = await toggleSurfaceActive(s.id, s.is_active);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(s.is_active ? "Set inactive" : "Set active");
        router.refresh();
      }
    });
  }

  function handleDelete(s: Surface) {
    if (
      !confirm(
        `Delete surface "${s.label}"? Past bookings keep their recorded value but it won't be selectable for new ones.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteSurface(s.id);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(`Deleted "${s.label}"`);
        router.refresh();
      }
    });
  }

  return (
    <section className="mt-10">
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-xl font-bold text-brand-navy">Setup surface options</h2>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 text-sm bg-brand-navy text-white px-3 py-1.5 rounded hover:bg-brand-navy-dark"
          >
            <Plus className="h-3 w-3" /> Add surface
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Where can customers set up rentals? These options show in the public
        booking wizard and the quote approval form. Edit, deactivate, or delete
        any. Inactive ones stay on past bookings but don't show for new ones.
      </p>

      {showAdd && (
        <form
          onSubmit={(e) =>
            handleSubmit(e, createSurface, "Surface added")
          }
          className="card mb-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-brand-navy">New surface</h3>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <SurfaceFormFields />
          <button
            type="submit"
            disabled={pending}
            className="btn-primary inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> {pending ? "Adding..." : "Add"}
          </button>
        </form>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left font-mono">Value</th>
              <th className="px-3 py-2 text-center w-20">Order</th>
              <th className="px-3 py-2 text-center w-24">Status</th>
              <th className="px-3 py-2 text-right w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {surfaces.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  No surfaces yet. Add at least one so customers can pick a setup location.
                </td>
              </tr>
            )}
            {surfaces.map((s) =>
              editing?.id === s.id ? (
                <tr key={s.id} className="bg-amber-50">
                  <td colSpan={5} className="p-3">
                    <form
                      onSubmit={(e) =>
                        handleSubmit(
                          e,
                          async (fd) => updateSurface(s.id, fd),
                          "Surface updated",
                        )
                      }
                      className="space-y-3"
                    >
                      <SurfaceFormFields initial={s} />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={pending}
                          className="btn-primary text-xs"
                        >
                          {pending ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={s.id} className={s.is_active ? "" : "opacity-50"}>
                  <td className="px-3 py-2 font-medium">{s.label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {s.value}
                  </td>
                  <td className="px-3 py-2 text-center font-mono">{s.display_order}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleToggle(s)}
                      disabled={pending}
                      className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                        s.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {s.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditing(s)}
                      className="text-brand-navy hover:underline text-xs inline-flex items-center gap-1 mr-2"
                    >
                      <Edit className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={pending}
                      className="text-red-500 hover:text-red-700"
                      title={`Delete ${s.label}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SurfaceFormFields({ initial }: { initial?: Surface }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Label (shown to customers) *
          </label>
          <input
            name="label"
            required
            minLength={2}
            maxLength={60}
            defaultValue={initial?.label || ""}
            className="input"
            placeholder="Grass"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Value (internal key) *
          </label>
          <input
            name="value"
            required
            minLength={2}
            maxLength={40}
            pattern="[a-z0-9][a-z0-9_-]*"
            defaultValue={initial?.value || ""}
            className="input font-mono text-xs"
            placeholder="grass"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Lowercase, no spaces. Saved on bookings — don't change after launch.
          </p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Display order
        </label>
        <input
          name="display_order"
          type="number"
          min={0}
          max={999}
          defaultValue={initial?.display_order ?? 0}
          className="input max-w-[100px]"
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Lower numbers show first. Ties keep their creation order.
        </p>
      </div>
    </>
  );
}
