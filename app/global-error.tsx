"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "48rem", margin: "0 auto" }}>
        <div style={{ background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: "0.75rem", padding: "1.5rem" }}>
          <h1 style={{ color: "#991b1b", fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            ⚠ Application error
          </h1>
          <p style={{ color: "#7f1d1d", fontSize: "0.875rem", marginBottom: "1rem" }}>
            An unhandled error occurred while rendering this page.
          </p>

          <div style={{ background: "white", border: "1px solid #fecaca", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", marginBottom: "0.5rem" }}>
            <div style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: 700, color: "#b91c1c" }}>Message</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", wordBreak: "break-all", marginTop: "0.125rem" }}>
              {error.message || "(no message)"}
            </div>
          </div>

          {error.digest && (
            <div style={{ background: "white", border: "1px solid #fecaca", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: 700, color: "#b91c1c" }}>Digest</div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", marginTop: "0.125rem" }}>{error.digest}</div>
            </div>
          )}

          {error.stack && (
            <details style={{ background: "white", border: "1px solid #fecaca", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", marginBottom: "1rem" }}>
              <summary style={{ fontSize: "0.75rem", fontWeight: 700, color: "#b91c1c", cursor: "pointer" }}>Stack trace</summary>
              <pre style={{ fontSize: "0.625rem", whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: "0.5rem", color: "#374151", maxHeight: "24rem", overflow: "auto" }}>
                {error.stack}
              </pre>
            </details>
          )}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={reset}
              style={{ background: "#dc2626", color: "white", fontSize: "0.875rem", fontWeight: 600, borderRadius: "0.375rem", padding: "0.5rem 1rem", border: "none", cursor: "pointer" }}
            >
              Retry
            </button>
            <a
              href="/superadmin/tenants"
              style={{ color: "#b91c1c", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none", padding: "0.5rem 0.75rem" }}
            >
              Back to tenants
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
