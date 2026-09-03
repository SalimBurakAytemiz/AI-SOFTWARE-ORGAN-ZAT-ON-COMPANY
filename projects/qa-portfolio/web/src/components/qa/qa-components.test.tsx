import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioTable } from "./scenario-table";
import { BugReportCard } from "./bug-report-card";
import { CoverageMeter } from "@/components/ui/coverage-meter";
import type { TestScenario, BugReport } from "@/lib/domain/project";

/**
 * QA bileşenleri render testleri (planning/11 - "QA components" + "Case Study
 * rendering"). Bu bileşenler etiketleri prop olarak alır (i18n bağlamı gerekmez).
 */
const scenarioLabels = {
  preconditions: "Ön koşullar",
  steps: "Adımlar",
  expected: "Beklenen",
  notes: "Notlar",
  automated: "Otomatik",
};

const bugLabels = {
  steps: "Adımlar",
  expected: "Beklenen",
  actual: "Gerçekleşen",
  rootCause: "Kök neden",
  resolution: "Çözüm",
  environment: "Ortam",
};

describe("ScenarioTable", () => {
  const scenarios: TestScenario[] = [
    {
      code: "TS-01",
      priority: "p0",
      kind: "e2e",
      automated: true,
      title: "Misafir kullanıcı siparişi tamamlar",
      preconditionsMd: "Stokta ürün var",
      stepsMd: "1. Sepete ekle\n2. Öde",
      expectedMd: "Sipariş oluşur",
      notesMd: null,
    },
  ];

  it("senaryo kodunu, önceliğini ve başlığını gösterir", () => {
    render(<ScenarioTable scenarios={scenarios} labels={scenarioLabels} />);
    expect(screen.getByText("TS-01")).toBeDefined();
    expect(screen.getByText("p0")).toBeDefined();
    expect(screen.getByText("Misafir kullanıcı siparişi tamamlar")).toBeDefined();
  });

  it("otomatik senaryo için 'Otomatik' etiketini gösterir", () => {
    render(<ScenarioTable scenarios={scenarios} labels={scenarioLabels} />);
    expect(screen.getByText("Otomatik")).toBeDefined();
  });

  it("boş liste -> hiçbir şey render etmez", () => {
    const { container } = render(<ScenarioTable scenarios={[]} labels={scenarioLabels} />);
    expect(container.firstChild).toBeNull();
  });

  it("<details> ile açılır-kapanır (JS gerektirmez)", () => {
    render(<ScenarioTable scenarios={scenarios} labels={scenarioLabels} />);
    const details = document.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.tagName).toBe("DETAILS");
  });
});

describe("BugReportCard", () => {
  const bug: BugReport = {
    code: "BUG-01",
    severity: "critical",
    state: "fixed",
    environment: "staging",
    title: "Çift tıklamada sipariş iki kez oluşuyor",
    summaryMd: "İki sipariş oluşuyordu.",
    stepsMd: "1. Hızlı iki kez tıkla",
    expectedMd: "Tek sipariş",
    actualMd: "İki sipariş",
    rootCauseMd: "Idempotency yok",
    resolutionMd: "Idempotency-Key eklendi",
  };

  it("kodu, önem ve durum pillerini, dolu alanları gösterir", () => {
    render(<BugReportCard bug={bug} labels={bugLabels} />);
    expect(screen.getByText("BUG-01")).toBeDefined();
    expect(screen.getByText("critical")).toBeDefined();
    expect(screen.getByText("fixed")).toBeDefined();
    expect(screen.getByText("Kök neden")).toBeDefined();
  });

  it("boş alanları göstermez", () => {
    const minimal: BugReport = { ...bug, rootCauseMd: null, resolutionMd: null };
    render(<BugReportCard bug={minimal} labels={bugLabels} />);
    expect(screen.queryByText("Kök neden")).toBeNull();
    expect(screen.queryByText("Çözüm")).toBeNull();
  });
});

describe("CoverageMeter", () => {
  it("role=meter ve aria değerlerini ayarlar (erişilebilirlik)", () => {
    render(<CoverageMeter label="Sepet" value={87.6} />);
    const meter = screen.getByRole("meter");
    expect(meter.getAttribute("aria-valuenow")).toBe("88"); // yuvarlanmış
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
  });

  it("değeri 0-100 aralığına sıkıştırır", () => {
    render(<CoverageMeter label="X" value={150} />);
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("100");
  });
});
