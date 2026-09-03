import { SafeMarkdown } from "@/components/content/safe-markdown";
import { StatusPill, priorityTone } from "./status-pill";
import type { TestScenario } from "@/lib/domain/project";

/**
 * Test senaryosu tablosu - QA görsel dili (planning/04 §4.3, planning/06 §6.9).
 *
 * Native <details>/<summary> kullanır: JavaScript gerektirmez, klavye ile
 * çalışır, ekran okuyucularda genişlet/daralt bildirir (erişilebilirlik).
 * Boş liste -> hiç render edilmez (planning/09 T-0903).
 */
export function ScenarioTable({
  scenarios,
  labels,
}: {
  scenarios: TestScenario[];
  labels: {
    preconditions: string;
    steps: string;
    expected: string;
    notes: string;
    automated: string;
  };
}) {
  if (scenarios.length === 0) return null;

  return (
    <div className="my-4 divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
      {scenarios.map((s) => (
        <details key={s.code} className="group bg-[var(--surface)] open:bg-[var(--surface-raised)]">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
            <span className="font-mono text-xs text-[var(--text-faint)]">{s.code}</span>
            <StatusPill tone={priorityTone(s.priority)}>{s.priority}</StatusPill>
            <span className="font-mono text-[11px] uppercase text-[var(--text-muted)]">{s.kind}</span>
            {s.automated && (
              <StatusPill tone="info">{labels.automated}</StatusPill>
            )}
            <span className="flex-1 text-sm text-[var(--text)]">{s.title}</span>
            <span className="text-[var(--text-faint)] transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="space-y-3 px-3 pb-4 pl-11">
            {s.preconditionsMd && (
              <Field label={labels.preconditions} md={s.preconditionsMd} />
            )}
            <Field label={labels.steps} md={s.stepsMd} />
            <Field label={labels.expected} md={s.expectedMd} />
            {s.notesMd && <Field label={labels.notes} md={s.notesMd} />}
          </div>
        </details>
      ))}
    </div>
  );
}

function Field({ label, md }: { label: string; md: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <SafeMarkdown className="text-sm">{md}</SafeMarkdown>
    </div>
  );
}
