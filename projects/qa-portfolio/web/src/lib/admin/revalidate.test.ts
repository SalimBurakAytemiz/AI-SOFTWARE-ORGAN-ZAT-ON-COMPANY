import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "Her mutasyon doğru etiketleri geçersiz kılıyor mu?" testi (planning/14 R19).
 * next/cache mock'lanır; hangi etiketlerin çağrıldığı doğrulanır.
 */
const revalidateTag = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (t: string) => revalidateTag(t),
  revalidatePath: (p: string, type?: string) => revalidatePath(p, type),
}));

import { revalidateContent, TAG_MAP } from "./revalidate";

describe("revalidateContent - etiket haritası", () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    revalidatePath.mockClear();
  });

  it("her varlık türü için haritadaki tüm etiketleri tazeler", () => {
    for (const [entity, tags] of Object.entries(TAG_MAP)) {
      revalidateTag.mockClear();
      revalidateContent(entity as keyof typeof TAG_MAP);
      const called = revalidateTag.mock.calls.map((c) => c[0]);
      for (const tag of tags) {
        expect(called).toContain(tag);
      }
    }
  });

  it("proje id verildiğinde proje-özel etiketi de tazeler", () => {
    revalidateContent("project", "abc-123");
    const called = revalidateTag.mock.calls.map((c) => c[0]);
    expect(called).toContain("projects");
    expect(called).toContain("sitemap");
    expect(called).toContain("project:abc-123");
  });

  it("proje değişikliğinde liste yolu da tazelenir", () => {
    revalidateContent("project", "abc-123");
    expect(revalidatePath).toHaveBeenCalledWith("/[locale]/projects", "page");
  });
});
