import re

from fastapi import HTTPException, status

SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("openai_api_key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b")),
    ("aws_access_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("password_assignment", re.compile(r"(?i)\b(password|passwd|pwd)\s*[:=]\s*\S{6,}")),
    ("bearer_token", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{20,}")),
    ("session_cookie", re.compile(r"(?i)\b(session|cookie)[_-]?(token|id)?\s*[:=]\s*\S{16,}")),
]


def detect_secret_reasons(text: str) -> list[str]:
    return [name for name, pattern in SECRET_PATTERNS if pattern.search(text)]


def assert_no_secrets(text: str) -> None:
    reasons = detect_secret_reasons(text)
    if reasons:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "message": "N0Tune refused to store text that looks like a secret.",
                "reasons": reasons,
            },
        )
