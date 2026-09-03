import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodeBlock } from "./code-block";

/**
 * Kod bloğu bileşen testi (planning/10 §10.7 - içerik metin düğümü olarak,
 * dangerouslySetInnerHTML YOK; planning/16 - kaydırılabilir bölge klavye erişimi).
 */
describe("CodeBlock", () => {
  it("kodu metin olarak render eder (JSX kaçışlı, HTML enjeksiyonu yok)", () => {
    render(<CodeBlock code={'{"a": "<script>alert(1)</script>"}'} language="json" />);
    const code = screen.getByText(/<script>alert\(1\)<\/script>/);
    expect(code.tagName).toBe("CODE");
    // Gerçek bir <script> DOM'a girmemeli
    expect(document.querySelector("script")).toBeNull();
  });

  it("kaydırılabilir <pre> tabIndex=0 + role=region + aria-label taşır", () => {
    render(<CodeBlock code="select 1;" language="sql" label="sql" />);
    const region = screen.getByRole("region", { name: "sql" });
    expect(region.tagName).toBe("PRE");
    expect(region.getAttribute("tabindex")).toBe("0");
  });

  it("etiket verilmezse dil adını gösterir", () => {
    render(<CodeBlock code="x" language="json" />);
    expect(screen.getAllByText("json").length).toBeGreaterThan(0);
  });
});
