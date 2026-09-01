import { join } from "node:path";
import { readYaml } from "../config/yaml.ts";
import { assertValid } from "../config/schema-validator.ts";
import { paths } from "../config/paths.ts";
import { RegistryIntegrityError } from "../core/errors.ts";
import type { CommandClass, CapabilityDefinition, ToolDefinition } from "../core/types.ts";

// A tool is not a permission. Agents reference capabilities (github.create_pr),
// not tools (github). This registry loads both and links them.

export interface ToolRegistry {
  capabilities: ReadonlyMap<string, CapabilityDefinition>;
  tools: ReadonlyMap<string, ToolDefinition>;
  capability(id: string): CapabilityDefinition;
  isGrantable(id: string): boolean;
  /** Coarse safety class for a capability, used by the sandbox and gateway. */
  commandClass(capabilityId: string): CommandClass;
  nonGrantableIds(): string[];
}

// Static safety classification of capabilities (build spec section 22).
const COMMAND_CLASS_BY_CAPABILITY: Record<string, CommandClass> = {
  "git.read": "READ_ONLY",
  "git.branch": "DEVELOPMENT_WRITE",
  "git.commit": "DEVELOPMENT_WRITE",
  "git.worktree": "DEVELOPMENT_WRITE",
  "github.read": "READ_ONLY",
  "github.create_issue": "EXTERNAL_WRITE",
  "github.comment": "EXTERNAL_WRITE",
  "github.create_branch": "EXTERNAL_WRITE",
  "github.create_pr": "EXTERNAL_WRITE",
  "github.review": "EXTERNAL_WRITE",
  "github.merge": "PRODUCTION_WRITE",
  "fs.read": "READ_ONLY",
  "fs.write": "DEVELOPMENT_WRITE",
  "shell.exec_sandbox": "DEVELOPMENT_WRITE",
  "docker.build": "DEVELOPMENT_WRITE",
  "docker.run_sandbox": "DEVELOPMENT_WRITE",
  "db.query_readonly": "READ_ONLY",
  "db.migrate_prepare": "DEVELOPMENT_WRITE",
  "db.migrate_staging": "EXTERNAL_WRITE",
  "db.migrate_production": "PRODUCTION_WRITE",
  "deploy.prepare": "DEVELOPMENT_WRITE",
  "deploy.staging": "EXTERNAL_WRITE",
  "deploy.production": "PRODUCTION_WRITE",
  "infra.plan": "READ_ONLY",
  "infra.production_apply": "PRODUCTION_WRITE",
  "secrets.read_dev": "READ_ONLY",
  "secrets.production": "PRODUCTION_WRITE",
  "secrets.rotate": "PRODUCTION_WRITE",
  "ci.read": "READ_ONLY",
  "ci.configure": "EXTERNAL_WRITE",
  "ci.configure_production": "PRODUCTION_WRITE",
  "observability.read": "READ_ONLY",
  "observability.configure": "EXTERNAL_WRITE",
  "otel.emit": "READ_ONLY",
  "repomix.pack": "READ_ONLY",
  "playwright.run": "DEVELOPMENT_WRITE",
  "playwright.mcp": "EXTERNAL_WRITE",
  "semgrep.scan": "READ_ONLY",
  "trivy.scan": "READ_ONLY",
  "gitleaks.scan": "READ_ONLY",
  "osv.scan": "READ_ONLY",
  "zap.scan": "EXTERNAL_WRITE",
  "promptfoo.eval": "DEVELOPMENT_WRITE",
  "promptfoo.redteam": "DEVELOPMENT_WRITE",
  "litellm.admin": "EXTERNAL_WRITE",
  "payments.configure": "FINANCIAL",
  "finance.execute": "FINANCIAL",
};

export function loadToolRegistry(): ToolRegistry {
  const capData = readYaml<{ capabilities: CapabilityDefinition[] }>(
    join(paths.tools, "capabilities.yml"),
  );
  const toolData = readYaml<{ tools: ToolDefinition[] }>(
    join(paths.tools, "registry.yml"),
  );

  const capabilities = new Map<string, CapabilityDefinition>();
  for (const c of capData.capabilities ?? []) {
    if (capabilities.has(c.id)) {
      throw new RegistryIntegrityError(`duplicate capability id: ${c.id}`);
    }
    capabilities.set(c.id, c);
  }
  if (capabilities.size === 0) {
    throw new RegistryIntegrityError("no capabilities defined");
  }

  const tools = new Map<string, ToolDefinition>();
  for (const t of toolData.tools ?? []) {
    assertValid("tool.schema.json", t, `tool ${t.id}`);
    tools.set(t.id, t);
  }

  // Every capability must belong to a known tool.
  for (const c of capabilities.values()) {
    if (!tools.has(c.tool)) {
      throw new RegistryIntegrityError(
        `capability ${c.id} references unknown tool ${c.tool}`,
      );
    }
    if (!(c.id in COMMAND_CLASS_BY_CAPABILITY)) {
      throw new RegistryIntegrityError(
        `capability ${c.id} has no command-safety classification in tool-registry.ts`,
      );
    }
  }

  return {
    capabilities,
    tools,
    capability: (id) => {
      const c = capabilities.get(id);
      if (!c) throw new RegistryIntegrityError(`unknown capability: ${id}`);
      return c;
    },
    isGrantable: (id) => capabilities.get(id)?.grantable === true,
    commandClass: (id) => {
      const cls = COMMAND_CLASS_BY_CAPABILITY[id];
      if (!cls) throw new RegistryIntegrityError(`unknown capability: ${id}`);
      return cls;
    },
    nonGrantableIds: () =>
      [...capabilities.values()].filter((c) => !c.grantable).map((c) => c.id).sort(),
  };
}
