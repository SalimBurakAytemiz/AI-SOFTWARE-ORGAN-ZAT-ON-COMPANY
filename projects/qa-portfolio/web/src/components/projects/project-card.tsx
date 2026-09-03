import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import type { ProjectSummary } from "@/lib/domain/project";

/**
 * Proje kartı (planning/04 §4.2, planning/06 §6.6).
 *
 * İŞ KURALI (planning/02 §2.4): NDA'lı bir projede şirket adı "Gizli" gösterilir.
 * DEMO içerik açıkça "DEMO" rozetiyle işaretlenir (ADR-0008) - gerçek veri gibi
 * gösterilmez.
 */
export function ProjectCard({ project }: { project: ProjectSummary }) {
  const t = useTranslations("projects");
  const cls = useTranslations("projects.classification");

  const companyLabel =
    project.companyHidden || project.company === null ? t("confidential") : project.company;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex flex-col rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 no-underline transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={project.classification === "supported" ? "accent" : "neutral"}>
          {cls(project.classification)}
        </Badge>
        {project.nda && <Badge tone="warn">{t("ndaBadge")}</Badge>}
        {project.demo && <Badge tone="info">{t("demoBadge")}</Badge>}
      </div>

      <h3 className="text-base font-semibold text-[var(--text)]">{project.title}</h3>
      <p className="mt-0.5 text-sm text-[var(--text-muted)]">
        {[project.roleTitle, companyLabel].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-2 line-clamp-3 text-sm text-[var(--text)]">{project.summary}</p>

      {project.taxonomy.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {project.taxonomy.slice(0, 3).map((term) => (
            <li
              key={term}
              className="rounded-[var(--radius-sm)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]"
            >
              {term}
            </li>
          ))}
        </ul>
      )}

      <span className="mt-4 font-mono text-xs text-[var(--accent)] group-hover:underline">
        {t("readCaseStudy")} →
      </span>
    </Link>
  );
}
