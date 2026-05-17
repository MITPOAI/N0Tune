"""Context Guard rule engine — deterministic alignment checks.

Phase CG-1 deliberately ships with zero LLM calls and zero network
egress. Everything in this module is regex + python set logic against
the rules persisted in the ``alignment_rules`` table (see
``app.models.entities.AlignmentRule``). Retrieval-against-memory and
the optional LLM judge live in later phases.

A check produces an :class:`AlignmentReport` with structured findings,
a derived risk level, and a ``suggested_correction`` paragraph. The
endpoint at ``POST /v1/alignment/check`` is the surface that wraps it
for callers; ``n0tune_alignment_check`` is the MCP tool that wraps the
endpoint for AI agents.

Issue type taxonomy (closed enum, see ``docs/alignment-checker.md``):

- ``phase_drift``        — work outside the current roadmap phase
- ``hallucinated_claim`` — claims unsupported by the project's facts
- ``security_risk``      — pattern matches a security invariant
- ``doc_mismatch``       — claim diverges from documented direction
- ``overengineering``    — feature ordered before its prerequisites
- ``terminology_error``  — forbidden phrasing (e.g. "fine-tunes GPT")
- ``missing_test``       — claim that requires a test but no test file
- ``memory_conflict``    — claim contradicts a stored project memory
- ``benchmark_mismatch`` — claim disagrees with a documented benchmark
- ``secret_storage``     — content matches a known secret pattern
"""

from __future__ import annotations

import fnmatch
import re
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from typing import Literal

from app.models.entities import AlignmentRule

Severity = Literal["low", "medium", "high", "critical"]
IssueType = Literal[
    "phase_drift",
    "hallucinated_claim",
    "security_risk",
    "doc_mismatch",
    "overengineering",
    "terminology_error",
    "missing_test",
    "memory_conflict",
    "benchmark_mismatch",
    "secret_storage",
]

# Map rule_type to default issue_type when the rule itself doesn't override.
_DEFAULT_ISSUE_TYPE: dict[str, IssueType] = {
    "terminology": "terminology_error",
    "phase_scope": "phase_drift",
    "security": "security_risk",
    "memory_policy": "security_risk",
    "roadmap": "overengineering",
    "forbidden_claim": "hallucinated_claim",
    "required_test": "missing_test",
    "docs_consistency": "doc_mismatch",
    "product_direction": "doc_mismatch",
}

# Severity ordering — used to compute report-level risk_level and to
# decide what blocks vs. warns.
_SEVERITY_ORDER: dict[Severity, int] = {
    "low": 0,
    "medium": 1,
    "high": 2,
    "critical": 3,
}

# Built-in secret patterns. Mirrors `services.security.secrets` but
# expressed as alignment rules so the engine can return a structured
# issue with a citation back to the policy.
_BUILTIN_SECRET_PATTERNS: list[tuple[str, str]] = [
    (r"sk-[A-Za-z0-9_\-]{20,}", "OpenAI-style secret key"),
    (r"sk-ant-[A-Za-z0-9_\-]{20,}", "Anthropic-style secret key"),
    (r"ghp_[A-Za-z0-9]{20,}", "GitHub personal access token"),
    (r"AKIA[0-9A-Z]{16}", "AWS access key id"),
]


@dataclass
class AlignmentIssue:
    type: IssueType
    severity: Severity
    finding: str
    evidence: str
    recommendation: str
    rule_id: str | None = None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass
class AlignmentReport:
    aligned: bool
    risk_level: Severity
    summary: str
    issues: list[AlignmentIssue] = field(default_factory=list)
    allowed_next_actions: list[str] = field(default_factory=list)
    blocked_actions: list[str] = field(default_factory=list)
    suggested_correction: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "aligned": self.aligned,
            "risk_level": self.risk_level,
            "summary": self.summary,
            "issues": [issue.to_dict() for issue in self.issues],
            "allowed_next_actions": list(self.allowed_next_actions),
            "blocked_actions": list(self.blocked_actions),
            "suggested_correction": self.suggested_correction,
        }


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------


def run_rule_engine(
    rules: Iterable[AlignmentRule],
    *,
    content: str,
    claims: Iterable[str] | None = None,
    changed_files: Iterable[str] | None = None,
    phase: str | None = None,
    strict: bool = False,
) -> AlignmentReport:
    """Run all active rules against the proposed agent output.

    The engine is intentionally cheap: it walks every active rule once
    and emits issues for the hits it finds. There is no retrieval, no
    LLM judge, no I/O. Higher layers can augment the report with
    memory-conflict / benchmark-mismatch findings.
    """
    claim_list = [c for c in (claims or []) if c]
    file_list = list(changed_files or [])
    text_corpus = "\n".join([content, *claim_list])

    issues: list[AlignmentIssue] = []
    issues.extend(_check_builtin_secrets(text_corpus))

    for rule in rules:
        if not rule.active:
            continue
        issues.extend(_check_rule(rule, content, claim_list, file_list, phase))

    issues = _dedupe(issues)
    issues.sort(key=lambda i: _SEVERITY_ORDER[i.severity], reverse=True)

    risk_level = _max_severity(issues)
    block_threshold: Severity = "medium" if strict else "high"
    aligned = all(
        _SEVERITY_ORDER[issue.severity] < _SEVERITY_ORDER[block_threshold]
        for issue in issues
    )

    summary = _build_summary(aligned, issues, phase)
    suggested = _build_suggested_correction(issues) if issues else None
    allowed, blocked = _derive_actions(issues, file_list)

    return AlignmentReport(
        aligned=aligned,
        risk_level=risk_level,
        summary=summary,
        issues=issues,
        allowed_next_actions=allowed,
        blocked_actions=blocked,
        suggested_correction=suggested,
    )


# ---------------------------------------------------------------------------
# Per-rule checks
# ---------------------------------------------------------------------------


def _check_rule(
    rule: AlignmentRule,
    content: str,
    claims: list[str],
    changed_files: list[str],
    phase: str | None,
) -> list[AlignmentIssue]:
    issue_type = _DEFAULT_ISSUE_TYPE.get(rule.rule_type, "doc_mismatch")
    severity: Severity = _coerce_severity(rule.severity)
    meta = rule.metadata_json or {}

    if rule.rule_type == "phase_scope":
        return _check_phase_scope(rule, issue_type, severity, meta, changed_files, phase)

    if rule.rule_type == "required_test":
        return _check_required_test(rule, issue_type, severity, meta, claims, changed_files)

    if rule.rule_type == "forbidden_claim":
        return _check_forbidden_claim(rule, issue_type, severity, meta, content, claims)

    # Default: regex pattern match against content + claims.
    return _check_pattern(rule, issue_type, severity, content, claims)


def _check_pattern(
    rule: AlignmentRule,
    issue_type: IssueType,
    severity: Severity,
    content: str,
    claims: list[str],
) -> list[AlignmentIssue]:
    if not rule.pattern:
        return []
    try:
        regex = re.compile(rule.pattern, re.IGNORECASE)
    except re.error:
        return []
    haystacks = [content, *claims]
    for text in haystacks:
        match = regex.search(text)
        if match is not None:
            return [
                AlignmentIssue(
                    type=issue_type,
                    severity=severity,
                    finding=rule.title,
                    evidence=f'"{match.group(0)}" matches rule pattern',
                    recommendation=rule.description,
                    rule_id=rule.id,
                )
            ]
    return []


def _check_phase_scope(
    rule: AlignmentRule,
    issue_type: IssueType,
    severity: Severity,
    meta: dict[str, object],
    changed_files: list[str],
    phase: str | None,
) -> list[AlignmentIssue]:
    rule_phase = meta.get("phase")
    if rule_phase and phase and rule_phase != phase:
        # This rule is for a different phase; not applicable now.
        return []
    allowed = meta.get("allowed_paths")
    if not isinstance(allowed, list) or not allowed:
        return []
    offenders = [
        f for f in changed_files if not any(fnmatch.fnmatch(f, str(pat)) for pat in allowed)
    ]
    if not offenders:
        return []
    sample = ", ".join(offenders[:3]) + (f", +{len(offenders) - 3}" if len(offenders) > 3 else "")
    return [
        AlignmentIssue(
            type=issue_type,
            severity=severity,
            finding=rule.title,
            evidence=f"changed_files outside allowed paths: {sample}",
            recommendation=rule.description,
            rule_id=rule.id,
        )
    ]


def _check_required_test(
    rule: AlignmentRule,
    issue_type: IssueType,
    severity: Severity,
    meta: dict[str, object],
    claims: list[str],
    changed_files: list[str],
) -> list[AlignmentIssue]:
    claim_pattern = meta.get("claim_pattern") or rule.pattern
    test_glob = meta.get("test_glob")
    if not isinstance(claim_pattern, str) or not isinstance(test_glob, str):
        return []
    try:
        regex = re.compile(claim_pattern, re.IGNORECASE)
    except re.error:
        return []
    triggered = any(regex.search(c) for c in claims)
    if not triggered:
        return []
    has_test = any(fnmatch.fnmatch(f, test_glob) for f in changed_files)
    if has_test:
        return []
    return [
        AlignmentIssue(
            type=issue_type,
            severity=severity,
            finding=rule.title,
            evidence=f"claim matches {claim_pattern!r} but no file matches {test_glob!r}",
            recommendation=rule.description,
            rule_id=rule.id,
        )
    ]


def _check_forbidden_claim(
    rule: AlignmentRule,
    issue_type: IssueType,
    severity: Severity,
    meta: dict[str, object],
    content: str,
    claims: list[str],
) -> list[AlignmentIssue]:
    pattern = meta.get("claim_pattern") or rule.pattern
    if not isinstance(pattern, str):
        return []
    try:
        regex = re.compile(pattern, re.IGNORECASE)
    except re.error:
        return []
    actual = meta.get("actual")
    source = meta.get("source")
    for text in [content, *claims]:
        match = regex.search(text)
        if match is None:
            continue
        evidence = f'"{match.group(0)}" matches forbidden claim'
        if actual is not None:
            evidence += f"; documented value is {actual!r}"
        if source:
            evidence += f" (see {source})"
        return [
            AlignmentIssue(
                type=issue_type,
                severity=severity,
                finding=rule.title,
                evidence=evidence,
                recommendation=rule.description,
                rule_id=rule.id,
            )
        ]
    return []


def _check_builtin_secrets(corpus: str) -> list[AlignmentIssue]:
    """Run the always-on secret-pattern check.

    This is in addition to the existing ``services.security.secrets``
    guard on memory writes; surfacing it here means the alignment
    endpoint can answer "would saving this leak a secret?" without
    actually attempting the save.
    """
    hits: list[AlignmentIssue] = []
    for pattern, label in _BUILTIN_SECRET_PATTERNS:
        if re.search(pattern, corpus):
            hits.append(
                AlignmentIssue(
                    type="secret_storage",
                    severity="critical",
                    finding=f"{label} detected in content",
                    evidence=f"text matches pattern {pattern!r}",
                    recommendation="Do not store this as a memory or commit it. "
                    "Rotate the secret if it was real.",
                )
            )
    return hits


# ---------------------------------------------------------------------------
# Output assembly helpers
# ---------------------------------------------------------------------------


def _dedupe(issues: list[AlignmentIssue]) -> list[AlignmentIssue]:
    seen: set[tuple[str, str]] = set()
    out: list[AlignmentIssue] = []
    for issue in issues:
        key = (issue.type, issue.finding[:80])
        if key in seen:
            continue
        seen.add(key)
        out.append(issue)
    return out


def _max_severity(issues: list[AlignmentIssue]) -> Severity:
    if not issues:
        return "low"
    top = max(issues, key=lambda i: _SEVERITY_ORDER[i.severity])
    return top.severity


def _coerce_severity(value: str) -> Severity:
    candidate = (value or "medium").lower()
    if candidate == "critical":
        return "critical"
    if candidate == "high":
        return "high"
    if candidate == "low":
        return "low"
    return "medium"


def _build_summary(aligned: bool, issues: list[AlignmentIssue], phase: str | None) -> str:
    if not issues:
        if phase:
            return f"Aligned for phase {phase}. No issues found."
        return "Aligned. No issues found."
    top = issues[0]
    prefix = "Aligned with caveats" if aligned else "Not aligned"
    phase_hint = f" in phase {phase}" if phase else ""
    return f"{prefix}{phase_hint}: {top.finding}"


def _build_suggested_correction(issues: list[AlignmentIssue]) -> str:
    parts = []
    for issue in issues[:3]:  # keep it short — caller may concat more
        parts.append(f"{issue.type}: {issue.recommendation}")
    return " ".join(parts)


def _derive_actions(
    issues: list[AlignmentIssue],
    changed_files: list[str],
) -> tuple[list[str], list[str]]:
    """Compose a small list of allowed and blocked actions.

    Allowed actions are pulled from any ``phase_scope`` issue's
    ``recommendation`` (which typically names the kinds of files an
    agent should restrict themselves to). Blocked actions restate the
    most severe issues as explicit "do not" instructions.
    """
    blocked: list[str] = []
    for issue in issues:
        if _SEVERITY_ORDER[issue.severity] < _SEVERITY_ORDER["high"]:
            continue
        blocked.append(f"do not: {issue.finding.lower()}")
    allowed: list[str] = []
    if any(i.type == "phase_drift" for i in issues):
        allowed.append("update docs only (no implementation)")
    if not allowed and not blocked:
        allowed.append("proceed as planned")
    return allowed, blocked
