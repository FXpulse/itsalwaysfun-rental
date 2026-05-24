"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Set a cookie when ?ref=CODE is in the URL.
// Cookie is read by /portal/auth/callback after signup to link the referrer.
const COOKIE_NAME = "iaf_ref";
const COOKIE_DAYS = 30;

export function ReferralTracker() {
  const sp = useSearchParams();

  useEffect(() => {
    const ref = sp.get("ref");
    if (!ref) return;
    const clean = ref.toUpperCase().trim();
    if (!/^[A-Z0-9]{4,16}$/.test(clean)) return;

    const expires = new Date(Date.now() + COOKIE_DAYS * 24 * 60 * 60 * 1000);
    document.cookie = `${COOKIE_NAME}=${clean}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }, [sp]);

  return null;
}
