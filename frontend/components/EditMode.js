export function createEditModeComponent({ formatDuration, formatPlayers }) {
  return {
    name: 'EditMode',
    props: {
      formState: { type: Object, required: true },
      formTitle: { type: String, required: true },
      saving: { type: Boolean, required: true },
      games: { type: Array, required: true },
      editingOriginalName: { type: [String, null], default: null },
    },
    emits: ['submit', 'clear', 'edit-game', 'delete-game'],
    setup(props, { emit }) {
      const handleSubmit = () => emit('submit');
      const handleClear = () => emit('clear');
      const handleEdit = (game) => emit('edit-game', game);
      const handleDelete = (game) => emit('delete-game', game);

      return {
        formState: props.formState,
        formTitle: props.formTitle,
        saving: props.saving,
        games: props.games,
        editingOriginalName: props.editingOriginalName,
        localFormatDuration: formatDuration,
        localFormatPlayers: formatPlayers,
        handleSubmit,
        handleClear,
        handleEdit,
        handleDelete,
      };
    },
    template: `
      <div class="edit-layout">
        <div class="edit-form card">
          <h2>{{ formTitle }}</h2>
          <form @submit.prevent="handleSubmit">
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
              <button class="ghost-btn" type="button" @click="handleClear">Annuler</button>
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
                <td>{{ localFormatPlayers(game) || '—' }}</td>
                <td>{{ localFormatDuration(game) || '—' }}</td>
                <td>{{ game.type || '—' }}</td>
                <td class="row-actions">
                  <button class="link-btn edit-btn" type="button" @click="handleEdit(game)">Modifier</button>
                  <button class="link-btn danger-btn" type="button" @click="handleDelete(game)">Supprimer</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div id="empty-admin" class="empty-state" v-else>
            Aucun jeu pour l’instant.
          </div>
        </div>
      </div>
    `,
  };
}

export default createEditModeComponent;
