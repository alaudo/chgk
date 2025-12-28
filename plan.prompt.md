# Plan: Random Teams & Ratings SPA

A single-page HTML app with in-browser storage handles player management, captain constraints, round-based team generation, variability-optimized reshuffles, scoring, and an overall leaderboard. Data stays in localStorage for persistence; algorithms minimize repeated teammate pairs across rounds while ensuring at most one captain per team. UI supports adding players, toggling captains/active status, generating teams, recording scores, undoing, and exporting/importing state.

## Steps
1. Scaffold UI and state with index.html, styles.css, app.js, ui.js, algorithms.js, storage.js, README.md; define `AppState`, `Player`, `Team`, `Round`, `Settings`.
2. Implement persistence in storage.js: `loadState()`, `saveStateDebounced()`, `migrateState()`, `exportState()`, `importState(json)`.
3. Build team logic in algorithms.js: `generateTeams(captainIds, nonCaptains, options)`, `computePenaltyMatrix(rounds)`, `reshuffleTeams(teams, nonCaptains, penaltyMatrix, options)`.
4. Add scoring and ratings in app.js: `applyRoundScores(roundId, scores)`, `updateRatings(round)`, `computeLeaderboard(players, rounds)`, plus undo snapshot handling.
5. Create interactive UI in ui.js: `renderPlayers()`, `renderTeams()`, `renderRound(roundId)`, `bindEvents()`, `showWarning(message)`, settings controls and drag‑drop with captain-lock enforcement.
6. Style components in styles.css: grid/flex layout, captain badges, warnings, leaderboard table; document usage in README.md.

## Design Decisions
- Team formation: captain-anchored (number of teams = number of captains).
- Reshuffle algorithm: greedy swap of non-captains only; captains stay fixed.
- Team balancing: distribute non-captains evenly (±1 player variance allowed).

## Data Model
- Players: `id`, `name`, `isCaptain`, `rating`, `history`, `active`.
- Teams: `id`, `label`, `players[]`, `captainId`, `roundId`.
- Rounds: `id`, `index`, `teamIds[]`, `scores{teamId:number}`, `timestamp`.
- App State: `players[]`, `rounds[]`, `currentRoundId`, `settings{teamSize, allowUnevenLastTeam, variabilityWeight, captainConstraintEnabled}`.
- Persistence: localStorage keys `chgk.players`, `chgk.rounds`, `chgk.settings`, `chgk.stateVersion`; save after mutations (debounced), load with migrations.

## Core Algorithms
- Team Assignment (captain-anchored):
  - Partition captains/non-captains; shuffle non-captains.
  - `teamCount = number of captains` (each captain anchors one team).
  - Assign one captain per team.
  - Balance non-captains evenly across teams by round-robin; if uneven, distribute ±1 player per team.
- Variability-Maximizing Reshuffle:
  - Build penalty matrix `P[a][b] = times paired` from history.
  - Keep captains fixed in their teams; reshuffle only non-captain players.
  - Run greedy swaps of non-captains across teams that reduce total intra-team penalty; cap iterations (e.g., 100).
  - Accept swap if it lowers sum of pair penalties within all affected teams.
- Scoring & Ratings:
  - Per round store `scores[teamId]`.
  - Update player rating as aggregate of team scores across rounds (e.g., EWMA), optional bonus for captaining and diversity.
- Leaderboard:
  - Compute overall rating, avg team score, rounds played; sort by rating, then avg score, then participation, then name.

## UI Layout & Interactions
- Header: title, settings (team size/count, variability weight, captain constraint), reset/import/export.
- Players: list with name, captain checkbox, active toggle, rating; add/edit/delete.
- Team Generation: controls to generate; display teams as cards with captain badge; drag-drop with constraint warnings; actions for reshuffle and save round.
- Scoring: per-team inputs for points with quick +1/-1; apply scores.
- Rounds & History: list past rounds with details; undo last round; duplicate setup; export CSV/JSON.
- Leaderboard: table of name, rating, avg score, rounds played, captain count; filter active only.

## Edge Cases
- Uneven non-captain counts: auto-balance ±1 player across captain-led teams.
- No captains: cannot form teams; prompt user to select at least one captain.
- Only captains (no non-captains): each captain forms solo team; warn or allow depending on settings.
- Late joins/leaves: use `active` to include/exclude next rounds; ratings persist.
- Undo: restore from pre-round snapshot.
- Tie-breaking: rating ties → avg score → rounds → name.
- Small groups: form 1 team; warn insufficient size.
- Persistence conflicts: version mismatch → migrate or prompt reset.
- Drag-drop violations: prevent 2nd captain in a team or show warning.

## Testing Checklist
- Add ~10 players, mark 3 captains; generate; verify captain constraint.
- Record scores; ratings update; leaderboard ordering.
- Reshuffle multiple times; observe fewer repeated pairings.
- Toggle captain flags; regenerate; constraints hold.
- Captains > teams; warning flow; demote one; regenerate.
- Odd count (11, teamSize=4) → sizes 4/4/3.
- Mark inactive; regenerate excludes; re-activate includes.
- Undo last round restores ratings and removes round.
- Reload page persists state.
- Export/import JSON preserves schema version.

## Files & Key Symbols
- Files: index.html, styles.css, app.js, storage.js, algorithms.js, ui.js, README.md.
- Data: `Player`, `Team`, `Round`, `AppState`, `Settings`.
- Storage: `loadState()`, `saveStateDebounced()`, `migrateState()`, `exportState()`, `importState(json)`.
- Teams: `generateTeams(captainIds, nonCaptains)`, `reshuffleTeams(teams, nonCaptains, penaltyMatrix)`, `computePenaltyMatrix(rounds)`.
- Scoring/Rating: `applyRoundScores()`, `updateRatings()`, `computeLeaderboard()`.
- UI: `renderPlayers()`, `renderTeams()`, `renderRound()`, `bindEvents()`, `showWarning()`, `setSettings()`, `getSettings()`.
