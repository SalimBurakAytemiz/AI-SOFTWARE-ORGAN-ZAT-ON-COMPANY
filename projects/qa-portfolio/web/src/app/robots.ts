import type { MetadataRoute } from "next";

/**
 * robots.txt (planning/03 §3.1, planning/15 T-1503).
 * İŞ KURALI: public içerik taranabilir; /admin, /auth, /api ve API yolları
 * taranmaz. sitemap referansı verilir.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/auth", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
