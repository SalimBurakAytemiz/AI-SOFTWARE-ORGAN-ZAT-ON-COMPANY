import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { validateUpload, buildStoragePath } from "@/lib/media/validate";

/**
 * ADMIN MEDYA REPOSITORY'Sİ (FAZ 4, planning/10 §10.6).
 *
 * GÜVENLİK:
 *  - authenticated istemci; Storage `media_admin_insert/update/delete`
 *    politikaları (`is_admin()`) her işlemi gate'ler. service-role KULLANILMAZ.
 *  - Sunucu tarafı magic-byte doğrulaması (`validateUpload`) - istemcinin
 *    bildirdiği türe güvenilmez.
 *  - Storage yolu sunucu üretir (`{uuid}/{uuid}.{ext}`); istemci dosya adı
 *    yola girmez.
 *  - `media` bucket public: public URL doğrudan üretilir (CDN).
 */

const BUCKET = "media";
type MediaRow = Database["public"]["Tables"]["media"]["Row"];

export interface MediaItem {
  id: string;
  bucket: string;
  storagePath: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  publicUrl: string;
}

function publicUrl(storagePath: string): string {
  const base = (env.NEXT_PUBLIC_SUPABASE_URL as string).replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

function toItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    bucket: row.bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    createdAt: row.created_at,
    publicUrl: publicUrl(row.storage_path),
  };
}

export class AdminMediaRepository {
  private readonly db: SupabaseClient<Database>;

  private constructor(client: SupabaseClient<Database>) {
    this.db = client;
  }

  static async create(client?: SupabaseClient<Database>): Promise<AdminMediaRepository> {
    return new AdminMediaRepository(client ?? (await createClient()));
  }

  async list(limit = 100): Promise<MediaItem[]> {
    const { data, error } = await this.db
      .from("media")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`media list: ${error.message}`);
    return (data as MediaRow[]).map(toItem);
  }

  /**
   * Bir dosyayı doğrular, güvenli yola yükler ve `media` tablosuna metadata
   * yazar. Dönüş: oluşturulan medya kaydı + public URL.
   */
  async upload(
    bytes: Uint8Array,
    declaredMime: string | undefined,
    altText: { tr: string; en: string },
  ): Promise<MediaItem> {
    const check = validateUpload(bytes, declaredMime);
    if (!check.ok) throw new Error(check.error);

    const assetId = randomUUID();
    const storagePath = buildStoragePath(assetId, check.ext);

    // 1) Storage'a yükle (RLS: media_admin_insert -> is_admin()).
    const { error: upErr } = await this.db.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: check.mime, upsert: false });
    if (upErr) throw new Error(`yükleme başarısız: ${upErr.message}`);

    // 2) media satırı (id = assetId ki yol ile eşleşsin).
    const { data, error: rowErr } = await this.db
      .from("media")
      .insert({
        id: assetId,
        bucket: BUCKET,
        storage_path: storagePath,
        mime_type: check.mime,
        byte_size: check.byteSize,
      })
      .select("*")
      .single();

    if (rowErr) {
      // Metadata yazılamadıysa yüklenen dosyayı geri al (yetim dosya bırakma).
      await this.db.storage.from(BUCKET).remove([storagePath]);
      throw new Error(`metadata yazımı başarısız: ${rowErr.message}`);
    }

    // 3) alt metin çevirileri (erişilebilirlik - planning/07 T-1206).
    const altRows: { media_id: string; locale: "tr" | "en"; alt_text: string }[] = [];
    if (altText.tr.trim()) altRows.push({ media_id: assetId, locale: "tr", alt_text: altText.tr.trim() });
    if (altText.en.trim()) altRows.push({ media_id: assetId, locale: "en", alt_text: altText.en.trim() });
    if (altRows.length > 0) {
      await this.db.from("media_translations").insert(altRows);
    }

    return toItem(data as MediaRow);
  }

  /** Bir medya varlığını siler: önce Storage nesnesi, sonra `media` satırı. */
  async delete(id: string): Promise<{ storagePath: string }> {
    const { data: row, error } = await this.db
      .from("media")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`media delete lookup: ${error.message}`);
    if (!row) throw new Error("Medya bulunamadı.");

    const storagePath = row.storage_path as string;
    // Storage silme (RLS: media_admin_delete -> is_admin()).
    const { error: rmErr } = await this.db.storage.from(BUCKET).remove([storagePath]);
    if (rmErr) throw new Error(`Storage silme başarısız: ${rmErr.message}`);

    // media satırı (media_translations ON DELETE CASCADE ile gider).
    const { error: rowErr } = await this.db.from("media").delete().eq("id", id);
    if (rowErr) throw new Error(`media satırı silinemedi: ${rowErr.message}`);

    return { storagePath };
  }
}
