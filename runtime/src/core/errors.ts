// Typed runtime errors. The runtime fails safe: on any uncertainty it denies or
// blocks rather than proceeding (build spec section 36).

import type { RateLimitSnapshot } from "../models/rate-limit.ts";

export class RuntimeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = "RuntimeError";
    this.code = code;
  }
}

/**
 * The provider returned HTTP 429. Carries the parsed, credential-free
 * `RateLimitSnapshot` so the scheduler can wait for the exact reset window.
 * Keeps `code` = "PROVIDER_RATE_LIMITED" for backward compatibility.
 */
export class RateLimitError extends RuntimeError {
  readonly rateLimit: RateLimitSnapshot | null;
  constructor(message: string, rateLimit: RateLimitSnapshot | null = null) {
    super("PROVIDER_RATE_LIMITED", message);
    this.name = "RateLimitError";
    this.rateLimit = rateLimit;
  }
}

/**
 * Repeated 429s survived the bounded rate-limit retry cycles. The stage BLOCKS
 * cleanly - the workflow state is preserved and can be resumed later.
 */
export class RateLimitExhaustedError extends RuntimeError {
  readonly rateLimit: RateLimitSnapshot | null;
  constructor(message: string, rateLimit: RateLimitSnapshot | null = null) {
    super("RATE_LIMIT_EXHAUSTED", message);
    this.name = "RateLimitExhaustedError";
    this.rateLimit = rateLimit;
  }
}

/**
 * The provider returned HTTP 429 (or 402) with a billing/quota-exhaustion body
 * (`insufficient_quota`, `credit_balance_exhausted`, "no credits remaining",
 * "billing", "payment required"). This is NOT a rate limit - waiting will not
 * clear it - so it is non-retryable and never fed to the rate-limit scheduler.
 * The stage BLOCKS immediately with a clear, credential-free reason.
 */
export class ProviderQuotaExhaustedError extends RuntimeError {
  constructor(message: string) {
    super("PROVIDER_QUOTA_EXHAUSTED", message);
    this.name = "ProviderQuotaExhaustedError";
  }
}

/** Configuration failed to load or validate. Startup must abort. */
export class RegistryIntegrityError extends RuntimeError {
  readonly details: string[];
  constructor(message: string, details: string[] = []) {
    super("REGISTRY_INTEGRITY", message);
    this.name = "RegistryIntegrityError";
    this.details = details;
  }
}

/** A capability / policy check denied an action. */
export class PolicyDeniedError extends RuntimeError {
  constructor(message: string) {
    super("POLICY_DENIED", message);
    this.name = "PolicyDeniedError";
  }
}

/** An action needs Human Founder approval that has not been granted. */
export class ApprovalRequiredError extends RuntimeError {
  readonly approvalId: string | null;
  constructor(message: string, approvalId: string | null = null) {
    super("APPROVAL_REQUIRED", message);
    this.name = "ApprovalRequiredError";
    this.approvalId = approvalId;
  }
}

/** An invalid workflow transition was attempted. */
export class InvalidTransitionError extends RuntimeError {
  constructor(message: string) {
    super("INVALID_TRANSITION", message);
    this.name = "InvalidTransitionError";
  }
}

/** The global pause (kill switch) is engaged and blocked a write. */
export class RuntimePausedError extends RuntimeError {
  constructor(message: string) {
    super("RUNTIME_PAUSED", message);
    this.name = "RuntimePausedError";
  }
}

/** A CLI usage problem (bad arguments). */
export class UsageError extends RuntimeError {
  constructor(message: string) {
    super("USAGE", message);
    this.name = "UsageError";
  }
}
