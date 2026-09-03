import { test, expect } from "@playwright/test";

/**
 * RESPONSIVE DAVRANIŞ E2E'Sİ (planning/06 §6.5, planning/11 "Responsive Testing").
 *
 * Anahtar kırılma noktalarında düzen bozulmalarını yakalar:
 *   - 360 (en küçük desteklenen), 768 (tablet), 1280 (masaüstü).
 */
const PAGES = ["/en", "/en/projects", "/en/projects/demo-checkout-regression-suite", "/en/about"];
const WIDTHS = [360, 768, 1280];

for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`${path} @ ${width}px — yatay taşma yok, içerik görünür`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `taşma ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }
}

test("başlık: mobilde hamburger, masaüstünde tam menü", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/en");
  await expect(page.getByRole("button", { name: /Menu/i })).toBeVisible();
  // Masaüstü menü linkleri mobilde gizli (nav "Ana menü" md:flex)
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en");
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Menu/i })).toBeHidden();
});

test("vaka çalışması: geniş ekranda çapa listesi, dar ekranda açılır menü", async ({ page }) => {
  const url = "/en/projects/demo-checkout-regression-suite";

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(url);
  await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();

  await page.setViewportSize({ width: 500, height: 900 });
  await page.goto(url);
  await expect(page.locator("summary").filter({ hasText: /On this page/i })).toBeVisible();
});

test("proje kart ızgarası: 1 / 2 / 3 kolon", async ({ page }) => {
  await page.goto("/en/projects");
  for (const [width, minCols] of [
    [360, 1],
    [800, 2],
    [1280, 3],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/en/projects");
    const cards = page.getByRole("link", { name: /Read case study/i });
    const count = await cards.count();
    if (count < minCols) continue;
    const firstBox = await cards.nth(0).boundingBox();
    const nthBox = await cards.nth(minCols - 1).boundingBox();
    // minCols'uncu kart ilk kartla aynı satırda (y yakın) olmalı
    expect(Math.abs((firstBox?.y ?? 0) - (nthBox?.y ?? 0))).toBeLessThan(20);
  }
});
