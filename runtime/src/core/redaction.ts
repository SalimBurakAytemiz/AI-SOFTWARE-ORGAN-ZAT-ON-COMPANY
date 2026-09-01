// Secret redaction. Applied to every audit record and every telemetry attribute
// before it is persisted or exported (build spec sections 17, 35, 40).

const SECRET_KEY_RE =
  /(pass(word)?|secret|token|api[_-]?key|apikey|authorization|auth|bearer|credential|private[_-]?key|access[_-]?key|client[_-]?secret|session|cookie)/i;

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\b(sk|pk|rk)-[A-Za-z0-9]{16,}\b/g, // provider-style keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub tokens
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, // Slack tokens
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export const REDACTED = "[REDACTED]";

export function redactString(input: string): string {
  let out = input;
  for (const re of SECRET_VALUE_PATTERNS) out = out.replace(re, REDACTED);
  return out;
}

/** Deep-redact a value: mask secret-looking keys, scrub secret-looking substrings. */
export function redactSecrets<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(walk);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? REDACTED : walk(v);
    }
    return out;
  }
  return value;
}

/** True if a string plausibly contains secret material (used by pre-flight checks). */
export function looksLikeSecret(input: string): boolean {
  return SECRET_VALUE_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(input);
  });
}
