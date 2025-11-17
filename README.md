# 🎲 Boardgame CRUD App

Une application Flask qui combine API JSON et rendu côté serveur pour explorer et mettre à jour une base SQLite de jeux de société. Toute l’interface repose sur [htmx](https://htmx.org/), ce qui permet de limiter le JavaScript à son strict minimum : les formulaires HTML déclenchent directement les opérations CRUD et le backend renvoie les sections HTML (partials) à rebrancher dans la page.

---

## 🧩 Fonctionnalités

### 🔍 Recherche en langage naturel
- Formulaire unique : pose une question en français ou colle une requête SQL `SELECT` si tu préfères.
- Le backend traduit éventuellement la question en SQL via `text_to_sql.py`, vérifie la sécurité puis exécute la requête.
- Le tableau des résultats est rendu côté serveur (partial `partials/game_table.html`) et mis à jour via htmx.

### ✏️ Gestion complète des jeux
- Page dédiée `/manage` avec formulaire (`partials/game_form.html`) et tableau listant les jeux.
- Les actions *modifier* / *supprimer* sont des requêtes htmx (`hx-get`, `hx-delete`). Les réponses incluent des swaps out-of-band pour rafraîchir le tableau sans JavaScript custom.
- La logique métier est centralisée dans `backend/boardgame/services.py` (validation, SQL, normalisation du formulaire).

### 🧱 Architecture modulaire
- `backend/boardgame/app.py` : factory Flask et enregistrement des blueprints API/UI.
- `backend/boardgame/api.py` : endpoints JSON (`/games`, `/games/<name>`...).
- `backend/boardgame/ui.py` : pages HTML + partials.
- `backend/boardgame/models.py`, `config.py`, `db.py`, `errors.py` : séparation claire des responsabilités.
- Templates organisés par pages et partials (`backend/templates/pages/*`, `backend/templates/partials/*`).

---

## 🚀 Lancer le projet

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
export FLASK_APP=backend.app
flask run --debug
```

La base SQLite (`backend/games.db`) est utilisée par défaut. Tu peux surcharger le chemin via `GAMES_DB_PATH`.

---

## ✅ Tests

Tous les tests se trouvent dans `backend/tests/` et couvrent :
- l’API JSON (unités + intégration),
- les vues HTML (partials htmx, formulaires),
- la logique de normalisation des formulaires.

Exécuter la suite complète :

```bash
cd backend
pytest
```

---

© 2025 – Boardgame CRUD Project
