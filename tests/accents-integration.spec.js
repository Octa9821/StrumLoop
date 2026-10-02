const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("Song accents preserve keyboard focus, chords, bars, and saved/shared settings", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#songModeBtn").click();
  await page.locator('[data-action="bars"][data-value="2"]').click();
  await page.locator('.chord-input').first().fill("Am7");
  const first = page.locator('.song-grid .slot').first();
  await first.press("Shift+Space");
  await expect(first).toBeFocused();
  await expect(first).toHaveClass(/\baccented\b/);
  await expect(page.locator('.chord-input').first()).toHaveValue("Am7");
  await expect(page.locator('.song-grid').nth(1).locator('.accented')).toHaveCount(0);
  await page.locator('#songAccentsEditBtn').click();
  await first.press("Space");
  await expect(first).toBeFocused();
  await expect(first).not.toHaveClass(/\baccented\b/);
  await expect(first).toHaveClass(/\bactive\b/);
  const rest = page.locator('.song-grid .slot').nth(1);
  await expect(rest).toHaveAttribute("aria-disabled", "true");
  await rest.click({ force: true });
  await expect(rest).not.toHaveClass(/\bactive\b|\baccented\b/);
  await first.click();
  await page.locator('#songClackAccentBtn').click();
  await page.locator('#savedSongName').fill("Accented Song");
  await page.locator('#savedSongForm button').click();
  await first.click();
  await page.locator('#songVolumeAccentBtn').click();
  await page.locator('#savedSongList [data-saved-action="load"]').click();
  await expect(first).toHaveClass(/\baccented\b/);
  await expect(page.locator('#songClackAccentBtn')).toHaveAttribute('aria-pressed', 'true');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportSongBtn').click();
  const download = await downloadPromise;
  const fs = require('node:fs');
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.as).toBe('clack');
  expect(exported.s[0].b[0].a).toBe('80');
  await page.locator('#copySongLinkBtn').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(link);
  await expect(first).toHaveClass(/\baccented\b/);
  await expect(page.locator('#songClackAccentBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#songStrumsEditBtn')).toHaveAttribute('aria-pressed', 'true');
});

for (const mode of ['trainer', 'song']) {
  test(`${mode}: both sounds use consistent gains, clack timing, and mutes`, async ({ page }) => {
    await page.addInitScript(() => {
      window.audioVoices = [];
      window.AudioContext = class {
        currentTime = 0;
        state = 'running';
        destination = {};
        createOscillator() {
          const voice = { frequency: { value: 0 }, connect(gain) { this.gain = gain; }, start(when) { this.when = when; }, stop() {} };
          window.audioVoices.push(voice);
          return voice;
        }
        createGain() {
          const events = [];
          return { events, gain: {
            setValueAtTime: (value, when) => events.push(['set', value, when]),
            exponentialRampToValueAtTime: (value, when) => events.push(['exponential', value, when]),
            linearRampToValueAtTime: (value, when) => events.push(['linear', value, when]),
          }, connect() {} };
        }
      };
    });
    await page.reload();
    if (mode === 'song') await page.locator('#songModeBtn').click();
    const control = (trainer, song) => page.locator(mode === 'song' ? song : trainer);
    await control('#metronomeToggle', '#songMetronome').uncheck();
    await control('#strumVolume', '#songStrumVolume').press('End');
    const first = page.locator(mode === 'song' ? '.song-grid .slot' : '#grid .slot').first();
    const start = control('#playBtn', '#playSongBtn');
    const stop = control('#playBtn', '#stopSongBtn');
    async function play() {
      await page.evaluate(() => { window.audioVoices = []; });
      await start.click();
      const voices = await page.evaluate(() => window.audioVoices.map(voice => ({
        frequency: voice.frequency.value, type: voice.type, when: voice.when, events: voice.gain.events,
      })));
      await stop.click();
      return voices;
    }
    const normal = await play();
    expect(normal).toHaveLength(3);
    await first.click({ modifiers: ['Shift'] });
    const volume = await play();
    expect(volume).toHaveLength(3);
    volume.forEach((voice, index) => {
      expect(voice.events[1][1]).toBeCloseTo(normal[index].events[1][1] * 2.5);
      expect(voice.frequency).toBe(normal[index].frequency);
      expect(voice.when).toBe(normal[index].when);
    });
    await control('#clackAccentBtn', '#songClackAccentBtn').click();
    const clack = await play();
    expect(clack).toHaveLength(5);
    clack.slice(0, 3).forEach((voice, index) => expect(voice.events[1][1]).toBeCloseTo(normal[index].events[1][1]));
    expect(clack.slice(3).map(voice => voice.frequency)).toEqual([800, 1100]);
    expect(clack.slice(3).map(voice => voice.events[1][1])).toEqual([0.06, 0.036]);
    clack.slice(3).forEach(voice => {
      expect(voice.when).toBe(clack[0].when);
      expect(voice.events[2][0]).toBe('linear');
    });
    const balance = await page.evaluate(async ({ normal, layer }) => {
      async function rms(voices) {
        const context = new OfflineAudioContext(1, 22050, 44100);
        voices.forEach(voice => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = voice.type;
          oscillator.frequency.value = voice.frequency;
          voice.events.forEach(([shape, value, when]) => {
            const method = shape === 'set' ? 'setValueAtTime' : shape === 'linear' ? 'linearRampToValueAtTime' : 'exponentialRampToValueAtTime';
            gain.gain[method](value, when);
          });
          oscillator.connect(gain); gain.connect(context.destination);
          oscillator.start(voice.when); oscillator.stop(voice.events.at(-1)[2] + 0.01);
        });
        const samples = (await context.startRendering()).getChannelData(0);
        return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      }
      return (await rms(layer)) / (await rms(normal));
    }, { normal, layer: clack.slice(3) });
    expect(balance).toBeLessThan(1);
    for (const mute of [control('#strumDownToggle', '#songStrumDown'), control('#strumToggle', '#songStrum')]) {
      await mute.uncheck();
      expect(await play()).toHaveLength(0);
      await mute.check();
    }
    await control('#strumVolume', '#songStrumVolume').press('Home');
    expect(await play()).toHaveLength(0);
  });
}
