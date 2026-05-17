"""Context Guard — alignment + grounding layer.

The package exposes the deterministic rule engine (no LLM, no network)
that catches AI-agent drift against the stored project plan, rules,
and benchmarks. See ``docs/context-guard.md`` for the user-facing
framing and ``docs/alignment-checker.md`` for the technical contract.
"""

from app.services.alignment.rules import (
    AlignmentIssue,
    AlignmentReport,
    Severity,
    run_rule_engine,
)

__all__ = [
    "AlignmentIssue",
    "AlignmentReport",
    "Severity",
    "run_rule_engine",
]
