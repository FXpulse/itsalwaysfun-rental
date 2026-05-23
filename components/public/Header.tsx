"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Phone, Instagram, Facebook, ShoppingCart, Search, Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart/context";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/order-by-date", label: "Order by Date" },
  { href: "/rentals", label: "Rentals" },
];

const INFO_ITEMS = [
  { href: "/info/faqs", label: "FAQs" },
  { href: "/info/privacy-policy", label: "Privacy Policy" },
  { href: "/info/terms-of-service", label: "Terms of Service" },
];

const PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "(904) 584-3047";
const INSTAGRAM = process.env.NEXT_PUBLIC_INSTAGRAM || "https://instagram.com/itsalwaysfunparty";
const FACEBOOK = process.env.NEXT_PUBLIC_FACEBOOK || "https://facebook.com/itsalwaysfunparty";

export function Header() {
  const { hasItem } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm">
      {/* Top bar — logo, search, contact, cart */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="https://files.sysers.com/cp/upload/itsalwaysfun/editor/med/its_always_fun_logo.png"
            alt="It's Always Fun"
            width={160}
            height={60}
            className="h-12 sm:h-14 w-auto"
            priority
            unoptimized
          />
        </Link>

        {/* Search (placeholder, non-functional) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent text-sm"
            aria-label="Search items"
          />
        </div>

        {/* Right side: phone + social + cart */}
        <div className="flex items-center gap-3 sm:gap-4 ml-auto">
          <a
            href={`tel:${PHONE.replace(/\D/g, "")}`}
            className="hidden sm:flex items-center gap-2 text-brand-navy font-semibold hover:text-brand-yellow-dark transition text-sm"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden md:inline">{PHONE}</span>
          </a>

          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-brand-navy hover:text-brand-yellow-dark transition"
            aria-label="Instagram"
          >
            <Instagram className="h-5 w-5" />
          </a>
          <a
            href={FACEBOOK}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-brand-navy hover:text-brand-yellow-dark transition"
            aria-label="Facebook"
          >
            <Facebook className="h-5 w-5" />
          </a>

          <Link
            href="/order-by-date"
            className="relative inline-flex items-center text-brand-navy hover:text-brand-yellow-dark"
            aria-label="Cart"
          >
            <ShoppingCart className="h-6 w-6" />
            {hasItem && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                1
              </span>
            )}
          </Link>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden text-brand-navy"
            aria-label="Open menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Yellow navigation bar */}
      <nav className="bg-brand-yellow hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-4 py-3 text-brand-navy font-semibold hover:bg-brand-yellow-dark transition"
                >
                  {item.label}
                </Link>
              </li>
            ))}

            {/* Info dropdown */}
            <li
              className="relative"
              onMouseEnter={() => setInfoOpen(true)}
              onMouseLeave={() => setInfoOpen(false)}
            >
              <button className="block px-4 py-3 text-brand-navy font-semibold hover:bg-brand-yellow-dark transition">
                Info ▾
              </button>
              {infoOpen && (
                <ul className="absolute top-full left-0 bg-white shadow-lg border border-slate-200 rounded-b w-48 z-10">
                  {INFO_ITEMS.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block px-4 py-2 text-brand-navy text-sm hover:bg-brand-yellow/30"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>

            <li>
              <Link
                href="/contact"
                className="block px-4 py-3 text-brand-navy font-semibold hover:bg-brand-yellow-dark transition"
              >
                Contact Us
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="lg:hidden bg-brand-yellow border-t border-brand-yellow-dark">
          <ul className="px-4 py-2 space-y-1">
            {[...NAV_ITEMS, ...INFO_ITEMS, { href: "/contact", label: "Contact Us" }].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-3 py-2 text-brand-navy font-semibold rounded hover:bg-white/30"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-2 border-t border-brand-yellow-dark/50">
              <a
                href={`tel:${PHONE.replace(/\D/g, "")}`}
                className="flex items-center gap-2 px-3 py-2 text-brand-navy font-semibold"
              >
                <Phone className="h-4 w-4" /> {PHONE}
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
