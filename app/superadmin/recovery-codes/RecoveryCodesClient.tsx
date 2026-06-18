"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, AlertTriangle, Download, RefreshCw, Check } from "lucide-react";
import { generateMyRecoveryCodes } from "./actions";

interface Status {
  totalGenerated: number;
  remainingUnused: number;
  lastGeneratedAt: string | null;
}

export function RecoveryCodesClient({ initialStatus }: { initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  function regenerate() {
    if (
      status.remainingUnused > 0 &&
      !confirm(
        "You already have " +
          status.remainingUnused +
          " unused recovery codes. Generating new ones will INVALIDATE all of them. Continue?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await generateMyRecoveryCodes();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setCodes(r.codes);
      setStatus({
        totalGenerated: r.codes.length,
        remainingUnused: r.codes.length,
        lastGeneratedAt: new Date().toISOString(),
      });
      setConfirmed(false);
    });
  }

  function downloadCodes() {
    if (!codes) return;
    const txt =
      "RentalFlow MFA recovery codes (superadmin)\n" +
      "Generated: " + new Date().toLocaleString() + "\n\n" +
      "WRITE THESE DOWN. EACH WORKS ONCE.\n" +
      "If you lose access to your authenticator, log in to /superadmin and\n" +
      "use the reset button on your own row in /superadmin/users-mfa, then\n" +
      "re-enroll TOTP on next /admin visit.\n\n" +
      codes.join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rentalflow-superadmin-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="card mb-6">
        <h2 className="font-semibold text-slate-800 mb-2">Current status</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Unused codes</div>
            <div className="text-3xl font-bold text-emerald-700">
              {status.remainingUnused}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Last generated</div>
            <div className="text-sm text-slate-700">
              {status.lastGeneratedAt
                ? new Date(status.lastGeneratedAt).toLocaleDateString()
                : "Never"}
            </div>
          </div>
        </div>

        {status.remainingUnused === 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              You have no active recovery codes. If you lose access to your
              authenticator, your only way back in is direct DB access.{" "}
              <strong>Generate codes now.</strong>
            </p>
          </div>
        )}

        <button
          onClick={regenerate}
          disabled={pending}
          className="mt-4 inline-flex items-center gap-1.5 bg-brand-navy hover:bg-brand-navy/90 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded"
        >
          <RefreshCw className="h-4 w-4" />
          {pending ? "Generating…" : "Generate 10 new codes"}
        </button>
      </div>

      {codes && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => confirmed && setCodes(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-xl w-full p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-emerald-100 text-emerald-700 p-2 rounded">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">
                  Your 10 recovery codes
                </h3>
                <p className="text-xs text-slate-500">
                  Save these NOW. They will never be shown again.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 text-emerald-300 font-mono text-base p-4 rounded grid grid-cols-2 gap-2 mb-3">
              {codes.map((c) => (
                <div key={c} className="tracking-wider">
                  {c}
                </div>
              ))}
            </div>

            <button
              onClick={downloadCodes}
              className="w-full mb-2 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2 rounded"
            >
              <Download className="h-4 w-4" />
              Download as .txt
            </button>

            <label className="flex items-center gap-2 text-xs text-slate-700 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4"
              />
              <span>
                I have saved these codes in a safe place (password manager,
                paper in a safe, etc).
              </span>
            </label>

            <button
              onClick={() => setCodes(null)}
              disabled={!confirmed}
              className="w-full mt-3 inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-2 rounded"
            >
              <Check className="h-4 w-4" />
              Close — codes saved
            </button>
          </div>
        </div>
      )}
    </>
  );
}
