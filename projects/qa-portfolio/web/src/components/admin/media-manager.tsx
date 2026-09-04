"use client";

import { useActionState } from "react";
import Image from "next/image";
import {
  uploadMediaAction,
  deleteMediaAction,
} from "@/app/[locale]/admin/(protected)/media/actions";
import type { MediaItem } from "@/lib/repositories/admin-media-repository";
import type { FormState } from "@/app/[locale]/admin/(protected)/projects/actions";
import { Field, TextInput, FormMessage, SubmitButton } from "./form-fields";

const idle: FormState = { ok: false, error: null };

/**
 * MEDYA YÖNETİCİSİ: yükleme formu + mevcut medya listesi (public URL + sil).
 * Yalnızca admin görür; yükleme/silme sunucu tarafında `is_admin()` ile korunur.
 */
export function MediaManager({ items }: { items: MediaItem[] }) {
  const [upState, uploadAction, uploading] = useActionState<FormState, FormData>(uploadMediaAction, idle);
  const [delState, deleteAction, deleting] = useActionState<FormState, FormData>(deleteMediaAction, idle);

  return (
    <div className="space-y-6">
      <form action={uploadAction} className="max-w-lg rounded-[var(--radius-md)] border border-[var(--border)] p-4">
        <h2 className="mb-2 text-base font-semibold">Yeni görsel yükle</h2>
        <p className="mb-2 text-xs text-[var(--text-faint)]">
          İzinli: PNG, JPEG, WebP, AVIF · en fazla 5 MB. Tür sunucuda içerik
          imzasından doğrulanır.
        </p>
        <FormMessage error={upState.error} notice={upState.ok ? upState.notice : undefined} />

        <Field label="Dosya" name="file">
          <input
            id="file"
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            required
            className="mt-1 w-full text-sm"
          />
        </Field>
        <Field label="Alt metin (TR)" name="altTr" hint="Erişilebilirlik + SEO">
          <TextInput id="altTr" name="altTr" />
        </Field>
        <Field label="Alt metin (EN)" name="altEn">
          <TextInput id="altEn" name="altEn" />
        </Field>
        <SubmitButton pending={uploading}>Yükle</SubmitButton>
      </form>

      <div>
        <h2 className="mb-2 text-base font-semibold">Medya kütüphanesi ({items.length})</h2>
        <FormMessage error={delState.error} notice={delState.ok ? delState.notice : undefined} />
        {items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Henüz medya yok.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {items.map((m) => (
              <li key={m.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-2">
                <div className="relative aspect-video overflow-hidden rounded bg-[var(--bg-subtle)]">
                  <Image src={m.publicUrl} alt="" fill sizes="200px" className="object-contain" unoptimized />
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-faint)]" title={m.storagePath}>
                  {m.mimeType} · {(m.byteSize / 1024).toFixed(0)} KB
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <a href={m.publicUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--info)] underline">
                    Aç ↗
                  </a>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" disabled={deleting} className="text-[11px] text-[var(--fail)] disabled:opacity-50">
                      Sil
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
