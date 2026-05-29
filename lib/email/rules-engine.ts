// lib/email/rules-engine.ts
//
// Pure condition evaluator. Action execution is in the cron route — this
// module only decides whether a rule's conditions match a given message.
//
// Malformed regex is treated as no-match (logged once via console.warn).
// Empty conditions array returns false (a rule with zero conditions is a
// configuration error, not a fire-on-everything rule).

import type { EmailMessage, RuleConditionGroup, RuleConditionLeaf } from "./types";

function leafMatches(leaf: RuleConditionLeaf, msg: EmailMessage): boolean {
  const haystack = ((): string | boolean => {
    switch (leaf.field) {
      case "from": return msg.from_address || "";
      case "to":   return (msg.to_addresses || []).join(", ");
      case "subject": return msg.subject || "";
      case "body": return msg.body_text || "";
      case "has_attachment": return msg.has_attachments;
    }
  })();

  switch (leaf.op) {
    case "is_true":  return haystack === true;
    case "is_false": return haystack === false;
    case "contains":
      return typeof haystack === "string" && typeof leaf.value === "string"
        && haystack.includes(leaf.value);
    case "equals":
      return typeof haystack === "string" && haystack === leaf.value;
    case "starts_with":
      return typeof haystack === "string" && typeof leaf.value === "string"
        && haystack.startsWith(leaf.value);
    case "matches_regex":
      if (typeof haystack !== "string" || typeof leaf.value !== "string") return false;
      try {
        return new RegExp(leaf.value).test(haystack);
      } catch {
        console.warn(`[rules-engine] malformed regex: ${leaf.value}`);
        return false;
      }
  }
}

export function evaluateConditions(group: RuleConditionGroup, msg: EmailMessage): boolean {
  if (!group.conditions || group.conditions.length === 0) return false;
  if (group.operator === "AND") {
    return group.conditions.every((c) => leafMatches(c, msg));
  }
  return group.conditions.some((c) => leafMatches(c, msg));
}
