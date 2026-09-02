import { describe, it, expect } from "vitest";
import { contactFormSchema, contactSubmissionSchema, looksAutomated } from "./contact";

// İletişim formu doğrulama ve bot koruması testleri (planning/11 CF-21/CF-22).
const valid = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Sürüm öncesi test desteği",
  message: "Merhaba, yaklaşan sürümümüz için regresyon desteği arıyoruz.",
  consent: true as const,
  locale: "tr" as const,
};

describe("contactFormSchema", () => {
  it("geçerli gönderimi kabul eder", () => {
    expect(contactFormSchema.safeParse(valid).success).toBe(true);
  });

  it("onay (consent) verilmemişse reddeder", () => {
    const r = contactFormSchema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
  });

  it("geçersiz e-postayı reddeder", () => {
    expect(contactFormSchema.safeParse({ ...valid, email: "bozuk" }).success).toBe(false);
  });

  it("çok kısa mesajı reddeder", () => {
    expect(contactFormSchema.safeParse({ ...valid, message: "kısa" }).success).toBe(false);
  });

  it("aşırı uzun gövdeyi reddeder", () => {
    expect(contactFormSchema.safeParse({ ...valid, message: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("looksAutomated (bot koruması)", () => {
  it("honeypot doluysa bot kabul eder", () => {
    expect(looksAutomated({ honeypot: "http://spam", elapsedMs: 9000 })).toBe(true);
  });

  it("2 saniyeden hızlı gönderimi bot kabul eder", () => {
    expect(looksAutomated({ honeypot: "", elapsedMs: 800 })).toBe(true);
  });

  it("normal, insan hızında gönderimi bot saymaz", () => {
    expect(looksAutomated({ honeypot: "", elapsedMs: 15000 })).toBe(false);
  });
});

describe("contactSubmissionSchema", () => {
  it("honeypot + elapsedMs alanlarını doğrular", () => {
    const r = contactSubmissionSchema.safeParse({ ...valid, honeypot: "", elapsedMs: 12000 });
    expect(r.success).toBe(true);
  });
});
