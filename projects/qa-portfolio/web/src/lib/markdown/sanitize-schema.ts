import { defaultSchema } from "rehype-sanitize";
import type { Options as SanitizeOptions } from "rehype-sanitize";

/**
 * MARKDOWN SANITIZATION ŞEMASI (planning/10 §10.7).
 *
 * İŞ / GÜVENLİK KURALI: İçerik metinleri Markdown olarak SAKLANIR, HTML olarak
 * DEĞİL. Render sırasında bu kesin izin listesinden (allowlist) geçirilir.
 * İzin verilenler dışındaki HER şey (script, style, iframe, on* öznitelikleri,
 * javascript: URL'leri, raw HTML) atılır -> saklanan XSS engellenir.
 *
 * Bu şema react-markdown + rehype-sanitize ile kullanılır. react-markdown
 * çıktıyı React elemanları olarak üretir (dangerouslySetInnerHTML YOK), bu da
 * ikinci bir savunma katmanıdır.
 */
export const markdownSanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  // Yalnızca güvenli, içerik-odaklı etiketler.
  tagNames: [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "strong", "em", "del", "code", "pre",
    "blockquote",
    "a",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: ["href"],
    code: ["className"], // dil sınıfı (language-xxx) render için
    th: ["align"],
    td: ["align"],
  },
  // Yalnızca güvenli protokoller; javascript:, data: (img hariç) yasak.
  protocols: {
    href: ["http", "https", "mailto"],
  },
  // Raw HTML düğümleri tamamen atılır.
  clobber: [],
  strip: ["script", "style"],
};
