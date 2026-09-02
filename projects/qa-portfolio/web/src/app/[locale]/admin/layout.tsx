/**
 * Admin kabuğu (dış katman). Bu layout HEM /admin/login HEM korumalı sayfaları
 * sarar; bu yüzden burada YETKİ KAPISI YOKTUR (aksi halde login -> login sonsuz
 * döngüsü olurdu). Yetki kapısı admin/(protected)/layout.tsx içindedir
 * (planning/10 §10.3, katman 2).
 *
 * Bütün admin yüzeyi: dizine eklenmez (noindex) ve önbelleğe alınmaz.
 */
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-6 py-3">
        <span className="font-mono text-sm font-semibold">QA CMS</span>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}
