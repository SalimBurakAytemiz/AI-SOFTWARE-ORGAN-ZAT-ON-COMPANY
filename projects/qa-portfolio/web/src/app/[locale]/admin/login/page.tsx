import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { LoginForm } from "@/components/admin/login-form";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdmin } from "@/lib/auth/is-admin";

/**
 * Admin giriş sayfası (planning/05 §5.1).
 *
 * Bu sayfa YETKİ KAPISININ DIŞINDADIR (admin/(protected) değil) - aksi halde
 * login -> login döngüsü olurdu. Zaten giriş yapmış bir admin doğrudan panele
 * yönlendirilir. Supabase yapılandırılmamışsa "insan işlemi gerekli" bilgisi
 * gösterilir.
 */
export default async function AdminLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;

  if (isSupabaseConfigured && (await isAdmin().catch(() => false))) {
    redirect(`/${locale}/admin/dashboard`);
  }

  return (
    <Container className="max-w-sm py-16">
      <h1 className="text-xl font-semibold">QA CMS — Giriş</h1>

      {isSupabaseConfigured ? (
        <>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Yönetici e-postanız ve parolanızla giriş yapın.
          </p>
          <LoginForm locale={locale} next={next} />
        </>
      ) : (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] p-4 text-sm">
          <p className="font-medium text-[var(--text)]">İnsan işlemi gerekli</p>
          <p className="mt-1 text-[var(--text-muted)]">
            Admin panel için bir Supabase projesi ve <code>.env.local</code> içinde
            kimlik bilgileri gereklidir. Ayrıntı: <code>web/supabase/README.md</code>.
          </p>
        </div>
      )}
    </Container>
  );
}
