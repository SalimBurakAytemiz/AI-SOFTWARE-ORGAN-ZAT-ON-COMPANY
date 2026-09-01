export function table(rows: string[][], headers?: string[]): string {
  const all = headers ? [headers, ...rows] : rows;
  const widths: number[] = [];
  for (const row of all) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, stripAnsi(cell).length);
    });
  }
  const fmt = (row: string[]) =>
    row.map((c, i) => c + " ".repeat((widths[i] ?? 0) - stripAnsi(c).length)).join("  ");
  const out: string[] = [];
  if (headers) {
    out.push(fmt(headers));
    out.push(widths.map((w) => "-".repeat(w)).join("  "));
  }
  for (const r of rows) out.push(fmt(r));
  return out.join("\n");
}

export function kv(pairs: [string, string | number | null | undefined][]): string {
  const width = Math.max(...pairs.map(([k]) => k.length));
  return pairs
    .map(([k, v]) => `  ${k.padEnd(width)}  ${v ?? "-"}`)
    .join("\n");
}

export function heading(text: string): string {
  return `\n${text}\n${"=".repeat(text.length)}`;
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*m/g, "");
}

export function parseFlags(args: string[]): {
  positionals: string[];
  flags: Record<string, string | boolean>;
} {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}
