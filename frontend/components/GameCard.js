export function createGameCardComponent({ computed, formatDuration, formatPlayers }) {
  return {
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

      return {
        durationLabel,
        playersLabel,
        tags,
        handleClick,
      };
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
}

export default createGameCardComponent;
