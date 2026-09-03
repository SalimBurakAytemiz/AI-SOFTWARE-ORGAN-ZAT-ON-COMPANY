import { SafeMarkdown } from "@/components/content/safe-markdown";
import { CodeBlock } from "./code-block";
import { StatusPill } from "./status-pill";
import type { ApiExample } from "@/lib/domain/project";

/**
 * API test örneği bloğu (planning/04 §4.3). İstek/yanıt gövdeleri dilden
 * bağımsızdır ve ham metin olarak CodeBlock ile gösterilir (JSX kaçışlı).
 */
export function ApiExampleBlock({ example, notesLabel }: { example: ApiExample; notesLabel: string }) {
  const statusTone =
    example.responseStatus && example.responseStatus < 400
      ? "pass"
      : example.responseStatus
        ? "fail"
        : "neutral";

  return (
    <article className="my-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-[var(--text-faint)]">{example.code}</span>
        <StatusPill tone="info">{example.method}</StatusPill>
        <code className="font-mono text-[13px] text-[var(--text)]">{example.endpoint}</code>
        {example.responseStatus !== null && (
          <StatusPill tone={statusTone}>→ {example.responseStatus}</StatusPill>
        )}
      </header>
      <h3 className="mt-2 text-sm font-semibold text-[var(--text)]">{example.title}</h3>

      {example.requestBody && (
        <CodeBlock code={example.requestBody} language="json" label="request" />
      )}
      {example.responseBody && (
        <CodeBlock code={example.responseBody} language="json" label="response" />
      )}
      {example.notesMd && (
        <div className="mt-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
            {notesLabel}
          </p>
          <SafeMarkdown className="text-sm">{example.notesMd}</SafeMarkdown>
        </div>
      )}
    </article>
  );
}
