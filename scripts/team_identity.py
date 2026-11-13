"""Shared cricket team identity rules for provider, history and prediction code."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[1]
_ALIAS_PATH = _ROOT / "data" / "team_aliases.json"
try:
    _ALIAS_DATA = json.loads(_ALIAS_PATH.read_text(encoding="utf-8"))
except (OSError, ValueError):
    _ALIAS_DATA = {"aliases": {}}


def clean_team_label(value: Any) -> str:
    """Remove known competition suffixes while retaining men's/women's identity."""
    label = str(value or "").strip()
    if not label:
        return ""
    label = re.sub(r"\s*\((?:NPL|IPL|PSL|BBL|WBBL|BPL|CPL|WCPL|LPL|ILT20|SA20|MLC|WPL|T10|The Hundred)\)\s*$", "", label, flags=re.I)
    label = re.sub(r"\s*\((?:W|Women)\)\s*$", " Women", label, flags=re.I)
    label = re.sub(r"\s+", " ", label).strip()
    return label


def normalize_team_name(value: Any) -> str:
    """Comparison key; deliberately does not discard the Women suffix."""
    label = clean_team_label(value).casefold().replace("&", " and ")
    label = re.sub(r"[^a-z0-9]+", " ", label)
    return re.sub(r"\s+", " ", label).strip()


_ALIAS_INDEX = {
    normalize_team_name(alias): clean_team_label(canonical)
    for alias, canonical in (_ALIAS_DATA.get("aliases") or {}).items()
    if normalize_team_name(alias) and clean_team_label(canonical)
}


def canonical_team_name(value: Any) -> str:
    """Resolve a known provider alias to the exact model/history team label."""
    cleaned = clean_team_label(value)
    if not cleaned:
        return ""
    return _ALIAS_INDEX.get(normalize_team_name(cleaned), cleaned)


def team_names_equivalent(left: Any, right: Any) -> bool:
    """Strict identity comparison; no unsafe prefix or last-word matching."""
    a, b = canonical_team_name(left), canonical_team_name(right)
    return bool(a and b and normalize_team_name(a) == normalize_team_name(b))


def team_gender(value: Any) -> str:
    """Infer fixture gender without allowing women's and men's sides to collide."""
    tokens = normalize_team_name(value).split()
    return "female" if "women" in tokens or (tokens and tokens[-1] == "w") else "male"


def resolve_fixture_team(value: Any, team1: Any, team2: Any) -> str:
    """Resolve provider shorthand to one side of a known fixture, or fail closed.

    Exact shared aliases are preferred. Contextual matching then accepts:
    - a multi-token prefix (e.g. "Northern Brave" for a longer canonical label),
    - an initial plus following exact tokens (e.g. "S Paschim"),
    - a unique final token (e.g. "Tigers" for "United Tigers").

    Every shorthand must identify exactly one side; ambiguous names never match.
    """
    candidate = canonical_team_name(value)
    sides = [canonical_team_name(team1), canonical_team_name(team2)]
    if not candidate or not all(sides) or team_names_equivalent(*sides):
        return ""
    exact = [side for side in sides if team_names_equivalent(candidate, side)]
    if len(exact) == 1:
        return exact[0]
    if exact:
        return ""

    alias_tokens = normalize_team_name(candidate).split()
    if not alias_tokens:
        return ""
    matches = []
    for side in sides:
        full = normalize_team_name(side).split()
        if not full or len(alias_tokens) >= len(full):
            continue
        multi_prefix = len(alias_tokens) > 1 and all(
            token == full[index] for index, token in enumerate(alias_tokens)
        )
        initial_prefix = (
            len(alias_tokens) > 1
            and len(alias_tokens[0]) == 1
            and full[0].startswith(alias_tokens[0])
            and all(alias_tokens[index] == full[index] for index in range(1, len(alias_tokens)))
        )
        unique_final = len(alias_tokens) == 1 and alias_tokens[0] == full[-1]
        if multi_prefix or initial_prefix or unique_final:
            matches.append(side)
    return matches[0] if len(matches) == 1 else ""


def fixture_teams_equivalent(
    first_team1: Any, first_team2: Any, second_team1: Any, second_team2: Any
) -> bool:
    """Return true only when two fixture pairs map one-to-one, in either order."""
    first = [canonical_team_name(first_team1), canonical_team_name(first_team2)]
    if not all(first) or team_names_equivalent(*first):
        return False
    second = [
        resolve_fixture_team(second_team1, first[0], first[1]),
        resolve_fixture_team(second_team2, first[0], first[1]),
    ]
    return bool(all(second) and len(set(second)) == 2 and set(second) == set(first))


def history_team_key(value: Any) -> str:
    """Cricsheet may omit Women; gender is filtered separately before this key is used."""
    tokens = normalize_team_name(canonical_team_name(value)).split()
    tokens = [token for token in tokens if token not in {"women", "woman"}]
    if tokens and tokens[-1] == "w":
        tokens.pop()
    return " ".join(tokens)
