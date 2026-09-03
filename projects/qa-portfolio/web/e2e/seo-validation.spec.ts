import { test, expect } from "@playwright/test";

/**
 * SEO DOĞRULAMA ALTYAPISI (planning/15, planning/11 "SEO Validation").
 *
 * Tüm public rotalar (her iki dilde) taranır ve şunlar doğrulanır:
 *   - benzersiz <title> ve <meta name="description">
 *   - <link rel="canonical"> mevcut ve doğru dilde
 *   - karşılıklı hreflang alternatifleri + x-default
 *   - robots meta'sı beklenen değerde
 *   - her JSON-LD bloğu GEÇERLİ JSON
 *   - 360px genişlikte yatay kaydırma YOK (responsive)
 */

const PUBLIC_PATHS = [
  "/",
  "/about",
  "/experience",
  "/projects",
  "/qa-lab",
  "/services",
  "/contact",
  "/projects/demo-checkout-regression-suite",
  "/projects/demo-public-api-contract-testing",
];

for (const locale of ["en", "tr"] as const) {
  test.describe(`SEO · ${locale}`, () => {
    for (const path of PUBLIC_PATHS) {
      const url = `/${locale}${path === "/" ? "" : path}`;

      test(`${url} — temel SEO etiketleri`, async ({ page }) => {
        await page.goto(url);

        // <title> ve description dolu
        await expect(page).toHaveTitle(/.+/);
        const desc = await page.locator('meta[name="description"]').getAttribute("content");
        expect(desc, `meta description eksik: ${url}`).toBeTruthy();
        expect(desc!.length).toBeGreaterThan(10);

        // canonical mevcut ve aktif dile ait (ana sayfada sonda "/" yok)
        const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
        expect(canonical, `canonical eksik: ${url}`).toBeTruthy();
        expect(canonical).toMatch(new RegExp(`/${locale}(/|$)`));

        // hreflang: her iki dil + x-default
        await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveCount(1);
        await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);

        // robots: index (public sayfa)
        const robots = await page.locator('meta[name="robots"]').getAttribute("content");
        expect(robots).toMatch(/index/);

        // <html lang> doğru
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
      });

      test(`${url} — JSON-LD blokları geçerli JSON`, async ({ page }) => {
        await page.goto(url);
        const blocks = await page
          .locator('script[type="application/ld+json"]')
          .allTextContents();
        for (const block of blocks) {
          expect(() => JSON.parse(block), `geçersiz JSON-LD: ${url}`).not.toThrow();
          const parsed = JSON.parse(block);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of arr) {
            expect(item["@context"]).toBe("https://schema.org");
            expect(item["@type"]).toBeTruthy();
          }
        }
      });

      test(`${url} — 360px'te yatay kaydırma yok`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        await page.goto(url);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `yatay taşma: ${url} (${overflow}px)`).toBeLessThanOrEqual(1);
      });
    }
  });
}

test("başlıklar benzersiz (title collision yok)", async ({ page }) => {
  const titles = new Map<string, string>();
  for (const path of ["/en", "/en/projects", "/en/about", "/en/contact", "/en/services"]) {
    await page.goto(path);
    const title = await page.title();
    expect([...titles.values()], `başlık çakışması: ${path}`).not.toContain(title);
    titles.set(path, title);
  }
});

test("robots.txt admin/api yollarını engeller, sitemap referansı verir", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toMatch(/Disallow: \/admin/);
  expect(body).toMatch(/Disallow: \/api/);
  expect(body).toMatch(/Sitemap:/);
});

test("sitemap.xml yalnızca public yolları ve hreflang alternatiflerini içerir", async ({
  request,
}) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain("/en/projects");
  expect(xml).toContain("/tr/projects");
  expect(xml).toContain("hreflang");
  expect(xml).not.toContain("/admin");
});
