"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Crown, Trash2, Mail } from "lucide-react";
import { inviteSuperadmin, removeSuperadmin } from "./actions";
import type { SuperadminRow } from "./page";

export function TeamManager({
  team,
  currentUserId,
}: {
  team: SuperadminRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showInvite, setShowInvite] = useState(false);

  function handleInvite(formData: FormData) {
    startTransition(async () => {
      const r = await inviteSuperadmin(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`Invited ${r.email} as superadmin`);
      setShowInvite(false);
      router.refresh();
    });
  }

  function handleRemove(row: SuperadminRow) {
    if (row.user_id === currentUserId) {
      toast.error("You can't remove yourself. Ask another superadmin to demote you.");
      return;
    }
    if (
      !confirm(
        `Remove superadmin access from ${row.email}? They'll lose ability to manage tenants, suspend, impersonate, etc. Their underlying user account stays.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await removeSuperadmin(row.user_id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Superadmin access removed");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowInvite(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Invite superadmin
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Joined</th>
              <th className="px-4 py-2 text-left">Last sign-in</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {team.map((row) => {
              const isMe = row.user_id === currentUserId;
              return (
                <tr key={row.user_id}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-600" />
                      <span className="font-medium">{row.email}</span>
                      {isMe && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          you
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {row.created_at
                      ? new Date(row.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {row.last_sign_in_at
                      ? new Date(row.last_sign_in_at).toLocaleString()
                      : <span className="text-slate-400 italic">never</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleRemove(row)}
                      disabled={pending || isMe}
                      className="text-xs text-red-600 hover:text-red-800 inline-flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isMe ? "Can't remove yourself" : "Remove superadmin access"}
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {team.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No superadmins. (You shouldn't be seeing this — you ARE one.)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        💡 Invited users get an email with a magic link. They click it, set a
        password, and can immediately log in at{" "}
        <code>getrentalflow.com/superadmin/login</code>. Email delivery requires
        Resend / Supabase SMTP configured in your Supabase Auth settings.
      </p>

      {/* Invite modal */}
      {showInvite && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowInvite(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-brand-navy mb-2 flex items-center gap-2">
              <Mail className="h-5 w-5" /> Invite superadmin
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              They'll get email access to manage all tenants. Use only for people
              you fully trust — superadmins can suspend tenants, view billing,
              impersonate, etc.
            </p>
            <form action={handleInvite} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="helper@example.com"
                  className="input"
                  autoFocus
                  disabled={pending}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Note (optional, internal)
                </label>
                <input
                  name="note"
                  maxLength={200}
                  placeholder="e.g. Support — Q1 2026 hire"
                  className="input"
                  disabled={pending}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary text-sm"
                >
                  {pending ? "Inviting..." : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
