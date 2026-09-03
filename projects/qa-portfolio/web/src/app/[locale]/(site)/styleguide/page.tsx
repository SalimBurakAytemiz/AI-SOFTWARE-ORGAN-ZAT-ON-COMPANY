import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoverageMeter } from "@/components/ui/coverage-meter";
import { Skeleton, CardGridSkeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/qa/status-pill";
import { CodeBlock } from "@/components/qa/code-block";
import { ScenarioTable } from "@/components/qa/scenario-table";
import { BugReportCard } from "@/components/qa/bug-report-card";
import { SafeMarkdown } from "@/components/content/safe-markdown";

/**
 * TASARIM SİSTEMİ BİLEŞEN GALERİSİ (planning/06 §6.10, planning/07 T-0209).
 *
 * Her bileşeni her durumda gösterir. Görsel regresyon testleri (Playwright
 * ekran görüntüsü) bu sayfayı temel alır. Sitemap'e DAHİL EDİLMEZ, noindex.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StyleguidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="py-14" data-testid="styleguide">
      <Container>
        <h1 className="text-3xl font-semibold">Tasarım Sistemi — Bileşen Galerisi</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          planning/06-design-system.md karşılığı. Görsel regresyon temeli.
        </p>

        <Section title="Renk token'ları">
          <div className="flex flex-wrap gap-3">
            {["--bg", "--surface", "--surface-raised", "--border", "--accent", "--pass", "--fail", "--warn", "--info"].map(
              (token) => (
                <div key={token} className="text-center">
                  <div
                    className="h-14 w-20 rounded-[var(--radius-sm)] border border-[var(--border-strong)]"
                    style={{ background: `var(${token})` }}
                  />
                  <code className="mt-1 block font-mono text-[10px] text-[var(--text-faint)]">{token}</code>
                </div>
              ),
            )}
          </div>
        </Section>

        <Section title="Butonlar">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Birincil</Button>
            <Button variant="secondary">İkincil</Button>
            <Button variant="ghost">Hayalet</Button>
            <Button variant="primary" disabled>
              Devre dışı
            </Button>
            <Button variant="primary" size="sm">
              Küçük
            </Button>
            <Button variant="primary" size="lg">
              Büyük
            </Button>
          </div>
        </Section>

        <Section title="Rozetler (Badge)">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Kişisel</Badge>
            <Badge tone="accent">Destek Verilen</Badge>
            <Badge tone="info">DEMO</Badge>
            <Badge tone="warn">NDA</Badge>
            <Badge tone="fail">Hata</Badge>
          </div>
        </Section>

        <Section title="Durum pilleri (QA görsel dili)">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="pass">PASS</StatusPill>
            <StatusPill tone="fail">FAIL</StatusPill>
            <StatusPill tone="warn">FLAKY</StatusPill>
            <StatusPill tone="info">AUTOMATED</StatusPill>
            <StatusPill tone="neutral">SKIPPED</StatusPill>
          </div>
        </Section>

        <Section title="Kapsam ölçer (Coverage meter)">
          <div className="max-w-md space-y-2">
            <CoverageMeter label="Sepet ve fiyatlandırma" value={88} />
            <CoverageMeter label="Ödeme yöntemleri" value={62} />
            <CoverageMeter label="Kupon / hediye kartı" value={35} />
          </div>
        </Section>

        <Section title="Kod bloğu">
          <CodeBlock
            code={'{\n  "order_id": "DEMO-ord-55021",\n  "status": "confirmed"\n}'}
            language="json"
            label="response"
          />
        </Section>

        <Section title="Güvenli Markdown (sanitize edilmiş)">
          <SafeMarkdown>
            {"## Alt başlık\n\n- madde bir\n- madde iki\n\n**kalın**, `kod` ve [bağlantı](https://example.com)."}
          </SafeMarkdown>
        </Section>

        <Section title="Senaryo tablosu">
          <ScenarioTable
            scenarios={[
              {
                code: "TS-01",
                priority: "p0",
                kind: "e2e",
                automated: true,
                title: "Örnek senaryo",
                preconditionsMd: "Ön koşul metni",
                stepsMd: "1. Adım bir\n2. Adım iki",
                expectedMd: "Beklenen sonuç",
                notesMd: null,
              },
            ]}
            labels={{
              preconditions: "Ön koşullar",
              steps: "Adımlar",
              expected: "Beklenen",
              notes: "Notlar",
              automated: "Otomatik",
            }}
          />
        </Section>

        <Section title="Bug kartı">
          <BugReportCard
            bug={{
              code: "BUG-01",
              severity: "critical",
              state: "fixed",
              environment: "staging",
              title: "Örnek bug",
              summaryMd: "Kısa özet.",
              stepsMd: "1. Tekrar üret",
              expectedMd: "Beklenen",
              actualMd: "Gerçekleşen",
              rootCauseMd: "Kök neden",
              resolutionMd: "Çözüm",
            }}
            labels={{
              steps: "Adımlar",
              expected: "Beklenen",
              actual: "Gerçekleşen",
              rootCause: "Kök neden",
              resolution: "Çözüm",
              environment: "Ortam",
            }}
          />
        </Section>

        <Section title="İskelet (Skeleton) / yükleme">
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <CardGridSkeleton count={3} />
          </div>
        </Section>
      </Container>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-[var(--border)] pt-6">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-wide text-[var(--text-faint)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
