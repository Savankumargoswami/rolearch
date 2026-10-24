"""Which shard refreshes which company.

Small companies go by a hash of their key (stable as the list grows). The biggest ones, listed in
companies/weights.json with their recent job counts, are dealt out one at a time to the lightest shard, so a few
giants (Dollar General, SchoolSpring) never pile into one shard and hold up the whole refresh. Every shard computes
the same split from the same file, so each company is refreshed exactly once.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .models import Company

WEIGHTS = Path(__file__).resolve().parent.parent / "companies" / "weights.json"
HEAVY = 600  # cost units: at or above this, a company is placed by weight
LIGHT_COST = 40  # rough cost of one small company
# Reading time per job differs by system: Eightfold returns 10 jobs a request, Oracle 50 one page at a time,
# SchoolSpring 500. Sitemap boards fetch each new job's page. Rough relative costs per job:
ATS_COST = {"eightfold": 3.0, "oracle": 1.5, "sitemap": 2.0, "phenom": 1.0, "workday": 1.0, "icims": 1.5, "taleo": 1.5,
            "avature": 1.5, "successfactors": 1.5, "schoolspring": 0.1, "usajobs": 0.3, "amazon": 0.5}


def cost(key: str, jobs: int) -> int:
    """Estimated reading time of one board, from its recent job count and system."""
    return int(jobs * ATS_COST.get(key.split(":", 1)[0], 1.0))


def _hash_shard(key: str, n: int) -> int:
    return int(hashlib.sha1(key.encode()).hexdigest(), 16) % n


def load_weights(path: Path = WEIGHTS) -> dict[str, int]:
    try:
        return {k: int(v) for k, v in json.loads(path.read_text(encoding="utf-8")).items()}
    except (OSError, ValueError):
        return {}


def assign(companies: list[Company], n: int, weights: dict[str, int] | None = None) -> dict[str, int]:
    """Company key -> shard index, for every company."""
    weights = load_weights() if weights is None else weights
    out: dict[str, int] = {}
    load = [0] * n
    heavy = []
    for c in companies:
        w = cost(c.key, weights.get(c.key, 0))
        if w >= HEAVY:
            heavy.append((w, c.key))
        else:
            s = _hash_shard(c.key, n)
            out[c.key] = s
            load[s] += max(w, LIGHT_COST)
    for w, key in sorted(heavy, key=lambda x: (-x[0], x[1])):
        s = min(range(n), key=lambda i: (load[i], i))
        out[key] = s
        load[s] += w
    return out


def pick(companies: list[Company], i: int, n: int) -> list[Company]:
    shard = assign(companies, n)
    return [c for c in companies if shard[c.key] == i]
