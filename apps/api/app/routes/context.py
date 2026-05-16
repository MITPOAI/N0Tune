from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.schemas.api import ContextPreviewRequest, ContextPreviewResponse
from app.services.context.compiler import compile_context
from app.services.security.auth import authorize_app

router = APIRouter(prefix="/v1/context", tags=["context"])


@router.post("/preview", response_model=ContextPreviewResponse)
async def preview_context(
    payload: ContextPreviewRequest,
    request: Request,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> ContextPreviewResponse:
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    response = compile_context(
        session=session,
        request=payload,
        request_id=request.state.request_id,
        cache_hit=False,
    )
    session.commit()
    return response
