from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    app_name: str = "N0Tune API"
    environment: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    database_url: str = (
        "postgresql+psycopg://n0tune:n0tune_dev_password_change_me@postgres:5432/n0tune"
    )
    redis_url: str = "redis://redis:6379/0"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            # Dashboard (Next.js dev + docker).
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://localhost:3002",
            "http://127.0.0.1:3002",
            "http://localhost:3003",
            "http://127.0.0.1:3003",
            "http://localhost:3004",
            "http://127.0.0.1:3004",
            "http://localhost:3005",
            "http://127.0.0.1:3005",
            # Desktop dev (Vite). The Tauri renderer talks to the Gateway
            # from a different origin than the dashboard, so it needs its
            # own CORS allowance.
            "http://localhost:1420",
            "http://127.0.0.1:1420",
            # Desktop production (Tauri bundles the renderer under a
            # custom scheme; both shapes appear in different Tauri
            # versions / platforms).
            "tauri://localhost",
            "https://tauri.localhost",
        ]
    )
    request_id_header: str = "X-Request-ID"
    demo_app_id: str = "demo"
    app_api_key: str = "replace-with-local-development-key"
    require_api_key: bool = False
    cache_similarity_threshold: float = 0.94
    default_cache_ttl_seconds: int = 3600
    provider_name: str = "n0tune/dev"
    provider_base_url: str | None = None
    provider_api_key: str | None = None
    # provider_kind selects the wire format. "openai" is the default and covers
    # OpenAI, OpenRouter, Ollama, LM Studio, and any OpenAI-compatible endpoint.
    # "anthropic" uses the /v1/messages shape, "gemini" uses generateContent.
    provider_kind: str = "openai"
    anthropic_version: str = "2023-06-01"
    rate_limit_rpm: int = 0
    rate_limit_window_seconds: int = 60
    rate_limit_backend: str = "memory"
    embedding_provider: str = "hash"
    embedding_model: str = "text-embedding-3-small"
    embedding_openai_base_url: str = "https://api.openai.com/v1"
    embedding_openai_api_key: str | None = None
    embedding_timeout_seconds: int = 30
    fastembed_model: str = "BAAI/bge-small-en-v1.5"
    hybrid_lexical_weight: float = 0.0
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str = "https://cloud.langfuse.com"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="N0TUNE_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
