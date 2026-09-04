import { describe, it, expect } from "vitest";
import { devServerActionAllowedOrigins } from "./server-action-origins";

/**
 * REGRESYON (bug: "Invalid Server Actions request" — Codespaces forwarded origin).
 *
 * Kural: dev origin whitelist'i YALNIZCA development'ta dolar (production'da boş),
 * wildcard içermez, ve Codespaces host'unu CODESPACE_NAME + domain'den türetir.
 */

describe("devServerActionAllowedOrigins", () => {
  it("production'da BOŞ döner (kalıcı güvenlik açığı bırakmaz)", () => {
    expect(
      devServerActionAllowedOrigins({
        NODE_ENV: "production",
        CODESPACE_NAME: "some-codespace",
        GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      }),
    ).toEqual([]);
  });

  it("development + Codespaces: localhost + bu Codespace'in tam host adı", () => {
    const origins = devServerActionAllowedOrigins({
      NODE_ENV: "development",
      CODESPACE_NAME: "turbo-potato-abc123",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
    });
    expect(origins).toContain("localhost:3000");
    expect(origins).toContain("127.0.0.1:3000");
    expect(origins).toContain("turbo-potato-abc123-3000.app.github.dev");
    expect(origins).toContain("turbo-potato-abc123-3001.app.github.dev");
  });

  it("development, Codespaces DIŞI: yalnızca localhost", () => {
    const origins = devServerActionAllowedOrigins({ NODE_ENV: "development" });
    expect(origins).toEqual(["localhost:3000", "127.0.0.1:3000"]);
  });

  it("hiçbir zaman wildcard içermez", () => {
    const origins = devServerActionAllowedOrigins({
      NODE_ENV: "development",
      CODESPACE_NAME: "cs",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
    });
    for (const o of origins) {
      expect(o).not.toContain("*");
    }
  });

  it("CODESPACE_NAME var ama domain yoksa Codespaces host'u eklenmez", () => {
    const origins = devServerActionAllowedOrigins({
      NODE_ENV: "development",
      CODESPACE_NAME: "cs",
    });
    expect(origins.some((o) => o.includes("github.dev"))).toBe(false);
  });
});
