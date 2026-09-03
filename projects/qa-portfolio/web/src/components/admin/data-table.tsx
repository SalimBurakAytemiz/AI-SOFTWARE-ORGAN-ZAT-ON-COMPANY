"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * ADMIN DATA TABLE (planning/05 §5.3, planning/07 T-0706).
 *
 * Yeniden kullanılabilir liste: arama, kolon sıralama, basit filtre.
 * Projeler / deneyim / hizmetler / medya vb. listelerinde kullanılır.
 * Sürükle-sırala (display_order) faz 3'te eklenecek.
 *
 * Erişilebilirlik: <table> semantiği, sıralama butonları aria-sort ile.
 */
export interface Column<T> {
  key: string;
  header: string;
  /** Hücre içeriği. */
  cell: (row: T) => React.ReactNode;
  /** Sıralama/arama için düz değer. */
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
}

export interface DataTableFilter<T> {
  label: string;
  options: { value: string; label: string }[];
  predicate: (row: T, value: string) => boolean;
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  searchPlaceholder,
  searchValue,
  filter,
  emptyLabel,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  searchPlaceholder: string;
  /** Aranan metni bir satırdan çıkarır. */
  searchValue: (row: T) => string;
  filter?: DataTableFilter<T>;
  emptyLabel: string;
}) {
  const [q, setQ] = useState("");
  const [filterVal, setFilterVal] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const visible = useMemo(() => {
    let out = rows;
    if (q.trim()) {
      const needle = q.toLowerCase();
      out = out.filter((r) => searchValue(r).toLowerCase().includes(needle));
    }
    if (filter && filterVal) {
      out = out.filter((r) => filter.predicate(r, filterVal));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, q, filter, filterVal, sortKey, sortDir, columns, searchValue]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 min-w-[200px] flex-1 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
        />
        {filter && (
          <select
            value={filterVal}
            onChange={(e) => setFilterVal(e.target.value)}
            aria-label={filter.label}
            className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <span className="font-mono text-xs text-[var(--text-faint)]">{visible.length}</span>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-strong)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                  }
                  className="p-2 text-left font-mono text-[11px] uppercase tracking-wide text-[var(--text-faint)]"
                >
                  {c.sortable && c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-[var(--text)]"
                    >
                      {c.header}
                      <span aria-hidden>
                        {sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-[var(--text-muted)]">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr
                  key={getRowId(row)}
                  className={cn("border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-raised)]")}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="p-2 align-top">
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
