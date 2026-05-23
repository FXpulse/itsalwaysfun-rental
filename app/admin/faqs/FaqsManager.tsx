"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Edit, X } from "lucide-react";
import { createFaq, updateFaq, deleteFaq, toggleFaqActive } from "./actions";

interface Faq {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

export function FaqsManager({ faqs }: { faqs: Faq[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<any>,
    label: string,
  ) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`${label} successfully`);
        setShowAdd(false);
        setEditing(null);
        router.refresh();
      }
    });
  }

  function handleToggle(f: Faq) {
    startTransition(async () => {
      const result = await toggleFaqActive(f.id, f.is_active);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(f.is_active ? "Set inactive" : "Set active");
        router.refresh();
      }
    });
  }

  function handleDelete(f: Faq) {
    if (!confirm(`Delete FAQ "${f.question.slice(0, 50)}..."?`)) return;
    startTransition(async () => {
      const result = await deleteFaq(f.id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("FAQ deleted");
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
          <Plus className="h-4 w-4" /> Add FAQ
        </button>
      </div>

      {showAdd && (
        <FaqFormCard
          title="Add new FAQ"
          onClose={() => setShowAdd(false)}
          onSubmit={(e) => handleSubmit(e, createFaq, "Created")}
          submitLabel="Create"
          pending={pending}
        />
      )}

      {faqs.length === 0 ? (
        <div className="card text-center text-slate-400 py-8">
          No FAQs yet. Click "Add FAQ" to create your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((f) => (
            <div key={f.id} className="card">
              <div className="flex items-start gap-4">
                <span className="text-slate-400 font-mono text-xs flex-shrink-0 pt-1">#{f.display_order}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-brand-navy mb-1">{f.question}</h3>
                  <p className="text-sm text-slate-600 line-clamp-2">{f.answer}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(f)}
                    disabled={pending}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded
                      ${f.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${f.is_active ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                    {f.is_active ? "Active" : "Inactive"}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditing(f);
                        setShowAdd(false);
                      }}
                      className="text-brand-navy hover:underline text-sm inline-flex items-center gap-1"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(f)}
                      disabled={pending}
                      className="text-red-600 hover:underline text-sm inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <FaqFormCard
          title="Edit FAQ"
          onClose={() => setEditing(null)}
          onSubmit={(e) => handleSubmit(e, updateFaq.bind(null, editing.id), "Updated")}
          submitLabel="Save changes"
          pending={pending}
          initial={editing}
        />
      )}
    </div>
  );
}

function FaqFormCard({
  title,
  onClose,
  onSubmit,
  submitLabel,
  pending,
  initial,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  pending: boolean;
  initial?: Faq;
}) {
  return (
    <div className="card border-l-4 border-l-brand-yellow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-brand-navy">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Question</label>
          <input
            name="question"
            required
            defaultValue={initial?.question || ""}
            placeholder="What areas do you serve?"
            className="input"
            disabled={pending}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Answer</label>
          <textarea
            name="answer"
            required
            rows={4}
            defaultValue={initial?.answer || ""}
            placeholder="Jacksonville, FL and surrounding areas..."
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
