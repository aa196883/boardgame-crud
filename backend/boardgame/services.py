"""Domain services shared across the API and HTML blueprints."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Mapping, Optional

from .config import COLUMN_MAP, TABLE_NAME
from .db import connect
from .errors import (
    ConflictError,
    GameError,
    InvalidQueryError,
    NotFoundError,
    UpstreamServiceError,
    ValidationError,
)
from .models import BoardGame, validate_payload
from ..text_to_sql import generate_sql_from_question, is_sql_safe


@dataclass(slots=True)
class GameListResult:
    games: list[BoardGame]
    query: str
    source: str


def list_games(*, question: Optional[str] = None, sql: Optional[str] = None) -> GameListResult:
    """Return all games applying an optional SQL or natural language query."""

    source = "default"
    query: str

    if question:
        try:
            generated_sql = generate_sql_from_question(question)
        except GameError:
            raise
        except Exception as exc:  # pragma: no cover - defensive network errors
            raise UpstreamServiceError(
                f"Failed to generate SQL: {exc}"
            ) from exc

        if not generated_sql:
            raise InvalidQueryError(
                "No SQL could be generated from the question."
            )

        if not is_sql_safe(generated_sql):
            raise InvalidQueryError(
                "Generated SQL failed safety checks."
            )

        query = generated_sql
        source = "question"
    elif sql:
        normalized = sql.lstrip().lower()
        if not normalized.startswith("select"):
            raise InvalidQueryError("Only SELECT statements are allowed.")
        query = sql
        source = "sql"
    else:
        query = (
            f"SELECT * FROM {TABLE_NAME} "
            "ORDER BY nom_du_jeu COLLATE NOCASE"
        )

    try:
        with connect() as connection:
            cursor = connection.execute(query)
            rows = cursor.fetchall()
    except sqlite3.DatabaseError as exc:
        raise InvalidQueryError(f"Invalid SQL query: {exc}") from exc

    games = [BoardGame.from_row(row) for row in rows]
    return GameListResult(games=games, query=query, source=source)


def get_game(name: str) -> BoardGame:
    with connect() as connection:
        cursor = connection.execute(
            f"SELECT * FROM {TABLE_NAME} WHERE nom_du_jeu = ?",
            (name,),
        )
        row = cursor.fetchone()
    if row is None:
        raise NotFoundError("Game not found.")
    return BoardGame.from_row(row)


def create_game(payload: Mapping[str, object]) -> BoardGame:
    game = validate_payload(payload)
    try:
        with connect() as connection:
            connection.execute(
                f"""
                INSERT INTO {TABLE_NAME} (
                    nom_du_jeu,
                    temps_de_jeu,
                    duree_min_minutes,
                    duree_max_minutes,
                    nombre_de_joueurs,
                    joueurs_min,
                    joueurs_max,
                    en_equipe,
                    support_particulier,
                    type_de_jeu,
                    tout_le_monde_peut_jouer
                ) VALUES (
                    :nom_du_jeu,
                    :temps_de_jeu,
                    :duree_min_minutes,
                    :duree_max_minutes,
                    :nombre_de_joueurs,
                    :joueurs_min,
                    :joueurs_max,
                    :en_equipe,
                    :support_particulier,
                    :type_de_jeu,
                    :tout_le_monde_peut_jouer
                )
                """,
                game.to_db_params(),
            )
    except sqlite3.IntegrityError as exc:
        raise ConflictError(
            "A game with the same name already exists."
        ) from exc
    return game


def update_game(name: str, payload: Mapping[str, object]) -> BoardGame:
    existing = get_game(name)
    updated_game = validate_payload(payload, existing=existing)
    params = updated_game.to_db_params()
    params["original_name"] = name

    try:
        with connect() as connection:
            cursor = connection.execute(
                f"""
                UPDATE {TABLE_NAME}
                SET
                    nom_du_jeu = :nom_du_jeu,
                    temps_de_jeu = :temps_de_jeu,
                    duree_min_minutes = :duree_min_minutes,
                    duree_max_minutes = :duree_max_minutes,
                    nombre_de_joueurs = :nombre_de_joueurs,
                    joueurs_min = :joueurs_min,
                    joueurs_max = :joueurs_max,
                    en_equipe = :en_equipe,
                    support_particulier = :support_particulier,
                    type_de_jeu = :type_de_jeu,
                    tout_le_monde_peut_jouer = :tout_le_monde_peut_jouer
                WHERE nom_du_jeu = :original_name
                """,
                params,
            )
    except sqlite3.IntegrityError as exc:
        raise ConflictError(
            "A game with the same name already exists."
        ) from exc

    if cursor.rowcount == 0:
        raise NotFoundError("Game not found.")

    return updated_game


def delete_game(name: str) -> None:
    with connect() as connection:
        cursor = connection.execute(
            f"DELETE FROM {TABLE_NAME} WHERE nom_du_jeu = ?",
            (name,),
        )
    if cursor.rowcount == 0:
        raise NotFoundError("Game not found.")


def build_payload_from_form(form_data: Mapping[str, str]) -> dict[str, object]:
    """Normalize HTML form fields so they match the API payload."""

    def as_optional_string(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = value.strip()
        return text or None

    def as_optional_int(value: Optional[str]) -> Optional[int]:
        text = as_optional_string(value)
        if text is None:
            return None
        try:
            return int(text)
        except ValueError as exc:
            raise ValidationError(
                f"'{value}' is not a valid number."
            ) from exc

    min_players = as_optional_int(form_data.get("min_players"))
    max_players = as_optional_int(form_data.get("max_players"))
    min_duration = as_optional_int(form_data.get("min_duration_minutes"))
    max_duration = as_optional_int(form_data.get("max_duration_minutes"))

    play_time = None
    if min_duration is not None and max_duration is not None:
        play_time = (
            f"{min_duration} min" if min_duration == max_duration
            else f"{min_duration} - {max_duration} min"
        )
    elif min_duration is not None:
        play_time = f"{min_duration} min"
    elif max_duration is not None:
        play_time = f"{max_duration} min"

    player_count = None
    if min_players is not None and max_players is not None:
        player_count = (
            f"{min_players}" if min_players == max_players
            else f"{min_players} à {max_players}"
        )
    elif min_players is not None:
        player_count = f"{min_players}+"
    elif max_players is not None:
        player_count = f"≤ {max_players}"

    payload: dict[str, object] = {
        "name": as_optional_string(form_data.get("name")),
        "min_players": min_players,
        "max_players": max_players,
        "min_duration_minutes": min_duration,
        "max_duration_minutes": max_duration,
        "game_type": as_optional_string(form_data.get("game_type")),
        "team_play": as_optional_string(form_data.get("team_play")),
        "special_support": as_optional_string(form_data.get("special_support")),
        "everyone_can_play": as_optional_string(form_data.get("everyone_can_play"))
        or "oui",
        "play_time": play_time,
        "player_count": player_count,
    }

    return payload
