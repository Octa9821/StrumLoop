const { test, expect } = require("@playwright/test");

// Send real touch input through Chromium's mobile emulator. Unlike a dispatched
// DOM event, this also exercises native scrolling, pointercancel, and tap clicks.
async function touchDriver(page) {
  const session = await page.context().newCDPSession(page);
  const send = (type, points = []) => session.send("Input.dispatchTouchEvent", {
    type, touchPoints: points.map((point, index) => ({ id: index, radiusX: 3, radiusY: 3, force: 1, ...point })),
  });
  return {
    async point(slot) {
      await slot.scrollIntoViewIfNeeded();
      const box = await slot.boundingBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    },
    start: points => send("touchStart", points),
    move: points => send("touchMove", points),
    end: () => send("touchEnd"),
    cancel: () => send("touchCancel"),
    async hold(slot) {
      await send("touchStart", [await this.point(slot)]);
      // The feature has a 500 ms hold threshold; wait for that actual gesture.
      await page.waitForTimeout(650);
      await send("touchEnd");
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const mode of ["trainer", "song"]) {
  async function openMode(page, subdivision = "8th", twoBars = false) {
    if (mode === "song") {
      await page.locator("#songModeBtn").click();
      if (subdivision === "16th") await page.locator("#songSixteenthBtn").click();
      if (twoBars) await page.locator('[data-action="bars"][data-value="2"]').click();
      return page.locator('.song-grid .slot');
    }
    if (subdivision === "16th") await page.locator("#sixteenthModeBtn").click();
    if (twoBars) {
      await page.locator("#twoBarLoopBtn").click();
      await page.locator("#editBarTwoBtn").click();
    }
    return page.locator('#grid .slot');
  }

  for (const subdivision of ["8th", "16th"]) {
    test(`${mode} ${subdivision}: tap and hold edit once, preserve rests, and isolate bars`, async ({ page }, testInfo) => {
      const slots = await openMode(page, subdivision, true);
      const first = slots.first();
      const driver = await touchDriver(page);
      await first.tap();
      await expect(first).not.toHaveClass(/\bactive\b/);
      await first.tap();
      await expect(first).toHaveClass(/\bactive\b/);
      await driver.hold(first);
      await expect(first).toHaveClass(/\baccented\b/);
      await expect(first).toHaveClass(/\bactive\b/);
      if (mode === "song" && subdivision === "8th" && testInfo.project.name === "mobile-390") {
        await page.screenshot({ path: testInfo.outputPath('song-accent-mobile.png') });
      }
      await driver.hold(first);
      await expect(first).not.toHaveClass(/\baccented\b/);
      await expect(first).toHaveClass(/\bactive\b/);
      await driver.hold(first);
      await first.tap();
      await expect(first).not.toHaveClass(/\bactive\b|\baccented\b/);
      await driver.hold(first);
      await expect(first).not.toHaveClass(/\bactive\b|\baccented\b/);
      await slots.nth(1).tap();
      await driver.hold(slots.nth(1));
      await expect(slots.nth(1)).toHaveClass(/\baccented\b/);
      if (mode === "song") {
        await expect(page.locator('.song-grid').nth(1).locator('.accented')).toHaveCount(0);
      } else {
        await page.locator("#editBarOneBtn").click();
        await expect(page.locator('#grid .accented')).toHaveCount(0);
      }
    });
  }

  test(`${mode}: native scroll, movement, cancellation, and multitouch cancel holds`, async ({ page }) => {
    const first = (await openMode(page)).first();
    const driver = await touchDriver(page);
    let point = await driver.point(first);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await driver.start([point]);
    for (let distance = 15; distance <= 100; distance += 15) {
      await driver.move([{ x: point.x, y: point.y - distance }]);
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(650);
    await driver.end();
    await expect(first).toHaveClass(/\bactive\b/);
    await expect(first).not.toHaveClass(/\baccented\b/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);

    point = await driver.point(first);
    await driver.start([point]);
    await driver.move([{ x: point.x + 30, y: point.y }]);
    await page.waitForTimeout(650);
    await driver.end();
    await expect(first).not.toHaveClass(/\baccented\b/);
    await expect(first).toHaveClass(/\bactive\b/);

    point = await driver.point(first);
    await driver.start([point]);
    await driver.cancel();
    await page.waitForTimeout(650);
    await expect(first).not.toHaveClass(/\baccented\b/);

    await driver.start([point]);
    await driver.start([point, { x: point.x + 50, y: point.y }]);
    await page.waitForTimeout(650);
    await driver.cancel();
    await expect(first).not.toHaveClass(/\baccented\b/);
    await first.tap();
    await expect(first).not.toHaveClass(/\bactive\b/);
  });

  test(`${mode}: holds work during playback and survive reload`, async ({ page }) => {
    const first = (await openMode(page)).first();
    const driver = await touchDriver(page);
    const start = page.locator(mode === "song" ? '#playSongBtn' : '#playBtn');
    await start.click();
    await driver.hold(first);
    await expect(first).toHaveClass(/\baccented\b/);
    await expect(first).toHaveClass(/\bactive\b/);
    await page.locator(mode === "song" ? '#stopSongBtn' : '#playBtn').click();
    await page.reload();
    await expect(first).toHaveClass(/\baccented\b/);
    await expect(first).toHaveClass(/\bactive\b/);
  });

  test(`${mode}: mode changes cancel pending holds`, async ({ page }) => {
    const first = (await openMode(page)).first();
    const driver = await touchDriver(page);
    await driver.start([await driver.point(first)]);
    // Trigger the actual UI control while a touch pointer is still down.
    await page.locator(mode === "song" ? '#trainerModeBtn' : '#songModeBtn').click();
    await page.waitForTimeout(650);
    await driver.cancel();
    await page.locator(mode === "song" ? '#songModeBtn' : '#trainerModeBtn').click();
    await expect(first).not.toHaveClass(/\baccented\b/);
  });
}
