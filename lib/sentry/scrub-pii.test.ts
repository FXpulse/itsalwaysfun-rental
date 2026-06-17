import { describe, it, expect } from "vitest";
import { scrubSentryEvent } from "./scrub-pii";

// Helper: feed a string through the walker via the wrapping function.
// scrubSentryEvent works on the whole event shape, so we wrap our test
// value in a recognizable shape and pull it back.
function scrub(value: any): any {
  const event = { extra: { test: value } };
  const out: any = scrubSentryEvent(event);
  return out?.extra?.test;
}

describe("scrubSentryEvent — regex patterns", () => {
  it("redacts email addresses", () => {
    expect(scrub("contact me at jane@example.com please")).toBe(
      "contact me at [email-redacted] please",
    );
  });

  it("redacts email with + tag", () => {
    expect(scrub("user+test@gmail.com")).toBe("[email-redacted]");
  });

  it("redacts North American phone numbers in 3 formats", () => {
    expect(scrub("Call (904) 584-3047 today")).toBe(
      "Call [phone-redacted] today",
    );
    expect(scrub("904.584.3047")).toBe("[phone-redacted]");
    expect(scrub("+1-904-584-3047")).toBe("[phone-redacted]");
  });

  it("redacts E.164 international phones (non-NA)", () => {
    expect(scrub("from +447911123456 in UK")).toBe(
      "from [phone-redacted] in UK",
    );
    expect(scrub("AR number +5491134567890")).toBe(
      "AR number [phone-redacted]",
    );
  });

  it("redacts credit card numbers", () => {
    expect(scrub("4242 4242 4242 4242")).toBe("[card-redacted]");
    expect(scrub("4242-4242-4242-4242")).toBe("[card-redacted]");
  });

  it("redacts JWT tokens", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(scrub(`token=${jwt}`)).toBe("token=[jwt-redacted]");
  });

  it("redacts Stripe live keys", () => {
    expect(scrub("STRIPE_SECRET=sk_live_abc123def456ghi789jklm")).toBe(
      "STRIPE_SECRET=[stripe-key-redacted]",
    );
    expect(scrub("whsec_1234567890abcdef1234567890")).toBe(
      "[stripe-key-redacted]",
    );
  });

  it("leaves Stripe TEST keys alone (intentional — they are public)", () => {
    expect(scrub("sk_test_publicSampleNotASecret123456")).toBe(
      "sk_test_publicSampleNotASecret123456",
    );
  });

  it("redacts Supabase service role tokens", () => {
    expect(scrub("sbp_1234567890abcdef1234567890")).toBe(
      "[supabase-token-redacted]",
    );
  });

  it("redacts RentalFlow programmatic API keys (rfk_)", () => {
    expect(scrub("rfk_abc123def456ghi789jklm0")).toBe(
      "[rfk-key-redacted]",
    );
  });

  it("redacts GoHighLevel personal integration tokens (pit-)", () => {
    expect(scrub("pit-abc12345-def6-7890-abcd-ef1234567890")).toBe(
      "[ghl-pit-redacted]",
    );
  });

  it("redacts Resend API keys (re_)", () => {
    expect(scrub("re_ABCDEFGhijklmn1234567890")).toBe(
      "[resend-key-redacted]",
    );
  });

  it("redacts Anthropic API keys (sk-ant-)", () => {
    expect(scrub("ANTHROPIC=sk-ant-api03-abc123def456ghi789")).toBe(
      "ANTHROPIC=[anthropic-key-redacted]",
    );
  });

  it("redacts OpenAI API keys (sk-proj- form)", () => {
    expect(scrub("OPENAI=sk-proj-abc123def456ghi789jklmnop")).toBe(
      "OPENAI=[openai-key-redacted]",
    );
  });

  it("redacts Bearer authorization header values", () => {
    expect(scrub("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.foo.bar")).toBe(
      "Authorization: Bearer [redacted]",
    );
  });
});

describe("scrubSentryEvent — field name redaction (REDACT_KEYS)", () => {
  it("redacts customer_email even if regex would miss it", () => {
    const event = {
      extra: { booking: { customer_email: "she-just-types-this" } },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.extra.booking.customer_email).toBe("[redacted]");
  });

  it("redacts customer_first_name + customer_last_name", () => {
    const event = {
      extra: {
        booking: {
          customer_first_name: "Jane",
          customer_last_name: "Doe",
        },
      },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.extra.booking.customer_first_name).toBe("[redacted]");
    expect(out.extra.booking.customer_last_name).toBe("[redacted]");
  });

  it("redacts customer_address + waiver signed_name", () => {
    const event = {
      extra: {
        customer_address: "123 Main St, Jacksonville FL",
        waiver: { signed_name: "Jane Doe" },
      },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.extra.customer_address).toBe("[redacted]");
    expect(out.extra.waiver.signed_name).toBe("[redacted]");
  });

  it("redacts password + encrypted_password + api_key", () => {
    const event = {
      extra: {
        password: "hunter2",
        encrypted_password: "AES-encrypted-blob",
        api_key: "some-private-thing",
      },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.extra.password).toBe("[redacted]");
    expect(out.extra.encrypted_password).toBe("[redacted]");
    expect(out.extra.api_key).toBe("[redacted]");
  });

  it("matches keys case-insensitively", () => {
    const event = {
      extra: { Customer_Email: "x@y.com", PASSWORD: "h" },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.extra.Customer_Email).toBe("[redacted]");
    expect(out.extra.PASSWORD).toBe("[redacted]");
  });
});

describe("scrubSentryEvent — URLs and headers", () => {
  it("redacts query params with sensitive names", () => {
    const event = {
      request: { url: "https://example.com/cb?token=abc123&foo=bar" },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.request.url).toContain("token=%5Bredacted%5D");
    expect(out.request.url).toContain("foo=bar");
  });

  it("redacts headers map entries by name", () => {
    const event = {
      request: {
        headers: {
          Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.foo.bar",
          Cookie: "session=abc",
          "x-csrf-token": "secret",
          "User-Agent": "Chrome/120",
        },
      },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.request.headers.Authorization).toBe("[redacted]");
    expect(out.request.headers.Cookie).toBe("[redacted]");
    expect(out.request.headers["x-csrf-token"]).toBe("[redacted]");
    expect(out.request.headers["User-Agent"]).toBe("Chrome/120");
  });

  it("drops cookies map entirely", () => {
    const event = { request: { cookies: { session: "abc", csrf: "def" } } };
    const out: any = scrubSentryEvent(event);
    expect(out.request.cookies).toBe("[cookies-redacted]");
  });
});

describe("scrubSentryEvent — safety", () => {
  it("returns the event unchanged if it's null/undefined", () => {
    expect(scrubSentryEvent(null)).toBeNull();
    expect(scrubSentryEvent(undefined)).toBeUndefined();
  });

  it("caps recursion depth to avoid stack overflow", () => {
    const deep: any = {};
    let cur = deep;
    for (let i = 0; i < 50; i++) {
      cur.next = { value: "jane@example.com" };
      cur = cur.next;
    }
    // Should not throw
    expect(() => scrubSentryEvent({ extra: deep })).not.toThrow();
  });

  it("handles arrays of strings", () => {
    const event = { extra: { logs: ["jane@example.com", "(904) 584-3047"] } };
    const out: any = scrubSentryEvent(event);
    expect(out.extra.logs[0]).toBe("[email-redacted]");
    expect(out.extra.logs[1]).toBe("[phone-redacted]");
  });

  it("scrubs multiple patterns in the same string", () => {
    const event = {
      extra: { msg: "user jane@example.com at (904) 584-3047 paid via sk_live_abc123def456ghi789jklm" },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.extra.msg).toContain("[email-redacted]");
    expect(out.extra.msg).toContain("[phone-redacted]");
    expect(out.extra.msg).toContain("[stripe-key-redacted]");
  });
});
