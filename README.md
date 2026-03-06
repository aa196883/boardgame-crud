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
- Lets users pick which SQLite database to query directly from the UI (forwarded as `db` through the API)  
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

- The **frontend** is available as a static web interface (hosted on GitHub Pages).  
- The **backend** provides a simple REST API that handles CRUD operations and interprets natural language queries.

Together, they form a minimal yet expressive tool for exploring and maintaining a personal board game collection.

---

## 🚀 Deployment

### Frontend (static hosting)

- The HTML/CSS/JS bundle in `frontend/` can be deployed on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, ...).
- By default the page points to `https://boardgame-crud-backend.onrender.com` thanks to the `data-api-base-url` attribute set on `<body>` and the fallback logic in `frontend/main.js`.
- When you preview the site locally (e.g. `python -m http.server 8000`) the JavaScript automatically switches back to the local API at `http://localhost:5000`.
- To target another backend without editing the sources you can inject `window.API_BASE_URL = 'https://your-backend.example.com'` before `main.js` is loaded.

### Backend (Flask API)

- Package the `backend/` directory on any Python-friendly host. The service honours the conventional `PORT` and `FLASK_DEBUG` environment variables and exposes the API on `0.0.0.0`.
- The SQLite database (`games.db`) is stored on disk. If your hosting provider uses ephemeral storage you will need an external volume or to migrate the data to a managed database.

### Is a static frontend + free backend enough?

Yes, as long as the backend host offers either persistent storage or a managed database and is reachable over HTTPS. GitHub Pages (or any other static host) can happily serve the UI while a free tier service such as Render, Railway, Fly.io, Deta or Cyclic runs the Flask API. Make sure to:

1. Allow CORS on the API (already enabled through `flask_cors.CORS(app)` in `backend/app.py`).
2. Configure the `data-api-base-url` (or `window.API_BASE_URL`) on the static page so that it points to the deployed backend.
3. Back up the SQLite database or plug the application into a managed database if the free tier server does not keep files between restarts.

---

© 2025 – Boardgame CRUD Project
