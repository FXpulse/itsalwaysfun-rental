import Link from "next/link";
import { Instagram, Facebook, Phone, Mail, MapPin } from "lucide-react";

const PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "(904) 584-3047";
const EMAIL = process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "admin@itsalwaysfun.com";
const ADDRESS = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "Jacksonville, FL";
const INSTAGRAM = process.env.NEXT_PUBLIC_INSTAGRAM || "https://instagram.com/itsalwaysfunparty";
const FACEBOOK = process.env.NEXT_PUBLIC_FACEBOOK || "https://facebook.com/itsalwaysfunparty";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-navy text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="md:col-span-2">
          <h3 className="text-xl font-bold text-brand-yellow mb-2">
            It's Always Fun, LLC
          </h3>
          <p className="text-white/80 text-sm mb-4 max-w-md">
            We don't just rent bounce houses — we create unforgettable memories
            filled with energy, laughter, and joy. Serving Jacksonville and surrounding areas.
          </p>
          <div className="flex gap-3">
            <a
              href={INSTAGRAM}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-brand-yellow transition"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href={FACEBOOK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-brand-yellow transition"
              aria-label="Facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-semibold text-brand-yellow text-sm uppercase tracking-wider mb-3">
            Contact
          </h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Phone className="h-4 w-4 mt-0.5 text-brand-yellow flex-shrink-0" />
              <a
                href={`tel:${PHONE.replace(/\D/g, "")}`}
                className="hover:text-brand-yellow transition"
              >
                {PHONE}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="h-4 w-4 mt-0.5 text-brand-yellow flex-shrink-0" />
              <a
                href={`mailto:${EMAIL}`}
                className="hover:text-brand-yellow transition break-all"
              >
                {EMAIL}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-brand-yellow flex-shrink-0" />
              <span className="text-white/80">{ADDRESS}</span>
            </li>
          </ul>
        </div>

        {/* Links */}
        <div>
          <h4 className="font-semibold text-brand-yellow text-sm uppercase tracking-wider mb-3">
            Quick Links
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/rentals" className="hover:text-brand-yellow transition">
                All Rentals
              </Link>
            </li>
            <li>
              <Link href="/order-by-date" className="hover:text-brand-yellow transition">
                Book by Date
              </Link>
            </li>
            <li>
              <Link href="/info/faqs" className="hover:text-brand-yellow transition">
                FAQs
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-brand-yellow transition">
                Contact Us
              </Link>
            </li>
            <li>
              <Link href="/info/privacy-policy" className="hover:text-brand-yellow transition">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/info/terms-of-service" className="hover:text-brand-yellow transition">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-white/60 text-center">
          © {year} It's Always Fun, LLC · All rights reserved
        </div>
      </div>
    </footer>
  );
}
