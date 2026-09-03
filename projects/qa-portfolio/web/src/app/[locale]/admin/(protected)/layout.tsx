import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/is-admin";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * KORUMALI ADMIN LAYOUT - sunucu tarafı yetki kapısı (planning/10 §10.3 katman 2).
 *
 * İŞ KURALI: Bu layout'un sardığı her sayfa yalnızca admin_users allow-list'indeki
 * bir kullanıcıya açıktır. Oturum açmış olmak yetmez (ADR-0006). /admin/login bu
 * grubun DIŞINDADIR, bu yüzden döngü oluşmaz.
 *
 * FAZ 2:
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
      {mockAdmin && (
        <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-1.5 font-mono text-xs text-[var(--warn)]">
          MOCK ADMIN — in-memory veri, kalıcı değil. Yalnızca geliştirme/test.
        </p>
      )}
      {children}
    </>
  );
}
