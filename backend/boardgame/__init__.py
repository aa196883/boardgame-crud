"""Board game application package."""

from .app import create_app
from .config import TABLE_NAME
from .models import BoardGame

__all__ = ["BoardGame", "TABLE_NAME", "create_app"]
