"use client";

import { useActionState } from "react";
import Link from "next/link";
import { transitionProjectAction, type FormState } from "@/app/[locale]/admin/(protected)/projects/actions";

const idle: FormState = { ok: false, error: null };

/**
 * Proje listesi satır aksiyonları: düzenle + duruma göre yayın geçişleri.
 *
 * Geçişler `transitionProjectAction` (RPC, atomik audit) üzerinden. Geçersiz
 * geçiş butonları gösterilmez (ör. taslak projede "Yayından kaldır" yok).
 */
export function ProjectRowActions({
  id,
  slug,
  status,
  visible,
  editHref,
}: {
  id: string;
  slug: string;
  status: string;
  visible: boolean;
  editHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    transitionProjectAction,
    idle,
  );

  const btn =
    "rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] hover:bg-[var(--bg-subtle)] disabled:opacity-50";

  const transitions: { t: string; label: string }[] = [];
  if (status === "draft") transitions.push({ t: "publish", label: "Yayınla" });
  if (status === "published") {
    transitions.push({ t: "unpublish", label: "Yayından al" });
    transitions.push(visible ? { t: "hide", label: "Gizle" } : { t: "show", label: "Göster" });
    transitions.push({ t: "archive", label: "Arşivle" });
  }
  if (status === "archived") transitions.push({ t: "restore", label: "Geri yükle" });
  if (status === "draft") transitions.push({ t: "archive", label: "Arşivle" });

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link href={editHref} className={btn}>
        Düzenle
      </Link>
      {transitions.map(({ t, label }) => (
        <form key={t} action={formAction} className="inline">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="transition" value={t} />
          <button type="submit" className={btn} disabled={pending} aria-label={`${slug}: ${label}`}>
            {label}
          </button>
        </form>
      ))}
      {state.error ? (
        <span role="alert" className="text-[11px] text-[var(--fail)]">
          {state.error}
        </span>
      ) : null}
    </div>
  );
}
