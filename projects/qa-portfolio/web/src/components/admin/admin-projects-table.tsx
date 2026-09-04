"use client";

import { DataTable, type Column } from "./data-table";
import { StatusPill } from "@/components/qa/status-pill";
import { ProjectRowActions } from "./project-row-actions";

/**
 * Admin proje listesi tablosu (planning/05 §5.3).
 *
 * Durum göstergesi: ● yayında · ○ taslak · ◐ yayında-gizli · ▪ arşiv.
 * Çeviri boşluğu uyarısı: bir dil eksik/taslak ise "⚠TR" / "⚠EN".
 * Satır aksiyonları (Yayınla/Gizle/Arşivle) faz 3'te server action'larla bağlanacak.
 */
export interface AdminProjectRow {
  id: string;
  slug: string;
  titleTr: string;
  titleEn: string;
  classification: string;
  status: string;
  visible: boolean;
  featured: boolean;
  demo: boolean;
  updatedAt: string;
  translationStatus: { tr: string; en: string };
}

function statusLabel(row: AdminProjectRow): { symbol: string; text: string; tone: "pass" | "neutral" | "warn" } {
  if (row.status === "archived") return { symbol: "▪", text: "arşiv", tone: "neutral" };
  if (row.status === "draft") return { symbol: "○", text: "taslak", tone: "neutral" };
  if (row.status === "published" && !row.visible) return { symbol: "◐", text: "gizli", tone: "warn" };
  return { symbol: "●", text: "yayında", tone: "pass" };
}

export function AdminProjectsTable({
  rows,
  editHrefBase,
}: {
  rows: AdminProjectRow[];
  /** "/tr/admin/projects" gibi; satır düzenleme linki `${base}/${id}`. */
  editHrefBase?: string;
}) {
  const columns: Column<AdminProjectRow>[] = [
    {
      key: "title",
      header: "Başlık (TR / EN)",
      sortable: true,
      sortValue: (r) => r.titleTr.toLowerCase(),
      cell: (r) => (
        <div>
          <span className="text-[var(--text)]">{r.titleTr}</span>
          <span className="text-[var(--text-faint)]"> / </span>
          <span className="text-[var(--text-muted)]">{r.titleEn}</span>
          {r.demo && <span className="ml-2 font-mono text-[10px] text-[var(--info)]">DEMO</span>}
          <div className="font-mono text-[11px] text-[var(--text-faint)]">/{r.slug}</div>
        </div>
      ),
    },
    {
      key: "classification",
      header: "Sınıf",
      sortable: true,
      sortValue: (r) => r.classification,
      cell: (r) => <span className="font-mono text-xs">{r.classification}</span>,
    },
    {
      key: "status",
      header: "Durum",
      sortable: true,
      sortValue: (r) => r.status + (r.visible ? "1" : "0"),
      cell: (r) => {
        const s = statusLabel(r);
        return (
          <StatusPill tone={s.tone}>
            {s.symbol} {s.text}
          </StatusPill>
        );
      },
    },
    {
      key: "translation",
      header: "Çeviri",
      cell: (r) => (
        <span className="font-mono text-[11px]">
          {r.translationStatus.tr !== "published" && (
            <span className="text-[var(--warn)]">⚠TR </span>
          )}
          {r.translationStatus.en !== "published" && (
            <span className="text-[var(--warn)]">⚠EN</span>
          )}
          {r.translationStatus.tr === "published" && r.translationStatus.en === "published" && (
            <span className="text-[var(--text-faint)]">✓</span>
          )}
        </span>
      ),
    },
    {
      key: "featured",
      header: "Öne çıkan",
      sortable: true,
      sortValue: (r) => (r.featured ? 1 : 0),
      cell: (r) => (r.featured ? "★" : ""),
    },
  ];

  if (editHrefBase) {
    columns.push({
      key: "actions",
      header: "İşlemler",
      cell: (r) => (
        <ProjectRowActions
          id={r.id}
          slug={r.slug}
          status={r.status}
          visible={r.visible}
          editHref={`${editHrefBase}/${r.id}`}
        />
      ),
    });
  }

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      searchPlaceholder="Başlık veya slug ara…"
      searchValue={(r) => `${r.titleTr} ${r.titleEn} ${r.slug}`}
      filter={{
        label: "Duruma göre",
        options: [
          { value: "draft", label: "Taslak" },
          { value: "published", label: "Yayında" },
          { value: "hidden", label: "Yayında-gizli" },
          { value: "archived", label: "Arşiv" },
        ],
        predicate: (r, v) => {
          if (v === "hidden") return r.status === "published" && !r.visible;
          if (v === "published") return r.status === "published" && r.visible;
          return r.status === v;
        },
      }}
      emptyLabel="Proje bulunamadı."
    />
  );
}
