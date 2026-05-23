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

export function BookingWizard({
  products,
  categories,
  stripeConfigured,
  stripePublishableKey,
}: {
  products: Product[];
  categories: Category[];
  stripeConfigured: boolean;
  stripePublishableKey: string;
}) {
  const { item: cartItem, clear } = useCart();

  // Wizard state
  const [step, setStep] = useState<Step>(cartItem?.productSlug ? "date" : "date");
  const [eventDate, setEventDate] = useState<string | null>(cartItem?.eventDate || null);
  const [numDays, setNumDays] = useState<number>(1);
  const [startTime, setStartTime] = useState("9:00 AM");
  const [endTime, setEndTime] = useState("5:00 PM");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    cartItem?.productSlug
      ? products.find((p) => p.slug === cartItem.productSlug)?.category || null
      : null,
  );
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(
    cartItem?.productSlug || null,
  );
  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "Jacksonville",
    zip: "",
    notes: "",
  });
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(new Set());
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // When category selected → if cart pre-selected a product, skip to customer step
  useEffect(() => {
    if (cartItem?.productSlug && eventDate && selectedProductSlug && step === "date") {
      // came from "Book Now" with a date — jump ahead
      setStep("customer");
    }
  }, [cartItem, eventDate, selectedProductSlug, step]);

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

  // Compute end date from start + numDays
  const eventEndDate = useMemo(() => {
    if (!eventDate || numDays <= 1) return eventDate;
    const d = new Date(eventDate + "T00:00:00");
    d.setDate(d.getDate() + (numDays - 1));
    return d.toISOString().split("T")[0];
  }, [eventDate, numDays]);

  // Multi-day formula: base + 30% × (days-1) × base
  const totalAmount = useMemo(() => {
    if (!selectedProduct || numDays < 1) return 0;
    if (numDays === 1) return selectedProduct.price_per_day;
    const surcharge = selectedProduct.price_per_day * 0.30 * (numDays - 1);
    return Math.round(selectedProduct.price_per_day + surcharge);
  }, [selectedProduct, numDays]);

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
            event_end_date: eventEndDate,
            start_time: convertTime(startTime),
            end_time: convertTime(endTime),
            customer: {
              first_name: customer.firstName,
              last_name: customer.lastName,
              email: customer.email,
              phone: customer.phone,
              address: `${customer.address}, ${customer.city} ${customer.zip}`.trim(),
            },
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
          eventEndDate,
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
            value={eventDate}
            onChange={(d) => setEventDate(d)}
            numDays={numDays}
            onDaysChange={setNumDays}
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
            eventEndDate={eventEndDate}
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
  value,
  onChange,
  numDays,
  onDaysChange,
  onNext,
  unavailableDates,
}: {
  value: string | null;
  onChange: (d: string) => void;
  numDays: number;
  onDaysChange: (n: number) => void;
  onNext: () => void;
  unavailableDates: Set<string>;
}) {
  const [cursor, setCursor] = useState(value ? new Date(value) : new Date());

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

  // Highlight all days in selected range
  const rangeSet = useMemo(() => {
    if (!value || numDays <= 1) return new Set<string>();
    const set = new Set<string>();
    const start = new Date(value + "T00:00:00");
    for (let i = 0; i < numDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      set.add(d.toISOString().split("T")[0]);
    }
    return set;
  }, [value, numDays]);

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-navy mb-1">When is your event?</h2>
      <p className="text-sm text-slate-500 mb-6">
        Pick the start date and how many days you want to rent.
      </p>

      {/* Days selector */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4 flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-slate-700">
            How many days? <span className="text-xs text-slate-400">(rental period)</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDaysChange(Math.max(1, numDays - 1))}
            disabled={numDays <= 1}
            className="w-8 h-8 rounded bg-white border border-slate-300 text-brand-navy font-bold disabled:opacity-30"
          >
            −
          </button>
          <span className="w-12 text-center font-bold text-brand-navy text-lg">
            {numDays}
          </span>
          <button
            type="button"
            onClick={() => onDaysChange(Math.min(14, numDays + 1))}
            disabled={numDays >= 14}
            className="w-8 h-8 rounded bg-white border border-slate-300 text-brand-navy font-bold disabled:opacity-30"
          >
            +
          </button>
          <span className="text-sm text-slate-500 ml-2">
            {numDays === 1 ? "1 day" : `${numDays} days`}
          </span>
        </div>
      </div>

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

      <div className="grid grid-cols-7 gap-1 mb-6">
        {days.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursor);
          const isPast = isBefore(day, today);
          const isToday = isSameDay(day, today);
          const isSelected = value === iso;
          const isUnavail = unavailableDates.has(iso);

          const disabled = !inMonth || isPast || isUnavail;
          const isInRange = rangeSet.has(iso) && !isSelected;

          return (
            <button
              key={iso}
              onClick={() => !disabled && onChange(iso)}
              disabled={disabled}
              className={`aspect-square rounded text-sm font-medium transition
                ${!inMonth ? "text-slate-300" : ""}
                ${isPast ? "text-slate-300 cursor-not-allowed" : ""}
                ${isUnavail && inMonth && !isPast ? "bg-red-50 text-red-300 cursor-not-allowed line-through" : ""}
                ${isSelected ? "bg-brand-navy text-white ring-2 ring-brand-yellow" : ""}
                ${isInRange ? "bg-brand-yellow/40 text-brand-navy font-bold" : ""}
                ${!disabled && !isSelected && !isInRange ? "hover:bg-brand-yellow/30 text-brand-navy" : ""}
                ${isToday && !isSelected ? "ring-2 ring-brand-yellow" : ""}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!value}
          className="btn-primary disabled:opacity-50"
        >
          Continue →
        </button>
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
    customer.zip.trim();

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
