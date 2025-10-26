"""Backend package for the boardgame CRUD project."""

from .app import BoardGame, TABLE_NAME, create_app

__all__ = ["BoardGame", "TABLE_NAME", "create_app"]
