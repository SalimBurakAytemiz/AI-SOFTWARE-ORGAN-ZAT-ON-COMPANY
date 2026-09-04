import "server-only";

/**
 * ADMIN GİRİŞİ HIZ SINIRI (planning/10 §10.3, planning/14 review R12/RISK-040).
 *
 * İŞ KURALI: MFA kullanılmadığı için (ADR-0021) parola tahmin (brute-force)
 * saldırısına karşı ilk savunma hız sınırıdır: aynı IP'den kısa sürede çok
 * sayıda başarısız giriş denemesi engellenir.
 *
 * FAZ 4 SINIRI (bilinçli): bu depo TEK SÜREÇ belleğindedir. Tek örnekli bir
 * dağıtımda yeterlidir; yatay ölçeklemede paylaşımlı bir depo (ör. Postgres
 * tablosu / Upstash) gerekir - planning/14 "shared rate-limit store" ön-prod
 * maddesi. Geçiş için arayüz (`checkLoginRate`) sabit tutuldu.
 */
interface Attempt {
  count: number;
  /** Pencerenin başladığı zaman (ms). */
  windowStart: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 dakika
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, Attempt>();

export interface RateLimitResult {
  allowed: boolean;
  /** Kalan izinli deneme sayısı (bilgi amaçlı; kullanıcıya gösterilmez). */
  remaining: number;
  /** Sınır aşıldıysa kaç saniye sonra tekrar denenebilir. */
  retryAfterSeconds: number;
}

/**
 * Bir giriş DENEMESİ öncesinde çağrılır. Sınır aşılmadıysa sayaç artırılır.
 * Başarılı girişte `resetLoginRate(key)` çağrılarak sayaç sıfırlanmalıdır.
 */
export function checkLoginRate(key: string, now = Date.now()): RateLimitResult {
  const existing = attempts.get(key);

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((existing.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true, remaining: MAX_ATTEMPTS - existing.count, retryAfterSeconds: 0 };
}

/** Başarılı girişten sonra sayacı temizler. */
export function resetLoginRate(key: string): void {
  attempts.delete(key);
}

/** Test izolasyonu için tüm sayaçları temizler. */
export function _clearLoginRateStore(): void {
  attempts.clear();
}
