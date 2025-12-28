// app.js - Application state management

class AppState {
  constructor() {
    this.players = [];
    this.rounds = [];
    this.currentRoundId = null;
    this.editingRoundId = null;
    this.currentView = 'teams'; // 'teams' or 'scoring'
    this.settings = {
      allowUnevenTeams: true,
      variabilityWeight: 1.0,
      questionsPerRound: 12,
      gameRounds: 3,
      hideCaptains: false
    };
    // UI state for persistence
    this.uiState = {
      leaderboardTab: 'players',
      leaderboardSort: { by: 'correctAnswers', direction: 'desc' },
      allowManualMove: false
    };
    this.undoSnapshot = null;
    // Game mode state
    this.gameId = null;
    this.gameRounds = []; // Pre-generated rounds for the entire game
    this.currentGameRoundIndex = 0; // Which round in the game we're on
    // Question timer state
    this.currentQuestionNumber = 1;

    // When editing a past round while another round is in progress,
    // keep enough context to restore the active round afterwards.
    this.suspendedRoundState = null;
  }

  getPersistableState() {
    return {
      players: this.players,
      rounds: this.rounds,
      settings: this.settings,
      gameId: this.gameId,
      gameRounds: this.gameRounds,
      currentGameRoundIndex: this.currentGameRoundIndex,
      currentQuestionNumber: this.currentQuestionNumber,
      currentView: this.currentView,
      currentRoundId: this.currentRoundId,
      editingRoundId: this.editingRoundId,
      uiState: this.uiState
    };
  }

  /**
   * Initialize from storage
   */
  init() {
    const saved = loadState();
    this.players = saved.players;
    this.rounds = saved.rounds;
    this.settings = {
      allowUnevenTeams: true,
      variabilityWeight: 1.0,
      questionsPerRound: 12,
      gameRounds: 3,
      ...saved.settings
    };
    this.gameId = saved.gameId || null;
    this.gameRounds = saved.gameRounds || [];
    this.currentGameRoundIndex = saved.currentGameRoundIndex || 0;
    this.currentQuestionNumber = saved.currentQuestionNumber || 1;
    this.currentView = saved.currentView || 'teams';
    this.currentRoundId = saved.currentRoundId || null;
    this.editingRoundId = saved.editingRoundId || null;
    this.uiState = {
      leaderboardTab: 'players',
      leaderboardSort: { by: 'correctAnswers', direction: 'desc' },
      allowManualMove: false,
      ...saved.uiState
    };
    
    // Restore active game state if there's an ongoing game
    if (this.gameId && this.gameRounds.length > 0) {
      this.restoreActiveGameState();
    }

    // Legacy fallback: if we have rounds but no active round ID, assume the last round is active.
    if (!this.currentRoundId && Array.isArray(this.rounds) && this.rounds.length > 0) {
      const lastRound = this.rounds[this.rounds.length - 1];
      if (lastRound && lastRound.id) {
        this.currentRoundId = lastRound.id;
      }
    }
    
    // Ensure we have a consistent state after loading
    if (this.currentRoundId) {
      const round = this.rounds.find(r => r.id === this.currentRoundId);
      if (round) {
        // We have an active round, make sure we're ready to display it
        this.ensureRoundQuestionsInitialized(round);
      } else if (this.isGameMode()) {
        // Current round ID exists but round not found - this shouldn't happen after restoration
        console.warn('Current round ID exists but round not found in rounds array');
        // Try to restore it one more time
        this.restoreActiveGameState();
      }
    }
    
    // Sync game rounds with completed rounds for proper display
    this.syncGameRoundsWithCompletedRounds();
    
    // Migrate old player data
    this.players.forEach(player => {
      if (!player.questionHistory) {
        player.questionHistory = [];
      }
      if (player.teamName === undefined) {
        player.teamName = '';
      }
      if (player.teamColor === undefined) {
        player.teamColor = player.isCaptain ? '#3b82f6' : null;
      }
    });
  }

  /**
   * Save state to storage
   */
  save() {
    saveStateDebounced(this.getPersistableState());
  }

  saveImmediate() {
    saveStateImmediate(this.getPersistableState());
  }

  /**
   * Restore active game state after loading from storage
   */
  restoreActiveGameState() {
    // Ensure all completed game rounds (up to current index) are in the rounds array
    if (this.gameRounds.length > 0) {
      for (let i = 0; i <= this.currentGameRoundIndex && i < this.gameRounds.length; i++) {
        const gameRound = this.gameRounds[i];
        if (gameRound) {
          // Check if this round exists in rounds array
          const existingRound = this.rounds.find(r => r.id === gameRound.id);
          if (!existingRound) {
            // Round not in rounds array, add it
            this.ensureRoundQuestionsInitialized(gameRound);
            this.rounds.push(gameRound);
          } else {
            // Round exists, ensure it has the latest state from gameRounds
            // but preserve any question progress that was saved
            this.ensureRoundQuestionsInitialized(existingRound);
          }
        }
      }
      
      // Always ensure current round ID is set correctly for the current game round index
      if (this.currentGameRoundIndex < this.gameRounds.length) {
        const currentGameRound = this.gameRounds[this.currentGameRoundIndex];
        if (currentGameRound) {
          // Verify the current round ID matches the current game round
          if (this.currentRoundId !== currentGameRound.id) {
            this.currentRoundId = currentGameRound.id;
          }
          
          // Ensure this round is in the rounds array
          const currentRound = this.rounds.find(r => r.id === this.currentRoundId);
          if (!currentRound) {
            this.ensureRoundQuestionsInitialized(currentGameRound);
            this.rounds.push(currentGameRound);
          }
        }
      }
    }
  }

  /**
   * Sync game rounds with completed rounds to ensure draw table shows current progress
   */
  syncGameRoundsWithCompletedRounds() {
    if (!this.isGameMode()) return;
    
    // Update gameRounds with any progress from completed rounds
    this.gameRounds.forEach((gameRound, index) => {
      const completedRound = this.rounds.find(r => r.id === gameRound.id);
      if (completedRound) {
        // Preserve the original game round structure but update with completed data
        gameRound.questions = completedRound.questions || gameRound.questions;
        gameRound.scores = completedRound.scores || gameRound.scores;
      }
    });
  }

  /**
   * Ensure round has properly initialized questions object
   */
  ensureRoundQuestionsInitialized(round) {
    if (!round.questions) {
      round.questions = {};
    }
    if (!round.scores) {
      round.scores = {};
    }
    
    const questionsPerRound = round.questionsCount || this.settings.questionsPerRound;
    
    // Initialize questions for each team if not already done
    round.teams.forEach(team => {
      if (!round.questions[team.id]) {
        round.questions[team.id] = new Array(questionsPerRound).fill(false);
      }
      if (!round.scores[team.id]) {
        round.scores[team.id] = 0;
      }
    });
  }

  /**
   * Add a new player
   */
  addPlayer(name, isCaptain = false, teamName = '') {
    const player = {
      id: `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      isCaptain: isCaptain,
      teamName: teamName.trim(),
      teamColor: isCaptain ? '#3b82f6' : null, // Default blue for captains
      rating: 0,
      active: true,
      roundsPlayed: 0,
      totalScore: 0,
      questionHistory: [] // { roundId, roundIndex, teamId, questionIndex, correct }
    };
    
    this.players.push(player);
    this.save();
    return player;
  }

  /**
   * Update player properties
   */
  updatePlayer(playerId, updates) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      Object.assign(player, updates);
      this.save();
    }
  }

  /**
   * Update player name with validation
   */
  updatePlayerName(playerId, newName) {
    const trimmedName = newName.trim();
    
    if (!trimmedName) {
      throw new Error('Player name cannot be empty');
    }

    // Check for duplicate names (excluding the current player)
    const duplicateExists = this.players.some(p => 
      p.id !== playerId && p.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (duplicateExists) {
      throw new Error(`A player with the name "${trimmedName}" already exists`);
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    player.name = trimmedName;
    this.save();
    return player;
  }

  /**
   * Delete a player
   */
  deletePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    this.save();
  }

  /**
   * Get active players
   */
  getActivePlayers() {
    return this.players.filter(p => p.active);
  }

  /**
   * Get captains
   */
  getCaptains() {
    return this.players.filter(p => p.active && p.isCaptain);
  }

  /**
   * Get non-captains
   */
  getNonCaptains() {
    return this.players.filter(p => p.active && !p.isCaptain);
  }

  /**
   * Generate new teams
   */
  generateTeams() {
    const captains = this.getCaptains();
    const nonCaptains = this.getNonCaptains();

    if (captains.length === 0) {
      throw new Error('At least one captain is required to form teams');
    }

    const captainIds = captains.map(c => c.id);
    const teams = generateTeams(captainIds, nonCaptains, this.settings);

    // Apply team names and colors from captains
    teams.forEach(team => {
      const captain = captains.find(c => c.id === team.captainId);
      if (captain && captain.teamName) {
        team.label = captain.teamName;
      }
      if (captain && captain.teamColor) {
        team.color = captain.teamColor;
      } else if (captain) {
        // Set default color if captain doesn't have one
        team.color = captain.teamColor || '#3b82f6';
      }
    });

    // Create new round with questions grid
    const questionsPerRound = this.settings.questionsPerRound || 12;
    const round = {
      id: `round-${Date.now()}`,
      index: this.rounds.length + 1,
      timestamp: Date.now(),
      teams: teams,
      scores: {},
      questions: {}, // teamId -> array of boolean (correct/incorrect)
      questionsCount: questionsPerRound
    };

    // Initialize questions grid
    teams.forEach(team => {
      round.questions[team.id] = new Array(questionsPerRound).fill(false);
    });

    this.currentRoundId = round.id;
    this.rounds.push(round);
    this.save();

    return round;
  }

  /**
   * Reshuffle current round teams
   */
  reshuffleCurrentRound() {
    if (!this.currentRoundId) {
      throw new Error('No active round to reshuffle');
    }

    const round = this.rounds.find(r => r.id === this.currentRoundId);
    if (!round) {
      throw new Error('Current round not found');
    }

    const allPlayerIds = this.players.map(p => p.id);
    const penaltyMatrix = computePenaltyMatrix(
      this.rounds.filter(r => r.id !== this.currentRoundId), // Exclude current round
      allPlayerIds
    );

    const nonCaptains = this.getNonCaptains();
    round.teams = reshuffleTeams(round.teams, nonCaptains, penaltyMatrix, this.settings);
    
    this.save();
    return round;
  }

  /**
   * Move a player from one team to another
   */
  movePlayer(playerId, fromTeamId, toTeamId) {
    if (!this.currentRoundId) {
      throw new Error('No active round');
    }

    const round = this.rounds.find(r => r.id === this.currentRoundId);
    if (!round) {
      throw new Error('Current round not found');
    }

    const player = this.players.find(p => p.id === playerId);
    const fromTeam = round.teams.find(t => t.id === fromTeamId);
    const toTeam = round.teams.find(t => t.id === toTeamId);

    if (!fromTeam || !toTeam) {
      throw new Error('Team not found');
    }

    // Check if player is a captain
    if (player.isCaptain && fromTeam.captainId === playerId) {
      throw new Error('Cannot move captain from their team');
    }

    // Check if destination team would have two captains
    if (player.isCaptain && toTeam.captainId) {
      throw new Error('Destination team already has a captain');
    }

    // Remove from source team
    fromTeam.playerIds = fromTeam.playerIds.filter(id => id !== playerId);

    // Add to destination team
    toTeam.playerIds.push(playerId);

    this.save();
  }

  /**
   * Update questions for a team
   */
  updateTeamQuestions(teamId, questions) {
    if (!this.currentRoundId) {
      throw new Error('No active round');
    }

    const round = this.rounds.find(r => r.id === this.currentRoundId);
    if (!round) {
      throw new Error('Current round not found');
    }

    round.questions[teamId] = questions;
    
    // Also update the corresponding game round if in game mode
    if (this.isGameMode()) {
      const gameRound = this.gameRounds.find(r => r.id === this.currentRoundId);
      if (gameRound) {
        if (!gameRound.questions) gameRound.questions = {};
        gameRound.questions[teamId] = questions;
      }
    }
    
    this.save();
  }

  /**
   * Apply scores to current round (called when finalizing)
   */
  applyRoundScores() {
    if (!this.currentRoundId) {
      throw new Error('No active round');
    }

    const round = this.rounds.find(r => r.id === this.currentRoundId);
    if (!round) {
      throw new Error('Current round not found');
    }

    // Save snapshot for undo
    this.undoSnapshot = {
      players: JSON.parse(JSON.stringify(this.players)),
      round: JSON.parse(JSON.stringify(round))
    };

    // Calculate scores from questions
    round.teams.forEach(team => {
      const questions = round.questions[team.id] || [];
      const score = questions.filter(q => q).length; // Count correct answers
      round.scores[team.id] = score;
    });

    // Update player ratings and question history
    this.updateRatings(round);
    this.updateQuestionHistory(round);

    this.save();
  }

  /**
   * Update player ratings based on round scores
   */
  updateRatings(round) {
    // Update rounds played and total score
    round.teams.forEach(team => {
      const teamScore = round.scores[team.id] || 0;
      team.playerIds.forEach(playerId => {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
          player.roundsPlayed = (player.roundsPlayed || 0) + 1;
          player.totalScore = (player.totalScore || 0) + teamScore;
        }
      });
    });

    // Update question history
    this.updateQuestionHistory(round);

    // Recalculate ratings for all players based on full history
    this.recalculateAllRatings();
  }

  /**
   * Update question history for all players in the round
   */
  updateQuestionHistory(round) {
    round.teams.forEach(team => {
      const questions = round.questions[team.id] || [];
      
      team.playerIds.forEach(playerId => {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
          if (!player.questionHistory) {
            player.questionHistory = [];
          }
          
          // Add each question result to player history
          questions.forEach((correct, questionIndex) => {
            player.questionHistory.push({
              roundId: round.id,
              roundIndex: round.index,
              teamId: team.id,
              teamLabel: team.label,
              questionIndex: questionIndex + 1,
              correct: correct
            });
          });
        }
      });
    });
  }

  /**
   * Recalculate ratings for all players based on question history
   * Rating = sum of (for each correct answer, count of other team players who got it wrong)
   */
  recalculateAllRatings() {
    this.players.forEach(player => {
      if (!player.questionHistory || player.questionHistory.length === 0) {
        player.rating = 0;
        return;
      }

      let rating = 0;

      // For each question this player answered correctly
      const correctAnswers = player.questionHistory.filter(q => q.correct);
      
      correctAnswers.forEach(answer => {
        // Find the round
        const round = this.rounds.find(r => r.id === answer.roundId);
        if (!round) return;

        // Count teams who got this question wrong
        let incorrectTeamsCount = 0;
        round.teams.forEach(team => {
          const teamQuestions = round.questions[team.id] || [];
          const teamGotItRight = teamQuestions[answer.questionIndex] || false;
          if (!teamGotItRight) {
            incorrectTeamsCount++;
          }
        });

        rating += incorrectTeamsCount;
      });

      player.rating = rating;
    });
  }

  /**
   * Start a new game with pre-generated rounds
   */
  startNewGame(numRounds) {
    const captains = this.getCaptains();
    const nonCaptains = this.getNonCaptains();

    if (captains.length === 0) {
      throw new Error('At least one captain is required to start a game');
    }

    if (numRounds < 1 || numRounds > 50) {
      throw new Error('Number of rounds must be between 1 and 50');
    }

    const captainIds = captains.map(c => c.id);
    const allRounds = generateGameRounds(numRounds, captainIds, nonCaptains, this.settings);

    // Apply team names and colors from captains
    allRounds.forEach(round => {
      round.teams.forEach(team => {
        const captain = captains.find(c => c.id === team.captainId);
        if (captain && captain.teamName) {
          team.label = captain.teamName;
        }
        if (captain && captain.teamColor) {
          team.color = captain.teamColor;
        } else if (captain) {
          // Set default color if captain doesn't have one
          team.color = captain.teamColor || '#3b82f6';
        }
      });
    });

    // Reset round history and all player statistics for new game
    this.rounds = [];
    this.players.forEach(player => {
      player.rating = 0;
      player.roundsPlayed = 0;
      player.totalScore = 0;
      player.questionHistory = [];
    });
    
    this.gameId = `game-${Date.now()}`;
    this.gameRounds = allRounds;
    this.currentGameRoundIndex = 0;
    
    // Set the first round as current
    const firstRound = this.gameRounds[0];
    this.currentRoundId = firstRound.id;
    this.rounds.push(firstRound);
    
    this.save();
    return firstRound;
  }

  /**
   * Check if we're in game mode
   */
  isGameMode() {
    return this.gameId !== null && this.gameRounds.length > 0;
  }

  /**
   * Get game progress info
   */
  getGameProgress() {
    if (!this.isGameMode()) {
      return null;
    }
    return {
      currentRound: this.currentGameRoundIndex + 1,
      totalRounds: this.gameRounds.length,
      isLastRound: this.currentGameRoundIndex >= this.gameRounds.length - 1
    };
  }

  /**
   * Finalize current round (lock it in)
   */
  finalizeRound() {
    this.applyRoundScores();
    
    // If in game mode, advance to next round
    if (this.isGameMode()) {
      // Sync current round progress before advancing
      this.syncGameRoundsWithCompletedRounds();
      
      this.currentGameRoundIndex++;
      
      if (this.currentGameRoundIndex < this.gameRounds.length) {
        // Load next pre-generated round
        const nextRound = this.gameRounds[this.currentGameRoundIndex];
        this.currentRoundId = nextRound.id;
        this.ensureRoundQuestionsInitialized(nextRound);
        this.rounds.push(nextRound);
      } else {
        // Game complete
        this.currentRoundId = null;
        this.endGame();
      }
    } else {
      this.currentRoundId = null;
    }
    
    this.save();
  }

  /**
   * End the current game
   */
  endGame() {
    this.gameId = null;
    this.gameRounds = [];
    this.currentGameRoundIndex = 0;
    this.save();
  }

  /**
   * Edit a past round (temporarily set as editing)
   */
  editRound(roundId) {
    const round = this.rounds.find(r => r.id === roundId);
    if (!round) {
      throw new Error('Round not found');
    }

    if (this.editingRoundId) {
      throw new Error('Already editing a round');
    }

    // Save snapshot before editing
    this.undoSnapshot = {
      players: JSON.parse(JSON.stringify(this.players)),
      round: JSON.parse(JSON.stringify(round))
    };

    // If there is an active in-progress round, temporarily suspend it.
    // We switch the "current" round context to the edited round so scoring UI updates
    // (checkboxes) operate on the edited round.
    if (this.currentRoundId && this.currentRoundId !== roundId) {
      this.suspendedRoundState = {
        currentRoundId: this.currentRoundId,
        currentView: this.currentView
      };
    } else {
      this.suspendedRoundState = null;
    }

    this.editingRoundId = roundId;
    this.currentRoundId = roundId;
    this.currentView = 'scoring';
    this.save();
  }

  /**
   * Save edited round back
   */
  saveEditedRound() {
    if (!this.editingRoundId) return;

    const round = this.rounds.find(r => r.id === this.editingRoundId);
    if (round) {
      // Recalculate scores from questions
      round.teams.forEach(team => {
        const questions = round.questions[team.id] || [];
        round.scores[team.id] = questions.filter(q => q).length;
      });

      // Clear old question history for this round
      this.players.forEach(player => {
        if (player.questionHistory) {
          player.questionHistory = player.questionHistory.filter(
            q => q.roundId !== this.editingRoundId
          );
        }
      });

      // Re-apply question history
      this.updateQuestionHistory(round);

      // Recalculate totals and ratings after edits
      this.recalculateTotalsFromRounds();
      this.recalculateAllRatings();
    }

    this.editingRoundId = null;
    this.undoSnapshot = null;

    // Restore the suspended active round (if any)
    if (this.suspendedRoundState && this.suspendedRoundState.currentRoundId) {
      this.currentRoundId = this.suspendedRoundState.currentRoundId;
      this.currentView = this.suspendedRoundState.currentView || this.currentView;
    }
    this.suspendedRoundState = null;
    this.save();
  }

  /**
   * Recalculate per-player aggregates (roundsPlayed/totalScore) from finished rounds.
   * Needed after editing a past round because updateRatings() is incremental.
   */
  recalculateTotalsFromRounds() {
    this.players.forEach(player => {
      player.roundsPlayed = 0;
      player.totalScore = 0;
    });

    this.rounds.forEach(round => {
      if (!round || !round.teams) return;
      if (Object.keys(round.scores || {}).length === 0) return;

      round.teams.forEach(team => {
        const teamScore = round.scores[team.id] || 0;
        (team.playerIds || []).forEach(playerId => {
          const player = this.players.find(p => p.id === playerId);
          if (!player) return;
          player.roundsPlayed = (player.roundsPlayed || 0) + 1;
          player.totalScore = (player.totalScore || 0) + teamScore;
        });
      });
    });
  }

  /**
   * Cancel editing round
   */
  cancelEditRound() {
    if (this.undoSnapshot && this.editingRoundId) {
      // Restore from snapshot
      this.players = this.undoSnapshot.players;
      const roundIndex = this.rounds.findIndex(r => r.id === this.undoSnapshot.round.id);
      if (roundIndex !== -1) {
        this.rounds[roundIndex] = this.undoSnapshot.round;
      }
    }
    this.editingRoundId = null;
    this.undoSnapshot = null;

    // Restore the suspended active round (if any)
    if (this.suspendedRoundState && this.suspendedRoundState.currentRoundId) {
      this.currentRoundId = this.suspendedRoundState.currentRoundId;
      this.currentView = this.suspendedRoundState.currentView || this.currentView;
    }
    this.suspendedRoundState = null;
    this.save();
  }

  /**
   * Undo last round
   */
  undoLastRound() {
    if (!this.undoSnapshot) {
      // Remove last round completely if no snapshot
      if (this.rounds.length > 0) {
        const removedRound = this.rounds.pop();
        this.currentRoundId = null;
        
        // Remove question history for this round
        this.players.forEach(player => {
          if (player.questionHistory) {
            player.questionHistory = player.questionHistory.filter(
              q => q.roundId !== removedRound.id
            );
          }
        });
        
        // Recalculate ratings
        this.recalculateAllRatings();
      }
    } else {
      // Restore from snapshot
      this.players = this.undoSnapshot.players;
      const roundIndex = this.rounds.findIndex(r => r.id === this.undoSnapshot.round.id);
      if (roundIndex !== -1) {
        this.rounds[roundIndex] = this.undoSnapshot.round;
      }
      this.undoSnapshot = null;
    }
    
    this.save();
  }

  /**
   * Compute leaderboard
   */
  computeLeaderboard(sortBy = 'correctAnswers', sortDirection = 'desc') {
    const leaderboard = this.players
      .filter(p => p.roundsPlayed > 0)
      .map(player => {
        const captainRounds = this.rounds.filter(round => 
          round.teams.some(team => team.captainId === player.id)
        ).length;

        // Correct answers should align with team scores; use totalScore to avoid double counting
        const correctAnswers = player.totalScore || 0;
        const avgPerRound = player.roundsPlayed > 0 ? player.totalScore / player.roundsPlayed : 0;

        return {
          id: player.id,
          name: player.name,
          rating: player.rating || 0,
          totalScore: player.totalScore || 0,
          roundsPlayed: player.roundsPlayed || 0,
          correctAnswers: correctAnswers,
          captainRounds: captainRounds,
          avgPerRound: avgPerRound,
          isCaptain: player.isCaptain
        };
      })
      .sort((a, b) => {
        // Primary sort by specified column
        let primarySort = 0;
        if (sortBy === 'name') {
          primarySort = sortDirection === 'desc' 
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(b.name);
        } else {
          primarySort = sortDirection === 'desc' 
            ? b[sortBy] - a[sortBy]
            : a[sortBy] - b[sortBy];
        }
        
        if (primarySort !== 0) return primarySort;
        
        // Default tie-breaking: totalScore -> rating -> correctAnswers -> roundsPlayed -> name
        if (sortBy !== 'totalScore' && b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (sortBy !== 'rating' && b.rating !== a.rating) return b.rating - a.rating;
        if (sortBy !== 'correctAnswers' && b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
        if (sortBy !== 'roundsPlayed' && b.roundsPlayed !== a.roundsPlayed) return b.roundsPlayed - a.roundsPlayed;
        return a.name.localeCompare(b.name);
      });

    return leaderboard;
  }

  /**
   * Reset game (remove all rounds but keep players)
   */
  resetGame() {
    this.rounds = [];
    this.currentRoundId = null;
    this.editingRoundId = null;
    this.undoSnapshot = null;
    
    // End game mode
    this.endGame();
    
    // Reset player stats
    this.players.forEach(player => {
      player.rating = 0;
      player.roundsPlayed = 0;
      player.totalScore = 0;
      player.questionHistory = [];
    });
    
    this.save();
  }

  /**
   * Export state
   */
  exportData() {
    return exportState({
      players: this.players,
      rounds: this.rounds,
      settings: this.settings
    });
  }

  /**
   * Import state
   */
  importData(jsonString) {
    const imported = importState(jsonString);
    if (imported) {
      this.players = imported.players;
      this.rounds = imported.rounds;
      this.settings = imported.settings;
      this.currentRoundId = null;
      this.undoSnapshot = null;
      saveStateImmediate({
        players: this.players,
        rounds: this.rounds,
        settings: this.settings
      });
      return true;
    }
    return false;
  }

  /**
   * Reset all data
   */
  reset() {
    this.players = [];
    this.rounds = [];
    this.currentRoundId = null;
    this.undoSnapshot = null;
    this.endGame();
    clearStorage();
  }
}

// Global app state instance
const appState = new AppState();
