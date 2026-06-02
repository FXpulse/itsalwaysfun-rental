"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Shield, User as UserIcon, X, KeyRound, AlertCircle } from "lucide-react";
import {
  createUser,
  updateUserRole,
  toggleUserActive,
  deleteUser,
  resetUserPassword,
} from "./actions";
import type { UserRow } from "./page";
import { formatDateTimeInTz, formatDateInTz } from "@/lib/tenant/timezone";

interface Orphan {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export function UsersManager({
  users,
  orphans,
  currentUserId,
  tz = "America/New_York",
}: {
  users: UserRow[];
  orphans: Orphan[];
  currentUserId: string;
  tz?: string;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resetFor, setResetFor] = useState<UserRow | null>(null);

  function refresh() {
    router.refresh();
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const r = await createUser(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("User created");
      setShowCreate(false);
      refresh();
    });
  }

  function handleRoleChange(userId: string, newRole: "admin" | "staff") {
    if (userId === currentUserId && newRole !== "admin") {
      toast.error("You cannot demote yourself");
      return;
    }
    const fd = new FormData();
    fd.append("user_id", userId);
    fd.append("role", newRole);
    startTransition(async () => {
      const r = await updateUserRole(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Role updated");
      refresh();
    });
  }

  function handleToggleActive(u: UserRow) {
    if (u.user_id === currentUserId && u.is_active) {
      toast.error("You cannot deactivate yourself");
      return;
    }
    if (!confirm(`${u.is_active ? "Deactivate" : "Reactivate"} ${u.email}?`)) return;
    startTransition(async () => {
      const r = await toggleUserActive(u.user_id, u.is_active);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(u.is_active ? "Deactivated" : "Reactivated");
      refresh();
    });
  }

  function handleDelete(u: UserRow | Orphan) {
    if ((u as UserRow).user_id === currentUserId) {
      toast.error("You cannot delete yourself");
      return;
    }
    if (!confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deleteUser(u.user_id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("User deleted");
      refresh();
    });
  }

  function handleReset(formData: FormData) {
    startTransition(async () => {
      const r = await resetUserPassword(formData);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Password reset — share the new password with the user securely");
      setResetFor(null);
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New user
        </button>
      </div>

      {/* Users with roles */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Last sign in</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-8">
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isMe = u.user_id === currentUserId;
                return (
                  <tr key={u.user_id} className={!u.is_active ? "opacity-50" : ""}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.email}</div>
                      {isMe && <div className="text-[10px] text-brand-navy/60">(you)</div>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.user_id, e.target.value as any)}
                        disabled={pending || (isMe && u.role === "admin")}
                        className="text-sm border rounded px-2 py-1 bg-white disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="driver">Driver</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active ? (
                        <span className="inline-block text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">
                          Active
                        </span>
                      ) : (
                        <span className="inline-block text-xs bg-slate-200 text-slate-600 rounded px-2 py-0.5">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {u.last_sign_in_at
                        ? formatDateTimeInTz(u.last_sign_in_at, tz)
                        : "never"}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => setResetFor(u)}
                        disabled={pending}
                        className="text-xs text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
                        title="Reset password"
                      >
                        <KeyRound className="h-3 w-3" /> Reset
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={pending || isMe}
                        className="text-xs text-amber-700 hover:text-amber-900 disabled:opacity-30"
                      >
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={pending || isMe}
                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-30"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Orphans — auth users without role rows */}
      {orphans.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-2 text-amber-700">
            <AlertCircle className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Users without a role ({orphans.length})</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            These accounts exist in Supabase Auth but have no role assigned, so they cannot log in to the admin panel. Delete them or contact a developer to assign roles via SQL.
          </p>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orphans.map((o) => (
                  <tr key={o.user_id}>
                    <td className="px-4 py-3">{o.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDateInTz(o.created_at, tz)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(o)}
                        disabled={pending}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title="New user" onClose={() => setShowCreate(false)}>
          <form action={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input name="email" type="email" required className="input" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Temporary password
              </label>
              <input name="password" type="text" required minLength={8} className="input" />
              <p className="text-xs text-slate-400 mt-1">
                At least 8 characters. Share securely — they can change it later.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select name="role" defaultValue="staff" className="input">
                <option value="staff">Staff (Bookings, Inventory, Availability, Dispatch)</option>
                <option value="driver">Driver (only today's routes — for crew in the field)</option>
                <option value="admin">Admin (everything)</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={pending} className="btn-primary flex-1">
                {pending ? "Creating..." : "Create user"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset password modal */}
      {resetFor && (
        <Modal title={`Reset password — ${resetFor.email}`} onClose={() => setResetFor(null)}>
          <form action={handleReset} className="space-y-4">
            <input type="hidden" name="user_id" value={resetFor.user_id} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New password
              </label>
              <input
                name="new_password"
                type="text"
                required
                minLength={8}
                className="input"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                Min 8 chars. They will need this to sign in next.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={pending} className="btn-primary flex-1">
                {pending ? "Resetting..." : "Reset password"}
              </button>
              <button type="button" onClick={() => setResetFor(null)} className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
