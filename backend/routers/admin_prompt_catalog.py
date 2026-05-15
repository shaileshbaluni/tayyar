"""Admin: live prompt catalog synced from production code."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException

from config import get_settings
from services.prompt_catalog import build_live_prompt_catalog

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")) -> None:
    expected = get_settings().admin_api_key
    if not expected:
        return
    if x_admin_key != expected:
        raise HTTPException(401, "Invalid or missing admin key")


@router.get("/prompt-catalog", dependencies=[Depends(require_admin)])
def get_prompt_catalog():
    """All prompts currently used in production, grouped by feature."""
    return build_live_prompt_catalog()
