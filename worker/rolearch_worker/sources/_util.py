from __future__ import annotations

from datetime import datetime, timezone


def parse_time(value) -> datetime | None:
    """ISO strings, 'YYYY-MM-DD', or epoch milliseconds -> aware UTC datetime."""
    if value in (None, ""):
        return None
    try:
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
        s = str(value).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, OSError):
        return None


def period_of(interval: str | None) -> str:
    i = (interval or "").lower()
    if "hour" in i:
        return "hour"
    if "month" in i:
        return "month"
    return "year"


def workplace_of(value: str | None) -> str | None:
    v = (value or "").lower().replace("-", "").replace("_", "")
    if "remote" in v:
        return "remote"
    if "hybrid" in v:
        return "hybrid"
    if "onsite" in v or "office" in v:
        return "onsite"
    return None
