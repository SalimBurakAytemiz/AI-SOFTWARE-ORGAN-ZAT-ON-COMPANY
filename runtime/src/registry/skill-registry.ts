import { readYaml, listYamlFiles } from "../config/yaml.ts";
import { assertValid } from "../config/schema-validator.ts";
import { paths } from "../config/paths.ts";
import { RegistryIntegrityError } from "../core/errors.ts";
import type { SkillDefinition } from "../core/types.ts";

export interface SkillRegistry {
  byId: ReadonlyMap<string, SkillDefinition>;
  all(): SkillDefinition[];
  get(id: string): SkillDefinition;
  ids(): string[];
}

export function loadSkillRegistry(): SkillRegistry {
  const byId = new Map<string, SkillDefinition>();
  for (const file of listYamlFiles(paths.skills)) {
    const data = readYaml<SkillDefinition>(file);
    assertValid("skill.schema.json", data, `skill ${file}`);
    if (byId.has(data.id)) {
      throw new RegistryIntegrityError(`duplicate skill id: ${data.id}`);
    }
    byId.set(data.id, data);
  }
  if (byId.size === 0) throw new RegistryIntegrityError("no skill definitions found");
  return {
    byId,
    all: () => [...byId.values()],
    get: (id) => {
      const s = byId.get(id);
      if (!s) throw new RegistryIntegrityError(`unknown skill: ${id}`);
      return s;
    },
    ids: () => [...byId.keys()].sort(),
  };
}
