// ui.js - UI rendering and event handling

/**
 * Initialize UI
 */
function initUI() {
  // Restore UI state from appState
  if (appState.uiState.leaderboardTab) {
    leaderboardTab = appState.uiState.leaderboardTab;
  }
  if (appState.uiState.leaderboardSort) {
    leaderboardSort = { ...appState.uiState.leaderboardSort };
  }
  
  bindEvents();
  render();
}

/**
 * Collapse/expand sections
 */
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.classList.toggle('collapsed');
  const btn = section.querySelector('.collapse-btn');
  if (btn) {
    btn.textContent = section.classList.contains('collapsed') ? '+' : '−';
  }
}

/**
 * Bind all event listeners
 */
function bindEvents() {
  // Player management
  document.getElementById('addPlayerBtn').addEventListener('click', handleAddPlayer);
  document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddPlayer();
  });

  // Game management
  document.getElementById('startGameBtn').addEventListener('click', handleStartGame);
  document.getElementById('allowManualMove')?.addEventListener('change', handleAllowManualMoveChange);
  
  // Team generation
  document.getElementById('generateTeamsBtn').addEventListener('click', handleGenerateTeams);
  document.getElementById('reshuffleBtn').addEventListener('click', handleReshuffle);
  document.getElementById('reshuffleCurrentBtn')?.addEventListener('click', handleReshuffleCurrent);
  document.getElementById('addUnassignedPlayersBtn')?.addEventListener('click', handleAddUnassignedPlayers);
  document.getElementById('questionTimerBtn')?.addEventListener('click', openQuestionTimer);

  // View switching
  document.getElementById('viewTeamsBtn').addEventListener('click', () => switchView('teams'));
  document.getElementById('viewScoringBtn').addEventListener('click', () => switchView('scoring'));

  // Scoring
  document.getElementById('finalizeRoundBtn').addEventListener('click', handleFinalizeRound);
  document.getElementById('saveEditedRoundBtn')?.addEventListener('click', handleSaveEditedRound);
  document.getElementById('cancelEditRoundBtn')?.addEventListener('click', handleCancelEditRound);

  // Settings
  document.getElementById('questionsPerRound')?.addEventListener('change', handleSettingsChange);

  // Actions
  document.getElementById('undoBtn').addEventListener('click', handleUndo);
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('importBtn').addEventListener('click', handleImport);
  document.getElementById('resetGameBtn').addEventListener('click', handleResetGame);
  document.getElementById('resetBtn').addEventListener('click', handleReset);

  // File input for import
  document.getElementById('importFile').addEventListener('change', handleImportFile);
}

/**
 * Main render function
 */
function render() {
  renderPlayers();
  renderGameInfo();
  updateCurrentRoundTitle();
  renderCurrentRound();
  renderRoundsHistory();
  renderLeaderboard();
  updateActionButtons();
  updateViewButtons();
  
  // Ensure leaderboard tab buttons reflect current state
  document.getElementById('playersTabBtn')?.classList.toggle('active', leaderboardTab === 'players');
  document.getElementById('teamsTabBtn')?.classList.toggle('active', leaderboardTab === 'teams');
}

/**
 * Render game info
 */
function renderGameInfo() {
  const gameInfo = document.getElementById('gameInfo');
  const gameControls = document.getElementById('gameControls');
  
  if (appState.isGameMode()) {
    const progress = appState.getGameProgress();
    gameInfo.innerHTML = `
      <div class="game-progress">
        <h3>🎮 Игра в процессе</h3>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${(progress.currentRound / progress.totalRounds) * 100}%"></div>
        </div>
        <p class="progress-text">Тур ${progress.currentRound} из ${progress.totalRounds}</p>
        ${progress.isLastRound ? '<p class="progress-note">Это последний тур игры!</p>' : ''}
      </div>
    `;
    gameControls.style.display = 'none';
  } else {
    gameInfo.innerHTML = '';
    gameControls.style.display = 'block';
  }
}

/**
 * Update current round title with round number
 */
function updateCurrentRoundTitle() {
  const title = document.getElementById('currentRoundTitle');
  if (!title) return;

  if (appState.editingRoundId) {
    const editingRound = appState.rounds.find(r => r.id === appState.editingRoundId);
    if (editingRound) {
      title.textContent = `Редактирование тура ${editingRound.index}`;
    } else {
      title.textContent = 'Редактирование тура';
    }
    return;
  }
  
  if (appState.currentRoundId) {
    const progress = appState.getGameProgress();
    if (progress) {
      title.textContent = `Текущий тур ${progress.currentRound}/${progress.totalRounds}`;
    } else {
      const currentRound = appState.rounds.find(r => r.id === appState.currentRoundId);
      if (currentRound) {
        title.textContent = `Текущий тур ${currentRound.index}`;
      } else {
        title.textContent = 'Текущий тур';
      }
    }
  } else {
    title.textContent = 'Текущий тур';
  }
}

/**
 * Render players list
 */
function renderPlayers() {
  const container = document.getElementById('playersList');
  const players = appState.players;
  const displayPlayers = [...players].reverse();

  if (displayPlayers.length === 0) {
    container.innerHTML = '<p class="empty-state">No players added yet. Add your first player above.</p>';
    return;
  }

  container.classList.toggle('players-animate', animatePlayerInsert);

  container.innerHTML = displayPlayers
    .map(player => {
      const isInserted = animatePlayerInsert && player.id === lastAddedPlayerId;
      return `
      <div class="player-item ${player.active ? '' : 'inactive'} ${isInserted ? 'player-inserted' : ''}">
        <div class="player-info">
          <input
            class="player-name"
            id="playerNameInput-${player.id}"
            type="text"
            value="${escapeHtml(player.name)}"
            oninput="clearPlayerNameValidity(this)"
            onkeydown="handlePlayerNameKeydown(event, '${player.id}')"
            onblur="commitPlayerNameEdit('${player.id}', this)"
            ${player.active ? '' : 'disabled'}
          />
          ${player.isCaptain ? `
            <span class="captain-badge">👑 Captain${player.teamName ? ': ' + escapeHtml(player.teamName) : ''}</span>
            <input type="color" class="team-color-picker" value="${player.teamColor || '#3b82f6'}" 
                   onchange="updatePlayerColor('${player.id}', this.value)" title="Цвет команды">
          ` : ''}
          ${!player.active ? '<span class="inactive-badge">Inactive</span>' : ''}
        </div>
        <div class="player-stats">
          <span>Rating: ${player.rating?.toFixed(1) || '0.0'}</span>
          <span>Rounds: ${player.roundsPlayed || 0}</span>
        </div>
        <div class="player-actions">
          <button onclick="toggleCaptain('${player.id}')" class="btn-small">
            ${player.isCaptain ? '👤' : '👑'}
          </button>
          ${player.isCaptain ? `<button onclick="editTeamName('${player.id}')" class="btn-small" title="Edit Team Name">🏷️</button>` : ''}
          <button onclick="toggleActive('${player.id}')" class="btn-small">
            ${player.active ? '✓' : '○'}
          </button>
          <button onclick="deletePlayer('${player.id}')" class="btn-small btn-danger">×</button>
        </div>
      </div>
    `;
    })
    .join('');

  if (animatePlayerInsert) {
    if (playerInsertCleanupTimer) clearTimeout(playerInsertCleanupTimer);
    playerInsertCleanupTimer = setTimeout(() => {
      animatePlayerInsert = false;
      lastAddedPlayerId = null;
      container.classList.remove('players-animate');
      playerInsertCleanupTimer = null;
    }, 650);
  }
}

function clearPlayerNameValidity(inputEl) {
  if (!inputEl) return;
  inputEl.setCustomValidity('');
}

function handlePlayerNameKeydown(event, playerId) {
  if (!event) return;

  if (event.key === 'Enter') {
    event.preventDefault();
    commitPlayerNameEdit(playerId, event.target);
    event.target.blur();
  }

  if (event.key === 'Escape') {
    const player = appState.players.find(p => p.id === playerId);
    if (player && event.target) {
      event.target.value = player.name;
      event.target.setCustomValidity('');
      event.target.blur();
    }
  }
}

function commitPlayerNameEdit(playerId, inputEl) {
  if (!inputEl) return;
  const player = appState.players.find(p => p.id === playerId);
  if (!player) return;

  const newName = (inputEl.value || '').trim();
  const oldName = (player.name || '').trim();

  if (newName === oldName) {
    inputEl.value = player.name;
    inputEl.setCustomValidity('');
    return;
  }

  try {
    appState.updatePlayerName(playerId, newName);
    inputEl.setCustomValidity('');
    render();
  } catch (error) {
    inputEl.setCustomValidity(error.message || 'Invalid name');
    inputEl.reportValidity();
    inputEl.value = player.name;
  }
}

/**
 * Render current teams
 */
function renderTeams() {
  const container = document.getElementById('teamsContainer');
  
  if (!appState.currentRoundId) {
    container.innerHTML = '<p class="empty-state">No active round. Generate teams to start.</p>';
    document.getElementById('scoringSection').style.display = 'none';
    return;
  }

  const round = appState.rounds.find(r => r.id === appState.currentRoundId);
  if (!round) {
    container.innerHTML = '<p class="empty-state">Round not found.</p>';
    return;
  }

  document.getElementById('scoringSection').style.display = 'block';

  const questionsCount = round.questionsCount || 12;
  
  container.innerHTML = round.teams
    .map((team, teamIndex) => {
      const players = team.playerIds
        .map(id => appState.players.find(p => p.id === id))
        .filter(p => p);
      const questions = round.questions[team.id] || [];

      return `
        <div class="team-card team-card-${teamIndex + 1}">
          <div class="team-header" onclick="pickTeamColor('${team.captainId}')" title="Выбрать цвет команды" ${team.color ? `style="background: linear-gradient(135deg, ${team.color}, ${team.color}dd) !important"` : ''}>
            <h3>${escapeHtml(team.label)}</h3>
          </div>
          <div class="team-members">
            ${players.map(player => `
              <div class="team-member ${player.id === team.captainId ? 'captain' : ''}">
                ${escapeHtml(player.name)}
                ${player.id === team.captainId ? ' 👑' : ''}
                ${player.id !== team.captainId ? `
                  <select onchange="movePlayerTo('${player.id}', '${team.id}', this.value)" class="move-select">
                    <option value="">Move to...</option>
                    ${round.teams.filter(t => t.id !== team.id).map(t => 
                      `<option value="${t.id}">${escapeHtml(t.label)}</option>`
                    ).join('')}
                  </select>
                ` : ''}
              </div>
            `).join('')}
          </div>
          <div class="team-questions">
            <h4>Questions:</h4>
            <div class="questions-grid">
              ${Array.from({length: questionsCount}, (_, i) => `
                <label class="question-checkbox">
                  <input type="checkbox" 
                    data-team="${team.id}" 
                    data-question="${i}"
                    ${questions[i] ? 'checked' : ''}
                    onchange="updateQuestion('${team.id}', ${i}, this.checked)">
                  <span>${i + 1}</span>
                </label>
              `).join('')}
            </div>
            <div class="team-score-display">
              Score: <strong>${questions.filter(q => q).length}/${questionsCount}</strong>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Render rounds history
 */
function renderRoundsHistory() {
  const container = document.getElementById('roundsHistory');
  // Only show finalized rounds (those with scores calculated)
  const rounds = appState.rounds.filter(r => 
    r.id !== appState.currentRoundId && 
    Object.keys(r.scores || {}).length > 0
  );

  if (rounds.length === 0) {
    container.innerHTML = '<p class="empty-state">No completed rounds yet.</p>';
    return;
  }

  container.innerHTML = rounds
    .slice()
    .reverse()
    .map(round => {
      const hasScores = Object.keys(round.scores).length > 0;
      
      return `
        <div class="round-item">
          <div class="round-header">
            <h4>Round ${round.index}</h4>
            <span class="round-date">${new Date(round.timestamp).toLocaleString()}</span>
            <button onclick="editRoundFromHistory('${round.id}')" class="btn-small">Edit</button>
          </div>
          <div class="round-teams">
            ${round.teams.map(team => {
              const score = round.scores[team.id];
              const players = team.playerIds
                .map(id => appState.players.find(p => p.id === id))
                .filter(p => p);
              
              return `
                <div class="round-team">
                  <strong>${escapeHtml(team.label)}</strong>
                  ${hasScores ? `<span class="team-score">${score ?? 0} pts</span>` : ''}
                  <div class="team-players-small">
                    ${players.map(p => `
                      <span>${escapeHtml(p.name)}${p.id === team.captainId ? '👑' : ''}</span>
                    `).join(', ')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    })
    .join('');
}

// Leaderboard sorting state
let leaderboardSort = { by: 'correctAnswers', direction: 'desc' };
let leaderboardTab = 'players'; // 'players' or 'teams'

// Transient UI state
let lastAddedPlayerId = null;
let animatePlayerInsert = false;
let playerInsertCleanupTimer = null;

/**
 * Switch leaderboard tab
 */
function switchLeaderboardTab(tab) {
  leaderboardTab = tab;
  appState.uiState.leaderboardTab = tab;
  appState.save();
  document.getElementById('playersTabBtn').classList.toggle('active', tab === 'players');
  document.getElementById('teamsTabBtn').classList.toggle('active', tab === 'teams');
  renderLeaderboard();
}

/**
 * Render leaderboard
 */
function renderLeaderboard() {
  const container = document.getElementById('leaderboard');
  
  if (leaderboardTab === 'teams') {
    renderTeamsLeaderboard(container);
  } else if (leaderboardTab === 'draw') {
    renderDrawTable(container);
  } else {
    renderPlayersLeaderboard(container);
  }
}

/**
 * Render players leaderboard
 */
function renderPlayersLeaderboard(container) {
  let leaderboard = appState.computeLeaderboard(leaderboardSort.by, leaderboardSort.direction);
  
  // Filter out captains if hide captains is enabled
  if (appState.settings.hideCaptains) {
    leaderboard = leaderboard.filter(player => !player.isCaptain);
  }

  if (leaderboard.length === 0) {
    container.innerHTML = '<p class="empty-state">No scores yet. Complete a round to see ratings.</p>';
    return;
  }

  const getSortIcon = (column) => {
    if (leaderboardSort.by !== column) return '⇅';
    return leaderboardSort.direction === 'desc' ? '▼' : '▲';
  };

  container.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>№</th>
          <th class="sortable" onclick="sortLeaderboard('name')">Игрок ${getSortIcon('name')}</th>
          <th class="sortable" onclick="sortLeaderboard('correctAnswers')">Правильные ${getSortIcon('correctAnswers')}</th>
          <th class="sortable" onclick="sortLeaderboard('avgPerRound')">В среднем/тур ${getSortIcon('avgPerRound')}</th>
          <th class="sortable" onclick="sortLeaderboard('rating')">Рейтинг ${getSortIcon('rating')}</th>
          <th class="sortable" onclick="sortLeaderboard('roundsPlayed')">Туры ${getSortIcon('roundsPlayed')}</th>
          <th class="sortable" onclick="sortLeaderboard('captainRounds')">Капитан ${getSortIcon('captainRounds')}</th>
        </tr>
      </thead>
      <tbody>
        ${leaderboard.map((entry, index) => `
          <tr>
            <td class="rank">${index + 1}</td>
            <td>
              <a href="#" class="player-link" onclick="showPlayerStats('${entry.id}'); return false;">
                ${escapeHtml(entry.name)}
              </a>
              ${entry.isCaptain ? '<span class="captain-badge-small">👑</span>' : ''}
            </td>
            <td>${entry.correctAnswers}</td>
            <td>${entry.avgPerRound.toFixed(1)}</td>
            <td class="rating">${entry.rating.toFixed(0)}</td>
            <td>${entry.roundsPlayed}</td>
            <td>${entry.captainRounds}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Render teams leaderboard
 */
function renderTeamsLeaderboard(container) {
  // Collect team statistics across all rounds
  const teamStats = {};
  
  appState.rounds.forEach(round => {
    if (Object.keys(round.scores || {}).length === 0) return; // Skip unfin rounds
    
    round.teams.forEach(team => {
      const captain = appState.players.find(p => p.id === team.captainId);
      const teamKey = team.captainId;
      const teamName = (captain?.teamName && captain.teamName.trim()) ? captain.teamName.trim() : team.label;
      const score = round.scores[team.id] || 0;
      
      if (!teamStats[teamKey]) {
        teamStats[teamKey] = {
          captainId: team.captainId,
          name: teamName,
          captainName: captain?.name || 'Unknown',
          totalScore: 0,
          roundsPlayed: 0,
          correctAnswers: 0
        };
      }
      
      teamStats[teamKey].totalScore += score;
      teamStats[teamKey].roundsPlayed++;
      teamStats[teamKey].correctAnswers += score; // Score = correct answers
    });
  });
  
  const teamsArray = Object.values(teamStats)
    .map(team => ({
      ...team,
      avgPerRound: team.roundsPlayed > 0 ? team.totalScore / team.roundsPlayed : 0
    }))
    .sort((a, b) => {
      // Sort by total score, then avg per round
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.avgPerRound !== a.avgPerRound) return b.avgPerRound - a.avgPerRound;
      return a.name.localeCompare(b.name);
    });
  
  if (teamsArray.length === 0) {
    container.innerHTML = '<p class="empty-state">No team scores yet. Complete a round to see team ratings.</p>';
    return;
  }
  
  container.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>№</th>
          <th>Команда</th>
          <th>Капитан</th>
          <th>Правильные</th>
          <th>В среднем/тур</th>
          <th>Туры</th>
        </tr>
      </thead>
      <tbody>
        ${teamsArray.map((team, index) => `
          <tr>
            <td class="rank">${index + 1}</td>
            <td><a href="#" class="player-link" onclick="showTeamStats('${encodeURIComponent(team.captainId)}'); return false;"><strong>${escapeHtml(team.name)}</strong></a></td>
            <td>${escapeHtml(team.captainName)}</td>
            <td>${team.correctAnswers}</td>
            <td>${team.avgPerRound.toFixed(1)}</td>
            <td>${team.roundsPlayed}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Render draw table (player assignments across rounds)
 */
function renderDrawTable(container) {
  // In game mode, show all pre-generated rounds with current progress; otherwise show completed rounds
  let rounds;
  if (appState.isGameMode()) {
    // Show all game rounds, but use the version from appState.rounds if it exists (has current progress)
    rounds = appState.gameRounds.map(gameRound => {
      const completedRound = appState.rounds.find(r => r.id === gameRound.id);
      return completedRound || gameRound;
    });
  } else {
    rounds = appState.rounds;
  }
  
  if (rounds.length === 0) {
    container.innerHTML = '<p class="empty-state">Нет туров для отображения жеребьёвки. Начните игру или создайте команды.</p>';
    return;
  }

  // Collect all players that appear in any round
  const playerIdsInRounds = new Set();
  rounds.forEach(round => {
    round.teams.forEach(team => {
      team.playerIds.forEach(id => playerIdsInRounds.add(id));
    });
  });
  
  // Show players that appear in rounds (prioritize those, then show other active players)
  const playersInRounds = appState.players.filter(p => playerIdsInRounds.has(p.id));
  const otherActivePlayers = appState.players.filter(p => p.active && !playerIdsInRounds.has(p.id));
  let players = [...playersInRounds, ...otherActivePlayers];

  // Hide captains in draw tab if requested
  if (appState.settings.hideCaptains) {
    players = players.filter(p => !p.isCaptain);
  }

  // Build table
  const tableHtml = `
    <div class="draw-table-container">
      ${appState.isGameMode() ? '<p class="draw-table-note"><strong>📋 Жеребьёвка игры:</strong> Все туры сгенерированы заранее с оптимизацией распределения игроков.</p>' : ''}
      <table class="draw-table">
        <thead>
          <tr>
            <th class="player-col">Игрок</th>
            ${rounds.map(round => `<th>Тур ${round.index}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${players.map(player => {
            return `
              <tr>
                <td class="player-col">
                  <strong>${escapeHtml(player.name)}</strong>
                  ${player.isCaptain ? ' 👑' : ''}
                </td>
                ${rounds.map(round => {
                  // Find which team this player was on in this round
                  const team = round.teams.find(t => t.playerIds.includes(player.id));
                  const teamName = team ? escapeHtml(team.label) : '—';
                  const teamIndex = team ? round.teams.indexOf(team) + 1 : 0;
                  const cellClass = team ? (team.color ? 'team-cell' : `team-cell draw-team-${teamIndex}`) : 'no-team-cell';
                  const cellStyle = team && team.color ? `style="background-color: ${team.color}30; border-left: 4px solid ${team.color}"` : '';
                  return `<td class="${cellClass}" ${cellStyle}>${teamName}</td>`;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = tableHtml;
}

/**
 * Sort leaderboard by column
 */
function sortLeaderboard(column) {
  if (leaderboardSort.by === column) {
    leaderboardSort.direction = leaderboardSort.direction === 'desc' ? 'asc' : 'desc';
  } else {
    leaderboardSort.by = column;
    leaderboardSort.direction = 'desc';
  }
  appState.uiState.leaderboardSort = { ...leaderboardSort };
  appState.save();
  renderLeaderboard();
}

/**
 * Show detailed player statistics popup
 */
function showPlayerStats(playerId) {
  const player = appState.players.find(p => p.id === playerId);
  if (!player) return;

  const questionHistory = player.questionHistory || [];

  const correctByRound = new Map();
  questionHistory
    .filter(q => q && q.correct)
    .forEach(q => {
      const list = correctByRound.get(q.roundId) || [];
      list.push(q);
      correctByRound.set(q.roundId, list);
    });

  const correctLines = Array.from(correctByRound.entries())
    .map(([roundId, answers]) => {
      const round = appState.rounds.find(r => r.id === roundId);
      const roundIndex = round?.index ?? '?';
      const team = round?.teams?.find(t => t.id === answers[0]?.teamId) || round?.teams?.find(t => t.playerIds.includes(playerId));
      const teamLabel = team?.label || '—';

      const questionNums = answers
        .map(a => (a.questionIndex ?? 0) + 1)
        .filter(n => Number.isFinite(n))
        .sort((a, b) => a - b);
      const uniqueNums = Array.from(new Set(questionNums));

      return {
        roundIndex,
        text: `Тур ${roundIndex} ("${teamLabel}"): ${uniqueNums.join(', ')}`
      };
    })
    .sort((a, b) => {
      const aNum = Number(a.roundIndex);
      const bNum = Number(b.roundIndex);
      const aIsNum = Number.isFinite(aNum);
      const bIsNum = Number.isFinite(bNum);
      if (aIsNum && bIsNum) return aNum - bNum;
      if (aIsNum) return -1;
      if (bIsNum) return 1;
      return 0;
    });

  // Most often played together with (include future rounds in game mode)
  const togetherCounts = new Map();
  const roundsForTogether = appState.isGameMode() ? appState.gameRounds : appState.rounds;

  (roundsForTogether || []).forEach(round => {
    const team = round.teams?.find(t => t.playerIds?.includes(playerId));
    if (!team) return;
    team.playerIds.forEach(otherId => {
      if (otherId === playerId) return;
      togetherCounts.set(otherId, (togetherCounts.get(otherId) || 0) + 1);
    });
  });

  const togetherTop5 = Array.from(togetherCounts.entries())
    .map(([otherId, count]) => {
      const other = appState.players.find(p => p.id === otherId);
      if (!other) return null;
      return { name: other.name, count };
    })
    .filter(x => x)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);

  const statsHtml = `
    <div class="modal-overlay" onclick="closePlayerStats()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${escapeHtml(player.name)} ${player.isCaptain ? '👑' : ''}</h2>
          <button onclick="closePlayerStats()" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="stats-summary">
            <div class="stat-item">
              <div class="stat-label">Rating</div>
              <div class="stat-value">${player.rating?.toFixed(0) || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Total Score</div>
              <div class="stat-value">${player.totalScore || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Rounds Played</div>
              <div class="stat-value">${player.roundsPlayed || 0}</div>
            </div>
          </div>

          <h3>Round History</h3>
          <div class="rounds-stats">
            ${appState.rounds
              .filter(round => round.teams?.some(t => t.playerIds?.includes(playerId)))
              .map(round => {
                const playerTeam = round.teams.find(t => t.playerIds.includes(playerId));
                const questionsCount = round.questionsCount || appState.settings.questionsPerRound || 12;

                const tableHtml = `
                  <table class="mini-round-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        ${Array.from({length: questionsCount}, (_, i) => `<th>${i + 1}</th>`).join('')}
                        <th>Σ</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${round.teams.map(team => {
                        const teamQuestions = round.questions?.[team.id] || [];
                        const teamScore = teamQuestions.filter(q => q).length;
                        const isPlayerTeam = team.id === playerTeam?.id;

                        return `
                          <tr class="${isPlayerTeam ? 'player-team-row' : ''}">
                            <td class="team-col">${escapeHtml(team.label)}</td>
                            ${Array.from({length: questionsCount}, (_, i) => {
                              const correct = teamQuestions[i];
                              return `<td class="q-cell ${correct ? 'q-correct' : ''}">${correct ? '✓' : ''}</td>`;
                            }).join('')}
                            <td class="score-col"><strong>${teamScore}</strong></td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                `;

                const playerTeamQuestions = (playerTeam && round.questions?.[playerTeam.id]) ? round.questions[playerTeam.id] : [];
                const playerTeamScore = playerTeamQuestions.filter(q => q).length;

                return `
                  <div class="round-stat-item">
                    <div class="round-stat-header">
                      <strong>Round ${round.index}</strong> - ${escapeHtml(playerTeam?.label || 'Unknown')}
                      <span class="round-stat-summary">Team Score: ${playerTeamScore}</span>
                    </div>
                    ${tableHtml}
                  </div>
                `;
              }).join('') || '<p>No rounds played yet.</p>'}
          </div>

          <h3>Правильные ответы</h3>
          <div class="correct-answers-list">
            ${correctLines.length
              ? correctLines.map(x => `<div class="correct-answer-item">${escapeHtml(x.text)}</div>`).join('')
              : '<p>No correct answers yet.</p>'}
          </div>

          <h3>Most often played together with</h3>
          <div class="correct-answers-list">
            ${togetherTop5.length
              ? togetherTop5.map(x => `<div class="correct-answer-item">${escapeHtml(x.name)} — ${x.count}</div>`).join('')
              : '<p>No data yet.</p>'}
          </div>
        </div>
      </div>
    </div>
  `;

  const existingModal = document.getElementById('playerStatsModal');
  if (existingModal) existingModal.remove();

  const modalDiv = document.createElement('div');
  modalDiv.id = 'playerStatsModal';
  modalDiv.innerHTML = statsHtml;
  document.body.appendChild(modalDiv);
}

/**
 * Close player statistics popup
 */
function closePlayerStats() {
  const modal = document.getElementById('playerStatsModal');
  if (modal) modal.remove();
}

// Global ESC key handler for closing modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Close help modal first (highest priority)
    const helpModal = document.getElementById('helpModal');
    if (helpModal && helpModal.style.display !== 'none') {
      closeHelp();
      return;
    }
    
    closePlayerStats();
    closeTeamStats();
    // Ask for confirmation if timer is running or has been started
    if (document.getElementById('questionTimerModal') && hasTimerStarted) {
      if (confirm('Закрыть таймер? Текущий прогресс будет потерян.')) {
        closeQuestionTimer();
      }
    } else {
      closeQuestionTimer();
    }
  }
});

/**
 * Show team statistics popup
 */
function showTeamStats(encodedName) {
  const teamKey = decodeURIComponent(encodedName);

  // New format: encoded captainId
  const captainById = appState.players.find(p => p.isCaptain && p.id === teamKey);
  if (captainById) {
    showTeamStatsByCaptainId(captainById.id);
    return;
  }

  // Legacy format: encoded team name
  const captainByName = appState.players.find(p => p.isCaptain && p.teamName === teamKey);
  if (!captainByName) return;
  showTeamStatsByCaptainId(captainByName.id);
}

function showTeamStatsByCaptainId(captainId) {
  const captain = appState.players.find(p => p.id === captainId);
  if (!captain) return;

  // Collect rounds where this captain's team appears
  const roundsWithTeam = appState.rounds.filter(r =>
    r.teams.some(t => t.captainId === captainId)
  );
  if (roundsWithTeam.length === 0) return;

  const firstTeam = roundsWithTeam[0].teams.find(t => t.captainId === captainId);
  const teamName = (captain.teamName && captain.teamName.trim()) ? captain.teamName.trim() : (firstTeam?.label || 'Team');

  const roundsHtml = roundsWithTeam.map(round => {
    const team = round.teams.find(t => t.captainId === captainId);
    const questionsCount = round.questionsCount || 12;
    const teamQuestions = round.questions[team.id] || [];
    const teamScore = teamQuestions.filter(q => q).length;

    const tableHtml = `
      <table class="mini-round-table">
        <thead>
          <tr>
            <th>Команда</th>
            ${Array.from({length: questionsCount}, (_, i) => `<th>${i + 1}</th>`).join('')}
            <th>Σ</th>
          </tr>
        </thead>
        <tbody>
          ${round.teams.map(t => {
            const q = round.questions[t.id] || [];
            const score = q.filter(x => x).length;
            const isTarget = t.id === team.id;
            return `
              <tr class="${isTarget ? 'player-team-row' : ''}">
                <td class="team-col">${escapeHtml(t.label)}</td>
                ${Array.from({length: questionsCount}, (_, i) => `<td class="q-cell ${q[i] ? 'q-correct' : ''}">${q[i] ? '✓' : ''}</td>`).join('')}
                <td class="score-col"><strong>${score}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    return `
      <div class="round-stat-item">
        <div class="round-stat-header">
          <strong>Раунд ${round.index}</strong>
          <span class="round-stat-summary">Очки команды: ${teamScore}</span>
        </div>
        ${tableHtml}
      </div>
    `;
  }).join('');

  const modalHtml = `
    <div class="modal-overlay" onclick="closeTeamStats()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${escapeHtml(teamName)}</h2>
          <button onclick="closeTeamStats()" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${roundsHtml}
        </div>
      </div>
    </div>
  `;

  const existing = document.getElementById('teamStatsModal');
  if (existing) existing.remove();

  const modalDiv = document.createElement('div');
  modalDiv.id = 'teamStatsModal';
  modalDiv.innerHTML = modalHtml;
  document.body.appendChild(modalDiv);
}

function closeTeamStats() {
  const modal = document.getElementById('teamStatsModal');
  if (modal) modal.remove();
}

/**
 * Update action buttons state
 */
function updateActionButtons() {
  const hasPlayers = appState.players.length > 0;
  const hasCaptains = appState.getCaptains().length > 0;
  const hasActiveRound = appState.currentRoundId !== null;
  const isEditingRound = appState.editingRoundId !== null;
  const hasRounds = appState.rounds.length > 0;
  const isGameMode = appState.isGameMode();

  document.getElementById('generateTeamsBtn').disabled = !hasCaptains || hasActiveRound || isGameMode;
  document.getElementById('reshuffleBtn').disabled = !hasActiveRound || isGameMode;
  
  // Disable/enable start game button
  const startGameBtn = document.getElementById('startGameBtn');
  if (startGameBtn) {
    startGameBtn.disabled = !hasCaptains || isGameMode;
  }
  
  // Show/hide finalize vs save edited buttons
  const finalizeBtn = document.getElementById('finalizeRoundBtn');
  const saveEditedBtn = document.getElementById('saveEditedRoundBtn');
  const cancelEditBtn = document.getElementById('cancelEditRoundBtn');
  
  if (finalizeBtn) {
    finalizeBtn.style.display = hasActiveRound && !isEditingRound ? 'inline-block' : 'none';
    finalizeBtn.disabled = !hasActiveRound;
  }
  
  if (saveEditedBtn && cancelEditBtn) {
    saveEditedBtn.style.display = isEditingRound ? 'inline-block' : 'none';
    cancelEditBtn.style.display = isEditingRound ? 'inline-block' : 'none';
  }
  
  document.getElementById('undoBtn').disabled = !hasRounds || isGameMode;
  document.getElementById('resetGameBtn').disabled = hasRounds === 0;
  document.getElementById('exportBtn').disabled = !hasPlayers;
  
  // Show/hide current round action buttons
  const reshuffleCurrentBtn = document.getElementById('reshuffleCurrentBtn');
  const addUnassignedBtn = document.getElementById('addUnassignedPlayersBtn');
  
  if (reshuffleCurrentBtn) {
    reshuffleCurrentBtn.style.display = (hasActiveRound && !isEditingRound) ? 'inline-block' : 'none';
  }
  
  if (addUnassignedBtn) {
    addUnassignedBtn.style.display = (isGameMode && hasActiveRound && !isEditingRound) ? 'inline-block' : 'none';
  }
  
  const questionTimerBtn = document.getElementById('questionTimerBtn');
  if (questionTimerBtn) {
    questionTimerBtn.style.display = (hasActiveRound && !isEditingRound) ? 'inline-block' : 'none';
  }
}

/**
 * Show warning message
 */
function showWarning(message, type = 'error') {
  const container = document.getElementById('warningContainer');
  const warning = document.createElement('div');
  warning.className = `warning ${type}`;
  warning.textContent = message;
  
  container.appendChild(warning);
  
  setTimeout(() => {
    warning.classList.add('fade-out');
    setTimeout(() => warning.remove(), 300);
  }, 3000);
}

// Event Handlers

function handleAddPlayer() {
  const input = document.getElementById('playerNameInput');
  const isCaptain = document.getElementById('isCaptainCheck').checked;
  const teamNameInput = document.getElementById('teamNameInput');
  const teamColorInput = document.getElementById('teamColorInput');
  const name = input.value.trim();
  const teamName = teamNameInput.value.trim();
  const teamColor = isCaptain ? teamColorInput.value : null;

  if (!name) {
    showWarning('Please enter a player name');
    return;
  }

  // Check for duplicate player name
  if (appState.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    showWarning('A player with this name already exists');
    return;
  }

  // Check for duplicate team name if captain
  if (isCaptain && teamName) {
    if (appState.players.some(p => p.isCaptain && p.teamName && p.teamName.toLowerCase() === teamName.toLowerCase())) {
      showWarning('A team with this name already exists');
      return;
    }
  }

  const player = appState.addPlayer(name, isCaptain, teamName);
  if (isCaptain && teamColor) {
    appState.updatePlayer(player.id, { teamColor });
  }

  // Newest player should appear on top with a small insert animation
  lastAddedPlayerId = player.id;
  animatePlayerInsert = true;
  
  input.value = '';
  teamNameInput.value = '';
  teamColorInput.value = '#3b82f6';
  document.getElementById('isCaptainCheck').checked = false;
  toggleTeamNameInput();
  render();
}

function toggleCaptain(playerId) {
  const player = appState.players.find(p => p.id === playerId);
  if (player) {
    appState.updatePlayer(playerId, { isCaptain: !player.isCaptain });
    render();
  }
}

function toggleActive(playerId) {
  const player = appState.players.find(p => p.id === playerId);
  if (player) {
    appState.updatePlayer(playerId, { active: !player.active });
    render();
  }
}

function deletePlayer(playerId) {
  if (confirm('Delete this player? This cannot be undone.')) {
    appState.deletePlayer(playerId);
    render();
  }
}

function updatePlayerColor(playerId, color) {
  appState.updatePlayer(playerId, { teamColor: color });
  
  // Update all active rounds to use new color
  if (appState.currentRoundId) {
    const round = appState.rounds.find(r => r.id === appState.currentRoundId);
    if (round) {
      round.teams.forEach(team => {
        if (team.captainId === playerId) {
          team.color = color;
        }
      });
    }
  }
  
  // Update game rounds if in game mode
  if (appState.isGameMode()) {
    appState.gameRounds.forEach(round => {
      round.teams.forEach(team => {
        if (team.captainId === playerId) {
          team.color = color;
        }
      });
    });
  }
  
  // Update all finished rounds
  appState.rounds.forEach(round => {
    round.teams.forEach(team => {
      if (team.captainId === playerId) {
        team.color = color;
      }
    });
  });
  
  appState.save();
  render();
}

function pickTeamColor(captainId) {
  const captain = appState.players.find(p => p.id === captainId);
  if (!captain || !captain.isCaptain) return;

  const input = document.createElement('input');
  input.type = 'color';
  input.value = captain.teamColor || '#3b82f6';
  input.style.position = 'fixed';
  input.style.left = '-1000px';
  input.style.top = '-1000px';
  document.body.appendChild(input);

  const cleanup = () => {
    if (input.parentNode) input.parentNode.removeChild(input);
  };

  input.addEventListener('input', () => {
    updatePlayerColor(captainId, input.value);
  });

  input.addEventListener('change', cleanup, { once: true });
  input.addEventListener('blur', cleanup, { once: true });

  input.click();
}

function handleStartGame() {
  const numRounds = parseInt(document.getElementById('gameRoundsInput').value);
  
  if (appState.currentRoundId) {
    if (!confirm('Начало новой игры завершит текущий тур. Продолжить?')) {
      return;
    }
  }
  
  try {
    showWarning('Генерация игры... Это может занять несколько секунд.', 'info');
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        appState.startNewGame(numRounds);
        appState.currentView = 'teams';
        render();
        showWarning(`Игра началась! Сгенерировано ${numRounds} туров с оптимизированными командами.`, 'success');
      } catch (error) {
        showWarning(error.message);
      }
    }, 100);
  } catch (error) {
    showWarning(error.message);
  }
}

function handleGenerateTeams() {
  if (appState.isGameMode()) {
    showWarning('Вы в режиме игры. Команды уже сгенерированы для всех туров.');
    return;
  }
  
  try {
    appState.generateTeams();
    appState.currentView = 'teams'; // Default to team composition view
    render();
    showWarning('Teams generated successfully!', 'success');
  } catch (error) {
    showWarning(error.message);
  }
}

function handleReshuffle() {
  if (appState.isGameMode()) {
    showWarning('Невозможно перемешать команды в режиме игры. Команды оптимизированы для всех туров.');
    return;
  }
  
  try {
    appState.reshuffleCurrentRound();
    render();
    showWarning('Teams reshuffled for maximum variability!', 'success');
  } catch (error) {
    showWarning(error.message);
  }
}

function handleApplyScores() {
  // Scores are now automatically calculated from questions
  // This function is replaced by finalizeRound
  handleFinalizeRound();
}

function handleFinalizeRound() {
  const progress = appState.getGameProgress();
  let confirmMessage = 'Finalize this round? Questions will be converted to scores and locked.';
  
  if (progress) {
    if (progress.isLastRound) {
      confirmMessage = `Завершить последний тур игры (${progress.currentRound}/${progress.totalRounds})? Игра будет завершена.`;
    } else {
      confirmMessage = `Завершить тур ${progress.currentRound}/${progress.totalRounds}? Автоматически начнется следующий тур.`;
    }
  }
  
  if (confirm(confirmMessage)) {
    try {
      appState.finalizeRound();
      render();
      
      if (progress && progress.isLastRound) {
        showWarning('Игра завершена! Все туры сыграны.', 'success');
      } else if (progress) {
        showWarning(`Тур ${progress.currentRound} завершен! Начат тур ${progress.currentRound + 1}.`, 'success');
      } else {
        showWarning('Round finalized!', 'success');
      }
    } catch (error) {
      showWarning(error.message);
    }
  }
}

function handleUndo() {
  if (confirm('Undo last round? This cannot be redone.')) {
    appState.undoLastRound();
    render();
    showWarning('Last round undone', 'info');
  }
}

function handleExport() {
  const data = appState.exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chgk-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showWarning('Data exported successfully!', 'success');
}

function handleImport() {
  document.getElementById('importFile').click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const success = appState.importData(e.target.result);
      if (success) {
        render();
        showWarning('Data imported successfully!', 'success');
      } else {
        showWarning('Failed to import data. Invalid format.');
      }
    } catch (error) {
      showWarning('Error importing data: ' + error.message);
    }
  };
  reader.readAsText(file);
  
  // Reset input
  event.target.value = '';
}

function handleReset() {
  if (confirm('Reset all data? This will delete all players, rounds, and scores. This cannot be undone!')) {
    appState.reset();
    render();
    showWarning('All data reset', 'info');
  }
}

function editPlayerName(playerId) {
  const input = document.getElementById(`playerNameInput-${playerId}`);
  if (input) {
    input.focus();
    input.select();
  }
}

function editTeamName(playerId) {
  const player = appState.players.find(p => p.id === playerId);
  if (!player) return;

  const newName = prompt('Enter team name:', player.teamName || '');
  if (newName !== null) {
    const trimmedName = newName.trim();
    // Check for duplicate team name
    if (trimmedName && appState.players.some(p => p.id !== playerId && p.isCaptain && p.teamName && p.teamName.toLowerCase() === trimmedName.toLowerCase())) {
      showWarning('A team with this name already exists');
      return;
    }
    appState.updatePlayer(playerId, { teamName: trimmedName });
    render();
  }
}

function updateQuestion(teamId, questionIndex, checked) {
  const round = appState.rounds.find(r => r.id === appState.currentRoundId);
  if (!round) return;

  const questions = round.questions[teamId] || [];
  questions[questionIndex] = checked;
  appState.updateTeamQuestions(teamId, questions);
  render();
}

function movePlayerTo(playerId, fromTeamId, toTeamId) {
  if (!toTeamId) return;

  try {
    appState.movePlayer(playerId, fromTeamId, toTeamId);
    render();
    showWarning('Player moved successfully!', 'success');
  } catch (error) {
    showWarning(error.message);
    render(); // Reset select
  }
}

function updateQuestionsPerRound() {
  const input = document.getElementById('questionsPerRoundInput');
  const value = parseInt(input.value) || 12;
  
  if (value < 1 || value > 50) {
    showWarning('Questions per round must be between 1 and 50');
    input.value = appState.settings.questionsPerRound;
    return;
  }

  appState.settings.questionsPerRound = value;
  appState.save();
  showWarning('Settings updated!', 'success');
}

/**
 * Switch between teams and scoring views
 */
function switchView(view) {
  appState.currentView = view;
  appState.save();
  renderCurrentRound();
  updateViewButtons();
}

/**
 * Update view buttons state
 */
function updateViewButtons() {
  const teamsBtn = document.getElementById('viewTeamsBtn');
  const scoringBtn = document.getElementById('viewScoringBtn');
  
  if (teamsBtn && scoringBtn) {
    if (appState.currentView === 'teams') {
      teamsBtn.classList.add('active');
      scoringBtn.classList.remove('active');
    } else {
      teamsBtn.classList.remove('active');
      scoringBtn.classList.add('active');
    }
  }
}

/**
 * Render current round based on view
 */
function renderCurrentRound() {
  if (appState.currentView === 'teams') {
    renderTeamsView();
  } else {
    renderScoringView();
  }
}

/**
 * Render teams view (team composition)
 */
function renderTeamsView() {
  const container = document.getElementById('currentRoundContainer');
  const activeRoundId = appState.currentRoundId || appState.editingRoundId;
  
  if (!activeRoundId) {
    container.innerHTML = '<p class="empty-state">No active round. Generate teams to start.</p>';
    return;
  }

  const round = appState.rounds.find(r => r.id === activeRoundId);
  if (!round) {
    // Try to find the round in gameRounds if in game mode
    if (appState.isGameMode()) {
      const gameRound = appState.gameRounds.find(r => r.id === activeRoundId);
      if (gameRound) {
        appState.ensureRoundQuestionsInitialized(gameRound);
        appState.rounds.push(gameRound);
        // Re-render after adding the round
        render();
        return;
      }
    }
    container.innerHTML = '<p class="empty-state">Round not found.</p>';
    return;
  }

  container.innerHTML = `
    <div class="teams-view">
      ${round.teams.map((team, teamIndex) => {
        const players = team.playerIds
          .map(id => appState.players.find(p => p.id === id))
          .filter(p => p);

        return `
          <div class="team-card ${team.color ? 'team-card-custom' : `team-card-${teamIndex + 1}`}" ${team.color ? `style="--team-color: ${team.color}"` : ''}>
            <div class="team-header" onclick="pickTeamColor('${team.captainId}')" title="Выбрать цвет команды" ${team.color ? `style="background: linear-gradient(135deg, ${team.color}, ${team.color}dd) !important"` : ''}>
              <h3>${escapeHtml(team.label)}</h3>
            </div>
            <div class="team-members">
              ${players.map(player => {
                const allowMove = document.getElementById('allowManualMove')?.checked;
                return `
                  <div class="team-member ${player.id === team.captainId ? 'captain' : ''}">
                    ${escapeHtml(player.name)}
                    ${player.id === team.captainId ? ' 👑' : ''}
                    ${player.id !== team.captainId && appState.currentRoundId && allowMove ? `
                      <select onchange="movePlayerTo('${player.id}', '${team.id}', this.value)" class="move-select">
                        <option value="">Move to...</option>
                        ${round.teams.filter(t => t.id !== team.id).map(t => 
                          `<option value="${t.id}">${escapeHtml(t.label)}</option>`
                        ).join('')}
                      </select>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render scoring view (questions grid)
 */
function renderScoringView() {
  const container = document.getElementById('currentRoundContainer');
  const activeRoundId = appState.currentRoundId || appState.editingRoundId;
  
  if (!activeRoundId) {
    container.innerHTML = '<p class="empty-state">No active round.</p>';
    return;
  }

  const round = appState.rounds.find(r => r.id === activeRoundId);
  if (!round) {
    // Try to find the round in gameRounds if in game mode
    if (appState.isGameMode()) {
      const gameRound = appState.gameRounds.find(r => r.id === activeRoundId);
      if (gameRound) {
        appState.ensureRoundQuestionsInitialized(gameRound);
        appState.rounds.push(gameRound);
        // Re-render after adding the round
        render();
        return;
      }
    }
    container.innerHTML = '<p class="empty-state">Round not found.</p>';
    return;
  }

  const questionsCount = round.questionsCount || 12;
  
  // Calculate running question number offset from previous rounds
  const currentRoundIndex = appState.rounds.findIndex(r => r.id === activeRoundId);
  let questionOffset = 0;
  for (let i = 0; i < currentRoundIndex; i++) {
    questionOffset += appState.rounds[i].questionsCount || 12;
  }

  container.innerHTML = `
    <div class="scoring-view">
      <table class="scoring-table">
        <thead>
          <tr>
            <th>Team</th>
            ${Array.from({length: questionsCount}, (_, i) => 
              `<th class="question-header" onclick="highlightQuestionColumn(${i + 1})">Q${i + 1}<br><small>(${questionOffset + i + 1})</small></th>`
            ).join('')}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${round.teams.map((team, teamIndex) => {
            const questions = round.questions[team.id] || [];
            const score = questions.filter(q => q).length;
            
            return `
              <tr class="${team.color ? '' : `team-row-${teamIndex + 1}`}" ${team.color ? `style="--team-color: ${team.color}; background-color: ${team.color}20;"` : ''}>
                <td class="team-name"><strong>${escapeHtml(team.label)}</strong></td>
                ${Array.from({length: questionsCount}, (_, i) => `
                  <td class="question-cell" data-question="${i + 1}">
                    <input type="checkbox" 
                      data-team="${team.id}" 
                      data-question="${i}"
                      ${questions[i] ? 'checked' : ''}
                      onchange="updateQuestion('${team.id}', ${i}, this.checked)"
                      class="question-checkbox-input">
                  </td>
                `).join('')}
                <td class="score-cell"><strong>${score}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Handle reset game
 */
function handleResetGame() {
  if (confirm('Reset the game? This will remove all rounds but keep players. This cannot be undone!')) {
    appState.resetGame();
    render();
    showWarning('Game reset! All rounds cleared.', 'success');
  }
}

/**
 * Handle save edited round
 */
function handleSaveEditedRound() {
  appState.saveEditedRound();
  render();
  showWarning('Round updated successfully!', 'success');
}

/**
 * Handle cancel edit round
 */
function handleCancelEditRound() {
  appState.cancelEditRound();
  render();
  showWarning('Edit cancelled', 'info');
}

/**
 * Handle settings change
 */
function handleSettingsChange() {
  const questionsInput = document.getElementById('questionsPerRound');
  if (questionsInput) {
    const value = parseInt(questionsInput.value) || 12;
    if (value >= 1 && value <= 50) {
      appState.settings.questionsPerRound = value;
      appState.save();
    }
  }
}

/**
 * Edit round from history
 */
function editRoundFromHistory(roundId) {
  try {
    appState.editRound(roundId);
    render();
    showWarning('Editing round. Make changes and click Save.', 'info');
  } catch (error) {
    showWarning(error.message);
  }
}

/**
 * Toggle team name input visibility
 */
function toggleTeamNameInput() {
  const captainInputs = document.getElementById('captainInputs');
  const isCaptain = document.getElementById('isCaptainCheck').checked;
  
  if (captainInputs) {
    captainInputs.style.display = isCaptain ? 'block' : 'none';
    if (isCaptain) {
      const teamNameInput = document.getElementById('teamNameInput');
      if (teamNameInput) teamNameInput.focus();
    }
  }
}

/**
 * Set game preset configuration
 */
function setGamePreset(rounds, questions) {
  document.getElementById('gameRoundsInput').value = rounds;
  document.getElementById('questionsPerRound').value = questions;
  appState.settings.questionsPerRound = questions;
  appState.settings.gameRounds = rounds;
  appState.save();
  showWarning(`Настройки: ${rounds} туров по ${questions} вопросов`, 'info');
}

function handleAllowManualMoveChange() {
  const allowManualMove = document.getElementById('allowManualMove')?.checked || false;
  appState.uiState.allowManualMove = allowManualMove;
  appState.save();
  render();
}

function handleHideCaptainsChange() {
  const hideCaptains = document.getElementById('hideCaptainsCheck').checked;
  appState.settings.hideCaptains = hideCaptains;
  appState.save();
  renderLeaderboard();
}

function handleReshuffleCurrent() {
  if (!appState.currentRoundId) return;
  
  if (!confirm('Перемешать игроков в текущем туре случайным образом?')) {
    return;
  }
  
  try {
    const round = appState.rounds.find(r => r.id === appState.currentRoundId);
    if (!round) return;
    
    const captains = appState.getCaptains();
    const nonCaptains = appState.getNonCaptains();
    
    // Randomly redistribute non-captains across teams
    const shuffledNonCaptains = shuffle([...nonCaptains]);
    const teamCount = round.teams.length;
    
    // Reset teams to just captains but preserve team properties
    round.teams.forEach(team => {
      const captain = captains.find(c => c.id === team.captainId);
      team.playerIds = [team.captainId];
      // Refresh team label and color from captain
      if (captain) {
        if (captain.teamName) team.label = captain.teamName;
        if (captain.teamColor) team.color = captain.teamColor;
      }
    });
    
    // Distribute non-captains evenly
    shuffledNonCaptains.forEach((player, index) => {
      const teamIndex = index % teamCount;
      round.teams[teamIndex].playerIds.push(player.id);
    });
    
    appState.save();
    render();
    showWarning('Игроки текущего тура перемешаны!', 'success');
  } catch (error) {
    showWarning(error.message);
  }
}

function handleAddUnassignedPlayers() {
  if (!appState.isGameMode()) {
    showWarning('Эта функция доступна только в режиме игры.');
    return;
  }
  
  try {
    // Find all active players
    const activePlayers = appState.getActivePlayers();
    const captains = activePlayers.filter(p => p.isCaptain);
    const nonCaptains = activePlayers.filter(p => !p.isCaptain);
    
    // Check which players are not in any remaining rounds
    const remainingRounds = appState.gameRounds.slice(appState.currentGameRoundIndex);
    const assignedPlayerIds = new Set();
    
    remainingRounds.forEach(round => {
      round.teams.forEach(team => {
        team.playerIds.forEach(id => assignedPlayerIds.add(id));
      });
    });
    
    const unassignedPlayers = nonCaptains.filter(p => !assignedPlayerIds.has(p.id));
    
    if (unassignedPlayers.length === 0) {
      showWarning('Все активные игроки уже назначены.', 'info');
      return;
    }
    
    if (!confirm(`Добавить ${unassignedPlayers.length} неназначенных игроков во все оставшиеся туры?`)) {
      return;
    }
    
    // Add unassigned players to all remaining rounds with random assignment
    remainingRounds.forEach(round => {
      const teamCount = round.teams.length;
      const shuffledPlayers = shuffle([...unassignedPlayers]);
      
      shuffledPlayers.forEach((player, index) => {
        // Use random team assignment instead of round-robin
        const teamIndex = Math.floor(Math.random() * teamCount);
        if (!round.teams[teamIndex].playerIds.includes(player.id)) {
          round.teams[teamIndex].playerIds.push(player.id);
        }
      });
    });
    
    appState.save();
    render();
    showWarning(`Добавлено ${unassignedPlayers.length} игроков в оставшиеся туры!`, 'success');
  } catch (error) {
    showWarning(error.message);
  }
}

// Question Timer functionality
let timerInterval = null;
let timerSeconds = 60.0;
let isTimerRunning = false;
let isSecondPhase = false;
let timerSettings = {
  decimalDigits: 2,
  lastQuestionsShown: 2,
  mainTime: 60,
  additionalTime: 10
};
let hasTimerStarted = false;

function openQuestionTimer() {
  const activeRoundId = appState.currentRoundId || appState.editingRoundId;
  if (!activeRoundId) return;
  
  const round = appState.rounds.find(r => r.id === activeRoundId);
  if (!round) return;
  
  const questionsCount = round.questionsCount || 12;
  
  // Calculate global question number
  const currentRoundIndex = appState.rounds.findIndex(r => r.id === activeRoundId);
  let globalQuestionOffset = 0;
  for (let i = 0; i < currentRoundIndex; i++) {
    globalQuestionOffset += appState.rounds[i].questionsCount || 12;
  }
  
  // Reset to first question or keep current
  if (!appState.currentQuestionNumber || appState.currentQuestionNumber > questionsCount) {
    appState.currentQuestionNumber = 1;
  }
  
  const globalQuestionNumber = globalQuestionOffset + appState.currentQuestionNumber;
  
  timerSeconds = timerSettings.mainTime;
  isSecondPhase = false;
  isTimerRunning = false;
  hasTimerStarted = false;
  
  const modalHtml = `
    <div class="modal-overlay fullscreen-modal" id="questionTimerModal" onclick="event.stopPropagation()">
      <div class="timer-modal-content">
        <button onclick="closeQuestionTimer()" class="timer-close">&times;</button>
        <div class="timer-main-content">
          <h1 class="timer-question-title">Вопрос №<span id="questionNumberDisplay">${globalQuestionNumber}</span></h1>
          <div class="timer-display" id="timerDisplay">${timerSettings.mainTime.toFixed(timerSettings.decimalDigits)}</div>
          <div class="timer-phase-label" id="phaseLabel">Основное время</div>
        </div>
        <div class="timer-controls">
          <button id="startTimerBtn" class="btn btn-success btn-large" onclick="startTimer()">▶ Начать</button>
          <button id="pauseTimerBtn" class="btn btn-warning btn-large" onclick="pauseTimer()" style="display: none;">⏸ Пауза</button>
          <button id="restartTimerBtn" class="btn btn-danger btn-large" onclick="restartTimer()" style="display: none;">↻ Перезапустить</button>
          <button id="nextQuestionBtn" class="btn btn-primary btn-large" onclick="nextQuestionNow()">⏭ Следующий</button>
        </div>
      <div class="timer-settings-panel" id="timerSettingsPanel">
        <h4>Настройки таймера</h4>
        <div class="timer-setting">
          <label>Десятичные знаки:</label>
          <input type="number" id="decimalDigitsSetting" min="0" max="3" value="${timerSettings.decimalDigits}" onchange="updateTimerSetting('decimalDigits', this.value)">
        </div>
        <div class="timer-setting">
          <label>Показать вопросов:</label>
          <input type="number" id="lastQuestionsShownSetting" min="1" max="5" value="${timerSettings.lastQuestionsShown}" onchange="updateTimerSetting('lastQuestionsShown', this.value)">
        </div>
        <div class="timer-setting">
          <label>Основное время (сек):</label>
          <input type="number" id="mainTimeSetting" min="10" max="300" value="${timerSettings.mainTime}" onchange="updateTimerSetting('mainTime', this.value)">
        </div>
        <div class="timer-setting">
          <label>Доп. время (сек):</label>
          <input type="number" id="additionalTimeSetting" min="5" max="60" value="${timerSettings.additionalTime}" onchange="updateTimerSetting('additionalTime', this.value)">
        </div>
      </div>
      <div class="timer-teams-table" id="timerTeamsTable"></div>
    </div>
  `;
  
  const existing = document.getElementById('questionTimerModal');
  if (existing) existing.remove();
  
  const modalDiv = document.createElement('div');
  modalDiv.innerHTML = modalHtml;
  document.body.appendChild(modalDiv.firstElementChild);
  
  // Render teams table
  renderTimerTeamsTable();
}

function renderTimerTeamsTable() {
  const activeRoundId = appState.currentRoundId || appState.editingRoundId;
  if (!activeRoundId) return;
  
  const round = appState.rounds.find(r => r.id === activeRoundId);
  if (!round) return;
  
  const currentQ = appState.currentQuestionNumber || 1;
  const questionsToShow = [];
  
  // Calculate global question offset
  const currentRoundIndex = appState.rounds.findIndex(r => r.id === activeRoundId);
  let globalQuestionOffset = 0;
  for (let i = 0; i < currentRoundIndex; i++) {
    globalQuestionOffset += appState.rounds[i].questionsCount || 12;
  }
  
  // Calculate which questions to show based on settings
  for (let i = Math.max(1, currentQ - timerSettings.lastQuestionsShown + 1); i <= currentQ; i++) {
    questionsToShow.push(i);
  }
  
  const tableContainer = document.getElementById('timerTeamsTable');
  if (!tableContainer) return;
  
  let html = '<table class="mini-teams-table"><thead><tr><th>Команда</th>';
  questionsToShow.forEach(q => {
    const globalQ = globalQuestionOffset + q;
    html += `<th>${globalQ}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  round.teams.forEach(team => {
    const questions = round.questions[team.id] || [];
    html += `<tr><td>${escapeHtml(team.label)}</td>`;
    questionsToShow.forEach(q => {
      const checked = questions[q - 1] ? '✓' : '✗';
      html += `<td class="mini-answer mini-answer-clickable" onclick="toggleTimerQuestion('${team.id}', ${q - 1})">${checked}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  tableContainer.innerHTML = html;
}

function updateTimerSetting(setting, value) {
  const numValue = parseInt(value);
  timerSettings[setting] = numValue;
  
  // Re-render teams table if lastQuestionsShown changed
  if (setting === 'lastQuestionsShown') {
    renderTimerTeamsTable();
  }
  
  // Reset timer if time settings changed while running or paused
  if ((setting === 'mainTime' || setting === 'additionalTime') && hasTimerStarted) {
    restartTimer();
  }
  
  // Update display format if decimalDigits changed
  if (setting === 'decimalDigits') {
    const display = timerSeconds.toFixed(timerSettings.decimalDigits);
    document.getElementById('timerDisplay').textContent = display;
  }
}

function closeQuestionTimer() {
  stopTimer();
  if (window.timerKeyListener) {
    document.removeEventListener('keydown', window.timerKeyListener);
    window.timerKeyListener = null;
  }
  const modal = document.getElementById('questionTimerModal');
  if (modal) modal.remove();
}

function startTimer() {
  if (isTimerRunning) return;
  
  isTimerRunning = true;
  hasTimerStarted = true;
  playBeep(440, 0.1); // Start beep
  
  document.getElementById('startTimerBtn').style.display = 'none';
  document.getElementById('pauseTimerBtn').style.display = 'inline-block';
  document.getElementById('restartTimerBtn').style.display = 'none';
  
  // Add keyboard listener for space bar and enter
  if (!window.timerKeyListener) {
    window.timerKeyListener = function(e) {
      if (!document.getElementById('questionTimerModal')) return;
      
      if (e.code === 'Space') {
        // Don't trigger if user is typing in an input field
        if (e.target.tagName === 'INPUT') return;
        e.preventDefault();
        if (isTimerRunning) {
          pauseTimer();
        } else {
          startTimer();
        }
      } else if (e.code === 'Enter') {
        e.preventDefault();
        nextQuestionNow();
      }
    };
    document.addEventListener('keydown', window.timerKeyListener);
  }
  
  timerInterval = setInterval(() => {
    timerSeconds -= 0.01;
    
    if (timerSeconds <= 0) {
      if (!isSecondPhase) {
        // First phase ended, start second phase
        isSecondPhase = true;
        timerSeconds = timerSettings.additionalTime;
        document.getElementById('phaseLabel').textContent = 'Записывайте ответы';
        document.getElementById('timerDisplay').classList.add('timer-overtime');
      } else {
        // Second phase ended, move to next question
        stopTimer();
        nextQuestion();
        return;
      }
    }
    
    // Update display
    const display = Math.max(0, timerSeconds).toFixed(timerSettings.decimalDigits);
    document.getElementById('timerDisplay').textContent = display;
    
    // Beeps
    if (!isSecondPhase && timerSeconds <= 10.0 && timerSeconds > 9.99) {
      playBeep(440, 0.1);
    } else if (!isSecondPhase && timerSeconds <= 10.0 && Math.floor(timerSeconds * 100) % 100 === 0) {
      playBeep(440, 0.05); // Short beep every second in last 10 seconds
    } else if (isSecondPhase && Math.floor(timerSeconds * 100) % 100 === 0 && timerSeconds > 0) {
      playBeep(880, 0.1); // Louder beep every second in overtime
    }
  }, 10); // Update every 10ms for smooth countdown
}

function pauseTimer() {
  if (!isTimerRunning) return;
  
  stopTimer();
  const startBtn = document.getElementById('startTimerBtn');
  startBtn.innerHTML = '▶ Продолжить';
  startBtn.style.display = 'inline-block';
  document.getElementById('pauseTimerBtn').style.display = 'none';
  document.getElementById('restartTimerBtn').style.display = 'inline-block';
}

function restartTimer() {
  stopTimer();
  timerSeconds = timerSettings.mainTime;
  isSecondPhase = false;
  hasTimerStarted = false;
  const display = timerSettings.mainTime.toFixed(timerSettings.decimalDigits);
  document.getElementById('timerDisplay').textContent = display;
  document.getElementById('timerDisplay').classList.remove('timer-overtime');
  document.getElementById('phaseLabel').textContent = 'Основное время';
  const startBtn = document.getElementById('startTimerBtn');
  startBtn.innerHTML = '▶ Начать';
  startBtn.style.display = 'inline-block';
  document.getElementById('pauseTimerBtn').style.display = 'none';
  document.getElementById('restartTimerBtn').style.display = 'none';
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isTimerRunning = false;
}

function nextQuestion() {
  const activeRoundId = appState.currentRoundId || appState.editingRoundId;
  if (!activeRoundId) return;
  
  const round = appState.rounds.find(r => r.id === activeRoundId);
  if (!round) return;
  
  const questionsCount = round.questionsCount || 12;
  
  appState.currentQuestionNumber++;
  if (appState.currentQuestionNumber > questionsCount) {
    appState.currentQuestionNumber = 1;
  }
  appState.save();
  
  // Reset and reopen timer
  closeQuestionTimer();
  setTimeout(() => openQuestionTimer(), 100);
}

function nextQuestionNow() {
  stopTimer();
  nextQuestion();
}

function toggleTimerQuestion(teamId, questionIndex) {
  const activeRoundId = appState.currentRoundId || appState.editingRoundId;
  if (!activeRoundId) return;
  
  const round = appState.rounds.find(r => r.id === activeRoundId);
  if (!round) return;
  
  if (!round.questions[teamId]) {
    round.questions[teamId] = [];
  }
  
  // Toggle the answer
  round.questions[teamId][questionIndex] = !round.questions[teamId][questionIndex];
  
  appState.save();
  appState.recalculateAllRatings();
  
  // Re-render the teams table
  renderTimerTeamsTable();
  
  // Also update the main UI in background
  render();
}

function playBeep(frequency, duration) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function highlightQuestionColumn(questionIndex) {
  // Remove existing highlights
  document.querySelectorAll('.question-cell, .question-header').forEach(cell => {
    cell.classList.remove('highlighted-question');
  });
  
  // Add highlight to header
  const headers = document.querySelectorAll('.question-header');
  headers.forEach((header, index) => {
    if (index + 1 === questionIndex) {
      header.classList.add('highlighted-question');
    }
  });
  
  // Add highlight to clicked column cells only
  const questionCells = document.querySelectorAll(`.question-cell[data-question="${questionIndex}"]`);
  questionCells.forEach(cell => {
    cell.classList.add('highlighted-question');
  });
  
  // Also update the question number in timer if open
  appState.currentQuestionNumber = questionIndex;
  appState.save();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Help modal functions
function openHelp() {
  document.getElementById('helpModal').style.display = 'flex';
}

function closeHelp() {
  document.getElementById('helpModal').style.display = 'none';
}

// Expose timer functions globally for onclick handlers
window.closeQuestionTimer = closeQuestionTimer;
window.startTimer = startTimer;
window.pauseTimer = pauseTimer;
window.restartTimer = restartTimer;
window.nextQuestionNow = nextQuestionNow;
window.toggleTimerQuestion = toggleTimerQuestion;
window.updateTimerSetting = updateTimerSetting;
window.highlightQuestionColumn = highlightQuestionColumn;
window.openHelp = openHelp;
window.closeHelp = closeHelp;
