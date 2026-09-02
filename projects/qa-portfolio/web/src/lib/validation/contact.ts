import { z } from "zod";

/**
 * İletişim formu doğrulama şeması - HEM istemci HEM sunucu bu şemayı kullanır
 * (planning/07 T-0801, planning/10 §10.8). Tek tanım = form ve API aynı kuralı
 * uygular.
 *
 * İŞ / GÜVENLİK KURALLARI:
 *   - Zorunlu alanlar: ad, e-posta, mesaj, onay (consent).
 *   - Uzunluk sınırları: aşırı büyük gövde ve enjeksiyon denemelerini kısar.
 *   - honeypot: gizli alan; bir bot doldurursa istek sessizce reddedilir.
 *   - elapsedMs: form açılışından gönderime kadar geçen süre; 2 sn'den kısaysa
 *     bot kabul edilir.
 *   - consent zorunlu: KVKK/GDPR açık rıza (planning/10 §10.8).
 */
export const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Ad en az 2 karakter olmalı").max(120),
  email: z.string().trim().email("Geçerli bir e-posta girin").max(200),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Mesaj en az 10 karakter olmalı")
    .max(5000, "Mesaj en fazla 5000 karakter olabilir"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Devam etmek için gizlilik bildirimini kabul etmelisiniz" }),
  }),
  locale: z.enum(["tr", "en"]),
});

/** Sunucu tarafında ek olarak kontrol edilen bot koruması alanları. */
export const contactSubmissionSchema = contactFormSchema.extend({
  // Gizli alan - dolu gelirse bot. İstemcide görsel olarak gizlenir.
  honeypot: z.string().max(0).optional().or(z.literal("")),
  // Form render'ından gönderime kadar geçen milisaniye.
  elapsedMs: z.coerce.number().int().nonnegative(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;

/** Gönderimin bot olup olmadığına dair hızlı sezgisel kontrol (sunucuda). */
export function looksAutomated(input: Pick<ContactSubmission, "honeypot" | "elapsedMs">): boolean {
  if (input.honeypot && input.honeypot.length > 0) return true;
  if (input.elapsedMs < 2000) return true;
  return false;
}
