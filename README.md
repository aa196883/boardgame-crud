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

### 🧱 Frontend architecture (Vue)

The web client now relies on the **Vue runtime** that is shipped with the Vue library. This runtime bundle provides the `createApp`, `ref`, `reactive`, `computed`, and lifecycle utilities that power the component tree and its reactivity system. In our case it is loaded from a `<script>` tag in `frontend/index.html`, making the Vue APIs available on `window.Vue` so `initApp` can wire everything together.【F:frontend/index.html†L9-L18】【F:frontend/main.js†L247-L270】

The Vue application is **mounted** on the DOM element with the `id="app"`. Mounting is the process where Vue takes control of that placeholder node, renders the root component into it, and keeps the HTML in sync with the reactive state. You can see this in `frontend/main.js` where we grab the element via `document.getElementById('app')` and pass it to `createApp(...).mount(...)`.【F:frontend/main.js†L271-L314】【F:frontend/main.js†L532-L544】

Inside `initApp`, we declare three core components:

- `RootComponent` orchestrates data fetching, the search form, and CRUD workflows using Vue refs, computed properties, and lifecycle hooks.【F:frontend/main.js†L314-L530】
- `GameCard` displays the compact card view for each search result and emits a `select` event when clicked so the root component can open the detail view.【F:frontend/main.js†L290-L313】
- `GameDetail` renders the expanded information panel when a card is selected and exposes a `close` event to return to the grid.【F:frontend/main.js†L314-L351】

When the user types in the search bar, `RootComponent` updates reactive state, recomputes filtered results through `analyzeQuery`, and renders the matching `GameCard` instances. Clicking a card stores the chosen game in `selectedGame`, which triggers Vue to swap the card grid for the `GameDetail` component. Vue's runtime handles these UI transitions automatically by observing the reactive data and updating the DOM efficiently.【F:frontend/main.js†L350-L530】

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

© 2025 – Boardgame CRUD Project
