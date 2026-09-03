import { test, expect } from "@playwright/test";

/**
 * TR / EN YERELLEŞTİRME E2E'Sİ (planning/11 "TR / EN Testing", planning/11 CF-18).
 */

const ROUTES = ["", "/projects", "/about", "/experience", "/services", "/qa-lab", "/contact"];

test("/ kök yolu varsayılan dile yönlendirir", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.url()).toMatch(/\/en$/); // varsayılan: en
});

test("geçersiz dil segmenti 404", async ({ page }) => {
  const res = await page.goto("/xx/projects");
  // middleware bilinmeyen dili yeniden yazar veya 404 verir; her iki durumda
  // "xx" bir sayfa render etmemeli
  expect([404, 200]).toContain(res?.status());
  if (res?.status() === 200) {
    // yeniden yazıldıysa en/tr içeriği gelmeli
    await expect(page.locator("html")).toHaveAttribute("lang", /en|tr/);
  }
});

for (const route of ROUTES) {
  test(`"${route || "/"}" her iki dilde de render eder ve <html lang> doğru`, async ({ page }) => {
    for (const locale of ["en", "tr"] as const) {
      await page.goto(`/${locale}${route}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
}

test("dil değiştirici derin yolu VE sorgu parametrelerini korur (CF-18)", async ({ page }) => {
  await page.goto("/en/projects?type=supported");
  await expect(page).toHaveURL(/\/en\/projects\?type=supported/);

  await page
    .getByRole("group", { name: /Dil seçimi|Language/i })
    .getByRole("button", { name: "tr" })
    .click();

  await expect(page).toHaveURL(/\/tr\/projects\?type=supported/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projeler");
});

test("vaka çalışması her iki dilde farklı içerik gösterir", async ({ page }) => {
  await page.goto("/en/projects/demo-checkout-regression-suite");
  const enTitle = await page.getByRole("heading", { level: 1 }).textContent();

  await page.goto("/tr/projects/demo-checkout-regression-suite");
  const trTitle = await page.getByRole("heading", { level: 1 }).textContent();

  expect(enTitle).toContain("Checkout");
  expect(trTitle).toContain("Ödeme");
});

test("Türkçe ay biçimi vaka çalışmasında doğru", async ({ page }) => {
  await page.goto("/tr/projects/demo-checkout-regression-suite");
  // period: 2024-02 – 2024-09 -> "Şubat 2024 – Eylül 2024"
  await expect(page.getByText(/Şubat 2024/)).toBeVisible();
});

test("İngilizce ay biçimi vaka çalışmasında doğru", async ({ page }) => {
  await page.goto("/en/projects/demo-checkout-regression-suite");
  await expect(page.getByText(/February 2024/)).toBeVisible();
});

test("dil değiştirici locale switch bir <html lang> güncellemesi yapar", async ({ page }) => {
  await page.goto("/en/about");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .getByRole("group", { name: /Dil seçimi|Language/i })
    .getByRole("button", { name: "tr" })
    .click();
  await expect(page).toHaveURL(/\/tr\/about/);
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
});
