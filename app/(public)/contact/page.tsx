import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { getSiteSettings } from "@/lib/site-settings";
import { ContactForm } from "./ContactForm";

export const revalidate = 60;

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-brand-navy mb-2">Contact Us</h1>
        <p className="text-slate-600">
          Questions? Custom requests? We&apos;re here to help.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact info */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-brand-yellow-dark flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Phone</div>
                <a
                  href={`tel:${settings.business_phone.replace(/\D/g, "")}`}
                  className="font-semibold text-brand-navy hover:underline"
                >
                  {settings.business_phone}
                </a>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-brand-yellow-dark flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Email</div>
                <a
                  href={`mailto:${settings.business_email}`}
                  className="font-semibold text-brand-navy hover:underline break-all"
                >
                  {settings.business_email}
                </a>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-brand-yellow-dark flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Service area</div>
                <p className="text-sm text-slate-700">{settings.service_area}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-brand-yellow-dark flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Hours</div>
                <p className="text-sm text-slate-700">{settings.business_hours}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-bold text-brand-navy mb-1">Send us a message</h2>
            <p className="text-sm text-slate-500 mb-6">
              We typically reply within 4 hours during business hours.
            </p>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
