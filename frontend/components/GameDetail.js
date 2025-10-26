export function createGameDetailComponent({ computed, formatDuration, formatPlayers }) {
  return {
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

      return {
        durationLabel,
        playersLabel,
        tags,
        close,
      };
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
}

export default createGameDetailComponent;
