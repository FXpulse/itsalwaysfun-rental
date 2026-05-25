import Link from "next/link";
import { Instagram, Facebook, Phone, Mail, MapPin } from "lucide-react";

interface Props {
  businessName: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  instagramUrl: string;
  facebookUrl: string;
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
}

export function Footer({
  businessName,
  phone,
  email,
  address,
  description,
  instagramUrl,
  facebookUrl,
  bgColor,
  textColor,
  fontFamily,
}: Props) {
  const year = new Date().getFullYear();
  const style: React.CSSProperties = {
    ...(bgColor && { background: bgColor }),
    ...(textColor && { color: textColor }),
    ...(fontFamily && { fontFamily }),
  };
  return (
    <footer className="bg-brand-navy text-white mt-16" style={style}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <h3 className="text-xl font-bold text-brand-yellow mb-2">
            {businessName}
          </h3>
          <p className="text-white/80 text-sm mb-4 max-w-md">{description}</p>
          <div className="flex gap-3">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-brand-yellow transition"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-brand-yellow transition"
              aria-label="Facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-brand-yellow text-sm uppercase tracking-wider mb-3">
            Contact
          </h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Phone className="h-4 w-4 mt-0.5 text-brand-yellow flex-shrink-0" />
              <a
                href={`tel:${phone.replace(/\D/g, "")}`}
                className="hover:text-brand-yellow transition"
              >
                {phone}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="h-4 w-4 mt-0.5 text-brand-yellow flex-shrink-0" />
              <a
                href={`mailto:${email}`}
                className="hover:text-brand-yellow transition break-all"
              >
                {email}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-brand-yellow flex-shrink-0" />
              <span className="text-white/80">{address}</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-brand-yellow text-sm uppercase tracking-wider mb-3">
            Quick Links
          </h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/rentals" className="hover:text-brand-yellow transition">All Rentals</Link></li>
            <li><Link href="/order-by-date" className="hover:text-brand-yellow transition">Book by Date</Link></li>
            <li><Link href="/info/faqs" className="hover:text-brand-yellow transition">FAQs</Link></li>
            <li><Link href="/contact" className="hover:text-brand-yellow transition">Contact Us</Link></li>
            <li><Link href="/info/privacy-policy" className="hover:text-brand-yellow transition">Privacy Policy</Link></li>
            <li><Link href="/info/terms-of-service" className="hover:text-brand-yellow transition">Terms of Service</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-white/60 text-center">
          © {year} {businessName} · All rights reserved ·{" "}
          <Link href="/admin/login" className="text-white/40 hover:text-brand-yellow transition">
            Staff sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
