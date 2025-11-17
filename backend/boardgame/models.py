"""Typed representations of database entities."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Mapping, Optional

from .config import COLUMN_MAP
from .errors import ValidationError


@dataclass(slots=True)
class BoardGame:
    """Typed representation of a board game record."""

    name: str
    play_time: Optional[str] = None
    min_duration_minutes: Optional[int] = None
    max_duration_minutes: Optional[int] = None
    player_count: Optional[str] = None
    min_players: Optional[int] = None
    max_players: Optional[int] = None
    team_play: Optional[str] = None
    special_support: Optional[str] = None
    game_type: Optional[str] = None
    everyone_can_play: str = field(default="oui")

    @classmethod
    def from_row(cls, row: Mapping[str, Any]) -> "BoardGame":
        data = {
            field_name: row[COLUMN_MAP[field_name]]
            for field_name in COLUMN_MAP
        }
        return cls(**data)

    def to_db_params(self) -> dict[str, Any]:
        return {
            COLUMN_MAP[field_name]: getattr(self, field_name)
            for field_name in COLUMN_MAP
        }

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _coerce_name(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(
            "Field 'name' is required and must be a non-empty string."
        )
    return value.strip()


def validate_payload(
    payload: Mapping[str, Any], *, existing: Optional[BoardGame] = None
) -> BoardGame:
    """Validate and merge incoming data into a BoardGame instance."""

    unknown_keys = set(payload) - set(COLUMN_MAP)
    if unknown_keys:
        raise ValidationError(
            f"Unknown fields: {', '.join(sorted(unknown_keys))}"
        )

    base_data: dict[str, Any]
    if existing is None:
        base_data = {field_name: None for field_name in COLUMN_MAP}
    else:
        base_data = existing.to_dict()

    for field_name in COLUMN_MAP:
        if field_name in payload:
            base_data[field_name] = payload[field_name]

    base_data["name"] = _coerce_name(base_data.get("name"))

    if base_data.get("everyone_can_play") is None:
        base_data["everyone_can_play"] = "oui"

    return BoardGame(**base_data)
