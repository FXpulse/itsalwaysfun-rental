import { describe, it, expect } from "vitest";
import { evaluateConditions } from "./rules-engine";
import type { EmailMessage, RuleConditionGroup } from "./types";

const baseMsg: EmailMessage = {
  id: "m1", thread_id: "t1", account_id: "a1", folder_id: null,
  direction: "incoming", imap_uid: 1, message_id_header: null, in_reply_to: null,
  from_address: "mike@bouncyhouse.com",
  to_addresses: ["info@getrentalflow.com"],
  cc_addresses: [],
  subject: "Re: Quick question about Mike's Bouncers",
  body_text: "Yes still using EventRentalSystems. Tell me more.",
  body_html: null,
  received_at: "2026-05-29T12:00:00Z", sent_at: null,
  is_read: false, has_attachments: false, raw_size_bytes: 1024,
};

describe("evaluateConditions", () => {
  it("returns true when single AND condition matches", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "contains", value: "@bouncyhouse.com" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("returns false when single AND condition does not match", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "contains", value: "@otherco.com" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(false);
  });

  it("AND requires all conditions true", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [
        { field: "from", op: "contains", value: "@bouncyhouse.com" },
        { field: "subject", op: "contains", value: "Tell me more" },
      ],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(false); // case-sensitive subject
  });

  it("OR requires any condition true", () => {
    const cond: RuleConditionGroup = {
      operator: "OR",
      conditions: [
        { field: "from", op: "contains", value: "@nope.com" },
        { field: "subject", op: "contains", value: "Quick question" },
      ],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("equals is exact match", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "equals", value: "mike@bouncyhouse.com" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("starts_with matches subject prefix", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "subject", op: "starts_with", value: "Re:" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("matches_regex evaluates regex on the field", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "matches_regex", value: "^mike@.+\\.com$" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("is_true on has_attachment", () => {
    const msgWithAttach = { ...baseMsg, has_attachments: true };
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "has_attachment", op: "is_true" }],
    };
    expect(evaluateConditions(cond, msgWithAttach)).toBe(true);
    expect(evaluateConditions(cond, baseMsg)).toBe(false);
  });

  it("body condition searches text body", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "body", op: "contains", value: "EventRentalSystems" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(true);
  });

  it("malformed regex returns false (does not throw)", () => {
    const cond: RuleConditionGroup = {
      operator: "AND",
      conditions: [{ field: "from", op: "matches_regex", value: "[invalid(" }],
    };
    expect(evaluateConditions(cond, baseMsg)).toBe(false);
  });

  it("empty conditions array returns false (no rule fires on nothing)", () => {
    const cond: RuleConditionGroup = { operator: "AND", conditions: [] };
    expect(evaluateConditions(cond, baseMsg)).toBe(false);
  });
});
