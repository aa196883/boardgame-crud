"""Compatibility entrypoint that exposes the application factory."""

from __future__ import annotations

import os

from .boardgame import BoardGame, TABLE_NAME, create_app

__all__ = ["BoardGame", "TABLE_NAME", "create_app"]


if __name__ == "__main__":
    application = create_app()
    port = int(os.getenv("PORT", "5000"))
    debug_flag = os.getenv("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    application.run(debug=debug_flag, host="0.0.0.0", port=port)
