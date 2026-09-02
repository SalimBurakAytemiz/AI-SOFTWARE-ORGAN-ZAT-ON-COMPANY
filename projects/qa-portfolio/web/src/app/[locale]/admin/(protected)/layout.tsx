import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/is-admin";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * KORUMALI ADMIN LAYOUT - sunucu tarafı yetki kapısı (planning/10 §10.3 katman 2).
 *
 * İŞ KURALI: Bu layout'un sardığı her sayfa (dashboard, projects, media, ...)
 * yalnızca admin_users allow-list'indeki bir kullanıcıya açıktır. Oturum açmış
 * olmak yetmez (ADR-0006). /admin/login bu grubun DIŞINDADIR, bu yüzden döngü
 * oluşmaz.
 *
 * FAZ 1: Supabase yok -> isSupabaseConfigured=false -> herkes login'e gider.
 */
export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isSupabaseConfigured) {
    redirect(`/${locale}/admin/login`);
  }

  if (!(await isAdmin())) {
    redirect(`/${locale}/admin/login`);
  }

  return <>{children}</>;
}
