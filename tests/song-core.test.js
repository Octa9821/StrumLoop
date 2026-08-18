const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../song-core.js");

test("creates and sanitizes a default song", () => {
  const song = Core.createSong({ title: "  Practice  ", bpm: 999, sections: [{ name: "Verse", repeatCount: 30 }] });
  assert.equal(song.title, "Practice");
  assert.equal(song.bpm, 220);
  assert.equal(song.sections[0].repeatCount, 16);
  assert.equal(song.sections[0].bars[0].pattern.length, 8);
});

test("round trips unicode, settings, and sparse chord labels", () => {
  const song = Core.createSong({ title: "Cântec 🎸", subdivisionMode: "16th", practiceRampEnabled: true,
    practiceRampStepBpm: 4, metronomeUpEnabled: false, sections: [{ name: "Refren", bars: [{ chords: { 3: "F#m7", 15: "B♭" } }] }] });
  const decoded = Core.deserializeSong(Core.serializeSong(song));
  assert.equal(decoded.title, "Cântec 🎸");
  assert.equal(decoded.practiceRampStepBpm, 4);
  assert.equal(decoded.metronomeUpEnabled, false);
  assert.deepEqual(decoded.sections[0].bars[0].chords, { 3: "F#m7", 15: "B♭" });
});

test("rejects malformed and unsupported payloads", () => {
  assert.throws(() => Core.deserializeSong("not-json"), /Invalid/);
  assert.throws(() => Core.expandSong({ v: 2, s: [] }), /Unsupported/);
});

test("converts eighth-note positions to sixteenth-note positions", () => {
  const song = Core.createSong({ sections: [{ bars: [{ pattern: [true, false, false, false, false, false, false, false], chords: { 1: "Am" } }] }] });
  const converted = Core.convertSongMode(song, "16th");
  assert.equal(converted.sections[0].bars[0].pattern[0], true);
  assert.equal(converted.sections[0].bars[0].chords[2], "Am");
});

test("detects data that a sixteenth-to-eighth conversion would lose", () => {
  const song = Core.createSong({ subdivisionMode: "16th", sections: [{ bars: [{ chords: { 1: "C" } }] }] });
  assert.equal(Core.hasLossySixteenthData(song), true);
});

test("transport advances through bars, repetitions, sections, and completion", () => {
  const song = Core.createSong({ sections: [
    { name: "Verse", barCount: 1, repeatCount: 2 },
    { name: "Chorus", barCount: 2, repeatCount: 1 },
  ] });
  let cursor = Core.initialCursor(0); let completedSong = false;
  for (let index = 0; index < 32; index += 1) {
    const result = Core.advanceCursor(song, cursor); cursor = result.cursor; completedSong = result.completedSong;
  }
  assert.equal(completedSong, true);
  assert.deepEqual(cursor, Core.initialCursor(0));
});

test("section-only transport loops the chosen section", () => {
  const song = Core.createSong({ sections: [{}, { name: "Chorus", barCount: 1 }] });
  let cursor = Core.initialCursor(1);
  for (let index = 0; index < 8; index += 1) cursor = Core.advanceCursor(song, cursor, { sectionOnly: true }).cursor;
  assert.deepEqual(cursor, Core.initialCursor(1));
});

test("a new bar defaults to no accents", () => {
  const song = Core.createSong();
  const bar = song.sections[0].bars[0];
  assert.equal(bar.accents.length, bar.pattern.length);
  assert.equal(bar.accents.some(Boolean), false);
});

test("sanitizes accents so an accent can never sit on a rest", () => {
  const song = Core.createSong({
    sections: [{ bars: [{ pattern: [true, false, false, false, false, false, false, false], accents: [true, true, true, true, true, true, true, true] }] }],
  });
  const bar = song.sections[0].bars[0];
  assert.deepEqual(bar.accents, [true, false, false, false, false, false, false, false]);
});

test("round trips accents through serialize/deserialize", () => {
  const song = Core.createSong({
    sections: [{ bars: [{ pattern: [true, false, true, false, true, false, true, false], accents: [true, false, false, false, true, false, false, false] }] }],
  });
  const decoded = Core.deserializeSong(Core.serializeSong(song));
  assert.deepEqual(decoded.sections[0].bars[0].accents, [true, false, false, false, true, false, false, false]);
});

test("converting eighth to sixteenth doubles accent positions too", () => {
  const song = Core.createSong({
    sections: [{ bars: [{ pattern: [true, false, false, false, false, false, false, false], accents: [true, false, false, false, false, false, false, false] }] }],
  });
  const converted = Core.convertSongMode(song, "16th");
  assert.equal(converted.sections[0].bars[0].accents[0], true);
  assert.equal(converted.sections[0].bars[0].accents.some((value, index) => index !== 0 && value), false);
});

test("converting sixteenth to eighth drops odd-indexed accents", () => {
  const song = Core.createSong({
    subdivisionMode: "16th",
    sections: [{ bars: [{ pattern: [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false], accents: [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }] }],
  });
  const converted = Core.convertSongMode(song, "8th");
  assert.deepEqual(converted.sections[0].bars[0].accents, [true, false, false, false, false, false, false, false]);
});

test("flags accent data that a sixteenth-to-eighth conversion would lose", () => {
  const song = Core.createSong({
    subdivisionMode: "16th",
    sections: [{ bars: [{ pattern: [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false], accents: [false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false] }] }],
  });
  assert.equal(Core.hasLossySixteenthData(song), true);
});

test("expands a v1 payload with no accent field on its bars without throwing", () => {
  const legacy = { v: 1, t: "Legacy", m: "8th", b: 90, c: 0, pr: 0, ps: 2, pb: 2, me: 1, md: 1, mu: 1, se: 1, sd: 1, su: 1, mv: 55, sv: 70, l: 0,
    s: [{ i: "section-1", n: "Verse", bc: 1, r: 1, b: [{ p: "80", c: {} }] }] };
  const expanded = Core.expandSong(legacy);
  assert.deepEqual(expanded.sections[0].bars[0].accents, [false, false, false, false, false, false, false, false]);
});
