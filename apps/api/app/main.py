from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routes.alignment import router as alignment_router
from app.routes.api_keys import router as api_keys_router
from app.routes.audit_logs import router as audit_logs_router
from app.routes.cache import router as cache_router
from app.routes.chat import router as chat_router
from app.routes.context import router as context_router
from app.routes.documents import router as documents_router
from app.routes.health import router as health_router
from app.routes.memories import router as memories_router
from app.routes.openai_proxy import router as openai_proxy_router
from app.routes.style import router as style_router
from app.services.security.rate_limit import build_backend, derive_rate_limit_key

settings = get_settings()

app = FastAPI(
    title="N0Tune API",
    description="Context Compiler and AI Memory Gateway API. Phase 0 exposes health only.",
    version="0.1.0",
)
app.state.rate_limit_backend = build_backend(settings)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", settings.request_id_header],
)


@app.middleware("http")
async def add_request_id(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request_id = request.headers.get(settings.request_id_header) or str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers[settings.request_id_header] = request_id
    return response


@app.middleware("http")
async def rate_limit(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    current = get_settings()
    if current.rate_limit_rpm <= 0 or not request.url.path.startswith("/v1/"):
        return await call_next(request)
    backend = request.app.state.rate_limit_backend
    decision = backend.hit(
        derive_rate_limit_key(request),
        window_seconds=current.rate_limit_window_seconds,
        limit=current.rate_limit_rpm,
    )
    # Always set the informational headers on /v1/ traffic so well-behaved
    # clients can back off proactively rather than only after a 429.
    rate_limit_headers = {
        "X-RateLimit-Limit": str(current.rate_limit_rpm),
        "X-RateLimit-Remaining": str(decision.remaining),
        "X-RateLimit-Reset": str(decision.reset_at),
    }
    if not decision.allowed:
        return JSONResponse(
            status_code=429,
            content={
                "error": "rate_limited",
                "retry_after": decision.retry_after,
                "limit": current.rate_limit_rpm,
                "window_seconds": current.rate_limit_window_seconds,
            },
            headers={
                **rate_limit_headers,
                "Retry-After": str(decision.retry_after),
            },
        )
    response = await call_next(request)
    for header, value in rate_limit_headers.items():
        response.headers.setdefault(header, value)
    return response


app.include_router(health_router)
app.include_router(memories_router)
app.include_router(style_router)
app.include_router(documents_router)
app.include_router(context_router)
app.include_router(chat_router)
app.include_router(openai_proxy_router)
app.include_router(cache_router)
app.include_router(api_keys_router)
app.include_router(audit_logs_router)
app.include_router(alignment_router)
