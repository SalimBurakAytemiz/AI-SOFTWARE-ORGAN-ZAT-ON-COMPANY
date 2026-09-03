import type { DbLocale } from "@/lib/db/database.types";
import type { ProjectCaseStudy } from "@/lib/domain/project";
import { absoluteUrl } from "./metadata";

/**
 * JSON-LD STRUCTURED DATA (planning/15 T-1504).
 *
 * İŞ KURALI: arama motorlarına yapılandırılmış bilgi sağlar (kişi kimliği,
 * vaka çalışmaları). `sameAs` GERÇEK sosyal profillere işaret etmeli - şu an
 * PLACEHOLDER; gerçek değerler content intake checklist B bölümünden gelecek
 * (ADR-0008: uydurma yok).
 *
 * Çıktı bir <script type="application/ld+json"> içine JSON.stringify edilir.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export interface PersonSeed {
  name: string;
  jobTitle: string;
  /** Gerçek sosyal profil URL'leri - PLACEHOLDER olabilir. */
  sameAs: string[];
  location?: string;
}

/** schema.org/Person - ana sayfa ve /about'ta kullanılır. */
export function personJsonLd(seed: PersonSeed, locale: DbLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: seed.name,
    jobTitle: seed.jobTitle,
    url: absoluteUrl(locale, "/about"),
    ...(seed.location ? { address: { "@type": "PostalAddress", addressLocality: seed.location } } : {}),
    // Boş / PLACEHOLDER değerler filtrelenir - geçersiz sameAs verilmez.
    sameAs: seed.sameAs.filter((s) => s.startsWith("http")),
  };
}

/** schema.org/WebSite - ana sayfa. */
export function webSiteJsonLd(locale: DbLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "QA Engineer Portfolio",
    url: absoluteUrl(locale, ""),
    inLanguage: locale === "tr" ? "tr-TR" : "en-US",
  };
}

/**
 * schema.org/CreativeWork - vaka çalışması sayfaları (planning/15 T-1504).
 * NDA / DEMO durumları abstract'a yansıtılır.
 */
export function caseStudyJsonLd(cs: ProjectCaseStudy, locale: DbLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: cs.title,
    headline: cs.title,
    abstract: cs.summary,
    url: absoluteUrl(locale, `/projects/${cs.slug}`),
    inLanguage: locale === "tr" ? "tr-TR" : "en-US",
    genre: "Software QA case study",
    ...(cs.period.start ? { dateCreated: cs.period.start } : {}),
    ...(cs.nda || cs.demo
      ? { creativeWorkStatus: cs.demo ? "Demo / sanitized example" : "Details withheld under NDA" }
      : {}),
    about: [...cs.platforms, ...cs.testTypes].map((t) => ({ "@type": "Thing", name: t })),
  };
}

/** schema.org/BreadcrumbList - vaka çalışması. */
export function breadcrumbJsonLd(
  locale: DbLocale,
  items: { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}/${locale}${item.path}`,
    })),
  };
}
