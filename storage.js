// storage.js - localStorage persistence with debouncing and migrations

const STORAGE_KEYS = {
  players: 'chgk.players',
  rounds: 'chgk.rounds',
  settings: 'chgk.settings',
  version: 'chgk.stateVersion'
};

const CURRENT_VERSION = 1;
const SAVE_DEBOUNCE_MS = 500;

let saveTimeout = null;

/**
 * Load application state from localStorage
 * @returns {Object} State object with players, rounds, settings
 */
function loadState() {
  try {
    const version = parseInt(localStorage.getItem(STORAGE_KEYS.version) || '0', 10);
    
    let state = {
      players: JSON.parse(localStorage.getItem(STORAGE_KEYS.players) || '[]'),
      rounds: JSON.parse(localStorage.getItem(STORAGE_KEYS.rounds) || '[]'),
      settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}')
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
    
    // Ensure game state properties exist
    state.gameId = state.gameId || null;
    state.gameRounds = state.gameRounds || [];
    state.currentGameRoundIndex = state.currentGameRoundIndex || 0;

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
      currentGameRoundIndex: 0
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
      settings: imported.settings || {}
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
