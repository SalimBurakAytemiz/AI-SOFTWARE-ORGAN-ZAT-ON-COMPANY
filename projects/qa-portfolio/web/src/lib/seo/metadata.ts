import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import type { DbLocale } from "@/lib/db/database.types";

/**
 * SEO METADATA YARDIMCILARI (planning/15, planning/14 review R20).
 *
 * Tek yerden: canonical URL, dil alternatifleri (hreflang + x-default), Open
 * Graph ve Twitter kartı. Her public rota `generateMetadata` içinde bunu çağırır
 * -> tutarlı, test edilebilir çıktı.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Bir yolun mutlak URL'i (dil öneki dahil). */
export function absoluteUrl(locale: DbLocale, path = ""): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}/${locale}${clean === "/" ? "" : clean}`;
}

/**
 * hreflang alternatifleri: her dil için karşılıklı URL + x-default.
 * İŞ KURALI (planning/12 RISK-061): alternatifler KARŞILIKLI olmalı ve
 * x-default varsayılan dile işaret etmeli.
 */
export function languageAlternates(path = ""): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const l of routing.locales) {
    alternates[l] = absoluteUrl(l, path);
  }
  alternates["x-default"] = absoluteUrl(routing.defaultLocale, path);
  return alternates;
}

export interface PageSeoInput {
  locale: DbLocale;
  /** Dil öneki OLMADAN yol, ör. "/projects" veya "/projects/my-slug". */
  path?: string;
  title: string;
  description: string;
  /**
   * true ise: dizine EKLENMESİN (noindex). Filtreli liste sayfaları, önizleme,
   * fallback-only sayfalar için (planning/14 review R20, RISK-060).
   */
  noindex?: boolean;
  /**
   * Filtreli sayfalarda canonical, FİLTRESİZ yola işaret eder (yinelenen
   * içerik önlenir - review R20). Verilirse canonical bu yol olur.
   */
  canonicalPath?: string;
  type?: "website" | "article";
}

/**
 * Bir public sayfanın tam Metadata nesnesini üretir.
 *
 * Open Graph GÖRSELİ burada AYARLANMAZ: Next.js `opengraph-image.tsx` dosya
 * kuralı otomatik olarak `og:image` ekler (app/[locale]/opengraph-image.tsx
 * tüm site sayfalarına, projects/[slug]/opengraph-image.tsx vaka çalışmalarına).
 */
export function buildPageMetadata(input: PageSeoInput): Metadata {
  const canonicalPath = input.canonicalPath ?? input.path ?? "";
  const canonical = absoluteUrl(input.locale, canonicalPath);

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical,
      languages: languageAlternates(canonicalPath),
    },
    robots: input.noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: input.type ?? "website",
      url: canonical,
      title: input.title,
      description: input.description,
      locale: input.locale === "tr" ? "tr_TR" : "en_US",
      siteName: "QA Engineer Portfolio",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}
