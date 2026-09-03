import { test, expect } from "@playwright/test";

/**
 * GÖRSEL REGRESYON (planning/07 T-0209, T-1805).
 *
 * Bileşen galerisi ve anahtar sayfaların ekran görüntüsü, commit'li taban
 * (baseline) görüntülerle karşılaştırılır. Taban görüntüler
 * `e2e/visual-regression.spec.ts-snapshots/` altında (linux/chromium + mobile).
 * Fark = bloke edici inceleme öğesi (otomatik kabul edilmez).
 *
 * Tabanı güncellemek (bilinçli görsel değişiklik sonrası):
 *   npx playwright test visual-regression --update-snapshots
 *
 * NOT: taban görüntüler işletim sistemi/tarayıcı sürümüne bağlıdır. CI ubuntu +
 * pinlenmiş Playwright chromium kullanır; yerel linux ortamıyla uyumludur.
 * maxDiffPixelRatio: 0.02 küçük font-render farklarını tolere eder.
 */
test.describe("görsel regresyon", () => {
  test("bileşen galerisi — açık/koyu", async ({ page }) => {
    await page.goto("/en/styleguide");
    await expect(page.getByTestId("styleguide")).toBeVisible();
    await expect(page).toHaveScreenshot("styleguide-system.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test("ana sayfa", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot("home-en.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
  });

  test("vaka çalışması (DEMO)", async ({ page }) => {
    await page.goto("/en/projects/demo-checkout-regression-suite");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot("case-study-demo.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
