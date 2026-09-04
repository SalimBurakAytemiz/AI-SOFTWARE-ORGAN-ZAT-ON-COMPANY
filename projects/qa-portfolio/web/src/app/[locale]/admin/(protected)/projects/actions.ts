"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { withAdminAction, type ActionResult } from "@/lib/admin/action";
import type { FormState } from "@/lib/admin/form-state";
import { AdminContentRepository, type ProjectTransition } from "@/lib/repositories/admin-content-repository";
import { currentAdmin } from "@/lib/auth/is-admin";
import {
  projectMetaSchema,
  projectTranslationSchema,
  checkTranslationReadyToPublish,
  type ProjectTranslation,
} from "@/lib/validation/project";
import { isLocale } from "@/i18n/routing";

/**
 * ADMIN PROJE SERVER ACTION'LARI (FAZ 4).
 *
 * Hepsi `withAdminAction`ten geçer: authn -> authz(is_admin) -> validation ->
 * write (AdminContentRepository) -> audit -> revalidation. Yayın durumu
 * geçişleri `selfAudited` (RPC audit'i kendi yazar).
 */

// --- Yardımcılar ---

const boolish = (v: FormDataEntryValue | null) => v === "on" || v === "true" || v === "1";
const strOrNull = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
};

function readMeta(fd: FormData) {
  return {
    slug: String(fd.get("slug") ?? "").trim(),
    classification: String(fd.get("classification") ?? ""),
    status: String(fd.get("status") ?? "draft"),
    visible: boolish(fd.get("visible")),
    featured: boolish(fd.get("featured")),
    displayOrder: Number(fd.get("displayOrder") ?? 0),
    company: strOrNull(fd.get("company")),
    companyHidden: boolish(fd.get("companyHidden")),
    nda: boolish(fd.get("nda")),
    startDate: strOrNull(fd.get("startDate")),
    endDate: strOrNull(fd.get("endDate")),
    isOngoing: boolish(fd.get("isOngoing")),
    githubUrl: strOrNull(fd.get("githubUrl")) ?? "",
    externalUrl: strOrNull(fd.get("externalUrl")) ?? "",
  };
}

function readTranslation(fd: FormData): unknown {
  const md = (k: string) => strOrNull(fd.get(k));
  return {
    locale: String(fd.get("locale") ?? ""),
    title: String(fd.get("title") ?? "").trim(),
    summary: String(fd.get("summary") ?? "").trim(),
    roleTitle: md("roleTitle"),
    overviewMd: md("overviewMd"),
    testingScopeMd: md("testingScopeMd"),
    testStrategyMd: md("testStrategyMd"),
    testCoverageMd: md("testCoverageMd"),
    challengesMd: md("challengesMd"),
    impactMd: md("impactMd"),
    lessonsMd: md("lessonsMd"),
    seoTitle: md("seoTitle"),
    seoDescription: md("seoDescription"),
    translationStatus: String(fd.get("translationStatus") ?? "draft"),
  };
}

function toFormState<T>(res: ActionResult<T>, successNotice = "Kaydedildi."): FormState {
  if (res.ok) return { ok: true, error: null, notice: successNotice };
  return { ok: false, error: res.message, fieldErrors: res.fieldErrors };
}

// --- Create ---

const createSchema = projectMetaSchema
  .pick({ slug: true, classification: true })
  .extend({ titleTr: z.string().trim().min(2), titleEn: z.string().trim().min(2) });

export async function createProjectAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const localeRaw = String(fd.get("locale") ?? "en");
  const locale = isLocale(localeRaw) ? localeRaw : "en";

  const res = await withAdminAction(
    {
      slug: String(fd.get("slug") ?? "").trim(),
      classification: String(fd.get("classification") ?? ""),
      titleTr: String(fd.get("titleTr") ?? "").trim(),
      titleEn: String(fd.get("titleEn") ?? "").trim(),
    },
    {
      action: "create",
      entity: "project",
      schema: createSchema,
      write: async (input) => {
        const repo = await AdminContentRepository.create();
        const { id, slug } = await repo.createProject(
          {
            slug: input.slug,
            classification: input.classification,
            status: "draft",
            visible: true,
            featured: false,
            displayOrder: 999,
            company: null,
            companyHidden: false,
            nda: false,
            startDate: null,
            endDate: null,
            isOngoing: false,
            githubUrl: "",
            externalUrl: "",
          },
          { titleTr: input.titleTr, titleEn: input.titleEn },
        );
        return { id, summary: `proje oluşturuldu: ${slug}`, data: { id } };
      },
    },
  );

  if (!res.ok) return toFormState(res);
  redirect(`/${locale}/admin/projects/${res.data.id}`);
}

// --- Update meta ---

export async function updateProjectMetaAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("id") ?? "");
  const res = await withAdminAction(readMeta(fd), {
    action: "update",
    entity: "project",
    schema: projectMetaSchema,
    write: async (input) => {
      const repo = await AdminContentRepository.create();
      await repo.updateProjectMeta(id, input);
      return { id, summary: `proje meta güncellendi: ${input.slug}`, data: { id } };
    },
  });
  return toFormState(res, "Meta bilgileri kaydedildi.");
}

// --- Save translation (draft veya publish) ---

export async function saveTranslationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const projectId = String(fd.get("projectId") ?? "");
  const wantPublish = String(fd.get("intent") ?? "") === "publish";

  const langLabel = String(fd.get("locale") ?? "") === "tr" ? "Türkçe" : "İngilizce";

  const parsed = projectTranslationSchema.safeParse(readTranslation(fd));
  if (!parsed.success) {
    return {
      ok: false,
      error: `${langLabel} içerik kaydedilemedi - girdi doğrulaması başarısız.`,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const translation: ProjectTranslation = {
    ...parsed.data,
    translationStatus: wantPublish ? "published" : "draft",
  };

  // Yayınlamadan önce zorunlu alan kontrolü (yarım çeviri yayınlanmasın).
  if (wantPublish) {
    const check = checkTranslationReadyToPublish(translation);
    if (!check.ok) {
      return {
        ok: false,
        error: `${langLabel} içerik yayınlanamaz - eksik zorunlu alan(lar): ${check.missing.join(", ")}`,
      };
    }
  }

  const res = await withAdminAction(translation, {
    action: wantPublish ? "publish" : "update",
    entity: "project",
    schema: projectTranslationSchema,
    write: async (input) => {
      const repo = await AdminContentRepository.create();
      await repo.upsertTranslation(projectId, { ...input, translationStatus: translation.translationStatus });
      return {
        id: projectId,
        summary: `${input.locale} çevirisi ${wantPublish ? "yayınlandı" : "kaydedildi"}`,
        data: { id: projectId },
      };
    },
  });
  return toFormState(
    res,
    wantPublish ? `${langLabel} içerik yayınlandı.` : `${langLabel} içerik taslak olarak kaydedildi.`,
  );
}

// --- Yayın durumu geçişleri (RPC, selfAudited) ---

const transitionSchema = z.object({
  id: z.string().uuid(),
  transition: z.enum(["publish", "unpublish", "hide", "show", "archive", "restore"]),
});

export async function transitionProjectAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const res = await withAdminAction(
    { id: String(fd.get("id") ?? ""), transition: String(fd.get("transition") ?? "") },
    {
      action: String(fd.get("transition") ?? "transition"),
      entity: "project",
      schema: transitionSchema,
      selfAudited: true,
      write: async (input) => {
        const repo = await AdminContentRepository.create();
        const admin = await currentAdmin().catch(() => null);
        const out = await repo.transitionProject(
          input.id,
          input.transition as ProjectTransition,
          admin?.displayName ?? "admin",
        );
        return {
          id: input.id,
          summary: `${input.transition} -> ${out.status}/${out.visible ? "görünür" : "gizli"}`,
          data: { id: input.id },
        };
      },
    },
  );
  return toFormState(res);
}

// --- Öne çıkan (featured) aç/kapat ---

export async function toggleFeaturedAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("id") ?? "");
  const featured = boolish(fd.get("featured"));
  const res = await withAdminAction(
    { id, featured },
    {
      action: featured ? "feature" : "unfeature",
      entity: "project",
      schema: z.object({ id: z.string().uuid(), featured: z.boolean() }),
      write: async (input) => {
        const repo = await AdminContentRepository.create();
        await repo.setProjectFlags(input.id, { featured: input.featured });
        return { id: input.id, summary: `featured=${input.featured}`, data: { id: input.id } };
      },
    },
  );
  return toFormState(res);
}

// --- Sıralama (display_order) ---

export async function reorderProjectsAction(orderedIds: string[]): Promise<FormState> {
  const res = await withAdminAction(
    { orderedIds },
    {
      action: "reorder",
      entity: "project",
      schema: z.object({ orderedIds: z.array(z.string().uuid()).min(1) }),
      write: async (input) => {
        const repo = await AdminContentRepository.create();
        await repo.reorderProjects(input.orderedIds);
        return { id: "reorder", summary: `${input.orderedIds.length} proje yeniden sıralandı`, data: null };
      },
    },
  );
  return toFormState(res);
}
