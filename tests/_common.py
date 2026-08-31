"""Shared helpers for the AI Software Company organization validation suite.

Pure stdlib + PyYAML + jsonschema. No pytest required:

    python3 -m unittest discover -s tests -v
    python3 tests/run_all.py
"""
from __future__ import annotations

import json
import pathlib
import functools

import yaml
try:
    from jsonschema import Draft202012Validator
except Exception as exc:  # pragma: no cover
    raise SystemExit(
        "jsonschema is required to run the validation suite: pip install jsonschema"
    ) from exc

REPO = pathlib.Path(__file__).resolve().parent.parent

AGENTS_DIR = REPO / "agents" / "software-company"
SKILLS_DIR = REPO / "skills"
WORKFLOWS_DIR = REPO / "workflows"
POLICIES_DIR = REPO / "policies"
SCHEMAS_DIR = REPO / "schemas"
MODELS_DIR = REPO / "models"
TOOLS_DIR = REPO / "tools"

# The 15 critical actions reserved to the Human Founder (Constitution Article 3,
# policies/human-approval.yml). No agent may list any of these in `allowed_actions`;
# every agent must list all of them in `forbidden_actions`.
CRITICAL_ACTIONS = frozenset({
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
})

# Capabilities that may never appear in any agent's `allowed_tools`.
NON_GRANTABLE_EXPECTED = frozenset({
    "github.merge",
    "deploy.production",
    "db.migrate_production",
    "infra.production_apply",
    "secrets.production",
    "secrets.rotate",
    "payments.configure",
    "finance.execute",
    "ci.configure_production",
})

WORKFLOW_TERMINALS = frozenset({"end", "abort", "done"})

VALID_TIERS = frozenset({
    "NO_AI", "LOW_COST", "STANDARD_CODING", "ADVANCED_REASONING", "CRITICAL_REVIEW",
})

VALID_PROJECT_STATES = frozenset({
    "IDEA", "SPEC", "PLAN", "DESIGN", "BUILD", "REVIEW", "TEST", "SECURITY",
    "STAGING", "APPROVAL", "PRODUCTION", "MONITORING", "IMPROVEMENT",
    "HUMAN_APPROVAL_REQUIRED",
})

SPECIAL_OWNERS = frozenset({"human-founder", "system", "external"})


def load_yaml(path: pathlib.Path):
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def load_json(path: pathlib.Path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _iter(dir_: pathlib.Path, *suffixes):
    for p in sorted(dir_.rglob("*")):
        if p.suffix in suffixes and not p.name.startswith("_"):
            yield p


def agent_files():
    return [p for p in _iter(AGENTS_DIR, ".yml", ".yaml")]


def skill_files():
    return [p for p in _iter(SKILLS_DIR, ".yml", ".yaml")]


def workflow_files():
    return [p for p in _iter(WORKFLOWS_DIR, ".yml", ".yaml")]


def policy_files():
    return [p for p in _iter(POLICIES_DIR, ".yml", ".yaml")]


def all_config_files():
    out = []
    for d in (AGENTS_DIR, SKILLS_DIR, WORKFLOWS_DIR, POLICIES_DIR, MODELS_DIR, TOOLS_DIR):
        out.extend(_iter(d, ".yml", ".yaml"))
    out.append(REPO / "project-state" / "current.yml")
    return out


def all_json_files():
    return [p for p in _iter(SCHEMAS_DIR, ".json")] + [p for p in _iter(REPO / "tests" / "fixtures", ".json")]


@functools.lru_cache(maxsize=None)
def schema(name: str):
    return load_json(SCHEMAS_DIR / name)


def validator(name: str):
    """A jsonschema validator that resolves sibling schema $refs by filename."""
    store = {}
    for p in SCHEMAS_DIR.glob("*.json"):
        s = load_json(p)
        store[p.name] = s
        if "$id" in s:
            store[s["$id"]] = s
    base = schema(name)
    resource = base
    try:  # jsonschema >= 4.18 referencing API
        from referencing import Registry, Resource
        from referencing.jsonschema import DRAFT202012

        resources = []
        for key, s in store.items():
            resources.append((key, Resource(contents=s, specification=DRAFT202012)))
        registry = Registry().with_resources(resources)
        return Draft202012Validator(resource, registry=registry)
    except Exception:
        # Fallback: legacy RefResolver
        from jsonschema import RefResolver

        resolver = RefResolver(base_uri="", referrer=base, store=store)
        return Draft202012Validator(base, resolver=resolver)


@functools.lru_cache(maxsize=None)
def agents_by_id():
    out = {}
    for p in agent_files():
        data = load_yaml(p)
        out[data["id"]] = data
    return out


@functools.lru_cache(maxsize=None)
def skills_by_id():
    return {load_yaml(p)["id"]: load_yaml(p) for p in skill_files()}


@functools.lru_cache(maxsize=None)
def workflows_by_id():
    return {load_yaml(p)["id"]: load_yaml(p) for p in workflow_files()}


@functools.lru_cache(maxsize=None)
def policies_by_id():
    return {load_yaml(p)["id"]: load_yaml(p) for p in policy_files()}


@functools.lru_cache(maxsize=None)
def capabilities():
    data = load_yaml(TOOLS_DIR / "capabilities.yml")
    return {c["id"]: c for c in data["capabilities"]}


@functools.lru_cache(maxsize=None)
def tool_registry():
    data = load_yaml(TOOLS_DIR / "registry.yml")
    return {t["id"]: t for t in data["tools"]}
