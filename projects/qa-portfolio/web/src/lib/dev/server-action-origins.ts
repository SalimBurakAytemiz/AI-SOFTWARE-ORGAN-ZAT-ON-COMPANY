/**
 * DEVELOPMENT Server Actions CSRF bypass origin listesi.
 *
 * NEDEN (root cause): Next.js 15 Server Actions, gelen isteğin `Origin` başlığını
 * `Host` / `X-Forwarded-Host` ile karşılaştırır (yerleşik CSRF koruması). Bir
 * ters proxy arkasında bu ikisi uyuşmayabilir. GitHub Codespaces port
 * yönlendirmesinde tam olarak bu olur:
 *   x-forwarded-host: <codespace>-3000.app.github.dev
 *   origin:           localhost:3000
 * Uyuşmadığı için Next action'ı reddeder: "Invalid Server Actions request".
 * `experimental.serverActions.allowedOrigins` bu origin'lerin CSRF kontrolünü
 * geçmesine izin verir (Next dokümantasyonu: "helpful when you have a reverse
 * proxy in front of your app").
 *
 * GÜVENLİK:
 *  - Liste YALNIZCA `NODE_ENV !== "production"` iken doldurulur; production
 *    build'de BOŞ döner -> deploy edilen üründe hiçbir dev origin whitelist'i
 *    kalmaz (kalıcı güvenlik açığı yok).
 *  - Wildcard (`*`, `*.app.github.dev`) KULLANILMAZ. Yalnızca bu makinedeki
 *    localhost ve BU Codespace'in tam host adı eklenir (CODESPACE_NAME'e bağlı).
 *
 * Bağımlılıksız tutulur çünkü `next.config.ts` tarafından import edilir.
 */
export function devServerActionAllowedOrigins(
  env: Record<string, string | undefined> = process.env,
): string[] {
  if (env.NODE_ENV === "production") return [];

  const origins = new Set<string>(["localhost:3000", "127.0.0.1:3000"]);

  const codespace = env.CODESPACE_NAME;
  const domain = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (codespace && domain) {
    // Next dev sunucusu tipik olarak 3000; port doluysa 3001'e düşebilir.
    for (const port of ["3000", "3001"]) {
      origins.add(`${codespace}-${port}.${domain}`);
    }
  }

  return [...origins];
}
