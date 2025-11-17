"""Static configuration for the board game application."""

TABLE_NAME = "jeux"

COLUMN_MAP = {
    "name": "nom_du_jeu",
    "play_time": "temps_de_jeu",
    "min_duration_minutes": "duree_min_minutes",
    "max_duration_minutes": "duree_max_minutes",
    "player_count": "nombre_de_joueurs",
    "min_players": "joueurs_min",
    "max_players": "joueurs_max",
    "team_play": "en_equipe",
    "special_support": "support_particulier",
    "game_type": "type_de_jeu",
    "everyone_can_play": "tout_le_monde_peut_jouer",
}
