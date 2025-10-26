// --- DOM helpers ----------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// Panels
const modeReadPanel = $('#mode-read');
const modeEditPanel = $('#mode-edit');

// Nav buttons
const navButtons = $$('.nav-btn');

// Search elements
const searchInput = $('#natural-query');
const searchBtn = $('#search-btn');
const resultsList = $('#results-list');
const emptyState = $('#empty-state');
const queryExtractBox = $('#query-extract');

// Admin elements
const adminTableBody = $('#games-admin-list');
const emptyAdmin = $('#empty-admin');

// Form elements
const formTitle = $('#form-title');
const gameNameInput = $('#game-name');
const minPlayersInput = $('#min-players');
const maxPlayersInput = $('#max-players');
const durationInput = $('#duration');
const typeJeuSelect = $('#type-jeu');
const complexiteSelect = $('#complexite');
const tagsInput = $('#tags');
const saveBtn = $('#save-btn');
const cancelBtn = $('#cancel-btn');

// --- Dummy dataset --------------------------------------------------------

let games = [
  {
    id: 1,
    nom: "The Mind",
    minJoueurs: 2,
    maxJoueurs: 4,
    duree: 10,
    type: "Coopératif",
    complexite: "Facile",
    tags: ["cartes", "silence", "coordination"]
  },
  {
    id: 2,
    nom: "6 qui prend !",
    minJoueurs: 2,
    maxJoueurs: 10,
    duree: 20,
    type: "Compétitif",
    complexite: "Facile",
    tags: ["cartes", "chaos", "famille"]
  },
  {
    id: 3,
    nom: "Blood Rage",
    minJoueurs: 2,
    maxJoueurs: 4,
    duree: 90,
    type: "Compétitif",
    complexite: "Expert",
    tags: ["draft", "contrôle de zone", "vikings"]
  }
];

// --- Mode switching -------------------------------------------------------

function setMode(mode) {
  if (mode === 'read') {
    modeReadPanel.classList.add('visible');
    modeEditPanel.classList.remove('visible');
  } else {
    modeEditPanel.classList.add('visible');
    modeReadPanel.classList.remove('visible');
  }

  navButtons.forEach(btn => {
    if (btn.getAttribute('data-mode') === mode) {
      btn.classList.add('nav-btn-active');
    } else {
      btn.classList.remove('nav-btn-active');
    }
  });
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.getAttribute('data-mode');
    setMode(mode);
  });
});

setMode('read');

// --- Render helpers for READ mode ----------------------------------------

function renderExtractChips(extracts) {
  if (!extracts || extracts.length === 0) {
    queryExtractBox.classList.remove('active');
    queryExtractBox.innerHTML = '';
    return;
  }

  queryExtractBox.classList.add('active');
  queryExtractBox.innerHTML = `
    <div class="extract-title">Filtre détecté</div>
    <ul class="extract-list">
      ${extracts.map(e => `<li>${e}</li>`).join('')}
    </ul>
  `;
}

function renderResults(list) {
  resultsList.innerHTML = '';

  if (!list || list.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  list.forEach(game => {
    const card = document.createElement('article');
    card.className = 'game-card card';
    card.innerHTML = `
      <h2 class="game-name">${game.nom}</h2>
      <ul class="game-meta">
        <li>⏱ ${game.duree} min</li>
        <li>👥 ${game.minJoueurs} à ${game.maxJoueurs} joueurs</li>
        <li>🎭 ${game.type}</li>
        <li>⚖️ Complexité : ${game.complexite}</li>
      </ul>
      <p class="game-tags">${game.tags.map(t => `#${t}`).join(' ')}</p>
    `;
    resultsList.appendChild(card);
  });
}

// --- Fake NLP parser (temporary) -----------------------------------------

function mockParseNaturalQuery(text) {
  text = text.toLowerCase();

  const extracts = [];
  let filtered = [...games];

  if (text.includes('compétit')) {
    filtered = filtered.filter(g => g.type === 'Compétitif');
    extracts.push('Compétitif');
  }
  if (text.includes('coop')) {
    filtered = filtered.filter(g => g.type === 'Coopératif');
    extracts.push('Coopératif');
  }

  const timeMatch = text.match(/(\d+)\s*(min|minutes)/);
  if (timeMatch && text.includes('moins')) {
    const maxTime = parseInt(timeMatch[1]);
    filtered = filtered.filter(g => g.duree <= maxTime);
    extracts.push(`≤ ${maxTime} min`);
  }

  const playersMatch = text.match(/(\d+)\s*jou/);
  if (playersMatch) {
    const nb = parseInt(playersMatch[1]);
    filtered = filtered.filter(g => nb >= g.minJoueurs && nb <= g.maxJoueurs);
    extracts.push(`${nb} joueurs`);
  }

  return { extracts, filtered };
}

// --- Search interaction --------------------------------------------------

searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (!query) return;

  const { extracts, filtered } = mockParseNaturalQuery(query);
  renderExtractChips(extracts);
  renderResults(filtered);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchBtn.click();
  }
});

// --- Admin / Edit mode rendering ----------------------------------------

function renderAdminTable() {
  adminTableBody.innerHTML = '';

  if (games.length === 0) {
    emptyAdmin.classList.remove('hidden');
    return;
  }
  emptyAdmin.classList.add('hidden');

  games.forEach(game => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${game.nom}</td>
      <td>${game.minJoueurs}-${game.maxJoueurs}</td>
      <td>${game.duree} min</td>
      <td>${game.type}</td>
      <td class="row-actions">
        <button class="link-btn edit-btn" data-id="${game.id}">Modifier</button>
        <button class="link-btn danger-btn" data-id="${game.id}">Supprimer</button>
      </td>
    `;
    adminTableBody.appendChild(tr);
  });
}

renderAdminTable();

// --- CRUD placeholders ---------------------------------------------------

let editingId = null;

saveBtn.addEventListener('click', (e) => {
  e.preventDefault();

  const newGame = {
    id: editingId || Date.now(),
    nom: gameNameInput.value.trim(),
    minJoueurs: parseInt(minPlayersInput.value),
    maxJoueurs: parseInt(maxPlayersInput.value),
    duree: parseInt(durationInput.value),
    type: typeJeuSelect.value === 'coopératif' ? 'Coopératif' : 'Compétitif',
    complexite: complexiteSelect.value,
    tags: tagsInput.value.split(',').map(t => t.trim()).filter(t => t)
  };

  if (!newGame.nom) return;

  if (editingId) {
    // update
    games = games.map(g => (g.id === editingId ? newGame : g));
    editingId = null;
  } else {
    // create
    games.push(newGame);
  }

  clearForm();
  renderAdminTable();
});

cancelBtn.addEventListener('click', () => {
  clearForm();
});

function clearForm() {
  formTitle.textContent = 'Nouveau jeu';
  gameNameInput.value = '';
  minPlayersInput.value = '';
  maxPlayersInput.value = '';
  durationInput.value = '';
  typeJeuSelect.value = 'competitif';
  complexiteSelect.value = 'facile';
  tagsInput.value = '';
  editingId = null;
}

// --- Event delegation for edit/delete -----------------------------------

adminTableBody.addEventListener('click', (e) => {
  if (e.target.classList.contains('edit-btn')) {
    const id = Number(e.target.dataset.id);
    const game = games.find(g => g.id === id);
    if (!game) return;

    editingId = id;
    formTitle.textContent = `Modifier : ${game.nom}`;
    gameNameInput.value = game.nom;
    minPlayersInput.value = game.minJoueurs;
    maxPlayersInput.value = game.maxJoueurs;
    durationInput.value = game.duree;
    typeJeuSelect.value = game.type.toLowerCase().includes('coop') ? 'coopératif' : 'competitif';
    complexiteSelect.value = game.complexite.toLowerCase();
    tagsInput.value = game.tags.join(', ');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (e.target.classList.contains('danger-btn')) {
    const id = Number(e.target.dataset.id);
    const game = games.find(g => g.id === id);
    if (!game) return;

    const confirmDel = confirm(`Supprimer "${game.nom}" ?`);
    if (confirmDel) {
      games = games.filter(g => g.id !== id);
      renderAdminTable();
    }
  }
});
