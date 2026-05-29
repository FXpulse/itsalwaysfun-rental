"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Building2,
  Image as ImageIcon,
  Package,
  CreditCard,
  Check,
  ChevronRight,
  Sparkles,
  Search,
} from "lucide-react";
import {
  saveOnboardingBusinessInfo,
  createOnboardingProduct,
  saveOnboardingSeo,
  finishOnboarding,
  skipOnboarding,
} from "./actions";

interface Props {
  initialBusinessName: string;
  initialPhone: string;
  initialEmail: string;
  initialAddress: string;
  hasLogo: boolean;
  hasStripeConnect: boolean;
  productCount: number;
}

const STEPS = [
  { id: 1, label: "Business info", icon: Building2 },
  { id: 2, label: "Logo", icon: ImageIcon },
  { id: 3, label: "First rental item", icon: Package },
  { id: 4, label: "Connect Stripe", icon: CreditCard },
  { id: 5, label: "Show up on Google", icon: Search },
] as const;

export function OnboardingWizard({
  initialBusinessName,
  initialPhone,
  initialEmail,
  initialAddress,
  hasLogo,
  hasStripeConnect,
  productCount,
}: Props) {
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [savedSteps, setSavedSteps] = useState<Set<number>>(() => {
    const s = new Set<number>();
    if (hasLogo) s.add(2);
    if (productCount > 0) s.add(3);
    if (hasStripeConnect) s.add(4);
    return s;
  });

  // Step 1 form state
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [address, setAddress] = useState(initialAddress);

  // Step 3 form state
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productPrice, setProductPrice] = useState("150");
  const [productStock, setProductStock] = useState("1");

  // Step 5 form state
  const [gbpUrl, setGbpUrl] = useState("");
  const [gscCode, setGscCode] = useState("");

  function markSaved(s: number) {
    setSavedSteps((prev) => new Set(prev).add(s));
  }

  function handleSaveBusiness(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("business_name", businessName);
    fd.set("owner_phone", phone);
    fd.set("business_email", email);
    fd.set("business_address", address);
    startTransition(async () => {
      const res = await saveOnboardingBusinessInfo(fd);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Business info saved");
        markSaved(1);
        setStep(2);
      }
    });
  }

  function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", productName);
    fd.set("description", productDesc);
    fd.set("price_per_day_dollars", productPrice);
    fd.set("stock", productStock);
    startTransition(async () => {
      const res = await createOnboardingProduct(fd);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("First rental item created!");
        markSaved(3);
        setStep(4);
      }
    });
  }

  function handleFinish() {
    startTransition(async () => {
      await finishOnboarding();
    });
  }

  function handleSaveSeo(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("google_business_profile_url", gbpUrl);
    fd.set("seo_google_verification", gscCode);
    startTransition(async () => {
      const res = await saveOnboardingSeo(fd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("SEO settings saved");
      markSaved(5);
      await finishOnboarding();
    });
  }

  function handleSkip() {
    if (!confirm("Skip the rest of setup? You can complete it later from /admin/settings.")) return;
    startTransition(async () => {
      await skipOnboarding();
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-brand-yellow/30 text-brand-navy px-3 py-1 rounded-full text-sm font-semibold mb-3">
            <Sparkles className="h-4 w-4" /> Welcome to RentalFlow
          </div>
          <h1 className="text-3xl font-bold text-brand-navy">
            Let's get you set up in 5 minutes
          </h1>
          <p className="text-slate-600 mt-2">
            Four quick steps and your rental business is ready to take bookings.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8 bg-white rounded-lg p-4 shadow-sm">
          {STEPS.map((s, i) => {
            const done = savedSteps.has(s.id);
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`flex flex-col items-center gap-1 flex-shrink-0 group ${
                    active ? "" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                      done
                        ? "bg-emerald-500 text-white"
                        : active
                        ? "bg-brand-navy text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {done ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                  </div>
                  <span
                    className={`text-[11px] font-medium hidden sm:block ${
                      active ? "text-brand-navy" : "text-slate-500"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      savedSteps.has(s.id) ? "bg-emerald-300" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          {step === 1 && (
            <form onSubmit={handleSaveBusiness} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-brand-navy mb-1">Business info</h2>
                <p className="text-sm text-slate-500 mb-4">
                  This shows up on your public site, emails, and customer invoices.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Business name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={pending}
                  placeholder="Your Rental Co."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={pending}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Business email</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={pending}
                    placeholder="hello@yourbusiness.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  className="input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={pending}
                  placeholder="123 Main St, City, ST 12345"
                />
              </div>
              <div className="flex items-center justify-between pt-3">
                <button type="button" onClick={() => setStep(2)} className="text-sm text-slate-500 hover:underline">
                  Skip for now →
                </button>
                <button type="submit" className="btn-primary inline-flex items-center gap-1" disabled={pending}>
                  {pending ? "Saving..." : "Save and continue"} <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-brand-navy mb-1">Upload your logo</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Your logo appears on your public site, login page, customer emails, and the browser tab.
                </p>
              </div>
              {hasLogo ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-4 flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm text-emerald-900">Logo already uploaded. You can update it any time from Branding.</p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded p-6 text-center">
                  <ImageIcon className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600 mb-4">
                    The upload tool lives on the Branding page. We'll send you there now.
                  </p>
                  <Link
                    href="/admin/settings/branding?return=/admin/onboarding"
                    className="btn-primary inline-flex items-center gap-1"
                  >
                    Open Branding →
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-between pt-3">
                <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-500 hover:underline">
                  ← Back
                </button>
                <button type="button" onClick={() => { markSaved(2); setStep(3); }} className="btn-primary inline-flex items-center gap-1">
                  {hasLogo ? "Continue" : "Skip for now"} <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-brand-navy mb-1">Add your first rental item</h2>
                <p className="text-sm text-slate-500 mb-4">
                  You can add photos and more details later — just give us a name + price to start.
                </p>
              </div>
              {productCount > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-4 flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm text-emerald-900">You already have {productCount} item{productCount > 1 ? "s" : ""}. Add more from the Products page later.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Item name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      disabled={pending}
                      placeholder="Princess Bounce House"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={2}
                      className="input"
                      value={productDesc}
                      onChange={(e) => setProductDesc(e.target.value)}
                      disabled={pending}
                      placeholder="Short description for customers..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Price per day <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          className="input pl-7"
                          value={productPrice}
                          onChange={(e) => setProductPrice(e.target.value)}
                          disabled={pending}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        How many do you own?
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="input"
                        value={productStock}
                        onChange={(e) => setProductStock(e.target.value)}
                        disabled={pending}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between pt-3">
                <button type="button" onClick={() => setStep(2)} className="text-sm text-slate-500 hover:underline">
                  ← Back
                </button>
                {productCount > 0 ? (
                  <button type="button" onClick={() => setStep(4)} className="btn-primary inline-flex items-center gap-1">
                    Continue <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setStep(4)} className="text-sm text-slate-500 hover:underline">
                      Skip for now →
                    </button>
                    <button type="submit" className="btn-primary inline-flex items-center gap-1" disabled={pending}>
                      {pending ? "Creating..." : "Create item"} <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-brand-navy mb-1">Connect Stripe to accept payments</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Stripe Connect routes customer payments directly to your bank. RentalFlow doesn't touch the money — it goes straight to you.
                </p>
              </div>
              {hasStripeConnect ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-4 flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm text-emerald-900">Stripe already connected. You're ready to accept payments.</p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded p-6 text-center">
                  <CreditCard className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600 mb-4">
                    Takes about 5 minutes. You can also do this later if you're not ready.
                  </p>
                  <Link
                    href="/admin/settings/payments?return=/admin/onboarding"
                    className="btn-primary inline-flex items-center gap-1"
                  >
                    Connect Stripe →
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4">
                <button type="button" onClick={() => setStep(3)} className="text-sm text-slate-500 hover:underline">
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  disabled={pending}
                  className="btn-primary inline-flex items-center gap-1"
                >
                  Next: Get found on Google <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <form onSubmit={handleSaveSeo} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-brand-navy mb-1">Show up on Google (optional)</h2>
                <p className="text-sm text-slate-500 mb-4">
                  These two links help customers find you when they search. Both optional — you can finish without and add them later from <code className="text-xs bg-slate-100 px-1 rounded">/admin/site</code> → SEO.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm space-y-2">
                <p className="font-semibold text-blue-900">1. Google Business Profile (most important)</p>
                <p className="text-blue-800">
                  Free Google listing that puts you on Google Maps and the "near me" results. Takes ~5 min to set up — Google mails a postcard to verify your address (5-14 days).
                </p>
                <a
                  href="https://business.google.com"
                  target="_blank"
                  rel="noopener"
                  className="inline-block text-blue-700 underline hover:text-blue-900"
                >
                  Open business.google.com →
                </a>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Your Google Business Profile URL
                </label>
                <input
                  type="url"
                  className="input"
                  value={gbpUrl}
                  onChange={(e) => setGbpUrl(e.target.value)}
                  disabled={pending}
                  placeholder="https://g.page/your-business or https://maps.google.com/..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  Find it in your GBP dashboard under "Share profile". Leave blank if you don't have one yet.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded p-4 text-sm space-y-2">
                <p className="font-semibold text-emerald-900">2. Google Search Console verification (optional)</p>
                <p className="text-emerald-800">
                  Lets you see what people search before clicking on your site. Add your domain at Google Search Console, choose "HTML tag" verification, and paste the code below.
                </p>
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noopener"
                  className="inline-block text-emerald-700 underline hover:text-emerald-900"
                >
                  Open Search Console →
                </a>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Verification code or full meta tag
                </label>
                <input
                  type="text"
                  className="input font-mono text-sm"
                  value={gscCode}
                  onChange={(e) => setGscCode(e.target.value)}
                  disabled={pending}
                  placeholder='Paste the whole <meta name="google-site-verification" content="..."> OR just the content value'
                />
                <p className="text-xs text-slate-500 mt-1">
                  We auto-strip the wrapper if you paste the whole &lt;meta&gt; tag.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4">
                <button type="button" onClick={() => setStep(4)} className="text-sm text-slate-500 hover:underline">
                  ← Back
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={pending}
                    className="text-sm text-slate-500 hover:underline"
                  >
                    Skip — finish setup
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2 rounded inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {pending ? "Saving..." : "Save & finish"} <Check className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Skip setup entirely — I'll configure later
          </button>
        </div>
      </div>
    </div>
  );
}
