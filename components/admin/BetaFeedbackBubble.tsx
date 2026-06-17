"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { MessageSquarePlus, X, Bug, Lightbulb, Palette, Send } from "lucide-react";
import { submitBetaFeedback } from "@/lib/beta-feedback";

type Category = "bug" | "feature" | "ux" | "other";

const CATEGORY_BUTTONS: Array<{
  key: Category;
  label: string;
  Icon: typeof Bug;
  hint: string;
}> = [
  { key: "bug", label: "Bug", Icon: Bug, hint: "Something broken" },
  { key: "feature", label: "Feature", Icon: Lightbulb, hint: "Wish it could…" },
  { key: "ux", label: "UX", Icon: Palette, hint: "Confusing flow" },
  { key: "other", label: "Other", Icon: MessageSquarePlus, hint: "Just a thought" },
];

export function BetaFeedbackBubble() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("bug");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const pathname = usePathname() || "";

  function handleSubmit() {
    if (body.trim().length < 5) {
      toast.error("Tell us a little more (at least 5 characters)");
      return;
    }
    startTransition(async () => {
      const r = await submitBetaFeedback({
        category,
        body,
        page_path: pathname,
      });
      if ((r as any).error) {
        toast.error((r as any).error);
        return;
      }
      toast.success("Sent! Ludmila gets a copy in her inbox.");
      setBody("");
      setCategory("bug");
      setOpen(false);
    });
  }

  return (
    <>
      {/* Floating launcher button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-brand-yellow text-brand-navy font-bold py-2.5 px-4 rounded-full shadow-lg hover:shadow-xl hover:bg-yellow-300 transition flex items-center gap-2 text-sm"
        aria-label="Send beta feedback"
        title="Send beta feedback"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Beta feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-brand-navy text-white px-5 py-4 rounded-t-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-yellow font-bold tracking-widest">
                  BETA FEEDBACK
                </p>
                <h2 className="text-lg font-bold mt-0.5">What's on your mind?</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                Goes straight to Ludmila. Bug, missing feature, confusing flow,
                random thought — all welcome. The more specific the better.
              </p>

              {/* Category picker */}
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_BUTTONS.map(({ key, label, Icon, hint }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`p-3 rounded-lg border-2 text-left transition ${
                      category === key
                        ? "border-brand-navy bg-brand-navy/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`h-4 w-4 ${
                          category === key ? "text-brand-navy" : "text-slate-500"
                        }`}
                      />
                      <span
                        className={`font-bold text-sm ${
                          category === key ? "text-brand-navy" : "text-slate-700"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
                  </button>
                ))}
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  What happened / what would you like?
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  maxLength={4000}
                  className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm focus:border-brand-navy outline-none"
                  placeholder={
                    category === "bug"
                      ? "What were you doing when it broke? What did you expect to happen?"
                      : category === "feature"
                      ? "What do you wish RentalFlow could do that it can't yet?"
                      : category === "ux"
                      ? "Where did you get stuck or confused? What did you expect?"
                      : "Tell us anything — we read everything."
                  }
                  autoFocus
                />
                <div className="text-[10px] text-slate-400 text-right mt-1">
                  {body.length}/4000 · context auto-attached:{" "}
                  <code className="bg-slate-100 px-1 rounded">
                    {pathname || "(unknown page)"}
                  </code>
                </div>
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || body.trim().length < 5}
                className="w-full bg-brand-navy text-white font-bold py-3 rounded-lg hover:bg-brand-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {pending ? "Sending..." : "Send to Ludmila"}
                {!pending && <Send className="h-4 w-4" />}
              </button>

              <p className="text-[11px] text-slate-400 text-center">
                You can submit as many as you want — there's no quota.
                Real bug reports = better product for everyone who comes after you.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
