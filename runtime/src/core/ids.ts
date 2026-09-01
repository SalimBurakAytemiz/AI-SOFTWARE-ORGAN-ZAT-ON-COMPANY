import { randomUUID } from "node:crypto";

/** Prefixed, sortable-ish identifiers for runtime entities. */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export const ID = {
  task: () => newId("task"),
  run: () => newId("run"),
  approval: () => newId("apr"),
  audit: () => newId("evt"),
  span: () => newId("span"),
  cost: () => newId("cost"),
};
