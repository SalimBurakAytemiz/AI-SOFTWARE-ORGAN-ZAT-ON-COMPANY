"use client";

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

export function FormMessage({ error, notice }: { error?: string | null; notice?: string }) {
  if (error) {
    return (
      <p role="alert" className="my-2 rounded-[var(--radius-md)] border border-[var(--fail)] bg-[color-mix(in_srgb,var(--fail)_10%,transparent)] px-3 py-2 text-sm">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p className="my-2 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2 text-sm">
        {notice}
      </p>
    );
  }
  return null;
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
