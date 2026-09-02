import { test } from "node:test";
import assert from "node:assert/strict";
import { RateLimitScheduler, type WaitEvent } from "../src/models/rate-limit-scheduler.ts";
import { parseRateLimitHeaders, type RateLimitSnapshot } from "../src/models/rate-limit.ts";
import { fixedClock } from "../src/core/clock.ts";

/** A deterministic sleep that advances the fixed clock instead of blocking. */
function fakeTimers(startIso = "2026-09-01T12:00:00.000Z") {
  const clock = fixedClock(startIso);
  const slept: number[] = [];
  const sleep = async (ms: number) => {
    slept.push(ms);
    clock.advance(ms);
  };
  return { clock, sleep, slept };
}

function snap(headers: Record<string, string>, status = 429, nowMs = Date.parse("2026-09-01T12:00:00.000Z")): RateLimitSnapshot {
  return parseRateLimitHeaders(headers, status, nowMs);
}

test("waitForRetry: honours Retry-After, adds fixed jitter, is bounded, and counts cycles", async () => {
  const { clock, sleep, slept } = fakeTimers();
  const events: WaitEvent[] = [];
  const s = new RateLimitScheduler(clock, sleep, { maxRetryCycles: 3, jitterMs: 200, maxWaitMsPerCycle: 90_000 }, (e) => events.push(e));

  const rl = snap({ "retry-after": "8" });
  const w0 = await s.waitForRetry(rl, 0);
  assert.ok(w0);
  assert.equal(w0!.waitMs, 8_200); // 8s + 200ms jitter
  assert.equal(w0!.cycle, 1);
  assert.equal(slept[0], 8_200);

  const w1 = await s.waitForRetry(rl, 1);
  assert.equal(w1!.cycle, 2);
  const w2 = await s.waitForRetry(rl, 2);
  assert.equal(w2!.cycle, 3);

  // Cycle 3 is the 4th attempt -> exhausted, returns null (caller BLOCKs).
  assert.equal(await s.waitForRetry(rl, 3), null);
  assert.equal(events.length, 3);
});

test("waitForRetry: falls back to reset-requests, then reset-tokens, then config fallback window", async () => {
  const { clock, sleep } = fakeTimers();
  const s = new RateLimitScheduler(clock, sleep, { jitterMs: 0, fallback: { windowMs: 4_000 } });

  assert.equal((await s.waitForRetry(snap({ "x-ratelimit-reset-requests": "6s" }), 0))!.waitMs, 6_000);
  assert.equal((await s.waitForRetry(snap({ "x-ratelimit-reset-tokens": "9s" }), 0))!.waitMs, 9_000);
  assert.equal((await s.waitForRetry(snap({}), 0))!.waitMs, 4_000);
});

test("waitForRetry: caps a huge reset window at maxWaitMsPerCycle", async () => {
  const { clock, sleep } = fakeTimers();
  const s = new RateLimitScheduler(clock, sleep, { jitterMs: 0, maxWaitMsPerCycle: 10_000 });
  const w = await s.waitForRetry(snap({ "retry-after": "3600" }), 0);
  assert.equal(w!.waitMs, 10_000);
});

test("pace: waits when the learned REQUEST quota is exhausted, then not again after reset", async () => {
  const { clock, sleep, slept } = fakeTimers();
  const s = new RateLimitScheduler(clock, sleep, { minIntervalMs: 0 });

  s.observe(snap({ "x-ratelimit-remaining-requests": "0", "x-ratelimit-reset-requests": "5s" }, 200));
  const w = await s.pace(500);
  assert.ok(w);
  assert.equal(w!.kind, "request_quota");
  assert.equal(slept[0], 5_000);

  // After a fresh snapshot showing capacity, no wait.
  s.observe(snap({ "x-ratelimit-remaining-requests": "20", "x-ratelimit-reset-requests": "60s" }, 200));
  assert.equal(await s.pace(500), null);
});

test("pace: waits when the learned TOKEN budget is below the estimate for this call", async () => {
  const { clock, sleep } = fakeTimers();
  const s = new RateLimitScheduler(clock, sleep, { minIntervalMs: 0 });
  s.observe(snap({ "x-ratelimit-remaining-tokens": "100", "x-ratelimit-reset-tokens": "7s" }, 200));

  assert.equal(await s.pace(50), null); // enough for a small call
  const w = await s.pace(4000); // not enough for a big call
  assert.equal(w!.kind, "token_quota");
});

test("pace: enforces the minimum interval between sequential requests (no bursting)", async () => {
  const { clock, sleep, slept } = fakeTimers();
  const s = new RateLimitScheduler(clock, sleep, { minIntervalMs: 1_500 });

  assert.equal(await s.pace(10), null); // first call: no prior request
  s.markCallDone();
  clock.advance(400); // only 400ms elapsed

  const w = await s.pace(10);
  assert.ok(w);
  assert.equal(w!.kind, "pacing");
  assert.equal(slept.at(-1), 1_100); // waited the remaining 1.1s
});

test("scheduler carries only credential-free numbers in its wait events", async () => {
  const { clock, sleep } = fakeTimers();
  const events: WaitEvent[] = [];
  const s = new RateLimitScheduler(clock, sleep, { jitterMs: 0 }, (e) => events.push(e));
  await s.waitForRetry(snap({ "retry-after": "2", "x-ratelimit-remaining-tokens": "5" }), 0);
  const serialised = JSON.stringify(events);
  assert.ok(!/bearer|api[_-]?key|authorization/i.test(serialised));
});
