# CHGK Tools (Static Web)

A small set of **static HTML tools** for running CHGK-style games:

- **Peremeshka**: players + captains → random teams, scoring, history, export/import.
- **Tournament**: teams-only tournament workflow with per-question scoring and exports.
- **Timer**: fullscreen question timer (60 + 10 style), presets, hotkeys.

Everything runs in the browser (no build step). State is stored in `localStorage`.

Contact: Telegram **@alaudo** — [https://t.me/alaudo](https://t.me/alaudo)

## Quick Start

### 1) Launcher (index.html)

1. Open `index.html` in any modern browser.
2. Choose a tool: **Peremeshka**, **Tournament**, or **Timer**.

Optional (if you prefer a local server):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

### 2) Peremeshka (peremeshki.html) — Quick start

1. Add players. Mark captains — for captains you set a **team name** and **team color**.
2. Set **Questions per round** and **Rounds in game**, then click **Start new game** (or you can work without “Game mode” and just create teams + finish rounds).
3. Click **Create new teams** for the initial draw, then **Reshuffle** to quickly get a new variant.
4. If needed, enable **Allow manual move** and adjust rosters; enable **Hide captains** if captains are “technical”.
5. In **Current round → Scoring**, mark correct answers per question. If everyone can see the screen, use the built‑in **Question timer**.
6. Finish rounds to push them into history; results are recalculated automatically. Use **Export/Import** for backups.

### 3) Tournament (chgk.html) — Quick start

1. Add teams (optionally pick a color to match your paper sheets).
2. Set **Questions per round** and **Rounds in game** (default is **3**, change anytime). If you need more rounds (e.g., a shootout), you can add extra rounds after the main game.
3. If the screen is visible to everyone, open the built‑in **timer**: it moves question-by-question and lets you update scoring from inside.
4. After the game, results are shown in the final table. Tie-breaking uses the accumulated **rating** (based on questions other teams missed).
5. Save/export the game if needed.

### 4) Timer (timer.html) — Quick start

1. Open `timer.html`.
2. Click **Start** to begin the main countdown; it switches into overtime automatically.
3. Use **Previous/Next question** to change the question number.
4. Open **Settings** (⚙) to select presets and tune timings.

Hotkeys (in the in-app timer):

- `Space` — start / pause / resume
- `Enter` — next question
- `Backspace` — previous question

## Features (by tool)

### Peremeshka (Random teams + scoring)

- **Players & captains**: captains define teams; captains have **name + color**.
- **Team generation**: random team building and quick reshuffle.
- **Game mode**: pre-generates a fixed sequence of rounds for the whole game.
- **Manual adjustments**: optional manual moves between teams.
- **Scoring per question**: checkbox grid; totals update live.
- **History & editing**: view finished rounds, edit past rounds and recalculate.
- **Results**: players leaderboard, teams leaderboard, and “who played with whom” draw.
- **Data management**: undo last round, reset rounds, export/import.

### Tournament (Teams-only)

- **Teams-only workflow**: enter teams, play rounds, keep full round history.
- **Absolute question numbering**: convenient for a hosted tournament flow.
- **Timer integration**: timer can be opened while scoring.
- **Editing**: edit finished rounds, automatic recalculation.
- **Exports**: TSV exports for spreadsheets.

### Timer

- Fullscreen question timer.
- Main + overtime phase (CHGK-style).
- Presets and configurable timings.
- Question navigation and hotkeys.

## Project structure

- `styles.css` — shared styles.
- `scripts/` — all JavaScript.
- `img/` — images (icons + help screenshots).

## Data & persistence

- All data is stored locally in the browser via `localStorage`.
- Reloading the page is safe; clearing browser storage will remove the saved game.
- Use export/import buttons (where available) for backups.
