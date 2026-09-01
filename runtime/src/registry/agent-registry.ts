import { readYaml, listYamlFiles } from "../config/yaml.ts";
import { assertValid } from "../config/schema-validator.ts";
import { paths } from "../config/paths.ts";
import { RegistryIntegrityError } from "../core/errors.ts";
import type { AgentDefinition } from "../core/types.ts";

export interface AgentRegistry {
  byId: ReadonlyMap<string, AgentDefinition>;
  all(): AgentDefinition[];
  get(id: string): AgentDefinition;
  ids(): string[];
}

export function loadAgentRegistry(): AgentRegistry {
  const byId = new Map<string, AgentDefinition>();
  for (const file of listYamlFiles(paths.agents)) {
    const data = readYaml<AgentDefinition>(file);
    assertValid("agent.schema.json", data, `agent ${file}`);
    if (byId.has(data.id)) {
      throw new RegistryIntegrityError(`duplicate agent id: ${data.id}`);
    }
    if (data.id === "human-founder") {
      throw new RegistryIntegrityError(
        "human-founder must not be defined as an agent (Constitution Article 2)",
      );
    }
    byId.set(data.id, data);
  }
  if (byId.size === 0) {
    throw new RegistryIntegrityError("no agent definitions found");
  }
  return {
    byId,
    all: () => [...byId.values()],
    get: (id) => {
      const a = byId.get(id);
      if (!a) throw new RegistryIntegrityError(`unknown agent: ${id}`);
      return a;
    },
    ids: () => [...byId.keys()].sort(),
  };
}
