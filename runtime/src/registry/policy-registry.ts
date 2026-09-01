import { readYaml, listYamlFiles } from "../config/yaml.ts";
import { assertValid } from "../config/schema-validator.ts";
import { paths } from "../config/paths.ts";
import { RegistryIntegrityError } from "../core/errors.ts";
import type { PolicyDefinition } from "../core/types.ts";

// The 15 critical actions reserved to the Human Founder (Constitution Article 3,
// policies/human-approval.yml). Mirrored here so the runtime fails safe if the
// policy file ever drops one.
export const CRITICAL_ACTIONS: readonly string[] = [
  "production_deployment",
  "merge_protected_main",
  "production_database_migration",
  "production_database_destructive_operation",
  "production_data_deletion",
  "production_infrastructure_modification",
  "secret_creation_rotation_revocation",
  "payment_provider_configuration_change",
  "real_refund_or_financial_transaction",
  "advertising_budget_modification",
  "supplier_or_vendor_payment",
  "bulk_customer_messaging",
  "customer_data_export",
  "access_control_escalation",
  "critical_security_architecture_change",
];

export interface PolicyRegistry {
  byId: ReadonlyMap<string, PolicyDefinition>;
  all(): PolicyDefinition[];
  get(id: string): PolicyDefinition;
  ids(): string[];
  /** action -> approver, from every REQUIRE_APPROVAL rule across all policies. */
  approvalActions: ReadonlyMap<string, string>;
}

export function loadPolicyRegistry(): PolicyRegistry {
  const byId = new Map<string, PolicyDefinition>();
  for (const file of listYamlFiles(paths.policies)) {
    const data = readYaml<PolicyDefinition>(file);
    assertValid("policy.schema.json", data, `policy ${file}`);
    if (data.default !== "DENY") {
      throw new RegistryIntegrityError(
        `policy ${data.id} is not default-DENY (build spec section 8)`,
      );
    }
    byId.set(data.id, data);
  }
  if (!byId.has("human-approval")) {
    throw new RegistryIntegrityError("human-approval policy is missing");
  }

  const approvalActions = new Map<string, string>();
  for (const p of byId.values()) {
    for (const rule of p.rules) {
      if (rule.effect === "REQUIRE_APPROVAL") {
        for (const action of rule.actions ?? []) {
          approvalActions.set(action, rule.approver ?? "human-founder");
        }
      }
    }
  }

  // Fail safe: every critical action must be covered by a human-founder approval rule.
  const missing = CRITICAL_ACTIONS.filter(
    (a) => approvalActions.get(a) !== "human-founder",
  );
  if (missing.length) {
    throw new RegistryIntegrityError(
      "human-approval policy does not require Human Founder approval for: " +
        missing.join(", "),
    );
  }

  return {
    byId,
    all: () => [...byId.values()],
    get: (id) => {
      const p = byId.get(id);
      if (!p) throw new RegistryIntegrityError(`unknown policy: ${id}`);
      return p;
    },
    ids: () => [...byId.keys()].sort(),
    approvalActions,
  };
}
