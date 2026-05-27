import { describe, it, expect } from "vitest";
import {
  ProductInputSchema,
  BookingInputSchema,
  BlockDateInputSchema,
} from "@/lib/validation";

describe("ProductInputSchema", () => {
  const valid = {
    name: "Princess Bouncer",
    slug: "princess-bouncer",
    category: "bouncer",
    price_per_day: 29900,
    stock: 5,
    is_active: true,
  };

  it("accepts a minimal valid product", () => {
    expect(ProductInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = ProductInputSchema.safeParse({ ...valid, name: "" });
    expect(r.success).toBe(false);
  });

  it("rejects slug with uppercase or spaces", () => {
    expect(ProductInputSchema.safeParse({ ...valid, slug: "Princess Bouncer" }).success).toBe(false);
    expect(ProductInputSchema.safeParse({ ...valid, slug: "PRINCESS" }).success).toBe(false);
  });

  it("accepts slug with lowercase + hyphens + numbers", () => {
    expect(
      ProductInputSchema.safeParse({ ...valid, slug: "princess-bouncer-2" }).success,
    ).toBe(true);
  });

  it("rejects negative price", () => {
    expect(ProductInputSchema.safeParse({ ...valid, price_per_day: -1 }).success).toBe(false);
  });

  it("rejects float prices (must be integer cents)", () => {
    expect(ProductInputSchema.safeParse({ ...valid, price_per_day: 299.99 }).success).toBe(false);
  });

  it("caps price at $10,000.00", () => {
    expect(ProductInputSchema.safeParse({ ...valid, price_per_day: 10_000_01 }).success).toBe(false);
    expect(ProductInputSchema.safeParse({ ...valid, price_per_day: 10_000_00 }).success).toBe(true);
  });

  it("accepts optional fields when present", () => {
    expect(
      ProductInputSchema.safeParse({
        ...valid,
        is_addon: true,
        cost_cents: 15000,
        weekend_price_per_day: 34900,
        setup_area: "15x15",
      }).success,
    ).toBe(true);
  });

  it("rejects bad image URL", () => {
    expect(
      ProductInputSchema.safeParse({ ...valid, image_url: "not a url" }).success,
    ).toBe(false);
  });

  it("accepts empty image URL", () => {
    expect(ProductInputSchema.safeParse({ ...valid, image_url: "" }).success).toBe(true);
  });
});

describe("BookingInputSchema", () => {
  const valid = {
    product_id: "00000000-0000-0000-0000-000000000001",
    event_date: "2026-06-15",
    customer_first_name: "Maria",
    customer_last_name: "Lopez",
    customer_email: "maria@example.com",
  };

  it("accepts a minimal valid booking", () => {
    expect(BookingInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects non-UUID product_id", () => {
    expect(BookingInputSchema.safeParse({ ...valid, product_id: "abc" }).success).toBe(false);
  });

  it("rejects bad date format", () => {
    expect(BookingInputSchema.safeParse({ ...valid, event_date: "6/15/2026" }).success).toBe(false);
    expect(BookingInputSchema.safeParse({ ...valid, event_date: "2026-6-15" }).success).toBe(false);
  });

  it("rejects bad email", () => {
    expect(BookingInputSchema.safeParse({ ...valid, customer_email: "not-an-email" }).success).toBe(false);
  });

  it("accepts optional time fields in HH:MM format", () => {
    expect(
      BookingInputSchema.safeParse({ ...valid, start_time: "09:00", end_time: "17:00" }).success,
    ).toBe(true);
  });

  it("accepts HH:MM:SS as well", () => {
    expect(
      BookingInputSchema.safeParse({ ...valid, start_time: "09:00:00" }).success,
    ).toBe(true);
  });

  it("rejects garbage time format", () => {
    expect(
      BookingInputSchema.safeParse({ ...valid, start_time: "9am" }).success,
    ).toBe(false);
  });
});

describe("BlockDateInputSchema", () => {
  it("accepts valid block", () => {
    const r = BlockDateInputSchema.safeParse({
      product_id: "00000000-0000-0000-0000-000000000001",
      blocked_date: "2026-12-25",
      reason: "Christmas closed",
    });
    expect(r.success).toBe(true);
  });

  it("reason is optional", () => {
    const r = BlockDateInputSchema.safeParse({
      product_id: "00000000-0000-0000-0000-000000000001",
      blocked_date: "2026-12-25",
    });
    expect(r.success).toBe(true);
  });
});
