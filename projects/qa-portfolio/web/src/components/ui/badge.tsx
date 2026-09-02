import { cn } from "@/lib/utils/cn";

/**
 * Rozet / etiket (planning/06 §6.6). Sınıflandırma rozetleri ve NDA rozeti
 * için kullanılır. Durum yalnızca renkle değil metinle de aktarılır
 * (erişilebilirlik - planning/16, planning/06 §6.3 anlamsal renk).
 */
type Tone = "neutral" | "accent" | "info" | "warn" | "fail";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border)]",
  accent: "bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]",
  info: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)] border-[var(--info)]",
  warn: "bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-[var(--warn)] border-[var(--warn)]",
  fail: "bg-[color-mix(in_srgb,var(--fail)_12%,transparent)] text-[var(--fail)] border-[var(--fail)]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5",
        "font-mono text-[11px] font-medium uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
