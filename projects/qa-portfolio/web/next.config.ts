import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl eklentisi: istek başına aktif dili (tr / en) çözer ve mesaj
// kataloglarını yükler. Yol: src/i18n/request.ts
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Güvenlik yanıt başlıkları. CSP faz 2'de nonce tabanlı olarak sıkılaştırılacak
  // (planning/10-security-plan.md §10.14). Buradaki set, temel korumayı sağlar:
  // MIME sniffing, clickjacking ve referrer sızıntısına karşı.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
      {
        // Admin ve auth yolları asla dizine eklenmemeli (planning/03 + §10.9).
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/auth/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },

  images: {
    // Supabase Storage genel (public) URL'lerinden görsel servis edilir.
    // Gerçek proje URL'si faz 2'de .env üzerinden gelecek; burada yalnızca
    // yapı (pattern) tanımlıdır.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default withNextIntl(nextConfig);
