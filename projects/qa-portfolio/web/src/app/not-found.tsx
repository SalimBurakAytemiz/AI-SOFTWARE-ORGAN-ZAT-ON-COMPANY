/**
 * Kök 404 (dil öneki olmayan, hiç eşleşmeyen yollar için). next-intl deseninde
 * bu sayfa kök layout dışında render edilebildiği için kendi <html>/<body>'sini
 * içerir. Genelde middleware kullanıcıyı bir dile yönlendirdiği için nadiren
 * görünür.
 */
export const metadata = { robots: { index: false, follow: false } };

export default function RootNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0d",
          color: "#e8ebef",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "monospace", color: "#6b747e" }}>404</p>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Page not found</h1>
          <p style={{ color: "#a2abb5" }}>
            {/* Kök 404 kök layout dışında; next/link yerine düz bağlantı kullanılır. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/en" style={{ color: "#3ddc97" }}>
              Go to homepage
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
