import { describe, it, expect } from "vitest";
import { sniffImageMime, validateUpload, buildStoragePath, MAX_BYTES } from "./validate";

/**
 * MEDYA DOĞRULAMA testleri (planning/10 §10.6).
 * Kritik güvenlik kuralı: karar magic-byte'a göre; bildirilen Content-Type'a
 * güvenilmez; SVG / bilinmeyen tür reddedilir.
 */

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const avif = new Uint8Array([
  0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
]);
const svg = new Uint8Array([...Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);

describe("sniffImageMime", () => {
  it("gerçek imzalardan türü çıkarır", () => {
    expect(sniffImageMime(png)).toBe("image/png");
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    expect(sniffImageMime(webp)).toBe("image/webp");
    expect(sniffImageMime(avif)).toBe("image/avif");
  });

  it("SVG, GIF ve bilinmeyeni reddeder (null)", () => {
    expect(sniffImageMime(svg)).toBeNull();
    expect(sniffImageMime(gif)).toBeNull();
    expect(sniffImageMime(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("validateUpload", () => {
  it("geçerli PNG'i kabul eder", () => {
    const r = validateUpload(png, "image/png");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ext).toBe("png");
  });

  it("bildirilen tür gerçek türle uyuşmazsa reddeder (content sniffing)", () => {
    // PNG baytları ama istemci 'image/jpeg' diyor -> reddet.
    const r = validateUpload(png, "image/jpeg");
    expect(r.ok).toBe(false);
  });

  it("image/jpg (yaygın yanlış) image/jpeg ile eşleşir", () => {
    expect(validateUpload(jpeg, "image/jpg").ok).toBe(true);
  });

  it("boş dosyayı reddeder", () => {
    expect(validateUpload(new Uint8Array(), "image/png").ok).toBe(false);
  });

  it("boyut sınırını aşan dosyayı reddeder", () => {
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set(png, 0);
    expect(validateUpload(big, "image/png").ok).toBe(false);
  });

  it("SVG'yi reddeder (script vektörü)", () => {
    expect(validateUpload(svg, "image/svg+xml").ok).toBe(false);
  });
});

describe("buildStoragePath", () => {
  it("deterministik, istemci dosya adından bağımsız yol üretir", () => {
    expect(buildStoragePath("abc-123", "webp")).toBe("abc-123/abc-123.webp");
  });
});
