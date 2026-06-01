"use client";

import { useState, useTransition } from "react";
import { User, Save, ChevronDown, ChevronUp } from "lucide-react";
import { updateTenantProfile } from "./actions";

type Profile = {
  industry?: string | null;
  employees_count?: number | null;
  year_founded?: number | null;
  market_size?: string | null;
  primary_goal?: string | null;
  pain_points?: string | null;
  bookings_per_month_avg?: number | null;
  revenue_tier?: string | null;
  decision_maker_name?: string | null;
  decision_maker_phone?: string | null;
  decision_maker_role?: string | null;
  acquisition_source?: string | null;
  account_status?: string | null;
  notes?: string | null;
};

const INDUSTRIES = [
  "bouncer_inflatables", "tent_table_chair", "av_event", "construction_equipment",
  "trailer_truck", "vehicle_rental", "party_supply", "wedding_rental", "other",
];

const ACQUISITION_SOURCES = [
  "outbound_ghl", "google_ads", "organic_search", "referral", "iaf_case_study",
  "linkedin", "facebook_group", "cold_call", "trade_show", "other",
];

const ACCOUNT_STATUSES = ["lead", "trialing", "onboarding", "active", "at_risk", "churned"];
const REVENUE_TIERS = ["under_5k", "5k_15k", "15k_50k", "50k_150k", "150k_plus"];
const MARKET_SIZES = ["small_city", "mid_city", "metro", "multi_city"];

export function ClientProfile({ tenantId, initial }: { tenantId: string; initial: Profile }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateTenantProfile(tenantId, profile as any);
        if ((res as any)?.error) {
          setError((res as any).error);
          return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    });
  }

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-indigo-600" />
          <div className="text-left">
            <div className="font-bold text-brand-navy">Client Profile (Ficha del Cliente)</div>
            <div className="text-xs text-slate-500">
              Business intel, decision maker, acquisition source
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-5 space-y-5">
          {/* Business intel */}
          <Section title="🏢 Business intel">
            <Grid>
              <SelectField label="Industry" value={profile.industry} onChange={(v) => set("industry", v)} options={INDUSTRIES} />
              <SelectField label="Market size" value={profile.market_size} onChange={(v) => set("market_size", v)} options={MARKET_SIZES} />
              <NumberField label="Employees" value={profile.employees_count} onChange={(v) => set("employees_count", v)} />
              <NumberField label="Year founded" value={profile.year_founded} onChange={(v) => set("year_founded", v)} />
              <NumberField label="Bookings / month (avg)" value={profile.bookings_per_month_avg} onChange={(v) => set("bookings_per_month_avg", v)} />
              <SelectField label="Revenue tier" value={profile.revenue_tier} onChange={(v) => set("revenue_tier", v)} options={REVENUE_TIERS} />
            </Grid>
          </Section>

          {/* Goals & pain */}
          <Section title="🎯 Goals + pain points">
            <Grid>
              <TextField label="Primary goal" value={profile.primary_goal} onChange={(v) => set("primary_goal", v)} placeholder="e.g. cut booking errors, scale to 2x" />
              <TextField label="Pain points" value={profile.pain_points} onChange={(v) => set("pain_points", v)} placeholder="e.g. double-bookings, manual quotes" />
            </Grid>
          </Section>

          {/* Decision maker */}
          <Section title="👤 Decision maker">
            <Grid>
              <TextField label="Name" value={profile.decision_maker_name} onChange={(v) => set("decision_maker_name", v)} />
              <TextField label="Phone" value={profile.decision_maker_phone} onChange={(v) => set("decision_maker_phone", v)} />
              <TextField label="Role" value={profile.decision_maker_role} onChange={(v) => set("decision_maker_role", v)} placeholder="Owner, Ops Manager…" />
            </Grid>
          </Section>

          {/* Sales / account */}
          <Section title="📈 Sales + account">
            <Grid>
              <SelectField label="Account status" value={profile.account_status} onChange={(v) => set("account_status", v)} options={ACCOUNT_STATUSES} />
              <SelectField label="Acquisition source" value={profile.acquisition_source} onChange={(v) => set("acquisition_source", v)} options={ACQUISITION_SOURCES} />
            </Grid>
          </Section>

          {/* Free notes */}
          <Section title="📝 Operator notes (general)">
            <textarea
              value={profile.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
              className="w-full text-sm border border-slate-200 rounded p-2 focus:ring-1 focus:ring-indigo-500"
              placeholder="Anything important about this tenant. Use the Notes timeline below for dated activity."
            />
          </Section>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {isPending ? "Saving..." : "Save profile"}
            </button>
            {saved && <span className="text-xs text-emerald-700 font-semibold">✓ Saved</span>}
            {error && (
              <span className="text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 px-2 py-1 rounded">
                ⚠ {error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider font-bold text-slate-600 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function TextField({ label, value, onChange, placeholder }: { label: string; value?: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full border border-slate-200 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="mt-1 w-full border border-slate-200 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value?: string | null; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-200 rounded p-2 text-sm focus:ring-1 focus:ring-indigo-500 bg-white"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
        ))}
      </select>
    </label>
  );
}
