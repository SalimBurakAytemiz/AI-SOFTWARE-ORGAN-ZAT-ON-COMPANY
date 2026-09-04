import { createClient } from "@/lib/supabase/server";

/**
 * Mevcut oturumun bir ADMIN oturumu olup olmadığını doğrular.
 *
 * İŞ KURALI (planning/10 §10.3, ADR-0006):
 *   Kimlik doğrulama (authentication) ile yetkilendirme (authorization) AYRIDIR.
 *   Bir kullanıcının oturum açmış olması admin olduğu anlamına GELMEZ.
 *   Yetki, yalnızca kullanıcının auth.uid()'sinin `admin_users` tablosunda
 *   (allow-list) bir satırı olmasıyla verilir.
 *
 * Bu kontrol üç yerde uygulanır: burada (uygulama katmanı), admin layout'ta
 * ve veritabanında RLS politikalarında (is_admin() SQL fonksiyonu). Herhangi
 * biri tek başına güvenlik sınırı değildir; birlikte katmanlı savunma sağlar.
 *
 * Faz 2: `admin_users` tablosu ve is_admin() RPC'si migration ile gelecek;
 * o zaman buradaki sorgu gerçek tabloya bağlanacak. Supabase yapılandırılmamışsa
 * (faz 1) güvenli varsayılan: false (kimse admin değil).
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  // Faz 2'de: select 1 from admin_users where user_id = auth.uid()
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    // Tablo henüz yoksa ya da erişim reddedildiyse: güvenli tarafta kal.
    return false;
  }
  return data !== null;
}

export interface CurrentAdmin {
  userId: string;
  displayName: string;
  role: "owner" | "editor";
}

/**
 * Mevcut admin oturumunun kimliğini (audit `actor` alanları için) döndürür;
 * admin değilse null. `admin_users` RLS'i yalnızca admin'e okuma verir, bu yüzden
 * kendi satırını okuyabilen zaten admindir.
 */
export async function currentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id, display_name, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return { userId: data.user_id, displayName: data.display_name, role: data.role };
}
