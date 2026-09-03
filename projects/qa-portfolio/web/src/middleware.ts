import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Middleware - planning/03 §3.5. DELİBERE OLARAK İNCE tutulur; iki iş yapar:
 *
 *  1. DİL ÇÖZÜMÜ: "/" -> "/{varsayılan dil}" yönlendirmesi; geçersiz [locale]
 *     segmentini ele alma (next-intl middleware).
 *
 *  2. ADMIN KAPISI (ilk katman): /admin/** için oturum çerezi yoksa
 *     /admin/login'e yönlendir. Bu GÜVENLİK SINIRI DEĞİLDİR - yalnızca ilk
 *     eleme. Asıl yetki kontrolü admin layout'ta (is_admin()) ve veritabanında
 *     RLS'te yapılır (planning/10 §10.3).
 *
 * Faz 1 notu: Supabase henüz bağlı olmadığı için gerçek oturum kontrolü yerine
 * "Supabase yapılandırılana kadar admin erişimi kapalı" davranışı uygulanır;
 * herkes /admin/login'e yönlendirilir. Faz 2'de @supabase/ssr ile gerçek
 * çerez kontrolü eklenecek.
 */

const intlMiddleware = createIntlMiddleware(routing);

// Not: middleware Edge runtime'da çalışır ve @/lib/env (zod) ağını çekmemek için
// process.env doğrudan okunur. Anahtar adı src/lib/env.ts ile aynı kalmalı.
const SUPABASE_CONFIGURED =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Admin kapısı ---
  const isAdminPath = pathname.startsWith("/admin");
  const isLoginPath = pathname === "/admin/login";

  if (isAdminPath && !isLoginPath) {
    // Faz 1: Supabase yoksa admin panele hiç girilemez.
    if (!SUPABASE_CONFIGURED) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // Faz 2: burada Supabase oturum çerezi kontrol edilecek; yoksa
    // /admin/login?next=... yönlendirmesi yapılacak.
  }

  // Admin ve auth yolları next-intl'e girmez (dil öneki taşımazlar).
  if (isAdminPath || pathname.startsWith("/auth") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // --- Dil çözümü (public site) ---
  return intlMiddleware(request);
}

export const config = {
  // Statik dosyalar, görseller ve _next dışındaki her yol middleware'den geçer.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|xml|txt|webmanifest)).*)",
  ],
};
