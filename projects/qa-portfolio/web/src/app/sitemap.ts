import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

/**
 * sitemap.xml (planning/03 §3.1, planning/15 T-1502).
 *
 * İŞ KURALI: yalnızca YAYINLANMIŞ public URL'ler listelenir; her URL için
 * tr/en karşılıklı alternatifler verilir (hreflang). Faz 1'de statik public
 * rotalar; faz 2'de yayınlanmış proje/qa-lab slug'ları eklenecek ve yayın
 * anında yeniden üretilecek (revalidateTag 'sitemap').
 */
const STATIC_PATHS = [
  "",
  "/about",
  "/experience",
  "/projects",
  "/qa-lab",
  "/services",
  "/contact",
  "/legal/privacy",
  "/legal/imprint",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return STATIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified: new Date(),
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${base}/${l}${path}`]),
        ),
      },
    })),
  );
}
