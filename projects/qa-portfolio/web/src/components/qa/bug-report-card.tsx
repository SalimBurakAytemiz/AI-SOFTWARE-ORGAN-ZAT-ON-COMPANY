import { SafeMarkdown } from "@/components/content/safe-markdown";
import { StatusPill, severityTone, bugStateTone } from "./status-pill";
import type { BugReport } from "@/lib/domain/project";

/**
 * Bug raporu kartı - QA görsel dili (planning/04 §4.3, planning/06 §6.6).
 *
 * Sol kenarda önem derecesine göre renkli şerit (severity rail). Yalnızca dolu
 * alanlar gösterilir (planning/09 T-0903).
 */
const RAIL: Record<string, string> = {
  blocker: "border-l-[var(--fail)]",
  critical: "border-l-[var(--fail)]",
  major: "border-l-[var(--warn)]",
  minor: "border-l-[var(--border-strong)]",
  trivial: "border-l-[var(--border-strong)]",
};

export function BugReportCard({
  bug,
  labels,
}: {
  bug: BugReport;
  labels: {
    steps: string;
    expected: string;
    actual: string;
    rootCause: string;
    resolution: string;
    environment: string;
  };
}) {
  return (
    <article
      className={`my-3 rounded-[var(--radius-md)] border border-l-2 border-[var(--border)] bg-[var(--surface)] p-4 ${RAIL[bug.severity] ?? "border-l-[var(--border-strong)]"}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-[var(--text-faint)]">{bug.code}</span>
        <StatusPill tone={severityTone(bug.severity)}>{bug.severity}</StatusPill>
        <StatusPill tone={bugStateTone(bug.state)}>{bug.state.replace("_", " ")}</StatusPill>
        {bug.environment && (
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {labels.environment}: {bug.environment}
          </span>
        )}
      </header>

      <h4 className="mt-2 text-sm font-semibold text-[var(--text)]">{bug.title}</h4>
      {bug.summaryMd && <SafeMarkdown className="mt-1 text-sm">{bug.summaryMd}</SafeMarkdown>}

      <dl className="mt-3 space-y-2">
        {bug.stepsMd && <Row label={labels.steps} md={bug.stepsMd} />}
        {bug.expectedMd && <Row label={labels.expected} md={bug.expectedMd} />}
        {bug.actualMd && <Row label={labels.actual} md={bug.actualMd} />}
        {bug.rootCauseMd && <Row label={labels.rootCause} md={bug.rootCauseMd} />}
        {bug.resolutionMd && <Row label={labels.resolution} md={bug.resolutionMd} />}
      </dl>
    </article>
  );
}

function Row({ label, md }: { label: string; md: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
        {label}
      </dt>
      <dd>
        <SafeMarkdown className="text-sm">{md}</SafeMarkdown>
      </dd>
    </div>
  );
}
