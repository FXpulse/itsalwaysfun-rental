// Public API reference — Swagger UI rendered from /api/v1/openapi.json.
//
// Available at /api/v1/docs without auth. The "Authorize" button in the UI
// lets devs paste their API key and try requests live against their own data.

export const metadata = {
  title: "RentalFlow Public API v1 — Reference",
  description: "REST API for products, customers, bookings, and availability.",
};

export default function ApiDocsPage() {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"
        />
      </head>
      <body style={{ margin: 0 }}>
        <div id="swagger-ui" />
        <script
          src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"
          defer
        />
        <script
          src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"
          defer
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
window.onload = function() {
  if (window.SwaggerUIBundle) {
    window.SwaggerUIBundle({
      url: "/api/v1/openapi.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [
        window.SwaggerUIBundle.presets.apis,
        window.SwaggerUIStandalonePreset
      ],
      plugins: [
        window.SwaggerUIBundle.plugins.DownloadUrl
      ],
      layout: "BaseLayout",
      tryItOutEnabled: true,
      persistAuthorization: true,
      docExpansion: "list"
    });
  } else {
    setTimeout(arguments.callee, 100);
  }
};
            `,
          }}
        />
      </body>
    </html>
  );
}
