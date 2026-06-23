/**
 * scan-bundle-for-secrets.ts — fail CI if the production client bundle contains
 * anything that looks like a real-world secret.
 *
 * Targets known token shapes (Stripe sk_/whsec_/rk_, Resend re_, SendGrid SG.,
 * GHL pit-, Brevo xkeysib-, Supabase service-role JWTs, generic "Bearer <opaque>"
 * patterns) inside `.next/static` and (when present) `.next/standalone`. Anything
 * matching prints a redacted sample + file + offset, then exits non-zero.
 *
 * What this CANNOT catch:
 *  - Custom-shaped tokens (e.g. a partner's API key that's just 32 random chars
 *    with no prefix). Add a regex for it here if you start using one.
 *  - Secrets that are obfuscated/encoded by a build step. The scan reads raw
 *    bundle output as written by Next.js.
 *  - Server-side secrets in `.next/server`. They're supposed to live there.
 *    We deliberately skip that directory.
 *
 * Run locally:
 *   npm run build
 *   npx tsx scripts/scan-bundle-for-secrets.ts
 *
 * CI:
 *   bundle-secret-scan job in .github/workflows/ci.yml
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const CANDIDATE_DIRS = [".next/static", ".next/standalone/.next/static"];
const SCAN_EXTS = new Set([".js", ".mjs", ".cjs", ".html", ".txt", ".json", ".map"]);

interface Pattern {
  name: string;
  regex: RegExp;
  /** Optional further check on each match. Return true to flag. */
  validator?: (match: string) => boolean;
}

const PATTERNS: Pattern[] = [
  { name: "Stripe secret key",        regex: /\bsk_(?:live|test)_[A-Za-z0-9]{20,}/g },
  { name: "Stripe restricted key",    regex: /\brk_(?:live|test)_[A-Za-z0-9]{20,}/g },
  { name: "Stripe webhook secret",    regex: /\bwhsec_[A-Za-z0-9]{20,}/g },
  { name: "Resend API key",           regex: /\bre_[A-Za-z0-9_]{20,}/g },
  { name: "SendGrid API key",         regex: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
  { name: "GHL personal integration token", regex: /\bpit-[A-Za-z0-9-]{20,}/g },
  { name: "Brevo (Sendinblue) API key",     regex: /\bxkeysib-[A-Za-z0-9]{32,}/g },
  { name: "OpenAI API key",           regex: /\bsk-[A-Za-z0-9]{32,}/g },
  { name: "Anthropic API key",        regex: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: "GitHub PAT (classic)",     regex: /\bghp_[A-Za-z0-9]{30,}/g },
  { name: "GitHub fine-grained PAT",  regex: /\bgithub_pat_[A-Za-z0-9_]{40,}/g },
  // Supabase service-role JWTs decode to { role: "service_role" }. Anon JWTs
  // decode to { role: "anon" } and are SAFE to ship — skip those.
  {
    name: "Supabase service_role JWT",
    regex: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
    validator: (m) => {
      try {
        const parts = m.split(".");
        if (parts.length !== 3) return false;
        // base64url -> base64
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
        return payload?.role === "service_role";
      } catch {
        return false;
      }
    },
  },
  // Generic "Bearer <opaque>" tokens. High false-positive risk — keeps the
  // bar to high-entropy 40+ char strings only.
  {
    name: "Bearer token (suspicious — please verify)",
    regex: /Bearer[\s"']+([A-Za-z0-9_.~+-]{40,})/g,
  },
];

const REDACTION_OPAQUE = (s: string): string => {
  if (s.length <= 16) return "***";
  return s.slice(0, 6) + "…" + s.slice(-4);
};

interface Hit {
  pattern: string;
  file: string;
  sample: string;
  byteOffset: number;
}

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) {
      yield* walkFiles(full);
    } else if (SCAN_EXTS.has(extname(entry).toLowerCase())) {
      yield full;
    }
  }
}

function scanFile(path: string): Hit[] {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const hits: Hit[] = [];
  for (const p of PATTERNS) {
    p.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.regex.exec(content)) !== null) {
      const match = m[0];
      if (p.validator && !p.validator(match)) continue;
      hits.push({
        pattern: p.name,
        file: path,
        sample: REDACTION_OPAQUE(match),
        byteOffset: m.index,
      });
    }
  }
  return hits;
}

function main() {
  const dirs = CANDIDATE_DIRS.filter((d) => existsSync(d));
  if (dirs.length === 0) {
    console.error(
      "[secret-scan] No client bundle directories found. Run `npm run build` first.",
    );
    process.exit(2);
  }

  let totalHits = 0;
  let filesScanned = 0;
  for (const dir of dirs) {
    for (const f of walkFiles(dir)) {
      filesScanned++;
      const hits = scanFile(f);
      if (hits.length === 0) continue;
      totalHits += hits.length;
      for (const hit of hits) {
        console.error(
          `[secret-scan] ❌ ${hit.pattern}\n` +
            `              file:   ${hit.file}\n` +
            `              sample: ${hit.sample} (byte ${hit.byteOffset})`,
        );
      }
    }
  }

  console.log(`[secret-scan] scanned ${filesScanned} client bundle file(s) in ${dirs.join(", ")}`);

  if (totalHits > 0) {
    console.error(
      `\n[secret-scan] ❌ ${totalHits} potential secret leak(s) in the client bundle.\n` +
        `              Fix by moving that value to a server-only path:\n` +
        `              - Replace direct reads in Client Components with a server action\n` +
        `              - Rename the env var so it does NOT start with NEXT_PUBLIC_\n` +
        `              - Audit the file path printed above for the actual reference\n`,
    );
    process.exit(1);
  }

  console.log("[secret-scan] ✅ Client bundle scan clean.");
}

main();
