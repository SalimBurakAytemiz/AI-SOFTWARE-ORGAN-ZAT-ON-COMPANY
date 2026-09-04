import { AdminContentRepository } from "@/lib/repositories/admin-content-repository";
import { getAuditRepository } from "@/lib/admin/audit";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Admin kontrol paneli (planning/05 §5.2) - gerçek Supabase sayaçları + son
 * etkinlik (content_audit). Mock admin senaryosunda basit bilgi gösterir.
 */
export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const mockAdmin = process.env.AI_COMPANY_MOCK_ADMIN === "1";

  if (mockAdmin || !isSupabaseConfigured) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Kontrol Paneli</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Gerçek sayaçlar Supabase yapılandırıldığında görünür (mock admin modu).
        </p>
      </div>
    );
  }

  const repo = await AdminContentRepository.create();
  const [counts, recent] = await Promise.all([
    repo.projectCounts(),
    getAuditRepository().list(15),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Kontrol Paneli</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Yayınlanan proje" value={counts.published} />
        <Stat label="Taslak proje" value={counts.draft} />
        <Stat label="Arşivlenen proje" value={counts.archived} />
        <Stat label="Öne çıkan (featured)" value={counts.featured} />
        <Stat label="Destek verilen (supported)" value={counts.supported} />
        <Stat label="QA Lab girişi" value={counts.qaLab} />
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">Son değişiklikler</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Henüz kayıtlı işlem yok.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {recent.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span>
                  <span className="font-mono text-xs text-[var(--info)]">{e.action}</span>{" "}
                  <span className="text-[var(--text-muted)]">{e.entityType}</span> — {e.summary}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-[var(--text-faint)]">
                  {new Date(e.createdAt).toLocaleString("tr-TR")} · {e.actorName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
