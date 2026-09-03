# QA Portfolio — Web Uygulaması

Bu klasör, QA Mühendisi Portföy Platformunun **Next.js uygulamasıdır**
(public site + admin CMS). Yalnızca yerel geliştirme içindir; dağıtım, gerçek
Supabase projesi ve gerçek kimlik bilgileri **Human Founder onayına** tabidir
(`../../../CLAUDE.md` §13 "authorized-project build carve-out").

## Teknoloji

| Katman | Seçim |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Stil | Tailwind CSS v4 + CSS değişken token'ları (`src/styles/tokens.css`) |
| Dil (i18n) | `next-intl`, her zaman önekli diller (`/tr`, `/en`) |
| Veritabanı | Supabase (PostgreSQL + Auth + Storage + RLS) — `supabase/` |
| Doğrulama | `zod` (istemci + sunucu aynı şema) |
| Test | Vitest (birim); Playwright (E2E) faz 2 |

## Faz 1 kapsamı

- ✅ Uygulama iskeleti, araç zinciri, CI
- ✅ Tasarım sistemi token'ları (koyu/açık, üç durumlu tema; AA kontrast)
- ✅ i18n yönlendirme + TR/EN arayüz katalogları
- ✅ Supabase istemci modülleri (browser / server / izole service-role)
- ✅ `is_admin()` yetki yardımcısı + katmanlı admin kapısı
- ✅ Veritabanı migration'ları + tüm RLS politikaları (uygulanmadı)
- ✅ `zod` şemaları + yayın kuralı (tek doğruluk kaynağı)
- ✅ Public sayfalar: ana sayfa, projeler, iletişim (+ placeholder sayfalar)
- ✅ `robots.txt`, `sitemap.xml` (hreflang)

## Faz 2 kapsamı (bu sürüm) — Supabase gerektirmeyen işler

- ✅ **Veri katmanı soyutlaması:** `ContentRepository` arayüzü +
  `FixtureContentRepository` (faz 2) + `SupabaseContentRepository` iskeleti
  (faz 3). Sayfalar yalnızca arayüzü kullanır → Supabase'e minimum kod
  değişikliğiyle geçiş.
- ✅ **Vaka çalışması (case study) şablonu:** sabit bölüm sırası, NDA/DEMO
  bandı, meta kenar çubuğu, önceki/sonraki, "yeterli kanıt yok" durumu.
- ✅ **QA bileşenleri:** senaryo tablosu (`<details>`, JS'siz), bug kartı
  (severity rail), API/SQL örnek blokları, kod bloğu (kopyala), kapsam ölçer,
  durum pilleri.
- ✅ **Markdown sanitization hattı:** `react-markdown` + `rehype-sanitize`
  (kesin izin listesi, raw HTML yok, `dangerouslySetInnerHTML` yok) +
  **XSS test korpusu** (12 saldırı yükü, hepsi etkisiz).
- ✅ **DEMO / SANITIZED fixture verileri:** gerçekçi ama kurgusal 2 vaka
  çalışması (`src/content/demo-projects.ts`); sitede görünür DEMO bandı.
- ✅ **Admin mutasyon altyapısı:** `withAdminAction()` — Authentication →
  Authorization (`is_admin()`) → Validation (zod) → Write → Audit (append-only)
  → Revalidation. Yetki sınırı testleri.
- ✅ **Admin DataTable** + proje listesi (mock in-memory depo; draft/published/
  hidden/archived davranışları test edildi).
- ✅ **Bileşen galerisi:** `/[locale]/styleguide` (noindex) — görsel regresyon temeli.
- ✅ **i18n biçimlendirme:** yerel tarih/sayı, Türkçe büyük harf (`i → İ`).
- ✅ **Empty / loading / error durumları:** `loading.tsx`, `error.tsx`, iskeletler.
- ✅ **Responsive:** mobil menü (erişilebilir).
- ✅ **Playwright E2E iskeleti:** kritik akışlar + **axe erişilebilirlik**
  (5 rota, 0 serious/critical) + görsel regresyon iskeleti.

## Faz 3 kapsamı (bu sürüm) — Supabase gerektirmeyen işler

- ✅ **SEO altyapısı:** `buildPageMetadata()` (canonical + hreflang/x-default +
  Open Graph), her public rotada `generateMetadata`.
- ✅ **Filtrelenebilir proje listesi:** URL parametreleriyle senkron
  (`?type=&platform=&tool=&testType=`), sunucu render, istemci state yok.
  Filtreli görünüm `noindex` + canonical filtresiz `/projects`'e işaret eder
  (review R20).
- ✅ **Structured data (JSON-LD):** `Person` + `WebSite` (ana sayfa, /about),
  `CreativeWork` + `BreadcrumbList` (vaka çalışması). PLACEHOLDER `sameAs`
  değerleri filtrelenir (ADR-0008).
- ✅ **Open Graph görsel üreteci:** `next/og` ile dinamik (site geneli +
  vaka çalışması başına).
- ✅ **Vaka çalışması UX:** TL;DR özet bandı (rol/yığın/sonuç), mobil "sayfada
  gezin" açılır menüsü + geniş ekran sabit çapa listesi (aktif bölüm
  IntersectionObserver ile).
- ✅ **/about + yetkinlik matrisi:** seviye çubuğu + legend; seviye verisi
  yokken `TODO` gösterilir (uydurma yok).
- ✅ **Görsel regresyon:** taban görüntüler commit'li (linux/chromium + mobile),
  CI'da karşılaştırılır.
- ✅ **Lighthouse CI:** `lighthouserc.json` bütçesi + CI job (şimdilik
  `continue-on-error` — Chrome sürüm uyumu netleşince bloke edici olacak).
- ✅ Genel `loading.tsx`, klavye navigasyon E2E'si, genişletilmiş axe rota listesi.
- ✅ **Supabase entegrasyon hazırlığı:** `getContentRepository()` fabrikası
  Supabase yapılandırılınca otomatik `SupabaseContentRepository`'ye geçer
  (metotlar iskelet; gerçek sorgu şablonları dosyada belgeli).

**Veri kaynağı:** faz 3'te tüm içerik `src/content/` (DEMO/SANITIZED +
PLACEHOLDER). Gerçek Supabase bağlantısı, admin CMS düzenleme ekranları, medya
yükleme, gerçek yayınlama ve RLS test matrisi **faz 4** — bir Supabase projesi +
kimlik bilgileri gerekiyor (`supabase/README.md`).

## Testler

| Komut | Kapsam |
|---|---|
| `npm run test` | 82 birim/bileşen testi (zod, yayın kuralı, sanitization + XSS, QA bileşenleri, admin yetki sınırı, revalidation etiketleri, biçimlendirme, filtreler, SEO metadata + structured data) |
| `npm run test:e2e` | Playwright: kritik akışlar + SEO/filtre + axe erişilebilirlik + görsel regresyon (önce `npx playwright install chromium`) |
| `npm run lhci` | Lighthouse CI performans/erişilebilirlik/SEO bütçesi |

## Kurulum

```
cd projects/qa-portfolio/web
npm install
cp .env.example .env.local     # değerler faz 2'de doldurulacak
npm run dev                    # http://localhost:3000 -> /en veya /tr
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Prod derlemesi (kimlik bilgisi gerektirmez) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (service-role import kısıtlaması dahil) |
| `npm run test` | Vitest birim testleri |
| `npm run check` | typecheck + lint + test |

## Sonraki adım (insan işlemi)

Faz 2 için bir Supabase projesi ve kimlik bilgileri gerekir —
`supabase/README.md` içindeki adımları izleyin.

## Kod standardı

Tüm kaynak kod `../../../docs/coding-standards.md` uyarınca yazılır: isimlendirme
İngilizce, önemli iş mantığı / güvenlik / veritabanı / auth yorumları Türkçe.
