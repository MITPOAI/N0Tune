from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.entities import ContextRun, SemanticCache
from app.schemas.api import CacheEntryResponse, CacheListResponse, ContextRunResponse
from app.services.security.auth import authorize_app

router = APIRouter(prefix="/v1", tags=["cache"])


@router.get("/cache", response_model=CacheListResponse)
async def list_cache(
    app_id: str = Query(default="demo"),
    user_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> CacheListResponse:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    query = select(SemanticCache).where(SemanticCache.app_id == app_id)
    if user_id is not None:
        query = query.where(SemanticCache.user_id == user_id)
    entries = list(session.scalars(query.order_by(SemanticCache.created_at.desc())))
    return CacheListResponse(
        entries=[CacheEntryResponse.model_validate(entry) for entry in entries],
        total=len(entries),
    )


@router.delete("/cache")
async def clear_cache(
    app_id: str = Query(default="demo"),
    user_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict[str, int]:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    count_query = select(SemanticCache.id).where(SemanticCache.app_id == app_id)
    query = delete(SemanticCache).where(SemanticCache.app_id == app_id)
    if user_id is not None:
        count_query = count_query.where(SemanticCache.user_id == user_id)
        query = query.where(SemanticCache.user_id == user_id)
    deleted = len(list(session.scalars(count_query)))
    session.execute(query)
    session.commit()
    return {"deleted": deleted}


@router.get("/context-runs", response_model=list[ContextRunResponse])
async def list_context_runs(
    app_id: str = Query(default="demo"),
    user_id: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[ContextRunResponse]:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    query = select(ContextRun).where(ContextRun.app_id == app_id)
    if user_id is not None:
        query = query.where(ContextRun.user_id == user_id)
    runs = list(session.scalars(query.order_by(ContextRun.created_at.desc()).limit(limit)))
    return [ContextRunResponse.model_validate(run) for run in runs]
