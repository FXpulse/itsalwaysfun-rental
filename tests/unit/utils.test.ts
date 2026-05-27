import { describe, it, expect } from "vitest";
import { formatCurrency, cn } from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats cents as USD with 2 decimals", () => {
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(100)).toBe("$1.00");
    expect(formatCurrency(2999)).toBe("$29.99");
    expect(formatCurrency(123456)).toBe("$1,234.56");
  });

  it("handles negative amounts (refunds)", () => {
    expect(formatCurrency(-2500)).toBe("-$25.00");
  });

  it("never uses thousands separator collisions on big numbers", () => {
    expect(formatCurrency(100000000)).toBe("$1,000,000.00");
  });
});

describe("cn (tailwind class merger)", () => {
  it("joins multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("deduplicates conflicting tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false && "skipped", "bar")).toBe("foo bar");
    expect(cn(null, undefined, "valid")).toBe("valid");
  });
});
