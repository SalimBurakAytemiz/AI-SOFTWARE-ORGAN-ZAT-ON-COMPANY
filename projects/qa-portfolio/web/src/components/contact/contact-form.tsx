"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { contactFormSchema } from "@/lib/validation/contact";
import type { DbLocale } from "@/lib/db/database.types";

/**
 * İletişim formu - istemci adası (planning/04 §4.7, planning/10 §10.8).
 *
 * GÜVENLİK:
 *   - İstemci tarafı doğrulama contactFormSchema ile yapılır; sunucu AYNI şemayla
 *     tekrar doğrular (tek tanım).
 *   - honeypot: görsel olarak gizli alan; bir bot doldurursa sunucu reddeder.
 *   - startedAt: form açılış zamanı; gönderim çok hızlıysa (bot) sunucu reddeder.
 *   - consent onay kutusu zorunlu (KVKK/GDPR).
 *
 * FAZ 1: /api/contact henüz e-posta göndermiyor; yapılandırılmamışsa 503 döner
 * ve kullanıcıya genel bir hata gösterilir (oracle sızıntısı yok).
 */
export function ContactForm({ locale }: { locale: DbLocale }) {
  const t = useTranslations("contact");
  const startedAt = useRef(Date.now());
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError(null);
    const form = new FormData(e.currentTarget);

    const parsed = contactFormSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      subject: form.get("subject") ?? "",
      message: form.get("message"),
      consent: form.get("consent") === "on",
      locale,
    });

    if (!parsed.success) {
      // Zod mesajları şemada sabit; kullanıcıya YEREL, genel bir mesaj gösterilir.
      // Alan bazlı ipuçları ayrıca native HTML doğrulamasıyla verilir.
      setFieldError(t("checkForm"));
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          honeypot: form.get("company_website") ?? "",
          elapsedMs: Date.now() - startedAt.current,
        }),
      });
      if (res.ok) {
        setStatus("success");
      } else if (res.status === 503) {
        // Faz 2: e-posta sağlayıcısı yok - net, yerel bilgi (oracle sızıntısı yok).
        setFieldError(t("notConfigured"));
        setStatus("idle");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p role="status" className="rounded-[var(--radius-md)] border border-[var(--pass)] bg-[var(--accent-muted)] p-4 text-sm text-[var(--text)]">
        {t("success")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t("name")} name="name" required autoComplete="name" />
      <Field label={t("email")} name="email" type="email" required autoComplete="email" />
      <Field label={t("subject")} name="subject" autoComplete="off" />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--text)]">{t("message")}</span>
        <textarea
          name="message"
          required
          rows={5}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        />
      </label>

      {/* honeypot - gerçek kullanıcı görmez, boş kalmalı */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>{t("consent")}</span>
      </label>

      {fieldError && (
        <p role="alert" className="text-sm text-[var(--fail)]">
          {fieldError}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-[var(--fail)]">
          {t("error")}
        </p>
      )}

      <Button type="submit" disabled={status === "sending"}>
        {t("send")}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[var(--text)]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
      />
    </label>
  );
}
