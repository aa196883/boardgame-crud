"""Database helpers."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Optional

from flask import Flask, current_app


def connect(db_path: Optional[Path | str] = None) -> sqlite3.Connection:
    """Return a SQLite connection configured with a row factory."""

    if db_path is None:
        db_path = get_db_path()
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def get_db_path(app: Optional[Flask] = None) -> Path:
    """Resolve the configured database path."""

    if app is None:
        app = current_app
    return Path(app.config["GAMES_DB_PATH"])
