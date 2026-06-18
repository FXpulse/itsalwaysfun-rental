"use client";

// Panel para enroll/verify/remove TOTP factors.
// Flujo enroll:
//   1. Click "Add authenticator" → Supabase devuelve QR code data URI + secret
//   2. User escanea QR con Google Authenticator / 1Password / Authy
//   3. User pega el 6-digit code que muestra la app
//   4. Submit → Supabase verifica + marca el factor como verified
// Una vez verificado, próximo login va a pedir el código TOTP automáticamente.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, KeyRound, Trash2, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Factor {
  id: string;
  friendlyName: string;
  createdAt: string | null;
  status: "verified" | "unverified";
}

interface Props {
  userEmail: string;
  enrolledFactors: Factor[];
  currentAal: "aal1" | "aal2";
}

export function MfaPanel({ userEmail, enrolledFactors, currentAal }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const supabase = createClient();

  // Enroll flow state
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [newFactorId, setNewFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [copied, setCopied] = useState(false);

  const verifiedTotps = enrolledFactors.filter((f) => f.status === "verified");
  const hasMfa = verifiedTotps.length > 0;

  async function startEnroll() {
    setEnrollOpen(true);
    setCode("");
    setCopied(false);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: friendlyName.trim() || `Authenticator ${new Date().toLocaleDateString()}`,
    });
    if (error || !data) {
      toast.error(error?.message || "Failed to start enrollment");
      setEnrollOpen(false);
      return;
    }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setNewFactorId(data.id);
  }

  /** Close the enroll modal + clear UI state. When `discardFactor` is true
   *  (user cancelled mid-flow), also unenroll the unverified factor so it
   *  doesn't linger. NEVER pass true after a successful verify — that would
   *  delete the factor we just confirmed. */
  function closeEnrollUi(discardFactor: boolean) {
    if (discardFactor && newFactorId) {
      supabase.auth.mfa.unenroll({ factorId: newFactorId }).catch(() => {});
    }
    setEnrollOpen(false);
    setQrCode(null);
    setSecret(null);
    setNewFactorId(null);
    setCode("");
  }

  function cancelEnroll() {
    closeEnrollUi(true);
  }

  function verifyCode() {
    if (!newFactorId || code.trim().length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator");
      return;
    }
    startTransition(async () => {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: newFactorId,
      });
      if (challengeErr || !challenge) {
        toast.error(challengeErr?.message || "Challenge failed");
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: newFactorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyErr) {
        toast.error(verifyErr.message || "Invalid code — try again");
        return;
      }
      toast.success("Two-factor authentication enabled");
      // Close modal but DO NOT unenroll — the factor was just verified.
      // Calling cancelEnroll() here was the bug: it deleted the verified
      // factor milliseconds after creation, leaving the DB empty and the
      // UI flipping back to "2FA is not enabled".
      closeEnrollUi(false);
      router.refresh();
    });
  }

  function removeFactor(factorId: string) {
    if (!confirm("Remove this authenticator? You'll only have password login until you add another.")) return;
    startTransition(async () => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Authenticator removed");
      router.refresh();
    });
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className={`rounded-lg border p-4 flex items-start gap-3 ${
          hasMfa
            ? "bg-emerald-50 border-emerald-200"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        {hasMfa ? (
          <ShieldCheck className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
        )}
        <div className="text-sm">
          {hasMfa ? (
            <>
              <strong className="text-emerald-800">2FA is enabled</strong>
              <p className="text-emerald-700 mt-0.5">
                Your account requires a code from your authenticator on every login.
                Current session level: <code className="bg-emerald-100 px-1 rounded">{currentAal}</code>.
              </p>
            </>
          ) : (
            <>
              <strong className="text-amber-800">2FA is not enabled</strong>
              <p className="text-amber-700 mt-0.5">
                Your account is protected by password only. If your password is compromised,
                an attacker has full access. Strongly recommended for admins.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Enrolled factors list */}
      {enrolledFactors.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Your authenticators</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {enrolledFactors.map((f) => (
              <div key={f.id} className="px-4 py-3 flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{f.friendlyName}</div>
                  <div className="text-xs text-slate-500">
                    {f.status === "verified" ? "Verified" : "Pending verification"} ·{" "}
                    {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : "—"}
                  </div>
                </div>
                <button
                  onClick={() => removeFactor(f.id)}
                  disabled={pending}
                  className="text-red-500 hover:bg-red-50 rounded p-2"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enroll flow */}
      {!enrollOpen ? (
        <button
          onClick={startEnroll}
          disabled={pending}
          className="rounded-md bg-brand-navy text-white px-5 py-2 font-medium hover:bg-brand-navy-dark"
        >
          + Add authenticator
        </button>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="font-bold text-slate-800">Set up authenticator</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name (optional)
            </label>
            <input
              type="text"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="iPhone, work phone, 1Password..."
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              maxLength={80}
            />
          </div>

          {qrCode && (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>Step 1:</strong> Scan this QR code with your authenticator app
                  (Google Authenticator, 1Password, Authy):
                </p>
                <div className="flex justify-center">
                  <img src={qrCode} alt="MFA QR code" className="border border-slate-200 rounded p-2 bg-white" />
                </div>
              </div>

              {secret && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">
                    Can't scan? Enter this code manually:
                  </p>
                  <div className="flex items-center gap-2 bg-slate-50 rounded p-2 border border-slate-200">
                    <code className="text-xs font-mono flex-1 break-all">{secret}</code>
                    <button
                      onClick={copySecret}
                      className="text-slate-500 hover:text-slate-800"
                      title="Copy"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>Step 2:</strong> Enter the 6-digit code from your app:
                </p>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-lg font-mono tracking-widest text-center"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={verifyCode}
                  disabled={pending || code.length !== 6}
                  className="rounded-md bg-brand-navy text-white px-5 py-2 font-medium hover:bg-brand-navy-dark disabled:opacity-50"
                >
                  {pending ? "Verifying..." : "Verify + enable"}
                </button>
                <button
                  onClick={cancelEnroll}
                  disabled={pending}
                  className="rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help footnote */}
      <div className="text-xs text-slate-500 space-y-1 pt-4 border-t border-slate-100">
        <p>
          <strong>Recommended apps:</strong> 1Password, Authy, Google Authenticator,
          Microsoft Authenticator.
        </p>
        <p>
          <strong>If you lose your authenticator:</strong> contact your platform admin
          (ludmilayhenry@gmail.com) — they can disable 2FA from the Supabase admin console
          so you can re-enroll.
        </p>
        <p>Email on file: <code className="bg-slate-100 px-1 rounded">{userEmail}</code></p>
      </div>
    </div>
  );
}
