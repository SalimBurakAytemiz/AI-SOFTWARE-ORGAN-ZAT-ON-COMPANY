import type { ContentStatus, ProjectClassification } from "@/lib/db/database.types";
import { isPubliclyVisible } from "@/lib/content/publication";

/**
 * ADMIN PROJE DEPOSU - FAZ 2 IN-MEMORY MOCK (kalıcı değil).
 *
 * Amaç: Supabase bağlanmadan önce yayın iş kurallarını (Draft / Published /
 * Hidden / Archived) ve yetki sınırlarını MOCK SEVİYESİNDE test edebilmek
 * (kullanıcı isteği: "Draft / Published / Hidden davranışları mock seviyesinde").
 *
 * Faz 3: bu sınıf, aynı arayüzü koruyarak SupabaseAdminProjectRepository ile
 * değiştirilecek; yazma işlemleri `projects` tablosuna gidecek ve yayın durumu
 * RLS + transactional RPC ile zorlanacak (planning/14 review R7).
 *
 * İŞ KURALI (planning/02 §2.8):
 *   draft --publish--> published --unpublish--> draft
 *         <--restore--          --archive-----> archived --restore--> draft
 *   published --hide (visible=false)--> published/hidden --show--> published
 *   Public görünürlük = status='published' AND visible=true (tek kural).
 */
export interface AdminProject {
  id: string;
  slug: string;
  classification: ProjectClassification;
  status: ContentStatus;
  visible: boolean;
  featured: boolean;
  displayOrder: number;
  titleTr: string;
  titleEn: string;
  translationStatus: { tr: ContentStatus; en: ContentStatus };
  updatedAt: string;
  demo: boolean;
}

export type ProjectTransition = "publish" | "unpublish" | "hide" | "show" | "archive" | "restore";

function seed(): AdminProject[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-1",
      slug: "demo-checkout-regression-suite",
      classification: "professional",
      status: "published",
      visible: true,
      featured: true,
      displayOrder: 1,
      titleTr: "DEMO — Ödeme (checkout) regresyon paketi",
      titleEn: "DEMO — Checkout regression suite",
      translationStatus: { tr: "published", en: "published" },
      updatedAt: now,
      demo: true,
    },
    {
      id: "demo-2",
      slug: "demo-public-api-contract-testing",
      classification: "supported",
      status: "published",
      visible: true,
      featured: true,
      displayOrder: 2,
      titleTr: "DEMO — Public API sözleşme ve yük testi",
      titleEn: "DEMO — Public API contract and load testing",
      translationStatus: { tr: "published", en: "published" },
      updatedAt: now,
      demo: true,
    },
    {
      id: "ph-1",
      slug: "placeholder-personal-project",
      classification: "personal",
      status: "draft",
      visible: true,
      featured: false,
      displayOrder: 10,
      titleTr: "[PLACEHOLDER: Kişisel proje]",
      titleEn: "[PLACEHOLDER: Personal project]",
      translationStatus: { tr: "draft", en: "draft" },
      updatedAt: now,
      demo: false,
    },
  ];
}

export class MockAdminProjectStore {
  private projects: AdminProject[];

  constructor(initial?: AdminProject[]) {
    this.projects = initial ?? seed();
  }

  /** Admin listesi: TÜM durumlar (draft/published/archived) görünür. */
  listAll(): AdminProject[] {
    return [...this.projects].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /** Public listesi: yalnızca yayınlanmış ve görünür (tek kural). */
  listPublic(): AdminProject[] {
    return this.listAll().filter((p) => isPubliclyVisible(p));
  }

  getById(id: string): AdminProject | undefined {
    return this.projects.find((p) => p.id === id);
  }

  create(input: Pick<AdminProject, "slug" | "classification" | "titleTr" | "titleEn">): AdminProject {
    if (this.projects.some((p) => p.slug === input.slug)) {
      throw new Error(`Bu slug zaten kullanımda: ${input.slug}`);
    }
    const project: AdminProject = {
      id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      slug: input.slug,
      classification: input.classification,
      status: "draft",
      visible: true,
      featured: false,
      displayOrder: this.projects.length + 100,
      titleTr: input.titleTr,
      titleEn: input.titleEn,
      translationStatus: { tr: "draft", en: "draft" },
      updatedAt: new Date().toISOString(),
      demo: false,
    };
    this.projects.push(project);
    return project;
  }

  /**
   * Yayın durumu geçişi. Geçerli olmayan geçiş bir hata fırlatır
   * (yarım durum oluşmaz).
   */
  transition(id: string, t: ProjectTransition): AdminProject {
    const p = this.getById(id);
    if (!p) throw new Error(`Proje bulunamadı: ${id}`);

    switch (t) {
      case "publish":
        if (p.status === "archived") throw new Error("Arşivlenmiş proje doğrudan yayınlanamaz; önce geri yükleyin.");
        p.status = "published";
        p.visible = true;
        break;
      case "unpublish":
        if (p.status !== "published") throw new Error("Yalnızca yayınlanmış proje yayından kaldırılabilir.");
        p.status = "draft";
        break;
      case "hide":
        if (p.status !== "published") throw new Error("Yalnızca yayınlanmış proje gizlenebilir.");
        p.visible = false;
        break;
      case "show":
        p.visible = true;
        break;
      case "archive":
        p.status = "archived";
        break;
      case "restore":
        if (p.status !== "archived") throw new Error("Yalnızca arşivlenmiş proje geri yüklenebilir.");
        p.status = "draft";
        break;
    }
    p.updatedAt = new Date().toISOString();
    return p;
  }

  setFeatured(id: string, featured: boolean): AdminProject {
    const p = this.getById(id);
    if (!p) throw new Error(`Proje bulunamadı: ${id}`);
    p.featured = featured;
    p.updatedAt = new Date().toISOString();
    return p;
  }

  reorder(orderedIds: string[]): void {
    orderedIds.forEach((id, index) => {
      const p = this.getById(id);
      if (p) p.displayOrder = index;
    });
  }
}

// Faz 2 tek süreç singleton'ı (mock).
let store: MockAdminProjectStore | null = null;
export function getMockAdminProjectStore(): MockAdminProjectStore {
  if (!store) store = new MockAdminProjectStore();
  return store;
}
