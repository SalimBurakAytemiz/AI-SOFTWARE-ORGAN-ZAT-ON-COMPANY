import { Container } from "@/components/ui/container";

/**
 * Faz 1 için ortak "placeholder sayfa" gövdesi.
 *
 * Bu sayfaların tam içeriği ve veri bağlantıları sonraki fazlarda gelecek
 * (planning/07 EPIC 06/13). Şu an gezinme bütünlüğü için iskelet gösterilir;
 * gerçek profesyonel bilgi UYDURULMAZ (ADR-0008).
 */
export function PlaceholderPage({
  title,
  description,
  phaseNote,
}: {
  title: string;
  description: string;
  phaseNote: string;
}) {
  return (
    <section className="py-14">
      <Container prose>
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--text)]">{title}</h1>
        <p className="mt-3 text-[var(--text-muted)]">{description}</p>
        <p className="mt-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 font-mono text-sm text-[var(--text-faint)]">
          {phaseNote}
        </p>
      </Container>
    </section>
  );
}
