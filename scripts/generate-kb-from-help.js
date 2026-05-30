#!/usr/bin/env node
// Reads app/admin/help/HelpClient.tsx, parses each help section,
// converts JSX → markdown, and emits supabase/kb_from_help.sql with
// INSERT statements for kb_articles. Re-runnable: uses ON CONFLICT DO UPDATE.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "app", "admin", "help", "HelpClient.tsx");
const OUT = path.join(__dirname, "..", "supabase", "kb_from_help.sql");

const raw = fs.readFileSync(SRC, "utf-8");

// Find each section block. Strategy: scan for lines matching `    {` then
// `      id: "...",` then `      title: "...",`. Then collect until we see
// `    },` at indentation 4.

const lines = raw.split(/\r?\n/);
const sections = [];

let i = 0;
while (i < lines.length) {
  const line = lines[i];
  // Section start: `    {` followed by `      id: "..."`
  if (line === "    {" && lines[i + 1] && /^\s+id:\s+"[^"]+"/.test(lines[i + 1])) {
    const idMatch = lines[i + 1].match(/id:\s+"([^"]+)"/);
    const titleMatch = lines[i + 2] && lines[i + 2].match(/title:\s+"([^"]+)"/);
    if (!idMatch || !titleMatch) { i++; continue; }
    const id = idMatch[1];
    const title = titleMatch[1];
    // Collect content block — from `      content: (` to the matching `      ),`
    let j = i + 3;
    while (j < lines.length && !/^\s+content:\s*\(\s*$/.test(lines[j])) j++;
    if (j >= lines.length) { i++; continue; }
    j++; // skip the `content: (` line
    const contentStart = j;
    // Find closing `      ),` at depth 0 (the content's closing paren)
    while (j < lines.length && lines[j] !== "      ),") j++;
    if (j >= lines.length) { i++; continue; }
    const contentEnd = j;
    const contentJsx = lines.slice(contentStart, contentEnd).join("\n");
    sections.push({ id, title, jsx: contentJsx });
    i = contentEnd + 1;
    continue;
  }
  i++;
}

function jsxToMd(jsx) {
  let s = jsx;

  // Decode HTML entities
  s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

  // Self-closing capitalized components: <ChevronRight ... /> → remove
  s = s.replace(/<[A-Z]\w*[^>]*?\/>/g, "");

  // Strip className attributes (handles "..." and {...} values, single line)
  s = s.replace(/\s+className=(?:"[^"]*"|\{[^}]*\})/g, "");

  // Strip other common JSX attrs
  s = s.replace(/\s+(href|target|rel|title|key|style|onClick|role|aria-\w+|alt|src|tabIndex|type|name|id|value|onChange|onSubmit|defaultValue|placeholder|disabled|hidden|spellCheck|autoComplete|autoFocus|readOnly|required|loading)=(?:"[^"]*"|\{[^}]*\})/g, "");

  // Strip JSX comments
  s = s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  // Inline formatting
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**");
  s = s.replace(/<b>([\s\S]*?)<\/b>/g, "**$1**");
  s = s.replace(/<em>([\s\S]*?)<\/em>/g, "*$1*");
  s = s.replace(/<i>([\s\S]*?)<\/i>/g, "*$1*");
  s = s.replace(/<code>([\s\S]*?)<\/code>/g, "`$1`");
  s = s.replace(/<u>([\s\S]*?)<\/u>/g, "$1");

  // Headers
  s = s.replace(/<h2>([\s\S]*?)<\/h2>/g, "\n\n## $1\n\n");
  s = s.replace(/<h3>([\s\S]*?)<\/h3>/g, "\n\n### $1\n\n");
  s = s.replace(/<h4>([\s\S]*?)<\/h4>/g, "\n\n#### $1\n\n");

  // List items — we lose ul/ol distinction but use - either way (simplest)
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, "\n- $1");

  // Strip list wrappers
  s = s.replace(/<\/?(ul|ol)[^>]*>/g, "\n");

  // Paragraphs → blank lines
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, "\n\n$1\n\n");

  // Tables: simplified — just keep cell content separated by " | "
  s = s.replace(/<\/?(thead|tbody|tfoot)[^>]*>/g, "");
  s = s.replace(/<th[^>]*>([\s\S]*?)<\/th>/g, "$1 | ");
  s = s.replace(/<td[^>]*>([\s\S]*?)<\/td>/g, "$1 | ");
  s = s.replace(/<\/?tr[^>]*>/g, "\n");
  s = s.replace(/<\/?table[^>]*>/g, "\n");

  // Remove remaining structural tags
  s = s.replace(/<\/?(div|span|section|article|header|footer|main|nav|aside|figure|figcaption)[^>]*>/g, "");
  s = s.replace(/<\/?br\s*\/?>/g, "\n");

  // Capitalized React components (paired): unwrap them — keep inner content
  s = s.replace(/<([A-Z]\w*)[^>]*>([\s\S]*?)<\/\1>/g, "$2");

  // Curly-brace JSX expressions:
  //   {`text`} → text
  //   {variable} → ""
  //   {/* comment */} already handled
  s = s.replace(/\{`([^`]*)`\}/g, "$1");
  s = s.replace(/\{"([^"]*)"\}/g, "$1");
  s = s.replace(/\{[^{}]*\}/g, "");

  // Collapse whitespace
  s = s.replace(/\r/g, "");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  // Tidy leading whitespace per line (remove the JSX indentation)
  s = s.split("\n").map((l) => l.replace(/^\s+/, "")).join("\n");

  return s.trim();
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

function inferCategory(id, title) {
  const t = `${id} ${title}`.toLowerCase();
  if (t.includes("stripe") || t.includes("billing") || t.includes("payment") || t.includes("tax") || t.includes("invoice") || t.includes("payout")) return "Billing";
  if (t.includes("driver") || t.includes("dispatch") || t.includes("fleet") || t.includes("route") || t.includes("vehicle") || t.includes("trailer")) return "Dispatch";
  if (t.includes("email") || t.includes("sms")) return "Communications";
  if (t.includes("kb") || t.includes("waiver") || t.includes("coi") || t.includes("policy") || t.includes("policies") || t.includes("tips")) return "Policies";
  if (t.includes("product") || t.includes("inventory") || t.includes("categor") || t.includes("package")) return "Catalog";
  if (t.includes("review") || t.includes("contact") || t.includes("customer")) return "Customer";
  if (t.includes("loyalty") || t.includes("coupon") || t.includes("gift")) return "Promotions";
  if (t.includes("audit") || t.includes("error") || t.includes("diagnostic") || t.includes("backup") || t.includes("1099") || t.includes("report") || t.includes("accounting") || t.includes("low-stock")) return "Operations";
  if (t.includes("site") || t.includes("font") || t.includes("realtime") || t.includes("pwa")) return "Customization";
  return "Setup";
}

// Use dollar-quoting for body_md to avoid all single-quote escape issues.
// Tag picked unlikely to appear in any body text.
const BODY_TAG = "kbbody";

let sql = `-- supabase/kb_from_help.sql
-- Generated by scripts/generate-kb-from-help.js from app/admin/help/HelpClient.tsx
-- Run in Supabase SQL Editor. Re-runnable: ON CONFLICT (slug) DO UPDATE.
-- Bodies use $${BODY_TAG}$ dollar-quoting so markdown content with quotes / dollars
-- doesn't need escaping.

insert into kb_articles (slug, title, body_md, category, tags, is_published) values
`;

const rows = sections.map((sec) => {
  let md = jsxToMd(sec.jsx);
  // Defensive: if the body happens to contain our dollar tag, swap to a longer one.
  // (None of the help content uses literal "$kbbody$" but check anyway.)
  if (md.includes(`$${BODY_TAG}$`)) {
    throw new Error(`Body for ${sec.id} contains the dollar tag $${BODY_TAG}$ — pick a different tag.`);
  }
  const slug = `help-${sec.id}`;
  const cat = inferCategory(sec.id, sec.title);
  return `('${sqlEscape(slug)}', '${sqlEscape(sec.title)}', $${BODY_TAG}$${md}$${BODY_TAG}$, '${sqlEscape(cat)}', '{"help","imported"}', true)`;
});

sql += rows.join(",\n") + "\n";
sql += `on conflict (slug) do update set
  title = excluded.title,
  body_md = excluded.body_md,
  category = excluded.category,
  tags = excluded.tags,
  updated_at = now();
`;

fs.writeFileSync(OUT, sql, "utf-8");
console.log(`Generated ${OUT}`);
console.log(`Sections parsed: ${sections.length}`);
console.log("First 5 IDs:", sections.slice(0, 5).map((s) => s.id).join(", "));
