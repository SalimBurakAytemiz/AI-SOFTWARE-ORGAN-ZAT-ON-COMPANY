/**
 * Kapsam ölçer (coverage meter) - QA görsel dilinin parçası (planning/06 §6.6, §6.9).
 *
 * Erişilebilirlik: role="meter" + aria-valuenow/min/max ile ekran okuyuculara
 * sayısal değer bildirilir; yüzde ayrıca metin olarak da gösterilir (renk tek
 * başına bilgi taşımaz).
 */
export function CoverageMeter({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[8rem] text-sm text-[var(--text-muted)]">{label}</span>
      <div
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: %${clamped}`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
      >
        <div className="h-full bg-[var(--pass)]" style={{ width: `${clamped}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-[var(--text)]">%{clamped}</span>
    </div>
  );
}
