"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

/**
 * Public site hata sınırı (planning/07 T-0305).
 *
 * GÜVENLİK: production'da kullanıcıya yığın izi (stack trace) veya altyapı
 * ayrıntısı GÖSTERİLMEZ. Hata yalnızca izleme aracına (faz 3: Sentry) gönderilir.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("states");

  useEffect(() => {
    // Faz 3: burada hata izleme aracına raporlanacak.
    console.error("[site-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <section className="py-20">
      <Container prose className="text-center">
        <h1 className="text-2xl font-semibold text-[var(--text)]">{t("errorTitle")}</h1>
        <p className="mt-3 text-[var(--text-muted)]">{t("errorBody")}</p>
        <div className="mt-6">
          <Button onClick={reset} variant="secondary">
            {t("retry")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
