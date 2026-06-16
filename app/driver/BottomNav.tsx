"use client";

// Driver app bottom navigation — fixed at viewport bottom on all /driver/*
// pages. Persistent across navigation so it always feels like a native app.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck, MessageCircle, User } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon: typeof Truck;
  // match exact OR isStartOf — for nested routes
  match: (path: string) => boolean;
}

const TABS: Tab[] = [
  {
    href: "/driver",
    label: "Routes",
    icon: Truck,
    match: (p) =>
      p === "/driver" ||
      p === "/driver/" ||
      p.startsWith("/driver/route/"),
  },
  {
    href: "/driver/inbox",
    label: "Inbox",
    icon: MessageCircle,
    match: (p) => p.startsWith("/driver/inbox"),
  },
  {
    href: "/driver/me",
    label: "Me",
    icon: User,
    match: (p) => p.startsWith("/driver/me"),
  },
];

export function BottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname() || "";
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40">
      <div className="max-w-2xl mx-auto flex">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 relative transition active:scale-95 ${
                active ? "text-brand-navy" : "text-slate-500"
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${active ? "" : "opacity-70"}`} />
                {tab.label === "Inbox" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] rounded-full px-1 min-w-[16px] text-center leading-tight">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium mt-0.5 ${active ? "font-bold" : ""}`}>
                {tab.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-brand-navy rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
