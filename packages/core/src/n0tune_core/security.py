from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class InjectionRisk:
    score: float
    reasons: list[str]


RISK_PHRASES: tuple[tuple[str, str, float], ...] = (
    ("ignore previous instructions", "tries to override prior instructions", 0.35),
    ("ignore all previous instructions", "tries to override prior instructions", 0.45),
    ("reveal secrets", "asks to reveal secrets", 0.35),
    ("print system prompt", "asks to print system prompt", 0.35),
    ("show system prompt", "asks to show system prompt", 0.35),
    ("exfiltrate memory", "asks to exfiltrate memory", 0.45),
    ("send api keys", "asks to send API keys", 0.45),
    ("disable safety", "asks to disable safety controls", 0.35),
    ("change your rules", "asks to change model rules", 0.3),
    ("call tools without permission", "asks to call tools without permission", 0.4),
    ("developer message", "mentions hidden developer instructions", 0.2),
)

SECRET_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("openai_api_key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b")),
    ("aws_access_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("password_assignment", re.compile(r"(?i)\b(password|passwd|pwd)\s*[:=]\s*\S{6,}")),
    ("bearer_token", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{20,}")),
    ("session_cookie", re.compile(r"(?i)\b(session|cookie)[_-]?(token|id)?\s*[:=]\s*\S{16,}")),
)


def analyze_injection_risk(text: str) -> InjectionRisk:
    lower = text.lower()
    score = 0.0
    reasons: list[str] = []

    for phrase, reason, weight in RISK_PHRASES:
        if phrase in lower:
            score += weight
            reasons.append(reason)

    if "```" in text and ("system" in lower or "assistant" in lower):
        score += 0.15
        reasons.append("contains role-like fenced instructions")

    return InjectionRisk(score=min(score, 1.0), reasons=sorted(set(reasons)))


def detect_secret_reasons(text: str) -> list[str]:
    return [name for name, pattern in SECRET_PATTERNS if pattern.search(text)]
