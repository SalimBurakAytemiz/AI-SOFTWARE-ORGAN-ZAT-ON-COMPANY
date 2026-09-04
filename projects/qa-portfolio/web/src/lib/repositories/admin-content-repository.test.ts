import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    throw new Error("testte gerçek istemci kullanılmamalı");
  },
}));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" } }));

import { AdminContentRepository } from "./admin-content-repository";

type Row = Record<string, unknown>;

/** Zincirlenebilir sahte sorgu (RLS/filtre repository'nin JS tarafında test edilmez). */
function fakeQuery(rows: Row[]) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  for (const m of ["select", "eq", "neq", "order", "limit", "insert", "update", "upsert", "delete"]) {
    q[m] = chain;
  }
  q.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  q.single = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  q.then = (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null });
  return q;
}

function fakeClient(tableRows: Record<string, Row[]>): SupabaseClient<Database> {
  return { from: (t: string) => fakeQuery(tableRows[t] ?? []) } as unknown as SupabaseClient<Database>;
}

const projectRow: Row = {
  id: "p1",
  slug: "demo-x",
  classification: "professional",
  status: "draft",
  visible: true,
  featured: false,
  supported: false,
  display_order: 3,
  updated_at: "2026-01-01T00:00:00Z",
  company: "ACME",
  company_hidden: false,
  nda: false,
  start_date: "2024-01-01",
  end_date: null,
  is_ongoing: true,
  github_url: null,
  external_url: null,
  project_translations: [
    { locale: "tr", title: "Başlık TR", translation_status: "published", summary: "s", role_title: null, overview_md: null, testing_scope_md: null, test_strategy_md: null, test_coverage_md: null, challenges_md: null, impact_md: null, lessons_md: null, seo_title: null, seo_description: null },
    { locale: "en", title: "Title EN", translation_status: "draft", summary: "s", role_title: null, overview_md: null, testing_scope_md: null, test_strategy_md: null, test_coverage_md: null, challenges_md: null, impact_md: null, lessons_md: null, seo_title: null, seo_description: null },
  ],
};

describe("AdminContentRepository", () => {
  it("listProjects TÜM durumları döndürür ve TR/EN çeviri durumunu ayrı taşır", async () => {
    const repo = await AdminContentRepository.create(fakeClient({ projects: [projectRow] }));
    const [row] = await repo.listProjects();
    expect(row!.id).toBe("p1");
    expect(row!.status).toBe("draft"); // taslak da listede
    expect(row!.titleTr).toBe("Başlık TR");
    expect(row!.titleEn).toBe("Title EN");
    expect(row!.translationStatus).toEqual({ tr: "published", en: "draft" });
    expect(row!.demo).toBe(true);
  });

  it("getProject meta + iki dilin çevirisini döndürür (eksik dil null)", async () => {
    const oneLang: Row = { ...projectRow, project_translations: [(projectRow.project_translations as Row[])[0]] };
    const repo = await AdminContentRepository.create(fakeClient({ projects: [oneLang] }));
    const detail = await repo.getProject("p1");
    expect(detail).not.toBeNull();
    expect(detail!.meta.slug).toBe("demo-x");
    expect(detail!.meta.isOngoing).toBe(true);
    expect(detail!.translations.tr?.title).toBe("Başlık TR");
    expect(detail!.translations.en).toBeNull();
  });

  it("projectCounts status/flag dağılımını sayar", async () => {
    const rows: Row[] = [
      { status: "published", featured: true, supported: false, classification: "professional", visible: true },
      { status: "published", featured: false, supported: true, classification: "supported", visible: true },
      { status: "draft", featured: false, supported: false, classification: "qa_lab", visible: true },
      { status: "archived", featured: false, supported: false, classification: "personal", visible: true },
    ];
    const repo = await AdminContentRepository.create(fakeClient({ projects: rows }));
    const c = await repo.projectCounts();
    expect(c).toEqual({ published: 2, draft: 1, archived: 1, featured: 1, supported: 1, qaLab: 1 });
  });

  it("transitionProject RPC sonucunu döndürür", async () => {
    const db = {
      from: () => fakeQuery([]),
      rpc: vi.fn().mockResolvedValue({ data: [{ id: "p1", status: "published", visible: true }], error: null }),
    } as unknown as SupabaseClient<Database>;
    const repo = await AdminContentRepository.create(db);
    const out = await repo.transitionProject("p1", "publish", "Site Sahibi");
    expect(out).toEqual({ status: "published", visible: true });
  });

  it("transitionProject RPC hatasını Türkçe mesaja çevirir", async () => {
    const db = {
      from: () => fakeQuery([]),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "yetkisiz: yalnızca admin" } }),
    } as unknown as SupabaseClient<Database>;
    const repo = await AdminContentRepository.create(db);
    await expect(repo.transitionProject("p1", "publish", "x")).rejects.toThrow(/yönetici yetkisi/);
  });
});
