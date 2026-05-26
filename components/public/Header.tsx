"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Phone,
  Instagram,
  Facebook,
  ShoppingCart,
  Search,
  Menu,
  X,
  User,
} from "lucide-react";
import { useCart } from "@/lib/cart/context";

const NAV_HOME = [
  { href: "/", label: "Home" },
  { href: "/order-by-date", label: "Order by Date" },
  { href: "/rentals", label: "Rentals" },
];
const NAV_PACKAGES = { href: "/packages", label: "Packages" };
const NAV_GIFT_CARDS = { href: "/gift-cards", label: "🎁 Gift Cards" };

const INFO_ITEMS = [
  { href: "/info/faqs", label: "FAQs" },
  { href: "/reviews", label: "Reviews" },
  { href: "/info/privacy-policy", label: "Privacy Policy" },
  { href: "/info/terms-of-service", label: "Terms of Service" },
];

interface Props {
  logoUrl: string;
  businessName: string;
  phone: string;
  instagramUrl: string;
  facebookUrl: string;
  showPackages?: boolean;
  showGiftCards?: boolean;
}

export function Header({
  logoUrl,
  businessName,
  phone,
  instagramUrl,
  facebookUrl,
  showPackages = true,
  showGiftCards = true,
}: Props) {
  const NAV_ITEMS = [
    ...NAV_HOME,
    ...(showPackages ? [NAV_PACKAGES] : []),
    ...(showGiftCards ? [NAV_GIFT_CARDS] : []),
  ];
  const { hasItem } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const telHref = `tel:${phone.replace(/\D/g, "")}`;

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
        <Link href="/" className="flex-shrink-0">
          <Image
            src={logoUrl}
            alt={businessName}
            width={160}
            height={60}
            className="h-12 sm:h-14 w-auto"
            priority
            unoptimized
          />
        </Link>

        <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent text-sm"
            aria-label="Search items"
          />
        </div>

        <div className="flex items-center gap-3 sm:gap-4 ml-auto">
          <a
            href={telHref}
            className="hidden sm:flex items-center gap-2 text-brand-navy font-semibold hover:text-brand-yellow-dark transition text-sm"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden md:inline">{phone}</span>
          </a>

          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-brand-navy hover:text-brand-yellow-dark transition"
            aria-label="Instagram"
          >
            <Instagram className="h-5 w-5" />
          </a>
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-brand-navy hover:text-brand-yellow-dark transition"
            aria-label="Facebook"
          >
            <Facebook className="h-5 w-5" />
          </a>

          <Link
            href="/portal"
            className="hidden sm:inline-flex items-center gap-1.5 bg-brand-navy text-white text-sm font-semibold px-3 py-1.5 rounded hover:bg-brand-navy-dark transition"
            title="Sign in to your account"
          >
            <User className="h-4 w-4" />
            <span>My Account</span>
          </Link>

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

      {mobileOpen && (
        <nav className="lg:hidden bg-brand-yellow border-t border-brand-yellow-dark">
          <ul className="px-4 py-2 space-y-1">
            {[
              ...NAV_ITEMS,
              ...INFO_ITEMS,
              { href: "/contact", label: "Contact Us" },
            ].map((item) => (
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
              <Link
                href="/portal"
                className="flex items-center gap-2 px-3 py-2 text-brand-navy font-semibold rounded hover:bg-white/30"
                onClick={() => setMobileOpen(false)}
              >
                <User className="h-4 w-4" /> My Account
              </Link>
            </li>
            <li>
              <a
                href={telHref}
                className="flex items-center gap-2 px-3 py-2 text-brand-navy font-semibold"
              >
                <Phone className="h-4 w-4" /> {phone}
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
