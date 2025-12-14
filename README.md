# Team Shuffle & Ratings

A single-page HTML application for managing random team assignments with captain-anchored balancing, intelligent reshuffling for maximum variability, and comprehensive player ratings.

## Features

### 🎯 Captain-Anchored Team Formation
- Each captain forms the core of a team with a custom team name
- Number of teams = number of captains
- Non-captain players are automatically balanced across teams
- Teams are always distributed as evenly as possible (±1 player variance)
- Manual player movement between teams during round setup

### 🔄 Intelligent Reshuffling
- Reshuffle teams to minimize repeated pairings between rounds
- Uses penalty matrix to track player combinations
- Greedy swap algorithm optimizes for maximum variability
- Captains remain fixed during reshuffles

### 📊 Comprehensive Scoring System
- Question-based scoring with configurable questions per round (1-50)
- Checkbox interface for marking correct answers
- Team-based scoring where all members (including captain) receive the team's score
- **New Rating Formula**: For each question a player answered correctly, they earn points equal to the number of players in OTHER teams who answered incorrectly
- Tracks total score, correct answers, rounds played, and captain rounds
- Persistent leaderboar & Management
- Automatic localStorage saves (debounced for performance)
- Export/import functionality for data backup and sharing (includes all players and round statistics)
- Schema versioning with automatic migrations
- Undo last round functionality
- Edit past rounds (temporarily edit scores, save changes back)
- Reset game (clear all rounds but keep players)
- Reset all (clear everything)(debounced for performance)
- Export/import functionality for data backup and sharing
- Schema versioning with automatic migrations
- Undo last round functionality

## Usage

### Getting Started

1. **Open the Application**
   - When captain is selected, enter a team name (e.g., "Red Team", "Alpha Squad")
   - Open `index.html` in any modern web browser
   - No server or installation required

2. **Add Players**
   - Enter player names in the input field
   - Configure Settings**
   - Set "Questions per Round" (default: 12, range: 1-50)
   - This determines how many questions will be in each round

4. **Manage Players**
   - 👑/👤 button: Toggle captain status
   - ✏️ button (captains only): Edit team name
   - You need at least one captain to generate teams

3. **Manage Players** with their custom team name
   - Non-captains are distributed evenly across teams
   - View switches to "Team Composition" showing team members

2. **Manual Adjustments**
   - In "Team Composition" view, use dropdown menus to move non-captain players between teams
   - Captains cannot be moved from their teams
   - Cannot move a captain to another team (maintaining one captain per team)

3  - × button: Delete player permanently

### Generating Teams

1. **Initial Generation**
   - Switch to Scoring View**
   - Click "Scoring" button to see the questions grid
   - Table shows teams as rows, questions as columns

2. **Mark Correct Answers**
   - Check boxes for questions each team answered correctly
   - Scores are calculated automatically (count of checked boxes)
   - Real-time score totals displayed

3. **Alternative: Team Composition View**
   - Shows full team member lists
   - Useful for verifying team compositions before finalizing

4. **Finalize Round**
   - Click "Finalize Round" to lock the scores
   - All team members receive the team's score
   -**Rating Formula**: Sum of (for each question answered correctly, count of players in OTHER teams who answered incorrectly)
  - Also displays: Total Score, Correct Answers, Rounds Played, Captain Rounds
  - Tie-breaking: Rating → Correct Answers → Rounds Played → Name
  
- **Rounds History**: View all completed rounds with team compositions and scores
  - Click "Edit" on any past round to modify scores
  - Changes are saved and ratings recalculated automatically
   - Scores can be any non-negative integer (players, rounds, question history, statistics)
- **Import**: Upload previously exported JSON file to restore complete state
- **Undo Last Round**: Remove the most recent round
- **Reset Game**: Clear all rounds but keep players (start new game with same players)
- **Reset All**: Clear all data and start fresh (removes players and rounds)
   - All team members receive the team's score
   - Player ratings are automatically updated

3. **Finalize Round**
   - Click "Finalize Round" to lock the scores
   - This clears the active round to prepare for the next one

### Viewing Results

- **Leaderboard**: Shows all players sorted by rating
  - Rating = Total Score / Rounds Played
  - Tie-breaking: Rating → Avg Score → Rounds Played → Name
  
- **Rounds History**: View all completed rounds with team compositions and scores

### Data Management

- **Export**: Download JSON file with all data
- **Import**: Upload previously exported JSON file
- **Undo Last Round**: Remove the most recent round (only if not finalized)
- **Reset All**: Clear all data and start fresh

## Algorithm Details

### Team Generation Algorithm

```
**New Formula (Question-Based):**

```
For each question a player answered correctly:
  Count = number of players in OTHER teams who answered it incorrectly
  Rating += Count

Player Rating = Sum of all such counts across all questions
```

**Example:**
- Round has 3 teams with 4 players each (12 total players)
- Player A's team answers Question 1 correctly
- Teams B and C answer Question 1 incorrectly
- Player A earns 8 points (4 players in Team B + 4 players in Team C)

This rewards players for:
1. Answering questions that other teams struggled with
2. Being on teams that perform better than competitors
3. Accumulating knowledge over multiple rounds

**Traditional Metrics Also Tracked:**
- Total Score = Sum of all team scores the player was part of
- Rounds Played = Number of rounds participated in
- Correct Answers = Total questions answered correctly across all rounds
### Reshuffle Algorithm (Greedy Swap)

```
1. Build penalty matrix P[i][j] = times players i and j were teammates
2. Calculate current total penalty (sum of all intra-team penalties)
3. For up to 100 iterations:
   a. Try swapping each pair of non-captains between different teams
   b. If swap reduces total penalty, accept it and continue
   c. If no improvement found, terminate
4. Return optimized teams
```

### Rating Calculation

```
Player Rating = Total Score Accumulated / Rounds Played
```

Where:
- Total Score = Sum of all team scores the player was part of
- Rounds Played = Number of rounds the player participated in

## Technical Details

### Files Structure

- `index.html` - Main HTML structure
- `styles.css` - Styling and responsive design
- `storage.js` - localStorage persistence with debouncing
- `algorithms.js` - Team generation and reshuffle logic
- `app.js` - Application state management
- `ui.js` - UI rendering and event handling

### Data Model

**Player Object:**
```javascript
{
  id: string,
  name: string,
  isCaptain: boolean,
  rating: number,
  active: boolean,
  roundsPlayed: number,
  totalScore: number
}
```

**Team Object:**
```javascript
{
  id: string,
  label: string,
  captainId: string,
  playerIds: string[]
}
```

**Round Object:**
```javascript
{
  id: string,
  index: number,
  timestamp: number,
  teams: Team[],
  scores: { [teamId]: number }
}
```

### localStorage Keys

- `chgk.players` - Player data
- `chgk.rounds` - Round history
- `chgk.settings` - Application settings
- `chgk.stateVersion` - Schema version for migrations

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Opera: ✅ Full support
- IE11: ❌ Not supported

## Testing Checklist

### Basic Functionality
- [ ] Add players with various names
- [ ] Mark some players as captains
- [ ] Generate teams (verify one captain per team)
- [ ] Toggle captain status and regenerate
- [ ] Mark player inactive and verify exclusion

### Scoring & Ratings
- [ ] Apply scores to teams
- [ ] Verify all team members receive team score
- [ ] Check leaderboard updates correctly
- [ ] Verify rating calculation (total/rounds)
- [ ] Test tie-breaking in leaderboard

### Reshuffling
- [ ] Complete multiple rounds with same players
- [ ] Reshuffle and observe different pairings
- [ ] Verify captains stay in their teams
- [ ] Check penalty reduction in console logs

### Edge Cases
- [ ] Try generating with no captains (should fail)
- [ ] Test with only captains (solo teams)
- [ ] Odd number of non-captains (verify ±1 balance)
- [ ] Delete player with history (ratings persist)
- [ ] Undo last round

### Data Persistence
- [ ] Reload page (verify data restored)
- [ ] Export data to JSON
- [ ] Import exported data
- [ ] Reset all data

## Sample Test Data

**Players:**
- Alice (Captain), Bob, Carol, Dave (Captain), Eve, Frank, Grace (Captain), Heidi, Ivan, Judy

**Expected Team Count:** 3 (based on 3 captains)

**Sample Scenario:**
1. Generate teams → 3 teams with 3-4 players each
2. Round 1 scores: Team 1 = 8, Team 2 = 6, Team 3 = 4
3. Finalize round
4. Reshuffle → New pairings minimizing repeat teammates
5. Round 2 scores: Team 1 = 5, Team 2 = 7, Team 3 = 6
6. Check leaderboard for accurate ratings

## License

Free to use and modify. No warranty provided.

## Version

1.0 - December 2025
