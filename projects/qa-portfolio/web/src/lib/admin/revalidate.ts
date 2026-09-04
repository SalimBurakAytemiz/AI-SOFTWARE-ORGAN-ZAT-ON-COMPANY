import { revalidateTag, revalidatePath } from "next/cache";

/**
 * İÇERİK YENİDEN DOĞRULAMA (revalidation) YARDIMCISI (planning/01 §1.5,
 * planning/14 review R19).
 *
 * İŞ KURALI: her başarılı admin yazma işleminden sonra çağrılır. "Yayınladım
 * ama site değişmedi" hatasının önüne geçmek için, etkilenen tüm public
 * yüzeyleri (liste + detay + sitemap) tek yerden tetikler.
 *
 * Etiket haritası test edilebilir: "her mutasyon doğru etiketleri
 * geçersiz kılıyor mu?" testi TAG_MAP üzerinden döner (planning/14 R19).
 */
export type ContentEntity =
  | "project"
  | "qa_lab"
  | "experience"
  | "skills"
  | "services"
  | "education"
  | "certifications"
  | "profile"
  | "settings"
  | "media";

/** Bir varlık türü değiştiğinde geçersiz kılınacak etiketler. */
export const TAG_MAP: Record<ContentEntity, string[]> = {
  project: ["projects", "qa-lab", "sitemap", "home"],
  qa_lab: ["projects", "qa-lab", "sitemap", "home"],
  experience: ["experience"],
  skills: ["skills"],
  services: ["services", "sitemap"],
  education: ["education"],
  certifications: ["certifications"],
  profile: ["profile", "home"],
  settings: ["settings", "home", "sitemap"],
  media: ["media"],
};

/** Bir varlığın (opsiyonel id ile) public görünümünü tazeler. */
export function revalidateContent(entity: ContentEntity, id?: string): void {
  for (const tag of TAG_MAP[entity]) {
    revalidateTag(tag);
  }
  if (entity === "project" && id) {
    revalidateTag(`project:${id}`);
  }
  // Liste + detay + QA Lab + ana sayfa her iki dilde de tazelenir.
  if (entity === "project" || entity === "qa_lab") {
    revalidatePath("/[locale]/projects", "page");
    revalidatePath("/[locale]/projects/[slug]", "page");
    revalidatePath("/[locale]/qa-lab", "page");
    revalidatePath("/[locale]", "page");
  }
}
