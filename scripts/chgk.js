// chgk.js - Teams-only CHGK rounds (no players/shuffling)

(function () {
  const STORAGE_KEY = "chgk.teamsOnly.v1";
  const SHARED_QUESTION_KEY = "chgk.sharedQuestionNumber.v1";

  const defaultState = () => ({
    teams: [],
    settings: {
      questionsPerRound: 12,
      gameRounds: 3,
    },
    game: null, // { id, totalRounds }
    currentRound: null,
    completedRounds: [],
    editingRoundId: null,
    suspendedRoundState: null,
    undoSnapshot: null,
    ui: {
      currentView: "scoring",
    },
    // Timer state
    currentQuestionNumber: 1,
  });

  let state = defaultState();
  let saveTimer = null;

  function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
  }

  function hslToHex(h, s, l) {
    const hh = ((h % 360) + 360) % 360;
    const ss = Math.max(0, Math.min(100, s)) / 100;
    const ll = Math.max(0, Math.min(100, l)) / 100;

    const c = (1 - Math.abs(2 * ll - 1)) * ss;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = ll - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (hh < 60) {
      r = c;
      g = x;
    } else if (hh < 120) {
      r = x;
      g = c;
    } else if (hh < 180) {
      g = c;
      b = x;
    } else if (hh < 240) {
      g = x;
      b = c;
    } else if (hh < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    const toHex = (v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function pickDistinctColor(existingColors, seed = Date.now()) {
    const existing = new Set(
      (existingColors || []).filter(Boolean).map((c) => String(c).toLowerCase())
    );
    const baseHue = (seed * 0.61803398875 * 360) % 360;
    for (let i = 0; i < 24; i++) {
      const hue = (baseHue + i * 29) % 360;
      const candidate = hslToHex(hue, 78, 52);
      if (!existing.has(candidate.toLowerCase())) return candidate;
    }
    return hslToHex(baseHue, 78, 52);
  }

  function parseSharedQuestionValue(raw) {
    try {
      const parsed = JSON.parse(raw);
      const q = parseInt(parsed?.q, 10);
      if (Number.isFinite(q) && q >= 1) return q;
    } catch (e) {
      // ignore
    }
    const fallback = parseInt(raw, 10);
    return Number.isFinite(fallback) && fallback >= 1 ? fallback : null;
  }

  function publishSharedQuestion(absQuestionNumber) {
    const q = parseInt(absQuestionNumber, 10);
    if (!Number.isFinite(q) || q < 1) return;
    try {
      localStorage.setItem(
        SHARED_QUESTION_KEY,
        JSON.stringify({ q, ts: Date.now() })
      );
    } catch (e) {
      // ignore
    }
  }

  function showWarning(message, type = "error") {
    const container = document.getElementById("warningContainer");
    if (!container) return;
    const warning = document.createElement("div");
    warning.className = `warning ${type}`;
    warning.textContent = message;

    container.appendChild(warning);

    setTimeout(() => {
      warning.classList.add("fade-out");
      setTimeout(() => warning.remove(), 300);
    }, 3000);
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveImmediate(), 300);
  }

  function saveImmediate() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      state = {
        ...defaultState(),
        ...parsed,
        settings: {
          ...defaultState().settings,
          ...(parsed.settings || {}),
        },
        ui: {
          ...defaultState().ui,
          ...(parsed.ui || {}),
        },
      };
      if (!Array.isArray(state.teams)) state.teams = [];
      if (!Array.isArray(state.completedRounds)) state.completedRounds = [];
      if (state.game && typeof state.game !== "object") state.game = null;
    } catch (e) {
      // ignore
    }
  }

  function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function getCompletedRoundById(roundId) {
    return (state.completedRounds || []).find((r) => r.id === roundId) || null;
  }

  function isEditingRound() {
    return !!state.editingRoundId;
  }

  function isGameMode() {
    return !!(state.game && state.game.id && state.game.totalRounds);
  }

  function getGameProgress() {
    if (!isGameMode()) return null;
    const totalRounds = state.game.totalRounds;
    const completed = (state.completedRounds || []).length;
    const current = state.currentRound ? completed + 1 : completed;
    return {
      totalRounds,
      currentRound: Math.min(Math.max(current, 0), totalRounds),
      isLastRound: current >= totalRounds,
    };
  }

  function buildTeamSnapshot(teamIds) {
    const snap = {};
    (teamIds || []).forEach((teamId) => {
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) return;
      snap[teamId] = { name: team.name, color: team.color };
    });
    return snap;
  }

  function getTeamDisplay(teamId, round) {
    const snap = round?.teamSnapshot?.[teamId];
    if (snap && snap.name) {
      return { name: snap.name, color: snap.color || "#3b82f6" };
    }
    const team = state.teams.find((t) => t.id === teamId);
    if (team) return { name: team.name, color: team.color || "#3b82f6" };
    return { name: "Команда", color: "#3b82f6" };
  }

  // Rating = for each correct answer, count of OTHER teams that got it wrong.
  function computeRoundRatings(round) {
    const ratings = {};
    const teamIds = round.teamIds || [];
    const questionsCount = round.questionsCount || 12;

    teamIds.forEach((teamId) => {
      ratings[teamId] = 0;
      const teamQuestions = (round.questions?.[teamId] || []).slice(
        0,
        questionsCount
      );
      for (let qIdx = 0; qIdx < questionsCount; qIdx++) {
        if (!teamQuestions[qIdx]) continue;

        let incorrectOthers = 0;
        teamIds.forEach((otherId) => {
          if (otherId === teamId) return;
          const otherQuestions = (round.questions?.[otherId] || []).slice(
            0,
            questionsCount
          );
          if (!otherQuestions[qIdx]) incorrectOthers += 1;
        });
        ratings[teamId] += incorrectOthers;
      }
    });

    return ratings;
  }

  function getRoundQuestionBase(round) {
    const idx = round?.index || 1;
    const cnt = round?.questionsCount || state.settings.questionsPerRound || 12;
    return (Math.max(1, idx) - 1) * cnt;
  }

  function toAbsoluteQuestionNumber(round, localQuestionNumber) {
    const base = getRoundQuestionBase(round);
    const local = Math.max(1, parseInt(localQuestionNumber, 10) || 1);
    return base + local;
  }

  function toLocalQuestionNumber(round, absoluteQuestionNumber) {
    const base = getRoundQuestionBase(round);
    const abs = Math.max(
      base + 1,
      parseInt(absoluteQuestionNumber, 10) || base + 1
    );
    return abs - base;
  }

  function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.classList.toggle("collapsed");
    const btn = section.querySelector(".collapse-btn");
    if (btn)
      btn.textContent = section.classList.contains("collapsed") ? "+" : "−";
  }

  // Team management
  function addTeam() {
    const input = document.getElementById("teamNameInput");
    const colorInput = document.getElementById("teamColorInput");
    const name = (input?.value || "").trim();
    const userPicked = colorInput?.dataset?.userSelected === "true";
    const existingColors = (state.teams || [])
      .map((t) => t.color)
      .filter(Boolean);
    const color =
      (userPicked
        ? colorInput?.value || ""
        : pickDistinctColor(existingColors)
      ).trim() || pickDistinctColor(existingColors);

    if (!name) {
      showWarning("Введите название команды");
      return;
    }

    const nameLower = name.toLowerCase();
    if (
      state.teams.some((t) => (t.name || "").trim().toLowerCase() === nameLower)
    ) {
      showWarning("Команда с таким названием уже существует");
      return;
    }

    state.teams.push({
      id: generateId("team"),
      name,
      color,
      active: true,
    });

    if (input) input.value = "";
    if (colorInput) {
      const updatedColors = (state.teams || [])
        .map((t) => t.color)
        .filter(Boolean);
      colorInput.value = pickDistinctColor(updatedColors);
      colorInput.dataset.userSelected = "false";
    }

    scheduleSave();
    render();
  }

  function updateTeamName(teamId, newValue) {
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return;

    const newName = (newValue || "").trim();
    if (!newName) {
      showWarning("Название команды не может быть пустым");
      render();
      return;
    }

    const newNameLower = newName.toLowerCase();
    if (
      state.teams.some(
        (t) =>
          t.id !== teamId &&
          (t.name || "").trim().toLowerCase() === newNameLower
      )
    ) {
      showWarning("Команда с таким названием уже существует");
      render();
      return;
    }

    team.name = newName;
    scheduleSave();
    render();
  }

  function updateTeamColor(teamId, color) {
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return;
    team.color = color || team.color || "#3b82f6";
    scheduleSave();
    render();
  }

  function toggleTeamActive(teamId) {
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return;
    team.active = !team.active;
    scheduleSave();
    render();
  }

  function deleteTeam(teamId) {
    if (!confirm("Удалить эту команду?")) return;
    state.teams = state.teams.filter((t) => t.id !== teamId);

    // If current round contains this team, reset round.
    if (state.currentRound && state.currentRound.teamIds?.includes(teamId)) {
      state.currentRound = null;
    }

    scheduleSave();
    render();
  }

  // Rounds
  function getActiveTeams() {
    return state.teams.filter((t) => t.active);
  }

  function ensureQuestionsPerRoundFromUI() {
    const input = document.getElementById("questionsPerRound");
    const value = parseInt(input?.value, 10);
    if (Number.isFinite(value) && value >= 1 && value <= 50) {
      state.settings.questionsPerRound = value;
      scheduleSave();
    } else if (input) {
      input.value = String(state.settings.questionsPerRound || 12);
    }
  }

  function ensureGameRoundsFromUI() {
    const input = document.getElementById("gameRoundsInput");
    const value = parseInt(input?.value, 10);
    if (Number.isFinite(value) && value >= 1 && value <= 50) {
      state.settings.gameRounds = value;
      scheduleSave();
    } else if (input) {
      input.value = String(state.settings.gameRounds || 3);
    }
  }

  function startGame() {
    if (isEditingRound()) {
      showWarning("Сначала завершите редактирование тура");
      return;
    }

    ensureQuestionsPerRoundFromUI();
    ensureGameRoundsFromUI();

    const activeTeams = getActiveTeams();
    if (activeTeams.length < 2) {
      showWarning("Нужно минимум 2 активные команды, чтобы начать игру");
      return;
    }

    const totalRounds = state.settings.gameRounds || 3;
    if (totalRounds < 1 || totalRounds > 50) {
      showWarning("Туров в игре должно быть от 1 до 50");
      return;
    }

    // Reset rounds but keep teams
    state.completedRounds = [];
    state.currentRound = null;
    state.currentQuestionNumber = 1;
    state.game = { id: generateId("game"), totalRounds };

    scheduleSave();
    render();
    showWarning(
      `Игра начата: ${totalRounds} туров × ${
        state.settings.questionsPerRound || 12
      } вопросов`,
      "success"
    );

    startRound();
  }

  function startRound() {
    if (isEditingRound()) {
      showWarning("Сначала завершите редактирование тура");
      return;
    }

    ensureQuestionsPerRoundFromUI();

    const activeTeams = getActiveTeams();
    if (activeTeams.length < 2) {
      showWarning("Нужно минимум 2 активные команды, чтобы начать тур");
      return;
    }

    if (isGameMode()) {
      const progress = getGameProgress();
      if (
        progress &&
        (state.completedRounds || []).length >= progress.totalRounds
      ) {
        showWarning("Игра уже завершена. Начните новую игру.", "info");
        return;
      }
    }

    const nextIndex = (state.completedRounds.length || 0) + 1;
    const questionsCount = state.settings.questionsPerRound || 12;

    const questions = {};
    activeTeams.forEach((t) => {
      questions[t.id] = Array(questionsCount).fill(false);
    });

    const teamIds = activeTeams.map((t) => t.id);

    state.currentRound = {
      id: generateId("round"),
      index: nextIndex,
      timestamp: null,
      teamIds,
      questionsCount,
      questions,
      teamSnapshot: buildTeamSnapshot(teamIds),
    };

    state.currentQuestionNumber = 1;

    scheduleSave();
    render();
  }

  function finalizeRound() {
    if (!state.currentRound) return;

    if (isEditingRound()) {
      showWarning("Сначала сохраните или отмените редактирование", "info");
      return;
    }

    const round = state.currentRound;
    const scores = {};
    round.teamIds.forEach((teamId) => {
      const q = round.questions?.[teamId] || [];
      scores[teamId] = q.filter(Boolean).length;
    });

    const ratings = computeRoundRatings(round);

    const finalized = {
      ...round,
      timestamp: Date.now(),
      scores,
      ratings,
    };

    state.completedRounds.push(finalized);
    state.currentRound = null;

    scheduleSave();
    render();

    if (isGameMode()) {
      const totalRounds = state.game.totalRounds;
      const completedCount = state.completedRounds.length;
      if (completedCount >= totalRounds) {
        showWarning(
          `Тур ${finalized.index} завершён. Игра окончена!`,
          "success"
        );
        state.game = null;
        scheduleSave();
        render();
        return;
      }

      showWarning(
        `Тур ${finalized.index} завершён! Начат тур ${finalized.index + 1}.`,
        "success"
      );
      startRound();
      return;
    }

    showWarning(`Тур ${finalized.index} завершён.`, "success");
  }

  function updateQuestion(teamId, questionIndex, checked) {
    const round = state.currentRound;
    if (!round) return;
    if (!round.questions[teamId]) {
      round.questions[teamId] = Array(round.questionsCount || 12).fill(false);
    }
    round.questions[teamId][questionIndex] = !!checked;
    scheduleSave();
    render();
  }

  // Rendering
  function renderTeams() {
    const container = document.getElementById("teamsList");
    if (!container) return;

    if (!state.teams.length) {
      container.innerHTML =
        '<p class="empty-state">Нет команд. Добавьте первую команду выше.</p>';
      return;
    }

    container.innerHTML = state.teams
      .slice()
      .reverse()
      .map((team) => {
        return `
          <div class="player-item ${team.active ? "" : "inactive"}">
            <div class="player-info">
              <input class="player-name" type="text" value="${escapeHtml(
                team.name
              )}" onblur="updateTeamName('${
          team.id
        }', this.value)" onkeydown="teamNameKeydown(event, '${team.id}')" ${
          team.active ? "" : "disabled"
        } />
              <input type="color" class="team-color-picker" value="${
                team.color || "#3b82f6"
              }" onchange="updateTeamColor('${
          team.id
        }', this.value)" title="Цвет команды">
              ${
                !team.active
                  ? '<span class="inactive-badge">Inactive</span>'
                  : ""
              }
            </div>
            <div class="player-actions">
              <button onclick="toggleTeamActive('${
                team.id
              }')" class="btn-small">${team.active ? "✓" : "○"}</button>
              <button onclick="deleteTeam('${
                team.id
              }')" class="btn-small btn-danger">×</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderCurrentRound() {
    const titleEl = document.getElementById("currentRoundTitle");
    const container = document.getElementById("currentRoundContainer");
    const startBtn = document.getElementById("startRoundBtn");
    const finalizeBtn = document.getElementById("finalizeRoundBtn");
    const saveEditedBtn = document.getElementById("saveEditedRoundBtn");
    const cancelEditBtn = document.getElementById("cancelEditRoundBtn");
    const timerBtn = document.getElementById("questionTimerBtn");

    if (titleEl) {
      if (isEditingRound()) {
        const editingRound = getCompletedRoundById(state.editingRoundId);
        titleEl.textContent = editingRound
          ? `Редактирование тура ${editingRound.index}`
          : "Редактирование тура";
      } else if (state.currentRound) {
        const progress = getGameProgress();
        if (progress) {
          titleEl.textContent = `Текущий тур ${progress.currentRound}/${progress.totalRounds}`;
        } else {
          titleEl.textContent = `Текущий тур ${state.currentRound.index}`;
        }
      } else {
        titleEl.textContent = "Текущий тур";
      }
    }

    if (!container) return;

    if (!state.currentRound) {
      container.innerHTML =
        '<p class="empty-state">Нет активного тура. Нажмите «Начать тур».</p>';
      if (startBtn) startBtn.style.display = "inline-block";
      if (finalizeBtn) finalizeBtn.style.display = "none";
      if (saveEditedBtn) saveEditedBtn.style.display = "none";
      if (cancelEditBtn) cancelEditBtn.style.display = "none";
      if (timerBtn) timerBtn.style.display = "none";
      return;
    }

    if (startBtn) startBtn.style.display = isEditingRound() ? "none" : "none";
    if (finalizeBtn)
      finalizeBtn.style.display = !isEditingRound() ? "inline-block" : "none";
    if (saveEditedBtn)
      saveEditedBtn.style.display = isEditingRound() ? "inline-block" : "none";
    if (cancelEditBtn)
      cancelEditBtn.style.display = isEditingRound() ? "inline-block" : "none";
    if (timerBtn)
      timerBtn.style.display = !isEditingRound() ? "inline-block" : "none";

    const round = state.currentRound;
    const teams = (round.teamIds || []).map((id) => ({
      id,
      ...getTeamDisplay(id, round),
    }));

    const questionsCount = round.questionsCount || 12;
    const roundRatings = computeRoundRatings(round);
    const base = getRoundQuestionBase(round);

    container.innerHTML = `
      <div class="scoring-view">
        <table class="scoring-table">
          <thead>
            <tr>
              <th>Команда</th>
              ${Array.from({ length: questionsCount }, (_, i) => {
                const qNum = i + 1;
                const absQ = base + qNum;
                const isSelected = qNum === (state.currentQuestionNumber || 1);
                return `<th class="question-header ${
                  isSelected ? "highlighted-question" : ""
                }" onclick="selectQuestionForTimer(${absQ})" title="Выбрать вопрос для таймера">Q${absQ}</th>`;
              }).join("")}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${teams
              .map((team, teamIndex) => {
                const qs = round.questions?.[team.id] || [];
                const score = qs.filter(Boolean).length;
                const rating = roundRatings?.[team.id] ?? 0;
                const rowStyle = team.color
                  ? `style="--team-color: ${team.color}; background-color: ${team.color}20;"`
                  : "";
                const rowClass = team.color ? "" : `team-row-${teamIndex + 1}`;

                return `
                <tr class="${rowClass}" ${rowStyle}>
                  <td class="team-name"><strong>${escapeHtml(
                    team.name
                  )}</strong></td>
                  ${Array.from({ length: questionsCount }, (_, i) => {
                    const qNum = i + 1;
                    const absQ = base + qNum;
                    const isSelected =
                      qNum === (state.currentQuestionNumber || 1);
                    return `
                      <td class="question-cell ${
                        isSelected ? "highlighted-question" : ""
                      }" data-question="${absQ}">
                        <input type="checkbox"
                          ${qs[i] ? "checked" : ""}
                          onchange="updateQuestion('${
                            team.id
                          }', ${i}, this.checked)"
                          class="question-checkbox-input">
                      </td>
                    `;
                  }).join("")}
                  <td class="score-cell"><strong>${score}</strong><div class="score-details">R: ${rating}</div></td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function selectQuestionForTimer(questionNumber) {
    const round = state.currentRound;
    if (!round) return;

    const questionsCount =
      round.questionsCount || state.settings.questionsPerRound || 12;
    const local = Math.max(
      1,
      Math.min(questionsCount, toLocalQuestionNumber(round, questionNumber))
    );
    state.currentQuestionNumber = local;
    scheduleSave();

    // Broadcast absolute question number for timer sync.
    publishSharedQuestion(
      toAbsoluteQuestionNumber(round, state.currentQuestionNumber)
    );

    // Update scoring highlight
    renderCurrentRound();

    // If timer modal is open, update its UI as well.
    const abs = toAbsoluteQuestionNumber(round, state.currentQuestionNumber);
    const qDisplay = document.getElementById("questionNumberDisplay");
    if (qDisplay) qDisplay.textContent = String(abs);
    if (document.getElementById("questionTimerModal")) {
      renderTimerTeamsTable();
    }
  }

  function bindScoringCellToggle() {
    const container = document.getElementById("currentRoundContainer");
    if (!container) return;

    container.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.tagName === "INPUT") return;
      const cell = target?.closest?.("td.question-cell");
      if (!cell) return;
      const input = cell.querySelector('input[type="checkbox"]');
      if (!input || input.disabled) return;
      input.checked = !input.checked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function bindSharedQuestionSync() {
    window.addEventListener("storage", (e) => {
      if (e.key !== SHARED_QUESTION_KEY) return;
      const abs = parseSharedQuestionValue(e.newValue);
      if (!abs) return;

      const round = state.currentRound;
      if (!round) return;

      const questionsCount =
        round.questionsCount || state.settings.questionsPerRound || 12;
      const local = Math.max(
        1,
        Math.min(questionsCount, toLocalQuestionNumber(round, abs))
      );
      state.currentQuestionNumber = local;
      scheduleSave();

      renderCurrentRound();

      const qDisplay = document.getElementById("questionNumberDisplay");
      if (qDisplay)
        qDisplay.textContent = String(
          toAbsoluteQuestionNumber(round, state.currentQuestionNumber)
        );
      if (document.getElementById("questionTimerModal")) {
        renderTimerTeamsTable();
      }
    });
  }

  function renderHistory() {
    const container = document.getElementById("roundsHistory");
    if (!container) return;

    if (!state.completedRounds.length) {
      container.innerHTML = '<p class="empty-state">Нет завершённых туров.</p>';
      return;
    }

    container.innerHTML = state.completedRounds
      .slice()
      .reverse()
      .map((round) => {
        const date = round.timestamp ? new Date(round.timestamp) : null;
        const dateLabel = date
          ? date.toLocaleString("ru-RU", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        const teams = (round.teamIds || []).map((id) => ({
          id,
          ...getTeamDisplay(id, round),
        }));

        const questionsCount =
          round.questionsCount || state.settings.questionsPerRound || 12;
        const base = getRoundQuestionBase(round);

        const tableHtml = `
          <table class="mini-round-table">
            <thead>
              <tr>
                <th>Команда</th>
                ${Array.from(
                  { length: questionsCount },
                  (_, i) => `<th>${base + i + 1}</th>`
                ).join("")}
                <th>Σ</th>
                <th>R</th>
              </tr>
            </thead>
            <tbody>
              ${teams
                .map((team) => {
                  const qs = (round.questions?.[team.id] || []).slice(
                    0,
                    questionsCount
                  );
                  const score =
                    round.scores?.[team.id] ?? qs.filter(Boolean).length;
                  const rating = round.ratings?.[team.id] ?? 0;
                  const nameStyle = team.color
                    ? `style="color:${team.color}"`
                    : "";
                  return `
                    <tr>
                      <td><strong ${nameStyle}>${escapeHtml(
                    team.name
                  )}</strong></td>
                      ${Array.from(
                        { length: questionsCount },
                        (_, i) =>
                          `<td class="q-cell ${qs[i] ? "q-correct" : ""}">${
                            qs[i] ? "✓" : ""
                          }</td>`
                      ).join("")}
                      <td class="score-col"><strong>${score}</strong></td>
                      <td class="score-col"><strong>${rating}</strong></td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        `;

        return `
          <div class="round-item">
            <div class="round-header">
              <h4>Тур ${round.index}</h4>
              <span class="round-date">${dateLabel}</span>
              <button onclick="editRoundFromHistory('${round.id}')" class="btn-small">Edit</button>
            </div>
            ${tableHtml}
          </div>
        `;
      })
      .join("");
  }

  function renderLeaderboard() {
    const container = document.getElementById("leaderboard");
    if (!container) return;

    const rounds = state.completedRounds || [];
    const teamStats = new Map();

    (state.teams || []).forEach((team) => {
      teamStats.set(team.id, {
        id: team.id,
        name: team.name,
        color: team.color,
        roundsPlayed: 0,
        totalScore: 0,
        rating: 0,
      });
    });

    rounds.forEach((round) => {
      (round.teamIds || []).forEach((teamId) => {
        const entry = teamStats.get(teamId);
        if (!entry) return;
        entry.roundsPlayed += 1;
        entry.totalScore += round.scores?.[teamId] ?? 0;
        entry.rating += round.ratings?.[teamId] ?? 0;
      });
    });

    const rows = Array.from(teamStats.values())
      .filter((t) => t.roundsPlayed > 0)
      .map((t) => ({
        ...t,
        avgPerRound: t.roundsPlayed ? t.totalScore / t.roundsPlayed : 0,
      }))
      .sort(
        (a, b) =>
          b.totalScore - a.totalScore ||
          b.rating - a.rating ||
          b.avgPerRound - a.avgPerRound ||
          a.name.localeCompare(b.name)
      );

    if (!rows.length) {
      container.innerHTML =
        '<p class="empty-state">Нет результатов. Завершите тур, чтобы увидеть таблицу.</p>';
      return;
    }

    container.innerHTML = `
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Команда</th>
            <th>Правильные</th>
            <th>В среднем/тур</th>
            <th>Рейтинг</th>
            <th>Туры</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((t, idx) => {
              const nameCellStyle = t.color
                ? `style="border-left: 4px solid ${t.color}; padding-left: 10px;"`
                : "";
              return `
              <tr>
                <td class="rank">${idx + 1}</td>
                <td ${nameCellStyle}><a href="#" class="player-link" onclick="showTeamStats('${
                t.id
              }'); return false;"><strong>${escapeHtml(
                t.name
              )}</strong></a></td>
                <td>${t.totalScore}</td>
                <td>${t.avgPerRound.toFixed(1)}</td>
                <td class="rating">${t.rating.toFixed(0)}</td>
                <td>${t.roundsPlayed}</td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function render() {
    const qInput = document.getElementById("questionsPerRound");
    if (qInput) qInput.value = String(state.settings.questionsPerRound || 12);

    const gInput = document.getElementById("gameRoundsInput");
    if (gInput) gInput.value = String(state.settings.gameRounds || 3);

    renderGameInfo();
    renderTeams();
    renderCurrentRound();
    renderHistory();
    renderLeaderboard();
  }

  function renderGameInfo() {
    const gameInfo = document.getElementById("gameInfo");
    if (!gameInfo) return;

    const progress = getGameProgress();
    if (!progress) {
      gameInfo.innerHTML = "";
      return;
    }

    const pct = progress.totalRounds
      ? (progress.currentRound / progress.totalRounds) * 100
      : 0;
    gameInfo.innerHTML = `
      <div class="game-progress">
        <h3>🎮 Игра в процессе</h3>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${pct}%"></div>
        </div>
        <p class="progress-text">Тур ${progress.currentRound} из ${
      progress.totalRounds
    }</p>
        ${
          progress.isLastRound
            ? '<p class="progress-note">Это последний тур игры!</p>'
            : ""
        }
      </div>
    `;
  }

  function showTeamStats(teamId) {
    const rounds = (state.completedRounds || []).filter((r) =>
      (r.teamIds || []).includes(teamId)
    );
    if (!rounds.length) return;

    const display = getTeamDisplay(teamId, rounds[0]);

    const roundsHtml = rounds
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((r) => {
        const questionsCount =
          r.questionsCount || state.settings.questionsPerRound || 12;
        const base = getRoundQuestionBase(r);
        const qs = (r.questions?.[teamId] || []).slice(0, questionsCount);
        const score = r.scores?.[teamId] ?? qs.filter(Boolean).length;
        const rating = r.ratings?.[teamId] ?? 0;

        const tableHtml = `
          <table class="mini-round-table">
            <thead>
              <tr>
                ${Array.from(
                  { length: questionsCount },
                  (_, i) => `<th>${base + i + 1}</th>`
                ).join("")}
                <th>Σ</th>
                <th>R</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                ${Array.from(
                  { length: questionsCount },
                  (_, i) =>
                    `<td class="q-cell ${qs[i] ? "q-correct" : ""}">${
                      qs[i] ? "✓" : ""
                    }</td>`
                ).join("")}
                <td class="score-col"><strong>${score}</strong></td>
                <td class="score-col"><strong>${rating}</strong></td>
              </tr>
            </tbody>
          </table>
        `;

        return `
          <div class="round-stat-item">
            <div class="round-stat-header">
              <strong>Тур ${r.index}</strong>
              <span class="round-stat-summary">Очки: ${score} • Рейтинг: ${rating}</span>
            </div>
            ${tableHtml}
          </div>
        `;
      })
      .join("");

    const modalHtml = `
      <div class="modal-overlay" onclick="closeTeamStats()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>${escapeHtml(display.name)}</h2>
            <button onclick="closeTeamStats()" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            ${roundsHtml}
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById("teamStatsModal");
    if (existing) existing.remove();

    const modalDiv = document.createElement("div");
    modalDiv.id = "teamStatsModal";
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
  }

  function closeTeamStats() {
    const modal = document.getElementById("teamStatsModal");
    if (modal) modal.remove();
  }

  function editRoundFromHistory(roundId) {
    const round = getCompletedRoundById(roundId);
    if (!round) {
      showWarning("Тур не найден");
      return;
    }
    if (isEditingRound()) {
      showWarning("Уже идёт редактирование тура");
      return;
    }

    state.undoSnapshot = {
      round: cloneDeep(round),
    };

    if (state.currentRound && state.currentRound.id !== roundId) {
      state.suspendedRoundState = {
        currentRound: cloneDeep(state.currentRound),
        currentQuestionNumber: state.currentQuestionNumber,
        game: cloneDeep(state.game),
      };
    } else {
      state.suspendedRoundState = null;
    }

    state.editingRoundId = roundId;
    state.currentRound = cloneDeep(round);
    state.currentQuestionNumber = 1;
    scheduleSave();
    render();
    showWarning(
      "Редактирование тура: внесите изменения и нажмите «Сохранить изменения».",
      "info"
    );
  }

  function saveEditedRound() {
    if (!isEditingRound()) return;
    const edited = state.currentRound;
    if (!edited) return;

    // Recompute scores + ratings from questions
    const scores = {};
    (edited.teamIds || []).forEach((teamId) => {
      const q = edited.questions?.[teamId] || [];
      scores[teamId] = q.filter(Boolean).length;
    });
    const ratings = computeRoundRatings(edited);

    const updated = {
      ...edited,
      scores,
      ratings,
    };

    const idx = (state.completedRounds || []).findIndex(
      (r) => r.id === state.editingRoundId
    );
    if (idx !== -1) {
      state.completedRounds[idx] = updated;
    }

    state.editingRoundId = null;
    state.undoSnapshot = null;

    if (state.suspendedRoundState?.currentRound) {
      state.currentRound = state.suspendedRoundState.currentRound;
      state.currentQuestionNumber =
        state.suspendedRoundState.currentQuestionNumber || 1;
      state.game = state.suspendedRoundState.game || state.game;
    } else {
      state.currentRound = null;
    }
    state.suspendedRoundState = null;

    scheduleSave();
    render();
    showWarning("Тур обновлён", "success");
  }

  function cancelEditRound() {
    if (!isEditingRound()) return;
    if (state.undoSnapshot?.round) {
      const idx = (state.completedRounds || []).findIndex(
        (r) => r.id === state.undoSnapshot.round.id
      );
      if (idx !== -1) {
        state.completedRounds[idx] = state.undoSnapshot.round;
      }
    }

    state.editingRoundId = null;
    state.undoSnapshot = null;

    if (state.suspendedRoundState?.currentRound) {
      state.currentRound = state.suspendedRoundState.currentRound;
      state.currentQuestionNumber =
        state.suspendedRoundState.currentQuestionNumber || 1;
      state.game = state.suspendedRoundState.game || state.game;
    } else {
      state.currentRound = null;
    }
    state.suspendedRoundState = null;

    scheduleSave();
    render();
    showWarning("Редактирование отменено", "info");
  }

  // Export/Import state
  function handleExport() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chgk-teams-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showWarning("Экспорт выполнен", "success");
  }

  function exportGameTsv() {
    const rounds = (state.completedRounds || [])
      .slice()
      .sort((a, b) => (a.index || 0) - (b.index || 0));
    if (!rounds.length) {
      showWarning("Нет завершённых туров для экспорта", "info");
      return;
    }

    const teamIdSet = new Set();
    rounds.forEach((r) => (r.teamIds || []).forEach((id) => teamIdSet.add(id)));
    const teamIds = Array.from(teamIdSet);

    const absQuestions = [];
    const absMap = new Map();

    rounds.forEach((r) => {
      const questionsCount =
        r.questionsCount || state.settings.questionsPerRound || 12;
      const base = getRoundQuestionBase(r);
      for (let local = 1; local <= questionsCount; local++) {
        const abs = base + local;
        absQuestions.push(abs);
        absMap.set(abs, { roundId: r.id, localIdx: local - 1 });
      }
    });

    const header = ["Team", ...absQuestions.map((n) => `Q${n}`)].join("\t");
    const lines = [header];

    teamIds.forEach((teamId) => {
      const firstRound =
        rounds.find((r) => (r.teamIds || []).includes(teamId)) || null;
      const display = getTeamDisplay(teamId, firstRound);
      const row = [display.name];

      absQuestions.forEach((abs) => {
        const m = absMap.get(abs);
        const r = rounds.find((x) => x.id === m.roundId);
        const v = r?.questions?.[teamId]?.[m.localIdx] ? 1 : 0;
        row.push(String(v));
      });

      lines.push(row.join("\t"));
    });

    const data = lines.join("\n");
    const blob = new Blob([data], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chgk-game-export-${Date.now()}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
    showWarning("Экспорт TSV выполнен", "success");
  }

  function exportGameTsvTransposed() {
    const rounds = (state.completedRounds || [])
      .slice()
      .sort((a, b) => (a.index || 0) - (b.index || 0));
    if (!rounds.length) {
      showWarning("Нет завершённых туров для экспорта", "info");
      return;
    }

    const teamIdSet = new Set();
    rounds.forEach((r) => (r.teamIds || []).forEach((id) => teamIdSet.add(id)));

    // Prefer stable order: current teams list order, then any missing ids.
    const orderedTeamIds = [];
    (state.teams || []).forEach((t) => {
      if (teamIdSet.has(t.id)) orderedTeamIds.push(t.id);
    });
    Array.from(teamIdSet).forEach((id) => {
      if (!orderedTeamIds.includes(id)) orderedTeamIds.push(id);
    });

    const teamDisplays = orderedTeamIds.map((teamId) => {
      const firstRound =
        rounds.find((r) => (r.teamIds || []).includes(teamId)) || null;
      return getTeamDisplay(teamId, firstRound).name;
    });

    const absQuestions = [];
    const absMap = new Map();
    rounds.forEach((r) => {
      const questionsCount =
        r.questionsCount || state.settings.questionsPerRound || 12;
      const base = getRoundQuestionBase(r);
      for (let local = 1; local <= questionsCount; local++) {
        const abs = base + local;
        absQuestions.push(abs);
        absMap.set(abs, { roundId: r.id, localIdx: local - 1 });
      }
    });

    const header = ["Question", ...teamDisplays].join("\t");
    const lines = [header];

    absQuestions.forEach((abs) => {
      const m = absMap.get(abs);
      const r = rounds.find((x) => x.id === m.roundId);
      const row = [`Q${abs}`];

      orderedTeamIds.forEach((teamId) => {
        const v = r?.questions?.[teamId]?.[m.localIdx] ? 1 : 0;
        row.push(String(v));
      });

      lines.push(row.join("\t"));
    });

    const data = lines.join("\n");
    const blob = new Blob([data], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chgk-game-export-transposed-${Date.now()}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
    showWarning("Экспорт TSV (транспонир.) выполнен", "success");
  }

  function handleImport() {
    document.getElementById("importFile")?.click();
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target.result || ""));
        if (!parsed || typeof parsed !== "object")
          throw new Error("Invalid file");
        state = {
          ...defaultState(),
          ...parsed,
          settings: {
            ...defaultState().settings,
            ...(parsed.settings || {}),
          },
          ui: {
            ...defaultState().ui,
            ...(parsed.ui || {}),
          },
        };
        if (!Array.isArray(state.teams)) state.teams = [];
        if (!Array.isArray(state.completedRounds)) state.completedRounds = [];

        saveImmediate();
        render();
        showWarning("Импорт выполнен", "success");
      } catch (err) {
        showWarning("Ошибка импорта: " + (err?.message || err));
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  function handleResetRounds() {
    if (!confirm("Сбросить все туры? Команды останутся.")) return;
    state.currentRound = null;
    state.completedRounds = [];
    state.currentQuestionNumber = 1;
    scheduleSave();
    render();
    showWarning("Туры сброшены", "success");
  }

  function handleResetAll() {
    if (!confirm("Полный сброс? Это удалит команды и туры.")) return;
    state = defaultState();
    saveImmediate();
    render();
    showWarning("Данные очищены", "success");
  }

  // Help
  function openHelp() {
    const el = document.getElementById("helpModal");
    if (el) el.style.display = "flex";
  }

  function closeHelp() {
    const el = document.getElementById("helpModal");
    if (el) el.style.display = "none";
  }

  // Timer (ported from ui.js, adapted to teams-only state)
  let timerInterval = null;
  let timerSeconds = 60.0;
  let isTimerRunning = false;
  let isSecondPhase = false;
  let timerTargetMs = null;
  let lastMainBeepSecond = null;
  let lastOvertimeBeepSecond = null;
  let timerSettings = {
    decimalDigits: 2,
    lastQuestionsShown: 2,
    mainTime: 60,
    additionalTime: 10,
  };
  let hasTimerStarted = false;
  let isTimerSettingsCollapsed = null;

  function getMonotonicNowMs() {
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    )
      return performance.now();
    return Date.now();
  }

  function updateTimerDisplay() {
    const displayEl = document.getElementById("timerDisplay");
    if (!displayEl) return;
    displayEl.textContent = Math.max(0, timerSeconds).toFixed(
      timerSettings.decimalDigits
    );
  }

  function setTimerPhase(secondPhase) {
    isSecondPhase = !!secondPhase;
    const phaseEl = document.getElementById("phaseLabel");
    const displayEl = document.getElementById("timerDisplay");
    if (phaseEl)
      phaseEl.textContent = isSecondPhase
        ? "Записывайте ответы"
        : "Основное время";
    if (displayEl) displayEl.classList.toggle("timer-overtime", isSecondPhase);
    if (!isSecondPhase) lastMainBeepSecond = null;
    else lastOvertimeBeepSecond = null;
  }

  function ensureTimerKeyListener() {
    if (window.__chgkTimerKeyListener) return;

    window.__chgkTimerKeyListener = function (e) {
      const modal = document.getElementById("questionTimerModal");
      if (!modal) return;
      if (e.repeat) return;

      const isSpace =
        e.code === "Space" || e.key === " " || e.key === "Spacebar";
      const isEnter = e.code === "Enter" || e.key === "Enter";
      if (!isSpace && !isEnter) return;

      e.preventDefault();
      e.stopPropagation();

      if (isSpace) {
        const btn = document.getElementById(
          isTimerRunning ? "pauseTimerBtn" : "startTimerBtn"
        );
        if (btn) btn.click();
        return;
      }

      if (isEnter) {
        const nextBtn = document.getElementById("nextQuestionBtn");
        if (nextBtn) nextBtn.click();
      }
    };

    document.addEventListener("keydown", window.__chgkTimerKeyListener, true);
  }

  function setTimerSettingsCollapsed(collapsed) {
    isTimerSettingsCollapsed = !!collapsed;
    const panel = document.getElementById("timerSettingsPanel");
    const fab = document.getElementById("timerSettingsFab");
    if (panel) panel.classList.toggle("collapsed", isTimerSettingsCollapsed);
    if (fab)
      fab.style.display = isTimerSettingsCollapsed ? "inline-flex" : "none";
  }

  function toggleTimerSettingsPanel() {
    setTimerSettingsCollapsed(!isTimerSettingsCollapsed);
  }

  function openQuestionTimer() {
    if (!state.currentRound) return;

    const round = state.currentRound;
    const questionsCount =
      round.questionsCount || state.settings.questionsPerRound || 12;

    if (
      !state.currentQuestionNumber ||
      state.currentQuestionNumber > questionsCount
    ) {
      state.currentQuestionNumber = 1;
    }

    const absQuestionNumber = toAbsoluteQuestionNumber(
      round,
      state.currentQuestionNumber
    );

    timerSeconds = timerSettings.mainTime;
    setTimerPhase(false);
    isTimerRunning = false;
    hasTimerStarted = false;

    const modalHtml = `
      <div class="modal-overlay fullscreen-modal" id="questionTimerModal" onclick="event.stopPropagation()">
        <div class="timer-modal-content">
          <button onclick="closeQuestionTimer()" class="timer-close">&times;</button>
          <button id="timerSettingsFab" class="timer-settings-fab" onclick="toggleTimerSettingsPanel()" title="Настройки таймера">⚙</button>
          <div class="timer-main-content">
            <h1 class="timer-question-title">Вопрос №<span id="questionNumberDisplay">${absQuestionNumber}</span></h1>
            <div class="timer-display" id="timerDisplay">${timerSettings.mainTime.toFixed(
              timerSettings.decimalDigits
            )}</div>
            <div class="timer-phase-label" id="phaseLabel">Основное время</div>
          </div>
          <div class="timer-controls">
            <button id="startTimerBtn" class="btn btn-success btn-large" onclick="startTimer()">▶ Начать</button>
            <button id="pauseTimerBtn" class="btn btn-warning btn-large" onclick="pauseTimer()" style="display:none;">⏸ Пауза</button>
            <button id="restartTimerBtn" class="btn btn-danger btn-large" onclick="restartTimer()" style="display:none;">↻ Перезапустить</button>
            <button id="nextQuestionBtn" class="btn btn-primary btn-large" onclick="nextQuestionNow()">⏭ Следующий</button>
          </div>
          <div class="timer-settings-panel" id="timerSettingsPanel">
            <div class="timer-settings-header">
              <h4>Настройки таймера</h4>
              <button class="timer-settings-collapse" onclick="setTimerSettingsCollapsed(true)" title="Свернуть">×</button>
            </div>
            <div class="timer-setting">
              <label>Десятичные знаки:</label>
              <input type="number" min="0" max="3" value="${
                timerSettings.decimalDigits
              }" onchange="updateTimerSetting('decimalDigits', this.value)">
            </div>
            <div class="timer-setting">
              <label>Показать вопросов:</label>
              <input type="number" min="1" max="5" value="${
                timerSettings.lastQuestionsShown
              }" onchange="updateTimerSetting('lastQuestionsShown', this.value)">
            </div>
            <div class="timer-setting">
              <label>Основное время (сек):</label>
              <input type="number" min="10" max="300" value="${
                timerSettings.mainTime
              }" onchange="updateTimerSetting('mainTime', this.value)">
            </div>
            <div class="timer-setting">
              <label>Доп. время (сек):</label>
              <input type="number" min="5" max="60" value="${
                timerSettings.additionalTime
              }" onchange="updateTimerSetting('additionalTime', this.value)">
            </div>
          </div>
          <div class="timer-teams-table" id="timerTeamsTable"></div>
        </div>
      </div>
    `;

    const existing = document.getElementById("questionTimerModal");
    if (existing) existing.remove();

    const modalDiv = document.createElement("div");
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv.firstElementChild);

    ensureTimerKeyListener();

    if (isTimerSettingsCollapsed === null) {
      const shouldCollapseByDefault = window.matchMedia(
        "(max-width: 700px), (max-height: 650px)"
      ).matches;
      isTimerSettingsCollapsed = shouldCollapseByDefault;
    }
    setTimerSettingsCollapsed(isTimerSettingsCollapsed);

    renderTimerTeamsTable();
  }

  function renderTimerTeamsTable() {
    if (!state.currentRound) return;

    const round = state.currentRound;
    const base = getRoundQuestionBase(round);
    const currentLocal = state.currentQuestionNumber || 1;
    const currentAbs = base + currentLocal;
    const minAbs = base + 1;

    const questionsToShowAbs = [];
    const startAbs = Math.max(
      minAbs,
      currentAbs - timerSettings.lastQuestionsShown + 1
    );
    for (let abs = startAbs; abs <= currentAbs; abs++) {
      questionsToShowAbs.push(abs);
    }

    const tableContainer = document.getElementById("timerTeamsTable");
    if (!tableContainer) return;

    const teams = (round.teamIds || [])
      .map((id) => state.teams.find((t) => t.id === id))
      .filter(Boolean);

    let html = '<table class="mini-teams-table"><thead><tr><th>Команда</th>';
    questionsToShowAbs.forEach((abs) => {
      html += `<th>${abs}</th>`;
    });
    html += "</tr></thead><tbody>";

    teams.forEach((team) => {
      const qs = round.questions?.[team.id] || [];
      html += `<tr><td>${escapeHtml(team.name)}</td>`;
      questionsToShowAbs.forEach((abs) => {
        const localIdx = abs - base - 1;
        const checked = qs[localIdx] ? "✓" : "✗";
        html += `<td class="mini-answer mini-answer-clickable" onclick="toggleTimerQuestion('${team.id}', ${localIdx})">${checked}</td>`;
      });
      html += "</tr>";
    });

    html += "</tbody></table>";
    tableContainer.innerHTML = html;
  }

  function updateTimerSetting(setting, value) {
    const numValue = parseInt(value, 10);
    if (!Number.isFinite(numValue)) return;
    timerSettings[setting] = numValue;

    if (setting === "lastQuestionsShown") {
      renderTimerTeamsTable();
    }

    if (
      (setting === "mainTime" || setting === "additionalTime") &&
      hasTimerStarted
    ) {
      restartTimer();
    }

    if (setting === "decimalDigits") {
      updateTimerDisplay();
    }
  }

  function closeQuestionTimer() {
    stopTimer();
    if (window.__chgkTimerKeyListener) {
      document.removeEventListener(
        "keydown",
        window.__chgkTimerKeyListener,
        true
      );
      window.__chgkTimerKeyListener = null;
    }
    closeTeamStats();
    const modal = document.getElementById("questionTimerModal");
    if (modal) modal.remove();
  }

  function startTimer() {
    if (isTimerRunning) return;

    isTimerRunning = true;
    hasTimerStarted = true;
    playBeep(440, 0.1);

    timerTargetMs = getMonotonicNowMs() + Math.max(0, timerSeconds) * 1000;

    const startBtn = document.getElementById("startTimerBtn");
    const pauseBtn = document.getElementById("pauseTimerBtn");
    const restartBtn = document.getElementById("restartTimerBtn");
    if (startBtn) startBtn.style.display = "none";
    if (pauseBtn) pauseBtn.style.display = "inline-block";
    if (restartBtn) restartBtn.style.display = "none";

    ensureTimerKeyListener();

    timerInterval = setInterval(() => {
      if (!isTimerRunning || timerTargetMs === null) return;

      const now = getMonotonicNowMs();
      const remaining = (timerTargetMs - now) / 1000;
      timerSeconds = Math.max(0, remaining);

      if (timerSeconds <= 0) {
        if (!isSecondPhase) {
          setTimerPhase(true);
          timerSeconds = timerSettings.additionalTime;
          timerTargetMs =
            getMonotonicNowMs() + Math.max(0, timerSeconds) * 1000;
        } else {
          stopTimer();
          nextQuestion();
          return;
        }
      }

      updateTimerDisplay();

      const remainingWholeSeconds = Math.ceil(timerSeconds);
      if (!isSecondPhase) {
        if (
          remainingWholeSeconds <= 10 &&
          remainingWholeSeconds > 0 &&
          remainingWholeSeconds !== lastMainBeepSecond
        ) {
          playBeep(440, remainingWholeSeconds === 10 ? 0.1 : 0.05);
          lastMainBeepSecond = remainingWholeSeconds;
        }
      } else {
        if (
          remainingWholeSeconds > 0 &&
          remainingWholeSeconds !== lastOvertimeBeepSecond
        ) {
          playBeep(880, 0.1);
          lastOvertimeBeepSecond = remainingWholeSeconds;
        }
      }
    }, 50);
  }

  function pauseTimer() {
    if (!isTimerRunning) return;

    if (timerTargetMs !== null) {
      const now = getMonotonicNowMs();
      timerSeconds = Math.max(0, (timerTargetMs - now) / 1000);
    }

    stopTimer();

    const startBtn = document.getElementById("startTimerBtn");
    const pauseBtn = document.getElementById("pauseTimerBtn");
    const restartBtn = document.getElementById("restartTimerBtn");
    if (startBtn) {
      startBtn.innerHTML = "▶ Продолжить";
      startBtn.style.display = "inline-block";
    }
    if (pauseBtn) pauseBtn.style.display = "none";
    if (restartBtn) restartBtn.style.display = "inline-block";
  }

  function restartTimer() {
    stopTimer();
    timerSeconds = timerSettings.mainTime;
    setTimerPhase(false);
    hasTimerStarted = false;
    timerTargetMs = null;
    updateTimerDisplay();

    const startBtn = document.getElementById("startTimerBtn");
    const pauseBtn = document.getElementById("pauseTimerBtn");
    const restartBtn = document.getElementById("restartTimerBtn");
    if (startBtn) {
      startBtn.innerHTML = "▶ Начать";
      startBtn.style.display = "inline-block";
    }
    if (pauseBtn) pauseBtn.style.display = "none";
    if (restartBtn) restartBtn.style.display = "none";
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    isTimerRunning = false;
    timerTargetMs = null;
  }

  function nextQuestion() {
    if (!state.currentRound) return;

    const questionsCount =
      state.currentRound.questionsCount ||
      state.settings.questionsPerRound ||
      12;
    state.currentQuestionNumber = (state.currentQuestionNumber || 1) + 1;
    if (state.currentQuestionNumber > questionsCount)
      state.currentQuestionNumber = 1;

    scheduleSave();

    closeQuestionTimer();
    setTimeout(() => openQuestionTimer(), 50);
  }

  function nextQuestionNow() {
    stopTimer();
    nextQuestion();
  }

  function toggleTimerQuestion(teamId, questionIndex) {
    const round = state.currentRound;
    if (!round) return;

    if (!round.questions[teamId]) {
      round.questions[teamId] = Array(round.questionsCount || 12).fill(false);
    }

    round.questions[teamId][questionIndex] =
      !round.questions[teamId][questionIndex];
    scheduleSave();
    renderTimerTeamsTable();
    render();
  }

  function playBeep(frequency, duration) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const audioContext = new AudioCtx();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + duration
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  }

  // Key handling for modal close
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    const helpModal = document.getElementById("helpModal");
    if (helpModal && helpModal.style.display !== "none") {
      closeHelp();
      return;
    }

    const timerModal = document.getElementById("questionTimerModal");
    if (timerModal) {
      if (hasTimerStarted) {
        if (confirm("Закрыть таймер? Текущий прогресс будет потерян.")) {
          closeQuestionTimer();
        }
      } else {
        closeQuestionTimer();
      }
    }

    const teamStats = document.getElementById("teamStatsModal");
    if (teamStats) {
      closeTeamStats();
    }
  });

  // Events
  function teamNameKeydown(event, teamId) {
    if (!event) return;

    if (event.key === "Enter") {
      event.preventDefault();
      updateTeamName(teamId, event.target.value);
      event.target.blur();
      return;
    }

    if (event.key === "Escape") {
      const team = state.teams.find((t) => t.id === teamId);
      if (team && event.target) {
        event.target.value = team.name;
        event.target.blur();
      }
    }
  }

  function bindEvents() {
    document.getElementById("addTeamBtn")?.addEventListener("click", addTeam);
    document
      .getElementById("teamNameInput")
      ?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addTeam();
      });

    const teamColorInput = document.getElementById("teamColorInput");
    if (teamColorInput) {
      teamColorInput.dataset.userSelected = "false";
      const existingColors = (state.teams || [])
        .map((t) => t.color)
        .filter(Boolean);
      teamColorInput.value = pickDistinctColor(existingColors);
      teamColorInput.addEventListener("input", () => {
        teamColorInput.dataset.userSelected = "true";
      });
      teamColorInput.addEventListener("change", () => {
        teamColorInput.dataset.userSelected = "true";
      });
    }

    bindScoringCellToggle();
    bindSharedQuestionSync();

    document
      .getElementById("questionsPerRound")
      ?.addEventListener("change", () => {
        ensureQuestionsPerRoundFromUI();
        renderCurrentRound();
      });

    document
      .getElementById("gameRoundsInput")
      ?.addEventListener("change", () => {
        ensureGameRoundsFromUI();
        renderGameInfo();
      });

    document
      .getElementById("startGameBtn")
      ?.addEventListener("click", startGame);

    document
      .getElementById("startRoundBtn")
      ?.addEventListener("click", startRound);
    document
      .getElementById("finalizeRoundBtn")
      ?.addEventListener("click", finalizeRound);
    document
      .getElementById("saveEditedRoundBtn")
      ?.addEventListener("click", saveEditedRound);
    document
      .getElementById("cancelEditRoundBtn")
      ?.addEventListener("click", cancelEditRound);
    document
      .getElementById("questionTimerBtn")
      ?.addEventListener("click", openQuestionTimer);

    document
      .getElementById("exportGameTsvBtn")
      ?.addEventListener("click", exportGameTsv);
    document
      .getElementById("exportGameTsvTransposeBtn")
      ?.addEventListener("click", exportGameTsvTransposed);

    document
      .getElementById("exportBtn")
      ?.addEventListener("click", handleExport);
    document
      .getElementById("importBtn")
      ?.addEventListener("click", handleImport);
    document
      .getElementById("importFile")
      ?.addEventListener("change", handleImportFile);
    document
      .getElementById("resetRoundsBtn")
      ?.addEventListener("click", handleResetRounds);
    document
      .getElementById("resetBtn")
      ?.addEventListener("click", handleResetAll);

    window.addEventListener("beforeunload", () => {
      try {
        saveImmediate();
      } catch (e) {
        // ignore
      }
    });
  }

  function init() {
    load();
    bindEvents();
    render();
  }

  // Expose needed functions for inline handlers
  window.toggleSection = toggleSection;
  window.openHelp = openHelp;
  window.closeHelp = closeHelp;

  window.updateTeamName = updateTeamName;
  window.updateTeamColor = updateTeamColor;
  window.toggleTeamActive = toggleTeamActive;
  window.deleteTeam = deleteTeam;
  window.teamNameKeydown = teamNameKeydown;

  window.updateQuestion = updateQuestion;
  window.selectQuestionForTimer = selectQuestionForTimer;

  window.editRoundFromHistory = editRoundFromHistory;
  window.showTeamStats = showTeamStats;
  window.closeTeamStats = closeTeamStats;

  // Timer globals for onclick handlers inside modal HTML
  window.openQuestionTimer = openQuestionTimer;
  window.closeQuestionTimer = closeQuestionTimer;
  window.startTimer = startTimer;
  window.pauseTimer = pauseTimer;
  window.restartTimer = restartTimer;
  window.nextQuestionNow = nextQuestionNow;
  window.toggleTimerQuestion = toggleTimerQuestion;
  window.updateTimerSetting = updateTimerSetting;
  window.toggleTimerSettingsPanel = toggleTimerSettingsPanel;
  window.setTimerSettingsCollapsed = setTimerSettingsCollapsed;

  document.addEventListener("DOMContentLoaded", init);
})();
