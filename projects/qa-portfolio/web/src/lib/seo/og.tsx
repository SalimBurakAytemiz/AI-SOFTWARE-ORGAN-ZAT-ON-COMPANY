import { ImageResponse } from "next/og";

/**
 * OPEN GRAPH GÖRSEL ÜRETECİ (planning/15 T-1505).
 *
 * Dinamik sosyal paylaşım görseli (1200x630). Marka fontu / logosu henüz yok
 * (content intake checklist J) - şu an sistem fontu + isim/başlık metni +
 * aksan çizgisi. Faz sonrası: gerçek font + logo.
 *
 * Not: harici görsel/font indirmez; tamamen metin + renk (CSP dostu, hızlı).
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BG = "#0a0b0d";
const ACCENT = "#3ddc97";
const TEXT = "#e8ebef";
const MUTED = "#95a1a0";

export function renderOgImage(opts: {
  eyebrow: string;
  title: string;
  footer?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 12, background: ACCENT }} />
          <div style={{ color: MUTED, fontSize: 24, letterSpacing: 2, textTransform: "uppercase" }}>
            {opts.eyebrow}
          </div>
        </div>

        <div
          style={{
            color: TEXT,
            fontSize: opts.title.length > 60 ? 56 : 72,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          {opts.title}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ color: MUTED, fontSize: 22 }}>{opts.footer ?? "QA Engineer Portfolio"}</div>
          <div style={{ color: ACCENT, fontSize: 22, fontFamily: "monospace" }}>PASS ✓</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
