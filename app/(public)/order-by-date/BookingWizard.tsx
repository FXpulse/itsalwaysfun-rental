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

export function BookingWizard({
  products,
  categories,
  stripeConfigured,
  stripePublishableKey,
  prefillCustomer,
}: {
  products: Product[];
  categories: Category[];
  stripeConfigured: boolean;
  stripePublishableKey: string;
  prefillCustomer?: PrefillCustomer | null;
}) {
  const { item: cartItem, clear } = useCart();

  // Wizard state
  const [step, setStep] = useState<Step>(cartItem?.productSlug ? "date" : "date");
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
  });
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [couponCode, setCouponCode] = useState("");
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

  const currentStepIdx = STEPS.findIndex((s) => s.id === step);

  function goToStep(s: Step) {
    setStep(s);
  }

  // Multi-day formula: base + 30% × (days-1) × base
  const totalAmount = useMemo(() => {
    if (!selectedProduct || numDays < 1) return 0;
    if (numDays === 1) return selectedProduct.price_per_day;
    const surcharge = selectedProduct.price_per_day * 0.30 * (numDays - 1);
    return Math.round(selectedProduct.price_per_day + surcharge);
  }, [selectedProduct, numDays]);

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
            notes: customer.notes || null,
            coupon_code: couponCode.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to start booking");
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
        setStep("payment");
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
      {/* Step indicator */}
      <div className="flex justify-between mb-8">
        {STEPS.map((s, idx) => {
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
            onNext={() => goToStep("category")}
            unavailableDates={selectedProductSlug ? unavailableDates : new Set()}
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
            totalAmount={totalAmount}
            couponCode={couponCode}
            onCouponChange={setCouponCode}
            onBack={() => goToStep("product")}
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
}: {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
  product: Product | undefined;
  numDays: number;
  totalAmount: number;
  onNext: () => void;
  unavailableDates: Set<string>;
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
      <p className="text-sm text-slate-500 mb-6">
        Click a date to set the <strong>start</strong>. Click another to set the
        <strong> end</strong> (multi-day). Click again to reset.
      </p>

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

              const disabled = !inMonth || isPast || isUnavail;
              const isInRange = rangeSet.has(iso) && !isStart && !isEnd;

              return (
                <button
                  key={iso}
                  onClick={() => !disabled && handleDayClick(iso)}
                  disabled={disabled}
                  className={`aspect-square rounded text-sm font-medium transition relative
                    ${!inMonth ? "text-slate-300" : ""}
                    ${isPast ? "text-slate-300 cursor-not-allowed" : ""}
                    ${isUnavail && inMonth && !isPast ? "bg-red-50 text-red-300 cursor-not-allowed line-through" : ""}
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
  totalAmount,
  couponCode,
  onCouponChange,
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
  totalAmount: number;
  couponCode: string;
  onCouponChange: (s: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const valid =
    customer.firstName.trim() &&
    customer.lastName.trim() &&
    customer.email.trim() &&
    customer.phone.trim() &&
    customer.address.trim() &&
    customer.city.trim() &&
    customer.zip.trim() &&
    customer.surfaceType;

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
      </div>

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
      <p className="text-slate-600 mb-6">
        Your rental is locked in. We sent a confirmation to <strong>{customerEmail}</strong>.
      </p>

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
