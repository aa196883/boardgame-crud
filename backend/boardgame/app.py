"""Application factory for the board-game CRUD app."""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask
from flask_cors import CORS

from . import api, ui


def create_app(db_path: Path | str | None = None) -> Flask:
    if db_path is None:
        default_db = Path(__file__).resolve().parents[1] / "games.db"
        db_path = os.getenv("GAMES_DB_PATH", default_db)
    db_path = Path(db_path).resolve()

    templates_dir = Path(__file__).resolve().parents[1] / "templates"
    static_dir = Path(__file__).resolve().parents[1] / "static"

    app = Flask(
        __name__,
        template_folder=str(templates_dir),
        static_folder=str(static_dir),
    )
    app.config["GAMES_DB_PATH"] = str(db_path)
    app.config["JSON_SORT_KEYS"] = False

    CORS(app)

    app.register_blueprint(ui.bp)
    app.register_blueprint(api.bp)

    return app
