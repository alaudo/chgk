// timer.js - standalone CHGK question timer (no scoring table)

(function () {
  const STORAGE_KEY = 'chgk.timerOnly.v1';

  let timerInterval = null;
  let timerSeconds = 60.0;
  let isTimerRunning = false;
  let isSecondPhase = false;
  let timerTargetMs = null;
  let lastMainBeepSecond = null;
  let lastOvertimeBeepSecond = null;
  let hasTimerStarted = false;
  let isTimerSettingsCollapsed = null;

  let timerSettings = {
    decimalDigits: 2,
    mainTime: 60,
    additionalTime: 10
  };

  let questionNumber = 1;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      if (parsed.timerSettings && typeof parsed.timerSettings === 'object') {
        timerSettings = {
          ...timerSettings,
          ...parsed.timerSettings
        };
      }
      if (Number.isFinite(parsed.questionNumber) && parsed.questionNumber >= 1) {
        questionNumber = Math.floor(parsed.questionNumber);
      }
      if (typeof parsed.isTimerSettingsCollapsed === 'boolean') {
        isTimerSettingsCollapsed = parsed.isTimerSettingsCollapsed;
      }
    } catch (e) {
      // ignore
    }
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          timerSettings,
          questionNumber,
          isTimerSettingsCollapsed
        })
      );
    } catch (e) {
      // ignore
    }
  }

  function getMonotonicNowMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    return Date.now();
  }

  function updateTimerDisplay() {
    const displayEl = document.getElementById('timerDisplay');
    if (!displayEl) return;
    displayEl.textContent = Math.max(0, timerSeconds).toFixed(timerSettings.decimalDigits);
  }

  function setTimerPhase(secondPhase) {
    isSecondPhase = !!secondPhase;
    const phaseEl = document.getElementById('phaseLabel');
    const displayEl = document.getElementById('timerDisplay');

    if (phaseEl) phaseEl.textContent = isSecondPhase ? 'Записывайте ответы' : 'Основное время';
    if (displayEl) displayEl.classList.toggle('timer-overtime', isSecondPhase);

    if (!isSecondPhase) {
      lastMainBeepSecond = null;
    } else {
      lastOvertimeBeepSecond = null;
    }
  }

  function ensureTimerKeyListener() {
    if (window.__timerOnlyKeyListener) return;

    window.__timerOnlyKeyListener = function (e) {
      const modal = document.getElementById('questionTimerModal');
      if (!modal) return;

      if (e.repeat) return;

      // Don't steal keys while typing in inputs.
      const active = document.activeElement;
      const tag = active?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable;

      const isSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
      const isEnter = e.code === 'Enter' || e.key === 'Enter';
      const isBackspace = e.code === 'Backspace' || e.key === 'Backspace';

      if (!isSpace && !isEnter && !isBackspace) return;

      if (isTyping && isBackspace) return;

      e.preventDefault();
      e.stopPropagation();

      if (isSpace) {
        const btn = document.getElementById(isTimerRunning ? 'pauseTimerBtn' : 'startTimerBtn');
        if (btn) btn.click();
        return;
      }

      if (isEnter) {
        const nextBtn = document.getElementById('nextQuestionBtn');
        if (nextBtn) nextBtn.click();
        return;
      }

      if (isBackspace) {
        const prevBtn = document.getElementById('prevQuestionBtn');
        if (prevBtn) prevBtn.click();
        return;
      }
    };

    document.addEventListener('keydown', window.__timerOnlyKeyListener, true);
  }

  function setTimerSettingsCollapsed(collapsed) {
    isTimerSettingsCollapsed = !!collapsed;
    const panel = document.getElementById('timerSettingsPanel');
    const fab = document.getElementById('timerSettingsFab');

    if (panel) panel.classList.toggle('collapsed', isTimerSettingsCollapsed);
    if (fab) fab.style.display = isTimerSettingsCollapsed ? 'inline-flex' : 'none';

    save();
  }

  function toggleTimerSettingsPanel() {
    setTimerSettingsCollapsed(!isTimerSettingsCollapsed);
  }

  function updateTimerSetting(setting, value) {
    const numValue = parseFloat(value);
    if (!Number.isFinite(numValue)) return;

    if (setting === 'decimalDigits') {
      timerSettings.decimalDigits = Math.max(0, Math.min(3, Math.floor(numValue)));
      updateTimerDisplay();
      save();
      return;
    }

    if (setting === 'mainTime') {
      timerSettings.mainTime = Math.max(1, Math.min(600, Math.floor(numValue)));
      if (hasTimerStarted) restartTimer();
      save();
      return;
    }

    if (setting === 'additionalTime') {
      timerSettings.additionalTime = Math.max(0, Math.min(600, Math.floor(numValue)));
      if (hasTimerStarted) restartTimer();
      save();
    }
  }

  function applyPreset(mainTime, additionalTime) {
    timerSettings.mainTime = Math.max(1, Math.min(600, Math.floor(mainTime)));
    timerSettings.additionalTime = Math.max(0, Math.min(600, Math.floor(additionalTime)));
    save();

    const mainInput = document.getElementById('mainTimeSetting');
    const addInput = document.getElementById('additionalTimeSetting');
    if (mainInput) mainInput.value = String(timerSettings.mainTime);
    if (addInput) addInput.value = String(timerSettings.additionalTime);

    if (hasTimerStarted) {
      restartTimer();
    } else {
      timerSeconds = timerSettings.mainTime;
      setTimerPhase(false);
      updateTimerDisplay();
    }
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    isTimerRunning = false;
    timerTargetMs = null;
  }

  function startTimer() {
    if (isTimerRunning) return;

    isTimerRunning = true;
    hasTimerStarted = true;
    playBeep(440, 0.1);

    timerTargetMs = getMonotonicNowMs() + (Math.max(0, timerSeconds) * 1000);

    const startBtn = document.getElementById('startTimerBtn');
    const pauseBtn = document.getElementById('pauseTimerBtn');
    const restartBtn = document.getElementById('restartTimerBtn');

    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'inline-block';
    if (restartBtn) restartBtn.style.display = 'none';

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
          timerTargetMs = getMonotonicNowMs() + (Math.max(0, timerSeconds) * 1000);
        } else {
          stopTimer();
          nextQuestion();
          return;
        }
      }

      updateTimerDisplay();

      const remainingWholeSeconds = Math.ceil(timerSeconds);

      if (!isSecondPhase) {
        if (remainingWholeSeconds <= 10 && remainingWholeSeconds > 0 && remainingWholeSeconds !== lastMainBeepSecond) {
          playBeep(440, remainingWholeSeconds === 10 ? 0.1 : 0.05);
          lastMainBeepSecond = remainingWholeSeconds;
        }
      } else {
        if (remainingWholeSeconds > 0 && remainingWholeSeconds !== lastOvertimeBeepSecond) {
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

    const startBtn = document.getElementById('startTimerBtn');
    const pauseBtn = document.getElementById('pauseTimerBtn');
    const restartBtn = document.getElementById('restartTimerBtn');

    if (startBtn) {
      startBtn.innerHTML = '▶ Продолжить';
      startBtn.style.display = 'inline-block';
    }
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = 'inline-block';
  }

  function restartTimer() {
    stopTimer();
    timerSeconds = timerSettings.mainTime;
    setTimerPhase(false);
    hasTimerStarted = false;
    timerTargetMs = null;
    updateTimerDisplay();

    const startBtn = document.getElementById('startTimerBtn');
    const pauseBtn = document.getElementById('pauseTimerBtn');
    const restartBtn = document.getElementById('restartTimerBtn');

    if (startBtn) {
      startBtn.innerHTML = '▶ Начать';
      startBtn.style.display = 'inline-block';
    }
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = 'none';
  }

  function nextQuestion() {
    questionNumber += 1;
    save();

    const qDisplay = document.getElementById('questionNumberDisplay');
    if (qDisplay) qDisplay.textContent = String(questionNumber);

    // Reset for next question
    timerSeconds = timerSettings.mainTime;
    setTimerPhase(false);
    isTimerRunning = false;
    hasTimerStarted = false;
    timerTargetMs = null;
    updateTimerDisplay();

    const startBtn = document.getElementById('startTimerBtn');
    const pauseBtn = document.getElementById('pauseTimerBtn');
    const restartBtn = document.getElementById('restartTimerBtn');

    if (startBtn) {
      startBtn.innerHTML = '▶ Начать';
      startBtn.style.display = 'inline-block';
    }
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = 'none';
  }

  function previousQuestion() {
    questionNumber = Math.max(1, questionNumber - 1);
    save();

    const qDisplay = document.getElementById('questionNumberDisplay');
    if (qDisplay) qDisplay.textContent = String(questionNumber);

    // Reset for previous question
    timerSeconds = timerSettings.mainTime;
    setTimerPhase(false);
    isTimerRunning = false;
    hasTimerStarted = false;
    timerTargetMs = null;
    updateTimerDisplay();

    const startBtn = document.getElementById('startTimerBtn');
    const pauseBtn = document.getElementById('pauseTimerBtn');
    const restartBtn = document.getElementById('restartTimerBtn');

    if (startBtn) {
      startBtn.innerHTML = '▶ Начать';
      startBtn.style.display = 'inline-block';
    }
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = 'none';
  }

  function nextQuestionNow() {
    stopTimer();
    nextQuestion();
  }

  function previousQuestionNow() {
    stopTimer();
    previousQuestion();
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
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);

    // Close context a bit later to avoid leaks in some browsers.
    setTimeout(() => {
      try {
        audioContext.close();
      } catch (e) {
        // ignore
      }
    }, Math.ceil(duration * 1000) + 50);
  }

  function openTimer() {
    const mount = document.getElementById('timerMount');
    if (!mount) return;

    timerSeconds = timerSettings.mainTime;
    isSecondPhase = false;
    isTimerRunning = false;
    hasTimerStarted = false;
    timerTargetMs = null;
    lastMainBeepSecond = null;
    lastOvertimeBeepSecond = null;

    mount.innerHTML = `
      <div class="modal-overlay fullscreen-modal" id="questionTimerModal" onclick="event.stopPropagation()">
        <div class="timer-modal-content">
          <img class="timer-floating-owl" src="timer.png" alt="" aria-hidden="true" data-viewer-src="img/timer-1.jpg">
          <nav class="header-nav header-nav--inverse" aria-label="Навигация">
            <a href="index.html">Инструменты</a>
            <span class="header-nav-sep">|</span>
            <a href="peremeshki.html">Перемешка</a>
            <span class="header-nav-sep">|</span>
            <a href="chgk.html">Турнир</a>
            <span class="header-nav-sep">|</span>
            <a href="timer.html" aria-current="page">Таймер</a>
          </nav>
          <button id="timerSettingsFab" class="timer-settings-fab" title="Настройки таймера">⚙</button>

          <div class="timer-main-content">
            <h1 class="timer-question-title">Вопрос №<span id="questionNumberDisplay">${questionNumber}</span></h1>
            <div class="timer-display" id="timerDisplay">${timerSettings.mainTime.toFixed(timerSettings.decimalDigits)}</div>
            <div class="timer-phase-label" id="phaseLabel">Основное время</div>
          </div>

          <div class="timer-controls">
            <button id="startTimerBtn" class="btn btn-success btn-large">▶ Начать</button>
            <button id="pauseTimerBtn" class="btn btn-warning btn-large" style="display:none;">⏸ Пауза</button>
            <button id="restartTimerBtn" class="btn btn-danger btn-large" style="display:none;">↻ Перезапустить</button>
            <button id="prevQuestionBtn" class="btn btn-secondary btn-large">⏮ Previoius</button>
            <button id="nextQuestionBtn" class="btn btn-primary btn-large">⏭ Следующий</button>
          </div>

          <div class="timer-settings-panel" id="timerSettingsPanel">
            <div class="timer-settings-header">
              <h4>Настройки таймера</h4>
              <button class="timer-settings-collapse" id="timerSettingsCollapseBtn" title="Свернуть">×</button>
            </div>

            <div class="timer-setting">
              <label>Пресеты:</label>
              <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                <button id="preset6010Btn" class="btn btn-secondary btn-small" type="button">60/10</button>
                <button id="preset3010Btn" class="btn btn-secondary btn-small" type="button">30/10</button>
                <button id="preset2019Btn" class="btn btn-secondary btn-small" type="button">20/19</button>
              </div>
            </div>

            <div class="timer-setting">
              <label>Десятичные знаки:</label>
              <input type="number" id="decimalDigitsSetting" min="0" max="3" value="${timerSettings.decimalDigits}">
            </div>
            <div class="timer-setting">
              <label>Основное время (сек):</label>
              <input type="number" id="mainTimeSetting" min="1" max="600" value="${timerSettings.mainTime}">
            </div>
            <div class="timer-setting">
              <label>Доп. время (сек):</label>
              <input type="number" id="additionalTimeSetting" min="0" max="600" value="${timerSettings.additionalTime}">
            </div>
          </div>

          <footer class="timer-page-footer">ЧГК: Таймер | (c) Alexander Galkin, Hamburg | Данные хранятся в локальном хранилище вашего браузера и не передаются на сервер</footer>
        </div>
      </div>
    `;

    ensureTimerKeyListener();

    if (isTimerSettingsCollapsed === null) {
      const shouldCollapseByDefault = window.matchMedia('(max-width: 700px), (max-height: 650px)').matches;
      isTimerSettingsCollapsed = shouldCollapseByDefault;
    }
    setTimerSettingsCollapsed(isTimerSettingsCollapsed);

    // Bind events
    document.getElementById('timerSettingsFab')?.addEventListener('click', toggleTimerSettingsPanel);
    document.getElementById('timerSettingsCollapseBtn')?.addEventListener('click', () => setTimerSettingsCollapsed(true));

    document.getElementById('startTimerBtn')?.addEventListener('click', startTimer);
    document.getElementById('pauseTimerBtn')?.addEventListener('click', pauseTimer);
    document.getElementById('restartTimerBtn')?.addEventListener('click', restartTimer);
    document.getElementById('prevQuestionBtn')?.addEventListener('click', previousQuestionNow);
    document.getElementById('nextQuestionBtn')?.addEventListener('click', nextQuestionNow);

    document.getElementById('decimalDigitsSetting')?.addEventListener('change', (e) => updateTimerSetting('decimalDigits', e.target.value));
    document.getElementById('mainTimeSetting')?.addEventListener('change', (e) => updateTimerSetting('mainTime', e.target.value));
    document.getElementById('additionalTimeSetting')?.addEventListener('change', (e) => updateTimerSetting('additionalTime', e.target.value));

    document.getElementById('preset6010Btn')?.addEventListener('click', () => applyPreset(60, 10));
    document.getElementById('preset3010Btn')?.addEventListener('click', () => applyPreset(30, 10));
    document.getElementById('preset2019Btn')?.addEventListener('click', () => applyPreset(20, 19));

    updateTimerDisplay();
  }

  function init() {
    load();
    openTimer();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
