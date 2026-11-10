"""Hint words for the skill patterns in worker/rolearch_worker/data/skills.json.

For each pattern part, a list of plain words one of which appears in every possible match ("python" for Python,
"supervis" for Leadership's "supervise/supervising"). The database checks for a hint with a cheap substring search
and runs the regex only when one is present: about 3x faster tagging, same tags (db/046). A part gets hints only
when EVERY top-level alternative has a plain run of 3+ characters that isn't made optional; otherwise None, and the
regex always runs. After editing skills.json, check on real jobs that every match contains a hint (see db/046).
"""
from __future__ import annotations

B = chr(92)  # backslash


def split_top(p: str) -> list[str]:
    """Top-level alternatives of a regex (| outside groups and character classes)."""
    out, depth, cur, i = [], 0, "", 0
    while i < len(p):
        ch = p[i]
        if ch == B:
            cur += p[i:i + 2]; i += 2; continue
        if ch == "[":
            j = p.index("]", i + 1); cur += p[i:j + 1]; i = j + 1; continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "|" and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
        i += 1
    out.append(cur)
    return out


def literal(branch: str) -> str | None:
    """The longest run of plain characters at depth 0 that no quantifier makes optional, or None."""
    runs, cur, depth, i = [], "", 0, 0
    while i < len(branch):
        ch = branch[i]
        if ch == B:
            runs.append(cur); cur = ""; i += 2; continue
        if ch == "[":
            runs.append(cur); cur = ""; i = branch.index("]", i + 1) + 1; continue
        if ch == "(":
            depth += 1; runs.append(cur); cur = ""; i += 1; continue
        if ch == ")":
            depth -= 1; i += 1
            if i < len(branch) and branch[i] in "?*{":
                i += 1
            continue
        if depth == 0 and (ch.isalnum() or ch in " -/&,'"):
            if i + 1 < len(branch) and branch[i + 1] in "?*{":  # this character is optional: end the run before it
                runs.append(cur); cur = ""; i += 2; continue
            cur += ch
        else:
            runs.append(cur); cur = ""
        i += 1
    runs.append(cur)
    runs = [r.strip() for r in runs if len(r.strip()) >= 3]
    return max(runs, key=len) if runs else None


def hints_for(part: str | None, lower: bool) -> list[str] | None:
    if not part:
        return None
    lits = [literal(b) for b in split_top(part)]
    if any(x is None for x in lits):
        return None
    return sorted({x.lower() if lower else x for x in lits})
