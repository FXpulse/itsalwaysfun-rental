// app/superadmin/email/accounts/new/AccountWizard.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Check, AlertCircle } from "lucide-react";
import { testConnections, createAccount, type WizardInput } from "./actions";

const STEPS = ["Brand", "Email", "IMAP", "SMTP", "Test & Save"];

export function AccountWizard() {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<WizardInput>({
    brand: "rentalflow", label: "",
    email_address: "",
    imap_host: "", imap_port: 993,
    smtp_host: "", smtp_port: 465,
    username: "", password: "",
  });
  const [testResult, setTestResult] = useState<
    null | { ok: true } | { ok: false; stage: "imap" | "smtp"; error: string }
  >(null);

  const set = (k: keyof WizardInput, v: any) => setData({ ...data, [k]: v });

  function runTest() {
    setTestResult(null);
    startTransition(async () => {
      const r = await testConnections(data);
      setTestResult(r);
      if (r.ok) toast.success("Both connections OK ✓");
      else toast.error(`${r.stage.toUpperCase()} failed: ${r.error}`);
    });
  }

  function save() {
    startTransition(async () => {
      const r = await createAccount(data);
      if (r?.error) toast.error(r.error);
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i === step ? "bg-brand-navy text-white" :
              i < step ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
            }`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</div>
            {i < STEPS.length - 1 && (<div className="w-8 h-0.5 bg-slate-200" />)}
          </div>
        ))}
      </div>

      <div className="card space-y-4">
        {step === 0 && (
          <>
            <h2 className="text-lg font-bold">Brand & label</h2>
            <div>
              <label className="block text-sm mb-1">Brand</label>
              <input className="input" value={data.brand} onChange={(e) => set("brand", e.target.value)} placeholder="rentalflow" />
            </div>
            <div>
              <label className="block text-sm mb-1">Label (what you&apos;ll see in the UI)</label>
              <input className="input" value={data.label} onChange={(e) => set("label", e.target.value)} placeholder="Main RentalFlow inbox" />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold">Email address</h2>
            <div>
              <label className="block text-sm mb-1">From/To address</label>
              <input className="input" type="email" value={data.email_address} onChange={(e) => set("email_address", e.target.value)} placeholder="info@getrentalflow.com" />
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold">IMAP server</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-sm mb-1">Host</label>
                <input className="input" value={data.imap_host} onChange={(e) => set("imap_host", e.target.value)} placeholder="imap.getrentalflow.com" />
              </div>
              <div>
                <label className="block text-sm mb-1">Port</label>
                <input className="input" type="number" value={data.imap_port} onChange={(e) => set("imap_port", Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1">Username</label>
              <input className="input" value={data.username} onChange={(e) => set("username", e.target.value)} placeholder="info@getrentalflow.com" />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <input className="input" type="password" value={data.password} onChange={(e) => set("password", e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">Encrypted with AES-256-GCM before storage. Never displayed again.</p>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="text-lg font-bold">SMTP server</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-sm mb-1">Host</label>
                <input className="input" value={data.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.getrentalflow.com" />
              </div>
              <div>
                <label className="block text-sm mb-1">Port</label>
                <input className="input" type="number" value={data.smtp_port} onChange={(e) => set("smtp_port", Number(e.target.value))} />
              </div>
            </div>
            <p className="text-xs text-slate-500">SMTP uses the same username + password as IMAP.</p>
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="text-lg font-bold">Test & save</h2>
            <p className="text-sm text-slate-600">Live test the IMAP + SMTP credentials. Save only enabled if both succeed.</p>
            <button onClick={runTest} disabled={pending} className="btn-primary">
              {pending ? "Testing…" : "Run live test"}
            </button>
            {testResult?.ok && (
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm text-emerald-900 flex items-center gap-2">
                <Check className="h-4 w-4" /> Both connections OK
              </div>
            )}
            {testResult && !testResult.ok && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {testResult.stage.toUpperCase()}: {testResult.error}
              </div>
            )}
          </>
        )}

        <div className="flex justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() => setStep(step - 1)} disabled={step === 0 || pending}
            className="text-sm text-slate-500 inline-flex items-center gap-1 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="btn-primary inline-flex items-center gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={save}
              disabled={!testResult?.ok || pending}
              className="btn-primary disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save account"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
