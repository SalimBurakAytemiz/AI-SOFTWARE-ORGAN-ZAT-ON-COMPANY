import { describe, it, expect, beforeEach } from "vitest";
import { MockAdminProjectStore, type AdminProject } from "./project-store";

/**
 * Yayın durumu davranışları - MOCK SEVİYESİNDE (kullanıcı isteği, planning/11
 * §11.5 yayın-durumu matrisi, CF-06/08/10/11/12/13).
 *
 * Supabase bağlandığında bu davranışlar RLS + transactional RPC ile de test
 * edilecek (RLS test matrisi - faz 3).
 */
function draftProject(over: Partial<AdminProject> = {}): AdminProject {
  return {
    id: "t1",
    slug: "t1",
    classification: "personal",
    status: "draft",
    visible: true,
    featured: false,
    displayOrder: 0,
    titleTr: "t",
    titleEn: "t",
    translationStatus: { tr: "draft", en: "draft" },
    updatedAt: "",
    demo: false,
    ...over,
  };
}

describe("MockAdminProjectStore - yayın kuralları", () => {
  let store: MockAdminProjectStore;
  beforeEach(() => {
    store = new MockAdminProjectStore([draftProject()]);
  });

  it("taslak proje public listede GÖRÜNMEZ (CF-06)", () => {
    expect(store.listPublic()).toHaveLength(0);
    expect(store.listAll()).toHaveLength(1);
  });

  it("publish -> public listede görünür (CF-08/09)", () => {
    store.transition("t1", "publish");
    expect(store.listPublic().map((p) => p.id)).toEqual(["t1"]);
  });

  it("hide (visible=false) -> yayınlanmış ama public'ten çıkar, admin'de kalır (CF-10)", () => {
    store.transition("t1", "publish");
    store.transition("t1", "hide");
    expect(store.listPublic()).toHaveLength(0);
    expect(store.getById("t1")?.status).toBe("published");
    expect(store.getById("t1")?.visible).toBe(false);
  });

  it("unpublish -> taslağa döner, public'ten çıkar (CF-11)", () => {
    store.transition("t1", "publish");
    store.transition("t1", "unpublish");
    expect(store.getById("t1")?.status).toBe("draft");
    expect(store.listPublic()).toHaveLength(0);
  });

  it("archive -> her yüzeyden çıkar, admin'de arşiv olarak kalır (CF-12)", () => {
    store.transition("t1", "publish");
    store.transition("t1", "archive");
    expect(store.getById("t1")?.status).toBe("archived");
    expect(store.listPublic()).toHaveLength(0);
    expect(store.listAll()).toHaveLength(1);
  });

  it("restore -> arşivden taslağa; sonra tekrar publish edilebilir (CF-13)", () => {
    store.transition("t1", "archive");
    store.transition("t1", "restore");
    expect(store.getById("t1")?.status).toBe("draft");
    store.transition("t1", "publish");
    expect(store.listPublic()).toHaveLength(1);
  });

  it("geçersiz geçiş hata verir (yarım durum yok)", () => {
    expect(() => store.transition("t1", "unpublish")).toThrow(); // taslak yayından kaldırılamaz
    store.transition("t1", "archive");
    expect(() => store.transition("t1", "publish")).toThrow(); // arşiv doğrudan yayınlanamaz
  });

  it("aynı slug ile ikinci proje oluşturulamaz", () => {
    expect(() =>
      store.create({ slug: "t1", classification: "personal", titleTr: "x", titleEn: "x" }),
    ).toThrow();
  });

  it("create -> her zaman taslak başlar", () => {
    const p = store.create({ slug: "yeni", classification: "professional", titleTr: "y", titleEn: "y" });
    expect(p.status).toBe("draft");
    expect(store.listPublic()).toHaveLength(0);
  });
});
