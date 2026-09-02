import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseResetDurationMs,
  parseRetryAfterMs,
  parseRateLimitHeaders,
  rateLimitTelemetry,
  hasRateLimitInfo,
} from "../src/models/rate-limit.ts";

const NOW = Date.parse("2026-09-01T12:00:00.000Z");

test("parseResetDurationMs: bare seconds, Go-style durations, ms", () => {
  assert.equal(parseResetDurationMs("120"), 120_000);
  assert.equal(parseResetDurationMs("7.66s"), 7_660);
  assert.equal(parseResetDurationMs("2m59.56s"), 179_560);
  assert.equal(parseResetDurationMs("1h30m"), 5_400_000);
  assert.equal(parseResetDurationMs("850ms"), 850);
  assert.equal(parseResetDurationMs(""), null);
  assert.equal(parseResetDurationMs(undefined), null);
  assert.equal(parseResetDurationMs("soon"), null);
});

test("parseRetryAfterMs: delta-seconds and HTTP-date", () => {
  assert.equal(parseRetryAfterMs("7", NOW), 7_000);
  assert.equal(parseRetryAfterMs("0", NOW), 0);
  const in10s = new Date(NOW + 10_000).toUTCString();
  assert.equal(parseRetryAfterMs(in10s, NOW), 10_000);
  assert.equal(parseRetryAfterMs(undefined, NOW), null);
});

test("parseRateLimitHeaders: reads every documented header into a safe snapshot", () => {
  const headers = new Headers({
    "retry-after": "5",
    "x-ratelimit-limit-requests": "30",
    "x-ratelimit-remaining-requests": "0",
    "x-ratelimit-reset-requests": "12.5s",
    "x-ratelimit-limit-tokens": "6000",
    "x-ratelimit-remaining-tokens": "120",
    "x-ratelimit-reset-tokens": "1m2s",
  });
  const s = parseRateLimitHeaders(headers, 429, NOW);
  assert.equal(s.httpStatus, 429);
  assert.equal(s.retryAfterMs, 5_000);
  assert.equal(s.limitRequests, 30);
  assert.equal(s.remainingRequests, 0);
  assert.equal(s.resetRequestsMs, 12_500);
  assert.equal(s.limitTokens, 6000);
  assert.equal(s.remainingTokens, 120);
  assert.equal(s.resetTokensMs, 62_000);
  assert.equal(hasRateLimitInfo(s), true);
});

test("parseRateLimitHeaders: absent headers -> all null, hasRateLimitInfo false", () => {
  const s = parseRateLimitHeaders(new Headers(), 200, NOW);
  assert.equal(hasRateLimitInfo(s), false);
  for (const [k, v] of Object.entries(rateLimitTelemetry(s))) {
    if (k === "http_status") assert.equal(v, 200);
    else assert.equal(v, null, `${k} should be null`);
  }
});

test("rateLimitTelemetry is a flat number|null record - nothing that could be a secret", () => {
  const s = parseRateLimitHeaders(
    { "x-ratelimit-remaining-requests": "3", "x-ratelimit-reset-requests": "9s" },
    200,
    NOW,
  );
  const t = rateLimitTelemetry(s);
  for (const v of Object.values(t)) {
    assert.ok(v === null || typeof v === "number", "telemetry values must be number|null");
  }
  assert.equal(t.remaining_requests, 3);
  assert.equal(t.reset_requests_ms, 9_000);
});
