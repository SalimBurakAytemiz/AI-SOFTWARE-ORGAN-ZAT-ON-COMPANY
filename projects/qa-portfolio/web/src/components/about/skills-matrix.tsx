import { getTranslations } from "next-intl/server";
import type { DbLocale } from "@/lib/db/database.types";
import type { FixtureSkillCategory } from "@/content/fixtures";

/**
 * YETKİNLİK MATRİSİ (planning/04 §4.5, planning/14 review R3).
 *
 * İŞ KURALI: Öz-değerlendirme seviyesi ("proficiency") tek başına gösterilirse
 * ciddiyetsiz görünür. Bu yüzden:
 *   - Seviye çubuğunun HER ZAMAN bir açıklaması (legend) vardır.
 *   - Seviye ve yıl bilgisi GERÇEK veri gerektirir; null iken çubuk gösterilmez,
 *     yalnızca araç adı listelenir (ADR-0008: uydurma yok).
 *
 * Erişilebilirlik: seviye çubuğu role="img" + aria-label ile sayısal olarak da
 * bildirilir; renk tek başına bilgi taşımaz.
 */
export async function SkillsMatrix({
  categories,
  locale,
}: {
  categories: FixtureSkillCategory[];
  locale: DbLocale;
}) {
  const t = await getTranslations("about");
  const anyRated = categories.some((c) => c.items.some((s) => s.proficiency !== null));

  return (
    <div>
      {anyRated && (
        <p className="mb-4 font-mono text-[11px] text-[var(--text-faint)]">{t("skillsLegend")}</p>
      )}
      <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {categories.map((cat) => (
          <div key={cat.category[locale]}>
            <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {cat.category[locale]}
            </h3>
            <ul className="space-y-2">
              {cat.items.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--text)]">{s.label}</span>
                  {s.proficiency !== null ? (
                    <span
                      role="img"
                      aria-label={`${s.label}: ${s.proficiency}/5${s.years ? `, ${s.years} ${t("years")}` : ""}`}
                      className="flex gap-0.5"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          aria-hidden
                          className={
                            n <= s.proficiency!
                              ? "h-2 w-2 rounded-full bg-[var(--accent)]"
                              : "h-2 w-2 rounded-full bg-[var(--border)]"
                          }
                        />
                      ))}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-[var(--text-faint)]">TODO</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
