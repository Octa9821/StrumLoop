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
const DESKTOP_TWO_BAR_QUERY = "(min-width: 900px)";
const DEFAULT_STATE = {
  subdivisionMode: SUBDIVISION_MODES.eighth,
  active: [true, false, true, false, true, false, true, false],
  activeBarTwo: [true, false, true, false, true, false, true, false],
  bpm: 90,
  loopBars: 1,
  countInEnabled: false,
  practiceRampEnabled: false,
  practiceRampStepBpm: 2,
  practiceRampEveryBars: 2,
  metronomeEnabled: true,
  metronomeDownEnabled: true,
  metronomeUpEnabled: true,
  metronomeVolume: 55,
  strumEnabled: true,
  strumDownEnabled: true,
  strumUpEnabled: true,
  strumVolume: 70,
};

const DEFAULT_SHARE_STATUS = "Copy Share Link to share the current pattern.";

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
  barGridStack: document.getElementById("barGridStack"),
  barOneGrid: document.getElementById("barOneGrid"),
  barTwoGrid: document.getElementById("barTwoGrid"),
  barOneCard: document.getElementById("barOneCard"),
  barTwoCard: document.getElementById("barTwoCard"),
  patternText: document.getElementById("patternText"),
  randomizeBtn: document.getElementById("randomizeBtn"),
  clearBtn: document.getElementById("clearBtn"),
  fillBtn: document.getElementById("fillBtn"),
  playBtn: document.getElementById("playBtn"),
  oneBarLoopBtn: document.getElementById("oneBarLoopBtn"),
  twoBarLoopBtn: document.getElementById("twoBarLoopBtn"),
  editorBarToggle: document.getElementById("editorBarToggle"),
  editBarOneBtn: document.getElementById("editBarOneBtn"),
  editBarTwoBtn: document.getElementById("editBarTwoBtn"),
  tapTempoBtn: document.getElementById("tapTempoBtn"),
  eighthModeBtn: document.getElementById("eighthModeBtn"),
  sixteenthModeBtn: document.getElementById("sixteenthModeBtn"),
  bpmInput: document.getElementById("bpmInput"),
  bpmRange: document.getElementById("bpmRange"),
  countInToggle: document.getElementById("countInToggle"),
  practiceRampToggle: document.getElementById("practiceRampToggle"),
  practiceRampFields: document.getElementById("practiceRampFields"),
  practiceRampStepInput: document.getElementById("practiceRampStepInput"),
  practiceRampBarsInput: document.getElementById("practiceRampBarsInput"),
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
  transportPhase: "stopped",
  countInBeat: 0,
  countInScheduledBeat: 0,
  completedBars: 0,
  playbackStartBpm: null,
  currentLoopBar: 1,
  nextLoopBar: 1,
  currentEditorBar: 1,
};
let shareStatusTimerId = null;
let tapTempoTimestamps = [];
const desktopTwoBarMediaQuery = window.matchMedia(DESKTOP_TWO_BAR_QUERY);

applyStateToControls();
attachEventListeners();
persistState();
clearBrowserUrl();
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
  const patternBarTwo = decodePattern(params.get("p2"), subdivisionMode ?? DEFAULT_STATE.subdivisionMode);
  const bpm = parseNumberParam(params.get("b"));
  const loopBars = parseNumberParam(params.get("lb"));
  const countInEnabled = parseBooleanParam(params.get("ci"));
  const practiceRampEnabled = parseBooleanParam(params.get("pr"));
  const practiceRampStepBpm = parseNumberParam(params.get("ps"));
  const practiceRampEveryBars = parseNumberParam(params.get("pb"));
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
    loopBars === null &&
    countInEnabled === null &&
    practiceRampEnabled === null &&
    practiceRampStepBpm === null &&
    practiceRampEveryBars === null &&
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
    activeBarTwo: patternBarTwo ?? (loopBars === 2 ? pattern : null),
    bpm,
    loopBars,
    countInEnabled,
    practiceRampEnabled,
    practiceRampStepBpm,
    practiceRampEveryBars,
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
}

function getSerializableState() {
  return {
    subdivisionMode: state.subdivisionMode,
    active: [...state.active],
    activeBarTwo: [...state.activeBarTwo],
    bpm: state.bpm,
    loopBars: state.loopBars,
    countInEnabled: state.countInEnabled,
    practiceRampEnabled: state.practiceRampEnabled,
    practiceRampStepBpm: state.practiceRampStepBpm,
    practiceRampEveryBars: state.practiceRampEveryBars,
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
    activeBarTwo: sanitizeActivePattern(candidate.activeBarTwo ?? candidate.active, subdivisionMode),
    bpm: clampBpm(candidate.bpm),
    loopBars: clampLoopBars(candidate.loopBars),
    countInEnabled: getBooleanSetting(candidate.countInEnabled, DEFAULT_STATE.countInEnabled),
    practiceRampEnabled: getBooleanSetting(candidate.practiceRampEnabled, DEFAULT_STATE.practiceRampEnabled),
    practiceRampStepBpm: clampPracticeRampStep(candidate.practiceRampStepBpm),
    practiceRampEveryBars: clampPracticeRampBars(candidate.practiceRampEveryBars),
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
    activeBarTwo:
      candidate.activeBarTwo === null
        ? null
        : candidate.activeBarTwo === undefined
          ? null
          : sanitizeActivePattern(candidate.activeBarTwo, activeMode),
    bpm: candidate.bpm === null ? null : clampBpm(candidate.bpm),
    loopBars: candidate.loopBars === null ? null : clampLoopBars(candidate.loopBars),
    countInEnabled:
      candidate.countInEnabled === null
        ? null
        : getBooleanSetting(candidate.countInEnabled, DEFAULT_STATE.countInEnabled),
    practiceRampEnabled:
      candidate.practiceRampEnabled === null
        ? null
        : getBooleanSetting(candidate.practiceRampEnabled, DEFAULT_STATE.practiceRampEnabled),
    practiceRampStepBpm:
      candidate.practiceRampStepBpm === null ? null : clampPracticeRampStep(candidate.practiceRampStepBpm),
    practiceRampEveryBars:
      candidate.practiceRampEveryBars === null ? null : clampPracticeRampBars(candidate.practiceRampEveryBars),
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
    const nextActiveBarTwo =
      candidate.activeBarTwo ??
      (nextSubdivisionMode !== merged.subdivisionMode
        ? convertPatternToMode(merged.activeBarTwo, nextSubdivisionMode)
        : merged.activeBarTwo);

    return sanitizeSerializableState({
      subdivisionMode: nextSubdivisionMode,
      active: nextActive,
      activeBarTwo: nextActiveBarTwo,
      bpm: candidate.bpm ?? merged.bpm,
      loopBars: candidate.loopBars ?? merged.loopBars,
      countInEnabled: candidate.countInEnabled ?? merged.countInEnabled,
      practiceRampEnabled: candidate.practiceRampEnabled ?? merged.practiceRampEnabled,
      practiceRampStepBpm: candidate.practiceRampStepBpm ?? merged.practiceRampStepBpm,
      practiceRampEveryBars: candidate.practiceRampEveryBars ?? merged.practiceRampEveryBars,
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

function clampPracticeRampStep(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_STATE.practiceRampStepBpm;
  }

  return Math.min(20, Math.max(1, Math.round(numeric)));
}

function clampPracticeRampBars(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_STATE.practiceRampEveryBars;
  }

  return Math.min(16, Math.max(1, Math.round(numeric)));
}

function clampLoopBars(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_STATE.loopBars;
  }

  return numeric >= 2 ? 2 : 1;
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
  if (serializableState.loopBars === 2) {
    url.searchParams.set("p2", encodePattern(serializableState.activeBarTwo));
  }
  url.searchParams.set("b", String(serializableState.bpm));
  url.searchParams.set("lb", String(serializableState.loopBars));
  url.searchParams.set("ci", serializableState.countInEnabled ? "1" : "0");
  url.searchParams.set("pr", serializableState.practiceRampEnabled ? "1" : "0");
  url.searchParams.set("ps", String(serializableState.practiceRampStepBpm));
  url.searchParams.set("pb", String(serializableState.practiceRampEveryBars));
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

function clearBrowserUrl() {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.search = "";
  window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
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
  elements.oneBarLoopBtn.setAttribute("aria-pressed", state.loopBars === 1 ? "true" : "false");
  elements.twoBarLoopBtn.setAttribute("aria-pressed", state.loopBars === 2 ? "true" : "false");
  elements.editorBarToggle.hidden = state.loopBars !== 2 || shouldUseDualGridView();
  updateEditorBarControls();
  elements.bpmInput.value = state.bpm;
  elements.bpmRange.value = state.bpm;
  elements.countInToggle.checked = state.countInEnabled;
  elements.practiceRampToggle.checked = state.practiceRampEnabled;
  elements.practiceRampStepInput.value = state.practiceRampStepBpm;
  elements.practiceRampBarsInput.value = state.practiceRampEveryBars;
  elements.practiceRampFields.hidden = !state.practiceRampEnabled;
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
  updateEditorBarControls();
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
    preset.pattern.length === getEditablePattern().length &&
    preset.pattern.every((slot, index) => slot === getEditablePattern()[index])
  );
}

function renderGrid() {
  const showDualGrid = shouldUseDualGridView();
  elements.grid.hidden = showDualGrid;
  elements.barGridStack.hidden = !showDualGrid;

  if (showDualGrid) {
    renderGridInto({
      container: elements.barOneGrid,
      pattern: state.active,
      currentStep: state.currentLoopBar === 1 ? state.currentStep : -1,
      barNumber: 1,
    });
    renderGridInto({
      container: elements.barTwoGrid,
      pattern: state.activeBarTwo,
      currentStep: state.currentLoopBar === 2 ? state.currentStep : -1,
      barNumber: 2,
    });
    elements.barOneCard.classList.toggle("is-editing", state.currentEditorBar === 1);
    elements.barTwoCard.classList.toggle("is-editing", state.currentEditorBar === 2);
    elements.barOneCard.classList.toggle("is-playing", state.timerId && state.currentLoopBar === 1);
    elements.barTwoCard.classList.toggle("is-playing", state.timerId && state.currentLoopBar === 2);
    return;
  }

  renderGridInto({
    container: elements.grid,
    pattern: getVisibleSingleGridPattern(),
    currentStep: state.currentStep,
    barNumber: getVisibleSingleGridBarNumber(),
  });
}

function renderGridInto({ container, pattern, currentStep, barNumber }) {
  const subdivisions = getSubdivisions();
  container.innerHTML = "";
  container.dataset.mode = state.subdivisionMode;

  subdivisions.forEach(({ count, direction }, index) => {
    const slot = document.createElement("button");
    const classes = ["slot"];

    if (pattern[index]) {
      classes.push("active");
    }

    if (index === currentStep) {
      classes.push("current-step");
    }

    slot.className = classes.join(" ");
    slot.type = "button";
    slot.setAttribute("aria-pressed", pattern[index] ? "true" : "false");
    slot.setAttribute("aria-label", `Bar ${barNumber}: ${count} ${direction} ${pattern[index] ? "selected" : "not selected"}`);

    slot.innerHTML = `
      <div class="slot-number">${count}</div>
      <div class="slot-direction">${direction}</div>
    `;

    slot.addEventListener("click", () => toggleSlot(index, barNumber));
    container.appendChild(slot);
  });
}

function renderPatternText() {
  if (state.loopBars === 2) {
    elements.patternText.innerHTML = `
      <div class="pattern-group">
        <span class="pattern-label">Bar 1</span>
        ${formatPatternLine(state.active)}
      </div>
      <div class="pattern-group">
        <span class="pattern-label">Bar 2</span>
        ${formatPatternLine(state.activeBarTwo)}
      </div>
    `;
    return;
  }

  elements.patternText.innerHTML = formatPatternLine(state.active);
}

function updateMetronomeStatus() {
  const isRunning = Boolean(state.timerId);
  const subdivisions = getSubdivisions();
  const stepLabel =
    state.currentStep >= 0 ? `${subdivisions[state.currentStep].count} ${subdivisions[state.currentStep].direction}` : "Ready";
  const pulseLabel = state.subdivisionMode === SUBDIVISION_MODES.sixteenth ? "Sixteenth-note pulse" : "Eighth-note pulse";

  elements.playBtn.textContent = isRunning ? "Stop" : "Start";
  elements.playBtn.setAttribute("aria-pressed", isRunning ? "true" : "false");

  if (!isRunning) {
    setMetronomeStatus({
      title: "Stopped",
      detail: getStoppedStatusDetail(pulseLabel),
      bpm: state.bpm,
    });
    return;
  }

  if (state.transportPhase === "count-in") {
    setMetronomeStatus({
      title: "Count-in",
      detail: state.countInBeat > 0 ? `Beat ${state.countInBeat} of 4` : "Get ready",
      bpm: state.bpm,
    });
    return;
  }

  setMetronomeStatus({
    title: "Playing",
    detail: state.practiceRampEnabled
      ? `Current step: ${stepLabel}${state.loopBars === 2 ? ` • Bar ${state.currentLoopBar} of 2` : ""} • Ramp +${state.practiceRampStepBpm} BPM every ${state.practiceRampEveryBars} bars`
      : `Current step: ${stepLabel}${state.loopBars === 2 ? ` • Bar ${state.currentLoopBar} of 2` : ""}`,
    bpm: state.bpm,
  });
}

function getStoppedStatusDetail(pulseLabel) {
  const parts = [pulseLabel];

  if (state.countInEnabled) {
    parts.push("1-bar count-in on start");
  }

  if (state.practiceRampEnabled) {
    parts.push(`ramp +${state.practiceRampStepBpm} BPM every ${state.practiceRampEveryBars} bars`);
  }

  if (state.loopBars === 2) {
    parts.push("2-bar loop");
  }

  return parts.join(" • ");
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

function getEditablePattern() {
  return getPatternForBar(state.currentEditorBar);
}

function getPatternForBar(barNumber) {
  return barNumber === 2 ? state.activeBarTwo : state.active;
}

function getVisibleSingleGridBarNumber() {
  if (state.loopBars === 2 && state.timerId && state.transportPhase === "playing") {
    return state.currentLoopBar;
  }

  return state.currentEditorBar;
}

function getVisibleSingleGridPattern() {
  return getPatternForBar(getVisibleSingleGridBarNumber());
}

function shouldUseDualGridView() {
  return state.loopBars === 2 && desktopTwoBarMediaQuery.matches;
}

function updateEditorBarControls() {
  const visibleBar = shouldUseDualGridView() ? state.currentEditorBar : getVisibleSingleGridBarNumber();
  elements.editBarOneBtn.setAttribute("aria-pressed", visibleBar === 1 ? "true" : "false");
  elements.editBarTwoBtn.setAttribute("aria-pressed", visibleBar === 2 ? "true" : "false");
}

function setPatternForBar(barNumber, nextPattern) {
  const sanitizedPattern = sanitizeActivePattern(nextPattern, state.subdivisionMode);
  if (barNumber === 2) {
    state.activeBarTwo = sanitizedPattern;
    return;
  }

  state.active = sanitizedPattern;
}

function formatPatternLine(pattern) {
  const subdivisions = getSubdivisions();
  const parts = subdivisions.map(({ count, direction }, index) => {
    const isActive = pattern[index];
    const label = isActive ? `${count} ${direction}` : `${count} -`;
    return `<span class="pattern-token ${isActive ? "is-active" : "is-rest"}">${label}</span>`;
  });

  return `<div class="pattern-tokens">${parts.join("")}</div>`;
}

function toggleSlot(index, barNumber = state.currentEditorBar) {
  state.currentEditorBar = barNumber;
  const nextPattern = [...getPatternForBar(barNumber)];
  nextPattern[index] = !nextPattern[index];
  setPatternForBar(barNumber, nextPattern);
  syncStoredState();
  renderPresetLibrary();
  render();
}

function setPattern(nextPattern) {
  if (!Array.isArray(nextPattern)) {
    return;
  }

  setPatternForBar(state.currentEditorBar, nextPattern);
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
  state.activeBarTwo = sanitizeActivePattern(convertPatternToMode(state.activeBarTwo, sanitizedMode), sanitizedMode);
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
  const randomized = getEditablePattern().map((_, index) => {
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

  if (!state.timerId) {
    state.playbackStartBpm = null;
  }

  syncStoredState();

  if (state.timerId) {
    restartMetronome();
    return;
  }

  updateMetronomeStatus();
}

function applyPracticeRampStep() {
  if (!state.practiceRampEnabled || state.bpm >= 220) {
    return;
  }

  state.bpm = clampBpm(state.bpm + state.practiceRampStepBpm);
  elements.bpmInput.value = state.bpm;
  elements.bpmRange.value = state.bpm;
  syncStoredState();
}

function updatePracticeRampSetting(key, value) {
  if (key === "practiceRampStepBpm") {
    state[key] = clampPracticeRampStep(value);
    elements.practiceRampStepInput.value = state[key];
  } else if (key === "practiceRampEveryBars") {
    state[key] = clampPracticeRampBars(value);
    elements.practiceRampBarsInput.value = state[key];
  }

  syncStoredState();
  render();
}

function setLoopBars(value) {
  const nextLoopBars = clampLoopBars(value);
  if (nextLoopBars === state.loopBars) {
    return;
  }

  const wasRunning = Boolean(state.timerId);
  if (wasRunning) {
    stopMetronome();
  }

  state.loopBars = nextLoopBars;
  if (nextLoopBars === 1) {
    state.currentEditorBar = 1;
  }
  applyStateToControls();
  syncStoredState();
  render();

  if (wasRunning) {
    startMetronome();
  }
}

function setEditorBar(value) {
  const nextEditorBar = clampLoopBars(value);
  if (state.currentEditorBar === nextEditorBar || state.loopBars !== 2) {
    return;
  }

  state.currentEditorBar = nextEditorBar;
  applyStateToControls();
  renderPresetLibrary();
  render();
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

function getQuarterStepIndices() {
  return state.subdivisionMode === SUBDIVISION_MODES.sixteenth ? [0, 4, 8, 12] : [0, 2, 4, 6];
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

function playMetronomeClick(stepIndex, when, options = {}) {
  const { forceAudible = false } = options;

  if (!state.metronomeEnabled && !forceAudible) {
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

function playStrumSound(stepIndex, when, loopBar = 1) {
  const activePattern = getPatternForBar(loopBar);
  if (!state.strumEnabled || !activePattern[stepIndex]) {
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

function scheduleUiUpdate(when, update) {
  const delay = Math.max(0, (when - state.audioContext.currentTime) * 1000);
  const timeoutId = window.setTimeout(() => {
    state.uiStepTimeoutIds = state.uiStepTimeoutIds.filter((id) => id !== timeoutId);
    update();
    render();
  }, delay);

  state.uiStepTimeoutIds.push(timeoutId);
}

function scheduleStep(stepIndex, when, loopBar) {
  playMetronomeClick(stepIndex, when);
  playStrumSound(stepIndex, when, loopBar);
  scheduleUiUpdate(when, () => {
    state.transportPhase = "playing";
    state.countInBeat = 0;
    if (stepIndex === 0) {
      state.currentLoopBar = loopBar;
    }
    state.currentStep = stepIndex;
  });
}

function scheduleCountInBeat(beatNumber, when) {
  const stepIndex = getQuarterStepIndices()[beatNumber - 1];
  playMetronomeClick(stepIndex, when, { forceAudible: true });
  scheduleUiUpdate(when, () => {
    state.transportPhase = "count-in";
    state.countInBeat = beatNumber;
    state.currentStep = stepIndex;
  });
}

function runScheduler() {
  if (!state.audioContext) {
    return;
  }

  const scheduleUntil = state.audioContext.currentTime + SCHEDULE_AHEAD_SECONDS;
  while (state.nextNoteTime < scheduleUntil) {
    if (state.transportPhase === "count-in" && state.countInScheduledBeat < 4) {
      scheduleCountInBeat(state.countInScheduledBeat + 1, state.nextNoteTime);
      state.countInScheduledBeat += 1;
      state.nextNoteTime += 60 / state.bpm;
      continue;
    }

    const stepIndex = state.nextStepIndex;
    const loopBar = state.nextLoopBar;
    scheduleStep(stepIndex, state.nextNoteTime, loopBar);

    const nextStepIndex = (stepIndex + 1) % getSubdivisionCount();
    if (nextStepIndex === 0) {
      state.completedBars += 1;
      state.nextLoopBar = (state.nextLoopBar % state.loopBars) + 1;
      if (state.completedBars % state.practiceRampEveryBars === 0) {
        applyPracticeRampStep();
      }
    }

    state.nextStepIndex = nextStepIndex;
    state.nextNoteTime += getStepIntervalSeconds();
  }
}

function startMetronome() {
  if (state.timerId) {
    return;
  }

  ensureAudioContext();
  clearScheduledUiSteps();
  state.playbackStartBpm = state.bpm;
  state.currentStep = -1;
  state.nextStepIndex = 0;
  state.nextNoteTime = state.audioContext.currentTime + FIRST_NOTE_LEAD_SECONDS;
  state.transportPhase = state.countInEnabled ? "count-in" : "playing";
  state.countInBeat = 0;
  state.countInScheduledBeat = 0;
  state.completedBars = 0;
  state.currentLoopBar = 1;
  state.nextLoopBar = 1;
  runScheduler();
  state.timerId = window.setInterval(runScheduler, SCHEDULER_LOOKAHEAD_MS);
  updateMetronomeStatus();
}

function stopMetronome() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }

  if (state.practiceRampEnabled && Number.isFinite(state.playbackStartBpm)) {
    state.bpm = clampBpm(state.playbackStartBpm);
    elements.bpmInput.value = state.bpm;
    elements.bpmRange.value = state.bpm;
    syncStoredState();
  }

  clearScheduledUiSteps();
  state.currentStep = -1;
  state.transportPhase = "stopped";
  state.countInBeat = 0;
  state.countInScheduledBeat = 0;
  state.completedBars = 0;
  state.playbackStartBpm = null;
  state.currentLoopBar = 1;
  state.nextLoopBar = 1;
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
  setPattern(getEditablePattern().map(() => false));
}

function fillPattern() {
  setPattern(getEditablePattern().map(() => true));
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
  elements.playBtn.addEventListener("click", toggleMetronome);
  elements.oneBarLoopBtn.addEventListener("click", () => {
    setLoopBars(1);
  });
  elements.twoBarLoopBtn.addEventListener("click", () => {
    setLoopBars(2);
  });
  elements.editBarOneBtn.addEventListener("click", () => {
    setEditorBar(1);
  });
  elements.editBarTwoBtn.addEventListener("click", () => {
    setEditorBar(2);
  });
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

  elements.countInToggle.addEventListener("change", (event) => {
    updateToggleState("countInEnabled", event.target.checked);
    render();
  });

  elements.practiceRampToggle.addEventListener("change", (event) => {
    updateToggleState("practiceRampEnabled", event.target.checked);
    applyStateToControls();
    render();
  });

  elements.practiceRampStepInput.addEventListener("input", (event) => {
    updatePracticeRampSetting("practiceRampStepBpm", event.target.value);
  });

  elements.practiceRampBarsInput.addEventListener("input", (event) => {
    updatePracticeRampSetting("practiceRampEveryBars", event.target.value);
  });

  elements.practiceRampStepInput.addEventListener("blur", (event) => {
    updatePracticeRampSetting("practiceRampStepBpm", event.target.value);
  });

  elements.practiceRampBarsInput.addEventListener("blur", (event) => {
    updatePracticeRampSetting("practiceRampEveryBars", event.target.value);
  });

  elements.practiceRampStepInput.addEventListener("change", (event) => {
    updatePracticeRampSetting("practiceRampStepBpm", event.target.value);
  });

  elements.practiceRampBarsInput.addEventListener("change", (event) => {
    updatePracticeRampSetting("practiceRampEveryBars", event.target.value);
    render();
  });

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

    // Ignore browser/system shortcuts like Cmd+R, Cmd+C, Ctrl+R, etc.
    if (event.metaKey || event.ctrlKey || event.altKey) {
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

    if (Number.isInteger(slotIndex) && slotIndex < getEditablePattern().length) {
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

  desktopTwoBarMediaQuery.addEventListener("change", () => {
    applyStateToControls();
    render();
  });
}
