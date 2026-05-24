"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface Initial {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [data, setData] = useState<Initial>(initial);
  const [pending, startTransition] = useTransition();

  function patch(p: Partial<Initial>) {
    setData((d) => ({ ...d, ...p }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          phone: data.phone.trim(),
          address: data.address.trim(),
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Contact info
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <input
            className="input"
            value={data.first_name}
            onChange={(e) => patch({ first_name: e.target.value })}
          />
        </Field>
        <Field label="Last name">
          <input
            className="input"
            value={data.last_name}
            onChange={(e) => patch({ last_name: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            className="input"
            value={data.phone}
            onChange={(e) => patch({ phone: e.target.value })}
          />
        </Field>
        <Field label="Address" full>
          <input
            className="input"
            placeholder="Street, City, ZIP"
            value={data.address}
            onChange={(e) => patch({ address: e.target.value })}
          />
        </Field>
      </div>

      <div className="pt-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
