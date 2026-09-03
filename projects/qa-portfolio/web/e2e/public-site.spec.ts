import { test, expect } from "@playwright/test";

/**
 * KRİTİK AKIŞ İSKELET E2E'Sİ - public site (planning/11 §11.6).
 *
 * Faz 2 kapsamı: sayfa render, dil değiştirme, proje listesi -> vaka çalışması,
 * 404, iletişim formu doğrulama. Supabase gerektiren akışlar (CF-01..CF-25'in
 * yayın/giriş kısımları) faz 3.
 */

test("ana sayfa açılır (redirect + render)", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/(en|tr)$/); // varsayılan dile yönlendirir
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("dil değiştirme aynı sayfada kalır (CF-18)", async ({ page }) => {
  await page.goto("/en/projects");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projects");
  await page.getByRole("group", { name: /Dil seçimi|Language/i }).getByRole("button", { name: "tr" }).click();
  await expect(page).toHaveURL(/\/tr\/projects/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projeler");
});

test("proje listesinden vaka çalışmasına gidilir", async ({ page }) => {
  await page.goto("/en/projects");
  const firstCard = page.getByRole("link", { name: /Read case study/i }).first();
  await firstCard.click();
  await expect(page).toHaveURL(/\/en\/projects\/.+/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("DEMO vaka çalışmasında DEMO bandı görünür (ADR-0008)", async ({ page }) => {
  await page.goto("/en/projects/demo-checkout-regression-suite");
  await expect(page.getByText(/DEMO \/ SANITIZED/i).first()).toBeVisible();
  // QA kanıtı: senaryo tablosu ve bug kartı render edilmeli
  await expect(page.getByText("TS-01").first()).toBeVisible();
  await expect(page.getByText("BUG-01").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Test scenarios" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bug examples" })).toBeVisible();
});

test("NDA projesinde şirket 'Confidential' gösterilir (CF-15 mock)", async ({ page }) => {
  await page.goto("/en/projects/demo-public-api-contract-testing");
  await expect(page.getByText(/non-disclosure agreement/i)).toBeVisible();
});

test("bilinmeyen slug -> gerçek 404 (CF-06, RISK-060 soft-404 önlenir)", async ({ page }) => {
  const res = await page.goto("/en/projects/bu-slug-yok-12345");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/not found/i);
});

test("iletişim formu istemci doğrulaması (CF-21)", async ({ page }) => {
  await page.goto("/en/contact");
  await page.getByLabel("Name", { exact: true }).fill("A"); // çok kısa
  await page.getByLabel("Email", { exact: true }).fill("gecersiz");
  await page.getByLabel("Message", { exact: true }).fill("short");
  await page.getByRole("button", { name: /Send message/i }).click();
  // Sunucuya gitmeden YEREL bir alan hatası gösterilmeli
  await expect(page.locator('p[role="alert"]')).toContainText(/check the form/i);
});

test("mobil menü açılıp kapanır (erişilebilirlik)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "yalnızca mobil projede");
  await page.goto("/en");
  const toggle = page.getByRole("button", { name: /Menu/i });
  await toggle.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Projects" })).toBeVisible();
});
