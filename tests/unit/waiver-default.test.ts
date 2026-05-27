import { describe, it, expect } from "vitest";
import { DEFAULT_WAIVER_TITLE, DEFAULT_WAIVER_TEXT } from "@/lib/waiver-default";

describe("DEFAULT_WAIVER_TITLE", () => {
  it("is the expected title string", () => {
    expect(DEFAULT_WAIVER_TITLE).toBe("Rental Agreement & Liability Waiver");
  });
});

describe("DEFAULT_WAIVER_TEXT", () => {
  it("starts with the read-carefully banner", () => {
    expect(DEFAULT_WAIVER_TEXT.startsWith("PLEASE READ CAREFULLY BEFORE SIGNING.")).toBe(true);
  });

  it("contains all 8 numbered sections", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(DEFAULT_WAIVER_TEXT).toContain(`${n}. `);
    }
  });

  it("mentions the company name", () => {
    expect(DEFAULT_WAIVER_TEXT).toContain("It's Always Fun, LLC");
  });

  it("uses paragraph breaks (double newlines)", () => {
    expect(DEFAULT_WAIVER_TEXT.split("\n\n").length).toBeGreaterThan(8);
  });

  it("includes the key liability sections by keyword", () => {
    expect(DEFAULT_WAIVER_TEXT).toContain("ASSUMPTION OF RISK");
    expect(DEFAULT_WAIVER_TEXT).toContain("SUPERVISION");
    expect(DEFAULT_WAIVER_TEXT).toContain("INDEMNIFICATION");
    expect(DEFAULT_WAIVER_TEXT).toContain("WEATHER");
    expect(DEFAULT_WAIVER_TEXT).toContain("ACKNOWLEDGMENT");
  });

  it("ends with the binding-agreement disclaimer", () => {
    expect(DEFAULT_WAIVER_TEXT).toMatch(/legally binding agreement/i);
  });

  it("has reasonable length (not truncated, not bloated)", () => {
    // Heuristic: full 8-section waiver should be 2000-6000 chars
    expect(DEFAULT_WAIVER_TEXT.length).toBeGreaterThan(2000);
    expect(DEFAULT_WAIVER_TEXT.length).toBeLessThan(6000);
  });
});
