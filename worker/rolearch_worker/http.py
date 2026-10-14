"""Shared HTTP client: identifies itself, limits per-host concurrency, retries politely."""

from __future__ import annotations

import asyncio
import logging
import os
import random
from collections import defaultdict
from urllib.parse import urlsplit

import httpx

log = logging.getLogger(__name__)

CONTACT = os.environ.get("ROLEARCH_CONTACT", "admin@rolearch.com")
USER_AGENT = f"RolearchBot/0.1 (+https://rolearch.com/bot; {CONTACT})"


class Fetcher:
    def __init__(self, per_host: int = 2, timeout: float = 30.0) -> None:
        self.client = httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT, "Accept": "application/json, text/html;q=0.9, */*;q=0.5"},
            timeout=timeout,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
        self._hosts: dict[str, asyncio.Semaphore] = defaultdict(lambda: asyncio.Semaphore(per_host))

    async def __aenter__(self) -> "Fetcher":
        return self

    async def __aexit__(self, *exc) -> None:
        await self.client.aclose()

    async def get(self, url: str, *, params: dict | None = None, attempts: int = 3) -> httpx.Response:
        """GET with per-host limits. Retries timeouts, 429 and 5xx with backoff; returns 4xx as-is."""
        host = urlsplit(url).netloc
        for attempt in range(1, attempts + 1):
            async with self._hosts[host]:
                try:
                    r = await self.client.get(url, params=params)
                except (httpx.TimeoutException, httpx.TransportError) as e:
                    if attempt == attempts:
                        raise
                    log.debug("retry %s after %s", url, e)
                else:
                    if r.status_code != 429 and r.status_code < 500:
                        return r
                    if attempt == attempts:
                        r.raise_for_status()
                    retry_after = r.headers.get("retry-after", "")
                    if retry_after.isdigit():
                        await asyncio.sleep(min(int(retry_after), 60))
                        continue
            await asyncio.sleep(2**attempt + random.random())
        raise RuntimeError("unreachable")

    async def json(self, url: str, **kw):
        r = await self.get(url, **kw)
        r.raise_for_status()
        return r.json()
