// Visual "where is my rental right now?" timeline for customers.
// Like Domino's pizza tracker but for inflatables.

import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Sparkles,
  CalendarCheck,
  XCircle,
  CloudRain,
  type LucideIcon,
} from "lucide-react";

export interface TrackingStop {
  status: "pending" | "loaded" | "out_for_delivery" | "delivered" | "completed" | null;
  type: "delivery" | "pickup";
  driver_name?: string | null;
  vehicle_name?: string | null;
}

export interface TrackingProps {
  bookingStatus: string;          // pending_payment | confirmed | delivered | completed | cancelled
  paymentStatus: string;          // paid | pending | refunded | failed
  eventDate: string;              // YYYY-MM-DD
  eventEndDate: string | null;
  cancelledDueToWeather?: boolean;
  deliveryStop?: TrackingStop | null;
  pickupStop?: TrackingStop | null;
}

interface Step {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  state: "done" | "active" | "pending" | "skipped";
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T09:00:00").getTime();
  const diff = target - Date.now();
  return Math.ceil(diff / 86400000);
}

function buildSteps(p: TrackingProps): Step[] {
  const isPaid = p.paymentStatus === "paid";
  const isRefunded = p.paymentStatus === "refunded";
  const isCancelled = p.bookingStatus === "cancelled";
  const isWeatherCancel = !!p.cancelledDueToWeather;

  const eventDay = daysUntil(p.eventDate);
  const eventPassed = eventDay < 0;

  // Cancellation short-circuit
  if (isCancelled) {
    return [
      {
        id: "cancelled",
        label: isWeatherCancel ? "Cancelled due to weather" : "Cancelled",
        description: isWeatherCancel
          ? "We issued a gift card credit for the full amount paid, valid 1 year."
          : isRefunded
            ? "Refund processed — should appear on your card within 5-10 business days."
            : "Your booking is cancelled.",
        icon: isWeatherCancel ? CloudRain : XCircle,
        state: "active",
      },
    ];
  }

  // Step 1: payment confirmed
  const paymentStep: Step = {
    id: "paid",
    label: "Payment confirmed",
    description: isPaid
      ? "Your rental is secured."
      : "Awaiting payment — call us if you paid offline.",
    icon: CheckCircle2,
    state: isPaid ? "done" : "active",
  };

  // Step 2: waiting for event
  const waitingStep: Step = {
    id: "waiting",
    label: eventPassed ? "Event day" : `${eventDay} day${eventDay === 1 ? "" : "s"} until your event`,
    description:
      eventDay > 7
        ? "We'll send a reminder 3 days before your event."
        : eventDay > 1
          ? "We're prepping your gear. Driver assignment usually happens the day before."
          : eventDay === 1
            ? "Your event is tomorrow! Driver route is being finalized."
            : eventDay === 0
              ? "Today's the day. Watch your phone for the driver's call."
              : "Event has passed.",
    icon: Clock,
    state: isPaid ? (eventPassed ? "done" : "active") : "pending",
  };

  // Step 3: prepped (loaded on truck) — based on delivery stop status
  const loaded =
    p.deliveryStop?.status === "loaded" ||
    p.deliveryStop?.status === "out_for_delivery" ||
    p.deliveryStop?.status === "delivered" ||
    p.deliveryStop?.status === "completed";

  const preppedStep: Step = {
    id: "prepped",
    label: "Loaded on the truck",
    description: loaded
      ? `${p.deliveryStop?.vehicle_name ? `Loaded on ${p.deliveryStop.vehicle_name}` : "Equipment ready"}${p.deliveryStop?.driver_name ? ` — ${p.deliveryStop.driver_name} is your driver` : ""}.`
      : "Equipment gets loaded the morning of your event.",
    icon: Package,
    state: loaded ? "done" : eventDay <= 1 && isPaid ? "active" : "pending",
  };

  // Step 4: out for delivery
  const outForDelivery =
    p.deliveryStop?.status === "out_for_delivery" ||
    p.deliveryStop?.status === "delivered" ||
    p.deliveryStop?.status === "completed";

  const otwStep: Step = {
    id: "otw",
    label: "Driver on the way",
    description: outForDelivery
      ? p.deliveryStop?.status === "out_for_delivery"
        ? "Driver is heading to you now. They'll call ~30 min out."
        : "Driver arrived."
      : "We'll text you when the driver leaves the warehouse.",
    icon: Truck,
    state:
      p.deliveryStop?.status === "out_for_delivery"
        ? "active"
        : outForDelivery
          ? "done"
          : "pending",
  };

  // Step 5: delivered & set up
  const delivered =
    p.deliveryStop?.status === "delivered" ||
    p.deliveryStop?.status === "completed";

  const deliveredStep: Step = {
    id: "delivered",
    label: "Delivered & set up",
    description: delivered
      ? "Have fun! Remember the safety rules from your waiver."
      : "Driver sets up on arrival and walks you through the safety briefing.",
    icon: Sparkles,
    state: delivered ? "done" : "pending",
  };

  // Step 6: pickup complete
  const pickedUp =
    p.pickupStop?.status === "completed" || p.bookingStatus === "completed";

  const pickupStep: Step = {
    id: "pickup",
    label: "Picked up",
    description: pickedUp
      ? "Equipment returned safely. Thanks for choosing us!"
      : p.eventEndDate
        ? `Pickup scheduled for end of day ${new Date((p.eventEndDate || p.eventDate) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
        : "We'll come pick up the same evening or next morning.",
    icon: CalendarCheck,
    state: pickedUp ? "done" : "pending",
  };

  return [paymentStep, waitingStep, preppedStep, otwStep, deliveredStep, pickupStep];
}

export function TrackingTimeline(props: TrackingProps) {
  const steps = buildSteps(props);

  return (
    <div className="card border-l-4 border-l-brand-yellow">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-4 flex items-center gap-2">
        <Sparkles className="h-3 w-3" /> Your rental status
      </h2>
      <ol className="relative border-l-2 border-slate-200 ml-4 space-y-5">
        {steps.map((s) => {
          const Icon = s.icon;
          const isDone = s.state === "done";
          const isActive = s.state === "active";
          const isPending = s.state === "pending";
          return (
            <li key={s.id} className="ml-6 relative">
              <span
                className={`absolute -left-[34px] flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-white ${
                  isDone
                    ? "bg-green-500 text-white"
                    : isActive
                      ? "bg-brand-yellow text-brand-navy animate-pulse"
                      : "bg-slate-200 text-slate-400"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <h3
                className={`font-semibold text-sm ${
                  isDone ? "text-slate-600 line-through" : isActive ? "text-brand-navy" : "text-slate-400"
                }`}
              >
                {s.label}
                {isActive && (
                  <span className="ml-2 text-[10px] bg-brand-yellow text-brand-navy rounded px-1.5 py-0.5 align-middle">
                    NOW
                  </span>
                )}
              </h3>
              <p
                className={`text-xs mt-0.5 ${
                  isPending ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {s.description}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
