import { Container } from "@/components/ui/container";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Admin giriş sayfası (planning/05 §5.1).
 *
 * FAZ 1: gerçek Supabase Auth bağlanmadığı için giriş formu devre dışı; bunun
 * yerine "bir insan işlemi gerekli" bilgisi gösterilir (Supabase projesi +
 * kimlik bilgileri). Faz 2'de e-posta+parola formu, hız sınırı ve genel hata
 * mesajı (kullanıcı adı sızdırmadan) eklenecek.
 *
 * Bu sayfa YETKİ KAPISININ DIŞINDADIR (admin/(protected) değil).
 */
export default function AdminLoginPage() {
  return (
    <Container className="max-w-sm py-16">
      <h1 className="text-xl font-semibold">QA CMS — Giriş</h1>

      {isSupabaseConfigured ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          {/* Faz 2: e-posta + parola formu burada. */}
          Giriş formu faz 2&apos;de etkinleşecek.
        </p>
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
