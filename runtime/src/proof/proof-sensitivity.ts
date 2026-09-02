import { looksLikeSecret } from "../core/redaction.ts";

/**
 * Proof-provider privacy guard (build spec sections 5, 34). A third-party free
 * proof provider may have different data-use policies, so the proof environment
 * is marked NON_SENSITIVE_PROOF_ONLY. A task that appears to carry real customer
 * PII, production secrets, payment information or a confidential production
 * dataset is BLOCKED before any real request is issued.
 */

export const PROOF_ENVIRONMENT_LABEL = "NON_SENSITIVE_PROOF_ONLY";

const SENSITIVE_PATTERNS: { re: RegExp; kind: string }[] = [
  { re: /\b(customer|user|patient|employee)\s+(pii|data|records?|list|database|export)\b/i, kind: "customer PII / data" },
  { re: /\bpii\b/i, kind: "PII" },
  { re: /\b(ssn|social security number|passport number|national id)\b/i, kind: "government identifier" },
  { re: /\b(credit\s?card|card number|cardholder|pan|cvv|iban|sort code|bank account)\b/i, kind: "payment information" },
  { re: /\b(payment|billing|invoice|payout|refund)\s+(data|records?|export|dataset|details)\b/i, kind: "payment data" },
  { re: /\b(production|prod)\s+(secret|secrets|credential|credentials|api key|token|database dump|dataset|data)\b/i, kind: "production secret / dataset" },
  { re: /\b(confidential|proprietary)\s+(production\s+)?(dataset|data|records?)\b/i, kind: "confidential dataset" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, kind: "private key material" },
];

export interface SensitivityVerdict {
  allowed: boolean;
  classification: string;
  matched: string[];
  reason: string;
}

export function classifyProofSensitivity(title: string, description: string): SensitivityVerdict {
  const text = `${title}\n${description}`;
  const matched: string[] = [];
  for (const { re, kind } of SENSITIVE_PATTERNS) {
    if (re.test(text)) matched.push(kind);
  }
  if (looksLikeSecret(text)) matched.push("embedded secret material");

  if (matched.length > 0) {
    return {
      allowed: false,
      classification: "SENSITIVE",
      matched: [...new Set(matched)],
      reason:
        `task appears to contain ${[...new Set(matched)].join(", ")}; ` +
        `the proof provider is ${PROOF_ENVIRONMENT_LABEL} and may not process it. ` +
        `Run this only through an approved provider with a data-processing agreement.`,
    };
  }
  return {
    allowed: true,
    classification: PROOF_ENVIRONMENT_LABEL,
    matched: [],
    reason: "task carries no detected sensitive data; permitted for non-sensitive proof execution",
  };
}
