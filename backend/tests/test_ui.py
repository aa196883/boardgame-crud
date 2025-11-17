from __future__ import annotations

from backend.boardgame import services


def test_index_page_renders(client):
    response = client.get("/")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "Recherche intelligente" in html
    assert 'id="search-results"' in html


def test_manage_page_contains_form_and_table(client):
    response = client.get("/manage")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert 'id="form-panel"' in html
    assert 'id="manage-table"' in html


def test_htmx_table_endpoint_returns_partial(client):
    response = client.get("/ui/partials/games", query_string={"view": "search"})
    assert response.status_code == 200
    assert b"table" in response.data


def test_render_game_form_prefills_data(client):
    response = client.get(
        "/ui/partials/game-form",
        query_string={"name": "Test Game", "view": "manage"},
    )
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert 'value="Test Game"' in html


def test_htmx_form_submission_creates_game(client):
    payload = {
        "view": "manage",
        "name": "HTMX Game",
        "min_players": "1",
        "max_players": "4",
        "min_duration_minutes": "5",
        "max_duration_minutes": "10",
        "game_type": "Party",
        "team_play": "Non",
        "special_support": "Cartes",
        "everyone_can_play": "oui",
    }
    response = client.post("/ui/games", data=payload)
    assert response.status_code == 201
    assert b"HTMX Game" in response.data


def test_htmx_delete_game(client, app):
    with app.app_context():
        services.create_game({"name": "Temp", "everyone_can_play": "oui"})
    response = client.delete("/ui/games/Temp")
    assert response.status_code == 200
    assert b"Temp" not in response.data
