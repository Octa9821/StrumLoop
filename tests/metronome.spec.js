const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

// Drive the real schedulers with a deterministic audio clock; inspect start
// times and envelopes of the oscillators actually submitted to Web Audio.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.audioVoices = [];
    window.audioClock = 0;
    const intervals = new Map();
    let nextId = 0;
    window.setInterval = callback => { intervals.set(++nextId, callback); return nextId; };
    window.clearInterval = id => intervals.delete(id);
    window.advanceAudio = end => {
      while (window.audioClock < end) {
        window.audioClock = Math.min(end, window.audioClock + 0.025);
        [...intervals.values()].forEach(callback => callback());
      }
    };
    window.AudioContext = class {
      get currentTime() { return window.audioClock; }
      state = 'running';
      destination = {};
      createOscillator() {
        const voice = { frequency: { value: 0 }, connect(gain) { this.gain = gain; }, start(when) { this.when = when; }, stop() {} };
        window.audioVoices.push(voice);
        return voice;
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime(value) { this.peak = value; }, linearRampToValueAtTime() {} }, connect() {} };
      }
    };
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

function controls(page, mode) {
  const trainer = mode === 'trainer';
  const pick = (a, b) => page.locator(trainer ? a : b);
  return {
    pulse: pick('#metronomePulse', '#songMetronomePulse'), start: pick('#playBtn', '#playSongBtn'),
    stop: pick('#playBtn', '#stopSongBtn'), strum: pick('#strumToggle', '#songStrum'),
    metro: pick('#metronomeToggle', '#songMetronome'), volume: pick('#metronomeVolume', '#songMetroVolume'),
    countIn: pick('#countInToggle', '#songCountIn'), ramp: pick('#practiceRampToggle', '#songPracticeRamp'),
    bpm: pick('#bpmInput', '#songBpm'), sixteenth: pick('#sixteenthModeBtn', '#songSixteenthBtn'),
  };
}
async function openMode(page, mode) {
  if (mode === 'song') await page.locator('#songModeBtn').click();
  const c = controls(page, mode);
  await c.strum.uncheck();
  await c.bpm.fill('60');
  await c.bpm.blur();
  return c;
}
async function capture(page, c, end) {
  await page.evaluate(() => { window.audioVoices = []; window.audioClock = 0; });
  await c.start.click();
  const voices = await page.evaluate(end => {
    window.advanceAudio(end);
    return window.audioVoices.filter(v => v.type === 'sine').map(v => ({ when: v.when, frequency: v.frequency.value }));
  }, end);
  // Fast-forwarding audio queues section scrolls and can complete the song.
  // Cleanup does not need pointer stability or an enabled Stop button.
  await c.stop.evaluate(button => button.click());
  return voices;
}
function expectTimes(voices, times) {
  expect(voices).toHaveLength(times.length);
  voices.forEach((v, i) => expect(v.when).toBeCloseTo(0.04 + times[i], 8));
}

for (const mode of ['trainer', 'song']) {
  for (const grid of ['8th', '16th']) {
    test(`${mode}, ${grid} grid: scheduled click timestamps for every pulse across two bars`, async ({ page }) => {
      const c = await openMode(page, mode);
      if (grid === '16th') await c.sixteenth.click();
      if (mode === 'trainer') await page.locator('#twoBarLoopBtn').click();
      else await page.locator('#addSectionBtn').click(); // Cross a song section boundary.
      for (const [pulse, spacing] of [['quarter', 1], ['8th', 0.5], ['16th', 0.25]]) {
        await c.pulse.selectOption(pulse);
        const voices = await capture(page, c, 7.88);
        const times = Array.from({ length: 8 / spacing }, (_, i) => i * spacing);
        expectTimes(voices, times);
        voices.forEach((voice, i) => expect(voice.frequency).toBe(times[i] % 1 === 0 ? 1180 : 1620));
      }
    });
  }
  test(`${mode}: count-in bypasses legacy flags and playback mute; zero volume stays silent`, async ({ page }) => {
    const c = await openMode(page, mode);
    // Seed a legacy session with both directions disabled.
    await page.evaluate(mode => {
      const key = mode === 'trainer' ? 'strumming-pattern-builder:state' : 'strumloop:song-draft:v1';
      const state = JSON.parse(localStorage.getItem(key));
      state.metronomePulse = 'legacy'; state.metronomeDownEnabled = false; state.metronomeUpEnabled = false;
      localStorage.setItem(key, JSON.stringify(state));
    }, mode);
    await page.reload();
    await c.countIn.check(); await c.metro.uncheck();
    expectTimes(await capture(page, c, 7.88), [0,1,2,3]);
    await c.volume.fill('0');
    expect(await capture(page, c, 7.88)).toHaveLength(0);
  });
  test(`${mode}: ramp changes tempo at the bar boundary`, async ({ page }) => {
    const c = await openMode(page, mode);
    await c.pulse.selectOption('16th');
    await c.ramp.check();
    await page.locator(mode === 'trainer' ? '#practiceRampBarsInput' : '#songRampBars').fill('1');
    await page.locator(mode === 'trainer' ? '#practiceRampStepInput' : '#songRampStep').fill('20');
    await c.pulse.focus();
    if (mode === 'song') await page.locator('#addSectionBtn').click();
    const voices = await capture(page, c, 5.9);
    expectTimes(voices.slice(0, 16), Array.from({ length: 16 }, (_, i) => i / 4));
    expect(voices[16].when).toBeCloseTo(4.04, 8);
    expect(voices[17].when - voices[16].when).toBeCloseTo(15 / 80, 8);
    await expect(c.bpm).toHaveValue('60');
  });
  test(`${mode}: changing pulse during playback does not restart or replay count-in`, async ({ page }) => {
    const c = await openMode(page, mode);
    await c.countIn.check();
    await c.start.click();
    await page.evaluate(() => window.advanceAudio(4.4));
    await c.pulse.selectOption('16th');
    const times = await page.evaluate(() => {
      window.advanceAudio(5.8);
      return window.audioVoices.filter(v => v.type === 'sine').map(v => v.when);
    });
    expectTimes(times.slice(0, 8).map(when => ({ when })), [0, 1, 2, 3, 4, 4.5, 4.75, 5]);
    expect(new Set(times).size).toBe(times.length);
    await c.stop.click();
  });
}

test('Trainer: browser persistence, sharing and legacy controls', async ({ page }) => {
  const c = await openMode(page, 'trainer');
  await c.pulse.selectOption('16th');
  await page.reload();
  await expect(c.pulse).toHaveValue('16th');
  await page.goto('/?m=16th&p=aaaa&b=60&md=1&mu=0');
  await expect(c.pulse).toHaveValue('legacy');
  await expect(page.locator('#metronomeLegacyDown')).toBeVisible();
  await c.strum.uncheck();
  expectTimes(await capture(page, c, 3.88), Array.from({ length: 8 }, (_, i) => i / 2));
  await c.pulse.selectOption('quarter');
  await expect(page.locator('#metronomeLegacyDown')).toBeHidden();
  await c.pulse.focus(); await page.keyboard.press('8'); await page.keyboard.press('Tab');
  await expect(c.pulse).toHaveValue('8th');
  const url = await page.evaluate(() => buildShareUrl().href);
  await page.goto(url);
  await expect(c.pulse).toHaveValue('8th');
});

test('Song: saved song, export/import and share preserve pulse', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const c = await openMode(page, 'song');
  await c.pulse.selectOption('16th');
  await page.locator('#savedSongName').fill('Metronome');
  await page.locator('#savedSongForm button').click();
  await c.pulse.selectOption('quarter');
  await page.locator('#savedSongList [data-saved-action="load"]').click();
  await expect(c.pulse).toHaveValue('16th');
  const download = page.waitForEvent('download');
  await page.locator('#exportSongBtn').click();
  const file = JSON.parse(fs.readFileSync(await (await download).path(), 'utf8'));
  expect(file.mp).toBe('16th');
  await c.pulse.selectOption('quarter');
  await page.locator('#importSongFile').setInputFiles({ name: 'pulse.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(c.pulse).toHaveValue('16th');
  await page.locator('#copySongLinkBtn').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(link);
  await expect(c.pulse).toHaveValue('16th');
  delete file.mp; file.md = 0; file.mu = 1;
  await page.locator('#importSongFile').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(c.pulse).toHaveValue('legacy');
  await expect(page.locator('#songMetronomeLegacyUp')).toBeVisible();
});

for (const width of [390, 412, 1280]) {
  test(`metronome controls fit ${width}px and support native keyboard input`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ['trainer', 'song']) {
      const c = await openMode(page, mode);
      await expect(c.pulse).toHaveValue('quarter');
      await c.pulse.focus(); await page.keyboard.press('8'); await page.keyboard.press('Tab');
      await expect(c.pulse).toHaveValue('8th');
      await c.sixteenth.click();
      await expect(c.pulse).toHaveValue('8th');
      const bounds = await c.pulse.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}
