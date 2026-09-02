/**
 * Provider rate-limit metadata (build spec sections 12, 14, 27, 31).
 *
 * Free-tier OpenAI-compatible providers (Groq, OpenRouter, ...) advertise their
 * remaining request/token budget and the reset window on EVERY response via
 * `x-ratelimit-*` headers, and a `Retry-After` header on 429. The runtime learns
 * limits from those headers rather than hard-coding any single provider's plan.
 *
 * NOTHING in this module reads or touches a credential. A `RateLimitSnapshot` is
 * pure numbers + millisecond durations - safe to persist in telemetry and the
 * audit ledger.
 */

/** Header names this module understands (all lower-case, case-insensitive lookup). */
export const RATE_LIMIT_HEADERS = [
  "retry-after",
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "x-ratelimit-reset-tokens",
] as const;

export interface RateLimitSnapshot {
  /** HTTP status the snapshot was observed on (200 on a normal response, 429 on a limit). */
  httpStatus: number;
  /** Milliseconds since epoch the snapshot was taken (from the injected clock). */
  observedAtMs: number;
  /** `Retry-After` converted to milliseconds, or null when absent. */
  retryAfterMs: number | null;
  limitRequests: number | null;
  remainingRequests: number | null;
  /** `x-ratelimit-reset-requests` as a millisecond duration from `observedAtMs`. */
  resetRequestsMs: number | null;
  limitTokens: number | null;
  remainingTokens: number | null;
  /** `x-ratelimit-reset-tokens` as a millisecond duration from `observedAtMs`. */
  resetTokensMs: number | null;
}

export type HeaderGetter =
  | Headers
  | { get(name: string): string | null | undefined }
  | Record<string, string | undefined>;

function headerValue(src: HeaderGetter, name: string): string | undefined {
  if (typeof (src as { get?: unknown }).get === "function") {
    return (src as { get(n: string): string | null | undefined }).get(name) ?? undefined;
  }
  const rec = src as Record<string, string | undefined>;
  return rec[name] ?? rec[name.toLowerCase()] ?? undefined;
}

/** Parse a non-negative integer, else null. */
function intOrNull(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v.trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Parse a provider reset value into a millisecond duration. Handles the two
 * shapes free providers use:
 *   - a bare number of seconds:            "120"      -> 120000
 *   - a Go-style duration string:          "2m59.56s" -> 179560
 *                                          "7.66s"    -> 7660
 *                                          "850ms"    -> 850
 */
export function parseResetDurationMs(v: string | undefined): number | null {
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  if (s === "") return null;

  // Bare number => seconds.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
  }

  // Go-style compound duration: <n>h<n>m<n>s / <n>ms etc.
  const re = /(\d+(?:\.\d+)?)\s*(ms|s|m|h)/g;
  let ms = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    matched = true;
    const n = Number(m[1]);
    switch (m[2]) {
      case "ms": ms += n; break;
      case "s": ms += n * 1000; break;
      case "m": ms += n * 60_000; break;
      case "h": ms += n * 3_600_000; break;
    }
  }
  return matched ? Math.round(ms) : null;
}

/**
 * Parse `Retry-After` into milliseconds. Per RFC 7231 it is either delta-seconds
 * or an HTTP-date; free providers use delta-seconds.
 */
export function parseRetryAfterMs(v: string | undefined, nowMs: number): number | null {
  if (v == null) return null;
  const s = v.trim();
  if (/^\d+$/.test(s)) return Math.max(0, Number(s) * 1000);
  const asDate = Date.parse(s);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - nowMs);
  // Some providers put a Go duration in Retry-After too.
  return parseResetDurationMs(s);
}

/** Build a snapshot from response headers. `nowMs` comes from the injected clock. */
export function parseRateLimitHeaders(
  headers: HeaderGetter,
  httpStatus: number,
  nowMs: number,
): RateLimitSnapshot {
  return {
    httpStatus,
    observedAtMs: nowMs,
    retryAfterMs: parseRetryAfterMs(headerValue(headers, "retry-after"), nowMs),
    limitRequests: intOrNull(headerValue(headers, "x-ratelimit-limit-requests")),
    remainingRequests: intOrNull(headerValue(headers, "x-ratelimit-remaining-requests")),
    resetRequestsMs: parseResetDurationMs(headerValue(headers, "x-ratelimit-reset-requests")),
    limitTokens: intOrNull(headerValue(headers, "x-ratelimit-limit-tokens")),
    remainingTokens: intOrNull(headerValue(headers, "x-ratelimit-remaining-tokens")),
    resetTokensMs: parseResetDurationMs(headerValue(headers, "x-ratelimit-reset-tokens")),
  };
}

/** True when the snapshot actually carried any rate-limit information. */
export function hasRateLimitInfo(s: RateLimitSnapshot | null | undefined): boolean {
  if (!s) return false;
  return (
    s.retryAfterMs != null ||
    s.limitRequests != null ||
    s.remainingRequests != null ||
    s.resetRequestsMs != null ||
    s.limitTokens != null ||
    s.remainingTokens != null ||
    s.resetTokensMs != null
  );
}

/**
 * A flat, credential-free record for the audit ledger / telemetry attributes.
 * Every value is a number or null - there is nothing here that could be a secret.
 */
export function rateLimitTelemetry(s: RateLimitSnapshot | null | undefined): Record<string, number | null> {
  return {
    http_status: s?.httpStatus ?? null,
    retry_after_ms: s?.retryAfterMs ?? null,
    limit_requests: s?.limitRequests ?? null,
    remaining_requests: s?.remainingRequests ?? null,
    reset_requests_ms: s?.resetRequestsMs ?? null,
    limit_tokens: s?.limitTokens ?? null,
    remaining_tokens: s?.remainingTokens ?? null,
    reset_tokens_ms: s?.resetTokensMs ?? null,
  };
}

/** One-line, founder-readable summary. */
export function rateLimitSummary(s: RateLimitSnapshot | null | undefined): string {
  if (!hasRateLimitInfo(s)) return "no rate-limit headers reported";
  const parts: string[] = [];
  if (s!.remainingRequests != null) parts.push(`req ${s!.remainingRequests}/${s!.limitRequests ?? "?"}`);
  if (s!.remainingTokens != null) parts.push(`tok ${s!.remainingTokens}/${s!.limitTokens ?? "?"}`);
  if (s!.retryAfterMs != null) parts.push(`retry-after ${Math.round(s!.retryAfterMs / 1000)}s`);
  if (s!.resetRequestsMs != null) parts.push(`req-reset ${Math.round(s!.resetRequestsMs / 1000)}s`);
  if (s!.resetTokensMs != null) parts.push(`tok-reset ${Math.round(s!.resetTokensMs / 1000)}s`);
  return parts.join(", ");
}
