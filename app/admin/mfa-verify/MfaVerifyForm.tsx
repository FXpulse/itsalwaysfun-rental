"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function MfaVerifyForm({
  factorId,
  factorName,
  nextPath,
}: {
  factorId: string;
  factorName: string;
  nextPath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const supabase = createClient();

  function submit() {
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    startTransition(async () => {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr || !challenge) {
        toast.error(cErr?.message || "Challenge failed");
        return;
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (vErr) {
        toast.error(vErr.message || "Invalid code");
        setCode("");
        return;
      }
      router.push(nextPath);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-slate-500 mb-1">Authenticator: {factorName}</p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length === 6) submit();
          }}
          className="w-full rounded border border-slate-300 px-3 py-3 text-2xl font-mono tracking-widest text-center"
          maxLength={6}
        />
      </div>
      <button
        onClick={submit}
        disabled={pending || code.length !== 6}
        className="w-full rounded-md bg-brand-navy text-white py-3 font-medium hover:bg-brand-navy-dark disabled:opacity-50"
      >
        {pending ? "Verifying..." : "Verify"}
      </button>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.push("/admin/login");
        }}
        className="w-full text-sm text-slate-500 hover:text-slate-800"
      >
        Sign out
      </button>
    </div>
  );
}
