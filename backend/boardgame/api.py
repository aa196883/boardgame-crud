"""REST API blueprint."""

from __future__ import annotations

from flask import Blueprint, abort, jsonify, request

from .errors import GameError
from . import services


bp = Blueprint("api", __name__)


def _json_response(payload, status_code: int = 200):
    return jsonify(payload), status_code


@bp.get("/games")
def list_games():
    question = request.args.get("question")
    sql = request.args.get("sql")
    try:
        result = services.list_games(question=question, sql=sql)
    except GameError as exc:
        abort(exc.status_code, description=exc.message)
    return _json_response([game.to_dict() for game in result.games])


@bp.get("/games/<string:name>")
def get_game(name: str):
    try:
        game = services.get_game(name)
    except GameError as exc:
        abort(exc.status_code, description=exc.message)
    return _json_response(game.to_dict())


@bp.post("/games")
def create_game():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        abort(400, description="A JSON body is required.")
    try:
        game = services.create_game(payload)
    except GameError as exc:
        abort(exc.status_code, description=exc.message)
    return _json_response(game.to_dict(), 201)


@bp.put("/games/<string:name>")
def update_game(name: str):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        abort(400, description="A JSON body is required.")
    try:
        updated_game = services.update_game(name, payload)
    except GameError as exc:
        abort(exc.status_code, description=exc.message)
    return _json_response(updated_game.to_dict())


@bp.delete("/games/<string:name>")
def delete_game(name: str):
    try:
        services.delete_game(name)
    except GameError as exc:
        abort(exc.status_code, description=exc.message)
    return ("", 204)
