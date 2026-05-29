// Pure functions for the free 1099-NEC tracker. No I/O, no React, no
// localStorage — all of that lives in the page-level components and the
// API route. This is the bit that gets unit-tested.

export const THRESHOLD_CENTS = 60000; // IRS $600

export type Driver = { id: string; name: string };
export type Payment = {
  id: string;
  driverId: string;
  date: string;       // ISO YYYY-MM-DD
  amountCents: number;
  note?: string;
};

export interface SummaryRow {
  driverId: string;
  name: string;
  totalCents: number;
  paymentCount: number;
  overThreshold: boolean;
}

export interface Summary {
  taxYear: number;
  rows: SummaryRow[];
  driverCount: number;
  driversOverThreshold: number;
  totalPaidCents: number;
}

export function computeSummary(input: {
  drivers: Driver[];
  payments: Payment[];
  taxYear: number;
}): Summary {
  const inYear = input.payments.filter(
    (p) => new Date(p.date).getUTCFullYear() === input.taxYear,
  );

  const rows: SummaryRow[] = input.drivers.map((d) => {
    const driverPayments = inYear.filter((p) => p.driverId === d.id);
    const totalCents = driverPayments.reduce((s, p) => s + p.amountCents, 0);
    return {
      driverId: d.id,
      name: d.name,
      totalCents,
      paymentCount: driverPayments.length,
      overThreshold: totalCents >= THRESHOLD_CENTS,
    };
  });

  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    taxYear: input.taxYear,
    rows,
    driverCount: rows.length,
    driversOverThreshold: rows.filter((r) => r.overThreshold).length,
    totalPaidCents: rows.reduce((s, r) => s + r.totalCents, 0),
  };
}

export function generateCsv(summary: Summary, taxYear: number): string {
  const header = "Driver,Total paid,Payment count,Status,Tax year";
  const body = summary.rows
    .map((r) =>
      [
        csvField(r.name),
        `$${(r.totalCents / 100).toFixed(2)}`,
        r.paymentCount,
        r.overThreshold ? "1099 required" : "Under threshold",
        taxYear,
      ].join(","),
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

function csvField(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
