const test = require('node:test');
const assert = require('node:assert/strict');
const Metro = require('../metronome.js');
const Core = require('../song-core.js');

for (const grid of ['8th', '16th']) {
  for (const [pulse, spacing] of [['quarter', 1], ['8th', 0.5], ['16th', 0.25]]) {
    test(`${grid} grid / ${pulse}: exact offsets over two bars at 60 BPM`, () => {
      const count = grid === '16th' ? 16 : 8;
      const duration = 4 / count;
      const clicks = Array.from({ length: 2 * count }, (_, index) =>
        Metro.clicksForStep({ subdivisionMode: grid, metronomePulse: pulse }, index % count, duration)
          .map(click => ({ time: index * duration + click.offset, strong: click.strong }))).flat();
      assert.deepEqual(clicks.map(click => click.time), Array.from({ length: 8 / spacing }, (_, i) => i * spacing));
      assert.deepEqual(clicks.filter(click => click.strong).map(click => click.time), [0,1,2,3,4,5,6,7]);
    });
  }
  for (const down of [true, false]) for (const up of [true, false]) {
    test(`${grid}: legacy preserves down=${down}, up=${up}`, () => {
      for (let index = 0; index < (grid === '16th' ? 16 : 8); index++) {
        const strong = index % 2 === 0;
        assert.deepEqual(Metro.clicksForStep({ subdivisionMode: grid, metronomePulse: 'legacy',
          metronomeDownEnabled: down, metronomeUpEnabled: up }, index, 0.25),
        (strong ? down : up) ? [{ offset: 0, strong }] : []);
      }
    });
  }
}

test('fresh songs default to beats; legacy data, invalid values and all pulse values round-trip', () => {
  assert.equal(Core.createSong().metronomePulse, 'quarter');
  assert.equal(Core.createSong({}).metronomePulse, 'legacy');
  for (const pulse of ['quarter', '8th', '16th', 'legacy', 'invalid', null]) {
    const song = Core.createSong({ metronomePulse: pulse, metronomeDownEnabled: false, metronomeUpEnabled: true });
    assert.equal(song.metronomePulse, Metro.sanitizePulse(pulse));
    const file = Core.compactSong(song);
    assert.equal(file.v, 1);
    assert.equal(file.mp, song.metronomePulse);
    assert.deepEqual(Core.expandSong(file), song);
    assert.deepEqual(Core.deserializeSong(Core.serializeSong(song)), song);
  }
  const oldFile = Core.compactSong(Core.createSong({ metronomeDownEnabled: false, metronomeUpEnabled: false }));
  delete oldFile.mp;
  assert.equal(Core.expandSong(oldFile).metronomePulse, 'legacy');
  assert.equal(Core.expandSong(oldFile).metronomeDownEnabled, false);
  assert.equal(Core.expandSong(oldFile).metronomeUpEnabled, false);
});
