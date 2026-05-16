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
