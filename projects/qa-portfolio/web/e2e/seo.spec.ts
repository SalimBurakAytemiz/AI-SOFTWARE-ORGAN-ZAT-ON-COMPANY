import { test, expect } from "@playwright/test";

/**
 * SEO / STRUCTURED DATA / FİLTRE E2E'Sİ (planning/15, planning/14 R20).
 */

test("proje filtresi URL parametresini günceller ve listeyi daraltır", async ({ page }) => {
  await page.goto("/en/projects");
  const before = await page.getByText(/result/i).textContent();

  await page.getByTestId("project-filters").getByRole("link", { name: "Supported" }).click();
  await expect(page).toHaveURL(/\?type=supported/);
  const after = await page.getByText(/result/i).textContent();
  expect(after).not.toBe(before);

  // Aktif filtre aria-current ile işaretli
  await expect(
    page.getByTestId("project-filters").getByRole("link", { name: "Supported" }),
  ).toHaveAttribute("aria-current", "true");

  // Temizle
  await page.getByRole("link", { name: /Clear filters/i }).click();
  await expect(page).toHaveURL(/\/en\/projects$/);
});

test("filtreli proje sayfası noindex + canonical filtresiz /projects", async ({ page }) => {
  await page.goto("/en/projects?tool=Playwright");
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute("content", /noindex/);
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute("href", /\/en\/projects$/);
});

test("filtresiz proje sayfası indexlenebilir + hreflang alternatifleri", async ({ page }) => {
  await page.goto("/en/projects");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
  await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveAttribute(
    "href",
    /\/tr\/projects$/,
  );
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
});

test("ana sayfada JSON-LD Person + WebSite var", async ({ page }) => {
  await page.goto("/en");
  const joined = (
    await page.locator('script[type="application/ld+json"]').allTextContents()
  ).join(" ");
  expect(joined).toContain('"@type":"Person"');
  expect(joined).toContain('"@type":"WebSite"');
  // PLACEHOLDER sosyal profil URL'leri sameAs'e sızmamalı (ADR-0008).
  expect(joined).not.toContain("PLACEHOLDER: https");
  expect(joined).toContain('"sameAs":[]');
});

test("vaka çalışmasında JSON-LD CreativeWork + BreadcrumbList var", async ({ page }) => {
  await page.goto("/en/projects/demo-checkout-regression-suite");
  const joined = (
    await page.locator('script[type="application/ld+json"]').allTextContents()
  ).join(" ");
  expect(joined).toContain('"@type":"CreativeWork"');
  expect(joined).toContain('"@type":"BreadcrumbList"');
  expect(joined).toContain("Demo");
});

test("Open Graph görseli 200 döner ve og:image meta'sı var", async ({ page, request }) => {
  await page.goto("/en/projects/demo-checkout-regression-suite");
  const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(ogImage).toBeTruthy();
  const res = await request.get("/en/opengraph-image");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image");
});

test("vaka çalışması bölüm navigasyonu (mobil açılır menü)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "yalnızca mobil");
  await page.goto("/en/projects/demo-checkout-regression-suite");
  await expect(page.locator("summary").filter({ hasText: /On this page/i })).toBeVisible();
});

test("TL;DR bandı vaka çalışmasında görünür (review R2)", async ({ page }) => {
  await page.goto("/en/projects/demo-checkout-regression-suite");
  const tldr = page.getByTestId("case-study-tldr");
  await expect(tldr).toBeVisible();
  await expect(tldr).toContainText("Role");
  await expect(tldr).toContainText("Stack");
  await expect(tldr).toContainText("Outcome");
});

test("/about yetkinlik matrisi legend + TODO işaretleri (ADR-0008)", async ({ page }) => {
  await page.goto("/en/about");
  await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();
  // Seviye verisi yok -> TODO gösterilir, uydurma seviye yok
  await expect(page.getByText("TODO").first()).toBeVisible();
});
