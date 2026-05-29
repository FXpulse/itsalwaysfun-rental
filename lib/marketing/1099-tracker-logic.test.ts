import { describe, it, expect } from "vitest";
import {
  computeSummary,
  generateCsv,
  THRESHOLD_CENTS,
  type Driver,
  type Payment,
} from "./1099-tracker-logic";

const drivers: Driver[] = [
  { id: "d1", name: "Mike Johnson" },
  { id: "d2", name: "Sarah Lopez" },
  { id: "d3", name: "Carlos R." },
];

const payments: Payment[] = [
  { id: "p1", driverId: "d1", date: "2026-03-15", amountCents: 60000 },
  { id: "p2", driverId: "d1", date: "2026-04-01", amountCents: 64000 },
  { id: "p3", driverId: "d2", date: "2026-05-10", amountCents: 48000 },
  { id: "p4", driverId: "d3", date: "2026-06-20", amountCents: 72000 },
  // Different year — must not affect 2026 summary
  { id: "p5", driverId: "d1", date: "2025-12-30", amountCents: 50000 },
];

describe("computeSummary", () => {
  it("returns per-driver totals + threshold flag for selected year", () => {
    const s = computeSummary({ drivers, payments, taxYear: 2026 });
    expect(s.rows).toHaveLength(3);
    expect(s.rows.find((r) => r.driverId === "d1")).toMatchObject({
      name: "Mike Johnson",
      totalCents: 124000,
      paymentCount: 2,
      overThreshold: true,
    });
    expect(s.rows.find((r) => r.driverId === "d2")).toMatchObject({
      totalCents: 48000,
      overThreshold: false,
    });
    expect(s.rows.find((r) => r.driverId === "d3")).toMatchObject({
      overThreshold: true,
    });
  });

  it("ignores payments from other tax years", () => {
    const s = computeSummary({ drivers, payments, taxYear: 2025 });
    const d1 = s.rows.find((r) => r.driverId === "d1");
    expect(d1?.totalCents).toBe(50000);
    expect(d1?.overThreshold).toBe(false);
  });

  it("returns aggregate stats", () => {
    const s = computeSummary({ drivers, payments, taxYear: 2026 });
    expect(s.driverCount).toBe(3);
    expect(s.driversOverThreshold).toBe(2);
    expect(s.totalPaidCents).toBe(244000);
  });

  it("handles drivers with no payments", () => {
    const s = computeSummary({
      drivers: [{ id: "x", name: "Empty" }],
      payments: [],
      taxYear: 2026,
    });
    expect(s.rows[0]).toMatchObject({ totalCents: 0, overThreshold: false });
  });

  it("exposes the IRS $600 threshold", () => {
    expect(THRESHOLD_CENTS).toBe(60000);
  });
});

describe("generateCsv", () => {
  it("emits a header row + one row per driver, sorted by totalCents desc", () => {
    const s = computeSummary({ drivers, payments, taxYear: 2026 });
    const csv = generateCsv(s, 2026);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "Driver,Total paid,Payment count,Status,Tax year",
    );
    expect(lines[1]).toContain("Mike Johnson");
    expect(lines[1]).toContain("$1240.00");
    expect(lines[1]).toContain("1099 required");
    expect(lines[1]).toContain("2026");
    // Sarah ($480) is under threshold — comes last
    expect(lines[3]).toContain("Sarah Lopez");
    expect(lines[3]).toContain("Under threshold");
  });

  it("escapes commas + quotes in driver names", () => {
    const s = computeSummary({
      drivers: [{ id: "d", name: 'Smith, "Big Joe"' }],
      payments: [{ id: "p", driverId: "d", date: "2026-01-01", amountCents: 100000 }],
      taxYear: 2026,
    });
    const csv = generateCsv(s, 2026);
    expect(csv).toContain('"Smith, ""Big Joe"""');
  });
});
