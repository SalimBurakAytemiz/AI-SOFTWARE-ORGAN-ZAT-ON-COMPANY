import type { Clock } from "../core/clock.ts";
import {
  hasRateLimitInfo,
  type RateLimitSnapshot,
} from "./rate-limit.ts";

/**
 * Provider-agnostic rate-limit scheduler (build spec sections 12, 14, 27).
 *
 * The runtime must run real agents SEQUENTIALLY and never burst requests at a
 * free-tier provider. This scheduler:
 *   - paces calls (a minimum interval between real requests),
 *   - before a call, waits when the learned request/token budget is exhausted,
 *   - on a 429, waits for the provider's own reset window (Retry-After / reset
 *     headers) with small jitter, retries the SAME call, bounded to N cycles,
 *   - after N failed cycles, gives up so the caller can BLOCK RATE_LIMIT_EXHAUSTED.
 *
 * It never fails the workflow merely to wait for free-tier quota - waiting is not
 * a critical action and needs no Human Founder approval. Time is taken only from
 * the injected `Clock`; sleeping is delegated to the injected `sleep` so tests
 * are deterministic and never actually block.
 */

export interface RateLimitSchedulerConfig {
  /** Bounded number of wait-and-retry cycles on repeated 429 (spec: 3). */
  maxRetryCycles?: number;
  /** Hard cap on any single wait, so a bad header can't stall the proof. */
  maxWaitMsPerCycle?: number;
  /** Fixed jitter added to a computed wait (deterministic for tests). */
  jitterMs?: number;
  /** Minimum spacing between sequential real requests (request pacing). */
  minIntervalMs?: number;
  /** Keep this many requests in reserve before pre-emptively waiting. */
  safetyMarginRequests?: number;
  /**
   * Safe fallback metadata, used ONLY when the provider has sent no rate-limit
   * headers yet. Learned header values always take precedence.
   */
  fallback?: {
    /** Assumed reset window when only a "count" is known. */
    windowMs?: number;
    /** Assumed requests-per-window. */
    requestsPerWindow?: number;
    /** Assumed tokens-per-window. */
    tokensPerWindow?: number;
  };
}

export interface WaitEvent {
  kind: "pacing" | "request_quota" | "token_quota" | "retry_after";
  waitMs: number;
  /** 1-indexed 429 cycle, or 0 for a pre-call pacing/quota wait. */
  cycle: number;
  reason: string;
  snapshot: RateLimitSnapshot | null;
}

const DEFAULTS: Required<Omit<RateLimitSchedulerConfig, "fallback">> = {
  maxRetryCycles: 3,
  maxWaitMsPerCycle: 90_000,
  jitterMs: 250,
  minIntervalMs: 0,
  safetyMarginRequests: 1,
};

export class RateLimitScheduler {
  private readonly clock: Clock;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly cfg: Required<Omit<RateLimitSchedulerConfig, "fallback">> & Pick<RateLimitSchedulerConfig, "fallback">;
  private readonly onWait?: (e: WaitEvent) => void;

  private last: RateLimitSnapshot | null = null;
  private lastCallEndMs = 0;
  private started = false;

  constructor(
    clock: Clock,
    sleepImpl: (ms: number) => Promise<void>,
    cfg: RateLimitSchedulerConfig = {},
    onWait?: (e: WaitEvent) => void,
  ) {
    this.clock = clock;
    this.sleepImpl = sleepImpl;
    this.cfg = {
      maxRetryCycles: cfg.maxRetryCycles ?? DEFAULTS.maxRetryCycles,
      maxWaitMsPerCycle: cfg.maxWaitMsPerCycle ?? DEFAULTS.maxWaitMsPerCycle,
      jitterMs: cfg.jitterMs ?? DEFAULTS.jitterMs,
      minIntervalMs: Math.max(0, cfg.minIntervalMs ?? DEFAULTS.minIntervalMs),
      safetyMarginRequests: Math.max(0, cfg.safetyMarginRequests ?? DEFAULTS.safetyMarginRequests),
      fallback: cfg.fallback,
    };
    this.onWait = onWait;
  }

  get maxRetryCycles(): number {
    return this.cfg.maxRetryCycles;
  }

  private nowMs(): number {
    return this.clock.now().getTime();
  }

  /**
   * Feed the latest snapshot observed from a completed OR failed request.
   * `observedAtMs` is re-stamped to the scheduler clock so elapsed-window maths
   * is consistent regardless of which clock the provider used.
   */
  observe(snapshot: RateLimitSnapshot | null | undefined): void {
    if (hasRateLimitInfo(snapshot)) this.last = { ...snapshot!, observedAtMs: this.nowMs() };
  }

  /** Call after every real request (success or failure) for pacing bookkeeping. */
  markCallDone(): void {
    this.lastCallEndMs = this.nowMs();
  }

  private cap(ms: number): number {
    return Math.max(0, Math.min(this.cfg.maxWaitMsPerCycle, Math.round(ms)));
  }

  private async doWait(e: Omit<WaitEvent, "waitMs"> & { waitMs: number }): Promise<WaitEvent> {
    this.onWait?.(e);
    if (e.waitMs > 0) await this.sleepImpl(e.waitMs);
    return e;
  }

  /**
   * Called BEFORE a real model call. Enforces the minimum interval and, when the
   * learned budget is insufficient for `estTokens`, waits for the reset window.
   * Returns the wait it performed, or null if no wait was needed.
   */
  async pace(estTokens: number): Promise<WaitEvent | null> {
    let waitMs = 0;
    let kind: WaitEvent["kind"] = "pacing";
    let reason = "";

    if (this.started && this.cfg.minIntervalMs > 0) {
      const sinceLast = this.nowMs() - this.lastCallEndMs;
      if (sinceLast < this.cfg.minIntervalMs) {
        waitMs = this.cfg.minIntervalMs - sinceLast;
        reason = `pacing sequential requests (${Math.round(waitMs / 1000)}s)`;
      }
    }
    this.started = true;

    const s = this.last;
    if (s) {
      const elapsed = Math.max(0, this.nowMs() - s.observedAtMs);
      // Time left in the window; 0 (or unknown) means the quota has replenished.
      const requestsResetIn = Math.max(0, (s.resetRequestsMs ?? s.retryAfterMs ?? 0) - elapsed);
      const tokensResetIn = Math.max(0, (s.resetTokensMs ?? s.retryAfterMs ?? 0) - elapsed);

      if (
        s.remainingRequests != null &&
        s.remainingRequests <= this.cfg.safetyMarginRequests &&
        requestsResetIn > 0
      ) {
        const w = requestsResetIn || this.cfg.fallback?.windowMs || 5_000;
        if (w > waitMs) {
          waitMs = w;
          kind = "request_quota";
          reason = `request quota exhausted (${s.remainingRequests} left); reset in ~${Math.round(w / 1000)}s`;
        }
      }
      if (
        s.remainingTokens != null &&
        estTokens > 0 &&
        s.remainingTokens < estTokens &&
        tokensResetIn > 0
      ) {
        const w = tokensResetIn || this.cfg.fallback?.windowMs || 5_000;
        if (w > waitMs) {
          waitMs = w;
          kind = "token_quota";
          reason = `token quota too low (${s.remainingTokens} < ~${estTokens} needed); reset in ~${Math.round(w / 1000)}s`;
        }
      }
    }

    if (waitMs <= 0) return null;
    waitMs = this.cap(waitMs);
    return this.doWait({ kind, waitMs, cycle: 0, reason, snapshot: s });
  }

  /**
   * Called after a 429. `cycle` is 0-indexed. Returns the wait performed, or
   * null when the bounded retry budget is exhausted (caller must BLOCK).
   */
  async waitForRetry(snapshot: RateLimitSnapshot | null, cycle: number): Promise<WaitEvent | null> {
    if (cycle >= this.cfg.maxRetryCycles) return null;
    this.observe(snapshot);
    const s = snapshot ?? this.last;

    const base =
      s?.retryAfterMs ??
      s?.resetRequestsMs ??
      s?.resetTokensMs ??
      this.cfg.fallback?.windowMs ??
      5_000;
    const waitMs = this.cap(base + this.cfg.jitterMs);
    const secs = Math.max(1, Math.round(waitMs / 1000));
    return this.doWait({
      kind: "retry_after",
      waitMs,
      cycle: cycle + 1,
      reason: `provider rate limited (HTTP 429); waiting ~${secs}s for the reset window (cycle ${cycle + 1}/${this.cfg.maxRetryCycles})`,
      snapshot: s,
    });
  }

  /** Latest learned snapshot (for reporting). */
  lastSnapshot(): RateLimitSnapshot | null {
    return this.last;
  }
}

/** Real sleep used outside tests. */
export function realSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
