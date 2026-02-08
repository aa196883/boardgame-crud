import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeQuery,
  buildPayloadFromForm,
  derivePlayTimeString,
  initApp,
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

  const { filtered } = analyzeQuery(
    'jeu compétitif pour 3 joueurs de moins de 20 minutes',
    games,
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].nom, 'Comp Game');
});

test('resolveApiBaseUrl chooses local host override and defaults to same origin', () => {
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
      globalObject: {
        location: { hostname: 'example.com', origin: 'https://example.com' },
      },
    }),
    '',
  );

  assert.equal(resolveApiBaseUrl({ globalObject: {} }), '');
});

test('toOptionalNumber converts valid values', () => {
  assert.equal(toOptionalNumber('42'), 42);
  assert.equal(toOptionalNumber(''), null);
  assert.equal(toOptionalNumber(undefined), null);
  assert.equal(toOptionalNumber('abc'), null);
});

class HTMLElementStub {}

if (typeof globalThis.HTMLElement === 'undefined') {
  globalThis.HTMLElement = HTMLElementStub;
}

class TestClassList {
  constructor(initial = []) {
    this._set = new Set(initial.filter(Boolean));
  }

  add(...classes) {
    classes.filter(Boolean).forEach((cls) => this._set.add(cls));
  }

  remove(...classes) {
    classes.filter(Boolean).forEach((cls) => this._set.delete(cls));
  }

  contains(cls) {
    return this._set.has(cls);
  }

  toggle(cls, force) {
    if (force === true) {
      this._set.add(cls);
      return true;
    }
    if (force === false) {
      this._set.delete(cls);
      return false;
    }
    if (this._set.has(cls)) {
      this._set.delete(cls);
      return false;
    }
    this._set.add(cls);
    return true;
  }

  [Symbol.iterator]() {
    return this._set.values();
  }
}

class TestElement extends HTMLElementStub {
  constructor({ tagName = 'div', ownerDocument = null, classNames = [], dataset = {} } = {}) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.classList = new TestClassList(classNames);
    this.dataset = { ...dataset };
    this.children = [];
    this.parentNode = null;
    this._textContent = '';
    this._innerHTML = '';
    this.value = '';
    this.disabled = false;
    this.attributes = new Map();
    this.listeners = new Map();
  }

  appendChild(child) {
    child.parentNode = this;
    if (!child.ownerDocument) {
      child.ownerDocument = this.ownerDocument;
    }
    this.children.push(child);
    return child;
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = value;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      this.dataset[key] = value;
    }
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      delete this.dataset[key];
    }
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(handler);
  }

  dispatchEvent(type, event) {
    const handlers = this.listeners.get(type) || [];
    handlers.forEach((handler) => handler(event));
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (selector === 'table' && node.tagName === 'TABLE') {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }
}

class TestDocument {
  constructor() {
    this.body = new TestElement({ tagName: 'body', ownerDocument: this });
    this.body.dataset = {};
    this._selectors = new Map();
    this._selectorLists = new Map();
  }

  createElement(tagName) {
    return new TestElement({ tagName, ownerDocument: this });
  }

  register(selector, element) {
    element.ownerDocument = this;
    this._selectors.set(selector, element);
    return element;
  }

  registerAll(selector, elements) {
    elements.forEach((element) => {
      element.ownerDocument = this;
    });
    this._selectorLists.set(selector, elements);
    return elements;
  }

  querySelector(selector) {
    return this._selectors.get(selector) ?? null;
  }

  querySelectorAll(selector) {
    return this._selectorLists.get(selector) ?? [];
  }
}

function createAppTestHarness() {
  const documentRef = new TestDocument();

  const modeRead = documentRef.register('#mode-read', new TestElement({ tagName: 'section' }));
  const modeEdit = documentRef.register('#mode-edit', new TestElement({ tagName: 'section' }));

  const navBtnRead = new TestElement({ tagName: 'button', classNames: ['nav-btn', 'nav-btn-active'] });
  navBtnRead.setAttribute('data-mode', 'read');
  const navBtnEdit = new TestElement({ tagName: 'button', classNames: ['nav-btn'] });
  navBtnEdit.setAttribute('data-mode', 'edit');
  documentRef.registerAll('.nav-btn', [navBtnRead, navBtnEdit]);

  const searchInput = documentRef.register('#natural-query', new TestElement({ tagName: 'input' }));
  const searchBtn = documentRef.register(
    '#search-btn',
    new TestElement({ tagName: 'button', classNames: ['primary-btn'] }),
  );

  const resultsTable = new TestElement({ tagName: 'table', classNames: ['search-table'] });
  const resultsList = new TestElement({ tagName: 'tbody' });
  resultsTable.appendChild(resultsList);
  documentRef.register('#results-list', resultsList);

  const resultsCards = documentRef.register(
    '#results-cards',
    new TestElement({ tagName: 'div', classNames: ['results-cards'] }),
  );

  const emptyState = documentRef.register(
    '#empty-state',
    new TestElement({ tagName: 'div', classNames: ['empty-state', 'hidden'] }),
  );

  const searchLoading = documentRef.register(
    '#search-loading',
    new TestElement({ tagName: 'div', classNames: ['search-loading', 'hidden'] }),
  );
  const searchFeedback = documentRef.register(
    '#search-feedback',
    new TestElement({ tagName: 'div', classNames: ['search-feedback', 'hidden'] }),
  );

  const thName = new TestElement({ tagName: 'th' });
  thName.setAttribute('data-sort-key', 'name');
  const thPlayers = new TestElement({ tagName: 'th' });
  thPlayers.setAttribute('data-sort-key', 'players');
  const thDuration = new TestElement({ tagName: 'th' });
  thDuration.setAttribute('data-sort-key', 'duration');
  const thType = new TestElement({ tagName: 'th' });
  thType.setAttribute('data-sort-key', 'type');
  documentRef.registerAll('.search-table th[data-sort-key]', [
    thName,
    thPlayers,
    thDuration,
    thType,
  ]);

  const adminTableBody = documentRef.register(
    '#games-admin-list',
    new TestElement({ tagName: 'tbody' }),
  );
  const emptyAdmin = documentRef.register(
    '#empty-admin',
    new TestElement({ tagName: 'div', classNames: ['hidden'] }),
  );

  const formTitle = documentRef.register('#form-title', new TestElement({ tagName: 'h2' }));
  const gameNameInput = documentRef.register('#game-name', new TestElement({ tagName: 'input' }));
  const minPlayersInput = documentRef.register('#min-players', new TestElement({ tagName: 'input' }));
  const maxPlayersInput = documentRef.register('#max-players', new TestElement({ tagName: 'input' }));
  const durationMinInput = documentRef.register('#duration-min', new TestElement({ tagName: 'input' }));
  const durationMaxInput = documentRef.register('#duration-max', new TestElement({ tagName: 'input' }));
  const typeJeuInput = documentRef.register('#type-jeu', new TestElement({ tagName: 'input' }));
  const complexiteInput = documentRef.register('#complexite', new TestElement({ tagName: 'input' }));
  const tagsInput = documentRef.register('#tags', new TestElement({ tagName: 'input' }));
  const saveBtn = documentRef.register('#save-btn', new TestElement({ tagName: 'button' }));
  const cancelBtn = documentRef.register('#cancel-btn', new TestElement({ tagName: 'button' }));

  return {
    documentRef,
    elements: {
      modeRead,
      modeEdit,
      navBtnRead,
      navBtnEdit,
      searchInput,
      searchBtn,
      resultsTable,
      resultsList,
      resultsCards,
      emptyState,
      searchLoading,
      searchFeedback,
      adminTableBody,
      emptyAdmin,
      formTitle,
      gameNameInput,
      minPlayersInput,
      maxPlayersInput,
      durationMinInput,
      durationMaxInput,
      typeJeuInput,
      complexiteInput,
      tagsInput,
      saveBtn,
      cancelBtn,
    },
  };
}

test('performNaturalSearch enforces a visible loading window', async () => {
  const harness = createAppTestHarness();
  const { documentRef, elements } = harness;

  const fetchCalls = [];
  const fetchImpl = async (url) => {
    fetchCalls.push(url);
    const payload = url.includes('?question=')
      ? [
          {
            name: 'Search Result',
            min_players: 2,
            max_players: 4,
            min_duration_minutes: 10,
            max_duration_minutes: 20,
            play_time: '10 - 20 min',
            player_count: '2 - 4',
            game_type: 'Compétitif',
            team_play: 'Oui',
            special_support: 'Cartes',
            everyone_can_play: 'oui',
          },
        ]
      : [
          {
            name: 'Initial Game',
            min_players: 1,
            max_players: 3,
            min_duration_minutes: 5,
            max_duration_minutes: 10,
            play_time: '5 - 10 min',
            player_count: '1 - 3',
            game_type: 'Coopératif',
            team_play: 'Oui',
            special_support: 'Cartes',
            everyone_can_play: 'oui',
          },
        ];
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => payload,
    };
  };

  const app = initApp({ documentRef, fetchImpl, baseUrl: '' });

  // allow the initial refreshGames call to resolve
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(elements.resultsList.children.length > 0, 'results rendered after initial load');
  assert.ok(elements.resultsCards.children.length > 0, 'cards rendered after initial load');

  const start = Date.now();
  const searchPromise = app.performSearch('nouvelle recherche');

  // allow synchronous updates from performSearch
  await Promise.resolve();

  assert.equal(elements.searchBtn.disabled, true, 'search button is disabled during loading');
  assert.equal(
    elements.searchLoading.classList.contains('hidden'),
    false,
    'loading indicator visible',
  );
  assert.equal(elements.resultsList.children.length, 0, 'results table cleared during loading');
  assert.equal(elements.resultsCards.children.length, 0, 'results cards cleared during loading');
  assert.equal(elements.emptyState.classList.contains('hidden'), true, 'empty state hidden');
  assert.equal(
    elements.resultsTable.classList.contains('is-loading'),
    true,
    'table marked as loading',
  );

  await searchPromise;
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 2900, `loading finished after minimum duration, got ${elapsed}ms`);

  assert.equal(elements.searchBtn.disabled, false, 'search button re-enabled after loading');
  assert.equal(
    elements.searchLoading.classList.contains('hidden'),
    true,
    'loading indicator hidden after completion',
  );
  assert.equal(
    elements.resultsTable.classList.contains('is-loading'),
    false,
    'table loading flag cleared',
  );
  assert.ok(elements.resultsList.children.length > 0, 'results rendered after loading completes');
  assert.ok(elements.resultsCards.children.length > 0, 'result cards rendered after loading completes');
  assert.ok(
    fetchCalls.some((url) => url.includes('?question=')),
    'search endpoint was invoked',
  );
});


test('initApp disables natural search button when OpenAI key is unavailable', async () => {
  const harness = createAppTestHarness();
  const { documentRef, elements } = harness;

  const fetchImpl = async (url) => {
    if (url.endsWith('/api/config')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ openai_enabled: false }),
      };
    }

    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => [],
    };
  };

  initApp({ documentRef, fetchImpl, baseUrl: '' });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(elements.searchBtn.disabled, true, 'search button is disabled');
  assert.equal(elements.searchFeedback.classList.contains('hidden'), false, 'feedback is visible');
  assert.ok(
    elements.searchFeedback.textContent.includes('clé OpenAI manquante'),
    'feedback mentions missing OpenAI key',
  );
});
