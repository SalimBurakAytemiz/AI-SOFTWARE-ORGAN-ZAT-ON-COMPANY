import { RuntimeError } from "../core/errors.ts";

/**
 * Real provider request budget for a single Software Factory proof run
 * (build spec section 14). The proof is designed for low request consumption:
 *   - target: <= 20 real model requests (one successful call per role + limited retries)
 *   - hard safety ceiling: 30 real provider requests
 * Reaching the ceiling BLOCKS the run (BudgetExceededError). There are no
 * uncontrolled agent loops.
 */

export class BudgetExceededError extends RuntimeError {
  constructor(used: number, ceiling: number) {
    super(
      "REQUEST_BUDGET_EXCEEDED",
      `real provider request budget exceeded: ${used} > ceiling ${ceiling}; run BLOCKED`,
    );
    this.name = "BudgetExceededError";
  }
}

export interface BudgetSnapshot {
  used: number;
  target: number;
  ceiling: number;
  remainingToCeiling: number;
  overTarget: boolean;
}

export class RequestBudget {
  readonly target: number;
  readonly ceiling: number;
  private used = 0;

  constructor(opts: { target?: number; ceiling?: number; used?: number } = {}) {
    this.target = opts.target ?? 20;
    this.ceiling = opts.ceiling ?? 30;
    // `used` seeds the counter when continuing a run that already spent part of
    // the budget (proof resume) so the shared ceiling keeps counting across the
    // interruption.
    this.used = Math.max(0, Math.floor(opts.used ?? 0));
  }

  /** Call BEFORE issuing a real request. Throws if this request would exceed the ceiling. */
  reserve(n = 1): void {
    if (this.used + n > this.ceiling) {
      throw new BudgetExceededError(this.used + n, this.ceiling);
    }
    this.used += n;
  }

  get count(): number {
    return this.used;
  }

  snapshot(): BudgetSnapshot {
    return {
      used: this.used,
      target: this.target,
      ceiling: this.ceiling,
      remainingToCeiling: this.ceiling - this.used,
      overTarget: this.used > this.target,
    };
  }
}
