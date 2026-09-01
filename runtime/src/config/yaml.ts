import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { RegistryIntegrityError } from "../core/errors.ts";

export function readYaml<T = unknown>(path: string): T {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    throw new RegistryIntegrityError(`cannot read config file: ${path}`, [String(err)]);
  }
  try {
    return parse(text) as T;
  } catch (err) {
    throw new RegistryIntegrityError(`invalid YAML: ${path}`, [String(err)]);
  }
}

export function readJson<T = unknown>(path: string): T {
  const text = readFileSync(path, "utf8");
  return JSON.parse(text) as T;
}

/** List *.yml / *.yaml files in a directory, excluding names starting with "_". */
export function listYamlFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((n) => (n.endsWith(".yml") || n.endsWith(".yaml")) && !n.startsWith("_"))
    .sort()
    .map((n) => join(dir, n));
}
