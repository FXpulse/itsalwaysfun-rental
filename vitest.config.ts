import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Solo unit tests por default. Integration tests requieren TEST_SUPABASE_URL
    // y se corren con `npm run test:integration` separado.
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "lib/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/supabase/**", "lib/email/**", "lib/storage/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
