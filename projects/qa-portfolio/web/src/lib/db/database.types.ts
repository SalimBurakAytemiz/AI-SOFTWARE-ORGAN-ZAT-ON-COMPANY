/**
 * Supabase şemasından üretilen TypeScript tipleri buraya gelecek.
 *
 * Faz 2'de gerçek bir Supabase projesi açıldığında:
 *   npx supabase gen types typescript --project-id <id> > src/lib/db/database.types.ts
 * komutu bu dosyayı gerçek şemadan üretir (planning/07 T-0411). O noktada
 * aşağıdaki gevşek (permissive) iskelet TAM tiplerle değiştirilecek ve sorgu
 * katmanı derleme zamanında şemaya bağlanacak.
 *
 * Şu an amaç: Supabase istemcisi ve sorgu yardımcıları TİP HATASI vermeden
 * derlensin. Şema tanımı: planning/02-database-schema.md ve supabase/migrations/*.
 */

/** Desteklenen içerik dilleri (DB enum: locale). */
export type DbLocale = "tr" | "en";

/** İçerik yaşam döngüsü durumu (DB enum: content_status). */
export type ContentStatus = "draft" | "published" | "archived";

/** Proje sınıflandırması (DB enum: project_classification). */
export type ProjectClassification = "professional" | "supported" | "personal" | "qa_lab";

/** Taksonomi terimi türü (DB enum: taxonomy_kind). */
export type TaxonomyKind = "platform" | "tool" | "test_type" | "industry";

/** Faz 1 için gevşek satır tipi; faz 2'de tablo başına gerçek tiplerle değişir. */
type LooseRow = Record<string, unknown>;

interface LooseTable {
  Row: LooseRow;
  Insert: LooseRow;
  Update: LooseRow;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      // Faz 2'de her tablo tek tek ve gerçek kolon tipleriyle tanımlanacak.
      [table: string]: LooseTable;
    };
    Views: { [view: string]: LooseTable };
    Functions: { [fn: string]: { Args: Record<string, unknown>; Returns: unknown } };
    Enums: {
      locale: DbLocale;
      content_status: ContentStatus;
      project_classification: ProjectClassification;
      taxonomy_kind: TaxonomyKind;
    };
    CompositeTypes: Record<string, never>;
  };
}
