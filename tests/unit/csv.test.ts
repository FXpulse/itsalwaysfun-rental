import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple headers + rows", () => {
    const r = parseCsv("name,price\nBouncer,299\nSlide,499");
    expect(r.errors).toEqual([]);
    expect(r.headers).toEqual(["name", "price"]);
    expect(r.rows).toEqual([
      { name: "Bouncer", price: "299" },
      { name: "Slide", price: "499" },
    ]);
  });

  it("trims whitespace in headers + values", () => {
    const r = parseCsv("  name  , price \n Bouncer , 299 ");
    expect(r.headers).toEqual(["name", "price"]);
    expect(r.rows[0]).toEqual({ name: "Bouncer", price: "299" });
  });

  it("handles quoted values with commas inside", () => {
    const r = parseCsv('name,address\n"Smith, John","123 Main St, Apt 4"');
    expect(r.rows[0]).toEqual({
      name: "Smith, John",
      address: "123 Main St, Apt 4",
    });
  });

  it("handles escaped quotes (double quote inside quoted value)", () => {
    const r = parseCsv('name,note\nBouncer,"He said ""hi"" to me"');
    expect(r.rows[0].note).toBe('He said "hi" to me');
  });

  it("handles newlines inside quoted values", () => {
    const r = parseCsv('name,desc\nBouncer,"Line 1\nLine 2"');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].desc).toBe("Line 1\nLine 2");
  });

  it("skips totally blank lines", () => {
    const r = parseCsv("name\nA\n\nB\n");
    expect(r.rows).toEqual([{ name: "A" }, { name: "B" }]);
  });

  it("strips UTF-8 BOM if present", () => {
    const bomText = "﻿name\nA";
    const r = parseCsv(bomText);
    expect(r.headers).toEqual(["name"]);
    expect(r.rows[0].name).toBe("A");
  });

  it("returns error on empty input", () => {
    const r = parseCsv("");
    expect(r.errors).toContain("Empty CSV");
  });

  it("returns error on whitespace-only input", () => {
    const r = parseCsv("   \n   ");
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("missing values get empty string (preserves shape)", () => {
    const r = parseCsv("a,b,c\n1,2");
    expect(r.rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });
});
