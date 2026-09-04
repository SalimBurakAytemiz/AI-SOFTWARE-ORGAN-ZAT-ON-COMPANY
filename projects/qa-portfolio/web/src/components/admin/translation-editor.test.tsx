import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * REGRESYON (bug: B2 smoke — "Taslak kaydet" başarılı oldu ama görünür bir
 * başarı mesajı yoktu). Editör, işlem sonucunu BUTONLARIN YANINDA görünür
 * kılmalı.
 */

// Server action modülü sunucu-yalnızca bağımlılıklar çeker; mock'la.
vi.mock("@/app/[locale]/admin/(protected)/projects/actions", () => ({
  saveTranslationAction: vi.fn(),
}));

// useActionState'i kontrol edilebilir bir durumla değiştir (başarı senaryosu).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [
      { ok: true, error: null, notice: "Türkçe içerik taslak olarak kaydedildi." },
      vi.fn(),
      false,
    ],
  };
});

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

import { TranslationEditor } from "./translation-editor";

describe("TranslationEditor - kayıt geri bildirimi", () => {
  it("başarılı kayıtta görünür başarı mesajını butonların yanında gösterir", () => {
    render(<TranslationEditor projectId="p1" locale="tr" value={null} />);

    const message = screen.getByRole("status");
    expect(message.textContent).toBe("Türkçe içerik taslak olarak kaydedildi.");

    const draftBtn = screen.getByRole("button", { name: "Taslak kaydet" });
    const publishBtn = screen.getByRole("button", { name: "Bu dili yayınla" });
    expect(draftBtn).toBeDefined();
    expect(publishBtn).toBeDefined();

    // Mesaj, buton grubundan hemen ÖNCE gelmeli (kullanıcının bakış alanında).
    const buttonRow = draftBtn.parentElement!;
    expect(
      Boolean(message.compareDocumentPosition(buttonRow) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });
});
