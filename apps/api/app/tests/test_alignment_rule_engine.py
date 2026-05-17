"""Phase CG-1 — rule engine unit tests.

These tests deliberately exercise the engine without any database
(rules are constructed in-memory) and without any network — the whole
point of CG-1 is that the engine runs deterministically.
"""

from __future__ import annotations

from typing import Any

from app.models.entities import AlignmentRule
from app.services.alignment.rules import (
    AlignmentReport,
    run_rule_engine,
)


def _rule(**overrides: Any) -> AlignmentRule:
    defaults: dict[str, Any] = {
        "id": "rul_test",
        "app_id": "n0tune",
        "rule_type": "terminology",
        "title": "Test rule",
        "description": "Use the correct terminology.",
        "severity": "high",
        "pattern": None,
        "metadata_json": {},
        "active": True,
    }
    defaults.update(overrides)
    return AlignmentRule(**defaults)


# ---------------------------------------------------------------------------
# terminology
# ---------------------------------------------------------------------------


def test_terminology_rule_catches_fine_tunes_gpt() -> None:
    rule = _rule(
        rule_type="terminology",
        title="N0Tune context-tunes; it does not fine-tune.",
        description="Use 'context-tunes' or 'personalizes', never 'fine-tunes <model>'.",
        severity="high",
        pattern=r"fine[- ]?tunes?\s+(GPT|Claude|Gemini)",
    )
    report = run_rule_engine([rule], content="N0Tune fine-tunes Gemini using local memory.")
    assert report.aligned is False
    assert report.risk_level == "high"
    assert report.issues[0].type == "terminology_error"
    assert "fine-tunes Gemini" in report.issues[0].evidence


def test_terminology_rule_not_triggered_when_content_uses_correct_terms() -> None:
    rule = _rule(
        rule_type="terminology",
        pattern=r"fine[- ]?tunes?\s+(GPT|Claude|Gemini)",
    )
    report = run_rule_engine([rule], content="N0Tune context-tunes Gemini using local memory.")
    assert report.aligned is True
    assert report.issues == []


# ---------------------------------------------------------------------------
# phase_scope
# ---------------------------------------------------------------------------


def test_phase_scope_flags_changes_outside_allowed_paths() -> None:
    rule = _rule(
        rule_type="phase_scope",
        title="Phase CG-0 is documentation-only.",
        description="Restrict changes to docs/ and README.md.",
        severity="high",
        metadata_json={"phase": "CG-0", "allowed_paths": ["docs/**", "README.md", "CHANGELOG.md"]},
    )
    report = run_rule_engine(
        [rule],
        content="implementation in progress",
        phase="CG-0",
        changed_files=["apps/desktop/src-tauri/src/lib.rs", "docs/context-guard.md"],
    )
    assert report.aligned is False
    issue = report.issues[0]
    assert issue.type == "phase_drift"
    assert "apps/desktop/src-tauri/src/lib.rs" in issue.evidence


def test_phase_scope_passes_when_only_allowed_paths_change() -> None:
    rule = _rule(
        rule_type="phase_scope",
        severity="high",
        metadata_json={"phase": "CG-0", "allowed_paths": ["docs/**", "README.md"]},
    )
    report = run_rule_engine(
        [rule],
        content="docs update",
        phase="CG-0",
        changed_files=["docs/context-guard.md", "README.md"],
    )
    assert report.aligned is True
    assert report.issues == []


def test_phase_scope_skips_when_rule_is_for_a_different_phase() -> None:
    rule = _rule(
        rule_type="phase_scope",
        severity="high",
        metadata_json={"phase": "CG-0", "allowed_paths": ["docs/**"]},
    )
    report = run_rule_engine(
        [rule],
        content="not CG-0 anymore",
        phase="CG-1",
        changed_files=["apps/api/app/services/alignment/rules.py"],
    )
    assert report.aligned is True
    assert report.issues == []


# ---------------------------------------------------------------------------
# forbidden_claim + benchmark_mismatch
# ---------------------------------------------------------------------------


def test_forbidden_claim_inflated_benchmark() -> None:
    rule = _rule(
        rule_type="forbidden_claim",
        title="Token savings inflation.",
        description="The documented number is 17.4% — use that or add a real benchmark.",
        severity="medium",
        metadata_json={
            "claim_pattern": r"\b(7[5-9]|[89]\d|100)\s*%\s+token\s+savings",
            "actual": 17.4,
            "source": "docs/benchmarks.md",
        },
    )
    report = run_rule_engine(
        [rule],
        content="Honestly, token savings are 80% token savings on the README scenario.",
        claims=["80% token savings claimed without benchmark"],
    )
    assert report.aligned is True  # medium severity by default doesn't block
    assert report.risk_level == "medium"
    assert report.issues[0].type == "hallucinated_claim"
    assert "17.4" in report.issues[0].evidence


def test_strict_mode_blocks_medium_severity() -> None:
    rule = _rule(
        rule_type="forbidden_claim",
        severity="medium",
        metadata_json={"claim_pattern": r"\b80\s*%\s+token\s+savings"},
    )
    report = run_rule_engine(
        [rule],
        content="80% token savings claimed.",
        strict=True,
    )
    assert report.aligned is False


# ---------------------------------------------------------------------------
# required_test
# ---------------------------------------------------------------------------


def test_required_test_flags_tests_pass_claim_without_test_files() -> None:
    rule = _rule(
        rule_type="required_test",
        title="Claim of passing tests without a test in the diff.",
        description="If you say tests pass, include the test in changed_files.",
        severity="high",
        metadata_json={"claim_pattern": r"tests?\s+pass", "test_glob": "**/tests/**"},
    )
    report = run_rule_engine(
        [rule],
        content="finished the work",
        claims=["tests pass"],
        changed_files=["apps/api/app/services/alignment/rules.py"],
    )
    assert report.aligned is False
    assert report.issues[0].type == "missing_test"


def test_required_test_passes_when_a_test_file_is_changed() -> None:
    rule = _rule(
        rule_type="required_test",
        severity="high",
        metadata_json={"claim_pattern": r"tests?\s+pass", "test_glob": "**/tests/**"},
    )
    report = run_rule_engine(
        [rule],
        content="finished the work",
        claims=["tests pass"],
        changed_files=[
            "apps/api/app/services/alignment/rules.py",
            "apps/api/app/tests/test_alignment_rule_engine.py",
        ],
    )
    assert report.aligned is True
    assert report.issues == []


# ---------------------------------------------------------------------------
# built-in secret detector
# ---------------------------------------------------------------------------


def test_builtin_secret_detector_blocks_openai_key() -> None:
    report = run_rule_engine(
        [],
        content="remember my OPENAI_API_KEY=sk-AbCdEf0123456789012345_xyz",
    )
    assert report.aligned is False
    assert report.risk_level == "critical"
    assert any(i.type == "secret_storage" for i in report.issues)


def test_builtin_secret_detector_blocks_github_token() -> None:
    report = run_rule_engine(
        [],
        content="my PAT is ghp_abcdefghijklmnopqrstuvwx",
    )
    assert any(i.type == "secret_storage" for i in report.issues)


# ---------------------------------------------------------------------------
# Output assembly
# ---------------------------------------------------------------------------


def test_empty_rules_returns_aligned_with_no_issues() -> None:
    report = run_rule_engine([], content="anything")
    assert report.aligned is True
    assert report.issues == []
    assert report.risk_level == "low"


def test_inactive_rules_are_skipped() -> None:
    rule = _rule(active=False, pattern=r"fine-tunes")
    report = run_rule_engine([rule], content="N0Tune fine-tunes Claude")
    assert report.aligned is True


def test_dedupe_collapses_identical_findings() -> None:
    rule_a = _rule(id="rul_a", pattern=r"fine-tunes")
    rule_b = _rule(id="rul_b", pattern=r"fine-tunes")
    report = run_rule_engine([rule_a, rule_b], content="N0Tune fine-tunes Claude")
    assert len(report.issues) == 1


def test_report_serialization_round_trips() -> None:
    rule = _rule(pattern=r"fine-tunes")
    report = run_rule_engine([rule], content="N0Tune fine-tunes Claude")
    data = report.to_dict()
    assert isinstance(data, dict)
    assert isinstance(data["issues"], list)
    assert data["issues"][0]["finding"] == rule.title


def test_blocked_actions_quote_high_severity_findings() -> None:
    rule = _rule(severity="critical", pattern=r"bind\s+0\.0\.0\.0")
    report = run_rule_engine([rule], content="bind 0.0.0.0:8765 on the MCP server")
    assert any("do not" in b.lower() for b in report.blocked_actions)


def test_aligned_with_low_severity_issue_does_not_block() -> None:
    rule = _rule(severity="low", pattern=r"deprecated")
    report = run_rule_engine([rule], content="this uses deprecated config")
    assert report.aligned is True  # low severity is advisory only
    assert report.issues != []


def test_summary_mentions_phase_when_provided() -> None:
    rule = _rule(severity="high", pattern=r"fine-tunes")
    report: AlignmentReport = run_rule_engine([rule], content="fine-tunes GPT", phase="CG-1")
    assert "CG-1" in report.summary
