"""Central configuration loaded from environment / .env (backend/.env)."""

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Tayyar Pipelines API"
    api_prefix: str = "/api/v1"
    environment: Literal["development", "production"] = "development"
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174,http://127.0.0.1:5175,http://localhost:5175"
    admin_api_key: str | None = None

    # Daily (WebRTC) — Pipecat transport
    daily_api_key: str | None = None
    daily_subdomain: str | None = None

    # Pipecat stack
    pipecat_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("PIPECTAT_ENABLED", "pipecat_enabled"),
    )
    deepgram_api_key: str | None = None
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    elevenlabs_api_key: str | None = None
    elevenlabs_voice_id: str | None = None

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    # Post-interview LLM rubrics (Section 14.5) — Gemini 2.5 Pro
    gemini_scorecard_model: str = "gemini-2.5-pro"
    gemini_live_model: str = "gemini-3.1-flash-live-preview"  # Live WS; use official 30 prebuilt voice names (gemini_prebuilt_voices)

    llm_provider: Literal["openai", "anthropic", "gemini"] = "gemini"
    llm_model: str = "gpt-4o"

    # Storage
    storage_dir: str = "storage"

    # Analysis
    whisper_model: str = "large-v3"
    # Post-interview Whisper (Stage 2) — medium + word timestamps
    whisper_post_model: str = "medium"
    use_faster_whisper: bool = True
    analysis_sync_timeout_sec: int = 180


@lru_cache
def get_settings() -> Settings:
    return Settings()
