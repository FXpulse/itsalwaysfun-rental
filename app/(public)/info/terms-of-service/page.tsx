import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 3600;

export default async function TermsOfServicePage() {
  const settings = await getSiteSettings();
  const updated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-slate">
      <h1 className="text-4xl font-bold text-brand-navy mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: {updated}</p>

      <section className="space-y-6 text-slate-700 leading-relaxed">
        <p>
          By booking a rental from <strong>{settings.business_name}</strong>, you
          agree to the following terms. Please read carefully.
        </p>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Booking & Payment</h2>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Full payment is required to confirm your booking (100% upfront, no deposit/balance system)</li>
            <li>Accepted payment methods: credit/debit cards (via Stripe), Venmo, Zelle, cash</li>
            <li>Your booking is not confirmed until payment is received</li>
            <li>Prices are subject to change but are locked in once your booking is confirmed</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Cancellations & Rescheduling</h2>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>You may reschedule your booking up to 7 days before your event with no fee</li>
            <li>Cancellations within 48 hours of your event are non-refundable</li>
            <li>Cancellations more than 48 hours in advance: refund less a 10% processing fee</li>
            <li>Weather cancellations: see Weather Policy below</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Weather Policy</h2>
          <p>
            For safety, we cannot operate bounce houses in rain, lightning, or sustained
            winds over 15 mph. If severe weather is forecast for your event date:
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Contact us at least 24 hours before your event</li>
            <li>We&apos;ll work with you to reschedule (subject to availability) at no extra charge</li>
            <li>If rescheduling isn&apos;t possible, a full refund will be issued</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Delivery & Setup</h2>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Free delivery within our service area (Jacksonville metro + 30 miles)</li>
            <li>Customer must provide a flat, debris-free area for setup</li>
            <li>One standard 110V electrical outlet must be available within 50 feet of setup location</li>
            <li>Customer is responsible for ensuring access (gates, parking, etc.)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Safety & Supervision</h2>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>An adult (18+) must supervise the equipment at all times when in use</li>
            <li>Maximum capacity and age guidelines must be followed (provided at setup)</li>
            <li>No food, drinks, shoes, sharp objects, or face paint inside inflatables</li>
            <li>Discontinue use in case of sudden weather changes</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Damage & Liability</h2>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Customer is responsible for damage caused by misuse, vandalism, or failure to follow safety rules</li>
            <li>Repair/replacement costs will be billed at fair market value</li>
            <li>{settings.business_name} is not liable for personal injury caused by misuse of equipment</li>
            <li>By renting, customer assumes risk and releases {settings.business_name} from liability arising from proper use</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Service Area</h2>
          <p>
            We serve {settings.service_area}. Bookings outside this area may be
            accepted at our discretion with additional delivery fees.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Contact</h2>
          <p>
            Questions about these Terms?<br/>
            {settings.business_name}<br/>
            {settings.business_address}<br/>
            <a href={`tel:${settings.business_phone.replace(/\D/g, "")}`} className="text-brand-navy underline">
              {settings.business_phone}
            </a><br/>
            <a href={`mailto:${settings.business_email}`} className="text-brand-navy underline">
              {settings.business_email}
            </a>
          </p>
        </div>

        <p className="text-xs text-slate-500 italic pt-6 border-t border-slate-200">
          This is a template Terms of Service. We recommend reviewing with legal
          counsel before publishing.
        </p>
      </section>
    </div>
  );
}
