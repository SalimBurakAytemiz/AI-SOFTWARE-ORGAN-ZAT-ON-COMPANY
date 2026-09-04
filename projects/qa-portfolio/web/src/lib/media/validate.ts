/**
 * MEDYA YÜKLEME DOĞRULAMASI (planning/10 §10.6).
 *
 * İŞ KURALI: Sunucu OTORİTEDİR. İstemcinin bildirdiği `Content-Type`e güvenilmez;
 * dosyanın gerçek imzası (magic bytes) sunucuda kontrol edilir. İzinli türler
 * dışındaki her şey reddedilir. SVG varsayılan olarak YASAK (script taşıyabilir).
 *
 * Dosya adı / yol: istemcinin dosya adı ASLA yolda kullanılmaz; sunucu
 * deterministik ve güvenli bir yol üretir (`{uuid}/{uuid}.{ext}`).
 */

export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

/** Yapılandırılabilir üst sınır (planning/10 §10.6 önerisi: 5 MB). */
export const MAX_BYTES = 5 * 1024 * 1024;

const EXT_BY_MIME: Record<AllowedMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface MediaValidationOk {
  ok: true;
  mime: AllowedMime;
  ext: string;
  byteSize: number;
}
export interface MediaValidationError {
  ok: false;
  error: string;
}
export type MediaValidationResult = MediaValidationOk | MediaValidationError;

/** Baytların başındaki imzaya bakarak gerçek görüntü türünü çıkarır. */
export function sniffImageMime(bytes: Uint8Array): AllowedMime | null {
  const b = bytes;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  // WEBP: "RIFF"....(4 bayt boyut)...."WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  // AVIF: (4 bayt) "ftyp" (offset 4-7) + marka "avif"/"avis"/"mif1" (offset 8-11)
  if (
    b.length >= 12 &&
    b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70
  ) {
    const brand = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!);
    if (brand === "avif" || brand === "avis" || brand === "mif1") return "image/avif";
  }
  return null;
}

/**
 * Yükleme doğrulaması: boyut sınırı + magic-byte türü. İstemcinin bildirdiği
 * `declaredMime` yalnızca bilgi amaçlıdır; karar `sniffImageMime`e aittir.
 */
export function validateUpload(
  bytes: Uint8Array,
  declaredMime?: string,
): MediaValidationResult {
  if (bytes.length === 0) return { ok: false, error: "Dosya boş." };
  if (bytes.length > MAX_BYTES) {
    return { ok: false, error: `Dosya çok büyük (en fazla ${Math.round(MAX_BYTES / 1024 / 1024)} MB).` };
  }
  const mime = sniffImageMime(bytes);
  if (!mime) {
    return { ok: false, error: "Desteklenmeyen dosya türü. İzinli: PNG, JPEG, WebP, AVIF." };
  }
  if (declaredMime && declaredMime !== mime && !(declaredMime === "image/jpg" && mime === "image/jpeg")) {
    // Bildirilen tür ile gerçek tür uyuşmuyor -> güvenli tarafta reddet.
    return { ok: false, error: "Dosya içeriği bildirilen türle uyuşmuyor." };
  }
  return { ok: true, mime, ext: EXT_BY_MIME[mime], byteSize: bytes.length };
}

/** Deterministik, güvenli storage yolu üretir. İstemci dosya adı kullanılmaz. */
export function buildStoragePath(assetId: string, ext: string): string {
  // assetId zaten bir uuid; yol içinde yeniden kullanılır (klasör = varlık).
  return `${assetId}/${assetId}.${ext}`;
}
