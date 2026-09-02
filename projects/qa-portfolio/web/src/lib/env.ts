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
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
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

/** Supabase için gerekli iki public değişken de dolu mu? */
export const isSupabaseConfigured =
  Boolean(env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
