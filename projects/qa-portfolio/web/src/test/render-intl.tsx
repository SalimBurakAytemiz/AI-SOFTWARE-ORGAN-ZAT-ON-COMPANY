import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

/**
 * i18n bağlamı gerektiren bileşen testleri için yardımcı.
 *
 * next-intl `useTranslations` ve `@/i18n/navigation` `<Link>` bileşenleri bir
 * NextIntlClientProvider ister. Bu sarmalayıcı gerçek mesaj kataloglarını
 * kullanır (böylece eksik anahtar da yakalanır).
 */
const MESSAGES = { en, tr } as const;

export function renderWithIntl(ui: ReactElement, locale: "tr" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}
