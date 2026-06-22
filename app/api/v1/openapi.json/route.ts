// Serves the OpenAPI 3.0 spec for the v1 public API as JSON.
// (Source of truth is public/openapi-v1.yaml — committed YAML for readability +
// versioned alongside endpoint changes. This route parses YAML on each request,
// which is OK because the file is small (~9 KB).)

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "yaml";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "openapi-v1.yaml");
    const raw = readFileSync(filePath, "utf-8");
    const spec = yaml.parse(raw);
    return NextResponse.json(spec, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    // The endpoint is intentionally public (CORS *), so any error.detail
    // would leak file paths or internal exception text to an attacker.
    // Capture the real error to Sentry instead and return a generic body.
    Sentry.captureException(e, { tags: { area: "openapi-spec" } });
    return NextResponse.json(
      { error: "Spec not available" },
      { status: 500 },
    );
  }
}
