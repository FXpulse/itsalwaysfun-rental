import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 3600; // Privacy text changes rarely

export default async function PrivacyPolicyPage() {
  const settings = await getSiteSettings();
  const updated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-slate">
      <h1 className="text-4xl font-bold text-brand-navy mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: {updated}</p>

      <section className="space-y-6 text-slate-700 leading-relaxed">
        <p>
          <strong>{settings.business_name}</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates
          itsalwaysfun.net (the &quot;Site&quot;). This Privacy Policy informs you of our
          policies regarding the collection, use, and disclosure of personal
          data when you use our Site and the choices you have associated with
          that data.
        </p>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Information We Collect</h2>
          <p>When you book a rental, contact us, or use our Site, we may collect:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Personal info: name, email, phone, delivery address</li>
            <li>Event details: date, time, product selected, delivery instructions</li>
            <li>Payment info: processed securely by Stripe (we don&apos;t store card details)</li>
            <li>Communication: messages you send us via forms, email, or SMS</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">How We Use Your Information</h2>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Process and fulfill your rental bookings</li>
            <li>Send booking confirmations, reminders, and post-event follow-ups</li>
            <li>Provide customer support</li>
            <li>Improve our service and inventory</li>
            <li>Comply with legal obligations</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Third-Party Services</h2>
          <p>We use trusted third-party services to operate our business:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Stripe</strong> — payment processing (your card data is handled by Stripe, not us)</li>
            <li><strong>GoHighLevel</strong> — customer relationship management + email/SMS automation</li>
            <li><strong>Supabase</strong> — secure database hosting</li>
            <li><strong>Vercel</strong> — website hosting</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">SMS Communications</h2>
          <p>
            By providing your phone number, you consent to receive booking-related
            SMS messages from us. Standard messaging rates apply. Reply STOP to
            unsubscribe at any time.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Data Retention</h2>
          <p>
            We retain your information as long as necessary to provide our
            services and comply with legal obligations. You may request deletion
            of your data by contacting us.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Your Rights</h2>
          <p>
            You have the right to access, correct, or delete your personal
            information. To exercise these rights, contact us at{" "}
            <a href={`mailto:${settings.business_email}`} className="text-brand-navy underline">
              {settings.business_email}
            </a>.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-brand-navy mb-2">Contact</h2>
          <p>
            Questions about this Privacy Policy?{" "}
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
          This is a template Privacy Policy. We recommend reviewing with legal
          counsel before publishing. Edit content via admin panel (coming soon)
          or contact your developer to customize.
        </p>
      </section>
    </div>
  );
}
