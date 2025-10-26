const DEFAULT_API_BASE_URL = 'http://localhost:5000';

const NUMBER_REGEX = /\d+/g;

export { DEFAULT_API_BASE_URL };

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
  const datasetUrl = documentRef?.body?.dataset?.apiBaseUrl;
  if (datasetUrl) return datasetUrl;
  if (globalObject && typeof globalObject.API_BASE_URL === 'string') {
    return globalObject.API_BASE_URL;
  }
  const origin = globalObject?.location?.origin;
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

function sortGamesByName(games) {
  return [...games].sort((a, b) =>
    a.nom.localeCompare(b.nom, 'fr', { ignorePunctuation: true })
  );
}

function createApiCaller(fetchImpl, baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  return async function callApi(path, { method = 'GET', body } = {}) {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    let payload = null;
    if (response.status !== 204) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        payload = await response.text();
      }
    }

    if (!response.ok) {
      const errorMessage =
        typeof payload === 'string'
          ? payload || `HTTP ${response.status}`
          : payload?.message || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return payload;
  };
}

export async function initApp({
  documentRef = typeof document !== 'undefined' ? document : null,
  fetchImpl = typeof fetch !== 'undefined' ? fetch : null,
  baseUrl,
  vueRuntime = globalThis.Vue ?? null,
} = {}) {
  if (!documentRef) {
    throw new Error('initApp requires a document reference.');
  }
  if (!fetchImpl) {
    throw new Error('initApp requires a fetch implementation.');
  }
  if (!vueRuntime) {
    throw new Error('initApp requires a Vue runtime. Pass vueRuntime or include Vue globally.');
  }

  const { createApp, ref, reactive, computed, onMounted } = vueRuntime;

  const apiBaseUrl = baseUrl ?? resolveApiBaseUrl({ documentRef, globalObject: globalThis });
  const callApi = createApiCaller(fetchImpl, apiBaseUrl);

  const appRoot = documentRef.getElementById('app');
  if (!appRoot) {
    throw new Error('Missing required element: #app');
  }

  const GameCard = {
    name: 'GameCard',
    props: {
      game: { type: Object, required: true },
    },
    emits: ['select'],
    setup(props, { emit }) {
      const durationLabel = computed(() => formatDuration(props.game));
      const playersLabel = computed(() => formatPlayers(props.game));
      const tags = computed(() => props.game.tags || []);
      const handleClick = () => emit('select', props.game);
      return { durationLabel, playersLabel, tags, handleClick };
    },
    template: `
      <article class="game-card card" @click="handleClick">
        <h2 class="game-name">{{ game.nom }}</h2>
        <ul class="game-meta">
          <li v-if="durationLabel">⏱ {{ durationLabel }}</li>
          <li v-if="playersLabel">👥 {{ playersLabel }}</li>
          <li v-if="game.type">🎭 {{ game.type }}</li>
          <li v-if="game.complexite">⚖️ {{ game.complexite }}</li>
        </ul>
        <p v-if="tags.length" class="game-tags">
          <span v-for="tag in tags" :key="tag">#{{ tag }}</span>
        </p>
      </article>
    `,
  };

  const GameDetail = {
    name: 'GameDetail',
    props: {
      game: { type: Object, required: true },
    },
    emits: ['close'],
    setup(props, { emit }) {
      const durationLabel = computed(() => formatDuration(props.game));
      const playersLabel = computed(() => formatPlayers(props.game));
      const tags = computed(() => props.game.tags || []);
      const close = () => emit('close');
      return { durationLabel, playersLabel, tags, close };
    },
    template: `
      <article class="game-detail card">
        <div class="detail-header">
          <button class="ghost-btn detail-back" type="button" @click="close">← Retour aux résultats</button>
        </div>
        <h2 class="game-name">{{ game.nom }}</h2>
        <ul class="game-meta detail-meta">
          <li v-if="durationLabel">⏱ {{ durationLabel }}</li>
          <li v-if="playersLabel">👥 {{ playersLabel }}</li>
          <li v-if="game.type">🎭 {{ game.type }}</li>
          <li v-if="game.complexite">⚖️ {{ game.complexite }}</li>
          <li v-if="game.everyone">✨ Accessible : {{ game.everyone }}</li>
        </ul>
        <section v-if="tags.length" class="detail-tags">
          <h3>Tags</h3>
          <p class="game-tags">
            <span v-for="tag in tags" :key="tag">#{{ tag }}</span>
          </p>
        </section>
        <section class="detail-raw">
          <h3>Informations complémentaires</h3>
          <dl>
            <div v-if="game.playTime">
              <dt>Durée annoncée</dt>
              <dd>{{ game.playTime }}</dd>
            </div>
            <div v-if="game.playerCount">
              <dt>Nombre de joueurs</dt>
              <dd>{{ game.playerCount }}</dd>
            </div>
            <div v-if="game.raw?.special_support">
              <dt>Support particulier</dt>
              <dd>{{ game.raw.special_support }}</dd>
            </div>
          </dl>
        </section>
      </article>
    `,
  };

  let controller = null;

  const RootComponent = {
    name: 'BoardGameApp',
    components: { GameCard, GameDetail },
    setup() {
      const mode = ref('read');
      const searchInput = ref('');
      const searchQuery = ref('');
      const games = ref([]);
      const selectedGame = ref(null);
      const isLoading = ref(false);
      const errorMessage = ref('');
      const saving = ref(false);
      const editingOriginalName = ref(null);
      const formState = reactive({
        nom: '',
        minJoueurs: '',
        maxJoueurs: '',
        dureeMin: '',
        dureeMax: '',
        type: '',
        complexite: '',
        tagsText: '',
      });

      const formTitle = computed(() => (
        editingOriginalName.value ? `Modifier : ${editingOriginalName.value}` : 'Nouveau jeu'
      ));

      const searchResult = computed(() => analyzeQuery(searchQuery.value, games.value));
      const filteredGames = computed(() => searchResult.value.filtered);
      const searchExtracts = computed(() => searchResult.value.extracts);

      const setMode = (value) => {
        mode.value = value;
        if (value === 'read') {
          selectedGame.value = null;
        }
      };

      const performSearch = () => {
        searchQuery.value = searchInput.value.trim();
        selectedGame.value = null;
      };

      const clearForm = () => {
        formState.nom = '';
        formState.minJoueurs = '';
        formState.maxJoueurs = '';
        formState.dureeMin = '';
        formState.dureeMax = '';
        formState.type = '';
        formState.complexite = '';
        formState.tagsText = '';
        editingOriginalName.value = null;
      };

      const fillForm = (game) => {
        formState.nom = game.nom;
        formState.minJoueurs = game.minJoueurs ?? '';
        formState.maxJoueurs = game.maxJoueurs ?? '';
        formState.dureeMin = game.minDuree ?? '';
        formState.dureeMax = game.maxDuree ?? '';
        formState.type = game.type || '';
        formState.complexite = game.complexite || '';
        formState.tagsText = game.tags.join(', ');
        editingOriginalName.value = game.raw?.name ?? game.nom;
      };

      const openDetails = (game) => {
        selectedGame.value = game;
      };

      const closeDetails = () => {
        selectedGame.value = null;
      };

      const refreshGames = async () => {
        isLoading.value = true;
        errorMessage.value = '';
        try {
          const data = await callApi('/games');
          const mapped = data.map((item) => mapApiGame(item));
          games.value = sortGamesByName(mapped);
          if (selectedGame.value) {
            const updated = games.value.find((item) => item.nom === selectedGame.value.nom);
            if (updated) {
              selectedGame.value = updated;
            }
          }
        } catch (error) {
          console.error('Erreur lors du chargement des jeux', error);
          errorMessage.value = `Impossible de charger les jeux : ${error.message}`;
        } finally {
          isLoading.value = false;
        }
      };

      const submitForm = async () => {
        const trimmedName = formState.nom.trim();
        if (!trimmedName) {
          alert('Le nom du jeu est requis.');
          return;
        }

        const payload = buildPayloadFromForm({
          nom: trimmedName,
          minJoueurs: toOptionalNumber(formState.minJoueurs),
          maxJoueurs: toOptionalNumber(formState.maxJoueurs),
          dureeMin: toOptionalNumber(formState.dureeMin),
          dureeMax: toOptionalNumber(formState.dureeMax),
          type: formState.type.trim() || null,
          complexite: formState.complexite.trim() || null,
          tags: parseTags(formState.tagsText),
          everyone: 'oui',
        });

        saving.value = true;
        errorMessage.value = '';
        try {
          if (editingOriginalName.value) {
            const encodedName = encodeURIComponent(editingOriginalName.value);
            await callApi(`/games/${encodedName}`, { method: 'PUT', body: payload });
          } else {
            await callApi('/games', { method: 'POST', body: payload });
          }
          await refreshGames();
          clearForm();
        } catch (error) {
          console.error('Erreur lors de la sauvegarde', error);
          errorMessage.value = `Impossible d\'enregistrer le jeu : ${error.message}`;
        } finally {
          saving.value = false;
        }
      };

      const editGame = (game) => {
        fillForm(game);
        setMode('edit');
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };

      const deleteGame = async (game) => {
        if (!game?.nom) return;
        const confirmation = typeof window === 'undefined' || window.confirm(`Supprimer "${game.nom}" ?`);
        if (!confirmation) return;
        try {
          await callApi(`/games/${encodeURIComponent(game.nom)}`, { method: 'DELETE' });
          await refreshGames();
        } catch (error) {
          console.error('Erreur lors de la suppression', error);
          errorMessage.value = `Impossible de supprimer le jeu : ${error.message}`;
        }
      };

      onMounted(() => {
        refreshGames();
      });

      controller = {
        refreshGames,
        setMode,
        getState: () => ({
          games: [...games.value],
          editingOriginalName: editingOriginalName.value,
        }),
      };

      return {
        mode,
        setMode,
        searchInput,
        performSearch,
        games,
        filteredGames,
        searchExtracts,
        selectedGame,
        openDetails,
        closeDetails,
        isLoading,
        errorMessage,
        formState,
        formTitle,
        clearForm,
        submitForm,
        editGame,
        deleteGame,
        editingOriginalName,
        saving,
        formatDuration,
        formatPlayers,
      };
    },
    template: `
      <div class="app-shell">
        <header class="app-header">
          <div class="app-header-left">
            <div class="app-title">🎲 Bibliothèque de jeux</div>
            <div class="app-subtitle">Recherche & gestion</div>
          </div>
          <nav class="app-nav">
            <button
              class="nav-btn"
              :class="{ 'nav-btn-active': mode === 'read' }"
              type="button"
              @click="setMode('read')"
            >
              Recherche
            </button>
            <button
              class="nav-btn"
              :class="{ 'nav-btn-active': mode === 'edit' }"
              type="button"
              @click="setMode('edit')"
            >
              Édition
            </button>
          </nav>
        </header>

        <main class="app-main">
          <div v-if="errorMessage" class="error-banner card">{{ errorMessage }}</div>

          <section
            id="mode-read"
            class="panel"
            :class="{ visible: mode === 'read', hidden: mode !== 'read' }"
          >
            <div class="search-card card">
              <label for="natural-query" class="field-label">Recherche intelligente</label>
              <div class="search-row">
                <input
                  id="natural-query"
                  type="text"
                  class="text-input"
                  v-model="searchInput"
                  placeholder="ex : jeux compétitifs de moins de 10 minutes pour 4 joueurs"
                  @keyup.enter="performSearch"
                />
                <button class="primary-btn" type="button" @click="performSearch">Chercher</button>
              </div>
              <p class="hint">
                Tu peux poser la question en français. Exemple :
                « Je veux un jeu coopératif rapide pour 2 joueurs ».
              </p>
            </div>

            <div class="query-extract card" :class="{ active: searchExtracts.length }">
              <template v-if="searchExtracts.length">
                <div class="extract-title">Filtre détecté</div>
                <ul class="extract-list">
                  <li v-for="item in searchExtracts" :key="item">{{ item }}</li>
                </ul>
              </template>
              <p v-else class="hint">Tape une requête pour filtrer les jeux.</p>
            </div>

            <div v-if="isLoading" class="card loading-card">Chargement des jeux…</div>
            <div v-else>
              <GameDetail
                v-if="selectedGame"
                :game="selectedGame"
                @close="closeDetails"
              />
              <template v-else>
                <div
                  id="empty-state"
                  class="empty-state"
                  v-if="!filteredGames.length"
                >
                  Aucun jeu trouvé. Essaie une autre recherche 🙂
                </div>
                <div id="results-list" class="results-grid" v-else>
                  <GameCard
                    v-for="game in filteredGames"
                    :key="game.nom"
                    :game="game"
                    @select="openDetails"
                  />
                </div>
              </template>
            </div>
          </section>

          <section
            id="mode-edit"
            class="panel"
            :class="{ visible: mode === 'edit', hidden: mode !== 'edit' }"
          >
            <div class="edit-layout">
              <div class="edit-form card">
                <h2>{{ formTitle }}</h2>
                <form @submit.prevent="submitForm">
                  <div class="form-field">
                    <label for="game-name" class="field-label">Nom du jeu</label>
                    <input id="game-name" type="text" class="text-input" v-model="formState.nom" required />
                  </div>

                  <div class="form-field inline-fields">
                    <div>
                      <label for="min-players" class="field-label">Joueurs (min)</label>
                      <input id="min-players" type="number" class="text-input" v-model="formState.minJoueurs" min="1" />
                    </div>
                    <div>
                      <label for="max-players" class="field-label">Joueurs (max)</label>
                      <input id="max-players" type="number" class="text-input" v-model="formState.maxJoueurs" min="1" />
                    </div>
                  </div>

                  <div class="form-field inline-fields">
                    <div>
                      <label for="duration-min" class="field-label">Durée (min)</label>
                      <input id="duration-min" type="number" class="text-input" v-model="formState.dureeMin" min="1" />
                    </div>
                    <div>
                      <label for="duration-max" class="field-label">Durée (max)</label>
                      <input id="duration-max" type="number" class="text-input" v-model="formState.dureeMax" min="1" />
                    </div>
                  </div>

                  <div class="form-field">
                    <label for="type-jeu" class="field-label">Type de jeu</label>
                    <input id="type-jeu" type="text" class="text-input" v-model="formState.type" placeholder="ex : Coopératif, Culture générale" />
                  </div>

                  <div class="form-field">
                    <label for="complexite" class="field-label">Jeu en équipe ?</label>
                    <input id="complexite" type="text" class="text-input" v-model="formState.complexite" placeholder="ex : Oui, Non, Au choix" />
                  </div>

                  <div class="form-field">
                    <label for="tags" class="field-label">Tags</label>
                    <input
                      id="tags"
                      type="text"
                      class="text-input"
                      v-model="formState.tagsText"
                      placeholder="ex : bluff, party game, coopération"
                    />
                    <p class="hint">Sépare les tags par des virgules.</p>
                  </div>

                  <div class="form-actions">
                    <button class="primary-btn" type="submit" :disabled="saving">
                      {{ saving ? 'Enregistrement…' : editingOriginalName ? 'Mettre à jour' : 'Enregistrer' }}
                    </button>
                    <button class="ghost-btn" type="button" @click="clearForm">Annuler</button>
                  </div>
                </form>
              </div>

              <div class="edit-table card">
                <h2>Jeux enregistrés</h2>
                <table class="game-table" v-if="games.length">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Joueurs</th>
                      <th>Durée</th>
                      <th>Type</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="games-admin-list">
                    <tr v-for="game in games" :key="game.nom">
                      <td>{{ game.nom }}</td>
                      <td>{{ formatPlayers(game) || '—' }}</td>
                      <td>{{ formatDuration(game) || '—' }}</td>
                      <td>{{ game.type || '—' }}</td>
                      <td class="row-actions">
                        <button class="link-btn edit-btn" type="button" @click="editGame(game)">Modifier</button>
                        <button class="link-btn danger-btn" type="button" @click="deleteGame(game)">Supprimer</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div id="empty-admin" class="empty-state" v-else>
                  Aucun jeu pour l’instant.
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer class="app-footer">
          Données privées – usage interne • v0.1
        </footer>
      </div>
    `,
  };

  const app = createApp(RootComponent);

  app.config.globalProperties.formatDuration = formatDuration;
  app.config.globalProperties.formatPlayers = formatPlayers;

  const mountedApp = app.mount(appRoot);

  return controller ?? mountedApp;
}

if (typeof window !== 'undefined') {
  window.boardGameApp = { initApp };
}
