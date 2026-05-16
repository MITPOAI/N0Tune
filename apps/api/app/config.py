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
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    request_id_header: str = "X-Request-ID"
    demo_app_id: str = "demo"
    app_api_key: str = "replace-with-local-development-key"
    require_api_key: bool = False
    cache_similarity_threshold: float = 0.94
    default_cache_ttl_seconds: int = 3600
    provider_name: str = "n0tune/dev"
    provider_base_url: str | None = None
    provider_api_key: str | None = None
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
