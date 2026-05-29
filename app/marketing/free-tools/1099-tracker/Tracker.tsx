"use client";

import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  computeSummary,
  generateCsv,
  type Driver,
  type Payment,
  type Summary,
} from "@/lib/marketing/1099-tracker-logic";
import { DriverTable } from "./DriverTable";
import { PaymentForm } from "./PaymentForm";
import { PaymentList } from "./PaymentList";
import { SummaryCard } from "./SummaryCard";
import { SoftGateModal } from "./SoftGateModal";

const LS_KEY = "rf_1099_tracker_v1";
const SCHEMA_VERSION = 1;

interface TrackerState {
  schemaVersion: 1;
  taxYear: number;
  drivers: Driver[];
  payments: Payment[];
}

function defaultState(): TrackerState {
  return {
    schemaVersion: SCHEMA_VERSION,
    taxYear: new Date().getFullYear(),
    drivers: [],
    payments: [],
  };
}

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function Tracker({ ref_ }: { ref_: string | null }) {
  const [state, setState] = useState<TrackerState | null>(null);
  const [softGateOpen, setSoftGateOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) {
        setState(defaultState());
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.schemaVersion === SCHEMA_VERSION && Array.isArray(parsed.drivers)) {
        setState(parsed);
        return;
      }
      // Backup unknown shape, start fresh
      localStorage.setItem(LS_KEY + "_backup", raw);
      setState(defaultState());
    } catch {
      setState(defaultState());
    }
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (!state) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
      } catch {
        // localStorage full / disabled — swallow
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state]);

  if (!state) {
    return <div className="card text-center text-slate-400">Loading…</div>;
  }

  const summary: Summary = computeSummary({
    drivers: state.drivers,
    payments: state.payments,
    taxYear: state.taxYear,
  });

  function addDriver(name: string) {
    setState((s) => (s ? { ...s, drivers: [...s.drivers, { id: uid(), name }] } : s));
  }

  function removeDriver(id: string) {
    setState((s) =>
      s
        ? {
            ...s,
            drivers: s.drivers.filter((d) => d.id !== id),
            payments: s.payments.filter((p) => p.driverId !== id),
          }
        : s,
    );
  }

  function addPayment(p: Omit<Payment, "id">) {
    setState((s) =>
      s ? { ...s, payments: [...s.payments, { ...p, id: uid() }] } : s,
    );
  }

  function removePayment(id: string) {
    setState((s) =>
      s ? { ...s, payments: s.payments.filter((p) => p.id !== id) } : s,
    );
  }

  function setTaxYear(y: number) {
    setState((s) => (s ? { ...s, taxYear: y } : s));
  }

  function downloadCsv() {
    const csv = generateCsv(summary, state!.taxYear);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `1099-tracker-${state!.taxYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded CSV");
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />

      <DriverTable
        drivers={state.drivers}
        summary={summary}
        onAdd={addDriver}
        onRemove={removeDriver}
      />

      <PaymentForm drivers={state.drivers} onAdd={addPayment} />
      <PaymentList
        payments={state.payments}
        drivers={state.drivers}
        onRemove={removePayment}
      />

      <SummaryCard
        summary={summary}
        taxYear={state.taxYear}
        onTaxYearChange={setTaxYear}
        onDownload={downloadCsv}
        onEmailMe={() => setSoftGateOpen(true)}
      />

      <SoftGateModal
        open={softGateOpen}
        onClose={() => setSoftGateOpen(false)}
        summary={summary}
        ref_={ref_}
      />
    </div>
  );
}
