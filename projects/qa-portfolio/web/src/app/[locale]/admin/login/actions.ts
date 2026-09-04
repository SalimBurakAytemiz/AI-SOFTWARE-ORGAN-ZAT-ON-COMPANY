"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/is-admin";
import { checkLoginRate, resetLoginRate } from "@/lib/auth/rate-limit";
import { isLocale } from "@/i18n/routing";

/**
 * ADMIN GİRİŞ SERVER ACTION (planning/05 §5.1, planning/10 §10.3).
 *
 * Güvenlik kuralları:
 *  - GENEL HATA MESAJI: "e-posta yok" ile "parola yanlış" AYNI mesajı döndürür
 *    (kullanıcı adı / hesap sayımı sızdırılmaz - planning/10 §10.3).
 *  - HIZ SINIRI: IP başına 15 dk'da 5 deneme (MFA yok - ADR-0021; brute-force'a
 *    karşı ilk savunma). Başarıda sayaç sıfırlanır.
 *  - YETKİ AYRI: kimlik doğrulaması başarılı olsa bile kullanıcı `admin_users`
 *    allow-list'inde değilse OTURUM HEMEN KAPATILIR ve genel hata döner
 *    (oturum açmak yetki vermez - ADR-0006).
 *  - Başarıda `redirect()` ile korumalı panele gidilir; oturum çerezi
 *    @supabase/ssr tarafından yazılır.
 */

const schema = z.object({
  email: z.string().email("Geçerli bir e-posta girin."),
  password: z.string().min(1, "Parola gerekli."),
  locale: z.string(),
  next: z.string().optional(),
});

export interface LoginState {
  error: string | null;
}

const GENERIC_ERROR = "Giriş bilgileri hatalı veya bu hesabın yönetici yetkisi yok.";

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Girdi doğrulaması başarısız." };
  }

  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : "en";

  // --- Hız sınırı (IP başına) ---
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";
  const rate = checkLoginRate(`login:${ip}`);
  if (!rate.allowed) {
    const minutes = Math.ceil(rate.retryAfterSeconds / 60);
    return { error: `Çok fazla başarısız deneme. ${minutes} dakika sonra tekrar deneyin.` };
  }

  // --- Kimlik doğrulama ---
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signInError) {
    return { error: GENERIC_ERROR };
  }

  // --- Yetki (allow-list) - kimlik doğrulaması yetmez ---
  const admin = await isAdmin().catch(() => false);
  if (!admin) {
    // Yetkisiz oturumu bırakma: hemen kapat.
    await supabase.auth.signOut();
    return { error: GENERIC_ERROR };
  }

  resetLoginRate(`login:${ip}`);

  // --- Başarı: korumalı panele yönlendir ---
  const dest =
    parsed.data.next && parsed.data.next.startsWith(`/${locale}/admin`)
      ? parsed.data.next
      : `/${locale}/admin/dashboard`;
  redirect(dest);
}

/** Oturumu kapatır ve giriş sayfasına döner. Locale gizli input'tan gelir. */
export async function signOutAction(formData: FormData): Promise<void> {
  const raw = formData.get("locale");
  const locale = typeof raw === "string" && isLocale(raw) ? raw : "en";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/admin/login`);
}
