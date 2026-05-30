// Tiny markdown → HTML converter. No deps. Handles the subset KB articles use:
// - # / ## / ### headers
// - **bold**, *italic*, `code`
// - ```code blocks```
// - - bullet lists, 1. numbered lists
// - [text](url) links
// - blockquotes
// - hard line breaks (\n\n → <p>, single \n → <br>)
//
// Output is escaped first then transformed; safe for KB previews. For email
// rendering still pass through sanitizeEmailHtml.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderMarkdown(md: string): string {
  let s = escapeHtml(md);

  // Code blocks (must run before inline code)
  s = s.replace(/```([\s\S]*?)```/g, (_m, code) =>
    `<pre class="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto text-xs my-3"><code>${code.trim()}</code></pre>`,
  );

  // Headers
  s = s.replace(/^###\s+(.+)$/gm, '<h3 class="text-base font-bold text-brand-navy mt-4 mb-2">$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm, '<h2 class="text-lg font-bold text-brand-navy mt-5 mb-2">$1</h2>');
  s = s.replace(/^#\s+(.+)$/gm, '<h1 class="text-xl font-bold text-brand-navy mt-6 mb-3">$1</h1>');

  // Blockquotes
  s = s.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="border-l-4 border-violet-300 pl-3 italic text-slate-600 my-2">$1</blockquote>');

  // Inline code
  s = s.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-brand-navy px-1 py-0.5 rounded text-xs">$1</code>');

  // Bold + italic
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-violet-700 underline">$1</a>');

  // Lists (process line-by-line)
  const lines = s.split("\n");
  const out: string[] = [];
  let inUl = false, inOl = false;
  for (const line of lines) {
    if (/^\s*-\s+/.test(line)) {
      if (!inUl) { out.push('<ul class="list-disc list-inside my-2 space-y-1 text-sm">'); inUl = true; }
      out.push(`<li>${line.replace(/^\s*-\s+/, "")}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOl) { out.push('<ol class="list-decimal list-inside my-2 space-y-1 text-sm">'); inOl = true; }
      out.push(`<li>${line.replace(/^\s*\d+\.\s+/, "")}</li>`);
      continue;
    }
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
    out.push(line);
  }
  if (inUl) out.push("</ul>");
  if (inOl) out.push("</ol>");
  s = out.join("\n");

  // Paragraphs (split on blank lines)
  const paras = s.split(/\n{2,}/);
  s = paras
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      // Don't wrap blocks that are already HTML
      if (/^<(h\d|pre|ul|ol|blockquote|li)/.test(trimmed)) return trimmed;
      return `<p class="text-sm text-slate-700 my-2 leading-relaxed">${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return s;
}
