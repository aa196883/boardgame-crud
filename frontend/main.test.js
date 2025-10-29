import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeQuery,
  buildPayloadFromForm,
  derivePlayTimeString,
  DEFAULT_API_BASE_URL,
  formatDuration,
  formatPlayers,
  formatPlayersRange,
  LOCAL_API_BASE_URL,
  mapApiGame,
  parseNumericRange,
  parseTags,
  resolveApiBaseUrl,
  toOptionalNumber,
} from './main.js';

test('parseTags trims and filters empty entries', () => {
  assert.deepEqual(parseTags('Cartes,  Dés , , Crayons'), ['Cartes', 'Dés', 'Crayons']);
  assert.deepEqual(parseTags(['  A  ', '', 'B']), ['A', 'B']);
  assert.deepEqual(parseTags(null), []);
});

test('parseNumericRange extracts numbers from free text', () => {
  assert.deepEqual(parseNumericRange('2 à 4 joueurs'), { min: 2, max: 4 });
  assert.deepEqual(parseNumericRange('45 min'), { min: 45, max: 45 });
  assert.equal(parseNumericRange('aucun'), null);
});

test('mapApiGame normalizes values and derives ranges', () => {
  const mapped = mapApiGame({
    name: 'Test',
    min_duration_minutes: null,
    max_duration_minutes: null,
    play_time: '10 - 20 min',
    min_players: null,
    max_players: null,
    player_count: '2 à 4',
    game_type: 'Coopératif',
    team_play: 'Oui',
    special_support: 'Cartes, Dés',
    everyone_can_play: 'oui',
  });

  assert.equal(mapped.nom, 'Test');
  assert.equal(mapped.minDuree, 10);
  assert.equal(mapped.maxDuree, 20);
  assert.equal(mapped.minJoueurs, 2);
  assert.equal(mapped.maxJoueurs, 4);
  assert.deepEqual(mapped.tags, ['Cartes', 'Dés']);
});

test('formatters return readable labels', () => {
  const game = {
    nom: 'Demo',
    minDuree: 15,
    maxDuree: 30,
    minJoueurs: 2,
    maxJoueurs: 5,
    playTime: null,
    playerCount: null,
    type: 'Compétitif',
    complexite: 'Moyen',
    tags: [],
  };

  assert.equal(formatDuration(game), '15 - 30 min');
  assert.equal(formatPlayers(game), '2 - 5');
  assert.equal(formatPlayersRange(game.minJoueurs, game.maxJoueurs), '2 à 5');
});

test('derivePlayTimeString builds label from numbers', () => {
  assert.equal(derivePlayTimeString(10, 10), '10 min');
  assert.equal(derivePlayTimeString(10, 20), '10 - 20 min');
  assert.equal(derivePlayTimeString(10, null), '10 min');
  assert.equal(derivePlayTimeString(null, null), null);
});

test('buildPayloadFromForm prepares backend payload', () => {
  const payload = buildPayloadFromForm({
    nom: 'Test',
    minJoueurs: 2,
    maxJoueurs: 4,
    dureeMin: 10,
    dureeMax: 20,
    type: 'Coopératif',
    complexite: 'Oui',
    tags: ['Cartes', 'Dés'],
    everyone: 'oui',
  });

  assert.equal(payload.name, 'Test');
  assert.equal(payload.min_players, 2);
  assert.equal(payload.max_players, 4);
  assert.equal(payload.min_duration_minutes, 10);
  assert.equal(payload.max_duration_minutes, 20);
  assert.equal(payload.play_time, '10 - 20 min');
  assert.equal(payload.player_count, '2 à 4');
  assert.equal(payload.game_type, 'Coopératif');
  assert.equal(payload.team_play, 'Oui');
  assert.equal(payload.special_support, 'Cartes, Dés');
  assert.equal(payload.everyone_can_play, 'oui');
});

test('analyzeQuery filters games by keywords and numbers', () => {
  const games = [
    {
      nom: 'Comp Game',
      type: 'Compétitif',
      minDuree: 15,
      maxDuree: 15,
      minJoueurs: 2,
      maxJoueurs: 4,
      playTime: null,
      playerCount: null,
      complexite: '',
      tags: [],
    },
    {
      nom: 'Coop Game',
      type: 'Coopératif',
      minDuree: 45,
      maxDuree: 45,
      minJoueurs: 1,
      maxJoueurs: 2,
      playTime: null,
      playerCount: null,
      complexite: '',
      tags: [],
    },
  ];

  const { extracts, filtered } = analyzeQuery(
    'jeu compétitif pour 3 joueurs de moins de 20 minutes',
    games,
  );

  assert.deepEqual(extracts.sort(), ['3 joueurs', 'Compétitif', '≤ 20 min'].sort());
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].nom, 'Comp Game');
});

test('resolveApiBaseUrl honours dataset, globals and environment', () => {
  const documentStub = {
    body: { dataset: { apiBaseUrl: 'https://custom-api.example.com' } },
  };
  const globalStub = {
    location: { origin: 'https://example.com', hostname: 'example.com' },
  };
  assert.equal(
    resolveApiBaseUrl({ documentRef: documentStub, globalObject: globalStub }),
    'https://custom-api.example.com',
  );

  assert.equal(
    resolveApiBaseUrl({ documentRef: { body: { dataset: {} } }, globalObject: globalStub }),
    'https://example.com',
  );

  assert.equal(
    resolveApiBaseUrl({
      globalObject: {
        location: { hostname: 'localhost', origin: 'http://localhost:3000' },
      },
    }),
    LOCAL_API_BASE_URL,
  );

  assert.equal(
    resolveApiBaseUrl({
      documentRef: {
        body: { dataset: { apiBaseUrl: 'https://remote.example.com' } },
      },
      globalObject: {
        location: { hostname: 'localhost', origin: 'http://localhost:8000' },
      },
    }),
    LOCAL_API_BASE_URL,
  );

  assert.equal(
    resolveApiBaseUrl({
      globalObject: { location: { hostname: 'devbox', port: '8000' } },
    }),
    LOCAL_API_BASE_URL,
  );

  assert.equal(resolveApiBaseUrl({ globalObject: {} }), DEFAULT_API_BASE_URL);
});

test('toOptionalNumber converts valid values', () => {
  assert.equal(toOptionalNumber('42'), 42);
  assert.equal(toOptionalNumber(''), null);
  assert.equal(toOptionalNumber(undefined), null);
  assert.equal(toOptionalNumber('abc'), null);
});
