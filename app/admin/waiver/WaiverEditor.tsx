"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Save, Eye, EyeOff } from "lucide-react";
import { saveWaiver } from "./actions";

export function WaiverEditor({
  initialEnabled,
  initialTitle,
  initialText,
}: {
  initialEnabled: boolean;
  initialTitle: string;
  initialText: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set("waiver_enabled", "on");
    fd.set("waiver_title", title);
    fd.set("waiver_text", text);
    startTransition(async () => {
      const r = await saveWaiver(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Waiver saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="font-semibold text-brand-navy">
            Require signature at checkout
          </span>
        </label>
        {!enabled && (
          <span className="text-xs bg-red-100 text-red-800 rounded px-2 py-0.5">
            ⚠ Waiver currently disabled — customers can book without signing
          </span>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="input"
        />
        <p className="text-xs text-slate-500 mt-1">
          Shown as the heading above the waiver block at checkout.
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-semibold text-slate-700">
            Waiver text
          </label>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="text-xs text-brand-navy hover:underline inline-flex items-center gap-1"
          >
            {preview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
        {preview ? (
          <div className="border border-slate-300 rounded p-3 bg-slate-50 text-xs whitespace-pre-line font-sans max-h-96 overflow-y-auto">
            {text || <em className="text-slate-400">Empty — preview hidden.</em>}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={24}
            required
            className="input font-mono text-xs"
            placeholder="Paste your attorney-reviewed waiver text here..."
          />
        )}
        <p className="text-xs text-slate-500 mt-1">
          Plain text only — blank lines create paragraphs. Customers see the
          first ~5 lines collapsed with a "Read full waiver" expander, then
          must check a box + type their full name to sign.
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {pending ? "Saving..." : "Save waiver"}
        </button>
        <a
          href="/info/waiver"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 text-sm"
        >
          View public page →
        </a>
      </div>
    </form>
  );
}
