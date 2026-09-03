import { test, expect } from "@playwright/test";

/**
 * GÖRSEL REGRESYON İSKELETİ (planning/07 T-0209, T-1805).
 *
 * Bileşen galerisi ve anahtar sayfaların ekran görüntüsü alınır ve taban
 * (baseline) ile karşılaştırılır. Taban ilk çalıştırmada üretilir:
 *   npx playwright test visual-regression --update-snapshots
 * Fark = bloke edici inceleme öğesi (otomatik kabul edilmez).
 *
 * Faz 2'de taban görüntüler HENÜZ commit edilmedi (tarayıcı ortamına bağlı);
 * CI'da tarayıcı kurulduktan sonra üretilip commit edilecek.
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
