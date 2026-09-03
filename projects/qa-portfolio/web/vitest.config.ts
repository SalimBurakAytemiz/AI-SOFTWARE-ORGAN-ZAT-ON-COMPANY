import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Birim + bileşen testleri için Vitest yapılandırması.
 *
 * - Saf mantık testleri (zod, publication, slug) node ortamında.
 * - Bileşen / sanitization testleri JSX kullanır (react plugin) ve jsdom
 *   ortamında çalışır.
 * - E2E (Playwright) ayrı: `npm run test:e2e`, playwright.config.ts.
 * - Entegrasyon/RLS testleri faz 3'te gerçek Postgres'e karşı eklenecek
 *   (planning/11 §11.2).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
