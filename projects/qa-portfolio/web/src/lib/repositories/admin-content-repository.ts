import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DbLocale, ContentStatus, ProjectClassification } from "@/lib/db/database.types";
import { createClient } from "@/lib/supabase/server";
import type { ProjectMeta, ProjectTranslation } from "@/lib/validation/project";

/**
 * @supabase/ssr'nin createServerClient dönüş tipi bu sürümde şema bilgisini tam
 * taşımadığı için (yazma işlemleri `never` olur), authenticated istemci
 * supabase-js'in SupabaseClient<Database> tipiyle ele alınır - çalışma zamanında
 * aynı nesnedir.
 */
type ServerDb = SupabaseClient<Database>;

/**
 * ADMIN İÇERİK REPOSITORY'Sİ - yazma tarafı (FAZ 4).
 *
 * GÜVENLİK: `@/lib/supabase/server` (authenticated, çerezli) istemci kullanır.
 * Her yazma RLS `*_admin_write` politikasından geçer (`is_admin()` -> allow-list).
 * service-role anahtarı KULLANILMAZ. Yayın durumu geçişleri
 * `admin_project_transition` RPC'si üzerinden yapılır (durum değişimi + audit
 * TEK atomik işlem - 0004_admin_rpcs.sql).
 *
 * Bu sınıf yalnızca DB erişimidir; yetki/doğrulama/audit/revalidation sarmalayıcısı
 * `withAdminAction` (src/lib/admin/action.ts).
 */

export interface AdminProjectListItem {
  id: string;
  slug: string;
  classification: ProjectClassification;
  status: ContentStatus;
  visible: boolean;
  featured: boolean;
  supported: boolean;
  displayOrder: number;
  demo: boolean;
  updatedAt: string;
  titleTr: string;
  titleEn: string;
  translationStatus: { tr: ContentStatus; en: ContentStatus };
}

export interface AdminProjectDetail {
  meta: ProjectMeta & { id: string; supported: boolean };
  translations: Record<DbLocale, ProjectTranslation | null>;
}

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type TranslationRow = Database["public"]["Tables"]["project_translations"]["Row"];

function isDemoSlug(slug: string): boolean {
  return slug.startsWith("demo-");
}

/** projects satırı -> düzenleme meta'sı (form değerleri). */
function toMeta(row: ProjectRow): AdminProjectDetail["meta"] {
  return {
    id: row.id,
    slug: row.slug,
    classification: row.classification,
    status: row.status,
    visible: row.visible,
    featured: row.featured,
    supported: row.supported,
    displayOrder: row.display_order,
    company: row.company,
    companyHidden: row.company_hidden,
    nda: row.nda,
    startDate: row.start_date,
    endDate: row.end_date,
    isOngoing: row.is_ongoing,
    githubUrl: row.github_url ?? "",
    externalUrl: row.external_url ?? "",
  };
}

function toTranslation(row: TranslationRow): ProjectTranslation {
  return {
    locale: row.locale,
    title: row.title,
    summary: row.summary,
    roleTitle: row.role_title,
    overviewMd: row.overview_md,
    testingScopeMd: row.testing_scope_md,
    testStrategyMd: row.test_strategy_md,
    testCoverageMd: row.test_coverage_md,
    challengesMd: row.challenges_md,
    impactMd: row.impact_md,
    lessonsMd: row.lessons_md,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    translationStatus: row.translation_status,
  };
}

/** Meta -> projects tablosu kolonları (insert/update). */
function metaToRow(meta: ProjectMeta) {
  return {
    slug: meta.slug,
    classification: meta.classification,
    status: meta.status,
    visible: meta.visible,
    featured: meta.featured,
    display_order: meta.displayOrder,
    company: meta.company,
    company_hidden: meta.companyHidden,
    nda: meta.nda,
    start_date: meta.startDate,
    end_date: meta.endDate,
    is_ongoing: meta.isOngoing,
    github_url: meta.githubUrl ? meta.githubUrl : null,
    external_url: meta.externalUrl ? meta.externalUrl : null,
    // supported = classification 'supported' aynası (şema notu 0001 §PROJELER).
    supported: meta.classification === "supported",
  };
}

function translationToRow(projectId: string, t: ProjectTranslation) {
  return {
    project_id: projectId,
    locale: t.locale,
    title: t.title,
    summary: t.summary,
    role_title: t.roleTitle,
    overview_md: t.overviewMd,
    testing_scope_md: t.testingScopeMd,
    test_strategy_md: t.testStrategyMd,
    test_coverage_md: t.testCoverageMd,
    challenges_md: t.challengesMd,
    impact_md: t.impactMd,
    lessons_md: t.lessonsMd,
    seo_title: t.seoTitle,
    seo_description: t.seoDescription,
    translation_status: t.translationStatus,
  };
}

export type ProjectTransition = "publish" | "unpublish" | "hide" | "show" | "archive" | "restore";

export class AdminContentRepository {
  private readonly db: ServerDb;

  private constructor(client: ServerDb) {
    this.db = client;
  }

  static async create(client?: ServerDb): Promise<AdminContentRepository> {
    return new AdminContentRepository(client ?? (await createClient()));
  }

  // --- Okuma (admin görünümü: TÜM durumlar) ---

  async listProjects(): Promise<AdminProjectListItem[]> {
    const { data, error } = await this.db
      .from("projects")
      .select(
        `id, slug, classification, status, visible, featured, supported, display_order, updated_at,
         project_translations ( locale, title, translation_status )`,
      )
      .order("display_order", { ascending: true });
    if (error) throw new Error(`admin listProjects: ${error.message}`);

    type Row = Pick<
      ProjectRow,
      "id" | "slug" | "classification" | "status" | "visible" | "featured" | "supported" | "display_order" | "updated_at"
    > & { project_translations: Pick<TranslationRow, "locale" | "title" | "translation_status">[] };

    return ((data ?? []) as unknown as Row[]).map((row) => {
      const tr = row.project_translations.find((t) => t.locale === "tr");
      const en = row.project_translations.find((t) => t.locale === "en");
      return {
        id: row.id,
        slug: row.slug,
        classification: row.classification,
        status: row.status,
        visible: row.visible,
        featured: row.featured,
        supported: row.supported,
        displayOrder: row.display_order,
        demo: isDemoSlug(row.slug),
        updatedAt: row.updated_at,
        titleTr: tr?.title ?? "—",
        titleEn: en?.title ?? "—",
        translationStatus: {
          tr: tr?.translation_status ?? "draft",
          en: en?.translation_status ?? "draft",
        },
      };
    });
  }

  async getProject(id: string): Promise<AdminProjectDetail | null> {
    const { data, error } = await this.db
      .from("projects")
      .select(`*, project_translations ( * )`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`admin getProject: ${error.message}`);
    if (!data) return null;

    const row = data as unknown as ProjectRow & { project_translations: TranslationRow[] };
    const trRow = row.project_translations.find((t) => t.locale === "tr");
    const enRow = row.project_translations.find((t) => t.locale === "en");

    return {
      meta: toMeta(row),
      translations: {
        tr: trRow ? toTranslation(trRow) : null,
        en: enRow ? toTranslation(enRow) : null,
      },
    };
  }

  // --- Yazma ---

  /** Yeni proje: her zaman taslak başlar; iki dil için boş taslak çeviri açılır. */
  async createProject(
    meta: ProjectMeta,
    titles: { titleTr: string; titleEn: string },
  ): Promise<{ id: string; slug: string }> {
    const insertRow = { ...metaToRow(meta), status: "draft" as const, visible: true, published_at: null };
    const { data, error } = await this.db.from("projects").insert(insertRow).select("id, slug").single();
    if (error) throw new Error(mapWriteError(error.message, meta.slug));

    const id = data.id as string;
    const emptyTr = (locale: DbLocale, title: string): ProjectTranslation => ({
      locale,
      title,
      summary: "[TASLAK]",
      roleTitle: null,
      overviewMd: null,
      testingScopeMd: null,
      testStrategyMd: null,
      testCoverageMd: null,
      challengesMd: null,
      impactMd: null,
      lessonsMd: null,
      seoTitle: null,
      seoDescription: null,
      translationStatus: "draft",
    });
    const { error: trError } = await this.db.from("project_translations").insert([
      translationToRow(id, emptyTr("tr", titles.titleTr)),
      translationToRow(id, emptyTr("en", titles.titleEn)),
    ]);
    if (trError) throw new Error(`createProject çeviriler: ${trError.message}`);

    return { id, slug: data.slug as string };
  }

  async updateProjectMeta(id: string, meta: ProjectMeta): Promise<void> {
    const { error } = await this.db.from("projects").update(metaToRow(meta)).eq("id", id);
    if (error) throw new Error(mapWriteError(error.message, meta.slug));
  }

  /** Bir dilin içeriğini kaydeder (varsa günceller). */
  async upsertTranslation(projectId: string, t: ProjectTranslation): Promise<void> {
    const { error } = await this.db
      .from("project_translations")
      .upsert(translationToRow(projectId, t), { onConflict: "project_id,locale" });
    if (error) throw new Error(`upsertTranslation (${t.locale}): ${error.message}`);
  }

  /** Yayın durumu geçişi - transactional RPC (durum + audit atomik). */
  async transitionProject(
    id: string,
    transition: ProjectTransition,
    actorName: string,
  ): Promise<{ status: ContentStatus; visible: boolean }> {
    const { data, error } = await this.db.rpc("admin_project_transition", {
      p_id: id,
      p_transition: transition,
      p_actor_name: actorName,
    });
    if (error) throw new Error(mapRpcError(error.message));
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("İşlem başarısız: RPC boş sonuç döndürdü.");
    return { status: row.status as ContentStatus, visible: row.visible as boolean };
  }

  async setProjectFlags(
    id: string,
    flags: { featured?: boolean; visible?: boolean },
  ): Promise<void> {
    const patch: Database["public"]["Tables"]["projects"]["Update"] = {};
    if (typeof flags.featured === "boolean") patch.featured = flags.featured;
    if (typeof flags.visible === "boolean") patch.visible = flags.visible;
    if (Object.keys(patch).length === 0) return;
    const { error } = await this.db.from("projects").update(patch).eq("id", id);
    if (error) throw new Error(`setProjectFlags: ${error.message}`);
  }

  async reorderProjects(orderedIds: string[]): Promise<void> {
    // Küçük veri kümesi: sıralı tek tek update (batch RPC gerekmez).
    for (const [index, id] of orderedIds.entries()) {
      const { error } = await this.db.from("projects").update({ display_order: index }).eq("id", id);
      if (error) throw new Error(`reorderProjects: ${error.message}`);
    }
  }

  /** Dashboard sayaçları - tek sorguda status/flag dağılımı. */
  async projectCounts(): Promise<{
    published: number;
    draft: number;
    archived: number;
    featured: number;
    supported: number;
    qaLab: number;
  }> {
    const { data, error } = await this.db
      .from("projects")
      .select("status, featured, supported, classification, visible");
    if (error) throw new Error(`projectCounts: ${error.message}`);
    const rows = (data ?? []) as Pick<
      ProjectRow,
      "status" | "featured" | "supported" | "classification" | "visible"
    >[];
    return {
      published: rows.filter((r) => r.status === "published").length,
      draft: rows.filter((r) => r.status === "draft").length,
      archived: rows.filter((r) => r.status === "archived").length,
      featured: rows.filter((r) => r.featured).length,
      supported: rows.filter((r) => r.supported).length,
      qaLab: rows.filter((r) => r.classification === "qa_lab").length,
    };
  }
}

/** Yaygın DB hatalarını kullanıcıya anlaşılır Türkçe mesaja çevirir. */
function mapWriteError(message: string, slug: string): string {
  if (/duplicate key|unique/i.test(message) && /slug/i.test(message)) {
    return `Bu slug zaten kullanımda: ${slug}`;
  }
  return `Kayıt başarısız: ${message}`;
}

function mapRpcError(message: string): string {
  if (/yetkisiz/i.test(message)) return "Bu işlem için yönetici yetkisi gerekli.";
  if (/arşivlenmiş proje doğrudan/i.test(message)) return "Arşivlenmiş proje doğrudan yayınlanamaz; önce geri yükleyin.";
  if (/yalnızca yayınlanmış/i.test(message)) return "Yalnızca yayınlanmış proje bu işleme uygundur.";
  if (/yalnızca arşivlenmiş/i.test(message)) return "Yalnızca arşivlenmiş proje geri yüklenebilir.";
  if (/bulunamadı/i.test(message)) return "Proje bulunamadı.";
  return `İşlem başarısız: ${message}`;
}
