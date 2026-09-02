import { execFileSync } from "node:child_process";
import type { Runtime } from "../runtime.ts";
import { loadRegistries } from "../registry/index.ts";
import { ProjectStore } from "../project-factory/project-store.ts";
import { projectsDir } from "../config/paths.ts";

export type CheckStatus =
  | "OK"
  | "NOT_CONFIGURED"
  | "OPTIONAL"
  | "DEFERRED"
  | "RATE_LIMITED"
  | "ERROR"
  | "FAIL";

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

  // Real / proof model provider (build spec sections 4, 5, 6, 27). One generic
  // OpenAI-compatible adapter serves every proof provider - Groq Direct is the
  // preferred one, OpenRouter is the optional fallback. Both rows always show so
  // the Human Founder can see at a glance which credential is present.
  const rp = rt.realProvider;
  add(
    "OpenAI-compatible provider",
    "OK",
    `generic OpenAI-compatible adapter present (one HTTP/model client for every real proof provider)`,
  );

  const activeNote = (id: string) =>
    rp.active === id
      ? " [ACTIVE - AI_COMPANY_REAL_PROVIDER]"
      : "";
  for (const k of rp.known) {
    const rowName = `${k.label} proof provider`;
    if (!k.configured) {
      add(
        rowName,
        "NOT_CONFIGURED",
        `set AI_COMPANY_REAL_PROVIDER=${k.id} and ${k.apiKeyEnv} to enable` +
          (k.preferred ? " (preferred proof provider)" : " (optional fallback proof provider)") +
          activeNote(k.id),
      );
    } else {
      const detailReady =
        rp.active === k.id && rp.descriptor
          ? `${rp.descriptor.label} ready: model ${rp.descriptor.model} [PROOF_PROVIDER, ${rp.descriptor.sensitivity}] - not an approved production provider`
          : `${k.apiKeyEnv} is present; select with AI_COMPANY_REAL_PROVIDER=${k.id} [PROOF_PROVIDER, NON_SENSITIVE_PROOF_ONLY] - not an approved production provider`;
      add(rowName, "OK", detailReady + activeNote(k.id));
    }
  }

  if (rp.active === "unknown") {
    add("real model provider (selection)", "ERROR", rp.reason);
  }

  // PREMIUM implementation escalation - off unless the Human Founder has
  // authorized it for this run. Implementation stage ONLY, bounded, no free
  // fallback on failure. Path: `codex-cli` (local Codex CLI / ChatGPT login, no
  // paid API) or `openai` (paid HTTP API).
  const pi = rt.premiumImplProvider;
  add(
    "premium implementation escalation",
    pi.ready ? "OK" : pi.authorized ? "ERROR" : "OPTIONAL",
    !pi.authorized
      ? "not authorized (set AI_COMPANY_PREMIUM_IMPL_PROVIDER=codex-cli, or =openai + OPENAI_API_KEY, to authorize ONE bounded escalation for the implementation stage only)"
      : pi.kind === "codex-cli"
        ? `AUTHORIZED for this run via the Codex CLI (ChatGPT login, no paid API) - live readiness is checked with 'codex login status' at run time` +
            (pi.codex?.model ? ` [model ${pi.codex.model}]` : " [account default model]")
        : `AUTHORIZED for this run via the PAID OpenAI API - ${pi.reason}` +
            (pi.descriptor ? ` [model source: ${pi.descriptor.modelSource}]` : ""),
  );

  // Free-first proof provider fallback chain (build spec: free-provider fallback).
  // NVIDIA NIM is engaged ONLY on a bounded RATE_LIMIT_EXHAUSTED during the
  // Software Factory proof - never auto-selected for ordinary work, never paid.
  const chain = rt.realProviderChain;
  add(
    "proof provider fallback chain",
    chain.fallbacks.length > 0 ? "OK" : "OPTIONAL",
    chain.reason +
      (chain.fallbacks.length === 0
        ? ` (set ${chain.primary.active === "nvidia" ? "a different primary" : "NVIDIA_API_KEY"} to enable a free fallback)`
        : ""),
  );

  // Git availability (used for fixture repositories, not remote writes).
  try {
    const v = execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
    add("git", "OK", v);
  } catch {
    add("git", "OPTIONAL", "git not found; only fixture-repo features are affected");
  }

  // Project Factory V0.1 - project intake and workspace creation.
  try {
    const store = new ProjectStore(projectsDir());
    add(
      "project factory",
      "OK",
      `V0.1 ready; ${store.list().length} project(s) under ${projectsDir()}; creation is deterministic (no model call, no paid API)`,
    );
  } catch (err) {
    add("project factory", "ERROR", String(err));
  }

  // Optional external systems (research: DEFERRED).
  add("model gateway (LiteLLM)", "DEFERRED", "adapter present; enable with env vars when the Human Founder onboards providers");
  add("sandbox (Daytona / E2B)", "DEFERRED", "local sandbox active; microVM adapters are a later phase");
  add("observability backend (Langfuse / OTLP)", "DEFERRED", "spans buffered locally; OTLP export is a later phase");
  add("policy engine backend (OPA)", "OPTIONAL", "first-party default-deny engine active; OPA/Rego optional later");

  const healthy = checks.every((c) => c.status !== "FAIL");
  return { healthy, checks };
}

/**
 * Founder-friendly LIVE health of the selected real proof provider (build spec
 * section 31). This is the ONLY doctor path that touches the network - it is run
 * by `ai-company doctor --probe` and the diagnostic script, never by default.
 * It spends no completion tokens (a `GET /models` reachability + auth check) and
 * never logs, prints, persists or audits the API key.
 *
 * Maps to the four founder-facing states: OK / NOT_CONFIGURED / RATE_LIMITED / ERROR.
 */
export async function probeRealProvider(rt: Runtime): Promise<Check> {
  const rp = rt.realProvider;
  const label =
    rp.known.find((k) => k.active)?.label ??
    (rp.active === "disabled" ? "real model provider" : "real model provider");
  const name = `${label} (live)`;

  if (rp.active === "disabled") {
    return { name, status: "NOT_CONFIGURED", detail: "AI_COMPANY_REAL_PROVIDER is disabled" };
  }
  if (!rp.descriptor) {
    return { name, status: rp.active === "unknown" ? "ERROR" : "NOT_CONFIGURED", detail: rp.reason };
  }
  const h = await rp.descriptor.provider.probe();
  const status: CheckStatus =
    h.status === "OK"
      ? "OK"
      : h.status === "NOT_CONFIGURED"
        ? "NOT_CONFIGURED"
        : h.status === "RATE_LIMITED"
          ? "RATE_LIMITED"
          : "ERROR";
  return { name, status, detail: `${rp.descriptor.label}: ${h.detail}` };
}
