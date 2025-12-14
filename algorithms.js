// algorithms.js - Team generation and reshuffle logic

/**
 * Generate teams with captain-anchored approach
 * Each captain forms a team, non-captains are balanced across teams
 * @param {Array} captainIds - Array of captain player IDs
 * @param {Array} nonCaptains - Array of non-captain player objects
 * @param {Object} options - Options (allowUnevenTeams)
 * @returns {Array} Array of team objects
 */
function generateTeams(captainIds, nonCaptains, options = {}) {
  if (!captainIds || captainIds.length === 0) {
    throw new Error('At least one captain is required to form teams');
  }

  const teamCount = captainIds.length;
  const shuffledNonCaptains = shuffle([...nonCaptains]);
  
  // Initialize teams with captains
  const teams = captainIds.map((captainId, index) => ({
    id: `team-${Date.now()}-${index}`,
    label: `Team ${index + 1}`,
    captainId: captainId,
    playerIds: [captainId]
  }));

  // Distribute non-captains evenly across teams
  shuffledNonCaptains.forEach((player, index) => {
    const teamIndex = index % teamCount;
    teams[teamIndex].playerIds.push(player.id);
  });

  return teams;
}

/**
 * Compute penalty matrix for player pairings
 * Higher penalty = played together more often
 * @param {Array} rounds - Array of round objects with teams
 * @param {Array} allPlayerIds - All player IDs to include in matrix
 * @returns {Object} Map of playerId -> playerId -> count
 */
function computePenaltyMatrix(rounds, allPlayerIds) {
  const matrix = {};
  
  // Initialize matrix
  allPlayerIds.forEach(id => {
    matrix[id] = {};
    allPlayerIds.forEach(otherId => {
      matrix[id][otherId] = 0;
    });
  });

  // Count pairings across all rounds
  rounds.forEach(round => {
    round.teams.forEach(team => {
      const playerIds = team.playerIds || [];
      
      // For each pair in the team
      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          const id1 = playerIds[i];
          const id2 = playerIds[j];
          
          if (matrix[id1] && matrix[id2]) {
            matrix[id1][id2] = (matrix[id1][id2] || 0) + 1;
            matrix[id2][id1] = (matrix[id2][id1] || 0) + 1;
          }
        }
      }
    });
  });

  return matrix;
}

/**
 * Calculate total penalty for current team configuration
 * @param {Array} teams - Array of team objects
 * @param {Object} penaltyMatrix - Penalty matrix from computePenaltyMatrix
 * @returns {number} Total penalty score
 */
function calculateTotalPenalty(teams, penaltyMatrix) {
  let totalPenalty = 0;

  teams.forEach(team => {
    const playerIds = team.playerIds || [];
    
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const id1 = playerIds[i];
        const id2 = playerIds[j];
        
        if (penaltyMatrix[id1] && penaltyMatrix[id1][id2] !== undefined) {
          totalPenalty += penaltyMatrix[id1][id2];
        }
      }
    }
  });

  return totalPenalty;
}

/**
 * Reshuffle teams to maximize variability (minimize repeated pairings)
 * Captains stay fixed, only non-captains are swapped
 * @param {Array} teams - Current teams with captains fixed
 * @param {Array} nonCaptains - Non-captain player objects
 * @param {Object} penaltyMatrix - Penalty matrix from computePenaltyMatrix
 * @param {Object} options - Options (maxIterations, variabilityWeight)
 * @returns {Array} Reshuffled teams
 */
function reshuffleTeams(teams, nonCaptains, penaltyMatrix, options = {}) {
  const maxIterations = options.maxIterations || 100;
  
  // Create working copy of teams
  const workingTeams = teams.map(team => ({
    ...team,
    playerIds: [...team.playerIds]
  }));

  let currentPenalty = calculateTotalPenalty(workingTeams, penaltyMatrix);
  let improved = true;
  let iterations = 0;

  // Greedy swap algorithm
  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    // Try swapping non-captains between all team pairs
    for (let i = 0; i < workingTeams.length; i++) {
      for (let j = i + 1; j < workingTeams.length; j++) {
        const team1 = workingTeams[i];
        const team2 = workingTeams[j];

        // Get non-captain positions in each team
        const team1NonCaptains = team1.playerIds
          .map((id, idx) => ({ id, idx }))
          .filter(p => p.id !== team1.captainId);
        
        const team2NonCaptains = team2.playerIds
          .map((id, idx) => ({ id, idx }))
          .filter(p => p.id !== team2.captainId);

        // Try all swap combinations
        for (const p1 of team1NonCaptains) {
          for (const p2 of team2NonCaptains) {
            // Swap
            const temp = team1.playerIds[p1.idx];
            team1.playerIds[p1.idx] = team2.playerIds[p2.idx];
            team2.playerIds[p2.idx] = temp;

            // Check if penalty improved
            const newPenalty = calculateTotalPenalty(workingTeams, penaltyMatrix);
            
            if (newPenalty < currentPenalty) {
              currentPenalty = newPenalty;
              improved = true;
              // Keep the swap
              break;
            } else {
              // Revert swap
              team2.playerIds[p2.idx] = team1.playerIds[p1.idx];
              team1.playerIds[p1.idx] = temp;
            }
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (improved) break;
    }
  }

  console.log(`Reshuffle completed in ${iterations} iterations. Penalty: ${currentPenalty}`);
  
  return workingTeams;
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calculate total pairings across all rounds
 * @param {Array} allRounds - Array of round objects with teams
 * @returns {number} Total number of repeated pairings
 */
function calculateTotalPairings(allRounds) {
  const pairCounts = {};
  
  allRounds.forEach(round => {
    round.teams.forEach(team => {
      const playerIds = team.playerIds || [];
      
      // Count each pair in this team
      for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
          const id1 = playerIds[i];
          const id2 = playerIds[j];
          const pairKey = id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
          
          pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
        }
      }
    });
  });
  
  // Calculate penalty: sum of squares of pair counts (penalizes repeated pairings heavily)
  let totalPenalty = 0;
  Object.values(pairCounts).forEach(count => {
    if (count > 1) {
      totalPenalty += (count - 1) * (count - 1);
    }
  });
  
  return totalPenalty;
}

/**
 * Generate all teams for multiple rounds using simulated annealing
 * Minimizes repeated pairings across all rounds
 * @param {number} numRounds - Number of rounds to generate
 * @param {Array} captainIds - Array of captain player IDs
 * @param {Array} nonCaptains - Array of non-captain player objects
 * @param {Object} options - Options (questionsPerRound, maxIterations, initialTemp, coolingRate)
 * @returns {Array} Array of round objects with optimized teams
 */
function generateGameRounds(numRounds, captainIds, nonCaptains, options = {}) {
  if (!captainIds || captainIds.length === 0) {
    throw new Error('At least one captain is required to form teams');
  }
  
  if (numRounds < 1) {
    throw new Error('Must have at least one round');
  }
  
  const maxIterations = options.maxIterations || 10000;
  const initialTemp = options.initialTemp || 100;
  const coolingRate = options.coolingRate || 0.95;
  const questionsPerRound = options.questionsPerRound || 12;
  const teamCount = captainIds.length;
  
  console.log(`Generating ${numRounds} rounds with simulated annealing...`);
  
  // Generate initial random solution
  let currentRounds = [];
  for (let r = 0; r < numRounds; r++) {
    const shuffledNonCaptains = shuffle([...nonCaptains]);
    
    // Initialize teams with captains
    const teams = captainIds.map((captainId, index) => ({
      id: `team-${r}-${index}`,
      label: `Team ${index + 1}`,
      captainId: captainId,
      playerIds: [captainId]
    }));
    
    // Distribute non-captains evenly
    shuffledNonCaptains.forEach((player, index) => {
      const teamIndex = index % teamCount;
      teams[teamIndex].playerIds.push(player.id);
    });
    
    currentRounds.push({
      teams: teams,
      roundIndex: r
    });
  }
  
  let currentEnergy = calculateTotalPairings(currentRounds);
  let bestRounds = JSON.parse(JSON.stringify(currentRounds));
  let bestEnergy = currentEnergy;
  
  let temperature = initialTemp;
  let improvements = 0;
  
  // Simulated annealing
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Try a random swap of non-captains between two teams in THE SAME round
    const roundIdx = Math.floor(Math.random() * numRounds);
    const round = currentRounds[roundIdx];
    
    // Pick two different teams in this round
    const team1Idx = Math.floor(Math.random() * teamCount);
    let team2Idx = Math.floor(Math.random() * teamCount);
    
    // Ensure we pick different teams
    if (team1Idx === team2Idx) {
      team2Idx = (team2Idx + 1) % teamCount;
    }
    
    const team1 = round.teams[team1Idx];
    const team2 = round.teams[team2Idx];
    
    // Get non-captain players from each team
    const team1NonCaptains = team1.playerIds.filter(id => id !== team1.captainId);
    const team2NonCaptains = team2.playerIds.filter(id => id !== team2.captainId);
    
    if (team1NonCaptains.length === 0 || team2NonCaptains.length === 0) {
      continue;
    }
    
    // Pick random non-captains to swap
    const player1Idx = Math.floor(Math.random() * team1NonCaptains.length);
    const player2Idx = Math.floor(Math.random() * team2NonCaptains.length);
    
    const player1Id = team1NonCaptains[player1Idx];
    const player2Id = team2NonCaptains[player2Idx];
    
    // Perform swap
    const player1FullIdx = team1.playerIds.indexOf(player1Id);
    const player2FullIdx = team2.playerIds.indexOf(player2Id);
    
    team1.playerIds[player1FullIdx] = player2Id;
    team2.playerIds[player2FullIdx] = player1Id;
    
    // Calculate new energy
    const newEnergy = calculateTotalPairings(currentRounds);
    const deltaE = newEnergy - currentEnergy;
    
    // Accept or reject
    if (deltaE < 0 || Math.random() < Math.exp(-deltaE / temperature)) {
      // Accept
      currentEnergy = newEnergy;
      
      if (currentEnergy < bestEnergy) {
        bestRounds = JSON.parse(JSON.stringify(currentRounds));
        bestEnergy = currentEnergy;
        improvements++;
      }
    } else {
      // Reject - revert swap
      team1.playerIds[player1FullIdx] = player1Id;
      team2.playerIds[player2FullIdx] = player2Id;
    }
    
    // Cool down
    temperature *= coolingRate;
    
    // Progress logging
    if (iteration % 1000 === 0 && iteration > 0) {
      console.log(`Iteration ${iteration}: Best energy = ${bestEnergy}, Current temp = ${temperature.toFixed(2)}`);
    }
  }
  
  console.log(`Annealing complete! Best energy: ${bestEnergy}, Improvements: ${improvements}`);
  
  // Convert to full round objects
  const finalRounds = bestRounds.map((roundData, index) => {
    const round = {
      id: `round-${Date.now()}-${index}`,
      index: index + 1,
      timestamp: Date.now() + index,
      teams: roundData.teams,
      scores: {},
      questions: {},
      questionsCount: questionsPerRound
    };
    
    // Initialize questions grid
    round.teams.forEach(team => {
      round.questions[team.id] = Array(questionsPerRound).fill(false);
    });
    
    return round;
  });
  
  return finalRounds;
}
