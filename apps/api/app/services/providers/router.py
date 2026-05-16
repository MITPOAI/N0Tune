"""Provider router.

Dispatches a compiled context + user message to one of three wire shapes:

- ``openai``     — OpenAI Chat Completions; also covers OpenRouter, Ollama,
                   LM Studio, vLLM, and any "OpenAI-compatible" endpoint.
- ``anthropic``  — Anthropic Messages API (``/v1/messages``).
- ``gemini``     — Google Gemini ``generateContent`` REST shape.

Configured via env:

- ``N0TUNE_PROVIDER_KIND``       one of ``openai`` | ``anthropic`` | ``gemini``
- ``N0TUNE_PROVIDER_NAME``       model identifier (e.g. ``gpt-4o-mini``,
                                 ``claude-sonnet-4-5``, ``gemini-1.5-pro``)
- ``N0TUNE_PROVIDER_BASE_URL``   provider HTTP base URL
- ``N0TUNE_PROVIDER_API_KEY``    provider secret

If ``N0TUNE_PROVIDER_BASE_URL`` is unset or the model is the literal
``n0tune/dev`` we synthesize a development answer locally so the API
works keylessly in tests and local dev.
"""

from __future__ import annotations

import httpx

from app.config import get_settings


class ProviderError(RuntimeError):
    pass


async def generate_answer(model: str, compiled_context: str, message: str) -> tuple[str, str]:
    settings = get_settings()
    provider_name = model or settings.provider_name

    if provider_name == "n0tune/dev" or settings.provider_base_url is None:
        return _generate_development_answer(compiled_context, message), "n0tune/dev"

    kind = (settings.provider_kind or "openai").lower()

    if kind == "anthropic":
        return await _call_anthropic_provider(
            base_url=settings.provider_base_url,
            api_key=settings.provider_api_key,
            anthropic_version=settings.anthropic_version,
            model=provider_name,
            compiled_context=compiled_context,
            message=message,
        )
    if kind == "gemini":
        return await _call_gemini_provider(
            base_url=settings.provider_base_url,
            api_key=settings.provider_api_key,
            model=provider_name,
            compiled_context=compiled_context,
            message=message,
        )

    return await _call_openai_compatible_provider(
        base_url=settings.provider_base_url,
        api_key=settings.provider_api_key,
        model=provider_name,
        compiled_context=compiled_context,
        message=message,
    )


def _generate_development_answer(compiled_context: str, message: str) -> str:
    return (
        "N0Tune development provider response. "
        "A real provider was not configured, so no external LLM call was made. "
        f"Compiled context length: {len(compiled_context)} characters. "
        f"User message: {message}"
    )


async def _call_openai_compatible_provider(
    base_url: str,
    api_key: str | None,
    model: str,
    compiled_context: str,
    message: str,
) -> tuple[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": compiled_context},
            {"role": "user", "content": message},
        ],
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
        )

    if response.status_code >= 400:
        raise ProviderError(f"Provider returned HTTP {response.status_code}")

    body = response.json()
    try:
        answer = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ProviderError("Provider response did not contain a chat completion answer.") from exc

    return str(answer), model


async def _call_anthropic_provider(
    base_url: str,
    api_key: str | None,
    anthropic_version: str,
    model: str,
    compiled_context: str,
    message: str,
) -> tuple[str, str]:
    headers = {
        "Content-Type": "application/json",
        "anthropic-version": anthropic_version,
    }
    if api_key:
        headers["x-api-key"] = api_key

    payload = {
        "model": model,
        "system": compiled_context,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": message}],
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{base_url.rstrip('/')}/v1/messages",
            headers=headers,
            json=payload,
        )

    if response.status_code >= 400:
        raise ProviderError(f"Anthropic provider returned HTTP {response.status_code}")

    body = response.json()
    try:
        blocks = body["content"]
        text_chunks = [block.get("text", "") for block in blocks if block.get("type") == "text"]
        if not text_chunks:
            raise KeyError("no text blocks")
        answer = "".join(text_chunks)
    except (KeyError, IndexError, TypeError) as exc:
        raise ProviderError("Anthropic response did not contain a text block.") from exc

    return str(answer), model


async def _call_gemini_provider(
    base_url: str,
    api_key: str | None,
    model: str,
    compiled_context: str,
    message: str,
) -> tuple[str, str]:
    if not api_key:
        raise ProviderError("Gemini provider requires an API key.")

    url = f"{base_url.rstrip('/')}/models/{model}:generateContent"
    params = {"key": api_key}
    headers = {"Content-Type": "application/json"}

    payload = {
        "systemInstruction": {"parts": [{"text": compiled_context}]},
        "contents": [
            {"role": "user", "parts": [{"text": message}]},
        ],
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, headers=headers, params=params, json=payload)

    if response.status_code >= 400:
        raise ProviderError(f"Gemini provider returned HTTP {response.status_code}")

    body = response.json()
    try:
        parts = body["candidates"][0]["content"]["parts"]
        answer = "".join(part.get("text", "") for part in parts)
        if not answer:
            raise KeyError("empty parts")
    except (KeyError, IndexError, TypeError) as exc:
        raise ProviderError("Gemini response did not contain a text part.") from exc

    return str(answer), model
