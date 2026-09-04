"use client";

import { useActionState } from "react";
import { updateProjectMetaAction, type FormState } from "@/app/[locale]/admin/(protected)/projects/actions";
import type { AdminProjectDetail } from "@/lib/repositories/admin-content-repository";
import { Field, TextInput, Select, Checkbox, FormMessage, SubmitButton } from "./form-fields";

const idle: FormState = { ok: false, error: null };

/**
 * Proje META formu (projects tablosu - dilden bağımsız alanlar).
 * Yayın durumu bu formdan DEĞİL, satır aksiyonlarından / RPC'den değişir;
 * burada `status` salt-okunur gösterilir.
 */
export function ProjectMetaForm({ detail }: { detail: AdminProjectDetail }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateProjectMetaAction, idle);
  const m = detail.meta;

  return (
    <form action={formAction} className="max-w-2xl">
      <input type="hidden" name="id" value={m.id} />
      {/* status yalnızca RPC ile değişir; formda mevcut değeri koru. */}
      <input type="hidden" name="status" value={m.status} />
      <FormMessage error={state.error} notice={state.ok ? state.notice : undefined} />

      <p className="mb-3 text-xs text-[var(--text-faint)]">
        Durum: <span className="font-mono">{m.status}</span> · görünür:{" "}
        <span className="font-mono">{m.visible ? "evet" : "hayır"}</span>
      </p>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Slug" name="slug" errors={state.fieldErrors?.slug}>
          <TextInput id="slug" name="slug" defaultValue={m.slug} required />
        </Field>
        <Field label="Sınıflandırma" name="classification">
          <Select id="classification" name="classification" defaultValue={m.classification}>
            <option value="professional">Profesyonel</option>
            <option value="supported">Destek verilen</option>
            <option value="personal">Kişisel</option>
            <option value="qa_lab">QA Lab</option>
          </Select>
        </Field>
        <Field label="Sıra (display order)" name="displayOrder">
          <TextInput id="displayOrder" name="displayOrder" type="number" defaultValue={m.displayOrder} />
        </Field>
        <Field label="Şirket" name="company">
          <TextInput id="company" name="company" defaultValue={m.company ?? ""} />
        </Field>
        <Field label="Başlangıç tarihi" name="startDate" hint="YYYY-MM-DD">
          <TextInput id="startDate" name="startDate" type="date" defaultValue={m.startDate ?? ""} />
        </Field>
        <Field label="Bitiş tarihi" name="endDate" hint="YYYY-MM-DD">
          <TextInput id="endDate" name="endDate" type="date" defaultValue={m.endDate ?? ""} />
        </Field>
        <Field label="GitHub URL" name="githubUrl" errors={state.fieldErrors?.githubUrl}>
          <TextInput id="githubUrl" name="githubUrl" defaultValue={m.githubUrl ?? ""} />
        </Field>
        <Field label="Dış bağlantı URL" name="externalUrl" errors={state.fieldErrors?.externalUrl}>
          <TextInput id="externalUrl" name="externalUrl" defaultValue={m.externalUrl ?? ""} />
        </Field>
      </div>

      <div className="mt-2">
        <Checkbox label="Öne çıkan (featured)" name="featured" defaultChecked={m.featured} />
        <Checkbox label="Görünür (visible)" name="visible" defaultChecked={m.visible} />
        <Checkbox label="Şirket adı gizli (NDA)" name="companyHidden" defaultChecked={m.companyHidden} />
        <Checkbox label="NDA projesi" name="nda" defaultChecked={m.nda} />
        <Checkbox label="Devam ediyor" name="isOngoing" defaultChecked={m.isOngoing} />
      </div>

      <SubmitButton pending={pending}>Meta bilgileri kaydet</SubmitButton>
    </form>
  );
}
