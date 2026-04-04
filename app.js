const COUNTS = ["1", "+", "2", "+", "3", "+", "4", "+"];
const DIRECTIONS = ["D", "U", "D", "U", "D", "U", "D", "U"];
const STORAGE_KEY = "strumming-pattern-builder:state";
const SHARE_STATUS_TIMEOUT_MS = 2200;

const DEFAULT_STATE = {
  active: [true, false, true, false, true, false, true, false],
  bpm: 90,
  metronomeEnabled: true,
  metronomeVolume: 55,
  strumEnabled: true,
  strumVolume: 70,
};

const DEFAULT_SHARE_STATUS = "Link updates automatically as you edit.";

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
  copyShareBtn: document.getElementById("copyShareBtn"),
  shareStatus: document.getElementById("shareStatus"),
  presetButtons: document.querySelectorAll("[data-preset]"),
};

const state = {
  ...getInitialState(),
  currentStep: -1,
  timerId: null,
  audioContext: null,
};
let shareStatusTimerId = null;

applyStateToControls();
attachEventListeners();
syncShareUrl();
render();

function getInitialState() {
  return mergeSerializableState(DEFAULT_STATE, loadSavedState(), loadStateFromUrl());
}

function loadSavedState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return sanitizeSerializableState(JSON.parse(raw));
  } catch (error) {
    console.warn("Could not load saved state.", error);
    return null;
  }
}

function loadStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.toString()) {
    return null;
  }

  const pattern = decodePattern(params.get("p"));
  const bpm = parseNumberParam(params.get("b"));
  const metronomeEnabled = parseBooleanParam(params.get("mc"));
  const metronomeVolume = parseNumberParam(params.get("mv"));
  const strumEnabled = parseBooleanParam(params.get("sc"));
  const strumVolume = parseNumberParam(params.get("sv"));

  if (
    pattern === null &&
    bpm === null &&
    metronomeEnabled === null &&
    metronomeVolume === null &&
    strumEnabled === null &&
    strumVolume === null
  ) {
    return null;
  }

  return sanitizePartialSerializableState({
    active: pattern,
    bpm,
    metronomeEnabled,
    metronomeVolume,
    strumEnabled,
    strumVolume,
  });
}

function persistState() {
  const serializableState = getSerializableState();

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState));
  } catch (error) {
    console.warn("Could not save state.", error);
  }
}

function syncStoredState() {
  persistState();
  syncShareUrl();
}

function getSerializableState() {
  return {
    active: [...state.active],
    bpm: state.bpm,
    metronomeEnabled: state.metronomeEnabled,
    metronomeVolume: state.metronomeVolume,
    strumEnabled: state.strumEnabled,
    strumVolume: state.strumVolume,
  };
}

function sanitizeSerializableState(candidate = {}) {
  return {
    active: sanitizeActivePattern(candidate.active),
    bpm: clampBpm(candidate.bpm),
    metronomeEnabled: getBooleanSetting(candidate.metronomeEnabled, DEFAULT_STATE.metronomeEnabled),
    metronomeVolume: clampSliderValue(candidate.metronomeVolume, DEFAULT_STATE.metronomeVolume),
    strumEnabled: getBooleanSetting(candidate.strumEnabled, DEFAULT_STATE.strumEnabled),
    strumVolume: clampSliderValue(candidate.strumVolume, DEFAULT_STATE.strumVolume),
  };
}

function sanitizePartialSerializableState(candidate = {}) {
  return {
    active: candidate.active === null ? null : sanitizeActivePattern(candidate.active),
    bpm: candidate.bpm === null ? null : clampBpm(candidate.bpm),
    metronomeEnabled:
      candidate.metronomeEnabled === null
        ? null
        : getBooleanSetting(candidate.metronomeEnabled, DEFAULT_STATE.metronomeEnabled),
    metronomeVolume:
      candidate.metronomeVolume === null
        ? null
        : clampSliderValue(candidate.metronomeVolume, DEFAULT_STATE.metronomeVolume),
    strumEnabled:
      candidate.strumEnabled === null
        ? null
        : getBooleanSetting(candidate.strumEnabled, DEFAULT_STATE.strumEnabled),
    strumVolume:
      candidate.strumVolume === null ? null : clampSliderValue(candidate.strumVolume, DEFAULT_STATE.strumVolume),
  };
}

function mergeSerializableState(...candidates) {
  return candidates.reduce((merged, candidate) => {
    if (!candidate) {
      return merged;
    }

    return {
      active: candidate.active ?? merged.active,
      bpm: candidate.bpm ?? merged.bpm,
      metronomeEnabled: candidate.metronomeEnabled ?? merged.metronomeEnabled,
      metronomeVolume: candidate.metronomeVolume ?? merged.metronomeVolume,
      strumEnabled: candidate.strumEnabled ?? merged.strumEnabled,
      strumVolume: candidate.strumVolume ?? merged.strumVolume,
    };
  }, sanitizeSerializableState(DEFAULT_STATE));
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

function parseNumberParam(value) {
  if (value === null) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseBooleanParam(value) {
  if (value === "1") {
    return true;
  }

  if (value === "0") {
    return false;
  }

  return null;
}

function encodePattern(pattern) {
  const binary = pattern.map((slot) => (slot ? "1" : "0")).join("");
  return Number.parseInt(binary, 2).toString(16).padStart(2, "0");
}

function decodePattern(value) {
  if (!value || !/^[\da-f]{1,2}$/i.test(value)) {
    return null;
  }

  const numeric = Number.parseInt(value, 16);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric
    .toString(2)
    .padStart(COUNTS.length, "0")
    .slice(-COUNTS.length)
    .split("")
    .map((digit) => digit === "1");
}

function buildShareUrl() {
  const url = new URL(window.location.href);
  const serializableState = getSerializableState();

  url.search = "";
  url.searchParams.set("p", encodePattern(serializableState.active));
  url.searchParams.set("b", String(serializableState.bpm));
  url.searchParams.set("mc", serializableState.metronomeEnabled ? "1" : "0");
  url.searchParams.set("mv", String(serializableState.metronomeVolume));
  url.searchParams.set("sc", serializableState.strumEnabled ? "1" : "0");
  url.searchParams.set("sv", String(serializableState.strumVolume));

  return url;
}

function syncShareUrl() {
  const nextUrl = buildShareUrl();
  window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

function setShareStatus(message, isTemporary = false) {
  elements.shareStatus.textContent = message;

  if (shareStatusTimerId) {
    window.clearTimeout(shareStatusTimerId);
    shareStatusTimerId = null;
  }

  if (isTemporary) {
    shareStatusTimerId = window.setTimeout(() => {
      elements.shareStatus.textContent = DEFAULT_SHARE_STATUS;
      shareStatusTimerId = null;
    }, SHARE_STATUS_TIMEOUT_MS);
  }
}

async function copyShareLink() {
  const shareUrl = buildShareUrl().toString();

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Share link copied.", true);
      return;
    }

    const helper = document.createElement("input");
    helper.value = shareUrl;
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    setShareStatus("Share link copied.", true);
  } catch (error) {
    console.warn("Could not copy share link.", error);
    setShareStatus("Copy failed. You can still copy the URL from the address bar.", true);
  }
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
  syncStoredState();
  render();
}

function setPattern(nextPattern) {
  state.active = sanitizeActivePattern(nextPattern);
  syncStoredState();
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
  syncStoredState();

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
  syncStoredState();
}

function updateVolumeState(key, value) {
  state[key] = clampSliderValue(value, DEFAULT_STATE[key]);
  syncStoredState();
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
  elements.copyShareBtn.addEventListener("click", copyShareLink);

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
