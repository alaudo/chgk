// storage.js - localStorage persistence with debouncing and migrations

const STORAGE_KEYS = {
  players: 'chgk.players',
  rounds: 'chgk.rounds',
  settings: 'chgk.settings',
  gameId: 'chgk.gameId',
  gameRounds: 'chgk.gameRounds',
  currentGameRoundIndex: 'chgk.currentGameRoundIndex',
  currentQuestionNumber: 'chgk.currentQuestionNumber',
  currentView: 'chgk.currentView',
  currentRoundId: 'chgk.currentRoundId',
  editingRoundId: 'chgk.editingRoundId',
  uiState: 'chgk.uiState',
  version: 'chgk.stateVersion'
};

const CURRENT_VERSION = 2;
const SAVE_DEBOUNCE_MS = 500;

let saveTimeout = null;

/**
 * Load application state from localStorage
 * @returns {Object} State object with players, rounds, settings
 */
function loadState() {
  try {
    const version = parseInt(localStorage.getItem(STORAGE_KEYS.version) || '0', 10);

    const parseJson = (key, fallback) => {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined || raw === '') return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    };
    
    let state = {
      players: parseJson(STORAGE_KEYS.players, []),
      rounds: parseJson(STORAGE_KEYS.rounds, []),
      settings: parseJson(STORAGE_KEYS.settings, {}),
      gameId: parseJson(STORAGE_KEYS.gameId, null),
      gameRounds: parseJson(STORAGE_KEYS.gameRounds, []),
      currentGameRoundIndex: parseJson(STORAGE_KEYS.currentGameRoundIndex, 0),
      currentQuestionNumber: parseJson(STORAGE_KEYS.currentQuestionNumber, 1),
      currentView: parseJson(STORAGE_KEYS.currentView, 'teams'),
      currentRoundId: parseJson(STORAGE_KEYS.currentRoundId, null),
      editingRoundId: parseJson(STORAGE_KEYS.editingRoundId, null),
      uiState: parseJson(STORAGE_KEYS.uiState, {})
    };

    // Apply migrations if needed
    if (version < CURRENT_VERSION) {
      state = migrateState(state, version);
    }

    // Ensure default settings
    state.settings = {
      allowUnevenTeams: true,
      variabilityWeight: 1.0,
      questionsPerRound: 12,
      gameRounds: 5,
      ...state.settings
    };
    
    // Ensure game/UI state properties exist
    state.gameId = state.gameId ?? null;
    state.gameRounds = Array.isArray(state.gameRounds) ? state.gameRounds : [];
    state.currentGameRoundIndex = Number.isFinite(state.currentGameRoundIndex) ? state.currentGameRoundIndex : 0;
    state.currentQuestionNumber = Number.isFinite(state.currentQuestionNumber) ? state.currentQuestionNumber : 1;
    state.currentView = state.currentView || 'teams';
    state.currentRoundId = state.currentRoundId ?? null;
    state.editingRoundId = state.editingRoundId ?? null;
    state.uiState = state.uiState || {};

    // Legacy fallback: if we have rounds but no active round, assume the last one is active.
    if (!state.currentRoundId && Array.isArray(state.rounds) && state.rounds.length > 0) {
      const lastRound = state.rounds[state.rounds.length - 1];
      if (lastRound && lastRound.id) {
        state.currentRoundId = lastRound.id;
      }
    }

    return state;
  } catch (error) {
    console.error('Failed to load state:', error);
    return {
      players: [],
      rounds: [],
      settings: {
        allowUnevenTeams: true,
        variabilityWeight: 1.0,
        questionsPerRound: 12,
        gameRounds: 5
      },
      gameId: null,
      gameRounds: [],
      currentGameRoundIndex: 0,
      currentQuestionNumber: 1,
      currentView: 'teams',
      currentRoundId: null,
      editingRoundId: null,
      uiState: {}
    };
  }
}

/**
 * Save application state to localStorage (debounced)
 * @param {Object} state - State object with players, rounds, settings
 */
function saveStateDebounced(state) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.players, JSON.stringify(state.players));
      localStorage.setItem(STORAGE_KEYS.rounds, JSON.stringify(state.rounds));
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
      localStorage.setItem(STORAGE_KEYS.gameId, JSON.stringify(state.gameId ?? null));
      localStorage.setItem(STORAGE_KEYS.gameRounds, JSON.stringify(state.gameRounds ?? []));
      localStorage.setItem(STORAGE_KEYS.currentGameRoundIndex, JSON.stringify(state.currentGameRoundIndex ?? 0));
      localStorage.setItem(STORAGE_KEYS.currentQuestionNumber, JSON.stringify(state.currentQuestionNumber ?? 1));
      localStorage.setItem(STORAGE_KEYS.currentView, JSON.stringify(state.currentView ?? 'teams'));
      localStorage.setItem(STORAGE_KEYS.currentRoundId, JSON.stringify(state.currentRoundId ?? null));
      localStorage.setItem(STORAGE_KEYS.editingRoundId, JSON.stringify(state.editingRoundId ?? null));
      localStorage.setItem(STORAGE_KEYS.uiState, JSON.stringify(state.uiState ?? {}));
      localStorage.setItem(STORAGE_KEYS.version, CURRENT_VERSION.toString());
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Save immediately (for critical operations like export)
 * @param {Object} state - State object
 */
function saveStateImmediate(state) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.players, JSON.stringify(state.players));
    localStorage.setItem(STORAGE_KEYS.rounds, JSON.stringify(state.rounds));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
    localStorage.setItem(STORAGE_KEYS.gameId, JSON.stringify(state.gameId ?? null));
    localStorage.setItem(STORAGE_KEYS.gameRounds, JSON.stringify(state.gameRounds ?? []));
    localStorage.setItem(STORAGE_KEYS.currentGameRoundIndex, JSON.stringify(state.currentGameRoundIndex ?? 0));
    localStorage.setItem(STORAGE_KEYS.currentQuestionNumber, JSON.stringify(state.currentQuestionNumber ?? 1));
    localStorage.setItem(STORAGE_KEYS.currentView, JSON.stringify(state.currentView ?? 'teams'));
    localStorage.setItem(STORAGE_KEYS.currentRoundId, JSON.stringify(state.currentRoundId ?? null));
    localStorage.setItem(STORAGE_KEYS.editingRoundId, JSON.stringify(state.editingRoundId ?? null));
    localStorage.setItem(STORAGE_KEYS.uiState, JSON.stringify(state.uiState ?? {}));
    localStorage.setItem(STORAGE_KEYS.version, CURRENT_VERSION.toString());
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

/**
 * Migrate state from older versions
 * @param {Object} state - Current state
 * @param {number} fromVersion - Version to migrate from
 * @returns {Object} Migrated state
 */
function migrateState(state, fromVersion) {
  console.log(`Migrating state from version ${fromVersion} to ${CURRENT_VERSION}`);
  
  // Add migrations here as schema evolves
  // Example:
  // if (fromVersion < 1) {
  //   state.players.forEach(p => p.active = p.active ?? true);
  // }
  
  return state;
}

/**
 * Export state as JSON string
 * @param {Object} state - State to export
 * @returns {string} JSON string
 */
function exportState(state) {
  return JSON.stringify({
    version: CURRENT_VERSION,
    exportDate: new Date().toISOString(),
    ...state
  }, null, 2);
}

/**
 * Import state from JSON string
 * @param {string} jsonString - JSON state string
 * @returns {Object|null} Imported state or null on error
 */
function importState(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    
    // Validate basic structure
    if (!imported.players || !Array.isArray(imported.players)) {
      throw new Error('Invalid state: missing players array');
    }
    
    const state = {
      players: imported.players,
      rounds: imported.rounds || [],
      settings: imported.settings || {},
      gameId: imported.gameId ?? null,
      gameRounds: imported.gameRounds || [],
      currentGameRoundIndex: imported.currentGameRoundIndex || 0,
      currentQuestionNumber: imported.currentQuestionNumber || 1,
      currentView: imported.currentView || 'teams',
      currentRoundId: imported.currentRoundId ?? null,
      editingRoundId: imported.editingRoundId ?? null,
      uiState: imported.uiState || {}
    };

    // Apply migrations if needed
    if (imported.version < CURRENT_VERSION) {
      return migrateState(state, imported.version || 0);
    }

    return state;
  } catch (error) {
    console.error('Failed to import state:', error);
    return null;
  }
}

/**
 * Clear all stored data
 */
function clearStorage() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}
