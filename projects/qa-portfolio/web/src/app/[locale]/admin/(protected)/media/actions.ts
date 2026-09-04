"use server";

import { z } from "zod";
import { withAdminAction } from "@/lib/admin/action";
import type { FormState } from "@/lib/admin/form-state";
import { AdminMediaRepository } from "@/lib/repositories/admin-media-repository";

/**
 * MEDYA SERVER ACTION'LARI (FAZ 4, planning/10 §10.6).
 * Yükleme/silme `withAdminAction`ten geçer (authz + audit + revalidation).
 * Dosya doğrulaması (magic bytes, boyut) `AdminMediaRepository.upload` içinde.
 *
 * NOT: Bu dosyada "use server" olduğu için YALNIZCA async fonksiyon export
 * edilir; tip/sabit `@/lib/admin/form-state`ten gelir.
 */

export async function uploadMediaAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Bir dosya seçin." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const altTr = String(fd.get("altTr") ?? "");
  const altEn = String(fd.get("altEn") ?? "");

  const res = await withAdminAction(
    { size: bytes.length, type: file.type },
    {
      action: "upload",
      entity: "media",
      schema: z.object({ size: z.number().positive(), type: z.string() }),
      write: async () => {
        const repo = await AdminMediaRepository.create();
        const item = await repo.upload(bytes, file.type || undefined, { tr: altTr, en: altEn });
        return { id: item.id, summary: `medya yüklendi: ${item.storagePath} (${item.byteSize} bayt)`, data: item };
      },
    },
  );

  if (res.ok) return { ok: true, error: null, notice: "Yüklendi." };
  return { ok: false, error: res.message };
}

export async function deleteMediaAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("id") ?? "");
  const res = await withAdminAction(
    { id },
    {
      action: "delete",
      entity: "media",
      schema: z.object({ id: z.string().uuid() }),
      write: async (input) => {
        const repo = await AdminMediaRepository.create();
        const { storagePath } = await repo.delete(input.id);
        return { id: input.id, summary: `medya silindi: ${storagePath}`, data: null };
      },
    },
  );
  if (res.ok) return { ok: true, error: null, notice: "Silindi." };
  return { ok: false, error: res.message };
}
