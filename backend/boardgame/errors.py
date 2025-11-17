"""Exception hierarchy shared across services and routes."""

from __future__ import annotations


class GameError(Exception):
    """Base class for domain errors raised by the services layer."""

    status_code = 400

    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code

    def __str__(self) -> str:  # pragma: no cover - inherited behaviour
        return self.message


class NotFoundError(GameError):
    status_code = 404


class ConflictError(GameError):
    status_code = 409


class InvalidQueryError(GameError):
    status_code = 400


class UpstreamServiceError(GameError):
    status_code = 502


class ValidationError(GameError):
    status_code = 400
