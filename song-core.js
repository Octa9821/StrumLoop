(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.StrumLoopSongCore = api;
    if (root.location && typeof URLSearchParams !== "undefined") {
      root.StrumLoopPendingSongParam = new URLSearchParams(root.location.search).get("song");
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const MODES = { eighth: "8th", sixteenth: "16th" };
  const LIMITS = { title: 80, section: 40, chord: 12, repeat: 16 };

  function slotCount(mode) { return mode === MODES.sixteenth ? 16 : 8; }
  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
  }
  function cleanText(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  function defaultPattern(mode) {
    return Array.from({ length: slotCount(mode) }, (_, index) => index % (mode === MODES.sixteenth ? 4 : 2) === 0);
  }
  function sanitizePattern(value, mode) {
    const length = slotCount(mode);
    return Array.from({ length }, (_, index) => Boolean(Array.isArray(value) ? value[index] : defaultPattern(mode)[index]));
  }
  function sanitizeChords(value, mode) {
    const result = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    Object.entries(value).forEach(([key, chord]) => {
      const index = Number(key);
      const label = cleanText(chord, LIMITS.chord);
      if (Number.isInteger(index) && index >= 0 && index < slotCount(mode) && label) result[index] = label;
    });
    return result;
  }
  function createBar(mode, source) {
    return { pattern: sanitizePattern(source && source.pattern, mode), chords: sanitizeChords(source && source.chords, mode) };
  }
  function createSection(mode, source, index) {
    const barCount = clamp(source && source.barCount, 1, 2, 1);
    const sourceBars = source && Array.isArray(source.bars) ? source.bars : [];
    return {
      id: cleanText(source && source.id, 80) || createId(),
      name: cleanText(source && source.name, LIMITS.section) || `Section ${index + 1}`,
      barCount,
      repeatCount: clamp(source && source.repeatCount, 1, LIMITS.repeat, 1),
      bars: Array.from({ length: barCount }, (_, barIndex) => createBar(mode, sourceBars[barIndex])),
    };
  }
  function createSong(source) {
    const input = source && typeof source === "object" ? source : {};
    const mode = input.subdivisionMode === MODES.sixteenth ? MODES.sixteenth : MODES.eighth;
    const rawSections = Array.isArray(input.sections) && input.sections.length ? input.sections : [{}];
    return {
      version: VERSION,
      title: cleanText(input.title, LIMITS.title),
      subdivisionMode: mode,
      bpm: clamp(input.bpm, 40, 220, 90),
      countInEnabled: Boolean(input.countInEnabled),
      practiceRampEnabled: Boolean(input.practiceRampEnabled),
      practiceRampStepBpm: clamp(input.practiceRampStepBpm, 1, 20, 2),
      practiceRampEveryBars: clamp(input.practiceRampEveryBars, 1, 16, 2),
      metronomeEnabled: input.metronomeEnabled !== false,
      metronomeDownEnabled: input.metronomeDownEnabled !== false,
      metronomeUpEnabled: input.metronomeUpEnabled !== false,
      strumEnabled: input.strumEnabled !== false,
      strumDownEnabled: input.strumDownEnabled !== false,
      strumUpEnabled: input.strumUpEnabled !== false,
      metronomeVolume: clamp(input.metronomeVolume, 0, 100, 55),
      strumVolume: clamp(input.strumVolume, 0, 100, 70),
      loopSong: Boolean(input.loopSong),
      sections: rawSections.map((section, index) => createSection(mode, section, index)),
    };
  }
  function compactSong(song) {
    const value = createSong(song);
    return { v: VERSION, t: value.title, m: value.subdivisionMode, b: value.bpm, c: value.countInEnabled ? 1 : 0,
      pr: value.practiceRampEnabled ? 1 : 0, ps: value.practiceRampStepBpm, pb: value.practiceRampEveryBars,
      me: value.metronomeEnabled ? 1 : 0, md: value.metronomeDownEnabled ? 1 : 0, mu: value.metronomeUpEnabled ? 1 : 0,
      se: value.strumEnabled ? 1 : 0, sd: value.strumDownEnabled ? 1 : 0, su: value.strumUpEnabled ? 1 : 0, mv: value.metronomeVolume,
      sv: value.strumVolume, l: value.loopSong ? 1 : 0, s: value.sections.map(section => ({
        i: section.id, n: section.name, bc: section.barCount, r: section.repeatCount,
        b: section.bars.map(bar => ({ p: encodePattern(bar.pattern), c: bar.chords }))
      })) };
  }
  function expandSong(value) {
    if (!value || value.v !== VERSION || !Array.isArray(value.s)) throw new Error("Unsupported or invalid song file.");
    return createSong({ version: value.v, title: value.t, subdivisionMode: value.m, bpm: value.b,
      countInEnabled: value.c === 1, practiceRampEnabled: value.pr === 1, practiceRampStepBpm: value.ps,
      practiceRampEveryBars: value.pb, metronomeEnabled: value.me !== 0, metronomeDownEnabled: value.md !== 0,
      metronomeUpEnabled: value.mu !== 0, strumEnabled: value.se !== 0, strumDownEnabled: value.sd !== 0,
      strumUpEnabled: value.su !== 0,
      metronomeVolume: value.mv, strumVolume: value.sv, loopSong: value.l === 1,
      sections: value.s.map(section => ({ id: section.i, name: section.n, barCount: section.bc,
        repeatCount: section.r, bars: Array.isArray(section.b) ? section.b.map(bar => ({
          pattern: decodePattern(bar.p, value.m), chords: bar.c
        })) : [] })) });
  }
  function encodePattern(pattern) {
    return Number.parseInt(pattern.map(Boolean).map(x => x ? "1" : "0").join(""), 2).toString(16).padStart(Math.ceil(pattern.length / 4), "0");
  }
  function decodePattern(value, mode) {
    const length = slotCount(mode);
    const width = Math.ceil(length / 4);
    if (typeof value !== "string" || !new RegExp(`^[\\da-f]{1,${width}}$`, "i").test(value)) return defaultPattern(mode);
    return Number.parseInt(value, 16).toString(2).padStart(length, "0").slice(-length).split("").map(x => x === "1");
  }
  function bytesToBase64Url(bytes) {
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function base64UrlToBytes(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const binary = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }
  function serializeSong(song) { return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(compactSong(song)))); }
  function deserializeSong(value) {
    if (typeof value !== "string" || !value || value.length > 200000) throw new Error("Invalid song link.");
    try { return expandSong(JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)))); }
    catch (error) { throw new Error("Invalid or unsupported song link."); }
  }
  function convertSongMode(song, nextMode) {
    const current = createSong(song);
    if (nextMode !== MODES.eighth && nextMode !== MODES.sixteenth) return current;
    if (current.subdivisionMode === nextMode) return current;
    const toSixteenth = nextMode === MODES.sixteenth;
    current.sections.forEach(section => section.bars.forEach(bar => {
      const nextPattern = Array.from({ length: slotCount(nextMode) }, () => false);
      const nextChords = {};
      if (toSixteenth) {
        bar.pattern.forEach((active, index) => { nextPattern[index * 2] = active; });
        Object.entries(bar.chords).forEach(([index, chord]) => { nextChords[Number(index) * 2] = chord; });
      } else {
        nextPattern.forEach((_, index) => { nextPattern[index] = Boolean(bar.pattern[index * 2]); });
        Object.entries(bar.chords).forEach(([index, chord]) => { if (Number(index) % 2 === 0) nextChords[Number(index) / 2] = chord; });
      }
      bar.pattern = nextPattern; bar.chords = nextChords;
    }));
    current.subdivisionMode = nextMode;
    return current;
  }
  function hasLossySixteenthData(song) {
    const value = createSong(song);
    if (value.subdivisionMode !== MODES.sixteenth) return false;
    return value.sections.some(section => section.bars.some(bar =>
      bar.pattern.some((active, index) => index % 2 === 1 && active) || Object.keys(bar.chords).some(index => Number(index) % 2 === 1)));
  }
  function initialCursor(sectionIndex) { return { sectionIndex: sectionIndex || 0, repetition: 1, barIndex: 0, stepIndex: 0 }; }
  function advanceCursor(song, cursor, options) {
    const value = song && song.version === VERSION ? song : createSong(song); const sectionOnly = options && options.sectionOnly;
    const next = { ...cursor, stepIndex: cursor.stepIndex + 1 }; let completedBar = false; let completedSong = false;
    if (next.stepIndex >= slotCount(value.subdivisionMode)) { next.stepIndex = 0; next.barIndex += 1; completedBar = true; }
    const section = value.sections[next.sectionIndex];
    if (next.barIndex >= section.barCount) {
      next.barIndex = 0;
      if (sectionOnly) return { cursor: next, completedBar, completedSong: false };
      if (next.repetition < section.repeatCount) next.repetition += 1;
      else { next.repetition = 1; next.sectionIndex += 1; }
      if (next.sectionIndex >= value.sections.length) {
        completedSong = true; next.sectionIndex = 0;
      }
    }
    return { cursor: next, completedBar, completedSong };
  }
  return { VERSION, MODES, LIMITS, slotCount, createSong, createSection, serializeSong, deserializeSong,
    compactSong, expandSong, convertSongMode, hasLossySixteenthData, initialCursor, advanceCursor };
});
