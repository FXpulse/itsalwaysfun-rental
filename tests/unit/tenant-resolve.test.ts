import { describe, it, expect } from "vitest";
import { isMarketingHost, extractSubdomainSlug } from "@/lib/tenant/resolve";

describe("isMarketingHost", () => {
  it("recognizes apex SaaS domain", () => {
    expect(isMarketingHost("getrentalflow.com")).toBe(true);
    expect(isMarketingHost("www.getrentalflow.com")).toBe(true);
  });

  it("strips port before matching", () => {
    expect(isMarketingHost("getrentalflow.com:443")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isMarketingHost("GetRentalFlow.com")).toBe(true);
  });

  it("rejects tenant subdomains", () => {
    expect(isMarketingHost("bouncedreams.getrentalflow.com")).toBe(false);
  });

  it("rejects custom domains", () => {
    expect(isMarketingHost("itsalwaysfun.net")).toBe(false);
  });

  it("rejects unrelated hostnames", () => {
    expect(isMarketingHost("localhost")).toBe(false);
    expect(isMarketingHost("example.com")).toBe(false);
  });
});

describe("extractSubdomainSlug", () => {
  it("extracts slug from valid SaaS subdomain", () => {
    expect(extractSubdomainSlug("bouncedreams.getrentalflow.com")).toBe("bouncedreams");
    expect(extractSubdomainSlug("partyzone.getrentalflow.com")).toBe("partyzone");
  });

  it("strips port before extraction", () => {
    expect(extractSubdomainSlug("bouncedreams.getrentalflow.com:443")).toBe("bouncedreams");
  });

  it("is case insensitive on host", () => {
    expect(extractSubdomainSlug("BounceDreams.GetRentalFlow.com")).toBe("bouncedreams");
  });

  it("returns null for apex SaaS domain", () => {
    expect(extractSubdomainSlug("getrentalflow.com")).toBeNull();
  });

  it("returns null for www subdomain (treated as apex)", () => {
    expect(extractSubdomainSlug("www.getrentalflow.com")).toBeNull();
  });

  it("returns null for unrelated hostnames", () => {
    expect(extractSubdomainSlug("itsalwaysfun.net")).toBeNull();
    expect(extractSubdomainSlug("localhost")).toBeNull();
    expect(extractSubdomainSlug("example.com")).toBeNull();
  });

  it("handles multi-level subdomains correctly", () => {
    // For now we only support one level (slug.getrentalflow.com)
    // foo.bar.getrentalflow.com → would return "foo.bar" which is invalid as
    // a slug. Not adding multi-level support in v1.
    expect(extractSubdomainSlug("foo.bar.getrentalflow.com")).toBe("foo.bar");
  });
});
