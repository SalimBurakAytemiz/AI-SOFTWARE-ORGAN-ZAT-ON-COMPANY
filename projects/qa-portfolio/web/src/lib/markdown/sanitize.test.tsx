import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeMarkdown } from "@/components/content/safe-markdown";

/**
 * XSS TEST KORPUSU (planning/10 §10.7, planning/11 CF-23, planning/07 T-1701).
 *
 * Bilinen saldırı yüklerini sanitization hattından geçirir ve çıktının ETKİSİZ
 * (inert) olduğunu doğrular: <script>, on* öznitelikleri, javascript: URL'leri
 * ve raw HTML render'a sızmamalı.
 */
function render(markdown: string): string {
  return renderToStaticMarkup(<SafeMarkdown>{markdown}</SafeMarkdown>);
}

const XSS_PAYLOADS: { name: string; input: string; mustNotContain: string[] }[] = [
  {
    name: "inline script etiketi",
    input: "Merhaba <script>alert('xss')</script> dünya",
    mustNotContain: ["<script", "alert('xss')"],
  },
  {
    name: "img onerror",
    input: '![x](https://example.com/a.png) <img src=x onerror="alert(1)">',
    mustNotContain: ["onerror", "alert(1)"],
  },
  {
    name: "javascript: bağlantısı",
    input: "[tıkla](javascript:alert(document.cookie))",
    mustNotContain: ["javascript:", "document.cookie"],
  },
  {
    name: "iframe enjeksiyonu",
    input: '<iframe src="https://evil.example"></iframe>',
    mustNotContain: ["<iframe"],
  },
  {
    name: "svg onload",
    input: '<svg onload="alert(1)"></svg>',
    mustNotContain: ["<svg", "onload"],
  },
  {
    name: "style/expression",
    input: '<div style="background:url(javascript:alert(1))">x</div>',
    mustNotContain: ["javascript:alert", "<style"],
  },
  {
    name: "data URI script bağlantısı",
    input: "[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
    mustNotContain: ["data:text/html"],
  },
  {
    name: "olay özniteliği metin içinde",
    input: 'Normal metin <b onmouseover="alert(1)">kalın</b>',
    mustNotContain: ["onmouseover"],
  },
];

describe("SafeMarkdown - XSS korpusu", () => {
  for (const payload of XSS_PAYLOADS) {
    it(`etkisiz hale getirir: ${payload.name}`, () => {
      const html = render(payload.input);
      for (const forbidden of payload.mustNotContain) {
        expect(html).not.toContain(forbidden);
      }
    });
  }

  it("güvenli Markdown'ı doğru render eder", () => {
    const html = render("## Başlık\n\n- madde bir\n- madde iki\n\n**kalın** ve `kod`");
    expect(html).toContain("<h2");
    expect(html).toContain("<li>madde bir</li>");
    expect(html).toContain("<strong>kalın</strong>");
    expect(html).toContain("<code>kod</code>");
  });

  it("harici bağlantıya güvenlik öznitelikleri ekler", () => {
    const html = render("[dış](https://example.com)");
    expect(html).toContain('rel="nofollow ugc noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it("dahili bağlantıya target=_blank EKLEMEZ", () => {
    const html = render("[iç](/tr/projects)");
    expect(html).not.toContain('target="_blank"');
  });

  it("GFM tablosunu render eder", () => {
    const html = render("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table");
    expect(html).toContain("<td>1</td>");
  });
});
