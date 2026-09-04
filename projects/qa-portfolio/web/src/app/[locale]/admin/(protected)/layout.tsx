import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/is-admin";
import { isSupabaseConfigured } from "@/lib/env";
import { signOutAction } from "@/app/[locale]/admin/login/actions";

/**
 * KORUMALI ADMIN LAYOUT - sunucu tarafı yetki kapısı (planning/10 §10.3 katman 2).
 *
 * İŞ KURALI: Bu layout'un sardığı her sayfa yalnızca `admin_users` allow-list'indeki
 * bir kullanıcıya açıktır. Oturum açmış olmak yetmez (ADR-0006). /admin/login bu
 * grubun DIŞINDADIR, bu yüzden döngü oluşmaz.
 *
 *   - Gerçek Supabase yoksa admin KAPALI -> /admin/login.
 *   - İSTİSNA: AI_COMPANY_MOCK_ADMIN=1 (yalnızca geliştirme/test) mock admin
 *     akışlarını (in-memory) görüntülemeye izin verir. Prod'da bu değişken
 *     ASLA set edilmez.
 */
export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const mockAdmin = process.env.AI_COMPANY_MOCK_ADMIN === "1";

  if (!isSupabaseConfigured && !mockAdmin) {
    redirect(`/${locale}/admin/login`);
  }

  if (!mockAdmin && !(await isAdmin())) {
    redirect(`/${locale}/admin/login`);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <nav className="flex gap-4 text-sm">
          <a href={`/${locale}/admin/dashboard`} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            Kontrol Paneli
          </a>
          <a href={`/${locale}/admin/projects`} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            Projeler
          </a>
        </nav>
        {!mockAdmin && (
          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
              Çıkış
            </button>
          </form>
        )}
      </div>

      {mockAdmin && (
        <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-1.5 font-mono text-xs text-[var(--warn)]">
          MOCK ADMIN — in-memory veri, kalıcı değil. Yalnızca geliştirme/test.
        </p>
      )}
      {children}
    </>
  );
}
