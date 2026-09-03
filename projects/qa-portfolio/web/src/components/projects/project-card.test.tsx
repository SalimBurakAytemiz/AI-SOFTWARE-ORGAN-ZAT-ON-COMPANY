import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/render-intl";
import { ProjectCard } from "./project-card";
import type { ProjectSummary } from "@/lib/domain/project";

/**
 * Proje kartı bileşen testi (planning/04 §4.2, planning/02 §2.4 NDA kuralı,
 * ADR-0008 DEMO işareti).
 */
const base: ProjectSummary = {
  slug: "ornek-proje",
  classification: "professional",
  featured: true,
  supported: false,
  nda: false,
  company: "Acme A.Ş.",
  companyHidden: false,
  displayOrder: 1,
  title: "Örnek proje başlığı",
  summary: "Kısa özet metni.",
  roleTitle: "QA Mühendisi",
  taxonomy: ["Web", "API", "Playwright", "Fazladan"],
  demo: false,
};

describe("ProjectCard", () => {
  it("başlık, rol ve şirketi gösterir; vaka çalışmasına link verir", () => {
    renderWithIntl(<ProjectCard project={base} />);
    expect(screen.getByRole("heading", { name: "Örnek proje başlığı" })).toBeDefined();
    expect(screen.getByText(/QA Mühendisi · Acme A\.Ş\./)).toBeDefined();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toContain("/projects/ornek-proje");
  });

  it("NDA / gizli şirkette 'Confidential' gösterir, gerçek adı sızdırmaz", () => {
    renderWithIntl(
      <ProjectCard project={{ ...base, nda: true, companyHidden: true, company: null }} />,
    );
    expect(screen.getByText(/Confidential/)).toBeDefined();
    expect(screen.queryByText(/Acme/)).toBeNull();
    expect(screen.getByText("NDA")).toBeDefined();
  });

  it("DEMO içerikte DEMO rozeti gösterir (ADR-0008)", () => {
    renderWithIntl(<ProjectCard project={{ ...base, demo: true }} />);
    expect(screen.getByText("DEMO")).toBeDefined();
  });

  it("en fazla 3 taksonomi etiketi gösterir", () => {
    renderWithIntl(<ProjectCard project={base} />);
    expect(screen.getByText("Web")).toBeDefined();
    expect(screen.getByText("Playwright")).toBeDefined();
    expect(screen.queryByText("Fazladan")).toBeNull();
  });

  it("kart başlığı <h3> (heading-order: sayfada gizli bir <h2> ile birlikte)", () => {
    renderWithIntl(<ProjectCard project={base} />);
    expect(screen.getByRole("heading", { name: "Örnek proje başlığı", level: 3 })).toBeDefined();
  });
});
