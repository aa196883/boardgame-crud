from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import BoardGame, TABLE_NAME, create_app


CREATE_TABLE_SQL = f"""
CREATE TABLE {TABLE_NAME} (
    nom_du_jeu TEXT PRIMARY KEY,
    temps_de_jeu TEXT,
    duree_min_minutes INTEGER,
    duree_max_minutes INTEGER,
    nombre_de_joueurs TEXT,
    joueurs_min INTEGER,
    joueurs_max INTEGER,
    en_equipe TEXT,
    support_particulier TEXT,
    type_de_jeu TEXT,
    tout_le_monde_peut_jouer TEXT
)
"""


@pytest.fixture()
def app(tmp_path: Path):
    db_path = tmp_path / "games.db"
    connection = sqlite3.connect(db_path)
    with connection:
        connection.execute(CREATE_TABLE_SQL)
        seed = BoardGame(
            name="Test Game",
            play_time="30",
            min_duration_minutes=25,
            max_duration_minutes=35,
            player_count="2-4",
            min_players=2,
            max_players=4,
            team_play="non",
            special_support=None,
            game_type="Strategy",
            everyone_can_play="oui",
        )
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
            seed.to_db_params(),
        )
    connection.close()

    flask_app = create_app(db_path)
    flask_app.config.update({"TESTING": True})
    yield flask_app


def test_list_games(client):
    response = client.get("/games")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert data[0]["name"] == "Test Game"


@pytest.fixture()
def client(app):
    return app.test_client()


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
