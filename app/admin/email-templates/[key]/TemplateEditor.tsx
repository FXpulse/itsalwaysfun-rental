"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Save, Eye, Send, RefreshCw, Code, Info } from "lucide-react";
import { updateEmailTemplate, previewEmailTemplate, sendTestEmail } from "../actions";

interface Initial {
  subject: string;
  email_title: string;
  body_html: string;
  body_text: string;
  is_active: boolean;
}

export function TemplateEditor({
  templateKey,
  initial,
  availableVars,
  sampleVars,
  adminEmail,
}: {
  templateKey: string;
  initial: Initial;
  availableVars: string[];
  sampleVars: Record<string, string>;
  adminEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<Initial>(initial);
  const [tab, setTab] = useState<"html" | "text">("html");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState(adminEmail);
  const [showVars, setShowVars] = useState(false);

  function patch(p: Partial<Initial>) {
    setData((d) => ({ ...d, ...p }));
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("subject", data.subject);
      fd.append("email_title", data.email_title);
      fd.append("body_html", data.body_html);
      fd.append("body_text", data.body_text);
      if (data.is_active) fd.append("is_active", "on");
      const r = await updateEmailTemplate(templateKey, fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function handlePreview() {
    startTransition(async () => {
      // Save first so preview reflects the unsaved edits? No — preview uses
      // the current DB row. Tell user to save before previewing.
      const r = await previewEmailTemplate(templateKey, sampleVars);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setPreviewHtml(r.html);
      setPreviewSubject(r.subject);
    });
  }

  function handleSendTest() {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    startTransition(async () => {
      const r = await sendTestEmail(templateKey, testEmail, sampleVars);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Test sent to ${testEmail}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Variable reference */}
      <div className="card bg-slate-50 border-slate-200">
        <button
          onClick={() => setShowVars((v) => !v)}
          className="flex items-center gap-2 w-full text-left"
        >
          <Code className="h-4 w-4 text-slate-600" />
          <span className="font-semibold text-sm text-slate-700">
            Available variables ({availableVars.length})
          </span>
          <span className="text-xs text-slate-400">
            {showVars ? "Click to hide" : "Click to expand"}
          </span>
        </button>
        {showVars && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {availableVars.map((v) => (
              <div key={v}>
                <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono">
                  {`{{${v}}}`}
                </code>
                <span className="text-slate-500 ml-2 text-[10px]">
                  → {sampleVars[v] || "(sample N/A)"}
                </span>
              </div>
            ))}
            <div className="col-span-full mt-2 text-[11px] text-slate-500 flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                Use conditionals for optional fields:{" "}
                <code className="bg-white px-1 py-0.5 rounded">{`{{#if message}}...{{/if}}`}</code>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email subject
          </label>
          <input
            type="text"
            value={data.subject}
            onChange={(e) => patch({ subject: e.target.value })}
            className="input font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email header title (shown in the banner)
          </label>
          <input
            type="text"
            value={data.email_title}
            onChange={(e) => patch({ email_title: e.target.value })}
            className="input"
          />
        </div>

        {/* HTML / Text tabs */}
        <div>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setTab("html")}
              className={`text-xs font-semibold px-3 py-1.5 rounded ${
                tab === "html"
                  ? "bg-brand-navy text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              HTML body
            </button>
            <button
              type="button"
              onClick={() => setTab("text")}
              className={`text-xs font-semibold px-3 py-1.5 rounded ${
                tab === "text"
                  ? "bg-brand-navy text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Plain text fallback
            </button>
          </div>

          {tab === "html" ? (
            <textarea
              value={data.body_html}
              onChange={(e) => patch({ body_html: e.target.value })}
              rows={20}
              className="input font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          ) : (
            <textarea
              value={data.body_text}
              onChange={(e) => patch({ body_text: e.target.value })}
              rows={20}
              className="input font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          )}
          <p className="text-xs text-slate-500 mt-1">
            {tab === "html"
              ? "Use inline styles for best email client compatibility. Don't include <html>, <body>, etc. — that's wrapped automatically with the brand layout."
              : "Plain-text version sent to clients that block HTML. Keep short and informational."}
          </p>
        </div>

        <div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.is_active}
              onChange={(e) => patch({ is_active: e.target.checked })}
              className="h-4 w-4"
            />
            <span>Active (uncheck to disable this email entirely)</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="card flex flex-wrap gap-3 items-center sticky bottom-0 shadow-lg">
        <button
          onClick={handleSave}
          disabled={pending}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Save className="h-4 w-4" /> {pending ? "Saving..." : "Save changes"}
        </button>
        <button
          onClick={handlePreview}
          disabled={pending}
          className="inline-flex items-center gap-2 border border-slate-300 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-50 text-sm"
        >
          <Eye className="h-4 w-4" /> Preview (uses DB version — save first)
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="input max-w-[220px] text-sm"
          />
          <button
            onClick={handleSendTest}
            disabled={pending}
            className="inline-flex items-center gap-2 bg-amber-500 text-white rounded-md px-3 py-2 hover:bg-amber-600 text-sm font-semibold disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Send test
          </button>
        </div>
      </div>

      {/* Preview pane */}
      {previewHtml && (
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs uppercase text-slate-500">Preview</div>
              <div className="text-sm font-semibold">
                Subject: <span className="font-mono">{previewSubject}</span>
              </div>
            </div>
            <button
              onClick={handlePreview}
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-navy"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
          <iframe
            srcDoc={previewHtml}
            className="w-full h-[700px] border border-slate-200 rounded bg-white"
            title="Email preview"
          />
        </div>
      )}
    </div>
  );
}
