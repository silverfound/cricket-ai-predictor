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


def history_team_key(value: Any) -> str:
    """Cricsheet may omit Women; gender is filtered separately before this key is used."""
    tokens = normalize_team_name(canonical_team_name(value)).split()
    tokens = [token for token in tokens if token not in {"women", "woman"}]
    if tokens and tokens[-1] == "w":
        tokens.pop()
    return " ".join(tokens)
