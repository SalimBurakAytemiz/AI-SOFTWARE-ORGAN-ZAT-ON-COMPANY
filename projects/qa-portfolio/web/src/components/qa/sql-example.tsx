import { SafeMarkdown } from "@/components/content/safe-markdown";
import { CodeBlock } from "./code-block";
import type { SqlExample } from "@/lib/domain/project";

/**
 * SQL / veritabanı doğrulama örneği bloğu (planning/04 §4.3).
 * Sorgu ve örnek sonuç dilden bağımsızdır; başlık ve açıklama yerelleştirilir.
 */
export function SqlExampleBlock({
  example,
  sampleResultLabel,
  explanationLabel,
}: {
  example: SqlExample;
  sampleResultLabel: string;
  explanationLabel: string;
}) {
  return (
    <article className="my-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-[var(--text-faint)]">{example.code}</span>
        <span className="font-mono text-[11px] uppercase text-[var(--text-muted)]">
          {example.dialect}
        </span>
      </header>
      <h3 className="mt-2 text-sm font-semibold text-[var(--text)]">{example.title}</h3>

      <CodeBlock code={example.querySql} language="sql" label="sql" />

      {example.sampleResult && (
        <CodeBlock code={example.sampleResult} label={sampleResultLabel} />
      )}
      {example.explanationMd && (
        <div className="mt-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
            {explanationLabel}
          </p>
          <SafeMarkdown className="text-sm">{example.explanationMd}</SafeMarkdown>
        </div>
      )}
    </article>
  );
}
