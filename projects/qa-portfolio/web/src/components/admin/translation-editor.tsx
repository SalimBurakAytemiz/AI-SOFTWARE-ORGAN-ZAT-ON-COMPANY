"use client";

import { useActionState } from "react";
import { saveTranslationAction } from "@/app/[locale]/admin/(protected)/projects/actions";
import { type FormState, idleFormState } from "@/lib/admin/form-state";
import type { ProjectTranslation } from "@/lib/validation/project";
import { Field, TextInput, TextArea, FormMessage, SubmitButton } from "./form-fields";

/**
 * TR / EN proje içerik editörü (project_translations tablosu).
 *
 * İŞ KURALI (planning/02 §2.7): her dil AYRI yayınlanır. "Taslak kaydet" ile
 * "Yayınla" iki ayrı buton; yayınlamadan önce zorunlu alanlar sunucuda
 * kontrol edilir (checkTranslationReadyToPublish).
 */
export function TranslationEditor({
  projectId,
  locale,
  value,
}: {
  projectId: string;
  locale: "tr" | "en";
  value: ProjectTranslation | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveTranslationAction, idleFormState);
  const v = value;
  const langLabel = locale === "tr" ? "Türkçe" : "İngilizce";

  return (
    <form action={formAction} className="max-w-2xl border-t border-[var(--border)] pt-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="locale" value={locale} />

      <div className="mb-2 flex items-center gap-3">
        <h3 className="text-base font-semibold">{langLabel} içerik</h3>
        <span className="font-mono text-xs text-[var(--text-faint)]">
          durum: {v?.translationStatus ?? "yok"}
        </span>
      </div>
      <FormMessage error={state.error} notice={state.ok ? state.notice : undefined} />

      <Field label="Başlık" name="title" errors={state.fieldErrors?.title}>
        <TextInput id={`title-${locale}`} name="title" defaultValue={v?.title ?? ""} required />
      </Field>
      <Field label="Özet" name="summary" hint="10-400 karakter" errors={state.fieldErrors?.summary}>
        <TextArea id={`summary-${locale}`} name="summary" defaultValue={v?.summary ?? ""} required />
      </Field>
      <Field label="Rol başlığı" name="roleTitle">
        <TextInput id={`roleTitle-${locale}`} name="roleTitle" defaultValue={v?.roleTitle ?? ""} />
      </Field>

      {(
        [
          ["overviewMd", "Genel bakış (Markdown)"],
          ["testingScopeMd", "Test kapsamı"],
          ["testStrategyMd", "Test stratejisi"],
          ["testCoverageMd", "Test coverage notu"],
          ["challengesMd", "Zorluklar"],
          ["impactMd", "Etki / sonuç"],
          ["lessonsMd", "Öğrenilenler"],
        ] as const
      ).map(([field, label]) => (
        <Field key={field} label={label} name={field}>
          <TextArea id={`${field}-${locale}`} name={field} defaultValue={(v?.[field] as string | null) ?? ""} />
        </Field>
      ))}

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="SEO başlık" name="seoTitle" hint="≤ 70 karakter">
          <TextInput id={`seoTitle-${locale}`} name="seoTitle" defaultValue={v?.seoTitle ?? ""} />
        </Field>
        <Field label="SEO açıklama" name="seoDescription" hint="≤ 200 karakter">
          <TextInput id={`seoDescription-${locale}`} name="seoDescription" defaultValue={v?.seoDescription ?? ""} />
        </Field>
      </div>

      {/* translationStatus form değeri intent ile belirlenir; alan gizli tutulur. */}
      <input type="hidden" name="translationStatus" value={v?.translationStatus ?? "draft"} />

      <div className="flex gap-2">
        <SubmitButton pending={pending} name="intent" value="draft" variant="secondary">
          Taslak kaydet
        </SubmitButton>
        <SubmitButton pending={pending} name="intent" value="publish">
          Bu dili yayınla
        </SubmitButton>
      </div>
    </form>
  );
}
