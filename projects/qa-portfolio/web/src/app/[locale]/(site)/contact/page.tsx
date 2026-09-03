import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ContactForm } from "@/components/contact/contact-form";
import { isLocale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/seo/metadata";

/**
 * İletişim sayfası (planning/04 §4.7).
 *
 * Sayfa statik; form bir istemci "adası" (client island). Faz 1'de form gönderimi
 * henüz bir e-posta göndermez / kayıt yapmaz - POST /api/contact + Mailer + hız
 * sınırı faz 2'de (planning/07 T-1401..T-1403, planning/10 §10.8).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "contact" });
  return buildPageMetadata({
    locale,
    path: "/contact",
    title: t("title"),
    description: t("intro"),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("contact");

  return (
    <section className="py-14">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--text)]">
              {t("title")}
            </h1>
            <p className="mt-3 max-w-xl text-[var(--text-muted)]">{t("intro")}</p>
            <div className="mt-8 max-w-xl">
              <ContactForm locale={locale} />
            </div>
          </div>

          <aside className="text-sm text-[var(--text-muted)]">
            <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--text-faint)]">
              {t("otherWays")}
            </h2>
            <ul className="mt-3 space-y-1">
              <li>[PLACEHOLDER: GitHub]</li>
              <li>[PLACEHOLDER: LinkedIn]</li>
              <li>[PLACEHOLDER: Şehir, Türkiye]</li>
            </ul>
            <p className="mt-4">{t("responseTime")}</p>
          </aside>
        </div>
      </Container>
    </section>
  );
}
