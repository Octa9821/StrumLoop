const COUNTS = ["1", "+", "2", "+", "3", "+", "4", "+"];
const DIRECTIONS = ["D", "U", "D", "U", "D", "U", "D", "U"];
const STORAGE_KEY = "strumming-pattern-builder:state";

const DEFAULT_STATE = {
  active: [true, false, true, false, true, false, true, false],
  bpm: 90,
  metronomeEnabled: true,
  metronomeVolume: 55,
  strumEnabled: true,
  strumVolume: 70,
};

const PRESETS = {
  "basic-rock": [true, false, true, true, true, false, true, true],
  island: [true, false, false, true, true, false, false, true],
  syncopated: [true, true, false, true, true, false, true, false],
};

const elements = {
  grid: document.getElementById("grid"),
  patternText: document.getElementById("patternText"),
  randomizeBtn: document.getElementById("randomizeBtn"),
  clearBtn: document.getElementById("clearBtn"),
  fillBtn: document.getElementById("fillBtn"),
  playBtn: document.getElementById("playBtn"),
  stopBtn: document.getElementById("stopBtn"),
  bpmInput: document.getElementById("bpmInput"),
  bpmRange: document.getElementById("bpmRange"),
  metronomeToggle: document.getElementById("metronomeToggle"),
  strumToggle: document.getElementById("strumToggle"),
  metronomeVolume: document.getElementById("metronomeVolume"),
  strumVolume: document.getElementById("strumVolume"),
  metronomeStatus: document.getElementById("metronomeStatus"),
  presetButtons: document.querySelectorAll("[data-preset]"),
};

const state = {
  ...loadSavedState(),
  currentStep: -1,
  timerId: null,
  audioContext: null,
};

applyStateToControls();
attachEventListeners();
render();

function loadSavedState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_STATE };
    }

    const parsed = JSON.parse(raw);
    return {
      active: sanitizeActivePattern(parsed.active),
      bpm: clampBpm(parsed.bpm),
      metronomeEnabled: getBooleanSetting(parsed.metronomeEnabled, DEFAULT_STATE.metronomeEnabled),
      metronomeVolume: clampSliderValue(parsed.metronomeVolume, DEFAULT_STATE.metronomeVolume),
      strumEnabled: getBooleanSetting(parsed.strumEnabled, DEFAULT_STATE.strumEnabled),
      strumVolume: clampSliderValue(parsed.strumVolume, DEFAULT_STATE.strumVolume),
    };
  } catch (error) {
    console.warn("Could not load saved state.", error);
    return { ...DEFAULT_STATE };
  }
}

function persistState() {
  const serializableState = {
    active: [...state.active],
    bpm: state.bpm,
    metronomeEnabled: state.metronomeEnabled,
    metronomeVolume: state.metronomeVolume,
    strumEnabled: state.strumEnabled,
    strumVolume: state.strumVolume,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState));
  } catch (error) {
    console.warn("Could not save state.", error);
  }
}

function sanitizeActivePattern(value) {
  if (!Array.isArray(value) || value.length !== COUNTS.length) {
    return [...DEFAULT_STATE.active];
  }

  return value.map((slot) => Boolean(slot));
}

function clampBpm(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_STATE.bpm;
  }

  return Math.min(220, Math.max(40, Math.round(numeric)));
}

function clampSliderValue(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function getBooleanSetting(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function applyStateToControls() {
  elements.bpmInput.value = state.bpm;
  elements.bpmRange.value = state.bpm;
  elements.metronomeToggle.checked = state.metronomeEnabled;
  elements.metronomeVolume.value = state.metronomeVolume;
  elements.strumToggle.checked = state.strumEnabled;
  elements.strumVolume.value = state.strumVolume;
}

function render() {
  renderGrid();
  renderPatternText();
  updateMetronomeStatus();
}

function renderGrid() {
  elements.grid.innerHTML = "";

  COUNTS.forEach((count, index) => {
    const slot = document.createElement("button");
    const classes = ["slot"];

    if (state.active[index]) {
      classes.push("active");
    }

    if (index === state.currentStep) {
      classes.push("current-step");
    }

    slot.className = classes.join(" ");
    slot.type = "button";
    slot.setAttribute("aria-pressed", state.active[index] ? "true" : "false");
    slot.setAttribute(
      "aria-label",
      `${count} ${DIRECTIONS[index]} ${state.active[index] ? "selected" : "not selected"}`
    );

    slot.innerHTML = `
      <div class="slot-number">${count}</div>
      <div class="slot-direction">${DIRECTIONS[index]}</div>
    `;

    slot.addEventListener("click", () => toggleSlot(index));
    elements.grid.appendChild(slot);
  });
}

function renderPatternText() {
  const parts = COUNTS.map((count, index) => {
    if (state.active[index]) {
      return `<strong>${count} ${DIRECTIONS[index]}</strong>`;
    }

    return `${count} -`;
  });

  elements.patternText.innerHTML = parts.join(" &nbsp; • &nbsp; ");
}

function updateMetronomeStatus() {
  const isRunning = Boolean(state.timerId);
  const stepLabel =
    state.currentStep >= 0 ? `${COUNTS[state.currentStep]} ${DIRECTIONS[state.currentStep]}` : "Ready";

  elements.playBtn.textContent = isRunning ? "Playing" : "Start";
  elements.playBtn.setAttribute("aria-pressed", isRunning ? "true" : "false");

  if (!isRunning) {
    elements.metronomeStatus.textContent = `Stopped · eighth-note pulse · ${state.bpm} BPM`;
    return;
  }

  elements.metronomeStatus.textContent = `Playing at ${state.bpm} BPM · current step: ${stepLabel}`;
}

function toggleSlot(index) {
  state.active[index] = !state.active[index];
  persistState();
  render();
}

function setPattern(nextPattern) {
  state.active = sanitizeActivePattern(nextPattern);
  persistState();
  render();
}

function randomizePattern() {
  const randomized = state.active.map((_, index) => {
    const shouldPlay = index % 2 === 0 ? Math.random() > 0.28 : Math.random() > 0.55;
    return shouldPlay;
  });

  if (!randomized.some(Boolean)) {
    randomized[Math.floor(Math.random() * randomized.length)] = true;
  }

  setPattern(randomized);
}

function syncBpm(value) {
  state.bpm = clampBpm(value);
  elements.bpmInput.value = state.bpm;
  elements.bpmRange.value = state.bpm;
  persistState();

  if (state.timerId) {
    restartMetronome();
    return;
  }

  updateMetronomeStatus();
}

function getStepIntervalMs() {
  return 30000 / state.bpm;
}

function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }
}

function playTone({ frequency, volume, duration, type }) {
  if (volume <= 0) {
    return;
  }

  ensureAudioContext();

  const now = state.audioContext.currentTime;
  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(state.audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.01);
}

function playMetronomeClick(stepIndex) {
  if (!state.metronomeEnabled) {
    return;
  }

  const isDownBeat = stepIndex % 2 === 0;
  playTone({
    frequency: isDownBeat ? 950 : 1400,
    volume: (state.metronomeVolume / 100) * (isDownBeat ? 0.45 : 0.34),
    duration: 0.07,
    type: "triangle",
  });
}

function playStrumSound(stepIndex) {
  if (!state.strumEnabled || !state.active[stepIndex]) {
    return;
  }

  const isDownStrum = DIRECTIONS[stepIndex] === "D";
  playTone({
    frequency: isDownStrum ? 220 : 320,
    volume: (state.strumVolume / 100) * 0.4,
    duration: 0.14,
    type: isDownStrum ? "sawtooth" : "square",
  });
}

function tick() {
  state.currentStep = (state.currentStep + 1) % COUNTS.length;
  playMetronomeClick(state.currentStep);
  playStrumSound(state.currentStep);
  render();
}

function startMetronome() {
  if (state.timerId) {
    return;
  }

  ensureAudioContext();
  state.currentStep = -1;
  tick();
  state.timerId = window.setInterval(tick, getStepIntervalMs());
  updateMetronomeStatus();
}

function stopMetronome() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }

  state.currentStep = -1;
  render();
}

function restartMetronome() {
  if (!state.timerId) {
    return;
  }

  window.clearInterval(state.timerId);
  state.timerId = null;
  startMetronome();
}

function toggleMetronome() {
  if (state.timerId) {
    stopMetronome();
    return;
  }

  startMetronome();
}

function updateToggleState(key, checked) {
  state[key] = checked;
  persistState();
}

function updateVolumeState(key, value) {
  state[key] = clampSliderValue(value, DEFAULT_STATE[key]);
  persistState();
}

function clearPattern() {
  setPattern(state.active.map(() => false));
}

function fillPattern() {
  setPattern(state.active.map(() => true));
}

function attachEventListeners() {
  elements.randomizeBtn.addEventListener("click", randomizePattern);
  elements.clearBtn.addEventListener("click", clearPattern);
  elements.fillBtn.addEventListener("click", fillPattern);
  elements.playBtn.addEventListener("click", startMetronome);
  elements.stopBtn.addEventListener("click", stopMetronome);

  elements.bpmInput.addEventListener("input", (event) => {
    syncBpm(event.target.value);
  });

  elements.bpmRange.addEventListener("input", (event) => {
    syncBpm(event.target.value);
  });

  elements.metronomeToggle.addEventListener("change", (event) => {
    updateToggleState("metronomeEnabled", event.target.checked);
  });

  elements.strumToggle.addEventListener("change", (event) => {
    updateToggleState("strumEnabled", event.target.checked);
  });

  elements.metronomeVolume.addEventListener("input", (event) => {
    updateVolumeState("metronomeVolume", event.target.value);
  });

  elements.strumVolume.addEventListener("input", (event) => {
    updateVolumeState("strumVolume", event.target.value);
  });

  elements.presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const presetName = button.getAttribute("data-preset");
      setPattern(PRESETS[presetName]);
    });
  });

  window.addEventListener("keydown", (event) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag && ["INPUT", "TEXTAREA"].includes(activeTag)) {
      return;
    }

    if (event.key >= "1" && event.key <= "8") {
      toggleSlot(Number(event.key) - 1);
    }

    if (event.code === "Space") {
      event.preventDefault();
      toggleMetronome();
    }

    if (event.key.toLowerCase() === "r") {
      randomizePattern();
    }

    if (event.key.toLowerCase() === "c") {
      clearPattern();
    }
  });
}
