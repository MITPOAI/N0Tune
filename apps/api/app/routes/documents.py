from datetime import datetime, timezone
from hashlib import sha256

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.models.entities import Document, DocumentChunk
from app.schemas.api import ChunkResponse, DeleteResponse, DocumentCreate, DocumentResponse
from app.services.context.embedding import cosine_similarity, embed_text
from app.services.rag.chunking import chunk_text
from app.services.security.auth import authorize_app, ensure_app
from app.services.security.injection import analyze_injection_risk

router = APIRouter(prefix="/v1/documents", tags=["documents"])
UTC = timezone.utc


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> DocumentResponse:
    authorize_app(session, payload.app_id, x_n0tune_api_key, authorization)
    ensure_app(session, payload.app_id)
    document = Document(
        app_id=payload.app_id,
        title=payload.title,
        source=payload.source,
        metadata_json=payload.metadata_json,
        content_hash=sha256(payload.content.encode("utf-8")).hexdigest(),
    )
    session.add(document)
    session.flush()

    chunks: list[DocumentChunk] = []
    for index, text in enumerate(chunk_text(payload.content)):
        risk = analyze_injection_risk(text)
        chunk = DocumentChunk(
            app_id=payload.app_id,
            document_id=document.id,
            chunk_index=index,
            text=text,
            embedding=embed_text(text),
            metadata_json={
                "title": payload.title,
                "source": payload.source,
                **payload.metadata_json,
            },
            injection_risk_score=risk.score,
            injection_risk_reasons_json=risk.reasons,
        )
        chunks.append(chunk)
        session.add(chunk)

    session.commit()
    session.refresh(document)
    return _document_response(document, chunks)


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    app_id: str = Query(default="demo"),
    q: str | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> list[DocumentResponse]:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    query = select(Document).where(Document.app_id == app_id)
    if not include_deleted:
        query = query.where(Document.deleted_at.is_(None))
    documents = list(session.scalars(query))

    query_embedding = embed_text(q) if q else None
    responses: list[DocumentResponse] = []
    for document in documents:
        chunks = list(
            session.scalars(
                select(DocumentChunk)
                .where(DocumentChunk.app_id == app_id, DocumentChunk.document_id == document.id)
                .order_by(DocumentChunk.chunk_index)
            )
        )
        chunk_responses = [ChunkResponse.model_validate(chunk) for chunk in chunks]
        if query_embedding:
            chunk_responses = sorted(
                [
                    response.model_copy(
                        update={
                            "similarity": round(
                                cosine_similarity(chunks[index].embedding, query_embedding), 4
                            )
                        }
                    )
                    for index, response in enumerate(chunk_responses)
                ],
                key=lambda item: item.similarity or 0,
                reverse=True,
            )
        responses.append(_document_response(document, chunks, chunk_responses))
    return responses


@router.delete("/{document_id}", response_model=DeleteResponse)
async def delete_document(
    document_id: str,
    app_id: str = Query(default="demo"),
    hard: bool = Query(default=False),
    session: Session = Depends(get_session),
    x_n0tune_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> DeleteResponse:
    authorize_app(session, app_id, x_n0tune_api_key, authorization)
    document = session.get(Document, document_id)
    if document is None or document.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if hard:
        session.delete(document)
        session.commit()
        return DeleteResponse(id=document_id, deleted=True, hard_deleted=True)

    document.deleted_at = datetime.now(UTC)
    document.updated_at = datetime.now(UTC)
    session.commit()
    return DeleteResponse(id=document_id, deleted=True, hard_deleted=False)


def _document_response(
    document: Document,
    chunks: list[DocumentChunk],
    chunk_responses: list[ChunkResponse] | None = None,
) -> DocumentResponse:
    response = DocumentResponse.model_validate(document)
    response.chunks = chunk_responses or [ChunkResponse.model_validate(chunk) for chunk in chunks]
    return response
