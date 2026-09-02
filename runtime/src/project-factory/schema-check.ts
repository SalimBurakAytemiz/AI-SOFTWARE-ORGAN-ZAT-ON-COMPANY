import ajvModule from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { PROJECT_SCHEMA, HANDOFF_PACKAGE_SCHEMA } from "./project-model.ts";

/**
 * Ajv validation for the Project Factory schemas. These schemas are runtime
 * artifacts (not governance config), so they are validated here with the
 * runtime's existing `ajv` dependency rather than added to the repo `schemas/`
 * directory (a RISK 5 governance change).
 */

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
  compile(schema: unknown): AjvValidateFn;
}

export interface SchemaValidation {
  valid: boolean;
  errors: string[];
}

let projectValidate: AjvValidateFn | null = null;
let handoffValidate: AjvValidateFn | null = null;

function compile(schema: unknown): AjvValidateFn {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

function run(validate: AjvValidateFn, data: unknown): SchemaValidation {
  const valid = validate(data) as boolean;
  if (valid) return { valid: true, errors: [] };
  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || "(root)"} ${e.message ?? "invalid"}`.trim(),
  );
  return { valid: false, errors };
}

export function validateProjectDefinition(data: unknown): SchemaValidation {
  projectValidate ??= compile(PROJECT_SCHEMA);
  return run(projectValidate, data);
}

export function validateHandoffPackage(data: unknown): SchemaValidation {
  handoffValidate ??= compile(HANDOFF_PACKAGE_SCHEMA);
  return run(handoffValidate, data);
}
