import re
from dataclasses import dataclass, field

from app.services.security.secrets import detect_secret_reasons


@dataclass(frozen=True)
class ExtractedMemory:
    type: str
    text: str
    confidence: float
    ttl_days: int | None = None


@dataclass(frozen=True)
class ExtractionResult:
    memories: list[ExtractedMemory] = field(default_factory=list)
    style_update: dict[str, object] = field(default_factory=dict)


def extract_memory_candidates(message: str) -> ExtractionResult:
    if detect_secret_reasons(message):
        return ExtractionResult()

    memories: list[ExtractedMemory] = []
    style_update: dict[str, object] = {}
    lower = message.lower()

    preference = _match_after(message, [r"\bi prefer\b", r"\bi like\b"])
    if preference:
        memories.append(
            ExtractedMemory(
                type="preference",
                text=f"User prefers {preference.strip()}.",
                confidence=0.72,
            )
        )

    remember = _match_after(message, [r"\bremember that\b", r"\bplease remember\b"])
    if remember:
        memories.append(
            ExtractedMemory(type="fact", text=remember.strip().rstrip(".") + ".", confidence=0.78)
        )

    goal = _match_after(message, [r"\bmy goal is\b", r"\bour goal is\b"])
    if goal:
        memories.append(
            ExtractedMemory(type="goal", text=f"User goal: {goal.strip()}.", confidence=0.76)
        )

    if "short answers" in lower or "concise" in lower:
        style_update["depth"] = "concise"
        style_update["avoid"] = ["unnecessary theory", "long answers"]
    if "detailed" in lower or "step by step" in lower:
        style_update["depth"] = "detailed"
    if "diagram" in lower:
        style_update["format"] = "diagrams plus practical examples"

    return ExtractionResult(memories=memories[:3], style_update=style_update)


def _match_after(message: str, patterns: list[str]) -> str | None:
    for pattern in patterns:
        match = re.search(pattern + r"(?P<value>[^.!?\n]{4,240})", message, flags=re.IGNORECASE)
        if match:
            return match.group("value").strip(" :,-")
    return None
