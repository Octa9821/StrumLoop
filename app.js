const SUBDIVISION_MODES = {
  eighth: "8th",
  sixteenth: "16th",
};
const STORAGE_KEY = "strumming-pattern-builder:state";
const SHARE_STATUS_TIMEOUT_MS = 2200;
const TAP_TEMPO_RESET_MS = 2200;
const TAP_TEMPO_SAMPLE_LIMIT = 6;
const SCHEDULER_LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.12;
const FIRST_NOTE_LEAD_SECONDS = 0.04;

const DEFAULT_STATE = {
  subdivisionMode: SUBDIVISION_MODES.eighth,
  active: [true, false, true, false, true, false, true, false],
  bpm: 90,
  metronomeEnabled: true,
  metronomeDownEnabled: true,
  metronomeUpEnabled: true,
  metronomeVolume: 55,
  strumEnabled: true,
  strumDownEnabled: true,
  strumUpEnabled: true,
  strumVolume: 70,
};

const DEFAULT_SHARE_STATUS = "Link updates automatically as you edit.";

const PRESETS = [
  {
    id: "basic-rock",
    label: "Basic Rock",
    mode: SUBDIVISION_MODES.eighth,
    pattern: [true, false, true, true, true, false, true, true],
  },
  {
    id: "island",
    label: "Island",
    mode: SUBDIVISION_MODES.eighth,
    pattern: [true, false, false, true, true, false, false, true],
  },
  {
    id: "old-faithful",
    label: "Old Faithful",
    mode: SUBDIVISION_MODES.eighth,
    pattern: [true, false, true, true, false, true, true, false],
  },
  {
    id: "syncopated",
    label: "Syncopated",
    mode: SUBDIVISION_MODES.eighth,
    pattern: [true, true, false, true, true, false, true, false],
  },
  {
    id: "straight-eighths",
    label: "Straight Eighths",
    mode: SUBDIVISION_MODES.eighth,
    pattern: [true, true, true, true, true, true, true, true],
  },
  {
    id: "downbeat-drive",
    label: "Downbeat Drive",
    mode: SUBDIVISION_MODES.eighth,
    pattern: [true, false, true, false, true, false, true, false],
  },
  {
    id: "reggae-lift",
    label: "Reggae Lift",
    mode: SUBDIVISION_MODES.eighth,
    pattern: [false, true, false, true, false, true, false, true],
  },
  {
    id: "pop-push",
    label: "Pop Push",
    mode: SUBDIVISION_MODES.eighth,
    pattern: [true, false, true, true, true, true, true, false],
  },
  {
    id: "straight-16ths",
    label: "Straight 16ths",
    mode: SUBDIVISION_MODES.sixteenth,
    pattern: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
  },
  {
    id: "funk-pocket",
    label: "Funk Pocket",
    mode: SUBDIVISION_MODES.sixteenth,
    pattern: [true, false, true, false, true, false, false, true, true, false, true, false, true, false, false, true],
  },
  {
    id: "gallop",
    label: "Gallop",
    mode: SUBDIVISION_MODES.sixteenth,
    pattern: [true, true, true, false, true, true, true, false, true, true, true, false, true, true, true, false],
  },
  {
    id: "offbeat-funk",
    label: "Offbeat Funk",
    mode: SUBDIVISION_MODES.sixteenth,
    pattern: [false, true, true, false, true, false, true, false, false, true, true, false, true, false, true, false],
  },
  {
    id: "syncopated-16ths",
    label: "Syncopated 16ths",
    mode: SUBDIVISION_MODES.sixteenth,
    pattern: [true, false, false, true, true, false, true, false, false, true, true, false, true, false, false, true],
  },
  {
    id: "choppy-16ths",
    label: "Choppy 16ths",
    mode: SUBDIVISION_MODES.sixteenth,
    pattern: [true, false, true, false, false, true, false, true, true, false, true, false, false, true, false, true],
  },
];

const elements = {
  grid: document.getElementById("grid"),
  patternText: document.getElementById("patternText"),
  randomizeBtn: document.getElementById("randomizeBtn"),
  clearBtn: document.getElementById("clearBtn"),
  fillBtn: document.getElementById("fillBtn"),
  playBtn: document.getElementById("playBtn"),
  stopBtn: document.getElementById("stopBtn"),
  tapTempoBtn: document.getElementById("tapTempoBtn"),
  eighthModeBtn: document.getElementById("eighthModeBtn"),
  sixteenthModeBtn: document.getElementById("sixteenthModeBtn"),
  bpmInput: document.getElementById("bpmInput"),
  bpmRange: document.getElementById("bpmRange"),
  metronomeToggle: document.getElementById("metronomeToggle"),
  metronomeDownToggle: document.getElementById("metronomeDownToggle"),
  metronomeUpToggle: document.getElementById("metronomeUpToggle"),
  strumToggle: document.getElementById("strumToggle"),
  strumDownToggle: document.getElementById("strumDownToggle"),
  strumUpToggle: document.getElementById("strumUpToggle"),
  metronomeVolume: document.getElementById("metronomeVolume"),
  strumVolume: document.getElementById("strumVolume"),
  metronomeStatus: document.getElementById("metronomeStatus"),
  copyShareBtn: document.getElementById("copyShareBtn"),
  shareStatus: document.getElementById("shareStatus"),
  presetModeLabel: document.getElementById("presetModeLabel"),
  presetGrid: document.getElementById("presetGrid"),
};

const state = {
  ...getInitialState(),
  currentStep: -1,
  timerId: null,
  audioContext: null,
  nextStepIndex: 0,
  nextNoteTime: 0,
  uiStepTimeoutIds: [],
};
let shareStatusTimerId = null;
let tapTempoTimestamps = [];

applyStateToControls();
attachEventListeners();
syncShareUrl();
renderPresetLibrary();
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

  const subdivisionMode = parseSubdivisionMode(params.get("m")) ?? inferSubdivisionModeFromPattern(params.get("p"));
  const pattern = decodePattern(params.get("p"), subdivisionMode ?? DEFAULT_STATE.subdivisionMode);
  const bpm = parseNumberParam(params.get("b"));
  const metronomeEnabled = parseBooleanParam(params.get("mc"));
  const metronomeDownEnabled = parseBooleanParam(params.get("md"));
  const metronomeUpEnabled = parseBooleanParam(params.get("mu"));
  const metronomeVolume = parseNumberParam(params.get("mv"));
  const strumEnabled = parseBooleanParam(params.get("sc"));
  const strumDownEnabled = parseBooleanParam(params.get("sd"));
  const strumUpEnabled = parseBooleanParam(params.get("su"));
  const strumVolume = parseNumberParam(params.get("sv"));

  if (
    pattern === null &&
    subdivisionMode === null &&
    bpm === null &&
    metronomeEnabled === null &&
    metronomeDownEnabled === null &&
    metronomeUpEnabled === null &&
    metronomeVolume === null &&
    strumEnabled === null &&
    strumDownEnabled === null &&
    strumUpEnabled === null &&
    strumVolume === null
  ) {
    return null;
  }

  return sanitizePartialSerializableState({
    subdivisionMode,
    active: pattern,
    bpm,
    metronomeEnabled,
    metronomeDownEnabled,
    metronomeUpEnabled,
    metronomeVolume,
    strumEnabled,
    strumDownEnabled,
    strumUpEnabled,
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
    subdivisionMode: state.subdivisionMode,
    active: [...state.active],
    bpm: state.bpm,
    metronomeEnabled: state.metronomeEnabled,
    metronomeDownEnabled: state.metronomeDownEnabled,
    metronomeUpEnabled: state.metronomeUpEnabled,
    metronomeVolume: state.metronomeVolume,
    strumEnabled: state.strumEnabled,
    strumDownEnabled: state.strumDownEnabled,
    strumUpEnabled: state.strumUpEnabled,
    strumVolume: state.strumVolume,
  };
}

function sanitizeSerializableState(candidate = {}) {
  const subdivisionMode = sanitizeSubdivisionMode(candidate.subdivisionMode);

  return {
    subdivisionMode,
    active: sanitizeActivePattern(candidate.active, subdivisionMode),
    bpm: clampBpm(candidate.bpm),
    metronomeEnabled: getBooleanSetting(candidate.metronomeEnabled, DEFAULT_STATE.metronomeEnabled),
    metronomeDownEnabled: getBooleanSetting(candidate.metronomeDownEnabled, DEFAULT_STATE.metronomeDownEnabled),
    metronomeUpEnabled: getBooleanSetting(candidate.metronomeUpEnabled, DEFAULT_STATE.metronomeUpEnabled),
    metronomeVolume: clampSliderValue(candidate.metronomeVolume, DEFAULT_STATE.metronomeVolume),
    strumEnabled: getBooleanSetting(candidate.strumEnabled, DEFAULT_STATE.strumEnabled),
    strumDownEnabled: getBooleanSetting(candidate.strumDownEnabled, DEFAULT_STATE.strumDownEnabled),
    strumUpEnabled: getBooleanSetting(candidate.strumUpEnabled, DEFAULT_STATE.strumUpEnabled),
    strumVolume: clampSliderValue(candidate.strumVolume, DEFAULT_STATE.strumVolume),
  };
}

function sanitizePartialSerializableState(candidate = {}) {
  const subdivisionMode =
    candidate.subdivisionMode === null || candidate.subdivisionMode === undefined
      ? null
      : sanitizeSubdivisionMode(candidate.subdivisionMode);
  const activeMode = subdivisionMode ?? DEFAULT_STATE.subdivisionMode;

  return {
    subdivisionMode,
    active: candidate.active === null ? null : sanitizeActivePattern(candidate.active, activeMode),
    bpm: candidate.bpm === null ? null : clampBpm(candidate.bpm),
    metronomeEnabled:
      candidate.metronomeEnabled === null
        ? null
        : getBooleanSetting(candidate.metronomeEnabled, DEFAULT_STATE.metronomeEnabled),
    metronomeDownEnabled:
      candidate.metronomeDownEnabled === null
        ? null
        : getBooleanSetting(candidate.metronomeDownEnabled, DEFAULT_STATE.metronomeDownEnabled),
    metronomeUpEnabled:
      candidate.metronomeUpEnabled === null
        ? null
        : getBooleanSetting(candidate.metronomeUpEnabled, DEFAULT_STATE.metronomeUpEnabled),
    metronomeVolume:
      candidate.metronomeVolume === null
        ? null
        : clampSliderValue(candidate.metronomeVolume, DEFAULT_STATE.metronomeVolume),
    strumEnabled:
      candidate.strumEnabled === null
        ? null
        : getBooleanSetting(candidate.strumEnabled, DEFAULT_STATE.strumEnabled),
    strumDownEnabled:
      candidate.strumDownEnabled === null
        ? null
        : getBooleanSetting(candidate.strumDownEnabled, DEFAULT_STATE.strumDownEnabled),
    strumUpEnabled:
      candidate.strumUpEnabled === null
        ? null
        : getBooleanSetting(candidate.strumUpEnabled, DEFAULT_STATE.strumUpEnabled),
    strumVolume:
      candidate.strumVolume === null ? null : clampSliderValue(candidate.strumVolume, DEFAULT_STATE.strumVolume),
  };
}

function mergeSerializableState(...candidates) {
  return candidates.reduce((merged, candidate) => {
    if (!candidate) {
      return merged;
    }

    const nextSubdivisionMode = candidate.subdivisionMode ?? merged.subdivisionMode;
    const nextActive =
      candidate.active ??
      (nextSubdivisionMode !== merged.subdivisionMode
        ? convertPatternToMode(merged.active, nextSubdivisionMode)
        : merged.active);

    return sanitizeSerializableState({
      subdivisionMode: nextSubdivisionMode,
      active: nextActive,
      bpm: candidate.bpm ?? merged.bpm,
      metronomeEnabled: candidate.metronomeEnabled ?? merged.metronomeEnabled,
      metronomeDownEnabled: candidate.metronomeDownEnabled ?? merged.metronomeDownEnabled,
      metronomeUpEnabled: candidate.metronomeUpEnabled ?? merged.metronomeUpEnabled,
      metronomeVolume: candidate.metronomeVolume ?? merged.metronomeVolume,
      strumEnabled: candidate.strumEnabled ?? merged.strumEnabled,
      strumDownEnabled: candidate.strumDownEnabled ?? merged.strumDownEnabled,
      strumUpEnabled: candidate.strumUpEnabled ?? merged.strumUpEnabled,
      strumVolume: candidate.strumVolume ?? merged.strumVolume,
    });
  }, sanitizeSerializableState(DEFAULT_STATE));
}

function sanitizeSubdivisionMode(value) {
  return value === SUBDIVISION_MODES.sixteenth ? SUBDIVISION_MODES.sixteenth : SUBDIVISION_MODES.eighth;
}

function getSubdivisions(mode = state.subdivisionMode) {
  if (mode === SUBDIVISION_MODES.sixteenth) {
    return [
      { count: "1", direction: "D" },
      { count: "e", direction: "U" },
      { count: "+", direction: "D" },
      { count: "a", direction: "U" },
      { count: "2", direction: "D" },
      { count: "e", direction: "U" },
      { count: "+", direction: "D" },
      { count: "a", direction: "U" },
      { count: "3", direction: "D" },
      { count: "e", direction: "U" },
      { count: "+", direction: "D" },
      { count: "a", direction: "U" },
      { count: "4", direction: "D" },
      { count: "e", direction: "U" },
      { count: "+", direction: "D" },
      { count: "a", direction: "U" },
    ];
  }

  return [
    { count: "1", direction: "D" },
    { count: "+", direction: "U" },
    { count: "2", direction: "D" },
    { count: "+", direction: "U" },
    { count: "3", direction: "D" },
    { count: "+", direction: "U" },
    { count: "4", direction: "D" },
    { count: "+", direction: "U" },
  ];
}

function getSubdivisionCount(mode = state.subdivisionMode) {
  return getSubdivisions(mode).length;
}

function sanitizeActivePattern(value, mode = DEFAULT_STATE.subdivisionMode) {
  const expectedLength = getSubdivisionCount(mode);
  const fallback =
    mode === DEFAULT_STATE.subdivisionMode
      ? [...DEFAULT_STATE.active]
      : Array.from({ length: expectedLength }, (_, index) => (index % 4 === 0 ? true : false));

  if (!Array.isArray(value) || value.length !== expectedLength) {
    return fallback;
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

function parseSubdivisionMode(value) {
  if (value === SUBDIVISION_MODES.eighth || value === SUBDIVISION_MODES.sixteenth) {
    return value;
  }

  return null;
}

function inferSubdivisionModeFromPattern(value) {
  if (!value || !/^[\da-f]{1,4}$/i.test(value)) {
    return null;
  }

  return value.length > 2 ? SUBDIVISION_MODES.sixteenth : SUBDIVISION_MODES.eighth;
}

function encodePattern(pattern) {
  const binary = pattern.map((slot) => (slot ? "1" : "0")).join("");
  const width = Math.ceil(pattern.length / 4);
  return Number.parseInt(binary, 2).toString(16).padStart(width, "0");
}

function decodePattern(value, mode = DEFAULT_STATE.subdivisionMode) {
  const expectedLength = getSubdivisionCount(mode);
  const expectedWidth = Math.ceil(expectedLength / 4);

  if (!value || !new RegExp(`^[\\da-f]{1,${expectedWidth}}$`, "i").test(value)) {
    return null;
  }

  const numeric = Number.parseInt(value, 16);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric
    .toString(2)
    .padStart(expectedLength, "0")
    .slice(-expectedLength)
    .split("")
    .map((digit) => digit === "1");
}

function buildShareUrl() {
  const url = new URL(window.location.href);
  const serializableState = getSerializableState();

  url.search = "";
  url.searchParams.set("m", serializableState.subdivisionMode);
  url.searchParams.set("p", encodePattern(serializableState.active));
  url.searchParams.set("b", String(serializableState.bpm));
  url.searchParams.set("mc", serializableState.metronomeEnabled ? "1" : "0");
  url.searchParams.set("md", serializableState.metronomeDownEnabled ? "1" : "0");
  url.searchParams.set("mu", serializableState.metronomeUpEnabled ? "1" : "0");
  url.searchParams.set("mv", String(serializableState.metronomeVolume));
  url.searchParams.set("sc", serializableState.strumEnabled ? "1" : "0");
  url.searchParams.set("sd", serializableState.strumDownEnabled ? "1" : "0");
  url.searchParams.set("su", serializableState.strumUpEnabled ? "1" : "0");
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
  elements.eighthModeBtn.setAttribute("aria-pressed", state.subdivisionMode === SUBDIVISION_MODES.eighth ? "true" : "false");
  elements.sixteenthModeBtn.setAttribute(
    "aria-pressed",
    state.subdivisionMode === SUBDIVISION_MODES.sixteenth ? "true" : "false"
  );
  elements.bpmInput.value = state.bpm;
  elements.bpmRange.value = state.bpm;
  elements.metronomeToggle.checked = state.metronomeEnabled;
  elements.metronomeDownToggle.checked = state.metronomeDownEnabled;
  elements.metronomeUpToggle.checked = state.metronomeUpEnabled;
  elements.metronomeVolume.value = state.metronomeVolume;
  elements.strumToggle.checked = state.strumEnabled;
  elements.strumDownToggle.checked = state.strumDownEnabled;
  elements.strumUpToggle.checked = state.strumUpEnabled;
  elements.strumVolume.value = state.strumVolume;
}

function render() {
  renderGrid();
  renderPatternText();
  updateMetronomeStatus();
}

function renderPresetLibrary() {
  const visiblePresets = PRESETS.filter((preset) => preset.mode === state.subdivisionMode);
  const modeLabel = state.subdivisionMode === SUBDIVISION_MODES.sixteenth ? "16th-note presets" : "8th-note presets";

  elements.presetModeLabel.textContent = `${modeLabel} • ${visiblePresets.length} patterns`;
  elements.presetGrid.innerHTML = visiblePresets
    .map(
      (preset) => `
        <button
          class="secondary preset-button ${isPresetActive(preset) ? "is-active" : ""}"
          data-preset-id="${preset.id}"
          type="button"
          aria-pressed="${isPresetActive(preset) ? "true" : "false"}"
        >
          ${preset.label}
        </button>
      `
    )
    .join("");
}

function isPresetActive(preset) {
  return (
    preset.mode === state.subdivisionMode &&
    preset.pattern.length === state.active.length &&
    preset.pattern.every((slot, index) => slot === state.active[index])
  );
}

function renderGrid() {
  const subdivisions = getSubdivisions();
  elements.grid.innerHTML = "";
  elements.grid.dataset.mode = state.subdivisionMode;

  subdivisions.forEach(({ count, direction }, index) => {
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
      `${count} ${direction} ${state.active[index] ? "selected" : "not selected"}`
    );

    slot.innerHTML = `
      <div class="slot-number">${count}</div>
      <div class="slot-direction">${direction}</div>
    `;

    slot.addEventListener("click", () => toggleSlot(index));
    elements.grid.appendChild(slot);
  });
}

function renderPatternText() {
  const subdivisions = getSubdivisions();
  const parts = subdivisions.map(({ count, direction }, index) => {
    if (state.active[index]) {
      return `<strong>${count} ${direction}</strong>`;
    }

    return `${count} -`;
  });

  elements.patternText.innerHTML = parts.join(" &nbsp; • &nbsp; ");
}

function updateMetronomeStatus() {
  const isRunning = Boolean(state.timerId);
  const subdivisions = getSubdivisions();
  const stepLabel =
    state.currentStep >= 0 ? `${subdivisions[state.currentStep].count} ${subdivisions[state.currentStep].direction}` : "Ready";
  const pulseLabel = state.subdivisionMode === SUBDIVISION_MODES.sixteenth ? "Sixteenth-note pulse" : "Eighth-note pulse";

  elements.playBtn.textContent = isRunning ? "Playing" : "Start";
  elements.playBtn.setAttribute("aria-pressed", isRunning ? "true" : "false");

  if (!isRunning) {
    setMetronomeStatus({
      title: "Stopped",
      detail: pulseLabel,
      bpm: state.bpm,
    });
    return;
  }

  setMetronomeStatus({
    title: "Playing",
    detail: `Current step: ${stepLabel}`,
    bpm: state.bpm,
  });
}

function registerTapTempo() {
  const now = Date.now();
  const lastTap = tapTempoTimestamps.at(-1);

  if (lastTap && now - lastTap > TAP_TEMPO_RESET_MS) {
    tapTempoTimestamps = [];
  }

  tapTempoTimestamps.push(now);

  if (tapTempoTimestamps.length > TAP_TEMPO_SAMPLE_LIMIT) {
    tapTempoTimestamps = tapTempoTimestamps.slice(-TAP_TEMPO_SAMPLE_LIMIT);
  }

  if (tapTempoTimestamps.length < 2) {
    setMetronomeStatus({
      title: "Tap tempo",
      detail: "Tap again to set the tempo",
      bpm: null,
    });
    return;
  }

  const intervals = [];
  for (let index = 1; index < tapTempoTimestamps.length; index += 1) {
    intervals.push(tapTempoTimestamps[index] - tapTempoTimestamps[index - 1]);
  }

  const averageIntervalMs = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const tappedBpm = Math.round(60000 / averageIntervalMs);

  syncBpm(tappedBpm);
  setMetronomeStatus({
    title: "Tapped tempo",
    detail: "Averaged from your recent taps",
    bpm: state.bpm,
  });
}

function setMetronomeStatus({ title, detail, bpm }) {
  const bpmMarkup = Number.isFinite(bpm) ? `<span class="status-bpm">${bpm} BPM</span>` : "";
  const detailMarkup = detail ? `<span class="status-detail">${detail}</span>` : "";

  elements.metronomeStatus.innerHTML = `
    <span class="status-title">${title}</span>
    <span class="status-meta">${detailMarkup}${bpmMarkup}</span>
  `;
}

function convertPatternToMode(pattern, nextMode) {
  if (nextMode === SUBDIVISION_MODES.sixteenth) {
    return Array.from({ length: 16 }, (_, index) => (index % 2 === 0 ? Boolean(pattern[index / 2]) : false));
  }

  return Array.from({ length: 8 }, (_, index) => Boolean(pattern[index * 2]));
}

function toggleSlot(index) {
  state.active[index] = !state.active[index];
  syncStoredState();
  renderPresetLibrary();
  render();
}

function setPattern(nextPattern) {
  if (!Array.isArray(nextPattern)) {
    return;
  }

  state.active = sanitizeActivePattern(nextPattern, state.subdivisionMode);
  syncStoredState();
  renderPresetLibrary();
  render();
}

function setSubdivisionMode(nextMode) {
  const sanitizedMode = sanitizeSubdivisionMode(nextMode);

  if (sanitizedMode === state.subdivisionMode) {
    return;
  }

  const wasRunning = Boolean(state.timerId);
  if (wasRunning) {
    stopMetronome();
  }

  state.subdivisionMode = sanitizedMode;
  state.active = sanitizeActivePattern(convertPatternToMode(state.active, sanitizedMode), sanitizedMode);
  tapTempoTimestamps = [];
  applyStateToControls();
  syncStoredState();
  renderPresetLibrary();
  render();

  if (wasRunning) {
    startMetronome();
  }
}

function randomizePattern() {
  const subdivisions = getSubdivisions();
  const randomized = state.active.map((_, index) => {
    const isDownStrum = subdivisions[index].direction === "D";
    const threshold = state.subdivisionMode === SUBDIVISION_MODES.sixteenth ? (isDownStrum ? 0.5 : 0.72) : isDownStrum ? 0.28 : 0.55;
    const shouldPlay = Math.random() > threshold;
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

function handleBpmTextInput(value) {
  elements.bpmInput.value = value;

  if (value.trim() === "") {
    return;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return;
  }

  state.bpm = clampBpm(numeric);
  elements.bpmRange.value = state.bpm;
  syncStoredState();

  if (state.timerId) {
    restartMetronome();
    return;
  }

  updateMetronomeStatus();
}

function commitBpmInputValue() {
  syncBpm(elements.bpmInput.value);
}

function getStepIntervalMs() {
  return state.subdivisionMode === SUBDIVISION_MODES.sixteenth ? 15000 / state.bpm : 30000 / state.bpm;
}

function getStepIntervalSeconds() {
  return getStepIntervalMs() / 1000;
}

function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }
}

function playToneAt({ frequency, volume, duration, type, when, attack = 0.006, releaseShape = "exponential" }) {
  if (volume <= 0) {
    return;
  }

  ensureAudioContext();

  const now = Math.max(state.audioContext.currentTime, when ?? state.audioContext.currentTime);
  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + attack);

  if (releaseShape === "linear") {
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);
  } else {
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  oscillator.connect(gain);
  gain.connect(state.audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.01);
}

function playMetronomeClick(stepIndex, when) {
  if (!state.metronomeEnabled) {
    return;
  }

  const isDownBeat = getSubdivisions()[stepIndex].direction === "D";
  if ((isDownBeat && !state.metronomeDownEnabled) || (!isDownBeat && !state.metronomeUpEnabled)) {
    return;
  }

  const baseVolume = state.metronomeVolume / 100;
  playToneAt({
    frequency: isDownBeat ? 1180 : 1620,
    volume: baseVolume * (isDownBeat ? 0.24 : 0.16),
    duration: isDownBeat ? 0.045 : 0.032,
    type: "sine",
    when,
    attack: 0.002,
  });

  playToneAt({
    frequency: isDownBeat ? 860 : 1220,
    volume: baseVolume * (isDownBeat ? 0.1 : 0.07),
    duration: isDownBeat ? 0.06 : 0.04,
    type: "triangle",
    when,
    attack: 0.0025,
  });
}

function playStrumSound(stepIndex, when) {
  if (!state.strumEnabled || !state.active[stepIndex]) {
    return;
  }

  const isDownStrum = getSubdivisions()[stepIndex].direction === "D";
  if ((isDownStrum && !state.strumDownEnabled) || (!isDownStrum && !state.strumUpEnabled)) {
    return;
  }

  const baseVolume = state.strumVolume / 100;
  const voiceFrequencies = isDownStrum ? [196, 247, 294] : [294, 370, 440];
  const voiceOffsets = isDownStrum ? [0, 0.012, 0.022] : [0, 0.01, 0.018];

  voiceFrequencies.forEach((frequency, index) => {
    playToneAt({
      frequency,
      volume: baseVolume * (0.11 - index * 0.02),
      duration: 0.11 + index * 0.018,
      type: index === 1 ? "triangle" : "sine",
      when: when + voiceOffsets[index],
      attack: 0.003,
      releaseShape: "linear",
    });
  });
}

function clearScheduledUiSteps() {
  state.uiStepTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  state.uiStepTimeoutIds = [];
}

function scheduleUiStep(stepIndex, when) {
  const delay = Math.max(0, (when - state.audioContext.currentTime) * 1000);
  const timeoutId = window.setTimeout(() => {
    state.uiStepTimeoutIds = state.uiStepTimeoutIds.filter((id) => id !== timeoutId);
    state.currentStep = stepIndex;
    render();
  }, delay);

  state.uiStepTimeoutIds.push(timeoutId);
}

function scheduleStep(stepIndex, when) {
  playMetronomeClick(stepIndex, when);
  playStrumSound(stepIndex, when);
  scheduleUiStep(stepIndex, when);
}

function runScheduler() {
  if (!state.audioContext) {
    return;
  }

  const scheduleUntil = state.audioContext.currentTime + SCHEDULE_AHEAD_SECONDS;
  while (state.nextNoteTime < scheduleUntil) {
    scheduleStep(state.nextStepIndex, state.nextNoteTime);
    state.nextNoteTime += getStepIntervalSeconds();
    state.nextStepIndex = (state.nextStepIndex + 1) % getSubdivisionCount();
  }
}

function startMetronome() {
  if (state.timerId) {
    return;
  }

  ensureAudioContext();
  clearScheduledUiSteps();
  state.currentStep = -1;
  state.nextStepIndex = 0;
  state.nextNoteTime = state.audioContext.currentTime + FIRST_NOTE_LEAD_SECONDS;
  runScheduler();
  state.timerId = window.setInterval(runScheduler, SCHEDULER_LOOKAHEAD_MS);
  updateMetronomeStatus();
}

function stopMetronome() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }

  clearScheduledUiSteps();
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

function getPresetPattern(presetId, mode = state.subdivisionMode) {
  const preset = PRESETS.find((candidate) => candidate.id === presetId && candidate.mode === mode);
  if (!preset) {
    return null;
  }

  return [...preset.pattern];
}

function attachEventListeners() {
  elements.randomizeBtn.addEventListener("click", randomizePattern);
  elements.clearBtn.addEventListener("click", clearPattern);
  elements.fillBtn.addEventListener("click", fillPattern);
  elements.playBtn.addEventListener("click", startMetronome);
  elements.stopBtn.addEventListener("click", stopMetronome);
  elements.tapTempoBtn.addEventListener("click", registerTapTempo);
  elements.eighthModeBtn.addEventListener("click", () => {
    setSubdivisionMode(SUBDIVISION_MODES.eighth);
  });
  elements.sixteenthModeBtn.addEventListener("click", () => {
    setSubdivisionMode(SUBDIVISION_MODES.sixteenth);
  });
  elements.copyShareBtn.addEventListener("click", copyShareLink);

  elements.bpmInput.addEventListener("input", (event) => {
    handleBpmTextInput(event.target.value);
  });

  elements.bpmRange.addEventListener("input", (event) => {
    syncBpm(event.target.value);
  });

  elements.bpmInput.addEventListener("blur", commitBpmInputValue);
  elements.bpmInput.addEventListener("change", commitBpmInputValue);

  elements.metronomeToggle.addEventListener("change", (event) => {
    updateToggleState("metronomeEnabled", event.target.checked);
  });

  elements.metronomeDownToggle.addEventListener("change", (event) => {
    updateToggleState("metronomeDownEnabled", event.target.checked);
  });

  elements.metronomeUpToggle.addEventListener("change", (event) => {
    updateToggleState("metronomeUpEnabled", event.target.checked);
  });

  elements.strumToggle.addEventListener("change", (event) => {
    updateToggleState("strumEnabled", event.target.checked);
  });

  elements.strumDownToggle.addEventListener("change", (event) => {
    updateToggleState("strumDownEnabled", event.target.checked);
  });

  elements.strumUpToggle.addEventListener("change", (event) => {
    updateToggleState("strumUpEnabled", event.target.checked);
  });

  elements.metronomeVolume.addEventListener("input", (event) => {
    updateVolumeState("metronomeVolume", event.target.value);
  });

  elements.strumVolume.addEventListener("input", (event) => {
    updateVolumeState("strumVolume", event.target.value);
  });

  elements.presetGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset-id]");
    if (!button) {
      return;
    }

    const presetId = button.getAttribute("data-preset-id");
    setPattern(getPresetPattern(presetId));
  });

  window.addEventListener("keydown", (event) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag && ["INPUT", "TEXTAREA"].includes(activeTag)) {
      return;
    }

    const slotShortcutMap = {
      1: 0,
      2: 1,
      3: 2,
      4: 3,
      5: 4,
      6: 5,
      7: 6,
      8: 7,
      q: 8,
      w: 9,
      e: 10,
      r: 11,
      a: 12,
      s: 13,
      d: 14,
      f: 15,
    };
    const slotIndex = slotShortcutMap[event.key.toLowerCase()];

    if (Number.isInteger(slotIndex) && slotIndex < state.active.length) {
      toggleSlot(slotIndex);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      toggleMetronome();
    }

    if (event.key.toLowerCase() === "t") {
      registerTapTempo();
    }

    if (event.key.toLowerCase() === "r") {
      randomizePattern();
    }

    if (event.key.toLowerCase() === "c") {
      clearPattern();
    }
  });
}
