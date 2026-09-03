"use client";

import { useState } from "react";

/**
 * Kod bloğu - QA görsel dilinin parçası (planning/06 §6.6, §6.9).
 *
 * GÜVENLİK: kod içeriği React metin düğümü olarak render edilir (JSX otomatik
 * kaçışlar); dangerouslySetInnerHTML KULLANILMAZ. Sözdizimi renklendirme
 * (Shiki, build-time) faz 3'te eklenebilir - şu an düz mono + yatay kaydırma.
 */
export function CodeBlock({
  code,
  language,
  label,
}: {
  code: string;
  language?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API kullanılamıyorsa sessizce geç.
    }
  }

  return (
    <figure className="my-4 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-subtle)]">
      <figcaption className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
          {label ?? language ?? "kod"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          {copied ? "kopyalandı ✓" : "kopyala"}
        </button>
      </figcaption>
      {/* tabIndex + role: yatay kaydırılabilir bölge klavyeyle erişilebilir olmalı
          (erişilebilirlik: scrollable-region-focusable). */}
      <pre
        tabIndex={0}
        role="region"
        aria-label={label ?? language ?? "kod"}
        className="overflow-x-auto p-3 text-[12.5px] leading-relaxed focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
      >
        <code className="font-mono text-[var(--text)]">{code}</code>
      </pre>
    </figure>
  );
}
