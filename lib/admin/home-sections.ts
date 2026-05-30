// Predefined home page section types. Each has a friendly label, an
// emoji, a description, a list of editable fields, and a default content.
// Tenants enable/disable sections at /admin/site/sections.

export type SectionType = "stats_banner" | "why_us" | "cta_banner" | "custom_html";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "html";
  placeholder?: string;
}

export interface SectionDef {
  type: SectionType;
  emoji: string;
  title: string;
  description: string;
  fields: FieldDef[];
  default_content: Record<string, string>;
  default_order: number;
}

export const SECTION_DEFS: SectionDef[] = [
  {
    type: "stats_banner",
    emoji: "📊",
    title: "Stats banner",
    description: "Three stats with a number + label. Builds trust at a glance.",
    default_order: 20,
    fields: [
      { key: "stat_1_number", label: "Stat 1 number", type: "text", placeholder: "10+" },
      { key: "stat_1_label", label: "Stat 1 label", type: "text", placeholder: "Years experience" },
      { key: "stat_2_number", label: "Stat 2 number", type: "text", placeholder: "5,000+" },
      { key: "stat_2_label", label: "Stat 2 label", type: "text", placeholder: "Events served" },
      { key: "stat_3_number", label: "Stat 3 number", type: "text", placeholder: "★ 4.9" },
      { key: "stat_3_label", label: "Stat 3 label", type: "text", placeholder: "Average rating" },
    ],
    default_content: {
      stat_1_number: "10+", stat_1_label: "Years experience",
      stat_2_number: "5,000+", stat_2_label: "Events served",
      stat_3_number: "★ 4.9", stat_3_label: "Average rating",
    },
  },
  {
    type: "why_us",
    emoji: "✨",
    title: "Why choose us",
    description: "Three feature cards explaining why customers should book with you.",
    default_order: 30,
    fields: [
      { key: "heading", label: "Section heading", type: "text", placeholder: "Why choose us" },
      { key: "feature_1_title", label: "Feature 1 title", type: "text", placeholder: "On-time delivery" },
      { key: "feature_1_body", label: "Feature 1 body", type: "textarea", placeholder: "We arrive 30 minutes before your event start. Guaranteed." },
      { key: "feature_2_title", label: "Feature 2 title", type: "text", placeholder: "Clean & inspected" },
      { key: "feature_2_body", label: "Feature 2 body", type: "textarea", placeholder: "Every unit is sanitized and safety-checked before delivery." },
      { key: "feature_3_title", label: "Feature 3 title", type: "text", placeholder: "Easy booking" },
      { key: "feature_3_body", label: "Feature 3 body", type: "textarea", placeholder: "Book online in 2 minutes. Pay securely with any card." },
    ],
    default_content: {
      heading: "Why choose us",
      feature_1_title: "On-time delivery",
      feature_1_body: "We arrive 30 minutes before your event start. Guaranteed.",
      feature_2_title: "Clean & inspected",
      feature_2_body: "Every unit is sanitized and safety-checked before delivery.",
      feature_3_title: "Easy booking",
      feature_3_body: "Book online in 2 minutes. Pay securely with any card.",
    },
  },
  {
    type: "cta_banner",
    emoji: "🎯",
    title: "Call-to-action banner",
    description: "A prominent banner before the footer with a single action.",
    default_order: 80,
    fields: [
      { key: "headline", label: "Headline", type: "text", placeholder: "Ready to book your party?" },
      { key: "subheadline", label: "Subheadline", type: "text", placeholder: "Get pricing in 2 minutes." },
      { key: "button_text", label: "Button text", type: "text", placeholder: "Check availability" },
      { key: "button_link", label: "Button link", type: "url", placeholder: "/order-by-date" },
    ],
    default_content: {
      headline: "Ready to book your party?",
      subheadline: "Get pricing in 2 minutes.",
      button_text: "Check availability",
      button_link: "/order-by-date",
    },
  },
  {
    type: "custom_html",
    emoji: "🧩",
    title: "Custom HTML block",
    description: "Power user: paste your own HTML/CSS. Use sparingly.",
    default_order: 90,
    fields: [
      { key: "html", label: "HTML content", type: "html", placeholder: "<div class='my-section'>...</div>" },
    ],
    default_content: { html: "" },
  },
];

export function getSectionDef(type: string): SectionDef | null {
  return SECTION_DEFS.find((s) => s.type === type) || null;
}

/** Sanitize custom HTML — strip <script>, <iframe>, on* handlers. */
export function sanitizeCustomHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/javascript:/gi, "");
}
