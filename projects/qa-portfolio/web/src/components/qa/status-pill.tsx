import { cn } from "@/lib/utils/cn";

/**
 * Durum pili (PASS/FAIL/FLAKY vb.) - QA görsel dili (planning/06 §6.6).
 * Durum renk + METİN ile aktarılır; renk tek başına bilgi taşımaz (erişilebilirlik).
 */
type PillTone = "pass" | "fail" | "warn" | "info" | "neutral";

const tones: Record<PillTone, string> = {
  pass: "bg-[color-mix(in_srgb,var(--pass)_14%,transparent)] text-[var(--pass)]",
  fail: "bg-[color-mix(in_srgb,var(--fail)_14%,transparent)] text-[var(--fail)]",
  warn: "bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-[var(--warn)]",
  info: "bg-[color-mix(in_srgb,var(--info)_14%,transparent)] text-[var(--info)]",
  neutral: "bg-[var(--bg-subtle)] text-[var(--text-muted)]",
};

export function StatusPill({
  tone,
  children,
}: {
  tone: PillTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Bug önem derecesini pil tonuna eşler. */
export function severityTone(severity: string): PillTone {
  if (severity === "blocker" || severity === "critical") return "fail";
  if (severity === "major") return "warn";
  return "neutral";
}

/** Bug durumunu pil tonuna eşler. */
export function bugStateTone(state: string): PillTone {
  if (state === "fixed" || state === "by_design") return "pass";
  if (state === "open") return "fail";
  return "warn";
}

/** Senaryo önceliğini pil tonuna eşler. */
export function priorityTone(priority: string): PillTone {
  if (priority === "p0") return "fail";
  if (priority === "p1") return "warn";
  return "neutral";
}
