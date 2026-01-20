from __future__ import annotations

import os
import sqlite3
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Mapping, Optional

from flask import Flask, abort, jsonify, request

from text_to_sql import generate_sql_from_question, is_sql_safe
from flask_cors import CORS

TABLE_NAME = "jeux"


COLUMN_MAP = {
    "name": "nom_du_jeu",
    "play_time": "temps_de_jeu",
    "min_duration_minutes": "duree_min_minutes",
    "max_duration_minutes": "duree_max_minutes",
    "player_count": "nombre_de_joueurs",
    "min_players": "joueurs_min",
    "max_players": "joueurs_max",
    "team_play": "en_equipe",
    "special_support": "support_particulier",
    "game_type": "type_de_jeu",
    "everyone_can_play": "tout_le_monde_peut_jouer",
}


@dataclass
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
    def from_row(cls, row: sqlite3.Row) -> "BoardGame":
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


def _validate_payload(payload: Mapping[str, Any], *, existing: Optional[BoardGame] = None) -> BoardGame:
    """Validate and merge incoming data into a BoardGame instance."""

    unknown_keys = set(payload) - set(COLUMN_MAP)
    if unknown_keys:
        abort(400, description=f"Unknown fields: {', '.join(sorted(unknown_keys))}")

    base_data: dict[str, Any]
    if existing is None:
        base_data = {field_name: None for field_name in COLUMN_MAP}
    else:
        base_data = existing.to_dict()

    for field_name in COLUMN_MAP:
        if field_name in payload:
            base_data[field_name] = payload[field_name]

    name = base_data.get("name")
    if not isinstance(name, str) or not name.strip():
        abort(400, description="Field 'name' is required and must be a non-empty string.")

    if base_data.get("everyone_can_play") is None:
        base_data["everyone_can_play"] = "oui"

    return BoardGame(**base_data)


def _connect(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def _get_db_path(app: Flask) -> Path:
    return Path(app.config["GAMES_DB_PATH"])


def create_app(db_path: Optional[Path | str] = None) -> Flask:
    """Application factory for the board-game CRUD API."""

    if db_path is None:
        db_path = os.getenv("GAMES_DB_PATH", Path(__file__).with_name("games.db"))
    db_path = Path(db_path)

    app = Flask(__name__)
    app.config["GAMES_DB_PATH"] = str(db_path)
    app.config["JSON_SORT_KEYS"] = False

    CORS(app)

    @app.get("/api/games")
    def list_games() -> Any:
        sql_query = request.args.get("sql")
        question = request.args.get("question")

        if question:
            try:
                generated_sql = generate_sql_from_question(question)
            except Exception as exc:  # pragma: no cover - defensive: API/network errors
                abort(502, description=f"Failed to generate SQL: {exc}")

            if not generated_sql:
                abort(400, description="No SQL could be generated from the question.")

            if not is_sql_safe(generated_sql):
                abort(400, description="Generated SQL failed safety checks.")

            query = generated_sql

            print(f"Generated SQL for question '{question}':\n{generated_sql}\n")
        elif sql_query:
            normalized = sql_query.lstrip().lower()
            if not normalized.startswith("select"):
                abort(400, description="Only SELECT statements are allowed.")
            query = sql_query
        else:
            query = (
                f"SELECT * FROM {TABLE_NAME} "
                "ORDER BY nom_du_jeu COLLATE NOCASE"
            )

        db_file = _get_db_path(app)
        try:
            with _connect(db_file) as connection:
                cursor = connection.execute(query)
                rows = cursor.fetchall()
        except sqlite3.DatabaseError as exc:
            abort(400, description=f"Invalid SQL query: {exc}")

        games = [BoardGame.from_row(row).to_dict() for row in rows]
        return jsonify(games)

    @app.get("/api/games/<string:name>")
    def get_game(name: str) -> Any:
        db_file = _get_db_path(app)
        with _connect(db_file) as connection:
            cursor = connection.execute(
                f"SELECT * FROM {TABLE_NAME} WHERE nom_du_jeu = ?",
                (name,),
            )
            row = cursor.fetchone()
        if row is None:
            abort(404, description="Game not found.")
        return jsonify(BoardGame.from_row(row).to_dict())

    @app.post("/api/games")
    def create_game() -> Any:
        payload = request.get_json(silent=True)
        if not isinstance(payload, Mapping):
            abort(400, description="A JSON body is required.")
        game = _validate_payload(payload)
        db_file = _get_db_path(app)
        try:
            with _connect(db_file) as connection:
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
            abort(409, description="A game with the same name already exists.")
        return jsonify(game.to_dict()), 201

    @app.put("/api/games/<string:name>")
    def update_game(name: str) -> Any:
        payload = request.get_json(silent=True)
        if not isinstance(payload, Mapping):
            abort(400, description="A JSON body is required.")

        db_file = _get_db_path(app)
        with _connect(db_file) as connection:
            cursor = connection.execute(
                f"SELECT * FROM {TABLE_NAME} WHERE nom_du_jeu = ?",
                (name,),
            )
            row = cursor.fetchone()
        if row is None:
            abort(404, description="Game not found.")

        existing = BoardGame.from_row(row)
        updated_game = _validate_payload(payload, existing=existing)

        params = updated_game.to_db_params()
        params["original_name"] = name

        try:
            with _connect(db_file) as connection:
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
        except sqlite3.IntegrityError:
            abort(409, description="A game with the same name already exists.")

        if cursor.rowcount == 0:
            abort(404, description="Game not found.")

        return jsonify(updated_game.to_dict())

    @app.delete("/api/games/<string:name>")
    def delete_game(name: str) -> Any:
        db_file = _get_db_path(app)
        with _connect(db_file) as connection:
            cursor = connection.execute(
                f"DELETE FROM {TABLE_NAME} WHERE nom_du_jeu = ?",
                (name,),
            )
        if cursor.rowcount == 0:
            abort(404, description="Game not found.")
        return ("", 204)

    return app


if __name__ == "__main__":
    application = create_app()
    port = int(os.getenv("PORT", "5000"))
    debug_flag = os.getenv("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    application.run(debug=True, host="0.0.0.0", port=port)
