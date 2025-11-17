from __future__ import annotations

import json
import os
import re
import sqlite3
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Mapping, Optional

from flask import Flask, abort, jsonify, make_response, render_template, request

try:  # pragma: no cover - compatibility for direct execution
    from .text_to_sql import generate_sql_from_question, is_sql_safe
except ImportError:  # pragma: no cover - fallback when running as a script
    from text_to_sql import generate_sql_from_question, is_sql_safe

from flask_cors import CORS
from werkzeug.exceptions import HTTPException

TABLE_NAME = "jeux"

NUMBER_REGEX = re.compile(r"\d+")
DEFAULT_SORT_KEY = "name"
VALID_SORT_KEYS = {"name", "players", "duration", "type", "complexite"}


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


def _get_value(obj: Mapping[str, Any] | BoardGame, field: str) -> Any:
    if isinstance(obj, Mapping):
        return obj.get(field)
    return getattr(obj, field, None)


def _parse_numeric_range(text: Optional[str]) -> Optional[tuple[int, int]]:
    if not text:
        return None
    numbers = [int(match) for match in NUMBER_REGEX.findall(str(text))]
    if not numbers:
        return None
    return (min(numbers), max(numbers))


def format_duration(game: Mapping[str, Any] | BoardGame) -> Optional[str]:
    min_duration = _get_value(game, "min_duration_minutes")
    max_duration = _get_value(game, "max_duration_minutes")
    play_time = _get_value(game, "play_time")

    if isinstance(min_duration, int) and isinstance(max_duration, int):
        if min_duration == max_duration:
            return f"{min_duration} min"
        return f"{min_duration} - {max_duration} min"
    if isinstance(min_duration, int):
        return f"{min_duration} min"
    if isinstance(max_duration, int):
        return f"{max_duration} min"

    return play_time


def format_players(game: Mapping[str, Any] | BoardGame) -> Optional[str]:
    min_players = _get_value(game, "min_players")
    max_players = _get_value(game, "max_players")
    player_count = _get_value(game, "player_count")

    if isinstance(min_players, int) and isinstance(max_players, int):
        if min_players == max_players:
            return str(min_players)
        return f"{min_players} - {max_players}"
    if isinstance(min_players, int):
        return f"{min_players}+"
    if isinstance(max_players, int):
        return f"≤ {max_players}"

    range_values = _parse_numeric_range(player_count)
    if range_values:
        low, high = range_values
        if low == high:
            return str(low)
        return f"{low} - {high}"
    return player_count


def format_tags(value: Optional[str]) -> list[str]:
    if not value:
        return []
    tags = [entry.strip() for entry in str(value).split(",")]
    return [f"#{tag}" for tag in tags if tag]


def _derive_play_time_string(
    min_duration: Optional[int], max_duration: Optional[int]
) -> Optional[str]:
    if isinstance(min_duration, int) and isinstance(max_duration, int):
        if min_duration == max_duration:
            return f"{min_duration} min"
        return f"{min_duration} - {max_duration} min"
    if isinstance(min_duration, int):
        return f"{min_duration} min"
    if isinstance(max_duration, int):
        return f"{max_duration} min"
    return None


def _derive_player_count_string(
    min_players: Optional[int], max_players: Optional[int]
) -> Optional[str]:
    if isinstance(min_players, int) and isinstance(max_players, int):
        if min_players == max_players:
            return f"{min_players}"
        return f"{min_players} à {max_players}"
    if isinstance(min_players, int):
        return f"{min_players}+"
    if isinstance(max_players, int):
        return f"≤ {max_players}"
    return None


def _clean_string(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = str(value).strip()
    return trimmed or None


def _parse_optional_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        abort(400, description=f"Value '{value}' is not a valid integer.")


def _normalize_sort_key(sort_key: Optional[str]) -> str:
    if sort_key in VALID_SORT_KEYS:
        return sort_key
    return DEFAULT_SORT_KEY


def _normalize_direction(direction: Optional[str]) -> str:
    return "desc" if direction == "desc" else "asc"


def _build_sort_clause(sort_key: str, direction: str) -> str:
    dir_sql = "DESC" if direction == "desc" else "ASC"
    if sort_key == "players":
        return (
            f"ORDER BY COALESCE(joueurs_min, joueurs_max) {dir_sql}, "
            f"COALESCE(joueurs_max, joueurs_min) {dir_sql}, "
            "nom_du_jeu COLLATE NOCASE ASC"
        )
    if sort_key == "duration":
        return (
            f"ORDER BY COALESCE(duree_min_minutes, duree_max_minutes) {dir_sql}, "
            f"COALESCE(duree_max_minutes, duree_min_minutes) {dir_sql}, "
            "nom_du_jeu COLLATE NOCASE ASC"
        )
    if sort_key == "type":
        return (
            f"ORDER BY type_de_jeu COLLATE NOCASE {dir_sql}, "
            "nom_du_jeu COLLATE NOCASE ASC"
        )
    if sort_key == "complexite":
        return (
            f"ORDER BY en_equipe COLLATE NOCASE {dir_sql}, "
            "nom_du_jeu COLLATE NOCASE ASC"
        )

    return f"ORDER BY nom_du_jeu COLLATE NOCASE {dir_sql}"


def _fetch_games(
    app: Flask,
    *,
    question: Optional[str] = None,
    sql: Optional[str] = None,
    sort_key: str = DEFAULT_SORT_KEY,
    direction: str = "asc",
) -> list[dict[str, Any]]:
    if question:
        try:
            generated_sql = generate_sql_from_question(question)
        except Exception as exc:  # pragma: no cover
            abort(502, description=f"Failed to generate SQL: {exc}")

        if not generated_sql:
            abort(400, description="No SQL could be generated from the question.")

        if not is_sql_safe(generated_sql):
            abort(400, description="Generated SQL failed safety checks.")

        query = generated_sql
    elif sql:
        normalized = sql.lstrip().lower()
        if not normalized.startswith("select"):
            abort(400, description="Only SELECT statements are allowed.")
        query = sql
    else:
        clause = _build_sort_clause(sort_key, direction)
        query = f"SELECT * FROM {TABLE_NAME} {clause}"

    db_file = _get_db_path(app)
    try:
        with _connect(db_file) as connection:
            cursor = connection.execute(query)
            rows = cursor.fetchall()
    except sqlite3.DatabaseError as exc:
        abort(400, description=f"Invalid SQL query: {exc}")

    return [BoardGame.from_row(row).to_dict() for row in rows]


def _get_game_or_404(app: Flask, name: str) -> BoardGame:
    db_file = _get_db_path(app)
    with _connect(db_file) as connection:
        cursor = connection.execute(
            f"SELECT * FROM {TABLE_NAME} WHERE nom_du_jeu = ?",
            (name,),
        )
        row = cursor.fetchone()
    if row is None:
        abort(404, description="Game not found.")
    return BoardGame.from_row(row)


def _insert_game_record(app: Flask, payload: Mapping[str, Any]) -> BoardGame:
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
    except sqlite3.IntegrityError:
        abort(409, description="A game with the same name already exists.")
    return game


def _update_game_record(app: Flask, name: str, payload: Mapping[str, Any]) -> BoardGame:
    existing = _get_game_or_404(app, name)
    updated_game = _validate_payload(payload, existing=existing)
    params = updated_game.to_db_params()
    params["original_name"] = name

    db_file = _get_db_path(app)
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

    return updated_game


def _delete_game_record(app: Flask, name: str) -> None:
    db_file = _get_db_path(app)
    with _connect(db_file) as connection:
        cursor = connection.execute(
            f"DELETE FROM {TABLE_NAME} WHERE nom_du_jeu = ?",
            (name,),
        )
    if cursor.rowcount == 0:
        abort(404, description="Game not found.")


def _render_htmx(template_name: str, *, status: int = 200, triggers: Optional[Mapping[str, Any]] = None, **context: Any):
    html = render_template(template_name, **context)
    response = make_response(html, status)
    if triggers:
        response.headers["HX-Trigger"] = json.dumps(triggers)
    return response


def _payload_from_form(form: Mapping[str, str]) -> dict[str, Any]:
    min_players = _parse_optional_int(form.get("min_players"))
    max_players = _parse_optional_int(form.get("max_players"))
    min_duration = _parse_optional_int(form.get("min_duration_minutes"))
    max_duration = _parse_optional_int(form.get("max_duration_minutes"))

    return {
        "name": _clean_string(form.get("name")),
        "min_players": min_players,
        "max_players": max_players,
        "min_duration_minutes": min_duration,
        "max_duration_minutes": max_duration,
        "play_time": _derive_play_time_string(min_duration, max_duration),
        "player_count": _derive_player_count_string(min_players, max_players),
        "game_type": _clean_string(form.get("game_type")),
        "team_play": _clean_string(form.get("team_play")),
        "special_support": _clean_string(form.get("special_support")),
        "everyone_can_play": _clean_string(form.get("everyone_can_play")) or "oui",
    }

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
    app.jinja_env.globals.update(
        format_duration=format_duration,
        format_players=format_players,
        format_tags=format_tags,
    )

    @app.get("/games")
    def list_games() -> Any:
        sql_query = request.args.get("sql")
        question = (request.args.get("question") or "").strip() or None
        sort_key = _normalize_sort_key(request.args.get("order"))
        direction = _normalize_direction(request.args.get("direction"))

        games = _fetch_games(
            app,
            question=question,
            sql=sql_query,
            sort_key=sort_key,
            direction=direction,
        )
        return jsonify(games)

    @app.get("/games/<string:name>")
    def get_game(name: str) -> Any:
        game = _get_game_or_404(app, name)
        return jsonify(game.to_dict())

    @app.post("/games")
    def create_game() -> Any:
        payload = request.get_json(silent=True)
        if not isinstance(payload, Mapping):
            abort(400, description="A JSON body is required.")
        game = _insert_game_record(app, payload)
        return jsonify(game.to_dict()), 201

    @app.put("/games/<string:name>")
    def update_game(name: str) -> Any:
        payload = request.get_json(silent=True)
        if not isinstance(payload, Mapping):
            abort(400, description="A JSON body is required.")
        updated_game = _update_game_record(app, name, payload)
        return jsonify(updated_game.to_dict())

    @app.delete("/games/<string:name>")
    def delete_game(name: str) -> Any:
        _delete_game_record(app, name)
        return ("", 204)

    @app.get("/")
    def home() -> Any:
        return render_template("pages/home.html")

    @app.get("/ui/search-results")
    def search_results_partial() -> Any:
        question = (request.args.get("question") or "").strip()
        order = _normalize_sort_key(request.args.get("order"))
        direction = _normalize_direction(request.args.get("direction"))
        games = _fetch_games(
            app,
            question=question or None,
            sort_key=order,
            direction=direction,
        )
        return _render_htmx(
            "partials/search_results.html",
            games=games,
            order=order,
            direction=direction,
            question=question,
        )

    @app.get("/ui/admin-table")
    def admin_table_partial() -> Any:
        games = _fetch_games(app)
        return _render_htmx("partials/admin_table.html", games=games)

    @app.get("/ui/game-form")
    def game_form_partial() -> Any:
        return _render_htmx(
            "partials/game_form.html",
            game=None,
            original_name=None,
        )

    @app.get("/ui/game-form/<string:name>")
    def game_form_partial_with_name(name: str) -> Any:
        game = _get_game_or_404(app, name)
        return _render_htmx(
            "partials/game_form.html",
            game=game.to_dict(),
            original_name=name,
        )

    @app.post("/ui/games")
    def submit_game_form() -> Any:
        original_name = _clean_string(request.form.get("original_name"))
        payload = _payload_from_form(request.form)
        form_state = dict(payload)
        if not form_state.get("name"):
            form_state["name"] = request.form.get("name", "")

        try:
            if original_name:
                updated_game = _update_game_record(app, original_name, payload)
                message = f"Jeu « {updated_game.name} » mis à jour."
            else:
                new_game = _insert_game_record(app, payload)
                message = f"Jeu « {new_game.name} » ajouté."
        except HTTPException as exc:
            return _render_htmx(
                "partials/game_form.html",
                status=exc.code,
                game=form_state,
                original_name=original_name,
                error=exc.description,
            )

        return _render_htmx(
            "partials/game_form.html",
            game=None,
            original_name=None,
            message=message,
            triggers={"games-changed": True},
        )

    @app.delete("/ui/games/<string:name>")
    def delete_game_ui(name: str) -> Any:
        _delete_game_record(app, name)
        games = _fetch_games(app)
        return _render_htmx(
            "partials/admin_table.html",
            games=games,
            triggers={"games-changed": True},
        )

    return app


if __name__ == "__main__":
    application = create_app()
    port = int(os.getenv("PORT", "5000"))
    debug_flag = os.getenv("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    application.run(debug=debug_flag, host="0.0.0.0", port=port)
