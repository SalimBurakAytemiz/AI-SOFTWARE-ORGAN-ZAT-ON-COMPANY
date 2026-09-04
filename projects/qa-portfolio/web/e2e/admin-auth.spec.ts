import { test, expect } from "@playwright/test";

/**
 * ADMIN GİRİŞ AKIŞI - E2E (kimlik doğrulanmamış senaryolar).
 *
 * NOT: Gerçek admin parolasıyla giriş (başarılı akış) bilinçli olarak burada
 * test EDİLMEZ - parola bir Human Founder sırrıdır ve teste gömülmez. Başarılı
 * akış birim testlerinde (actions.test.ts) + RLS matrisinde doğrulanır.
 * Burada: yönlendirme, form render, genel hata mesajı (kullanıcı sayımı yok).
 */

test("korumalı admin sayfası oturumsuz -> login'e yönlenir (next korunur)", async ({ page }) => {
  await page.goto("/en/admin/dashboard");
  await expect(page).toHaveURL(/\/en\/admin\/login\?next=%2Fen%2Fadmin%2Fdashboard/);
  await expect(page.getByRole("heading", { name: /QA CMS/i })).toBeVisible();
});

test("login formu e-posta + parola alanları gösterir", async ({ page }) => {
  await page.goto("/en/admin/login");
  await expect(page.getByLabel("E-posta")).toBeVisible();
  await expect(page.getByLabel("Parola")).toBeVisible();
  await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
});

test("yanlış kimlik bilgisi -> genel hata mesajı (kullanıcı sayımı sızmaz)", async ({ page }) => {
  await page.goto("/en/admin/login");
  await page.getByLabel("E-posta").fill("nonexistent@example.com");
  await page.getByLabel("Parola").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Giriş yap" }).click();

  // Route announcer da role="alert" taşır; form hatası <p> elemanıdır.
  const alert = page.locator('p[role="alert"]');
  await expect(alert).toBeVisible({ timeout: 15_000 });
  // "kullanıcı yok" / "parola yanlış" ayrımı YAPILMAZ.
  await expect(alert).toContainText(/hatalı veya bu hesabın yönetici yetkisi yok/i);
});

test("admin yolları robots.txt'te engellenir", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  expect(await res.text()).toMatch(/Disallow:\s*\/\w+\/admin|Disallow:\s*\/admin/);
});

test("tüm korumalı admin sayfaları oturumsuz login'e yönlenir", async ({ page }) => {
  for (const path of [
    "/en/admin/projects",
    "/en/admin/projects/new",
    "/en/admin/media",
    "/en/admin/dashboard",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/admin\/login/);
  }
});
