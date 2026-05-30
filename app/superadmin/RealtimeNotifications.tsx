"use client";

// Subscribes to Supabase Realtime channels for the tables that matter
// to the operator. Shows a sonner toast + auto-refreshes the current
// page so server-rendered widgets pick up the new row.

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { UserPlus, Ticket, Mail, Sparkles, Inbox, Wifi, WifiOff } from "lucide-react";

export function RealtimeNotifications() {
  const router = useRouter();
  const pathname = usePathname();
  const [connected, setConnected] = useState(false);
  const refreshDebounce = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Skip on login page — no auth context for Realtime channel.
    if (pathname?.endsWith("/superadmin/login")) return;

    const supabase = createClient();

    function scheduleRefresh() {
      if (refreshDebounce.current) clearTimeout(refreshDebounce.current);
      refreshDebounce.current = setTimeout(() => router.refresh(), 1500);
    }

    const channel = supabase
      .channel("superadmin-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tenants" },
        (payload) => {
          const row = payload.new as any;
          toast.success(`🎉 New tenant: ${row.business_name}`, {
            description: row.owner_email,
            duration: 8000,
          });
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        (payload) => {
          const row = payload.new as any;
          const isUrgent = row.priority === "urgent" || row.ai_priority === "urgent";
          (isUrgent ? toast.error : toast)(
            `🎫 ${isUrgent ? "URGENT " : ""}new ticket: ${row.subject}`,
            { description: row.tenant_business_name || "(no tenant)", duration: 10000 },
          );
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets" },
        (payload) => {
          const before = payload.old as any;
          const after = payload.new as any;
          if (before?.status !== "resolved" && after?.status === "resolved") {
            toast.success(`✅ Ticket resolved: ${after.subject}`);
            scheduleRefresh();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_magnet_signups" },
        (payload) => {
          const row = payload.new as any;
          toast(`✨ Lead: ${row.email}`, {
            description: `Tool: ${row.tool_key}`,
            duration: 5000,
          });
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "email_threads" },
        () => {
          // Don't toast every email — just refresh inbox if she's on it.
          if (pathname?.includes("/superadmin/email")) scheduleRefresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
        else if (status === "CLOSED" || status === "TIMED_OUT") setConnected(false);
      });

    return () => {
      if (refreshDebounce.current) clearTimeout(refreshDebounce.current);
      supabase.removeChannel(channel);
    };
  }, [router, pathname]);

  if (pathname?.endsWith("/superadmin/login")) return null;

  return (
    <div
      className="fixed bottom-6 left-6 z-40 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold bg-white/90 backdrop-blur ring-1 ring-slate-200 rounded-full px-2.5 py-1 shadow-sm"
      title={connected ? "Realtime connected — toasts will appear on new events" : "Realtime offline — refresh manually"}
    >
      {connected ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <Wifi className="h-3 w-3 text-emerald-600" />
          <span className="text-emerald-700">Live</span>
        </>
      ) : (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          <WifiOff className="h-3 w-3 text-slate-500" />
          <span className="text-slate-500">Offline</span>
        </>
      )}
    </div>
  );
}
