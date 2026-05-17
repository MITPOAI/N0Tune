from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.entities import Memory
from app.schemas.api import StylePatch, StyleResponse
from app.services.context.compiler import get_style_profile
from app.services.memory.lifecycle import is_retrievable
from app.services.security.auth import authorize_app

router = APIRouter(prefix="/v1/users", tags=["style"])
UTC = timezone.utc


@router.get("/{user_id}/style", response_model=StyleResponse)
async def get_style(
    user_id: str,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> StyleResponse:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    profile = get_style_profile(session, app_id, user_id)
    session.commit()
    session.refresh(profile)
    return StyleResponse.model_validate(profile)


@router.patch("/{user_id}/style", response_model=StyleResponse)
async def patch_style(
    user_id: str,
    payload: StylePatch,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> StyleResponse:
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    profile = get_style_profile(session, payload.app_id, user_id)
    profile.profile_json = _deep_merge(dict(profile.profile_json), payload.profile_json)
    profile.updated_at = datetime.now(UTC)
    session.commit()
    session.refresh(profile)
    return StyleResponse.model_validate(profile)


def _deep_merge(base: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
    for key, value in update.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            base[key] = _deep_merge(dict(base[key]), value)
        else:
            base[key] = value
    return base


# ---------------------------------------------------------------------------
# Adaptive persona — peek at recent preference memories and propose tweaks.
# ---------------------------------------------------------------------------


class AdaptiveSuggestion(BaseModel):
    field: str
    current: Any
    suggested: Any
    confidence: float
    rationale: str


class AdaptiveResponse(BaseModel):
    user_id: str
    app_id: str
    suggestions: list[AdaptiveSuggestion]
    inspected_memories: int


# Light keyword heuristics. We deliberately avoid an LLM call here so the
# endpoint stays deterministic and zero-cost. The Desktop / dashboard show
# the suggestion as a one-tap apply, never auto-commit.
_TONE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "terse": ("terse", "short", "concise", "brief", "no preamble"),
    "warm": ("friendly", "warm", "kind"),
    "direct": ("direct", "no-bs", "no bs", "blunt", "straight"),
    "academic": ("formal", "academic", "rigorous"),
}
_DEPTH_KEYWORDS: dict[str, tuple[str, ...]] = {
    "high": ("deep", "detailed", "thorough", "explain why"),
    "medium": ("balanced", "medium"),
    "low": ("shallow", "tldr", "summary", "high-level"),
}
_FORMAT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "code-first": ("code first", "code-first", "show me code", "code example"),
    "bullets": ("bullet", "bullets", "list"),
    "diagram": ("diagram", "ascii", "schematic"),
    "prose": ("paragraph", "prose"),
}


def _votes_from_texts(texts: list[str], buckets: dict[str, tuple[str, ...]]) -> dict[str, int]:
    votes: dict[str, int] = {label: 0 for label in buckets}
    haystack = " ".join(t.lower() for t in texts)
    for label, words in buckets.items():
        for w in words:
            if w in haystack:
                votes[label] += 1
    return votes


def _winner(votes: dict[str, int]) -> tuple[str | None, int, int]:
    total = sum(votes.values())
    if total == 0:
        return None, 0, 0
    label, count = max(votes.items(), key=lambda item: item[1])
    if count == 0:
        return None, 0, total
    return label, count, total


@router.post("/{user_id}/style/adapt", response_model=AdaptiveResponse)
async def adapt_style(
    user_id: str,
    app_id: str = Query(default="demo"),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> AdaptiveResponse:
    """Propose persona tweaks based on the user's recent preference memories.

    No LLM call. Walks the user's last 20 active preference / fact
    memories and counts keyword votes for tone / depth / format. If a
    single label wins clearly (≥2 votes, ≥40% share), we suggest
    flipping the style profile to it. The endpoint returns suggestions
    only — the caller decides whether to apply them.

    Why this is useful: N0Tune already extracts memory candidates
    from "I prefer ..." messages. The adapt endpoint closes the loop —
    instead of waiting for the human to manually update the persona,
    it surfaces the drift it has already observed.
    """
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    profile = get_style_profile(session, app_id, user_id)

    stmt = (
        select(Memory)
        .where(
            Memory.app_id == app_id,
            Memory.user_id == user_id,
            Memory.deleted_at.is_(None),
            Memory.type.in_(("preference", "fact")),
        )
        .order_by(Memory.updated_at.desc())
        .limit(20)
    )
    memories = [m for m in session.scalars(stmt) if is_retrievable(m)]
    texts = [m.text for m in memories]

    suggestions: list[AdaptiveSuggestion] = []
    profile_json = dict(profile.profile_json or {})

    for field, buckets in (
        ("tone", _TONE_KEYWORDS),
        ("depth", _DEPTH_KEYWORDS),
        ("format", _FORMAT_KEYWORDS),
    ):
        winner, votes, total = _winner(_votes_from_texts(texts, buckets))
        if winner is None or votes < 2:
            continue
        share = votes / total if total else 0
        if share < 0.40:
            continue
        current = profile_json.get(field)
        if current == winner:
            continue
        suggestions.append(
            AdaptiveSuggestion(
                field=field,
                current=current,
                suggested=winner,
                confidence=round(min(0.95, 0.45 + 0.1 * votes), 2),
                rationale=(
                    f"{votes} of your last {total} preference-shaped memories "
                    f"point at {winner!r}."
                ),
            )
        )

    return AdaptiveResponse(
        user_id=user_id,
        app_id=app_id,
        suggestions=suggestions,
        inspected_memories=len(memories),
    )
