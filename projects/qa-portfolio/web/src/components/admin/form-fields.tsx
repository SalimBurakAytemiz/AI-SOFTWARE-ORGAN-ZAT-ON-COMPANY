"use client";

import { useEffect, useRef } from "react";

/**
 * ADMIN FORM ALANLARI - küçük, paylaşılan girdi bileşenleri.
 * Tasarım: sade; CMS Türkçe arayüzü (planning/05).
 */

export function Field({
  label,
  name,
  children,
  hint,
  errors,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  hint?: string;
  errors?: string[];
}) {
  return (
    <div className="mb-3">
      <label htmlFor={name} className="block text-sm font-medium text-[var(--text)]">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-0.5 text-xs text-[var(--text-faint)]">{hint}</p> : null}
      {errors?.length ? (
        <p className="mt-0.5 text-xs text-[var(--fail)]">{errors.join(" · ")}</p>
      ) : null}
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-24 font-mono text-xs`} />;
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={inputCls}>
      {children}
    </select>
  );
}

export function Checkbox({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="mb-2 flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}

/**
 * Form geri bildirimi (başarı / hata).
 *
 * İŞ KURALI (UX): Kullanıcı bir kaydetme işleminin sonucunu TAHMİN ETMEK
 * ZORUNDA KALMAMALI. Uzun formlarda buton ile mesaj arasındaki mesafe sorun
 * olduğu için, mesaj göründüğünde kendini görünür alana KAYDIRIR
 * (scrollIntoView) ve `aria-live` ile ekran okuyuculara duyurur. Mesaj ayrıca
 * form içinde butonların YANINA yerleştirilir.
 */
export function FormMessage({ error, notice }: { error?: string | null; notice?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const content = error || notice || null;

  useEffect(() => {
    // scrollIntoView test ortamında (jsdom) tanımlı olmayabilir.
    if (content && typeof ref.current?.scrollIntoView === "function") {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [content]);

  if (!content) return null;

  const cls = error
    ? "border-[var(--fail)] bg-[color-mix(in_srgb,var(--fail)_12%,transparent)]"
    : "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]";

  return (
    <p
      ref={ref}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      className={`my-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium ${cls}`}
    >
      {content}
    </p>
  );
}

export function SubmitButton({
  children,
  pending,
  name,
  value,
  variant = "primary",
}: {
  children: React.ReactNode;
  pending: boolean;
  name?: string;
  value?: string;
  variant?: "primary" | "secondary";
}) {
  const base = "rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium disabled:opacity-60";
  const cls =
    variant === "primary"
      ? `${base} bg-[var(--text)] text-[var(--bg)]`
      : `${base} border border-[var(--border)] text-[var(--text)]`;
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={cls}>
      {pending ? "Kaydediliyor…" : children}
    </button>
  );
}
