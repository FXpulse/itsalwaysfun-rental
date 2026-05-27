"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isBefore,
  addDays,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar as CalIcon,
  Tag,
  ShoppingBag,
  User,
  CreditCard,
} from "lucide-react";
import { useCart } from "@/lib/cart/context";
import { formatCurrency } from "@/lib/utils";
import { multiDayBreakdown } from "@/lib/pricing";
import { PaymentStep } from "./PaymentStep";
import type { Product } from "@/types/database";

interface Category {
  name: string;
  slug: string;
  is_active: boolean;
}

type Step = "date" | "category" | "product" | "customer" | "payment" | "done";

const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: "date", label: "Date", icon: CalIcon },
  { id: "category", label: "Category", icon: Tag },
  { id: "product", label: "Rental", icon: ShoppingBag },
  { id: "customer", label: "Info", icon: User },
  { id: "payment", label: "Pay", icon: CreditCard },
];

const TIME_OPTIONS = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM",
];

interface BookingResult {
  booking_id: string;
  client_secret: string | null;
  amount: number;
  subtotal?: number;
  discount?: number;
  coupon_code?: string | null;
  product_name: string;
}

interface PrefillCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
}

interface LoyaltyConfig {
  points_redemption_rate: number;
  min_redeem_points: number;
}

interface DamageProtection {
  enabled: boolean;
  priceCents: number;
  coverageCents: number;
}

export function BookingWizard({
  products,
  categories,
  powerSupply,
  customerAddons = [],
  minLeadHours = 48,
  damageProtection,
  stripeConfigured,
  stripePublishableKey,
  prefillCustomer,
  availablePoints = 0,
  loyaltySettings = null,
  waiverEnabled = false,
  waiverTitle = "Liability Waiver",
  waiverText = "",
  coiEnabled = false,
}: {
  products: Product[];
  categories: Category[];
  powerSupply?: Product | null;
  customerAddons?: Product[];
  minLeadHours?: number;
  damageProtection?: DamageProtection;
  stripeConfigured: boolean;
  stripePublishableKey: string;
  prefillCustomer?: PrefillCustomer | null;
  availablePoints?: number;
  loyaltySettings?: LoyaltyConfig | null;
  waiverEnabled?: boolean;
  waiverTitle?: string;
  waiverText?: string;
  coiEnabled?: boolean;
}) {
  const { item: cartItem, clear } = useCart();

  // If the cart has a productSlug from a Book Now click, validate it matches
  // an active product. Stale slugs are ignored (defensive).
  const preSelectedProductSlug = useMemo(() => {
    if (!cartItem?.productSlug) return null;
    return products.find((p) => p.slug === cartItem.productSlug)
      ? cartItem.productSlug
      : null;
  }, [cartItem?.productSlug, products]);
  const hasPreSelectedProduct = !!preSelectedProductSlug;

  // Wizard state — always starts at date; if a product was pre-selected from
  // an item page, the category + product picker steps are skipped entirely.
  const [step, setStep] = useState<Step>("date");
  const [eventDate, setEventDate] = useState<string | null>(cartItem?.eventDate || null);
  const [eventEndDate, setEventEndDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("9:00 AM");
  const [endTime, setEndTime] = useState("5:00 PM");

  // numDays is computed from date range
  const numDays = useMemo(() => {
    if (!eventDate) return 1;
    if (!eventEndDate || eventEndDate === eventDate) return 1;
    const start = new Date(eventDate + "T00:00:00");
    const end = new Date(eventEndDate + "T00:00:00");
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  }, [eventDate, eventEndDate]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    cartItem?.productSlug
      ? products.find((p) => p.slug === cartItem.productSlug)?.category || null
      : null,
  );
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(
    cartItem?.productSlug || null,
  );
  const [customer, setCustomer] = useState({
    firstName: prefillCustomer?.firstName || "",
    lastName: prefillCustomer?.lastName || "",
    email: prefillCustomer?.email || "",
    phone: prefillCustomer?.phone || "",
    address: prefillCustomer?.address || "",
    city: "Jacksonville",
    zip: "",
    notes: "",
    surfaceType: "",
    powerSource: "" as "" | "yes" | "no", // yes = has outlet, no = needs power supply add-on
  });
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [redeemPoints, setRedeemPoints] = useState(0);
  // Map of addon productId → quantity (0 or missing = not selected)
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  // Damage protection opt-in (one-time fee, not per day)
  const [wantsProtection, setWantsProtection] = useState(false);
  // Liability waiver — signed at checkout
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [waiverSignedName, setWaiverSignedName] = useState("");
  // COI request — venue requires Certificate of Insurance
  const [coiRequested, setCoiRequested] = useState(false);
  const [coiVenueName, setCoiVenueName] = useState("");
  const [coiVenueAddress, setCoiVenueAddress] = useState("");
  const [coiAdditionalInsured, setCoiAdditionalInsured] = useState("");
  const [coiInstructions, setCoiInstructions] = useState("");
  const [pending, startTransition] = useTransition();
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(new Set());
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Cart item pre-fills product + category selection but user still
  // walks through each step (no auto-skip — was buggy with stale cart).

  // When product selected, fetch its unavailable dates
  useEffect(() => {
    if (!selectedProductSlug) {
      setUnavailableDates(new Set());
      return;
    }
    setLoadingAvailability(true);
    fetch(`/api/products/${selectedProductSlug}`)
      .then((r) => r.json())
      .then((data) => {
        setUnavailableDates(new Set(data.unavailable_dates || []));
      })
      .catch(() => {})
      .finally(() => setLoadingAvailability(false));
  }, [selectedProductSlug]);

  // Abandoned cart timer: 30 min after user enters customer info with email,
  // fire GHL webhook so they can recover the booking via email/SMS.
  // Resets on any form change. Cleared when leaving the customer step (submit
  // moves to "payment", back button moves to "product") — so it only fires if
  // user lingered on the info step without progressing.
  useEffect(() => {
    if (step !== "customer") return;
    if (!customer.email || !customer.email.includes("@")) return;
    if (!selectedProductSlug || !eventDate) return;

    const ABANDONED_CART_MS = 30 * 60 * 1000;
    const product = products.find((p) => p.slug === selectedProductSlug);
    if (!product) return;

    const fireAtKey = `iaf_abandoned_fired_${customer.email}`;
    if (typeof window !== "undefined") {
      const last = window.localStorage.getItem(fireAtKey);
      if (last && Date.now() - parseInt(last, 10) < ABANDONED_CART_MS) {
        return; // already fired for this email recently
      }
    }

    const timer = setTimeout(() => {
      const days = (() => {
        if (!eventEndDate || eventEndDate === eventDate) return 1;
        const s = new Date(eventDate + "T00:00:00");
        const e = new Date(eventEndDate + "T00:00:00");
        return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
      })();
      const subtotal = days === 1
        ? product.price_per_day
        : Math.round(product.price_per_day + product.price_per_day * 0.30 * (days - 1));

      fetch("/api/bookings/abandoned-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          product: product.name,
          productSlug: product.slug,
          eventDate,
          eventEndDate: eventEndDate || eventDate,
          totalPrice: Math.round(subtotal / 100),
          source: "abandoned-cart-30min",
        }),
      }).catch(() => {});

      if (typeof window !== "undefined") {
        window.localStorage.setItem(fireAtKey, String(Date.now()));
      }
    }, ABANDONED_CART_MS);

    return () => clearTimeout(timer);
  }, [
    step,
    customer.email,
    customer.firstName,
    customer.lastName,
    customer.phone,
    selectedProductSlug,
    eventDate,
    eventEndDate,
    products,
  ]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.slug === selectedProductSlug),
    [products, selectedProductSlug],
  );

  const filteredProducts = useMemo(
    () => products.filter((p) => p.category === selectedCategory),
    [products, selectedCategory],
  );

  // Hide category + product steps when user came from an item page with a
  // valid product already pre-selected.
  const visibleSteps = useMemo(
    () =>
      hasPreSelectedProduct
        ? STEPS.filter((s) => s.id !== "category" && s.id !== "product")
        : STEPS,
    [hasPreSelectedProduct],
  );
  const currentStepIdx = visibleSteps.findIndex((s) => s.id === step);

  function goToStep(s: Step) {
    setStep(s);
  }

  // Build list of dates in range (for weekend pricing breakdown)
  const dateList = useMemo(() => {
    if (!eventDate) return [];
    const out: string[] = [];
    const start = new Date(eventDate + "T00:00:00");
    const end = new Date((eventEndDate || eventDate) + "T00:00:00");
    const cur = new Date(start);
    while (cur <= end) {
      out.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [eventDate, eventEndDate]);

  // Multi-day total with optional weekend pricing.
  // Each day uses weekend_price if Sat/Sun (when set), else price_per_day.
  // Day 1 = full; Day 2+ = 30% surcharge of that day's base.
  const priceBreakdown = useMemo(() => {
    if (!selectedProduct || dateList.length === 0) {
      return { breakdown: [], total: 0 };
    }
    return multiDayBreakdown(
      dateList,
      selectedProduct.price_per_day,
      selectedProduct.weekend_price_per_day || null,
    );
  }, [selectedProduct, dateList]);
  const productTotal = priceBreakdown.total;

  // Power supply add-on: flat per-day cost (no 30% surcharge — it's an operational fee)
  const needsPowerSupply = customer.powerSource === "no";
  const powerSupplyCost = useMemo(() => {
    if (!needsPowerSupply || !powerSupply) return 0;
    return powerSupply.price_per_day * numDays;
  }, [needsPowerSupply, powerSupply, numDays]);

  // Customer-selected addons: flat per-day × qty × num days (no surcharge)
  const addonsTotal = useMemo(() => {
    return customerAddons.reduce((sum, addon) => {
      const qty = addonQuantities[addon.id] || 0;
      if (qty <= 0) return sum;
      return sum + addon.price_per_day * qty * numDays;
    }, 0);
  }, [customerAddons, addonQuantities, numDays]);

  const protectionCost =
    damageProtection?.enabled && wantsProtection ? damageProtection.priceCents : 0;

  const totalAmount = productTotal + powerSupplyCost + addonsTotal + protectionCost;

  // For API: use end date if set, else single-day (event_date repeated)
  const effectiveEndDate = eventEndDate || eventDate;

  async function handleSubmit() {
    if (!selectedProduct || !eventDate) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/bookings/check-and-hold", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_slug: selectedProduct.slug,
            event_date: eventDate,
            event_end_date: effectiveEndDate,
            start_time: convertTime(startTime),
            end_time: convertTime(endTime),
            customer: {
              first_name: customer.firstName,
              last_name: customer.lastName,
              email: customer.email,
              phone: customer.phone,
              address: `${customer.address}, ${customer.city} ${customer.zip}`.trim(),
            },
            surface_type: customer.surfaceType || null,
            needs_power_supply: needsPowerSupply,
            damage_protection: wantsProtection,
            addons: Object.entries(addonQuantities)
              .filter(([_, qty]) => qty > 0)
              .map(([product_id, quantity]) => ({ product_id, quantity })),
            notes: customer.notes || null,
            coupon_code: couponCode.trim() || undefined,
            gift_card_code: giftCardCode.trim() || undefined,
            redeem_points: redeemPoints > 0 ? redeemPoints : undefined,
            waiver_signature: waiverEnabled
              ? { agreed: waiverAgreed, signed_name: waiverSignedName.trim() }
              : undefined,
            coi_request:
              coiEnabled && coiRequested && coiVenueName.trim()
                ? {
                    venue_name: coiVenueName.trim(),
                    venue_address: coiVenueAddress.trim() || null,
                    additional_insured: coiAdditionalInsured.trim() || null,
                    special_instructions: coiInstructions.trim() || null,
                  }
                : undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          // Show the full error including details (helps debug Stripe/schema issues)
          const fullMsg = data.details
            ? `${data.error || "Error"}: ${data.details}`
            : data.error || "Failed to start booking";
          toast.error(fullMsg, { duration: 20000 });
          // Also dump to console for copy-paste
          console.error("Booking error:", data);
          return;
        }

        // Fire GHL webhook (best-effort, non-blocking)
        fireGhlWebhook({
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          zip: customer.zip,
          eventDate,
          eventEndDate: effectiveEndDate,
          numDays,
          startTime,
          endTime,
          product: selectedProduct.name,
          productSlug: selectedProduct.slug,
          totalPrice: Math.round(totalAmount / 100),
          notes: customer.notes,
          source: "website-booking",
        }).catch(() => {});

        setBookingResult({
          booking_id: data.booking_id,
          client_secret: data.client_secret,
          amount: data.amount,
          subtotal: data.subtotal,
          discount: data.discount,
          coupon_code: data.coupon_code,
          product_name: data.product_name,
        });
        // If the coupon/gift card covers 100% (total < $0.50), Stripe is skipped
        // and the booking is already marked paid. Go straight to confirmation.
        if (data.fully_discounted || data.amount < 50) {
          setStep("done");
        } else {
          setStep("payment");
        }
      } catch (e: any) {
        toast.error(e.message || "Network error");
      }
    });
  }

  // ── Render ──────────────────────────────────────────────
  if (step === "done") {
    return (
      <ConfirmationScreen
        productName={selectedProduct?.name || ""}
        eventDate={eventDate || ""}
        startTime={startTime}
        endTime={endTime}
        amount={selectedProduct?.price_per_day || 0}
        customerEmail={customer.email}
        onReset={() => {
          clear();
          window.location.href = "/";
        }}
      />
    );
  }

  return (
    <div>
      {/* When user came from a Book Now button, give them a way out to pick a
          different product without manually clearing the cart from the header. */}
      {hasPreSelectedProduct && selectedProduct && (
        <div className="mb-4 bg-slate-50 border border-slate-200 rounded p-2 flex items-center justify-between text-xs">
          <span className="text-slate-600">
            Booking: <strong className="text-brand-navy">{selectedProduct.name}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `Remove "${selectedProduct.name}" and pick a different rental?`,
                )
              ) {
                clear();
                window.location.reload();
              }
            }}
            className="text-red-600 hover:text-red-800 underline"
          >
            Choose a different product
          </button>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex justify-between mb-8">
        {visibleSteps.map((s, idx) => {
          const isActive = idx === currentStepIdx;
          const isComplete = idx < currentStepIdx;
          return (
            <div key={s.id} className="flex-1 flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition ${
                  isActive
                    ? "bg-brand-navy text-white ring-4 ring-brand-navy/20"
                    : isComplete
                      ? "bg-brand-yellow text-brand-navy"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {isComplete ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              <span
                className={`text-xs font-medium ${isActive ? "text-brand-navy" : "text-slate-400"}`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="card">
        {step === "date" && (
          <DatePickerStep
            startDate={eventDate}
            endDate={eventEndDate}
            onChange={(start, end) => {
              setEventDate(start);
              setEventEndDate(end);
            }}
            product={selectedProduct}
            numDays={numDays}
            totalAmount={totalAmount}
            onNext={() => goToStep(hasPreSelectedProduct ? "customer" : "category")}
            unavailableDates={selectedProductSlug ? unavailableDates : new Set()}
            minLeadHours={minLeadHours}
          />
        )}

        {step === "category" && (
          <CategoryPickerStep
            categories={categories}
            value={selectedCategory}
            onChange={(c) => setSelectedCategory(c)}
            onBack={() => goToStep("date")}
            onNext={() => goToStep("product")}
          />
        )}

        {step === "product" && (
          <ProductPickerStep
            products={filteredProducts}
            value={selectedProductSlug}
            onChange={(slug) => setSelectedProductSlug(slug)}
            onBack={() => goToStep("category")}
            onNext={() => goToStep("customer")}
          />
        )}

        {step === "customer" && selectedProduct && (
          <CustomerInfoStep
            customer={customer}
            onChange={setCustomer}
            startTime={startTime}
            endTime={endTime}
            onTimeChange={(s, e) => {
              setStartTime(s);
              setEndTime(e);
            }}
            product={selectedProduct}
            eventDate={eventDate!}
            eventEndDate={effectiveEndDate}
            numDays={numDays}
            productTotal={productTotal}
            priceBreakdown={priceBreakdown.breakdown}
            powerSupply={powerSupply}
            powerSupplyCost={powerSupplyCost}
            customerAddons={customerAddons}
            addonQuantities={addonQuantities}
            onAddonQtyChange={(productId, qty) =>
              setAddonQuantities((prev) => ({ ...prev, [productId]: qty }))
            }
            addonsTotal={addonsTotal}
            damageProtection={damageProtection}
            wantsProtection={wantsProtection}
            onProtectionChange={setWantsProtection}
            protectionCost={protectionCost}
            totalAmount={totalAmount}
            couponCode={couponCode}
            onCouponChange={setCouponCode}
            giftCardCode={giftCardCode}
            onGiftCardChange={setGiftCardCode}
            availablePoints={availablePoints}
            loyaltySettings={loyaltySettings}
            redeemPoints={redeemPoints}
            onRedeemPointsChange={setRedeemPoints}
            waiverEnabled={waiverEnabled}
            waiverTitle={waiverTitle}
            waiverText={waiverText}
            waiverAgreed={waiverAgreed}
            onWaiverAgreedChange={setWaiverAgreed}
            waiverSignedName={waiverSignedName}
            onWaiverSignedNameChange={setWaiverSignedName}
            coiEnabled={coiEnabled}
            coiRequested={coiRequested}
            onCoiRequestedChange={setCoiRequested}
            coiVenueName={coiVenueName}
            onCoiVenueNameChange={setCoiVenueName}
            coiVenueAddress={coiVenueAddress}
            onCoiVenueAddressChange={setCoiVenueAddress}
            coiAdditionalInsured={coiAdditionalInsured}
            onCoiAdditionalInsuredChange={setCoiAdditionalInsured}
            coiInstructions={coiInstructions}
            onCoiInstructionsChange={setCoiInstructions}
            onBack={() => goToStep(hasPreSelectedProduct ? "date" : "product")}
            onSubmit={handleSubmit}
            pending={pending}
          />
        )}

        {step === "payment" && bookingResult && selectedProduct && (
          <PaymentStep
            bookingResult={bookingResult}
            selectedProduct={selectedProduct}
            eventDate={eventDate!}
            startTime={startTime}
            stripeConfigured={stripeConfigured}
            stripePublishableKey={stripePublishableKey}
            onComplete={() => setStep("done")}
          />
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────

function convertTime(label: string): string {
  // "9:00 AM" → "09:00:00"
  const [time, period] = label.split(" ");
  const [h, m] = time.split(":").map(Number);
  let hour = h;
  if (period === "PM" && h !== 12) hour += 12;
  if (period === "AM" && h === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

async function fireGhlWebhook(payload: any) {
  // Fire-and-forget — public-callable from client
  await fetch("/api/bookings/notify-ghl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ── Sub-components ─────────────────────────────────────────

function DatePickerStep({
  startDate,
  endDate,
  onChange,
  product,
  numDays,
  totalAmount,
  onNext,
  unavailableDates,
  minLeadHours = 48,
}: {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
  product: Product | undefined;
  numDays: number;
  totalAmount: number;
  onNext: () => void;
  unavailableDates: Set<string>;
  minLeadHours?: number;
}) {
  const [cursor, setCursor] = useState(startDate ? new Date(startDate) : new Date());

  function handleDayClick(iso: string) {
    // No start yet → set start
    if (!startDate) {
      onChange(iso, null);
      return;
    }
    // Has start, no end yet
    if (!endDate) {
      if (iso === startDate) {
        // Click same date again → clear
        onChange(null, null);
      } else if (iso > startDate) {
        // Click later → set as end
        onChange(startDate, iso);
      } else {
        // Click earlier → make new start
        onChange(iso, null);
      }
      return;
    }
    // Has both — reset to single-day at clicked
    onChange(iso, null);
  }

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build effective range (end = startDate if not set yet)
  const effectiveEnd = endDate || startDate;
  const rangeSet = useMemo(() => {
    if (!startDate || !effectiveEnd) return new Set<string>();
    const set = new Set<string>();
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(effectiveEnd + "T00:00:00");
    const cur = new Date(start);
    while (cur <= end) {
      set.add(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return set;
  }, [startDate, effectiveEnd]);

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-navy mb-1">When is your event?</h2>
      <p className="text-sm text-slate-500 mb-2">
        Click a date to set the <strong>start</strong>. Click another to set the
        <strong> end</strong> (multi-day). Click again to reset.
      </p>
      {minLeadHours > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          ⏰ <strong>Bookings require {minLeadHours}h notice.</strong> Dates within
          the next {minLeadHours} hours are disabled — call (904) 584-3047 for
          last minute reservations.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar — takes 2/3 on desktop */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCursor(subMonths(cursor, 1))} className="p-2 rounded hover:bg-slate-100">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-semibold text-brand-navy">{format(cursor, "MMMM yyyy")}</h3>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-2 rounded hover:bg-slate-100">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wider text-slate-500 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const iso = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, cursor);
              const isPast = isBefore(day, today);
              const isToday = isSameDay(day, today);
              const isStart = startDate === iso;
              const isEnd = endDate === iso;
              const isUnavail = unavailableDates.has(iso);
              // Lead time check: day must be at least minLeadHours from now
              const dayDt = new Date(`${iso}T09:00:00`);
              const hoursAway = (dayDt.getTime() - Date.now()) / (1000 * 60 * 60);
              const tooSoon = hoursAway < minLeadHours;

              const disabled = !inMonth || isPast || isUnavail || tooSoon;
              const isInRange = rangeSet.has(iso) && !isStart && !isEnd;

              return (
                <button
                  key={iso}
                  onClick={() => !disabled && handleDayClick(iso)}
                  disabled={disabled}
                  title={
                    tooSoon && !isPast
                      ? `Bookings require ${minLeadHours}h notice — call (904) 584-3047 for last minute reservations`
                      : undefined
                  }
                  className={`aspect-square rounded text-sm font-medium transition relative
                    ${!inMonth ? "text-slate-300" : ""}
                    ${isPast ? "text-slate-300 cursor-not-allowed" : ""}
                    ${tooSoon && inMonth && !isPast ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""}
                    ${isUnavail && inMonth && !isPast && !tooSoon ? "bg-red-50 text-red-300 cursor-not-allowed line-through" : ""}
                    ${isStart || isEnd ? "bg-brand-navy text-white ring-2 ring-brand-yellow font-bold" : ""}
                    ${isInRange ? "bg-brand-yellow/40 text-brand-navy font-semibold" : ""}
                    ${!disabled && !isStart && !isEnd && !isInRange ? "hover:bg-brand-yellow/30 text-brand-navy" : ""}
                    ${isToday && !isStart && !isEnd ? "ring-2 ring-brand-yellow/60" : ""}
                  `}
                >
                  {format(day, "d")}
                  {isStart && endDate && (
                    <span className="absolute top-0 right-0 text-[8px] bg-brand-yellow text-brand-navy px-1 rounded-bl">S</span>
                  )}
                  {isEnd && (
                    <span className="absolute top-0 right-0 text-[8px] bg-brand-yellow text-brand-navy px-1 rounded-bl">E</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary sidebar — 1/3 on desktop, below on mobile */}
        <div className="lg:col-span-1">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 sticky top-4">
            <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3">
              Your selection
            </h3>

            <div className="space-y-3 text-sm mb-4">
              <div>
                <div className="text-xs uppercase text-slate-500">Start date</div>
                <div className={`font-semibold ${startDate ? "text-brand-navy" : "text-slate-400"}`}>
                  {startDate ? format(new Date(startDate + "T00:00:00"), "EEE, MMM d, yyyy") : "Click a date"}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-slate-500">End date</div>
                <div className={`font-semibold ${endDate ? "text-brand-navy" : "text-slate-400"}`}>
                  {endDate
                    ? format(new Date(endDate + "T00:00:00"), "EEE, MMM d, yyyy")
                    : startDate
                      ? <span className="italic text-xs">(same as start = 1 day)</span>
                      : "—"}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="text-xs uppercase text-slate-500">Days</div>
                <div className="font-bold text-brand-navy text-lg">
                  {numDays} day{numDays === 1 ? "" : "s"}
                </div>
              </div>

              {product && (
                <>
                  <div>
                    <div className="text-xs uppercase text-slate-500">Rental</div>
                    <div className="font-semibold text-brand-navy">{product.name}</div>
                  </div>
                  <div className="border-t border-slate-200 pt-3 space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Base (1 day)</span>
                      <span>${(product.price_per_day / 100).toFixed(2)}</span>
                    </div>
                    {numDays > 1 && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>+ {numDays - 1} extra day{numDays - 1 === 1 ? "" : "s"} × 30%</span>
                        <span>${((totalAmount - product.price_per_day) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-brand-navy pt-2 border-t border-slate-200">
                      <span>Total</span>
                      <span>${(totalAmount / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
              {!product && startDate && (
                <p className="text-xs text-slate-400 italic pt-2 border-t border-slate-200">
                  Pick a rental in the next step to see total.
                </p>
              )}
            </div>

            {startDate && (
              <button
                onClick={() => onChange(null, null)}
                className="text-xs text-slate-500 hover:text-red-600 mb-3 underline"
              >
                Clear selection
              </button>
            )}

            <button
              onClick={onNext}
              disabled={!startDate}
              className="btn-primary w-full disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryPickerStep({
  categories,
  value,
  onChange,
  onBack,
  onNext,
}: {
  categories: Category[];
  value: string | null;
  onChange: (cat: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-brand-navy mb-1">What kind of rental?</h2>
      <p className="text-sm text-slate-500 mb-6">Pick a category to see your options.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {categories.map((c) => (
          <button
            key={c.slug}
            onClick={() => onChange(c.name)}
            className={`p-4 rounded-lg border-2 text-left transition ${
              value === c.name
                ? "border-brand-navy bg-brand-yellow/20"
                : "border-slate-200 hover:border-brand-yellow"
            }`}
          >
            <div className="font-bold text-brand-navy">{c.name}</div>
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-slate-600 hover:text-slate-900">
          ← Back
        </button>
        <button onClick={onNext} disabled={!value} className="btn-primary disabled:opacity-50">
          Continue →
        </button>
      </div>
    </div>
  );
}

function ProductPickerStep({
  products,
  value,
  onChange,
  onBack,
  onNext,
}: {
  products: Product[];
  value: string | null;
  onChange: (slug: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-brand-navy mb-1">Pick your rental</h2>
      <p className="text-sm text-slate-500 mb-6">
        {products.length} options — all $/day, free delivery within Jacksonville metro.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.slug)}
            className={`rounded-lg border-2 overflow-hidden text-left transition ${
              value === p.slug
                ? "border-brand-navy bg-brand-yellow/10"
                : "border-slate-200 hover:border-brand-yellow"
            }`}
          >
            <div className="aspect-[4/3] relative bg-slate-50">
              {p.image_url ? (
                <Image
                  src={p.image_url}
                  alt={p.name}
                  fill
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-300 text-sm">
                  No image
                </div>
              )}
            </div>
            <div className="p-3">
              <div className="font-bold text-brand-navy text-sm">{p.name}</div>
              <div className="text-xs text-slate-500 mt-1">{formatCurrency(p.price_per_day)} / day</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-slate-600 hover:text-slate-900">
          ← Back
        </button>
        <button onClick={onNext} disabled={!value} className="btn-primary disabled:opacity-50">
          Continue →
        </button>
      </div>
    </div>
  );
}

function CustomerInfoStep({
  customer,
  onChange,
  startTime,
  endTime,
  onTimeChange,
  product,
  eventDate,
  eventEndDate,
  numDays,
  productTotal,
  priceBreakdown,
  powerSupply,
  powerSupplyCost,
  customerAddons,
  addonQuantities,
  onAddonQtyChange,
  addonsTotal,
  damageProtection,
  wantsProtection,
  onProtectionChange,
  protectionCost,
  totalAmount,
  couponCode,
  onCouponChange,
  giftCardCode,
  onGiftCardChange,
  availablePoints,
  loyaltySettings,
  redeemPoints,
  onRedeemPointsChange,
  waiverEnabled,
  waiverTitle,
  waiverText,
  waiverAgreed,
  onWaiverAgreedChange,
  waiverSignedName,
  onWaiverSignedNameChange,
  coiEnabled,
  coiRequested,
  onCoiRequestedChange,
  coiVenueName,
  onCoiVenueNameChange,
  coiVenueAddress,
  onCoiVenueAddressChange,
  coiAdditionalInsured,
  onCoiAdditionalInsuredChange,
  coiInstructions,
  onCoiInstructionsChange,
  onBack,
  onSubmit,
  pending,
}: {
  customer: any;
  onChange: (c: any) => void;
  startTime: string;
  endTime: string;
  onTimeChange: (s: string, e: string) => void;
  product: Product;
  eventDate: string;
  eventEndDate: string | null;
  numDays: number;
  productTotal: number;
  priceBreakdown: Array<{
    date: string;
    isWeekend: boolean;
    basePriceCents: number;
    appliedPriceCents: number;
    isFirstDay: boolean;
  }>;
  powerSupply: Product | null | undefined;
  powerSupplyCost: number;
  customerAddons: Product[];
  addonQuantities: Record<string, number>;
  onAddonQtyChange: (productId: string, qty: number) => void;
  addonsTotal: number;
  damageProtection?: DamageProtection;
  wantsProtection: boolean;
  onProtectionChange: (b: boolean) => void;
  protectionCost: number;
  totalAmount: number;
  couponCode: string;
  onCouponChange: (s: string) => void;
  giftCardCode: string;
  onGiftCardChange: (s: string) => void;
  availablePoints: number;
  loyaltySettings: { points_redemption_rate: number; min_redeem_points: number } | null;
  redeemPoints: number;
  onRedeemPointsChange: (n: number) => void;
  waiverEnabled: boolean;
  waiverTitle: string;
  waiverText: string;
  waiverAgreed: boolean;
  onWaiverAgreedChange: (b: boolean) => void;
  waiverSignedName: string;
  onWaiverSignedNameChange: (s: string) => void;
  coiEnabled: boolean;
  coiRequested: boolean;
  onCoiRequestedChange: (b: boolean) => void;
  coiVenueName: string;
  onCoiVenueNameChange: (s: string) => void;
  coiVenueAddress: string;
  onCoiVenueAddressChange: (s: string) => void;
  coiAdditionalInsured: string;
  onCoiAdditionalInsuredChange: (s: string) => void;
  coiInstructions: string;
  onCoiInstructionsChange: (s: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const waiverOk = !waiverEnabled || (waiverAgreed && waiverSignedName.trim().length >= 2);
  const coiOk = !coiRequested || coiVenueName.trim().length > 0;
  // Power source question only shows when powerSupply add-on product exists.
  // If missing, don't block the form on it (defensive — old DBs without seed).
  const powerSourceOk = !powerSupply || !!customer.powerSource;

  const valid =
    customer.firstName.trim() &&
    customer.lastName.trim() &&
    customer.email.trim() &&
    customer.phone.trim() &&
    customer.address.trim() &&
    customer.city.trim() &&
    customer.zip.trim() &&
    customer.surfaceType &&
    powerSourceOk &&
    waiverOk &&
    coiOk;

  const rangeLabel =
    numDays > 1 && eventEndDate
      ? `${format(new Date(eventDate), "MMM d")} – ${format(new Date(eventEndDate), "MMM d, yyyy")}`
      : format(new Date(eventDate), "EEE, MMM d, yyyy");

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-navy mb-1">Your details</h2>
      <p className="text-sm text-slate-500 mb-6">
        For <strong>{product.name}</strong> on <strong>{rangeLabel}</strong>
        {numDays > 1 && (
          <> · <strong>{numDays} days × {formatCurrency(product.price_per_day)}</strong></>
        )}
        {" "}·{" "}
        <strong className="text-brand-navy">Total: {formatCurrency(totalAmount)}</strong>
      </p>

      {/* Time pickers */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Start time</label>
          <select
            value={startTime}
            onChange={(e) => onTimeChange(e.target.value, endTime)}
            className="input"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">End time</label>
          <select
            value={endTime}
            onChange={(e) => onTimeChange(startTime, e.target.value)}
            className="input"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer info */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First name *</label>
            <input
              required
              value={customer.firstName}
              onChange={(e) => onChange({ ...customer, firstName: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last name *</label>
            <input
              required
              value={customer.lastName}
              onChange={(e) => onChange({ ...customer, lastName: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={customer.email}
              onChange={(e) => onChange({ ...customer, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
            <input
              type="tel"
              required
              value={customer.phone}
              onChange={(e) => onChange({ ...customer, phone: e.target.value })}
              placeholder="(904) 555-1234"
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Delivery address *</label>
          <input
            required
            value={customer.address}
            onChange={(e) => onChange({ ...customer, address: e.target.value })}
            placeholder="123 Main St"
            className="input"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">City *</label>
            <input
              required
              value={customer.city}
              onChange={(e) => onChange({ ...customer, city: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ZIP *</label>
            <input
              required
              value={customer.zip}
              onChange={(e) => onChange({ ...customer, zip: e.target.value })}
              placeholder="32256"
              className="input"
            />
          </div>
        </div>

        {/* Surface type — required so we bring the right anchors */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Setup surface <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Where will the inflatable be set up? We bring different anchors/stakes
            depending on the surface.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { value: "grass", label: "Grass" },
              { value: "dirt", label: "Dirt" },
              { value: "concrete", label: "Concrete" },
              { value: "paver", label: "Paver" },
              { value: "asphalt", label: "Asphalt" },
              { value: "other", label: "Other" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...customer, surfaceType: opt.value })}
                className={`text-xs font-semibold py-2 px-2 rounded border transition ${
                  customer.surfaceType === opt.value
                    ? "bg-brand-navy text-white border-brand-navy"
                    : "bg-white text-slate-700 border-slate-300 hover:border-brand-navy"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Power source — operationally important. Always ask the customer
            so the dispatch team knows whether to bring a generator, regardless
            of whether the power-supply add-on product is configured for sale. */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Power source available?
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Inflatables need a power outlet within ~75ft.{" "}
            {powerSupply
              ? `If you don't have one, we add a portable generator for $${(powerSupply.price_per_day / 100).toFixed(2)}/day.`
              : "If you don't have one, we'll bring a portable generator (call us for pricing)."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...customer, powerSource: "yes" })}
              className={`text-sm font-semibold py-3 px-2 rounded border transition ${
                customer.powerSource === "yes"
                  ? "bg-brand-navy text-white border-brand-navy"
                  : "bg-white text-slate-700 border-slate-300 hover:border-brand-navy"
              }`}
            >
              ✓ Yes, I have an outlet
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...customer, powerSource: "no" })}
              className={`text-sm font-semibold py-3 px-2 rounded border transition ${
                customer.powerSource === "no"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-amber-600"
              }`}
            >
              No — bring power supply
              {powerSupply && (
                <div className="text-[10px] font-normal opacity-80 mt-0.5">
                  +${(powerSupply.price_per_day / 100).toFixed(2)} × {numDays} day{numDays > 1 ? "s" : ""}
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Weekend pricing breakdown — show when ANY day is weekend AND the
            product has a weekend rate set (even if all chosen days are weekend
            with same price). Customer always sees clearly when weekend rate
            applies. */}
        {priceBreakdown.length > 0 &&
          product.weekend_price_per_day != null &&
          product.weekend_price_per_day !== product.price_per_day &&
          priceBreakdown.some((d) => d.isWeekend) && (
            <div className="bg-blue-50 rounded p-3 border border-blue-200 text-sm">
              <div className="font-semibold text-brand-navy mb-2">
                Per-day pricing (weekend rate applied)
              </div>
              {priceBreakdown.map((d) => {
                const dt = new Date(d.date + "T00:00:00");
                const label = dt.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div key={d.date} className="flex justify-between text-xs text-slate-700">
                    <span>
                      {label}
                      {d.isWeekend && (
                        <span className="ml-1 text-[10px] bg-yellow-200 text-yellow-900 rounded px-1">
                          weekend
                        </span>
                      )}
                      {!d.isFirstDay && <span className="ml-1 text-slate-400">+30%</span>}
                    </span>
                    <span className="font-mono">
                      {d.isFirstDay
                        ? formatCurrency(d.appliedPriceCents)
                        : `+${formatCurrency(d.appliedPriceCents)}`}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between border-t border-blue-300 pt-2 mt-2 font-bold text-brand-navy">
                <span>Rental subtotal</span>
                <span className="font-mono">{formatCurrency(productTotal)}</span>
              </div>
            </div>
          )}

        {/* Optional customer add-ons (chairs, tables, etc.) */}
        {customerAddons.length > 0 && (
          <div className="bg-slate-50 rounded p-3 border border-slate-200">
            <div className="text-sm font-medium text-slate-700 mb-2">
              Optional add-ons <span className="text-xs text-slate-500">(rent extras for your event)</span>
            </div>
            <div className="space-y-2">
              {customerAddons.map((addon) => {
                const qty = addonQuantities[addon.id] || 0;
                const lineTotal = addon.price_per_day * qty * numDays;
                return (
                  <div
                    key={addon.id}
                    className={`flex items-center gap-3 p-2 rounded border ${qty > 0 ? "bg-white border-brand-yellow" : "bg-white border-slate-200"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{addon.name}</div>
                      {addon.description && (
                        <div className="text-xs text-slate-500 truncate">{addon.description}</div>
                      )}
                      <div className="text-xs text-slate-600 mt-0.5">
                        ${(addon.price_per_day / 100).toFixed(2)}/day
                        {qty > 0 && numDays > 1 && (
                          <span className="text-slate-400"> × {numDays} days</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAddonQtyChange(addon.id, Math.max(0, qty - 1))}
                        className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 disabled:opacity-30"
                        disabled={qty <= 0}
                      >
                        −
                      </button>
                      <span className="font-mono w-6 text-center font-semibold">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAddonQtyChange(addon.id, qty + 1)}
                        className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-50 text-slate-700"
                      >
                        +
                      </button>
                    </div>
                    <div className="font-mono text-sm font-semibold text-brand-navy w-20 text-right">
                      {qty > 0 ? `+${formatCurrency(lineTotal)}` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
            {addonsTotal > 0 && (
              <div className="text-right text-xs text-slate-600 mt-2 pt-2 border-t border-slate-300">
                Add-ons subtotal: <strong className="text-brand-navy">{formatCurrency(addonsTotal)}</strong>
              </div>
            )}
          </div>
        )}

        {/* Damage protection opt-in */}
        {damageProtection?.enabled && (
          <div
            className={`rounded p-3 border-2 cursor-pointer transition ${
              wantsProtection
                ? "bg-green-50 border-green-400"
                : "bg-slate-50 border-slate-200 hover:border-slate-400"
            }`}
            onClick={() => onProtectionChange(!wantsProtection)}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={wantsProtection}
                onChange={(e) => onProtectionChange(e.target.checked)}
                className="h-5 w-5 mt-0.5 rounded border-slate-300 text-green-600 focus:ring-green-600"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm text-brand-navy">
                    🛡 Damage protection (recommended)
                  </strong>
                  <span className="font-mono font-bold text-brand-navy">
                    +${(damageProtection.priceCents / 100).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  One-time fee. Covers accidental damage up to{" "}
                  <strong>${(damageProtection.coverageCents / 100).toFixed(0)}</strong> —
                  no out-of-pocket charges if something happens during normal use.
                  Without this, you may be responsible for damage repair costs.
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Cost breakdown when power supply selected */}
        {customer.powerSource === "no" && powerSupply && (
          <div className="bg-amber-50 rounded p-3 border border-amber-200 text-sm">
            <div className="flex justify-between text-slate-700">
              <span>{product.name} × {numDays} day{numDays > 1 ? "s" : ""}</span>
              <span className="font-mono">{formatCurrency(productTotal)}</span>
            </div>
            <div className="flex justify-between text-amber-700 mt-1">
              <span>+ Power Supply × {numDays} day{numDays > 1 ? "s" : ""}</span>
              <span className="font-mono">+{formatCurrency(powerSupplyCost)}</span>
            </div>
            <div className="flex justify-between font-bold text-brand-navy border-t border-amber-300 pt-2 mt-2">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
          <textarea
            rows={2}
            value={customer.notes}
            onChange={(e) => onChange({ ...customer, notes: e.target.value })}
            placeholder="Setup location, gate code, special requests..."
            className="input"
          />
        </div>

        {/* Coupon code */}
        <div className="bg-slate-50 rounded p-3 border border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            🎟 Discount code <span className="text-xs text-slate-400">(optional)</span>
          </label>
          <input
            value={couponCode}
            onChange={(e) => onCouponChange(e.target.value.toUpperCase())}
            placeholder="WELCOME10"
            className="input font-mono"
            disabled={pending}
          />
          <p className="text-xs text-slate-500 mt-1">
            We'll validate it on the next step. Invalid/expired codes are ignored.
          </p>
        </div>

        {/* Gift card code */}
        <div className="bg-purple-50 rounded p-3 border border-purple-200">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            🎁 Gift card code <span className="text-xs text-slate-400">(optional)</span>
          </label>
          <input
            value={giftCardCode}
            onChange={(e) => onGiftCardChange(e.target.value.toUpperCase())}
            placeholder="GIFT-XXXX-XXXX"
            className="input font-mono"
            disabled={pending}
          />
          <p className="text-xs text-slate-500 mt-1">
            Balance applies up to the total. Remaining balance stays on the card for future bookings.
          </p>
        </div>

        {/* Loyalty points redemption — only if logged in + has min */}
        {loyaltySettings && availablePoints >= loyaltySettings.min_redeem_points && (
          <div className="bg-brand-yellow/10 rounded p-3 border border-brand-yellow">
            <label className="block text-sm font-medium text-brand-navy mb-1">
              ✨ Redeem loyalty points{" "}
              <span className="text-xs text-slate-600">
                (you have {availablePoints.toLocaleString()})
              </span>
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={0}
                max={availablePoints}
                step={loyaltySettings.points_redemption_rate}
                value={redeemPoints || ""}
                onChange={(e) =>
                  onRedeemPointsChange(
                    Math.min(availablePoints, Math.max(0, parseInt(e.target.value) || 0)),
                  )
                }
                placeholder={`Min ${loyaltySettings.min_redeem_points}`}
                className="input flex-1"
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => onRedeemPointsChange(availablePoints)}
                className="text-xs bg-brand-navy text-white rounded px-3 py-2 hover:bg-brand-navy-dark"
                disabled={pending}
              >
                Use all
              </button>
            </div>
            {redeemPoints >= loyaltySettings.min_redeem_points && (
              <p className="text-xs text-brand-navy font-semibold mt-1">
                ≈ ${(redeemPoints / loyaltySettings.points_redemption_rate).toFixed(2)} discount
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {loyaltySettings.points_redemption_rate} points = $1 off
            </p>
          </div>
        )}
      </div>

      {/* COI request (optional — venue insurance requirement) */}
      {coiEnabled && (
        <CoiBlock
          requested={coiRequested}
          onRequestedChange={onCoiRequestedChange}
          venueName={coiVenueName}
          onVenueNameChange={onCoiVenueNameChange}
          venueAddress={coiVenueAddress}
          onVenueAddressChange={onCoiVenueAddressChange}
          additionalInsured={coiAdditionalInsured}
          onAdditionalInsuredChange={onCoiAdditionalInsuredChange}
          instructions={coiInstructions}
          onInstructionsChange={onCoiInstructionsChange}
        />
      )}

      {/* Liability waiver e-signature */}
      {waiverEnabled && waiverText && (
        <WaiverBlock
          title={waiverTitle}
          text={waiverText}
          agreed={waiverAgreed}
          onAgreedChange={onWaiverAgreedChange}
          signedName={waiverSignedName}
          onSignedNameChange={onWaiverSignedNameChange}
          defaultName={`${customer.firstName} ${customer.lastName}`.trim()}
        />
      )}

      {/* Diagnostic: when the button is disabled, list what's missing so
          the customer doesn't have to guess. */}
      {!valid && !pending && (() => {
        const missing: string[] = [];
        if (!customer.firstName.trim()) missing.push("First name");
        if (!customer.lastName.trim()) missing.push("Last name");
        if (!customer.email.trim()) missing.push("Email");
        if (!customer.phone.trim()) missing.push("Phone");
        if (!customer.address.trim()) missing.push("Address");
        if (!customer.city.trim()) missing.push("City");
        if (!customer.zip.trim()) missing.push("Zip");
        if (!customer.surfaceType) missing.push("Surface type");
        if (powerSupply && !customer.powerSource) missing.push("Power source answer");
        if (waiverEnabled && (!waiverAgreed || waiverSignedName.trim().length < 2)) {
          missing.push("Sign the liability waiver");
        }
        if (coiRequested && !coiVenueName.trim()) missing.push("Venue name (for COI request)");
        if (missing.length === 0) return null;
        return (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
            <strong>To continue, complete:</strong>{" "}
            {missing.map((m, i) => (
              <span key={i}>
                <span className="bg-white border border-amber-300 rounded px-1.5 py-0.5 mx-0.5">
                  {m}
                </span>
              </span>
            ))}
          </div>
        );
      })()}

      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="px-4 py-2 text-slate-600 hover:text-slate-900" disabled={pending}>
          ← Back
        </button>
        <button onClick={onSubmit} disabled={!valid || pending} className="btn-primary disabled:opacity-50">
          {pending ? "Processing..." : "Continue to payment →"}
        </button>
      </div>
    </div>
  );
}

function CoiBlock({
  requested,
  onRequestedChange,
  venueName,
  onVenueNameChange,
  venueAddress,
  onVenueAddressChange,
  additionalInsured,
  onAdditionalInsuredChange,
  instructions,
  onInstructionsChange,
}: {
  requested: boolean;
  onRequestedChange: (b: boolean) => void;
  venueName: string;
  onVenueNameChange: (s: string) => void;
  venueAddress: string;
  onVenueAddressChange: (s: string) => void;
  additionalInsured: string;
  onAdditionalInsuredChange: (s: string) => void;
  instructions: string;
  onInstructionsChange: (s: string) => void;
}) {
  return (
    <div className="mt-6 border border-blue-200 bg-blue-50/30 rounded-lg p-4">
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={requested}
          onChange={(e) => onRequestedChange(e.target.checked)}
          className="h-4 w-4 mt-0.5 flex-shrink-0"
        />
        <span>
          <strong className="text-brand-navy">My venue requires a Certificate of Insurance (COI)</strong>
          <p className="text-xs text-slate-600 mt-0.5">
            Many schools, parks, churches, and HOAs require proof we have
            liability insurance with them listed as additional insured. Check
            with your venue if unsure.
          </p>
        </span>
      </label>

      {requested && (
        <div className="mt-4 space-y-3 pl-6 border-l-2 border-blue-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Venue name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => onVenueNameChange(e.target.value)}
              placeholder="e.g. Mandarin Community Center"
              required
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Venue address
            </label>
            <input
              type="text"
              value={venueAddress}
              onChange={(e) => onVenueAddressChange(e.target.value)}
              placeholder="3848 Hartley Rd, Jacksonville, FL 32257"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Who to list as "additional insured"
            </label>
            <input
              type="text"
              value={additionalInsured}
              onChange={(e) => onAdditionalInsuredChange(e.target.value)}
              placeholder="Exact legal name from venue contract (often differs from common name)"
              className="input"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              If unsure, leave blank — we'll use the venue name. Your venue
              should give you the exact wording.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Special instructions (optional)
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              placeholder="e.g. Email to facilities@school.edu by Friday, need $2M aggregate, etc."
              className="input"
            />
          </div>
          <p className="text-xs text-blue-900 bg-blue-100/50 rounded p-2">
            ℹ️ We'll request the COI from our insurance broker after you book
            and email it to you within 1–2 business days. You can also see the
            status + download it from <strong>My Account → bookings</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

function WaiverBlock({
  title,
  text,
  agreed,
  onAgreedChange,
  signedName,
  onSignedNameChange,
  defaultName,
}: {
  title: string;
  text: string;
  agreed: boolean;
  onAgreedChange: (b: boolean) => void;
  signedName: string;
  onSignedNameChange: (s: string) => void;
  defaultName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-6 border-2 border-amber-300 bg-amber-50/50 rounded-lg p-4">
      <h3 className="font-bold text-brand-navy mb-2 flex items-center gap-2">
        <span className="text-amber-600">⚠</span> {title}{" "}
        <span className="text-xs font-normal text-red-600">* required</span>
      </h3>
      <div
        className={`text-xs text-slate-700 bg-white border border-slate-200 rounded p-3 overflow-y-auto whitespace-pre-line font-sans ${
          expanded ? "max-h-[500px]" : "max-h-40"
        }`}
      >
        {text}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-brand-navy hover:underline mt-1"
      >
        {expanded ? "Collapse ↑" : "Read full waiver ↓"}
      </button>

      <div className="mt-3 space-y-2">
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onAgreedChange(e.target.checked)}
            className="h-4 w-4 mt-0.5 flex-shrink-0"
          />
          <span>
            <strong>I have read and agree</strong> to the Rental Agreement &
            Liability Waiver above. I am at least 18 years old and have legal
            authority to sign on behalf of all participants at my event.
          </span>
        </label>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Type your full legal name as your signature{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={signedName}
            onChange={(e) => onSignedNameChange(e.target.value)}
            placeholder={defaultName || "First Last"}
            className="input font-serif italic"
            disabled={!agreed}
          />
          {!signedName && defaultName && agreed && (
            <button
              type="button"
              onClick={() => onSignedNameChange(defaultName)}
              className="text-xs text-brand-navy hover:underline mt-1"
            >
              Use "{defaultName}"
            </button>
          )}
          <p className="text-[10px] text-slate-500 mt-1">
            By typing your name and clicking "Continue to payment", you sign this
            agreement electronically. We record your name, IP address, timestamp,
            and the exact text shown above.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfirmationScreen({
  productName,
  eventDate,
  startTime,
  endTime,
  amount,
  customerEmail,
  onReset,
}: {
  productName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  amount: number;
  customerEmail: string;
  onReset: () => void;
}) {
  return (
    <div className="card text-center py-12 max-w-2xl mx-auto">
      <div className="inline-flex w-16 h-16 bg-emerald-100 rounded-full items-center justify-center mb-4">
        <Check className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-brand-navy mb-2">
        Booking Confirmed! 🎉
      </h2>
      <p className="text-slate-600 mb-4">
        Your rental is locked in. We sent a confirmation to <strong>{customerEmail}</strong>.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 max-w-md mx-auto text-left">
        <div className="flex items-start gap-2">
          <span className="text-lg flex-shrink-0">📬</span>
          <p className="text-xs text-amber-900">
            <strong>Don't see the email in a minute?</strong> Check your{" "}
            <strong>spam / junk folder</strong> — it may land there the first time.
            Mark it "not spam" so future emails (reminders, receipts) land in
            your main inbox.
          </p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-6 text-left max-w-sm mx-auto mb-6">
        <h3 className="font-bold text-brand-navy mb-3">Your booking</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Rental</dt>
            <dd className="font-semibold">{productName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Date</dt>
            <dd className="font-semibold">{format(new Date(eventDate), "EEE, MMM d, yyyy")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Time</dt>
            <dd className="font-semibold">{startTime} – {endTime}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
            <dt className="text-slate-500">Total paid</dt>
            <dd className="font-bold text-brand-navy">{formatCurrency(amount)}</dd>
          </div>
        </dl>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Questions? Reply to your confirmation email or call us at (904) 584-3047.
      </p>

      <button onClick={onReset} className="btn-accent">
        Browse more rentals →
      </button>
    </div>
  );
}
