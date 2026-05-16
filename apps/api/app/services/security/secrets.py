from fastapi import HTTPException, status
from n0tune_core.security import SECRET_PATTERNS, detect_secret_reasons

__all__ = ["SECRET_PATTERNS", "assert_no_secrets", "detect_secret_reasons"]


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
