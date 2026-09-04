"use client";

import { useActionState } from "react";
import { createProjectAction, type FormState } from "@/app/[locale]/admin/(protected)/projects/actions";
import { Field, TextInput, Select, FormMessage, SubmitButton } from "./form-fields";

const idle: FormState = { ok: false, error: null };

/**
 * Yeni proje formu. Proje HER ZAMAN taslak başlar (planning/02 §2.8). Kaydedince
 * düzenleme sayfasına yönlenir; içerik oradan girilir.
 */
export function NewProjectForm({ locale }: { locale: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProjectAction, idle);

  return (
    <form action={formAction} className="max-w-lg">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage error={state.error} />

      <Field label="Slug" name="slug" hint="URL'de görünür: /projects/<slug>. Küçük harf ve tire." errors={state.fieldErrors?.slug}>
        <TextInput id="slug" name="slug" required placeholder="ornek-proje-slug" />
      </Field>

      <Field label="Sınıflandırma" name="classification" errors={state.fieldErrors?.classification}>
        <Select id="classification" name="classification" defaultValue="professional">
          <option value="professional">Profesyonel</option>
          <option value="supported">Destek verilen</option>
          <option value="personal">Kişisel</option>
          <option value="qa_lab">QA Lab</option>
        </Select>
      </Field>

      <Field label="Başlık (TR)" name="titleTr" errors={state.fieldErrors?.titleTr}>
        <TextInput id="titleTr" name="titleTr" required />
      </Field>
      <Field label="Başlık (EN)" name="titleEn" errors={state.fieldErrors?.titleEn}>
        <TextInput id="titleEn" name="titleEn" required />
      </Field>

      <SubmitButton pending={pending}>Oluştur (taslak)</SubmitButton>
    </form>
  );
}
