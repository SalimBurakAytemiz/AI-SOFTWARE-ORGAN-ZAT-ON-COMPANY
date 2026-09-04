import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ADMIN GİRİŞ SERVER ACTION testleri (planning/11 CF-03, planning/10 §10.3).
 *
 * Doğrulanan güvenlik kuralları:
 *  - Genel hata mesajı (kullanıcı sayımı sızmaz).
 *  - Kimlik doğrulaması başarılı + allow-list DIŞI -> oturum kapatılır, genel hata.
 *  - Kimlik doğrulaması başarılı + admin -> redirect (dashboard).
 *  - Hız sınırı: çok deneme -> engellenir.
 */
vi.mock("server-only", () => ({}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirectMock(u) }));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "203.0.113.9"]]),
}));

const signInWithPassword = vi.fn();
const signOut = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword, signOut } }),
}));

const isAdminMock = vi.fn<() => Promise<boolean>>();
vi.mock("@/lib/auth/is-admin", () => ({ isAdmin: () => isAdminMock() }));

import { signInAction } from "./actions";
import { _clearLoginRateStore } from "@/lib/auth/rate-limit";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const GENERIC = "Giriş bilgileri hatalı veya bu hesabın yönetici yetkisi yok.";

beforeEach(() => {
  _clearLoginRateStore();
  signInWithPassword.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
  isAdminMock.mockReset();
  redirectMock.mockClear();
});

describe("signInAction", () => {
  it("geçersiz e-posta -> doğrulama hatası, kimlik doğrulaması denenmez", async () => {
    const res = await signInAction({ error: null }, form({ email: "x", password: "p", locale: "tr" }));
    expect(res.error).toMatch(/e-posta/i);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("yanlış kimlik bilgisi -> GENEL hata (kullanıcı sayımı yok)", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const res = await signInAction(
      { error: null },
      form({ email: "a@b.com", password: "wrong", locale: "tr" }),
    );
    expect(res.error).toBe(GENERIC);
  });

  it("kimlik doğru ama admin DEĞİL -> oturum kapatılır + genel hata", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    isAdminMock.mockResolvedValue(false);
    const res = await signInAction(
      { error: null },
      form({ email: "user@b.com", password: "correct", locale: "tr" }),
    );
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(res.error).toBe(GENERIC);
  });

  it("kimlik doğru + admin -> dashboard'a redirect", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    isAdminMock.mockResolvedValue(true);
    await expect(
      signInAction({ error: null }, form({ email: "owner@b.com", password: "correct", locale: "tr" })),
    ).rejects.toThrow("REDIRECT:/tr/admin/dashboard");
  });

  it("güvenli 'next' parametresi korunur, güvensiz olan yok sayılır", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    isAdminMock.mockResolvedValue(true);
    await expect(
      signInAction(
        { error: null },
        form({ email: "o@b.com", password: "c", locale: "en", next: "https://evil.example" }),
      ),
    ).rejects.toThrow("REDIRECT:/en/admin/dashboard");
  });

  it("hız sınırı: 6. denemede engellenir", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    for (let i = 0; i < 5; i++) {
      await signInAction({ error: null }, form({ email: "a@b.com", password: "x", locale: "tr" }));
    }
    const res = await signInAction({ error: null }, form({ email: "a@b.com", password: "x", locale: "tr" }));
    expect(res.error).toMatch(/çok fazla/i);
  });
});
