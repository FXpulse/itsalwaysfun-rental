// Serves the OpenAPI 3.0 spec for the v1 public API as JSON.
// (Source of truth is public/openapi-v1.yaml — committed YAML for readability +
// versioned alongside endpoint changes. This route parses YAML on each request,
// which is OK because the file is small (~9 KB).)

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "yaml";

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
    return NextResponse.json(
      { error: "Could not load OpenAPI spec", detail: e?.message || String(e) },
      { status: 500 },
    );
  }
}
