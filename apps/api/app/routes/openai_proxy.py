import json as _json
from collections.abc import AsyncIterator
from time import time

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse, Response, StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.routes.chat import chat
from app.schemas.api import ChatRequest, ChatResponse, OpenAIChatRequest
from app.services.security.auth import authorize_app

router = APIRouter(prefix="/v1/openai", tags=["openai-compatible"])


@router.post("/chat/completions")
async def openai_chat_completions(
    payload: OpenAIChatRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    x_n0tune_app_id: str | None = Header(default=None),
    x_n0tune_user_id: str | None = Header(default=None),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> Response:
    app_id = payload.app_id or x_n0tune_app_id or "demo"
    user_id = payload.user_id or x_n0tune_user_id or "openai-compatible-user"
    user_messages = [message for message in payload.messages if message.role == "user"]
    if not user_messages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No user message."
        )

    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    response = await chat(
        payload=ChatRequest(
            app_id=app_id,
            user_id=user_id,
            message=user_messages[-1].content,
            model=payload.model,
            max_context_tokens=payload.max_context_tokens,
        ),
        request=request,
        background_tasks=background_tasks,
        session=session,
        x_n0tune_api_key=x_n0tune_api_key,
        authorization=authorization,
    )

    if payload.stream:
        return StreamingResponse(
            _stream_chat_completion(
                response=response,
                request_id=request.state.request_id,
                model=payload.model,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return JSONResponse(content=_build_completion_body(response, request, payload.model))


def _build_completion_body(
    response: ChatResponse, request: Request, model: str
) -> dict[str, object]:
    completion_tokens = max(1, round(len(response.answer) / 4))
    return {
        "id": f"chatcmpl-n0tune-{request.state.request_id}",
        "object": "chat.completion",
        "created": int(time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response.answer,
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": response.context.prompt_tokens_estimated,
            "completion_tokens": completion_tokens,
            "total_tokens": response.context.prompt_tokens_estimated + completion_tokens,
        },
        "n0tune": {
            "cache_hit": response.context.cache_hit,
            "tokens_saved_estimated": response.context.tokens_saved_estimated,
            "provider": response.provider,
        },
    }


async def _stream_chat_completion(
    response: ChatResponse, request_id: str, model: str
) -> AsyncIterator[bytes]:
    completion_id = f"chatcmpl-n0tune-{request_id}"
    created = int(time())

    def encode_event(payload: dict[str, object]) -> bytes:
        return f"data: {_json.dumps(payload)}\n\n".encode()

    yield encode_event(
        {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
        }
    )

    for piece in _split_into_stream_pieces(response.answer):
        yield encode_event(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{"index": 0, "delta": {"content": piece}, "finish_reason": None}],
            }
        )

    yield encode_event(
        {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            "n0tune": {
                "cache_hit": response.context.cache_hit,
                "tokens_saved_estimated": response.context.tokens_saved_estimated,
                "prompt_tokens_estimated": response.context.prompt_tokens_estimated,
                "provider": response.provider,
            },
        }
    )
    yield b"data: [DONE]\n\n"


def _split_into_stream_pieces(answer: str) -> list[str]:
    if not answer:
        return []
    words = answer.split(" ")
    return [word if index == 0 else f" {word}" for index, word in enumerate(words)]
