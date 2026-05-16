import httpx

from app.config import get_settings


class ProviderError(RuntimeError):
    pass


async def generate_answer(model: str, compiled_context: str, message: str) -> tuple[str, str]:
    settings = get_settings()
    provider_name = model or settings.provider_name

    if provider_name == "n0tune/dev" or settings.provider_base_url is None:
        return _generate_development_answer(compiled_context, message), "n0tune/dev"

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
