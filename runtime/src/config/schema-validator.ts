import { readdirSync } from "node:fs";
import { join } from "node:path";
import ajvModule from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { readJson } from "./yaml.ts";
import { paths } from "./paths.ts";
import { RegistryIntegrityError } from "../core/errors.ts";

// ajv v8 ships CJS; normalise the interop shape for both ESM and type stripping.
const Ajv = ((ajvModule as { default?: unknown }).default ?? ajvModule) as new (
  opts: Record<string, unknown>,
) => AjvInstance;
const addFormats = ((addFormatsModule as { default?: unknown }).default ??
  addFormatsModule) as (ajv: AjvInstance) => AjvInstance;

interface AjvValidateFn {
  (data: unknown): boolean;
  errors?: { instancePath?: string; message?: string }[] | null;
}
interface AjvInstance {
  addSchema(schema: unknown, key?: string): AjvInstance;
  getSchema(key: string): AjvValidateFn | undefined;
}

// One Ajv instance loaded with every schema in ../../../schemas, so the runtime
// validates the Organization V1.0 configuration against the exact same contracts
// the Python suite enforces (build spec sections 6, 42, 44).

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

let ajv: AjvInstance | null = null;
const fileToId = new Map<string, string>();

function getAjv(): AjvInstance {
  if (ajv) return ajv;
  const instance = new Ajv({ allErrors: true, strict: false });
  addFormats(instance);
  const files = readdirSync(paths.schemas).filter((n) => n.endsWith(".json"));
  for (const name of files) {
    const schema = readJson<Record<string, unknown>>(join(paths.schemas, name));
    const id = typeof schema.$id === "string" ? schema.$id : name;
    fileToId.set(name, id);
    if (!instance.getSchema(id)) instance.addSchema(schema, id);
  }
  ajv = instance;
  return instance;
}

export function validateAgainst(schemaFile: string, data: unknown): ValidationResult {
  const instance = getAjv();
  const id = fileToId.get(schemaFile) ?? schemaFile;
  const validate = instance.getSchema(id);
  if (!validate) throw new RegistryIntegrityError(`unknown schema: ${schemaFile}`);
  const valid = validate(data) as boolean;
  if (valid) return { valid: true, errors: [] };
  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || "(root)"} ${e.message ?? "invalid"}`.trim(),
  );
  return { valid: false, errors };
}

/** Throw RegistryIntegrityError unless `data` validates against `schemaFile`. */
export function assertValid(schemaFile: string, data: unknown, label: string): void {
  const result = validateAgainst(schemaFile, data);
  if (!result.valid) {
    throw new RegistryIntegrityError(
      `${label} failed ${schemaFile} validation`,
      result.errors,
    );
  }
}
