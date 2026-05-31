"use client";

// Tags panel for the customer detail page. Add/remove tags inline.
// Tags are tenant-scoped and email-keyed so they work for both auth.users
// customers and booking-only customers.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Tag } from "lucide-react";
import { addCustomerTag, removeCustomerTag } from "./tag-actions";

interface TagRow {
  id: string;
  tag_name: string;
  tag_color: string;
  notes: string | null;
}

export function CustomerTagsPanel({
  email,
  tags,
  suggestions,
}: {
  email: string;
  tags: TagRow[];
  suggestions: string[];           // existing tags from this tenant for autocomplete
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [pending, startTransition] = useTransition();

  // Filter suggestions: not already on this customer + matches input
  const filteredSuggestions = suggestions
    .filter((s) => !tags.find((t) => t.tag_name === s))
    .filter((s) => !newTag.trim() || s.toLowerCase().includes(newTag.trim().toLowerCase()))
    .slice(0, 6);

  function handleAdd(name?: string) {
    const tagName = (name ?? newTag).trim();
    if (!tagName) return;
    startTransition(async () => {
      const r = await addCustomerTag(email, tagName, newNotes.trim() || undefined);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Added "${tagName.toLowerCase().replace(/[^a-z0-9_-]+/g, "_")}"`);
      setNewTag("");
      setNewNotes("");
      setShowAdd(false);
      router.refresh();
    });
  }

  function handleRemove(tag: TagRow) {
    if (!confirm(`Remove tag "${tag.tag_name}"?`)) return;
    startTransition(async () => {
      await removeCustomerTag(email, tag.tag_name);
      toast.success("Removed");
      router.refresh();
    });
  }

  return (
    <div className="card">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1">
        <Tag className="h-3.5 w-3.5" /> Tags
      </h2>

      <div className="flex flex-wrap gap-2 mb-3">
        {tags.length === 0 && !showAdd && (
          <p className="text-xs text-slate-400 italic">No tags yet. Click "+ Add tag" to label this customer.</p>
        )}
        {tags.map((t) => (
          <div
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-0.5 text-xs font-semibold text-white shadow-sm group"
            style={{ backgroundColor: t.tag_color }}
            title={t.notes || undefined}
          >
            {t.tag_name}
            <button
              onClick={() => handleRemove(t)}
              disabled={pending}
              className="bg-white/20 hover:bg-white/30 rounded-full p-0.5 ml-0.5"
              aria-label={`Remove ${t.tag_name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="space-y-2 bg-slate-50 rounded p-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Tag name</label>
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="promoter, vip, inactive, …"
              className="input text-sm"
              autoFocus
              disabled={pending}
            />
            {filteredSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleAdd(s)}
                    disabled={pending}
                    className="text-[10px] bg-slate-200 hover:bg-violet-200 text-slate-700 hover:text-violet-800 rounded-full px-2 py-0.5"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Notes (optional)</label>
            <input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Why this tag?"
              className="input text-sm"
              disabled={pending}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleAdd()}
              disabled={pending || !newTag.trim()}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-semibold rounded-md px-3 py-1.5 text-xs"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewTag(""); setNewNotes(""); }}
              disabled={pending}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 ring-1 ring-violet-200 font-semibold rounded-full px-2.5 py-1"
        >
          <Plus className="h-3 w-3" /> Add tag
        </button>
      )}
    </div>
  );
}
