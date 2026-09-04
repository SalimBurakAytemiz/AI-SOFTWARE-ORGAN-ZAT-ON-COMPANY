import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware - planning/03 §3.5. DELİBERE OLARAK İNCE tutulur; iki iş yapar:
 *
 *  1. DİL ÇÖZÜMÜ: "/" -> "/{varsayılan dil}" yönlendirmesi; geçersiz [locale]
 *     segmentini ele alma (next-intl middleware).
 *
 *  2. ADMIN KAPISI (ilk katman): /admin/** için Supabase oturum çerezi yoksa
 *     /admin/login'e yönlendir + oturumu tazele. Bu GÜVENLİK SINIRI DEĞİLDİR -
 *     yalnızca ilk eleme. Asıl yetki kontrolü admin (protected) layout'ta
 *     (`is_admin()`) ve veritabanında RLS'te yapılır (planning/10 §10.3).
 */

const intlMiddleware = createIntlMiddleware(routing);

const SUPABASE_CONFIGURED =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

// /admin ve /{locale}/admin yollarının ikisini de kapsar (dil öneki taşıyabilir).
function isAdminPath(pathname: string): boolean {
  return /^\/(?:tr\/|en\/)?admin(?:\/|$)/.test(pathname);
}
function isAdminLoginPath(pathname: string): boolean {
  return /^\/(?:tr\/|en\/)?admin\/login\/?$/.test(pathname);
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Admin kapısı ---
  if (isAdminPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = pathname.startsWith("/tr/") ? "/tr/admin/login" : "/en/admin/login";

    if (!SUPABASE_CONFIGURED) {
      if (isAdminLoginPath(pathname)) return NextResponse.next();
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Oturum çerezini tazele (her admin isteğinde).
    const { response, hasSession } = await updateSession(request);

    // Login sayfası: oturum kontrolü yapılmaz (döngüyü önlemek için).
    if (isAdminLoginPath(pathname)) return response;

    // Korumalı admin yolu + oturum yok -> login'e.
    if (!hasSession) {
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // Admin dışı teknik yollar next-intl'e girmez.
  if (pathname.startsWith("/auth") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // --- Dil çözümü (public site) ---
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|xml|txt|webmanifest)).*)",
  ],
};
