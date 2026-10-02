const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const accentSource = readFileSync(path.join(__dirname, "../accents.js"), "utf8");
const appSource = readFileSync(path.join(__dirname, "../app.js"), "utf8");
const markup = readFileSync(path.join(__dirname, "../index.html"), "utf8");
const stateKey = "strumming-pattern-builder:state";
const libraryKey = "strumming-pattern-builder:saved-patterns";

// Run the real app, including startup and listeners, with only browser I/O stubbed.
function createApp({ stored, library, search = "", desktop = true } = {}) {
  const document = { activeElement: null };
  class Element {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.listeners = {};
      this.className = "";
      this.classList = {
        toggle: (name, enabled) => {
          const classes = new Set(this.className.split(" ").filter(Boolean));
          if (enabled) classes.add(name);
          else classes.delete(name);
          this.className = [...classes].join(" ");
        },
      };
    }
    set innerHTML(value) {
      this.html = value;
      this.children = [];
      for (const match of value.matchAll(/<(?:div|span) class="(slot-number|slot-direction|slot-accent)"/g)) {
        const child = new Element();
        child.className = match[1];
        this.appendChild(child);
      }
    }
    get innerHTML() { return this.html; }
    get lastElementChild() { return this.children.at(-1); }
    appendChild(child) { child.parentElement = this; this.children.push(child); }
    remove() {
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      if (document.activeElement === this) document.activeElement = document.body;
    }
    querySelector(selector) { return this.children.find((child) => child.className === selector.slice(1)); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    focus() { document.activeElement = this; }
    click() { this.listeners.click?.({ target: this }); }
  }
  const elements = new Map([...markup.matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g)]
    .map((match) => [match[2], new Element(match[1])]));
  document.body = new Element("body");
  document.activeElement = document.body;
  document.getElementById = (id) => {
    assert.ok(elements.has(id), `Missing HTML element: ${id}`);
    return elements.get(id);
  };
  document.createElement = (tagName) => new Element(tagName);
  const storage = new Map();
  if (stored) storage.set(stateKey, JSON.stringify(stored));
  if (library) storage.set(libraryKey, JSON.stringify(library));
  const timers = new Map();
  let timerId = 0;
  const voices = [];
  class AudioContext {
    currentTime = 0;
    state = "running";
    destination = {};
    createOscillator() {
      const voice = {
        frequency: { value: 0 },
        connect(gain) { this.gain = gain; },
        start(time) { this.startTime = time; },
        stop(time) { this.stopTime = time; },
      };
      voices.push(voice);
      return voice;
    }
    createGain() {
      const events = [];
      return {
        events,
        gain: {
          setValueAtTime: (value, time) => events.push(["set", value, time]),
          exponentialRampToValueAtTime: (value, time) => events.push(["exponential", value, time]),
          linearRampToValueAtTime: (value, time) => events.push(["linear", value, time]),
        },
        connect() {},
      };
    }
  }
  const media = { matches: desktop, addEventListener() {} };
  const listeners = {};
  const window = {
    location: { href: `https://strumloop.test/${search}`, search },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    history: { replaceState() {} },
    matchMedia: () => media,
    addEventListener: (name, listener) => { listeners[name] = listener; },
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    setInterval: () => ++timerId,
    clearInterval() {},
    AudioContext,
  };
  const context = vm.createContext({ window, document, console, URL, URLSearchParams });
  vm.runInContext(accentSource, context, { filename: "accents.js" });
  vm.runInContext(appSource, context, { filename: "app.js" });
  const run = (source) => vm.runInContext(source, context);
  const snapshot = () => JSON.parse(JSON.stringify(run("getSerializableState()")));
  return {
    run, snapshot, elements, document, storage, voices, media,
    key(key, code = key, modifiers = {}) {
      const event = { key, code, ...modifiers, preventDefault() { this.defaultPrevented = true; } };
      listeners.keydown(event);
      return event;
    },
    flushTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

const all = (length, value = true) => Array(length).fill(value);

test("editing modes toggle active notes only, isolate bars, and remove accents with strums", () => {
  const app = createApp();
  assert.equal(app.run("state.editMode"), "strums");
  app.elements.get("accentsEditBtn").click();
  app.elements.get("grid").children[0].click();
  app.elements.get("grid").children[1].click();
  assert.equal(app.snapshot().accents[0], true);
  assert.equal(app.snapshot().active[1], false);
  assert.equal(app.snapshot().accents[1], false);
  app.run("setLoopBars(2); toggleSlot(2, 2)");
  assert.equal(app.snapshot().accentsBarTwo[2], true);
  assert.equal(app.snapshot().accents[2], false);
  app.elements.get("strumsEditBtn").click();
  app.run("toggleSlot(0, 1); toggleSlot(0, 1)");
  assert.equal(app.snapshot().active[0], true);
  assert.equal(app.snapshot().accents[0], false);
});

test("slot keyboard shortcuts respect editing mode in both subdivisions", () => {
  const app = createApp();
  app.run('setEditMode("accents")');
  app.key("1");
  app.key("2");
  assert.equal(app.snapshot().accents[0], true);
  assert.equal(app.snapshot().active[1], false);
  app.run('setSubdivisionMode("16th"); fillPattern()');
  app.key("q");
  app.key("f");
  assert.equal(app.snapshot().accents[8], true);
  assert.equal(app.snapshot().accents[15], true);
  app.document.activeElement = app.elements.get("savedPatternName");
  app.key("q");
  assert.equal(app.snapshot().accents[8], true);
});

test("Space activates focused buttons natively and starts playback from the page", () => {
  const app = createApp();
  app.elements.get("accentsEditBtn").focus();
  assert.equal(app.key(" ", "Space").defaultPrevented, undefined);
  assert.equal(app.run("state.timerId"), null);
  app.document.body.focus();
  assert.equal(app.key(" ", "Space").defaultPrevented, true);
  assert.ok(app.run("state.timerId"));
});

test("markers and ARIA reflect accents; focus survives edits, playback, and layout swaps", () => {
  const app = createApp();
  const slot = app.elements.get("grid").children[0];
  slot.focus();
  app.run('setEditMode("accents"); toggleSlot(0)');
  assert.equal(slot.getAttribute("aria-pressed"), "true");
  assert.match(slot.getAttribute("aria-label"), /accented strum/);
  assert.equal(slot.querySelector(".slot-accent").hidden, false);
  assert.equal(app.elements.get("grid").children[1].getAttribute("aria-disabled"), "true");
  assert.match(app.elements.get("patternText").innerHTML, /is-accented/);
  app.run("scheduleStep(0, 0.1, 1)");
  app.flushTimers();
  assert.equal(app.document.activeElement, slot);
  assert.equal(app.elements.get("grid").children[0], slot);
  app.run("setLoopBars(2)");
  assert.equal(app.document.activeElement, app.elements.get("barOneGrid").children[0]);
  app.media.matches = false;
  app.run("render()");
  assert.equal(app.document.activeElement, slot);
});

test("subdivision conversion maps both accent arrays with notes and drops removed steps", () => {
  const app = createApp({ stored: {
    active: all(8), activeBarTwo: all(8), accents: all(8), accentsBarTwo: all(8), loopBars: 2,
  } });
  app.run('setSubdivisionMode("16th")');
  assert.deepEqual(app.snapshot().accents, Array.from({ length: 16 }, (_, i) => i % 2 === 0));
  assert.deepEqual(app.snapshot().accentsBarTwo, app.snapshot().accents);
  app.run('setEditMode("strums"); toggleSlot(1); setEditMode("accents"); toggleSlot(1); setSubdivisionMode("8th")');
  assert.deepEqual(app.snapshot().accents, all(8));
  assert.deepEqual(app.snapshot().accentsBarTwo, all(8));
});

test("temporarily selecting one bar preserves bar-two notes and accents", () => {
  const app = createApp({ stored: { activeBarTwo: all(8), accentsBarTwo: all(8), loopBars: 2 } });
  app.run("setLoopBars(1); setLoopBars(2)");
  assert.deepEqual(app.snapshot().accentsBarTwo, all(8));
});

for (const action of ["clearPattern()", "fillPattern()", "randomizePattern()", "applyPreset(PRESETS[0].id)"]) {
  test(`${action} resets accents only on the edited bar`, () => {
    const app = createApp({ stored: {
      active: all(8), activeBarTwo: all(8), accents: all(8), accentsBarTwo: all(8), loopBars: 2,
    } });
    app.run(`setEditorBar(2); ${action}`);
    assert.deepEqual(app.snapshot().accents, all(8));
    assert.deepEqual(app.snapshot().accentsBarTwo, all(8, false));
  });
}

test("preset matching includes accents and two-bar presets reset both bars", () => {
  const app = createApp();
  app.run('applyPreset(PRESETS[0].id); setEditMode("accents"); toggleSlot(0)');
  assert.equal(app.run("isPresetActive(PRESETS[0])"), false);
  app.run("toggleSlot(0)");
  assert.equal(app.run("isPresetActive(PRESETS[0])"), true);
  app.run('setSubdivisionMode("16th"); applyPreset(PRESETS.find(p => p.loopBars === 2).id); toggleSlot(0, 2)');
  assert.equal(app.run("isPresetActive(PRESETS.find(p => p.loopBars === 2))"), false);
  app.run("applyPreset(PRESETS.find(p => p.loopBars === 2).id)");
  assert.deepEqual(app.snapshot().accents, all(16, false));
  assert.deepEqual(app.snapshot().accentsBarTwo, all(16, false));
});

test("old storage and saved patterns load without accents; invalid accents are discarded", () => {
  const old = { name: "Old", id: "old", active: all(8), activeBarTwo: all(8), loopBars: 2 };
  const app = createApp({ stored: old, library: [old] });
  assert.deepEqual(app.snapshot().accents, all(8, false));
  app.run('setEditMode("accents"); toggleSlot(0); loadSavedPattern("old")');
  assert.deepEqual(app.snapshot().accents, all(8, false));
  assert.deepEqual(app.snapshot().accentsBarTwo, all(8, false));
  for (const accents of [null, "ff", [true], [...all(7), "true"]]) {
    const malformed = createApp({ stored: { active: all(8), accents } });
    assert.deepEqual(malformed.snapshot().accents, all(8, false));
  }
  const rests = createApp({ stored: { active: all(8, false), accents: all(8) } });
  assert.deepEqual(rests.snapshot().accents, all(8, false));
});

test("save/load and reload preserve both bars; editing mode is not persisted", () => {
  const app = createApp();
  app.run('setLoopBars(2); setEditMode("accents"); toggleSlot(0, 1); toggleSlot(2, 2); saveCurrentPattern("Test")');
  const saved = app.snapshot();
  assert.equal("editMode" in saved, false);
  const reloaded = createApp({ stored: saved, library: JSON.parse(app.storage.get(libraryKey)) });
  assert.equal(reloaded.run("state.editMode"), "strums");
  reloaded.run('clearPattern(); loadSavedPattern(savedPatterns[0].id)');
  assert.deepEqual(reloaded.snapshot(), saved);
  reloaded.run('setEditMode("accents"); toggleSlot(0, 1)');
  assert.equal(reloaded.run("savedPatterns[0].accents[0]"), true);
});

for (const mode of ["8th", "16th"]) {
  for (const bars of [1, 2]) {
    test(`share links round-trip ${mode}, ${bars} bar(s) over conflicting local state`, () => {
      const app = createApp();
      app.run(`setSubdivisionMode("${mode}"); setLoopBars(${bars}); setEditMode("accents"); toggleSlot(0); toggleSlot(0, 2)`);
      const url = new URL(app.run("buildShareUrl().toString()"));
      assert.equal(url.searchParams.has("a2"), bars === 2);
      const length = mode === "16th" ? 16 : 8;
      const target = createApp({ search: url.search, stored: {
        subdivisionMode: mode, active: all(length), activeBarTwo: all(length),
        accents: all(length), accentsBarTwo: all(length),
      } });
      const expected = app.snapshot();
      const actual = target.snapshot();
      assert.deepEqual(actual.accents, expected.accents);
      assert.deepEqual(actual.active, expected.active);
      if (bars === 2) {
        assert.deepEqual(actual.accentsBarTwo, expected.accentsBarTwo);
        assert.deepEqual(actual.activeBarTwo, expected.activeBarTwo);
      }
    });
  }
}

test("legacy and malformed share accents clear accents on replaced patterns", () => {
  const stored = { active: all(8), activeBarTwo: all(8), accents: all(8), accentsBarTwo: all(8) };
  for (const search of ["?p=ff&p2=ff&lb=2", "?p=ff&a=wrong&p2=ff&a2=wrong&lb=2", "?p=ff&lb=2"]) {
    const app = createApp({ stored, search });
    assert.deepEqual(app.snapshot().accents, all(8, false));
    assert.deepEqual(app.snapshot().accentsBarTwo, all(8, false));
  }
  const oneBar = createApp({ stored, search: "?p=ff" });
  assert.deepEqual(oneBar.snapshot().accents, all(8, false));
  assert.deepEqual(oneBar.snapshot().accentsBarTwo, all(8));
  const settingsOnly = createApp({ stored, search: "?b=100" });
  assert.deepEqual(settingsOnly.snapshot().accents, all(8));
});

test("duplicated bar-one links copy accents unless bar two supplies its own data", () => {
  for (const [extra, expected] of [["", "80"], ["&a2=40", "40"], ["&a2=invalid", "00"], ["&p2=ff", "00"]]) {
    const app = createApp({ search: `?p=ff&a=80&lb=2${extra}` });
    assert.equal(app.run("encodePattern(state.accentsBarTwo)"), expected);
  }
});

test("accent-only links use the stored subdivision and mask rests", () => {
  const stored = { subdivisionMode: "16th", active: all(16), accents: all(16) };
  const app = createApp({ stored, search: "?a=8000" });
  assert.deepEqual(app.snapshot().accents, [true, ...all(15, false)]);
  const malformed = createApp({ stored, search: "?a=invalid" });
  assert.deepEqual(malformed.snapshot().accents, all(16, false));
  const rests = createApp({ search: "?p=80&a=ff" });
  assert.deepEqual(rests.snapshot().accents, [true, ...all(7, false)]);
});

test("URL subdivision changes convert stored accents; legacy 16th-note links clear them", () => {
  const stored = { active: all(8), activeBarTwo: all(8), accents: all(8), accentsBarTwo: all(8) };
  const converted = createApp({ stored, search: "?m=16th" });
  const expected = Array.from({ length: 16 }, (_, i) => i % 2 === 0);
  assert.deepEqual(converted.snapshot().accents, expected);
  assert.deepEqual(converted.snapshot().accentsBarTwo, expected);
  const legacy = createApp({ stored, search: "?p=ffff&p2=ffff&lb=2" });
  assert.equal(legacy.snapshot().subdivisionMode, "16th");
  assert.deepEqual(legacy.snapshot().accents, all(16, false));
  assert.deepEqual(legacy.snapshot().accentsBarTwo, all(16, false));
});

test("accents boost the original strum voices 2.5x without changing their timing or pitch", () => {
  const app = createApp({ stored: { active: all(8), activeBarTwo: all(8), loopBars: 2 } });
  for (const step of [0, 1]) {
    app.voices.length = 0;
    app.run(`playStrumSound(${step}, 1, 2)`);
    const normal = app.voices.map((voice) => ({
      peak: voice.gain.events[1][1], frequency: voice.frequency.value,
      start: voice.startTime, stop: voice.stopTime, type: voice.type,
    }));
    app.run(`setEditMode("accents"); toggleSlot(${step}, 2)`);
    app.voices.length = 0;
    app.run(`playStrumSound(${step}, 1, 2)`);
    assert.equal(app.voices.length, 3);
    app.voices.forEach((voice, i) => {
      assert.equal(voice.gain.events[1][1], normal[i].peak * 2.5);
      assert.equal(voice.frequency.value, normal[i].frequency);
      assert.equal(voice.startTime, normal[i].start);
      assert.equal(voice.stopTime, normal[i].stop);
      assert.equal(voice.type, normal[i].type);
    });
    app.voices.length = 0;
    app.run(`playStrumSound(${step}, 1, 1)`);
    assert.deepEqual(app.voices.map((voice) => voice.gain.events[1][1]), normal.map((voice) => voice.peak));
  }
});

test("Clack keeps the strum at normal gain and adds a quieter metallic layer", () => {
  for (const step of [0, 1]) {
    const app = createApp({ stored: { active: all(8), accents: all(8), strumVolume: 50, accentSound: "clack" } });
    app.run(`playStrumSound(${step}, 1)`);
    const hit = app.voices.slice(3);
    assert.equal(hit.length, 2);
    assert.deepEqual(hit.map((voice) => voice.frequency.value), [800, 1100]);
    assert.deepEqual(hit.map((voice) => voice.stopTime), [1.1, 1.07]);
    hit.forEach((voice, i) => {
      assert.equal(voice.type, "square");
      assert.equal(voice.startTime, 1);
      assert.deepEqual(voice.gain.events[1], ["exponential", [0.03, 0.018][i], 1.0015]);
      assert.equal(voice.gain.events[2][0], "linear");
    });
    const normalGains = [0.055, 0.045, 0.035];
    app.voices.slice(0, 3).forEach((voice, i) => {
      assert.ok(Math.abs(voice.gain.events[1][1] - normalGains[i]) < 1e-10);
    });
    assert.ok(hit.reduce((sum, voice) => sum + voice.gain.events[1][1], 0) < normalGains[0]);
    app.voices.length = 0;
    app.run(`setEditMode("accents"); toggleSlot(${step}); playStrumSound(${step}, 1)`);
    assert.equal(app.voices.length, 3);
  }
});

test("accents respect rest, direction, strum, and volume mutes", () => {
  for (const accentSound of ["volume", "clack"]) {
    for (const setup of ["state.strumEnabled = false", "state.strumDownEnabled = false", "state.strumVolume = 0", "state.active[0] = false"]) {
      const app = createApp({ stored: { accentSound } });
      app.run(`setEditMode("accents"); toggleSlot(0); ${setup}; playStrumSound(0, 1)`);
      assert.equal(app.voices.length, 0);
    }
    const app = createApp({ stored: { active: all(8), accents: all(8), strumUpEnabled: false, accentSound } });
    app.run("playStrumSound(1, 1)");
    assert.equal(app.voices.length, 0);
  }
});

test("sound toggle persists and updates controls without changing notes or restarting playback", () => {
  const app = createApp();
  app.run('setEditMode("accents"); toggleSlot(0); startMetronome()');
  const before = app.snapshot();
  const timer = app.run("state.timerId");
  app.elements.get("clackAccentBtn").click();
  assert.deepEqual(app.snapshot(), { ...before, accentSound: "clack" });
  assert.equal(app.run("state.timerId"), timer);
  assert.equal(app.elements.get("clackAccentBtn").getAttribute("aria-pressed"), "true");
  assert.equal(app.elements.get("volumeAccentBtn").getAttribute("aria-pressed"), "false");
  assert.match(app.elements.get("accentSoundHint").textContent, /quiet clack/);
  assert.equal(JSON.parse(app.storage.get(stateKey)).accentSound, "clack");
  const reload = createApp({ stored: app.snapshot() });
  assert.equal(reload.snapshot().accentSound, "clack");
  app.elements.get("volumeAccentBtn").click();
  assert.equal(app.snapshot().accentSound, "volume");
  app.voices.length = 0;
  app.run("playStrumSound(0, 1)");
  assert.equal(app.voices.length, 3);
});

test("accent sound round-trips through links and overrides the recipient's local choice", () => {
  for (const accentSound of ["volume", "clack"]) {
    const app = createApp({ stored: { accentSound } });
    const url = new URL(app.run("buildShareUrl().toString()"));
    assert.equal(url.searchParams.get("as"), accentSound);
    const target = createApp({ stored: { accentSound: accentSound === "volume" ? "clack" : "volume" }, search: url.search });
    assert.equal(target.snapshot().accentSound, accentSound);
  }
});

test("old or invalid sound settings default to Volume; settings-only links preserve the local choice", () => {
  for (const accentSound of [undefined, null, "invalid", 1]) {
    assert.equal(createApp({ stored: { accentSound } }).snapshot().accentSound, "volume");
  }
  for (const search of ["?p=ff", "?p=ff&a=80", "?as=invalid", "?as="]) {
    const app = createApp({ stored: { accentSound: "clack" }, search });
    assert.equal(app.snapshot().accentSound, "volume");
  }
  assert.equal(createApp({ stored: { accentSound: "clack" }, search: "?b=100" }).snapshot().accentSound, "clack");
});

test("loading a saved pattern keeps the global accent sound choice", () => {
  const app = createApp();
  app.run('setEditMode("accents"); toggleSlot(0); saveCurrentPattern("Accents"); setAccentSound("clack"); clearPattern(); loadSavedPattern(savedPatterns[0].id)');
  assert.equal(app.snapshot().accentSound, "clack");
  assert.equal(app.snapshot().accents[0], true);
});

test("accents leave metronome/count-in unchanged and affect only future scheduled strums", () => {
  const app = createApp();
  app.run("scheduleCountInBeat(1, 1)");
  const normal = app.voices.map((voice) => voice.gain.events[1][1]);
  app.run('setEditMode("accents"); toggleSlot(0)');
  app.voices.length = 0;
  app.run("scheduleCountInBeat(1, 1)");
  assert.deepEqual(app.voices.map((voice) => voice.gain.events[1][1]), normal);
  app.run("toggleSlot(0); state.metronomeEnabled = false");
  app.voices.length = 0;
  app.run("scheduleStep(0, 2, 1)");
  const previousPeak = app.voices[0].gain.events[1][1];
  app.run("toggleSlot(0); scheduleStep(0, 3, 1)");
  assert.equal(app.voices[0].gain.events[1][1], previousPeak);
  assert.equal(app.voices[3].gain.events[1][1], previousPeak * 2.5);
});

test("Shift slot shortcuts accent active notes without changing the selected editing mode", () => {
  const app = createApp();
  app.key("!", "Digit1", { shiftKey: true });
  assert.equal(app.snapshot().accents[0], true);
  assert.equal(app.run("state.editMode"), "strums");
  app.key("@", "Digit2", { shiftKey: true });
  assert.equal(app.snapshot().active[1], false);
  assert.equal(app.snapshot().accents[1], false);
  app.run('setSubdivisionMode("16th"); fillPattern()');
  app.key("Q", "KeyQ", { shiftKey: true });
  assert.equal(app.snapshot().accents[8], true);
  app.key("Q", "KeyQ", { shiftKey: true, metaKey: true });
  assert.equal(app.snapshot().accents[8], true);
});
