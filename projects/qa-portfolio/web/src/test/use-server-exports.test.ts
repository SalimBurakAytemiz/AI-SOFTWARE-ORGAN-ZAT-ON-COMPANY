import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * STATİK DOĞRULAMA (regresyon): bir `"use server"` dosyası YALNIZCA async
 * fonksiyon export edebilir.
 *
 * Bug: `projects/actions.ts` bir sabit (`idle` FormState objesi) export ediyordu
 * -> Next.js runtime: "A 'use server' file can only export async functions,
 * found object". Bu test tüm Server Action modüllerini tarar ve object / const /
 * non-async function / value re-export'u yakalar (build'den önce, hızlı).
 *
 * Tip export'ları (`export interface` / `export type` / `export type { ... }`)
 * derlemede silindiği için serbesttir.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function hasUseServerDirective(source: string): boolean {
  // Dosyanın başındaki (yorumlar hariç) ilk ifade "use server" mı?
  const head = source.replace(/^﻿/, "").trimStart();
  return /^(["'])use server\1\s*;?/.test(head);
}

/** Bir "use server" dosyasında izin verilmeyen export satırlarını döndürür. */
function illegalExports(source: string): string[] {
  const bad: string[] = [];
  const lines = source.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("export")) continue;

    // İzinli: async fonksiyonlar
    if (/^export\s+async\s+function\s/.test(line)) continue;
    // İzinli: tip-yalnızca export'lar (derlemede silinir)
    if (/^export\s+(interface|type)\s/.test(line)) continue;
    if (/^export\s+type\s*\{/.test(line)) continue;
    if (/^export\s*\{\s*type\s/.test(line)) continue;

    // İzin verilmeyen her şey: const/let/var, non-async function, default,
    // değer re-export'u (`export { x }`), class...
    bad.push(line);
  }
  return bad;
}

describe("'use server' dosyaları yalnızca async fonksiyon export eder", () => {
  const serverFiles = walk(SRC).filter((f) => hasUseServerDirective(readFileSync(f, "utf8")));

  it("en az bir Server Action modülü bulundu (tarama çalışıyor)", () => {
    expect(serverFiles.length).toBeGreaterThan(0);
  });

  for (const file of serverFiles) {
    const rel = file.slice(SRC.length + 1);
    it(`${rel} — değer/obje/non-async export yok`, () => {
      expect(illegalExports(readFileSync(file, "utf8"))).toEqual([]);
    });
  }
});
