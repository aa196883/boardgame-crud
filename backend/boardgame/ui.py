"""Server-rendered views powered by htmx."""

from __future__ import annotations

from flask import Blueprint, Response, render_template, request
from werkzeug.exceptions import HTTPException

from .errors import GameError
from . import services


bp = Blueprint("ui", __name__)


def _render_form(
    *,
    game=None,
    message: str | None = None,
    status_code: int = 200,
    view: str = "search",
):
    html = render_template(
        "partials/game_form.html",
        game=game,
        message=message,
        view=view,
    )
    if view == "manage":
        result = services.list_games()
        html += render_template(
            "partials/game_table_wrapper.html",
            games=result.games,
            show_actions=True,
        )
    return Response(html, status=status_code)


@bp.get("/")
def index_page():
    result = services.list_games()
    return render_template(
        "pages/index.html",
        result=result,
        question=request.args.get("question", ""),
        sql=request.args.get("sql", ""),
    )


@bp.get("/manage")
def manage_page():
    result = services.list_games()
    return render_template(
        "pages/manage.html",
        result=result,
    )


@bp.get("/ui/partials/games")
def render_games_table():
    question = request.args.get("question")
    sql = request.args.get("sql")
    view = request.args.get("view", "search")
    try:
        result = services.list_games(question=question, sql=sql)
    except GameError as exc:
        return (
            render_template(
                "partials/game_error.html", message=exc.message
            ),
            exc.status_code,
        )
    html = render_template(
        "partials/game_table.html",
        games=result.games,
        show_actions=view == "manage",
    )
    if view == "search":
        html += render_template(
            "partials/search_message.html", source=result.source
        )
    return html


@bp.get("/ui/partials/game-form")
def render_game_form():
    name = request.args.get("name")
    if name:
        try:
            game = services.get_game(name)
        except GameError as exc:
            return (
                render_template(
                    "partials/game_error.html", message=exc.message
                ),
                exc.status_code,
            )
    else:
        game = None
    view = request.args.get("view", "manage")
    return render_template(
        "partials/game_form.html", game=game, view=view
    )


@bp.post("/ui/games")
def save_game():
    view = request.form.get("view", "search")
    payload = services.build_payload_from_form(request.form)
    original_name = request.form.get("original_name") or None
    try:
        if original_name:
            game = services.update_game(original_name, payload)
            message = f"{game.name} mis à jour."
            status_code = 200
        else:
            game = services.create_game(payload)
            message = f"{game.name} ajouté."
            status_code = 201
    except GameError as exc:
        return _render_form(
            game=payload,
            message=exc.message,
            status_code=exc.status_code,
            view=view,
        )
    return _render_form(
        game=game if original_name else None,
        message=message,
        status_code=status_code,
        view=view,
    )


@bp.delete("/ui/games/<string:name>")
def delete_game_html(name: str):
    try:
        services.delete_game(name)
    except GameError as exc:
        return (
            render_template(
                "partials/game_error.html", message=exc.message
            ),
            exc.status_code,
        )
    result = services.list_games()
    return render_template(
        "partials/game_table.html",
        games=result.games,
        show_actions=True,
    )
