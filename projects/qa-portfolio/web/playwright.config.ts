import { defineConfig, devices } from "@playwright/test";

/**
 * PLAYWRIGHT E2E YAPILANDIRMASI (planning/11 §11.2, planning/07 T-1804).
 *
 * Faz 2: kritik akışların İSKELET E2E'si (build + start üzerinde çalışır,
 * fixture verisiyle). Supabase gerektiren akışlar (giriş, gerçek yayınlama,
 * RLS matrisi) faz 3'te gerçek staging'e karşı eklenecek.
 *
 * Yerel çalıştırma: `npx playwright install chromium` (tarayıcı indirir), sonra
 * `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/en",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" },
  },
});
