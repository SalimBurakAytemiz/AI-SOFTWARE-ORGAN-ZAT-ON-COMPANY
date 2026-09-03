import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { markdownSanitizeSchema } from "@/lib/markdown/sanitize-schema";
import { cn } from "@/lib/utils/cn";

/**
 * GÜVENLİ MARKDOWN RENDER (planning/10 §10.7).
 *
 * - Girdi: güvenilmeyen Markdown metni (admin tarafından girilir).
 * - remark-gfm: tablo, üstü çizili, otomatik bağlantı.
 * - rehype-sanitize + markdownSanitizeSchema: kesin izin listesi; script/style/
 *   iframe/on* / javascript: hepsi atılır.
 * - react-markdown çıktıyı React elemanı olarak üretir; dangerouslySetInnerHTML
 *   KULLANILMAZ -> ikinci savunma katmanı.
 * - Harici bağlantılara güvenlik öznitelikleri eklenir.
 */
export function SafeMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[68ch] text-[var(--text)] [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold",
        "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold",
        "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-1 [&_a]:text-[var(--accent)] [&_a]:underline",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--warn)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--text-muted)]",
        "[&_code]:rounded [&_code]:bg-[var(--bg-subtle)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-md)] [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:bg-[var(--surface-2,var(--surface-raised))] [&_pre]:p-4",
        "[&_table]:my-4 [&_table]:w-full [&_table]:text-sm [&_th]:border-b [&_th]:border-[var(--border-strong)] [&_th]:p-2 [&_th]:text-left",
        "[&_td]:border-b [&_td]:border-[var(--border)] [&_td]:p-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema]]}
        components={{
          a: ({ href, children: linkChildren }) => {
            const isExternal = href?.startsWith("http");
            return (
              <a
                href={href}
                {...(isExternal
                  ? { target: "_blank", rel: "nofollow ugc noopener noreferrer" }
                  : {})}
              >
                {linkChildren}
              </a>
            );
          },
          // Kaydırılabilir bölgeler klavyeyle erişilebilir olmalı
          // (erişilebilirlik: scrollable-region-focusable).
          pre: ({ children }) => (
            <pre tabIndex={0} role="region" aria-label="kod">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div tabIndex={0} role="region" aria-label="tablo" className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
