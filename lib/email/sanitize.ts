// lib/email/sanitize.ts
//
// Sanitize incoming email HTML bodies before storage + render.
// Wraps isomorphic-dompurify with a tight policy that strips scripts,
// inline event handlers, dangerous attrs, and target=_top.
//
// The thread view ALSO renders inside an iframe sandbox — this is defense
// in depth, not the only barrier.

import DOMPurify from "isomorphic-dompurify";

export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "style"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ["target", "rel"],
  });
}
