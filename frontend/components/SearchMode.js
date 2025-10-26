export function createSearchModeComponent({ computed, GameCard, GameDetail }) {
  return {
    name: 'SearchMode',
    components: { GameCard, GameDetail },
    props: {
      searchInput: { type: String, required: true },
      searchExtracts: { type: Array, required: true },
      filteredGames: { type: Array, required: true },
      selectedGame: { type: Object, default: null },
      isLoading: { type: Boolean, required: true },
    },
    emits: ['update:searchInput', 'perform-search', 'open-details', 'close-details'],
    setup(props, { emit }) {
      const searchValue = computed({
        get: () => props.searchInput,
        set: (value) => emit('update:searchInput', value),
      });

      const performSearch = () => emit('perform-search');
      const openDetails = (game) => emit('open-details', game);
      const closeDetails = () => emit('close-details');

      return {
        searchValue,
        performSearch,
        openDetails,
        closeDetails,
      };
    },
    template: `
      <div>
        <div class="search-card card">
          <label for="natural-query" class="field-label">Recherche intelligente</label>
          <div class="search-row">
            <input
              id="natural-query"
              type="text"
              class="text-input"
              v-model="searchValue"
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
      </div>
    `,
  };
}

export default createSearchModeComponent;
