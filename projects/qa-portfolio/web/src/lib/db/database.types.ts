/**
 * Supabase şema tiplerinin UYGULAMA GİRİŞ NOKTASI.
 *
 * İŞ KURALI: Uygulama kodu şema tiplerini DAİMA bu dosyadan alır
 * (`@/lib/db/database.types`), asla doğrudan üretilen dosyadan. Böylece
 * `supabase gen types` çıktısı yenilendiğinde (aşağıdaki komut) uygulamanın
 * kullandığı kısa takma adlar (DbLocale, ContentStatus, ...) bozulmaz.
 *
 * Üretilen dosya:  src/lib/db/database.generated.ts  (elle düzenlenmez)
 * Yeniden üretmek:
 *   npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" \
 *     > src/lib/db/database.generated.ts
 * (`--linked` yerine `--db-url` kullanılır; `--linked` bir Supabase access
 *  token'ı ister, çıktı aynıdır. Bkz. supabase/README.md.)
 */
export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "./database.generated";
export { Constants } from "./database.generated";

import type { Database } from "./database.generated";

// --- Kısa takma adlar: gerçek DB enum'larından TÜRETİLİR (elle yazılmaz) ---
// Bu adlar kod tabanında ~20 dosyada import edilir; şemadan türetildikleri için
// migration'la her zaman senkron kalırlar.

/** Desteklenen içerik dilleri (DB enum: locale). */
export type DbLocale = Database["public"]["Enums"]["locale"];

/** İçerik yaşam döngüsü durumu (DB enum: content_status). */
export type ContentStatus = Database["public"]["Enums"]["content_status"];

/** Proje sınıflandırması (DB enum: project_classification). */
export type ProjectClassification = Database["public"]["Enums"]["project_classification"];

/** Taksonomi terimi türü (DB enum: taxonomy_kind). */
export type TaxonomyKind = Database["public"]["Enums"]["taxonomy_kind"];
