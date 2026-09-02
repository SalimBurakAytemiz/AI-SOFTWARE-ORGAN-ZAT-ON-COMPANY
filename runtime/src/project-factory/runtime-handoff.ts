import { createHash } from "node:crypto";
import { RuntimeError } from "../core/errors.ts";
import { looksLikeSecret } from "../core/redaction.ts";
import { validateHandoffPackage } from "./schema-check.ts";
import {
  HANDOFF_PACKAGE_VERSION,
  INHERITED_GOVERNANCE,
  type ProjectDefinition,
} from "./project-model.ts";

/**
 * The Project Factory -> Runtime V1.1 contract (build spec section 10).
 *
 * `buildHandoffPackage` produces a closed, self-describing snapshot of
 * everything Runtime needs to execute a project's Software Factory later:
 * identity, the product spec (as markdown strings), constraints, risk, the
 * budget policy, the inherited governance controls, and the build
 * authorization. A SHA-256 `checksum` over the canonical body makes the package
 * tamper-evident: `verifyHandoffPackage` recomputes it and rejects a mismatch,
 * so Runtime can trust a package it did not build in the same process.
 *
 * This module is deliberately provider-agnostic - it names no model provider.
 */

export interface HandoffProductSpec {
  brief: string;
  requirements: string;
  business_rules: string;
  user_stories: string;
  acceptance_criteria: string;
}

export interface RuntimeHandoffPackage {
  package_version: string;
  generated_at: string;
  project_id: string;
  slug: string;
  project_name: string;
  requested_workflow: string;
  risk_level: number;
  security_level: ProjectDefinition["security_level"];
  product: HandoffProductSpec;
  constraints: string[];
  integrations: string[];
  budget_policy: ProjectDefinition["budget_policy"];
  governance: ProjectDefinition["governance"];
  build_authorization: ProjectDefinition["build_authorization"];
  checksum: string;
}

/** Canonical JSON of the body (every field except `checksum`), keys sorted. */
function canonicalBody(pkg: Omit<RuntimeHandoffPackage, "checksum">): string {
  return JSON.stringify(pkg, Object.keys(pkg).sort());
}

function checksumOf(body: Omit<RuntimeHandoffPackage, "checksum">): string {
  return "sha256:" + createHash("sha256").update(canonicalBody(body)).digest("hex");
}

export function buildHandoffPackage(
  def: ProjectDefinition,
  product: HandoffProductSpec,
  generatedAt: string,
): RuntimeHandoffPackage {
  if (def.status !== "READY_FOR_BUILD") {
    throw new RuntimeError(
      "PROJECT_NOT_READY",
      `handoff package needs lifecycle state READY_FOR_BUILD, project '${def.slug}' is ${def.status}`,
    );
  }
  for (const [k, v] of Object.entries(product)) {
    if (typeof v !== "string" || v.trim().length === 0) {
      throw new RuntimeError("PROJECT_HANDOFF_INCOMPLETE", `handoff product.${k} is missing or empty`);
    }
  }
  // Governance is always the frozen inherited set - a project cannot weaken it.
  const body: Omit<RuntimeHandoffPackage, "checksum"> = {
    package_version: HANDOFF_PACKAGE_VERSION,
    generated_at: generatedAt,
    project_id: def.project_id,
    slug: def.slug,
    project_name: def.project_name,
    requested_workflow: def.requested_workflow,
    risk_level: def.risk_level,
    security_level: def.security_level,
    product,
    constraints: [...def.constraints],
    integrations: [...def.integrations],
    budget_policy: { ...def.budget_policy },
    governance: { ...INHERITED_GOVERNANCE },
    build_authorization: { ...def.build_authorization },
  };
  const pkg: RuntimeHandoffPackage = { ...body, checksum: checksumOf(body) };

  const check = validateHandoffPackage(pkg);
  if (!check.valid) {
    throw new RuntimeError("PROJECT_HANDOFF_INVALID", `handoff package failed schema validation: ${check.errors.join("; ")}`);
  }
  if (looksLikeSecret(JSON.stringify(pkg))) {
    throw new RuntimeError("PROJECT_HANDOFF_SECRET", "handoff package looks like it contains a secret; aborting");
  }
  return pkg;
}

export interface HandoffVerification {
  valid: boolean;
  errors: string[];
  /** True only if the recomputed checksum matches (package not tampered). */
  checksumOk: boolean;
  /** True only if the embedded governance equals the inherited controls. */
  governanceOk: boolean;
  buildAuthorized: boolean;
}

/**
 * Verify a handoff package that Runtime loaded from disk. Checks the schema, the
 * checksum, that governance was not weakened, and reports whether a build
 * authorization is present. Runtime must refuse to execute unless
 * `valid && checksumOk && governanceOk && buildAuthorized`.
 */
export function verifyHandoffPackage(pkg: unknown): HandoffVerification {
  const schema = validateHandoffPackage(pkg);
  if (!schema.valid) {
    return { valid: false, errors: schema.errors, checksumOk: false, governanceOk: false, buildAuthorized: false };
  }
  const p = pkg as RuntimeHandoffPackage;
  const { checksum, ...body } = p;
  const checksumOk = checksum === checksumOf(body as Omit<RuntimeHandoffPackage, "checksum">);
  const gov = p.governance as unknown as Record<string, unknown>;
  const governanceOk = Object.entries(INHERITED_GOVERNANCE).every(([k, v]) => gov[k] === v);
  const buildAuthorized = p.build_authorization.granted === true && Boolean(p.build_authorization.granted_by);
  const errors: string[] = [];
  if (!checksumOk) errors.push("checksum mismatch - package may have been modified after generation");
  if (!governanceOk) errors.push("governance controls do not match the inherited Runtime V1.1 set");
  return { valid: checksumOk && governanceOk, errors, checksumOk, governanceOk, buildAuthorized };
}
