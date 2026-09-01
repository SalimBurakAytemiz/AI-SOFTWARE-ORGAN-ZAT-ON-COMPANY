// Typed runtime errors. The runtime fails safe: on any uncertainty it denies or
// blocks rather than proceeding (build spec section 36).

export class RuntimeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = "RuntimeError";
    this.code = code;
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
