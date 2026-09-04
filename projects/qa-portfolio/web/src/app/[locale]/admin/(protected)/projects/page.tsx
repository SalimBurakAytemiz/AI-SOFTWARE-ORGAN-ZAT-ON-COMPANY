import Link from "next/link";
import { AdminContentRepository } from "@/lib/repositories/admin-content-repository";
import { getMockAdminProjectStore } from "@/lib/admin/project-store";
import { AdminProjectsTable } from "@/components/admin/admin-projects-table";

/**
 * Admin proje listesi (planning/05 §5.3).
 *
 * Supabase yapılandırılıysa gerçek `AdminContentRepository` (TÜM durumlar);
 * yalnızca `AI_COMPANY_MOCK_ADMIN=1` senaryosunda in-memory mock depo.
 */
export const dynamic = "force-dynamic";

export default async function AdminProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const mockAdmin = process.env.AI_COMPANY_MOCK_ADMIN === "1";

  const rows = mockAdmin
    ? getMockAdminProjectStore()
        .listAll()
        .map((p) => ({
          id: p.id,
          slug: p.slug,
          titleTr: p.titleTr,
          titleEn: p.titleEn,
          classification: p.classification,
          status: p.status,
          visible: p.visible,
          featured: p.featured,
          demo: p.demo,
          updatedAt: p.updatedAt,
          translationStatus: p.translationStatus,
        }))
    : (await (await AdminContentRepository.create()).listProjects()).map((p) => ({
        id: p.id,
        slug: p.slug,
        titleTr: p.titleTr,
        titleEn: p.titleEn,
        classification: p.classification,
        status: p.status,
        visible: p.visible,
        featured: p.featured,
        demo: p.demo,
        updatedAt: p.updatedAt,
        translationStatus: p.translationStatus,
      }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Projeler</h1>
        <Link
          href={`/${locale}/admin/projects/new`}
          className="rounded-[var(--radius-md)] bg-[var(--text)] px-3 py-1.5 text-sm font-medium text-[var(--bg)]"
        >
          + Yeni proje
        </Link>
      </div>
      <AdminProjectsTable rows={rows} editHrefBase={`/${locale}/admin/projects`} />
    </div>
  );
}
