from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes.cache import router as cache_router
from app.routes.chat import router as chat_router
from app.routes.context import router as context_router
from app.routes.documents import router as documents_router
from app.routes.health import router as health_router
from app.routes.memories import router as memories_router
from app.routes.openai_proxy import router as openai_proxy_router
from app.routes.style import router as style_router

settings = get_settings()

app = FastAPI(
    title="N0Tune API",
    description="Context Compiler and AI Memory Gateway API. Phase 0 exposes health only.",
    version="0.1.0",
)

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


app.include_router(health_router)
app.include_router(memories_router)
app.include_router(style_router)
app.include_router(documents_router)
app.include_router(context_router)
app.include_router(chat_router)
app.include_router(openai_proxy_router)
app.include_router(cache_router)
