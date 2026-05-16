"""High-level N0Tune HTTP client."""

from __future__ import annotations

from types import TracebackType
from typing import Any

import httpx

from n0tune.models import (
    CacheListResponse,
    ChatRequest,
    ChatResponse,
    ContextPreviewRequest,
    ContextPreviewResponse,
    DocumentCreate,
    DocumentResponse,
    MemoryCreate,
    MemoryResponse,
    MemoryType,
    MemoryUpdate,
    StylePatch,
    StyleResponse,
)


class N0TuneError(RuntimeError):
    """Raised when the N0Tune API responds with a non-2xx status."""

    def __init__(self, status_code: int, body: Any) -> None:
        super().__init__(f"N0Tune request failed with HTTP {status_code}: {body!r}")
        self.status_code = status_code
        self.body = body


class _Resource:
    def __init__(self, client: N0TuneClient) -> None:
        self._client = client


class Memories(_Resource):
    def create(
        self,
        *,
        user_id: str,
        text: str,
        app_id: str = "demo",
        type: MemoryType = "fact",
        confidence: float = 0.8,
        source_message_id: str | None = None,
    ) -> MemoryResponse:
        payload = MemoryCreate(
            app_id=app_id,
            user_id=user_id,
            type=type,
            text=text,
            confidence=confidence,
            source_message_id=source_message_id,
        )
        body = self._client._request(
            "POST", "/v1/memories", json=payload.model_dump(mode="json", exclude_none=True)
        )
        return MemoryResponse.model_validate(body)

    def list(
        self,
        *,
        user_id: str,
        app_id: str = "demo",
        query: str | None = None,
        include_deleted: bool = False,
        limit: int = 50,
    ) -> list[MemoryResponse]:
        params: dict[str, Any] = {
            "app_id": app_id,
            "user_id": user_id,
            "limit": limit,
            "include_deleted": str(include_deleted).lower(),
        }
        if query:
            params["q"] = query
        body = self._client._request("GET", "/v1/memories", params=params)
        assert isinstance(body, list)
        return [MemoryResponse.model_validate(item) for item in body]

    def update(
        self,
        memory_id: str,
        *,
        text: str | None = None,
        type: MemoryType | None = None,
        confidence: float | None = None,
        app_id: str = "demo",
    ) -> MemoryResponse:
        payload = MemoryUpdate(app_id=app_id, text=text, type=type, confidence=confidence)
        body = self._client._request(
            "PATCH",
            f"/v1/memories/{memory_id}",
            json=payload.model_dump(mode="json", exclude_none=True),
        )
        return MemoryResponse.model_validate(body)

    def delete(self, memory_id: str, *, app_id: str = "demo", hard: bool = False) -> dict[str, Any]:
        result = self._client._request(
            "DELETE",
            f"/v1/memories/{memory_id}",
            params={"app_id": app_id, "hard": str(hard).lower()},
        )
        assert isinstance(result, dict)
        return result


class Style(_Resource):
    def get(self, user_id: str, *, app_id: str = "demo") -> StyleResponse:
        body = self._client._request(
            "GET", f"/v1/users/{user_id}/style", params={"app_id": app_id}
        )
        return StyleResponse.model_validate(body)

    def update(
        self,
        user_id: str,
        *,
        profile_json: dict[str, Any],
        app_id: str = "demo",
    ) -> StyleResponse:
        payload = StylePatch(app_id=app_id, profile_json=profile_json)
        body = self._client._request(
            "PATCH",
            f"/v1/users/{user_id}/style",
            json=payload.model_dump(mode="json"),
        )
        return StyleResponse.model_validate(body)


class Documents(_Resource):
    def create(
        self,
        *,
        title: str,
        content: str,
        source: str = "api",
        app_id: str = "demo",
        metadata_json: dict[str, Any] | None = None,
    ) -> DocumentResponse:
        payload = DocumentCreate(
            app_id=app_id,
            title=title,
            content=content,
            source=source,
            metadata_json=metadata_json or {},
        )
        body = self._client._request(
            "POST", "/v1/documents", json=payload.model_dump(mode="json")
        )
        return DocumentResponse.model_validate(body)

    def list(self, *, app_id: str = "demo", query: str | None = None) -> list[DocumentResponse]:
        params: dict[str, Any] = {"app_id": app_id}
        if query:
            params["q"] = query
        body = self._client._request("GET", "/v1/documents", params=params)
        assert isinstance(body, list)
        return [DocumentResponse.model_validate(item) for item in body]

    def delete(self, document_id: str, *, app_id: str = "demo") -> dict[str, Any]:
        result = self._client._request(
            "DELETE", f"/v1/documents/{document_id}", params={"app_id": app_id}
        )
        assert isinstance(result, dict)
        return result


class Context(_Resource):
    def preview(
        self,
        *,
        user_id: str,
        message: str,
        app_id: str = "demo",
        model: str = "n0tune/dev",
        max_context_tokens: int = 1200,
    ) -> ContextPreviewResponse:
        payload = ContextPreviewRequest(
            app_id=app_id,
            user_id=user_id,
            message=message,
            model=model,
            max_context_tokens=max_context_tokens,
        )
        body = self._client._request(
            "POST", "/v1/context/preview", json=payload.model_dump(mode="json")
        )
        return ContextPreviewResponse.model_validate(body)


class Chat(_Resource):
    def create(
        self,
        *,
        user_id: str,
        message: str,
        app_id: str = "demo",
        model: str = "n0tune/dev",
        max_context_tokens: int = 1200,
        allow_cache: bool = True,
    ) -> ChatResponse:
        payload = ChatRequest(
            app_id=app_id,
            user_id=user_id,
            message=message,
            model=model,
            max_context_tokens=max_context_tokens,
            allow_cache=allow_cache,
        )
        body = self._client._request("POST", "/v1/chat", json=payload.model_dump(mode="json"))
        return ChatResponse.model_validate(body)


class Cache(_Resource):
    def list(self, *, user_id: str | None = None, app_id: str = "demo") -> CacheListResponse:
        params: dict[str, Any] = {"app_id": app_id}
        if user_id is not None:
            params["user_id"] = user_id
        body = self._client._request("GET", "/v1/cache", params=params)
        return CacheListResponse.model_validate(body)

    def clear(self, *, user_id: str | None = None, app_id: str = "demo") -> dict[str, Any]:
        params: dict[str, Any] = {"app_id": app_id}
        if user_id is not None:
            params["user_id"] = user_id
        result = self._client._request("DELETE", "/v1/cache", params=params)
        assert isinstance(result, dict)
        return result


class N0TuneClient:
    """Synchronous N0Tune HTTP client."""

    def __init__(
        self,
        *,
        base_url: str = "http://localhost:8000",
        api_key: str | None = None,
        timeout: float = 30.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key is not None:
            headers["X-N0Tune-API-Key"] = api_key
            headers["Authorization"] = f"Bearer {api_key}"
        self._http = httpx.Client(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            headers=headers,
            transport=transport,
        )
        self.memories = Memories(self)
        self.style = Style(self)
        self.documents = Documents(self)
        self.context = Context(self)
        self.chat = Chat(self)
        self.cache = Cache(self)

    def health(self, *, deep: bool = False) -> dict[str, Any]:
        body = self._request("GET", "/health", params={"deep": str(deep).lower()})
        assert isinstance(body, dict)
        return body

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> N0TuneClient:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
    ) -> Any:
        response = self._http.request(method, path, params=params, json=json)
        try:
            body: Any = response.json()
        except ValueError:
            body = response.text
        if response.status_code >= 400:
            raise N0TuneError(response.status_code, body)
        return body
