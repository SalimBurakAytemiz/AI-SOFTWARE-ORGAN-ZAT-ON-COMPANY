import { z } from "zod";

/**
 * Ortam değişkeni şeması ve doğrulaması.
 *
 * Amaç: eksik veya bozuk bir yapılandırmayı UYGULAMA AÇILIRKEN, net bir hata
 * mesajıyla yakalamak - yarı yapılandırılmış bir sistemle çalışmamak
 * (planning/07 T-0306, planning/12 RISK-082).
 *
 * Faz 1 notu: Supabase ve e-posta değişkenleri şu an OPSİYONEL. Uygulama
 * placeholder içerikle çalıştığı için bunlar boşken de derlenir/çalışır.
 * Faz 2'de Supabase bağlanınca ilgili alanlar zorunlu hale getirilecek.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  // Supabase'in güncel API anahtar modeli: istemciye gömülebilen anahtarın adı
  // "publishable key" (eski "anon key"in yerini alır). Gücü tamamen RLS ile
  // sınırlıdır, bu yüzden NEXT_PUBLIC_ önekiyle tarayıcıya gönderilmesi güvenlidir
  // (planning/10 §10.11).
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional().or(z.literal("")),
  // İÇERİK KAYNAĞI BAYRAĞI (kademeli geçiş kapısı).
  //
  // İŞ KURALI: "Supabase kimlik bilgisi mevcut" ile "public site içeriğini
  // Supabase'den servis et" AYRI kararlardır. Kimlik bilgileri .env.local'e
  // girildiğinde auth/middleware Supabase'i görür, AMA içerik repository'si
  // yalnızca bu bayrak açıkça "supabase" olduğunda gerçek sorgu katmanına
  // geçer. Faz 4 sorgu katmanı + migration + seed hazır olana kadar bayrak
  // "fixtures" kalır ve site placeholder içerikle çalışır (planning/07 T-0411).
  NEXT_PUBLIC_CONTENT_SOURCE: z.enum(["fixtures", "supabase"]).default("fixtures"),
});

const serverSchema = clientSchema.extend({
  // GİZLİ: yalnızca sunucuda okunur, asla istemci paketine girmez.
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  MAIL_PROVIDER_API_KEY: z.string().optional().or(z.literal("")),
  MAIL_TO_ADDRESS: z.string().email().optional().or(z.literal("")),
  REVALIDATE_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  CONTACT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  CONTACT_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
});

function parseEnv() {
  // Her ortamda serverSchema ile doğrulanır. İstemcide sunucu-yalnızca
  // değişkenler Next tarafından hiç sağlanmaz; hepsi opsiyonel olduğu için
  // doğrulama yine geçer ve o alanlar undefined kalır (istemci kodu okumaz).
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    // Hata mesajı yalnızca alan adlarını içerir; değerleri ASLA loglamayız
    // (bir değer secret olabilir - planning/10 §10.5).
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
    throw new Error(`Ortam değişkeni doğrulaması başarısız. Hatalı alan(lar): ${fields}`);
  }
  return parsed.data;
}

export const env = parseEnv();

/** Supabase için gerekli iki public değişken de dolu mu? (kimlik bilgisi kontrolü) */
export const isSupabaseConfigured =
  Boolean(env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/**
 * Public site içeriği hangi kaynaktan servis edilecek?
 *
 * "supabase" YALNIZCA hem bayrak açıkça "supabase" HEM DE kimlik bilgileri
 * mevcutsa döner; aksi halde "fixtures". Böylece yanlışlıkla açılan bir bayrak
 * (kimlik bilgisi yokken) siteyi bozamaz - güvenli varsayılan fixtures'tır.
 */
export const contentSource: "fixtures" | "supabase" =
  env.NEXT_PUBLIC_CONTENT_SOURCE === "supabase" && isSupabaseConfigured
    ? "supabase"
    : "fixtures";
