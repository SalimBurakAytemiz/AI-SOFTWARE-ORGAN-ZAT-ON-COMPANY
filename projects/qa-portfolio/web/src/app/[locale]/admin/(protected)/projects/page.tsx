import { getMockAdminProjectStore } from "@/lib/admin/project-store";
import { AdminProjectsTable } from "@/components/admin/admin-projects-table";

/**
 * Admin proje listesi (planning/05 §5.3).
 *
 * FAZ 2: mock in-memory depodan okur (getMockAdminProjectStore). Admin listesi
 * TÜM durumları gösterir (draft/published/archived) - public listeden farklı
 * olarak. Faz 3: getContentRepository yerine admin repository + Supabase.
 */
export default function AdminProjectsPage() {
  const store = getMockAdminProjectStore();
  const rows = store.listAll().map((p) => ({
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
      <h1 className="mb-4 text-lg font-semibold">Projeler</h1>
      <AdminProjectsTable rows={rows} />
    </div>
  );
}
