import { defineConfig } from "vitest/config";
import path from "node:path";

// Config separada para integration tests — necesita TEST_SUPABASE_URL y
// TEST_SUPABASE_SERVICE_ROLE_KEY como env vars (cargar via `set -a; source .env.test`
// o configurar como secrets en CI).

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    // No paralelo — los tests crean tenants reales y queremos predictibilidad
    sequence: { concurrent: false },
    // Más timeout porque pueden hacer round-trips de red al Supabase de test
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
