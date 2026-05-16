from time import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.routes.chat import chat
from app.schemas.api import ChatRequest, OpenAIChatRequest
from app.services.security.auth import authorize_app

router = APIRouter(prefix="/v1/openai", tags=["openai-compatible"])


@router.post("/chat/completions")
async def openai_chat_completions(
    payload: OpenAIChatRequest,
    request: Request,
    session: Session = Depends(get_session),
    x_n0tune_app_id: str | None = Header(default=None),
    x_n0tune_user_id: str | None = Header(default=None),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    if payload.stream:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Streaming OpenAI-compatible responses are not implemented yet.",
        )

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
        session=session,
        x_n0tune_api_key=x_n0tune_api_key,
        authorization=authorization,
    )

    return {
        "id": f"chatcmpl-n0tune-{request.state.request_id}",
        "object": "chat.completion",
        "created": int(time()),
        "model": payload.model,
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
            "completion_tokens": max(1, round(len(response.answer) / 4)),
            "total_tokens": response.context.prompt_tokens_estimated
            + max(1, round(len(response.answer) / 4)),
        },
        "n0tune": {
            "cache_hit": response.context.cache_hit,
            "tokens_saved_estimated": response.context.tokens_saved_estimated,
            "provider": response.provider,
        },
    }
