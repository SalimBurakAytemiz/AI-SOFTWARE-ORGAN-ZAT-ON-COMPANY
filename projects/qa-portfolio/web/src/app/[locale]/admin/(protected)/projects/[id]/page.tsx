import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminContentRepository } from "@/lib/repositories/admin-content-repository";
import { ProjectMetaForm } from "@/components/admin/project-meta-form";
import { TranslationEditor } from "@/components/admin/translation-editor";

export const dynamic = "force-dynamic";

/**
 * Proje düzenleme: META formu + TR/EN içerik editörleri.
 * Yayın durumu geçişleri liste sayfasındaki satır aksiyonlarından yapılır.
 */
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const repo = await AdminContentRepository.create();
  const detail = await repo.getProject(id);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${locale}/admin/projects`} className="text-sm text-[var(--text-muted)]">
          ← Projeler
        </Link>
        <h1 className="my-2 text-lg font-semibold">
          Proje düzenle: <span className="font-mono text-base">{detail.meta.slug}</span>
        </h1>
        <a
          href={`/${locale}/projects/${detail.meta.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[var(--info)] underline"
        >
          Public sayfayı aç ↗ (yalnızca yayınlanmışsa görünür)
        </a>
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold">Meta bilgiler</h2>
        <ProjectMetaForm detail={detail} />
      </section>

      <section className="space-y-6">
        <h2 className="text-base font-semibold">İçerik (dil başına yayın)</h2>
        <TranslationEditor projectId={id} locale="tr" value={detail.translations.tr} />
        <TranslationEditor projectId={id} locale="en" value={detail.translations.en} />
      </section>
    </div>
  );
}
