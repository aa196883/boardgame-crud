const LOCAL_API_BASE_URL = 'http://localhost:5000';
const DEFAULT_API_BASE_URL = 'https://boardgame-crud-backend.onrender.com';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const DB_TABLE_NAME = 'jeux';

const NUMBER_REGEX = /\d+/g;

export { DEFAULT_API_BASE_URL, LOCAL_API_BASE_URL };

export function parseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseNumericRange(text) {
  if (!text) return null;
  const matches = String(text).match(NUMBER_REGEX);
  if (!matches) return null;
  const numbers = matches.map((entry) => Number(entry)).filter(Number.isFinite);
  if (numbers.length === 0) return null;
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return { min, max };
}

export function formatPlayersRange(min, max) {
  if (typeof min === 'number' && typeof max === 'number') {
    if (min === max) return `${min}`;
    return `${min} à ${max}`;
  }
  if (typeof min === 'number') {
    return `${min}+`;
  }
  if (typeof max === 'number') {
    return `≤ ${max}`;
  }
  return null;
}

export function derivePlayTimeString(min, max) {
  if (typeof min === 'number' && typeof max === 'number') {
    if (min === max) return `${min} min`;
    return `${min} - ${max} min`;
  }
  if (typeof min === 'number') return `${min} min`;
  if (typeof max === 'number') return `${max} min`;
  return null;
}

export function mapApiGame(apiGame) {
  const durationRange = parseNumericRange(apiGame?.play_time);
  const playerRange = parseNumericRange(apiGame?.player_count);

  const minDuration =
    toOptionalNumber(apiGame?.min_duration_minutes) ?? durationRange?.min ?? null;
  const maxDuration =
    toOptionalNumber(apiGame?.max_duration_minutes) ?? durationRange?.max ?? null;

  const minPlayers = toOptionalNumber(apiGame?.min_players) ?? playerRange?.min ?? null;
  const maxPlayers = toOptionalNumber(apiGame?.max_players) ?? playerRange?.max ?? null;

  return {
    id: apiGame?.name ?? '',
    nom: apiGame?.name ?? '',
    minJoueurs: minPlayers,
    maxJoueurs: maxPlayers,
    minDuree: minDuration,
    maxDuree: maxDuration,
    playTime: apiGame?.play_time ?? null,
    playerCount: apiGame?.player_count ?? null,
    type: apiGame?.game_type ?? '',
    complexite: apiGame?.team_play ?? '',
    tags: parseTags(apiGame?.special_support),
    everyone: apiGame?.everyone_can_play ?? '',
    raw: apiGame ?? {},
  };
}

export function formatDuration(game) {
  if (!game) return '';
  const { minDuree, maxDuree, playTime } = game;
  if (typeof minDuree === 'number' && typeof maxDuree === 'number') {
    if (minDuree === maxDuree) return `${minDuree} min`;
    return `${minDuree} - ${maxDuree} min`;
  }
  if (typeof minDuree === 'number') return `${minDuree} min`;
  if (typeof maxDuree === 'number') return `${maxDuree} min`;
  return playTime ?? '';
}

export function formatPlayers(game) {
  if (!game) return '';
  const { minJoueurs, maxJoueurs, playerCount } = game;
  if (typeof minJoueurs === 'number' && typeof maxJoueurs === 'number') {
    if (minJoueurs === maxJoueurs) return `${minJoueurs}`;
    return `${minJoueurs} - ${maxJoueurs}`;
  }
  if (typeof minJoueurs === 'number') return `${minJoueurs}+`;
  if (typeof maxJoueurs === 'number') return `≤ ${maxJoueurs}`;
  return playerCount ?? '';
}

export function analyzeQuery(query, games) {
  const normalized = query.trim().toLowerCase();
  const extracts = [];
  const pushExtract = (value) => {
    if (!value) return;
    if (!extracts.includes(value)) {
      extracts.push(value);
    }
  };

  if (!normalized) {
    return { extracts, filtered: games };
  }

  let filtered = games;

  if (normalized.includes('compétit')) {
    filtered = filtered.filter((game) =>
      game.type?.toLowerCase().includes('comp')
    );
    pushExtract('Compétitif');
  }

  if (normalized.includes('coop')) {
    filtered = filtered.filter((game) =>
      game.type?.toLowerCase().includes('coop')
    );
    pushExtract('Coopératif');
  }

  const timeMatch = normalized.match(/(\d+)\s*(min|minutes)/);
  if (timeMatch && normalized.includes('moins')) {
    const maxTime = Number(timeMatch[1]);
    filtered = filtered.filter((game) => {
      const duration = typeof game.minDuree === 'number' ? game.minDuree : game.maxDuree;
      if (typeof duration === 'number') {
        return duration <= maxTime;
      }
      const range = parseNumericRange(game.playTime);
      if (!range) return false;
      return (range.min ?? range.max ?? Infinity) <= maxTime;
    });
    pushExtract(`≤ ${maxTime} min`);
  }

  const playersMatch = normalized.match(/(\d+)\s*jou/);
  if (playersMatch) {
    const targetPlayers = Number(playersMatch[1]);
    filtered = filtered.filter((game) => {
      const { minJoueurs, maxJoueurs, playerCount } = game;
      if (typeof minJoueurs === 'number' && typeof maxJoueurs === 'number') {
        return targetPlayers >= minJoueurs && targetPlayers <= maxJoueurs;
      }
      if (typeof minJoueurs === 'number') {
        return targetPlayers >= minJoueurs;
      }
      if (typeof maxJoueurs === 'number') {
        return targetPlayers <= maxJoueurs;
      }
      const range = parseNumericRange(playerCount);
      if (!range) return false;
      const min = range.min ?? targetPlayers;
      const max = range.max ?? targetPlayers;
      return targetPlayers >= min && targetPlayers <= max;
    });
    pushExtract(`${targetPlayers} joueurs`);
  }

  return { extracts, filtered };
}

export function resolveApiBaseUrl({ documentRef, globalObject = globalThis } = {}) {
  console.log('Resolving API base URL');
  const location = globalObject?.location;
  const hostname = location?.hostname;
  console.log('Hostname:', hostname);
  if (hostname && LOCAL_HOSTNAMES.has(hostname)) {
    return LOCAL_API_BASE_URL;
  }

  const datasetUrl = documentRef?.body?.dataset?.apiBaseUrl;
  if (datasetUrl) return datasetUrl;

  if (globalObject && typeof globalObject.API_BASE_URL === 'string') {
    return globalObject.API_BASE_URL;
  }

  const origin = location?.origin;
  if (origin && origin !== 'null') {
    return origin;
  }

  return DEFAULT_API_BASE_URL;
}

export function buildPayloadFromForm(data) {
  return {
    name: data.nom,
    min_players: data.minJoueurs,
    max_players: data.maxJoueurs,
    min_duration_minutes: data.dureeMin,
    max_duration_minutes: data.dureeMax,
    play_time: derivePlayTimeString(data.dureeMin, data.dureeMax),
    player_count: formatPlayersRange(data.minJoueurs, data.maxJoueurs),
    game_type: data.type || null,
    team_play: data.complexite || null,
    special_support: data.tags.length ? data.tags.join(', ') : null,
    everyone_can_play: data.everyone || 'oui',
  };
}

function getRequiredElement(documentRef, selector) {
  const element = documentRef.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function renderExtractChips(container, extracts) {
  if (!extracts || extracts.length === 0) {
    container.classList.remove('active');
    container.innerHTML = '';
    return;
  }

  container.classList.add('active');
  container.innerHTML = `
    <div class="extract-title">Filtre détecté</div>
    <ul class="extract-list">
      ${extracts.map((item) => `<li>${item}</li>`).join('')}
    </ul>
  `;
}

function renderResults(resultsBody, emptyState, games) {
  const table = resultsBody.closest('table');
  resultsBody.innerHTML = '';

  if (!games || games.length === 0) {
    emptyState.classList.remove('hidden');
    if (table) {
      table.classList.add('is-empty');
    }
    return;
  }

  emptyState.classList.add('hidden');
  if (table) {
    table.classList.remove('is-empty');
  }

  const doc = resultsBody.ownerDocument || document;

  games.forEach((game) => {
    const row = doc.createElement('tr');

    const nameCell = doc.createElement('td');
    nameCell.textContent = game.nom;

    const playersCell = doc.createElement('td');
    playersCell.textContent = formatPlayers(game) || '—';

    const durationCell = doc.createElement('td');
    durationCell.textContent = formatDuration(game) || '—';

    const typeCell = doc.createElement('td');
    typeCell.textContent = game.type || '—';

    const complexiteCell = doc.createElement('td');
    complexiteCell.textContent = game.complexite || '—';

    const tagsCell = doc.createElement('td');
    tagsCell.textContent =
      game.tags.length > 0 ? game.tags.map((tag) => `#${tag}`).join(' ') : '—';

    row.appendChild(nameCell);
    row.appendChild(playersCell);
    row.appendChild(durationCell);
    row.appendChild(typeCell);
    row.appendChild(complexiteCell);
    row.appendChild(tagsCell);

    resultsBody.appendChild(row);
  });
}

function renderAdminTable(documentRef, tableBody, emptyAdmin, games) {
  tableBody.innerHTML = '';

  if (!games || games.length === 0) {
    emptyAdmin.classList.remove('hidden');
    return;
  }

  emptyAdmin.classList.add('hidden');

  games.forEach((game) => {
    const row = documentRef.createElement('tr');
    const players = formatPlayers(game) || '—';
    const duration = formatDuration(game) || '—';
    const type = game.type || '—';

    row.innerHTML = `
      <td>${game.nom}</td>
      <td>${players}</td>
      <td>${duration}</td>
      <td>${type}</td>
      <td class="row-actions">
        <button class="link-btn edit-btn" data-name="${game.nom}">Modifier</button>
        <button class="link-btn danger-btn" data-name="${game.nom}">Supprimer</button>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function buildSearchSql(sortKey, direction = 'asc') {
  const dir = direction === 'desc' ? 'DESC' : 'ASC';
  switch (sortKey) {
    case 'players':
      return `SELECT * FROM ${DB_TABLE_NAME} ORDER BY ` +
        `COALESCE(joueurs_min, joueurs_max) ${dir}, ` +
        `COALESCE(joueurs_max, joueurs_min) ${dir}, ` +
        `nom_du_jeu COLLATE NOCASE ASC`;
    case 'duration':
      return `SELECT * FROM ${DB_TABLE_NAME} ORDER BY ` +
        `COALESCE(duree_min_minutes, duree_max_minutes) ${dir}, ` +
        `COALESCE(duree_max_minutes, duree_min_minutes) ${dir}, ` +
        `nom_du_jeu COLLATE NOCASE ASC`;
    case 'type':
      return `SELECT * FROM ${DB_TABLE_NAME} ORDER BY ` +
        `type_de_jeu COLLATE NOCASE ${dir}, ` +
        `nom_du_jeu COLLATE NOCASE ASC`;
    case 'complexite':
      return `SELECT * FROM ${DB_TABLE_NAME} ORDER BY ` +
        `en_equipe COLLATE NOCASE ${dir}, ` +
        `nom_du_jeu COLLATE NOCASE ASC`;
    case 'name':
    default:
      return `SELECT * FROM ${DB_TABLE_NAME} ORDER BY ` +
        `nom_du_jeu COLLATE NOCASE ${dir}`;
  }
}

function createApiCaller(fetchImpl, baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  // console.log('API Base URL:', normalizedBaseUrl);
  return async function callApi(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkError) {
      const error = new Error('Network request failed');
      error.code = 'NETWORK_ERROR';
      error.cause = networkError;
      throw error;
    }

    let responsePayload = null;
    if (response.status !== 204) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responsePayload = await response.json();
      } else {
        responsePayload = await response.text();
      }
    }

    if (!response.ok) {
      const errorMessage =
        typeof responsePayload === 'string'
          ? responsePayload || `HTTP ${response.status}`
          : responsePayload?.message || `HTTP ${response.status}`;
      const error = new Error(errorMessage);
      error.code = 'HTTP_ERROR';
      error.status = response.status;
      error.details = responsePayload;
      throw error;
    }

    return responsePayload;
  };
}

function collectFormData({
  gameNameInput,
  minPlayersInput,
  maxPlayersInput,
  durationMinInput,
  durationMaxInput,
  typeJeuInput,
  complexiteInput,
  tagsInput,
}) {
  return {
    nom: gameNameInput.value.trim(),
    minJoueurs: toOptionalNumber(minPlayersInput.value),
    maxJoueurs: toOptionalNumber(maxPlayersInput.value),
    dureeMin: toOptionalNumber(durationMinInput.value),
    dureeMax: toOptionalNumber(durationMaxInput.value),
    type: typeJeuInput.value.trim() || null,
    complexite: complexiteInput.value.trim() || null,
    tags: parseTags(tagsInput.value),
    everyone: 'oui',
  };
}

export function initApp({
  documentRef = typeof document !== 'undefined' ? document : null,
  fetchImpl = typeof fetch !== 'undefined' ? fetch : null,
  baseUrl,
} = {}) {
  if (!documentRef) {
    throw new Error('initApp requires a document reference.');
  }
  if (!fetchImpl) {
    throw new Error('initApp requires a fetch implementation.');
  }
  const apiBaseUrl = baseUrl ?? resolveApiBaseUrl({ documentRef, globalObject: globalThis });
  console.log('Using API Base URL:', apiBaseUrl);
  const callApi = createApiCaller(fetchImpl, apiBaseUrl);

  const modeReadPanel = getRequiredElement(documentRef, '#mode-read');
  const modeEditPanel = getRequiredElement(documentRef, '#mode-edit');
  const navButtons = Array.from(documentRef.querySelectorAll('.nav-btn'));

  const searchInput = getRequiredElement(documentRef, '#natural-query');
  const searchBtn = getRequiredElement(documentRef, '#search-btn');
  const resultsList = getRequiredElement(documentRef, '#results-list');
  const emptyState = getRequiredElement(documentRef, '#empty-state');
  const queryExtractBox = getRequiredElement(documentRef, '#query-extract');
  const searchLoadingIndicator = getRequiredElement(documentRef, '#search-loading');
  const searchFeedbackBox = getRequiredElement(documentRef, '#search-feedback');
  const sortHeaders = Array.from(
    documentRef.querySelectorAll('.search-table th[data-sort-key]')
  );

  const adminTableBody = getRequiredElement(documentRef, '#games-admin-list');
  const emptyAdmin = getRequiredElement(documentRef, '#empty-admin');

  const formTitle = getRequiredElement(documentRef, '#form-title');
  const gameNameInput = getRequiredElement(documentRef, '#game-name');
  const minPlayersInput = getRequiredElement(documentRef, '#min-players');
  const maxPlayersInput = getRequiredElement(documentRef, '#max-players');
  const durationMinInput = getRequiredElement(documentRef, '#duration-min');
  const durationMaxInput = getRequiredElement(documentRef, '#duration-max');
  const typeJeuInput = getRequiredElement(documentRef, '#type-jeu');
  const complexiteInput = getRequiredElement(documentRef, '#complexite');
  const tagsInput = getRequiredElement(documentRef, '#tags');
  const saveBtn = getRequiredElement(documentRef, '#save-btn');
  const cancelBtn = getRequiredElement(documentRef, '#cancel-btn');

  const SEARCH_LOADING_MIN_DURATION_MS = 3000;

  const state = {
    games: [],
    editingOriginalName: null,
    searchSort: {
      key: 'name',
      direction: 'asc',
      sql: buildSearchSql('name', 'asc'),
    },
    lastSearch: {
      query: '',
      results: [],
    },
  };

  let currentFeedbackType = null;
  const FEEDBACK_TONE_CLASSES = ['search-feedback-info', 'search-feedback-error'];

  function setSearchLoading(isLoading) {
    if (isLoading) {
      searchLoadingIndicator.classList.remove('hidden');
    } else {
      searchLoadingIndicator.classList.add('hidden');
    }
  }

  function clearResultsForLoading() {
    resultsList.innerHTML = '';
    const table = resultsList.closest('table');
    if (table) {
      table.classList.remove('is-empty');
      table.classList.add('is-loading');
    }
    emptyState.classList.add('hidden');
  }

  function startSearchLoadingVisual() {
    clearResultsForLoading();
    setSearchLoading(true);
    searchBtn.disabled = true;
    searchBtn.classList.add('is-loading');

    let finished = false;
    const minimumDelay = new Promise((resolve) => {
      setTimeout(resolve, SEARCH_LOADING_MIN_DURATION_MS);
    });

    return {
      async finish() {
        if (finished) {
          await minimumDelay;
          return;
        }
        finished = true;
        await minimumDelay;
        searchBtn.disabled = false;
        searchBtn.classList.remove('is-loading');
        setSearchLoading(false);
        const table = resultsList.closest('table');
        if (table) {
          table.classList.remove('is-loading');
        }
      },
    };
  }

  function clearSearchFeedback({ matchTypes } = {}) {
    if (Array.isArray(matchTypes) && matchTypes.length > 0) {
      if (!matchTypes.includes(currentFeedbackType)) {
        return;
      }
    }

    currentFeedbackType = null;
    searchFeedbackBox.textContent = '';
    searchFeedbackBox.classList.add('hidden');
    FEEDBACK_TONE_CLASSES.forEach((cls) => searchFeedbackBox.classList.remove(cls));
  }

  function showSearchFeedback(message, { tone = 'info', type = null } = {}) {
    currentFeedbackType = type;
    searchFeedbackBox.textContent = message;
    searchFeedbackBox.classList.remove('hidden');
    FEEDBACK_TONE_CLASSES.forEach((cls) => searchFeedbackBox.classList.remove(cls));
    const toneClass = tone === 'error' ? 'search-feedback-error' : 'search-feedback-info';
    searchFeedbackBox.classList.add(toneClass);
  }

  function setMode(mode) {
    if (mode === 'read') {
      modeReadPanel.classList.add('visible');
      modeReadPanel.classList.remove('hidden');
      modeEditPanel.classList.remove('visible');
      modeEditPanel.classList.add('hidden');
    } else {
      modeEditPanel.classList.add('visible');
      modeEditPanel.classList.remove('hidden');
      modeReadPanel.classList.remove('visible');
      modeReadPanel.classList.add('hidden');
    }

    navButtons.forEach((btn) => {
      if (btn.getAttribute('data-mode') === mode) {
        btn.classList.add('nav-btn-active');
      } else {
        btn.classList.remove('nav-btn-active');
      }
    });
  }

  function clearForm() {
    formTitle.textContent = 'Nouveau jeu';
    gameNameInput.value = '';
    minPlayersInput.value = '';
    maxPlayersInput.value = '';
    durationMinInput.value = '';
    durationMaxInput.value = '';
    typeJeuInput.value = '';
    complexiteInput.value = '';
    tagsInput.value = '';
    state.editingOriginalName = null;
  }

  function fillForm(game) {
    formTitle.textContent = `Modifier : ${game.nom}`;
    gameNameInput.value = game.nom;
    minPlayersInput.value = game.minJoueurs ?? '';
    maxPlayersInput.value = game.maxJoueurs ?? '';
    durationMinInput.value = game.minDuree ?? '';
    durationMaxInput.value = game.maxDuree ?? '';
    typeJeuInput.value = game.type || '';
    complexiteInput.value = game.complexite || '';
    tagsInput.value = game.tags.join(', ');
    state.editingOriginalName = game.raw?.name ?? game.nom;
  }

  function updateReadMode(query, { results } = {}) {
    const analysis = analyzeQuery(query, state.games);
    renderExtractChips(queryExtractBox, analysis.extracts);

    if (Array.isArray(results)) {
      renderResults(resultsList, emptyState, results);
      return;
    }

    if (!query) {
      renderResults(resultsList, emptyState, state.games);
      return;
    }

    renderResults(resultsList, emptyState, analysis.filtered);
  }

  function updateSortIndicators() {
    sortHeaders.forEach((header) => {
      const key = header?.dataset?.sortKey;
      if (!key) return;
      if (state.searchSort.key === key) {
        header.classList.add('is-sorted');
        header.setAttribute('data-active-sort', state.searchSort.direction);
        header.setAttribute(
          'aria-sort',
          state.searchSort.direction === 'asc' ? 'ascending' : 'descending'
        );
      } else {
        header.classList.remove('is-sorted');
        header.removeAttribute('data-active-sort');
        header.removeAttribute('aria-sort');
      }
    });
  }

  function applySort(sortKey) {
    if (!sortKey) return;
    let direction = 'asc';
    if (state.searchSort.key === sortKey) {
      direction = state.searchSort.direction === 'asc' ? 'desc' : 'asc';
    }

    state.searchSort = {
      key: sortKey,
      direction,
      sql: buildSearchSql(sortKey, direction),
    };

    updateSortIndicators();
    refreshGames();
  }

  async function refreshGames() {
    try {
      const sql = state.searchSort?.sql ?? buildSearchSql('name', 'asc');
      const endpoint = sql ? `/games?sql=${encodeURIComponent(sql)}` : '/games';
      const data = await callApi(endpoint);
      const mapped = data.map((item) => mapApiGame(item));
      state.games = mapped;
      clearSearchFeedback({ matchTypes: ['database-error', 'general-error'] });
      renderAdminTable(documentRef, adminTableBody, emptyAdmin, state.games);
      updateSortIndicators();
      if (state.lastSearch.query) {
        await performNaturalSearch(state.lastSearch.query, { silent: true });
      } else {
        updateReadMode('', { results: state.games });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des jeux', error);
      if (error?.code === 'NETWORK_ERROR') {
        showSearchFeedback("La base de données n'a pas été trouvée ☹️", {
          tone: 'error',
          type: 'database-error',
        });
      } else {
        showSearchFeedback(`Impossible de charger les jeux : ${error.message}`, {
          tone: 'error',
          type: 'general-error',
        });
      }
    }
  }

  async function performNaturalSearch(rawQuery, { silent = false } = {}) {
    const query = rawQuery.trim();
    if (!query) {
      state.lastSearch = { query: '', results: [] };
      updateReadMode('', { results: state.games });
      if (!silent) {
        clearSearchFeedback({ matchTypes: ['query-error'] });
      }
      return;
    }

    let loadingControl = null;
    if (!silent) {
      clearSearchFeedback({ matchTypes: ['query-error', 'database-error', 'general-error'] });
      loadingControl = startSearchLoadingVisual();
    }

    let mappedResults = null;
    let searchError = null;
    try {
      const endpoint = `/games?question=${encodeURIComponent(query)}`;
      const data = await callApi(endpoint);
      mappedResults = data.map((item) => mapApiGame(item));
    } catch (error) {
      console.error('Erreur lors de la recherche', error);
      searchError = error;
    }

    if (!silent && loadingControl) {
      await loadingControl.finish();
    }

    if (!searchError) {
      state.lastSearch = { query, results: mappedResults };
      if (!silent) {
        clearSearchFeedback({ matchTypes: ['query-error', 'general-error', 'database-error'] });
      }
      updateReadMode(query, { results: mappedResults });
      return;
    }

    if (!silent) {
      if (searchError?.code === 'NETWORK_ERROR') {
        showSearchFeedback("La base de données n'a pas été trouvée ☹️", {
          tone: 'error',
          type: 'database-error',
        });
      } else if (searchError?.status === 400 || searchError?.status === 502) {
        showSearchFeedback('Essaye une autre question ☹️', {
          tone: 'info',
          type: 'query-error',
        });
      } else {
        showSearchFeedback(`Impossible d'exécuter la recherche : ${searchError.message}`, {
          tone: 'error',
          type: 'general-error',
        });
      }
    }

    if (
      state.lastSearch.results.length > 0 &&
      state.lastSearch.query &&
      state.lastSearch.query === query
    ) {
      updateReadMode(state.lastSearch.query, { results: state.lastSearch.results });
    } else {
      updateReadMode('', { results: state.games });
    }
  }

  async function handleSearch(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    await performNaturalSearch(searchInput.value);
  }

  async function handleSave(event) {
    event.preventDefault();
    const formData = collectFormData({
      gameNameInput,
      minPlayersInput,
      maxPlayersInput,
      durationMinInput,
      durationMaxInput,
      typeJeuInput,
      complexiteInput,
      tagsInput,
    });

    if (!formData.nom) {
      alert('Le nom du jeu est requis.');
      return;
    }

    const payload = buildPayloadFromForm(formData);

    try {
      if (state.editingOriginalName) {
        const encodedName = encodeURIComponent(state.editingOriginalName);
        await callApi(`/games/${encodedName}`, { method: 'PUT', body: payload });
      } else {
        await callApi('/games', { method: 'POST', body: payload });
      }
      await refreshGames();
      clearForm();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde', error);
      alert(`Impossible d'enregistrer le jeu : ${error.message}`);
    }
  }

  async function handleDelete(name) {
    if (!name) return;
    const confirmation = confirm(`Supprimer "${name}" ?`);
    if (!confirmation) return;
    try {
      await callApi(`/games/${encodeURIComponent(name)}`, { method: 'DELETE' });
      await refreshGames();
    } catch (error) {
      console.error('Erreur lors de la suppression', error);
      alert(`Impossible de supprimer le jeu : ${error.message}`);
    }
  }

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      setMode(mode === 'edit' ? 'edit' : 'read');
    });
  });

  sortHeaders.forEach((header) => {
    header.addEventListener('click', () => {
      const sortKey = header?.dataset?.sortKey;
      applySort(sortKey);
    });
  });

  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch(event);
    }
  });

  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', (event) => {
    event.preventDefault();
    clearForm();
  });

  adminTableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.classList.contains('edit-btn')) {
      const name = target.dataset.name;
      const game = state.games.find((item) => item.nom === name);
      if (!game) return;
      fillForm(game);
      setMode('edit');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (target.classList.contains('danger-btn')) {
      const name = target.dataset.name;
      if (!name) return;
      handleDelete(name);
    }
  });

  setMode('read');
  updateSortIndicators();
  refreshGames();

  return {
    refreshGames,
    setMode,
    performSearch: performNaturalSearch,
    getState: () => ({ ...state }),
  };
}

if (typeof window !== 'undefined') {
  window.boardGameApp = { initApp };
}
