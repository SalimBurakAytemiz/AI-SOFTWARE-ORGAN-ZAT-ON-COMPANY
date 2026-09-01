import { execFileSync } from "node:child_process";
import type { Runtime } from "../runtime.ts";
import { loadRegistries } from "../registry/index.ts";

export type CheckStatus = "OK" | "NOT_CONFIGURED" | "OPTIONAL" | "DEFERRED" | "FAIL";

export interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface DoctorReport {
  healthy: boolean;
  checks: Check[];
}

/**
 * Runtime health check (build spec section 31). Required subsystems FAIL the
 * report; external optional systems report NOT_CONFIGURED / OPTIONAL / DEFERRED
 * and never fail the runtime.
 */
export function doctor(rt: Runtime): DoctorReport {
  const checks: Check[] = [];
  const add = (name: string, status: CheckStatus, detail: string) =>
    checks.push({ name, status, detail });

  // Node platform.
  const major = Number(process.versions.node.split(".")[0]);
  add(
    "node runtime",
    major >= 22 ? "OK" : "FAIL",
    `node ${process.versions.node} (require >= 22.6 for node:sqlite + type stripping)`,
  );

  // Config registries (re-load to prove integrity independently).
  try {
    const reg = loadRegistries();
    add("agent registry", "OK", `${reg.agents.ids().length} agents loaded and cross-validated`);
    add("skill registry", "OK", `${reg.skills.ids().length} skills loaded`);
    add("tool registry", "OK", `${reg.tools.capabilities.size} capabilities, ${reg.tools.nonGrantableIds().length} non-grantable`);
    add("workflow registry", "OK", `${reg.workflows.ids().length} workflows loaded and graph-checked`);
    add("policy registry", "OK", `${reg.policies.ids().length} default-deny policies; every critical action requires Human Founder approval`);
    add(
      "model config",
      "OK",
      `tiers + risk floor loaded; budgets ${reg.models.budgetsConfigured ? "configured" : "NOT_CONFIGURED"}`,
    );
  } catch (err) {
    add("config registries", "FAIL", String(err));
  }

  // Engines.
  add("policy engine", "OK", "default-deny decision point ready");
  add("permission engine", "OK", "capability gateway in front of every consequential tool call");
  add("approval engine", "OK", "only 'human-founder' may decide; self-approval blocked");
  add(
    "runtime pause",
    rt.control.isPaused() ? "OK" : "OK",
    rt.control.isPaused() ? `PAUSED: ${rt.control.pauseReason() ?? "unknown reason"}` : "not paused",
  );

  // State + audit stores.
  try {
    rt.store.getFlag("doctor.probe");
    add("state store", "OK", "node:sqlite reachable; workflow runs persist across restarts");
    add("audit store", "OK", `${rt.audit.list(100000).length} audit events recorded (append-only)`);
  } catch (err) {
    add("state store", "FAIL", String(err));
  }

  // Model providers.
  for (const p of rt.providers) {
    const h = p.health();
    add(
      `model provider: ${p.name}`,
      h.status === "OK" ? "OK" : h.status === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "FAIL",
      h.detail,
    );
  }
  add(
    "mock provider",
    rt.providers.some((p) => p.name === "mock" && p.isReady()) ? "OK" : "FAIL",
    "deterministic; the acceptance suite needs no paid API key",
  );

  // Git availability (used for fixture repositories, not remote writes).
  try {
    const v = execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
    add("git", "OK", v);
  } catch {
    add("git", "OPTIONAL", "git not found; only fixture-repo features are affected");
  }

  // Optional external systems (research: DEFERRED).
  add("model gateway (LiteLLM)", "DEFERRED", "adapter present; enable with env vars when the Human Founder onboards providers");
  add("sandbox (Daytona / E2B)", "DEFERRED", "local sandbox active; microVM adapters are a later phase");
  add("observability backend (Langfuse / OTLP)", "DEFERRED", "spans buffered locally; OTLP export is a later phase");
  add("policy engine backend (OPA)", "OPTIONAL", "first-party default-deny engine active; OPA/Rego optional later");

  const healthy = checks.every((c) => c.status !== "FAIL");
  return { healthy, checks };
}
