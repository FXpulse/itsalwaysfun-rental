"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Eye, Users, Mail, Tag, DollarSign, Calendar, Clock, Loader2, Zap } from "lucide-react";
import { sendCampaign, previewCampaignAudience, type CampaignFilter } from "../actions";

export function CampaignBuilder({ availableTags }: { availableTags: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Filter state
  const [audienceMode, setAudienceMode] = useState<"tag" | "recent" | "all" | "spend">("tag");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bookedWithinDays, setBookedWithinDays] = useState("90");
  const [minSpentDollars, setMinSpentDollars] = useState("100");

  // Preview state
  const [preview, setPreview] = useState<{ count: number; sample: any[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [pending, startTransition] = useTransition();

  // Schedule state
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  function buildFilter(): CampaignFilter {
    if (audienceMode === "all") return { all_customers: true };
    if (audienceMode === "tag") return { tags: selectedTags };
    if (audienceMode === "recent") return { booked_within_days: parseInt(bookedWithinDays, 10) || 90 };
    return { min_total_spent_cents: Math.round(parseFloat(minSpentDollars || "0") * 100) };
  }

  // Auto-preview when filter changes (debounced)
  useEffect(() => {
    setPreview(null);
    const t = setTimeout(async () => {
      setPreviewing(true);
      const r = await previewCampaignAudience(buildFilter());
      if ("error" in r) {
        setPreview(null);
      } else {
        setPreview({ count: r.count, sample: r.sample });
      }
      setPreviewing(false);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceMode, selectedTags, bookedWithinDays, minSpentDollars]);

  function toggleTag(t: string) {
    setSelectedTags(selectedTags.includes(t) ? selectedTags.filter((s) => s !== t) : [...selectedTags, t]);
  }

  function handleSend() {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error("Name, subject, and body are required");
      return;
    }
    if (!preview || preview.count === 0) {
      toast.error("No recipients match this filter");
      return;
    }
    if (preview.count > 1000) {
      toast.error("Audience too large (>1000). Split into batches.");
      return;
    }

    // Validate scheduled date if "later" mode
    let scheduledIso: string | undefined;
    if (sendMode === "later") {
      if (!scheduledAt) {
        toast.error("Pick a date + time");
        return;
      }
      const d = new Date(scheduledAt);
      if (d.getTime() < Date.now() + 60_000) {
        toast.error("Scheduled time must be at least 1 minute in the future");
        return;
      }
      scheduledIso = d.toISOString();
    }

    const verb = sendMode === "now" ? "Send" : "Schedule";
    if (!confirm(`${verb} "${name}" to ${preview.count} customer${preview.count === 1 ? "" : "s"}?`)) return;

    startTransition(async () => {
      const r = await sendCampaign({
        name, subject, body,
        filter: buildFilter(),
        scheduled_at: scheduledIso,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (r.scheduled) {
        toast.success(`Scheduled for ${new Date(scheduledIso!).toLocaleString()}`);
      } else {
        toast.success(`Sent ${r.sent} · failed ${r.failed}`);
      }
      router.push("/admin/campaigns");
    });
  }

  return (
    <div className="space-y-5">
      {/* 1. Audience */}
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" /> 1. Who gets it
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <ModeButton active={audienceMode === "tag"} onClick={() => setAudienceMode("tag")} icon={<Tag className="h-4 w-4" />} label="By tag" />
          <ModeButton active={audienceMode === "recent"} onClick={() => setAudienceMode("recent")} icon={<Calendar className="h-4 w-4" />} label="Recent bookings" />
          <ModeButton active={audienceMode === "spend"} onClick={() => setAudienceMode("spend")} icon={<DollarSign className="h-4 w-4" />} label="High spenders" />
          <ModeButton active={audienceMode === "all"} onClick={() => setAudienceMode("all")} icon={<Users className="h-4 w-4" />} label="All customers" />
        </div>

        {audienceMode === "tag" && (
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
              Tags ({selectedTags.length} selected) — recipients are those with ANY of these tags
            </label>
            {availableTags.length === 0 ? (
              <p className="text-xs text-slate-500">
                No tags created yet. Go to a customer detail page and add tags first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`text-xs font-semibold rounded-full px-3 py-1 ring-1 transition ${
                      selectedTags.includes(t)
                        ? "bg-violet-600 text-white ring-violet-600"
                        : "bg-white text-slate-700 ring-slate-200 hover:ring-violet-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {audienceMode === "recent" && (
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Customers who paid for a booking in the last
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={bookedWithinDays}
                onChange={(e) => setBookedWithinDays(e.target.value)}
                className="input w-24"
              />
              <span className="text-sm text-slate-600">days</span>
            </div>
          </div>
        )}

        {audienceMode === "spend" && (
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Customers who paid at least
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-600">$</span>
              <input
                type="number"
                min={1}
                value={minSpentDollars}
                onChange={(e) => setMinSpentDollars(e.target.value)}
                className="input w-32"
              />
              <span className="text-sm text-slate-600">across all bookings</span>
            </div>
          </div>
        )}

        {audienceMode === "all" && (
          <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠️ Sends to every customer with an email in our system. Use sparingly — high-volume to unfiltered list can trigger spam flags.
          </p>
        )}

        {/* Preview */}
        <div className="mt-4 bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-bold uppercase text-slate-500">Preview audience</span>
            {previewing && <Loader2 className="h-3 w-3 animate-spin text-violet-500" />}
          </div>
          {preview ? (
            preview.count === 0 ? (
              <p className="text-sm text-rose-700">No recipients match — adjust the filter</p>
            ) : (
              <>
                <p className="text-2xl font-bold text-violet-700">{preview.count.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 mb-2">customer{preview.count === 1 ? "" : "s"} will receive this</p>
                <div className="text-xs text-slate-600 space-y-0.5 max-h-24 overflow-y-auto">
                  {preview.sample.slice(0, 5).map((r, i) => (
                    <div key={i} className="truncate">{r.first_name || "(no name)"} — <code className="text-slate-500">{r.email}</code></div>
                  ))}
                  {preview.count > 5 && <div className="text-[10px] text-slate-400">…and {preview.count - 5} more</div>}
                </div>
              </>
            )
          ) : (
            !previewing && <p className="text-xs text-slate-400">Adjusting…</p>
          )}
        </div>
      </div>

      {/* 2. Email content */}
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4" /> 2. The email
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Campaign name (internal)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VIP promoter announcement"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Exclusive offer for you 🎉"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
              Body — use <code>{`{firstName}`}</code>, <code>{`{lastName}`}</code>, <code>{`{businessName}`}</code> as placeholders
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder={`Hi {firstName},

We've got a special offer just for you...

— {businessName}`}
              className="input font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* 3. Schedule */}
      <div className="card p-5">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" /> 3. When to send
        </h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setSendMode("now")}
            className={`px-3 py-3 rounded-lg text-sm font-semibold inline-flex flex-col items-center gap-1 ring-1 transition ${
              sendMode === "now"
                ? "bg-fuchsia-600 text-white ring-fuchsia-600 shadow"
                : "bg-white text-slate-700 ring-slate-200 hover:ring-fuchsia-300"
            }`}
          >
            <Zap className="h-4 w-4" />
            Send now
          </button>
          <button
            type="button"
            onClick={() => setSendMode("later")}
            className={`px-3 py-3 rounded-lg text-sm font-semibold inline-flex flex-col items-center gap-1 ring-1 transition ${
              sendMode === "later"
                ? "bg-fuchsia-600 text-white ring-fuchsia-600 shadow"
                : "bg-white text-slate-700 ring-slate-200 hover:ring-fuchsia-300"
            }`}
          >
            <Calendar className="h-4 w-4" />
            Schedule for later
          </button>
        </div>

        {sendMode === "later" && (
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Date + time (your timezone)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              className="input"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Cron picks up scheduled campaigns every 5 min. Actual send time is within ±5 min of your chosen time.
              Audience is re-evaluated at send time — tags added between schedule and send ARE included.
            </p>
          </div>
        )}
      </div>

      {/* 4. Send */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-700">
          {preview && preview.count > 0
            ? sendMode === "later" && scheduledAt
              ? <><strong>Ready:</strong> schedule for {new Date(scheduledAt).toLocaleString()} → {preview.count} customer{preview.count === 1 ? "" : "s"}.</>
              : <><strong>Ready:</strong> send to {preview.count} customer{preview.count === 1 ? "" : "s"}.</>
            : <span className="text-slate-500">Adjust filters to see recipients.</span>}
        </div>
        <button
          onClick={handleSend}
          disabled={pending || !preview || preview.count === 0 || (sendMode === "later" && !scheduledAt)}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-300 text-white font-semibold rounded-lg px-5 py-2 inline-flex items-center gap-1 shadow"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : sendMode === "later" ? <Calendar className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {pending
            ? (sendMode === "later" ? "Scheduling…" : "Sending…")
            : preview
              ? sendMode === "later"
                ? `Schedule for ${preview.count}`
                : `Send to ${preview.count}`
              : "Send"}
        </button>
      </div>
    </div>
  );
}

function ModeButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex flex-col items-center gap-1 ring-1 transition ${
        active
          ? "bg-violet-600 text-white ring-violet-600 shadow"
          : "bg-white text-slate-700 ring-slate-200 hover:ring-violet-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
