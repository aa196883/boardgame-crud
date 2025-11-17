# 🎲 Boardgame CRUD App

A lightweight web application to manage a personal database of board games, with a special focus on **natural language search in French**.

---

## 🧩 Overview

This app allows you to **create, view, update, and delete** entries in a board game database, through a clean, modern interface.

Beyond standard database operations, it introduces a unique **“smart query” system**: users can express complex filters using plain French sentences — for example:

> “Je veux tous les jeux qui prennent moins de 10 minutes et qui sont compétitifs.”

The system automatically interprets the request and retrieves matching games from the database.

---

## 🎯 Main Features

### 🕹️ Manage Your Game Collection

- **Add** new games with simple forms  
  Enter key attributes such as:
  - Name  
  - Number of players  
  - Duration (minutes)
  - Teams setting (cooperative or not)
  - Special support needed
  - Type (general knowledge, mines, reflex)   

- **Edit** existing entries  
  Quickly update information.

- **Delete** entries  
  Remove obsolete or unwanted games from the database.

---

### 🔍 Search in Natural Language

Instead of using filters or dropdowns, users can describe their query naturally in French.

Examples:

| Example Query | Interpreted Meaning |
|----------------|----------------------|
| “Montre-moi les jeux pour 2 joueurs ou plus.” | Games where `min_players >= 2` |
| “Je veux tous les jeux qui durent moins de 15 minutes.” | Games with `duration_minutes <= 15` |
| “Je cherche un jeu coopératif de difficulté moyenne.” | Cooperative games with medium complexity |
| “Jeux de société compétitifs entre amis pour 4 personnes.” | Competitive games for 4 players |

The backend uses a language model to translate these sentences into valid SQL queries and return relevant results.

---

### 📋 User Interface

- Emphasis on simplicity and readability  
- Table view for quick browsing of results  
- Works on both desktop and mobile browsers  
- Intuitive forms for adding or updating entries  

---

### 💡 Example User Scenarios

1. **Curating a party night**  
   > “Je veux des jeux pour 6 personnes qui durent moins de 30 minutes.”  
   The app lists all fast-paced, large-group games in your collection.

2. **Quick edit**  
   You realize “7 Wonders Duel” is actually only 2 players — open its card, hit *Edit*, and fix the data.

3. **Decluttering your shelf**  
   You browse through and delete a few games you no longer own.

---

### 🗃️ Data Model

TODO

---

### 🌐 Access

- The Flask backend now serves **both** the REST API and an HTMX-driven web UI.
- Templates are split across `backend/templates/pages/` and `backend/templates/partials/` so each screen (search, admin table, form…) can evolve independently.

Together, they form a minimal yet expressive tool for exploring and maintaining a personal board game collection.

---

## 🚀 Deployment

### Unified Flask app

- Package the `backend/` directory on any Python-friendly host. The service honours the conventional `PORT` and `FLASK_DEBUG` environment variables and exposes both the API and the HTML interface on `0.0.0.0`.
- Static assets (Pico.css + `style.css`) ship from `backend/static/` while the HTMX snippets live under `backend/templates/`.
- The SQLite database (`games.db`) is stored on disk. If your hosting provider uses ephemeral storage you will need an external volume or to migrate the data to a managed database.

### Local preview

```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
FLASK_APP=backend.app flask run
```

Visit `http://localhost:5000/` to use the HTMX UI, or hit the JSON API under `/games` for programmatic access.

---

© 2025 – Boardgame CRUD Project
