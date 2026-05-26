"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { togglePackageActive } from "./actions";

/** Tiny inline toggle button — stops propagation so clicking it doesn't
 *  navigate to the package detail page (the card itself is a Link). */
export function PackageActiveToggle({
  packageId,
  isActive,
}: {
  packageId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const r = await togglePackageActive(packageId, isActive);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(isActive ? "Package taken offline" : "Package is now LIVE on the public site");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={isActive ? "Click to hide from public site" : "Click to show on public site"}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition flex-shrink-0 ${
        isActive ? "bg-green-600" : "bg-slate-300"
      } ${pending ? "opacity-50" : ""}`}
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? "Online — click to take offline" : "Offline — click to put online"}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          isActive ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
