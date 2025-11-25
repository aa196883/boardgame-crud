from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from backend.boardgame import BoardGame, TABLE_NAME
from backend.boardgame import services


def test_list_games(client):
    response = client.get("/games")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert data[0]["name"] == "Test Game"


def test_list_games_accepts_sql_query(client):
    response = client.get(
        "/games",
        query_string={
            "sql": "SELECT * FROM jeux ORDER BY joueurs_min DESC, nom_du_jeu",
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert data[0]["name"] == "Test Game"


def test_rejects_non_select_statements(client):
    response = client.get("/games", query_string={"sql": "DELETE FROM jeux"})
    assert response.status_code == 400


def test_natural_language_question(client, monkeypatch):
    captured = {}

    def fake_generate(question: str) -> str:
        captured["question"] = question
        return "SELECT * FROM jeux ORDER BY nom_du_jeu"

    monkeypatch.setattr(
        services, "generate_sql_from_question", fake_generate
    )

    response = client.get("/games", query_string={"question": "liste des jeux"})

    assert response.status_code == 200
    assert captured["question"] == "liste des jeux"
    payload = response.get_json()
    assert isinstance(payload, list)


def test_natural_language_rejects_unsafe_sql(client, monkeypatch):

    def fake_generate(_: str) -> str:
        return "DROP TABLE jeux"

    monkeypatch.setattr(
        services, "generate_sql_from_question", fake_generate
    )

    response = client.get("/games", query_string={"question": "supprimer"})

    assert response.status_code == 400


def test_get_single_game(client):
    response = client.get("/games/Test Game")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["min_players"] == 2


def test_create_game(client):
    payload = {
        "name": "New Game",
        "min_players": 1,
        "max_players": 5,
        "everyone_can_play": "non",
    }
    response = client.post("/games", json=payload)
    assert response.status_code == 201
    body = response.get_json()
    assert body["name"] == "New Game"

    get_response = client.get("/games/New Game")
    assert get_response.status_code == 200


def test_update_game(client):
    response = client.put("/games/Test Game", json={"min_players": 3})
    assert response.status_code == 200
    updated = response.get_json()
    assert updated["min_players"] == 3
    assert updated["max_players"] == 4


def test_delete_game(client):
    response = client.delete("/games/Test Game")
    assert response.status_code == 204
    follow_up = client.get("/games/Test Game")
    assert follow_up.status_code == 404


def test_cors_headers(client):
    response = client.get("/games")
    assert response.headers.get("Access-Control-Allow-Origin") == "*"


def test_database_schema_constraints(app):
    db_path = Path(app.config["GAMES_DB_PATH"])
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute(f"PRAGMA table_info({TABLE_NAME})")
        info = {row[1]: row for row in cursor.fetchall()}

        assert info["id"][5] == 1  # primary key flag
        assert info["nom_du_jeu"][3] == 1  # NOT NULL constraint


def test_build_payload_from_form_handles_ranges():
    payload = services.build_payload_from_form(
        {
            "name": "Payload",
            "min_players": "2",
            "max_players": "4",
            "min_duration_minutes": "10",
            "max_duration_minutes": "15",
            "game_type": "Coopératif",
            "team_play": "Oui",
            "special_support": "Cartes",
            "everyone_can_play": "oui",
        }
    )

    assert payload["play_time"] == "10 - 15 min"
    assert payload["player_count"] == "2 à 4"
    assert payload["name"] == "Payload"
