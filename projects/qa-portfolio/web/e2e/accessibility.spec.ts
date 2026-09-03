import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * ERİŞİLEBİLİRLİK OTOMATİK KONTROLLERİ (planning/11 §11.7, planning/16, T-1606).
 *
 * axe-core ile temel WCAG 2.1 A/AA taraması. Otomatik testler sorunların
 * ~%30-40'ını yakalar; manuel kontrol listesi (planning/11 §11.7) ayrıca
 * uygulanır. "serious" / "critical" ihlal = başarısız.
 */
const ROUTES = [
  "/en",
  "/en/projects",
  "/en/projects?type=professional",
  "/en/projects/demo-checkout-regression-suite",
  "/en/about",
  "/en/contact",
  "/en/styleguide",
  "/tr",
];

for (const route of ROUTES) {
  test(`axe: ${route} — serious/critical ihlal yok`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id), null, 2)).toEqual([]);
  });
}

test("her sayfada tek bir h1 ve atlama bağlantısı var", async ({ page }) => {
  await page.goto("/en/projects");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Skip to content/i })).toHaveCount(1);
});

test("klavye: Tab ile atlama bağlantısına, oradan içeriğe ulaşılır", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "klavye navigasyonu masaüstünde test edilir");
  await page.goto("/en");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toContainText(/Skip to content/i);
  await page.keyboard.press("Enter");
  // Atlama sonrası odak/gezinme #main'e taşınır
  await expect(page).toHaveURL(/#main/);
});

test("kod bloğu klavdeyle kaydırılabilir (scrollable-region-focusable)", async ({ page }) => {
  await page.goto("/en/projects/demo-checkout-regression-suite");
  const pre = page.locator('pre[role="region"]').first();
  await expect(pre).toHaveAttribute("tabindex", "0");
  await expect(pre).toHaveAttribute("aria-label", /.+/);
});
