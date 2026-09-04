import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

/**
 * ADMIN MUTASYON YETKİ SINIRLARI testi (planning/11 CF-03, planning/07 T-0702).
 *
 * Sıra: Authentication -> Authorization -> Validation -> Write -> Audit -> Revalidate.
 * Bağımlılıklar mock'lanır: is_admin, next/cache, server-only.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));

const isAdminMock = vi.fn<() => Promise<boolean>>();
vi.mock("@/lib/auth/is-admin", () => ({
  isAdmin: () => isAdminMock(),
  currentAdmin: async () => ({ userId: "u1", displayName: "Site Sahibi", role: "owner" }),
}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));

// Audit deposu: testte in-memory sahte (gerçek Supabase istemcisi kullanılmaz).
const auditEntries: { action: string; entityType: string; summary: string }[] = [];
vi.mock("./audit", () => ({
  getAuditRepository: () => ({
    record: async (e: { action: string; entityType: string; summary: string }) => {
      auditEntries.push(e);
    },
    list: async (n = 50) => [...auditEntries].reverse().slice(0, n),
  }),
}));

import { withAdminAction } from "./action";
import { getAuditRepository } from "./audit";

const schema = z.object({ title: z.string().min(3) });

function makeOpts(writeImpl?: () => Promise<{ id: string; summary: string; data: unknown }>) {
  return {
    action: "create" as const,
    entity: "project" as const,
    schema,
    write:
      writeImpl ??
      (async (input: { title: string }) => ({
        id: "new-1",
        summary: `oluşturuldu: ${input.title}`,
        data: { id: "new-1" },
      })),
  };
}

describe("withAdminAction", () => {
  beforeEach(() => {
    isAdminMock.mockReset();
    auditEntries.length = 0;
    delete process.env.AI_COMPANY_MOCK_ADMIN;
  });

  it("admin OLMAYAN kullanıcı için FORBIDDEN döner ve yazma yapılmaz", async () => {
    isAdminMock.mockResolvedValue(false);
    const write = vi.fn();
    const res = await withAdminAction(
      { title: "Geçerli başlık" },
      makeOpts(write as never),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("FORBIDDEN");
    expect(write).not.toHaveBeenCalled();
  });

  it("geçersiz girdi için VALIDATION döner (alan hatalarıyla)", async () => {
    isAdminMock.mockResolvedValue(true);
    const res = await withAdminAction({ title: "ab" }, makeOpts());
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("VALIDATION");
      expect(res.fieldErrors?.title).toBeTruthy();
    }
  });

  it("admin + geçerli girdi -> yazma + audit + başarı", async () => {
    isAdminMock.mockResolvedValue(true);
    const res = await withAdminAction({ title: "Yeni Proje" }, makeOpts());
    expect(res.ok).toBe(true);

    const audit = await getAuditRepository().list(5);
    expect(audit[0]?.action).toBe("create");
    expect(audit[0]?.entityType).toBe("project");
    expect(audit[0]?.summary).toContain("Yeni Proje");
  });

  it("yazma hatası -> WRITE_FAILED, audit YAZILMAZ", async () => {
    isAdminMock.mockResolvedValue(true);
    const before = (await getAuditRepository().list(100)).length;
    const res = await withAdminAction(
      { title: "Patlayan" },
      makeOpts(async () => {
        throw new Error("db down");
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("WRITE_FAILED");
    const after = (await getAuditRepository().list(100)).length;
    expect(after).toBe(before);
  });
});
