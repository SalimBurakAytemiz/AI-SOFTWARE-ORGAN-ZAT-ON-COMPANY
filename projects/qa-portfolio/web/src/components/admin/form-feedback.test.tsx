import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormMessage } from "./form-fields";

/**
 * REGRESYON (bug: B2 smoke testi — "Taslak kaydet" başarılı oldu ama kullanıcı
 * hiçbir geri bildirim görmedi).
 *
 * Kural: FormMessage başarı/hata içeriğini GÖRÜNÜR şekilde render eder ve ekran
 * okuyuculara `aria-live` ile duyurur. Uzun formlarda butonların yanına konur.
 */

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

describe("FormMessage", () => {
  it("başarı mesajını (notice) role=status + aria-live=polite ile gösterir", () => {
    render(<FormMessage notice="Türkçe içerik taslak olarak kaydedildi." />);
    const el = screen.getByRole("status");
    expect(el.textContent).toBe("Türkçe içerik taslak olarak kaydedildi.");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });

  it("hata mesajını role=alert + aria-live=assertive ile gösterir", () => {
    render(<FormMessage error="Taslak kaydedilemedi. Lütfen tekrar deneyin." />);
    const el = screen.getByRole("alert");
    expect(el.textContent).toBe("Taslak kaydedilemedi. Lütfen tekrar deneyin.");
    expect(el.getAttribute("aria-live")).toBe("assertive");
  });

  it("içerik yoksa hiçbir şey render etmez", () => {
    const { container } = render(<FormMessage />);
    expect(container.firstChild).toBeNull();
  });

  it("hem error hem notice verilirse error öncelikli", () => {
    render(<FormMessage error="hata" notice="başarı" />);
    expect(screen.getByRole("alert").textContent).toBe("hata");
    expect(screen.queryByText("başarı")).toBeNull();
  });
});
