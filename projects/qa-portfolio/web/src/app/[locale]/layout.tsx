import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getTranslations, getMessages } from "next-intl/server";
import { routing, isLocale } from "@/i18n/routing";
import { ThemeInit } from "@/components/theme/theme-init";
import "@/styles/globals.css";

/**
 * KÖK LAYOUT (next-intl App Router deseni: tüm rotalar [locale] altında olduğu
 * için app/layout.tsx yerine bu dosya kök layout'tur).
 *
 * - <html lang={locale}> ile doğru dil işaretlenir (erişilebilirlik + SEO).
 * - next/font ile fontlar self-host edilir: CLS yok, üçüncü taraf istek yok,
 *   CSP dostu (planning/06 §6.2).
 * - Türkçe latin-ext alt kümesi (İ/ı/ğ/ş/ç/ö/ü) dahil.
 * - Admin şu an /[locale]/admin altında; "dilsiz admin" (planning/03) faz 2'de
 *   route-group çoklu-kök layout ile yapılacak.
 */
const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-inter" });
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-mono-face",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0d" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("tagline"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Geçersiz dil segmenti -> 404 (planning/03 §3.4).
  if (!isLocale(locale)) notFound();

  // Statik render için aktif dili sabitle.
  setRequestLocale(locale);

  // İstemci bileşenlerinin (dil değiştirici, tema butonu, iletişim formu)
  // çeviri kataloğuna erişebilmesi için mesajlar provider'a verilir.
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${jetBrainsMono.variable}`}>
        {/* Kayıtlı tema tercihini (localStorage) sayfa boyanmadan uygular. */}
        <ThemeInit />
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
