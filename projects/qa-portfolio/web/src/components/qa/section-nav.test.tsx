import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionNavMobile, SectionNavRail } from "./section-nav";

/**
 * Bölüm navigasyonu bileşen testleri (planning/14 review R2).
 * SectionNavMobile: <details> açılır menü (JS gerektirmez).
 * SectionNavRail: istemci; IntersectionObserver jsdom'da yok -> effect atlanır.
 */
const sections = [
  { id: "overview", label: "Genel bakış" },
  { id: "scope", label: "Kapsam" },
  { id: "bugs", label: "Bug örnekleri" },
];

describe("SectionNavMobile", () => {
  it("her bölüm için #id çapası olan bir <details> render eder", () => {
    render(<SectionNavMobile sections={sections} heading="Bu sayfada" />);
    const details = document.querySelector("details");
    expect(details).not.toBeNull();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#overview", "#scope", "#bugs"]);
  });

  it("2'den az bölümde null döner (navigasyon gereksiz)", () => {
    const { container } = render(
      <SectionNavMobile sections={[{ id: "x", label: "X" }]} heading="h" />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("SectionNavRail", () => {
  it("<nav aria-label> ve çapa listesi render eder", () => {
    render(<SectionNavRail sections={sections} heading="Bu sayfada" />);
    const nav = screen.getByRole("navigation", { name: "Bu sayfada" });
    expect(nav).toBeDefined();
    // İlk bölüm başlangıçta aktif (aria-current)
    const current = screen.getByText("Genel bakış");
    expect(current.getAttribute("aria-current")).toBe("true");
  });

  it("2'den az bölümde null döner", () => {
    const { container } = render(<SectionNavRail sections={[]} heading="h" />);
    expect(container.firstChild).toBeNull();
  });
});
