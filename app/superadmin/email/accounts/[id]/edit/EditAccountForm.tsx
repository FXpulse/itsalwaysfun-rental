"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, TestTube2, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { saveAccount, testEditConnection } from "./actions";

interface Account {
  id: string;
  brand: string;
  label: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  is_active: boolean;
  last_sync_error: string | null;
}

export function EditAccountForm({ account }: { account: Account }) {
  const router = useRouter();
  const [label, setLabel] = useState(account.label);
  const [imapHost, setImapHost] = useState(account.imap_host);
  const [imapPort, setImapPort] = useState(account.imap_port);
  const [smtpHost, setSmtpHost] = useState(account.smtp_host);
  const [smtpPort, setSmtpPort] = useState(account.smtp_port);
  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(account.is_active);
  const [pending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<null | { ok: boolean; msg: string }>(null);

  const buildInput = () => ({
    id: account.id, label, imap_host: imapHost, imap_port: imapPort,
    smtp_host: smtpHost, smtp_port: smtpPort,
    username, password: password || undefined, is_active: isActive,
  });

  function handleTest() {
    if (!password) {
      toast.error("Enter the new password before testing");
      return;
    }
    setTestResult(null);
    startTransition(async () => {
      const r = await testEditConnection({ ...buildInput(), password });
      if (r.ok) {
        setTestResult({ ok: true, msg: "Connection successful — IMAP + SMTP work" });
      } else {
        setTestResult({ ok: false, msg: `${r.stage.toUpperCase()} failed: ${r.error}` });
      }
    });
  }

  function handleSave() {
    startTransition(async () => {
      const r = await saveAccount(buildInput());
      if ("error" in r) toast.error(r.error);
      else {
        toast.success("Saved");
        router.push("/superadmin/email/accounts");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Read-only header */}
      <div className="card bg-slate-50 p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Email address</div>
        <div className="font-mono text-sm">{account.email_address}</div>
        <div className="text-xs text-slate-400 mt-2">Brand: {account.brand}</div>
        {account.last_sync_error && (
          <div className="mt-2 bg-rose-50 border border-rose-200 rounded p-2 text-xs text-rose-700">
            <strong>Last error:</strong> {account.last_sync_error.slice(0, 200)}
          </div>
        )}
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Display label</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" />
      </div>

      {/* Username */}
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="input font-mono" />
        <p className="text-[10px] text-slate-500 mt-1">Usually your full email address.</p>
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
          Password (leave empty to keep current)
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new password…"
          className="input font-mono"
          autoComplete="new-password"
        />
      </div>

      {/* IMAP */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">IMAP host</label>
          <input value={imapHost} onChange={(e) => setImapHost(e.target.value)} className="input font-mono" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Port</label>
          <input type="number" value={imapPort} onChange={(e) => setImapPort(parseInt(e.target.value || "993", 10))} className="input" />
        </div>
      </div>

      {/* SMTP */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">SMTP host</label>
          <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="input font-mono" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Port</label>
          <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(parseInt(e.target.value || "465", 10))} className="input" />
        </div>
      </div>

      {/* Active toggle */}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Account is active (synced by cron)
      </label>

      {/* Test result */}
      {testResult && (
        <div className={`rounded-lg p-3 text-xs flex items-start gap-2 ${
          testResult.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"
        }`}>
          {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
          <span className="font-mono">{testResult.msg}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleTest}
          disabled={pending}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
          Test connection
        </button>
        <button
          onClick={handleSave}
          disabled={pending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-4 py-2 text-sm inline-flex items-center gap-1 disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" /> Save changes
        </button>
      </div>

      <p className="text-xs text-slate-500">
        💡 You can <strong>Save without testing</strong> — the cron will retry on the next run.
        Useful if the mail server is temporarily unreachable.
      </p>
    </div>
  );
}
