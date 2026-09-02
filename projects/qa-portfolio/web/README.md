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

## Faz 1 kapsamı (bu sürüm)

- ✅ Uygulama iskeleti, araç zinciri, CI adımı
- ✅ Tasarım sistemi token'ları (koyu/açık, üç durumlu tema)
- ✅ i18n yönlendirme + TR/EN arayüz katalogları
- ✅ Supabase istemci modülleri (browser / server / izole service-role)
- ✅ `is_admin()` yetki yardımcısı + katmanlı admin kapısı
- ✅ Veritabanı migration'ları (`supabase/migrations/`) + tüm RLS politikaları
- ✅ `zod` şemaları (proje, iletişim) + yayın kuralı (tek doğruluk kaynağı)
- ✅ Public sayfalar: ana sayfa, projeler, iletişim (+ placeholder: hakkımda,
  deneyim, hizmetler, QA Lab, yasal)
- ✅ `robots.txt`, `sitemap.xml` (hreflang)
- ✅ Birim testleri (slug, yayın kuralı, iletişim doğrulama + bot koruması)

**Veri kaynağı:** faz 1'de tüm içerik `src/content/fixtures.ts` (açıkça
`[PLACEHOLDER]`). Gerçek Supabase bağlantısı, admin CMS ekranları, vaka çalışması
sayfaları, medya yükleme ve E2E testleri **faz 2**.

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
