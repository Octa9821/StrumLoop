const { test, expect } = require("@playwright/test");

async function expectContained(page, selectors) {
  const failures = await page.evaluate(list => list.flatMap(selector => Array.from(document.querySelectorAll(selector)).flatMap(element => {
    const parent = element.parentElement;
    const rect = element.getBoundingClientRect();
    if (element.getClientRects().length === 0 || rect.width === 0) return [];
    const parentRect = parent?.getBoundingClientRect();
    const problems = [];
    if (element.scrollWidth > element.clientWidth + 1) problems.push(`${selector} scrolls horizontally`);
    if (parentRect && (rect.left < parentRect.left - 1 || rect.right > parentRect.right + 1)) problems.push(`${selector} leaves its parent`);
    return problems;
  })), selectors);
  expect(failures).toEqual([]);
}

async function gridColumnCount(locator) {
  return locator.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("existing Trainer remains editable and playable", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Metronome", exact: true })).toBeVisible();
  const firstSlot = page.locator("#grid .slot").first();
  const before = await firstSlot.getAttribute("aria-pressed");
  await firstSlot.click();
  await expect(firstSlot).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
  await page.locator("#playBtn").click();
  await expect(page.locator("#playBtn")).toHaveText("Stop");
  await page.locator("#songModeBtn").click();
  await expect(page.locator("#songMode")).toBeVisible();
  await expect(page.locator("#playBtn")).toHaveText("Start");
  await page.locator("#trainerModeBtn").click();
  await expect(page.locator("#trainerMode")).toBeVisible();
});

test("Trainer slot hover stays inside its grid", async ({ page }) => {
  await page.locator("#sixteenthModeBtn").click();
  await page.locator("#twoBarLoopBtn").click();
  const slot = page.locator('.grid[data-mode="16th"]:visible .slot').first();
  await slot.scrollIntoViewIfNeeded();
  const before = await slot.boundingBox();
  await slot.hover();
  const after = await slot.boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  await expectContained(page, ['.grid[data-mode="16th"]', '.grid[data-mode="16th"] .slot']);
});

test("builds, reorders, annotates, and persists song sections", async ({ page }) => {
  await page.locator("#songModeBtn").click();
  await page.locator("#songTitle").fill("Smoke Song");
  await page.locator("#songSections .chord-input").nth(1).fill("Am7");
  await page.locator("#addSectionBtn").click();
  await expect(page.locator(".song-section-card")).toHaveCount(2);
  await page.locator('[data-section-name]').nth(1).fill("Chorus");
  await page.locator('[data-action="up"]').nth(1).click();
  await expect(page.locator('[data-section-name]').first()).toHaveValue("Chorus");
  await page.reload();
  await expect(page.locator("#songMode")).toBeVisible();
  await expect(page.locator("#songTitle")).toHaveValue("Smoke Song");
  await expect(page.locator('.chord-input[value="Am7"]')).toHaveCount(1);
});

test("saves, loads, and shares a song", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#songModeBtn").click();
  await page.locator("#songTitle").fill("Saved Song");
  await page.locator("#savedSongName").fill("My Song");
  await page.locator("#savedSongForm button").click();
  await expect(page.locator("#savedSongList")).toContainText("My Song");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportSongBtn").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.strumloop\.json$/);
  const exported = await page.evaluate(() => JSON.stringify(StrumLoopSongCore.compactSong(JSON.parse(localStorage.getItem("strumloop:song-draft:v1")))));
  await page.locator("#songTitle").fill("Changed Song");
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#importSongFile").setInputFiles({ name: "song.strumloop.json", mimeType: "application/json", buffer: Buffer.from(exported) });
  await expect(page.locator("#songTitle")).toHaveValue("Saved Song");
  await page.locator("#copySongLinkBtn").click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain("?song=");
  await page.goto(link);
  await expect(page.locator("#songMode")).toBeVisible();
  await expect(page.locator("#songTitle")).toHaveValue("Saved Song");
});

test("starts section and whole-song playback", async ({ page }) => {
  await page.locator("#songModeBtn").click();
  await page.locator('[data-action="loop"]').click();
  await expect(page.locator("#stopSongBtn")).toBeEnabled();
  await page.locator("#stopSongBtn").click();
  await expect(page.locator("#songStatus")).toHaveText("Ready");
  await page.locator("#songBpm").fill("220");
  await page.locator("#playSongBtn").click();
  await expect(page.locator("#stopSongBtn")).toBeEnabled();
  await expect(page.locator("#songStatus")).toHaveText("Complete", { timeout: 5000 });
  await expect(page.locator("#stopSongBtn")).toBeDisabled();
});

test("song mode has no page-level mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#songModeBtn").click();
  await page.locator("#songSixteenthBtn").click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("Bars toggle and number steppers preserve existing state behavior", async ({ page }) => {
  const trainerBpmField = page.locator("#bpmInput").locator("..");
  await trainerBpmField.getByRole("button", { name: "Increase BPM" }).click();
  await expect(page.locator("#bpmInput")).toHaveValue("91");
  await page.locator("#bpmInput").fill("220");
  await expect(trainerBpmField.getByRole("button", { name: "Increase BPM" })).toBeDisabled();
  await trainerBpmField.getByRole("button", { name: "Decrease BPM" }).click();
  await expect(page.locator("#bpmInput")).toHaveValue("219");

  await page.locator("#songModeBtn").click();
  const firstSection = page.locator(".song-section-card").first();
  await firstSection.getByRole("button", { name: "2 Bars" }).click();
  await expect(firstSection.getByRole("button", { name: "2 Bars" })).toHaveAttribute("aria-pressed", "true");
  await expect(firstSection.locator(".song-bar")).toHaveCount(2);
  await firstSection.getByRole("button", { name: "Increase Repeats" }).click();
  await expect(firstSection.locator('[data-section-repeat]')).toHaveValue("2");
  await page.reload();
  await expect(page.locator(".song-section-card").first().locator(".song-bar")).toHaveCount(2);
  await expect(page.locator('[data-section-repeat]').first()).toHaveValue("2");
});

test("16th-note grids wrap predictably and stay contained", async ({ page }) => {
  const cases = [
    { width: 1920, songColumns: 16, trainerColumns: 16 },
    { width: 1440, songColumns: 16, trainerColumns: 16 },
    { width: 1365, songColumns: 16, trainerColumns: 16 },
    { width: 1250, songColumns: 16, trainerColumns: 16 },
    { width: 1200, songColumns: 8, trainerColumns: 8 },
    { width: 1024, songColumns: 8, trainerColumns: 8 },
    { width: 760, songColumns: 4, trainerColumns: 1 },
    { width: 390, songColumns: 2, trainerColumns: 1 },
  ];

  for (const current of cases) {
    await page.setViewportSize({ width: current.width, height: 900 });
    await page.locator("#songModeBtn").click();
    await page.locator("#songSixteenthBtn").click();
    const songGrid = page.locator(".song-grid").first();
    expect(await gridColumnCount(songGrid)).toBe(current.songColumns);
    await expectContained(page, [".app", ".song-section-card", ".song-bar", ".song-grid", ".song-slot", ".chord-input", ".number-stepper"]);

    await page.locator("#trainerModeBtn").click();
    await page.locator("#sixteenthModeBtn").click();
    await page.locator("#twoBarLoopBtn").click();
    const trainerGrid = page.locator('.grid[data-mode="16th"]:visible').first();
    expect(await gridColumnCount(trainerGrid)).toBe(current.trainerColumns);
    await expectContained(page, [".app", ".control-card", ".number-stepper", ".grid-shell", ".bar-grid-card", '.grid[data-mode="16th"]:not([hidden])', '.grid[data-mode="16th"] .slot']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
});

test("section repeat control and actions never overlap", async ({ page }) => {
  await page.locator("#songModeBtn").click();
  for (const width of [1440, 1200, 1024, 760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const overlaps = await page.locator(".song-section-card").first().evaluate(card => {
      const repeat = card.querySelector(".song-repeat-setting").getBoundingClientRect();
      const actions = card.querySelector(".song-section-actions").getBoundingClientRect();
      return !(repeat.right <= actions.left || repeat.left >= actions.right || repeat.bottom <= actions.top || repeat.top >= actions.bottom);
    });
    expect(overlaps).toBe(false);
  }
});

test("rhythm buttons align and section identity animates through reordering", async ({ page }) => {
  await page.locator("#songModeBtn").click();
  const eighthBox = await page.locator("#songEighthBtn").boundingBox();
  const sixteenthBox = await page.locator("#songSixteenthBtn").boundingBox();
  expect(Math.abs(eighthBox.width - sixteenthBox.width)).toBeLessThan(1);

  await page.locator("#addSectionBtn").click();
  const movedCard = page.locator(".song-section-card").nth(1);
  const movedId = await movedCard.getAttribute("data-section-card");
  const tintClass = (await movedCard.getAttribute("class")).match(/section-tint-\d/)[0];
  await page.evaluate(() => {
    window.__sectionAnimationCount = 0;
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this.matches?.(".song-section-card")) window.__sectionAnimationCount += 1;
      return originalAnimate.apply(this, args);
    };
  });
  await movedCard.getByRole("button", { name: /Move .* up/ }).click();
  const reorderedCard = page.locator(`[data-section-card="${movedId}"]`);
  await expect(reorderedCard).toHaveClass(new RegExp(tintClass));
  await expect.poll(() => page.evaluate(() => window.__sectionAnimationCount)).toBeGreaterThan(0);
});

test("whole-song playback anticipates and focuses the next section", async ({ page }) => {
  await page.locator("#songModeBtn").click();
  await page.locator('[data-section-name]').fill("Verse");
  await page.locator("#addSectionBtn").click();
  await page.locator('[data-section-name]').nth(1).fill("Chorus");
  await page.locator("#songBpm").fill("220");
  const expectedSecondTop = await page.locator(".song-section-card").nth(1).evaluate(card => window.scrollY + card.getBoundingClientRect().top - 16);
  await page.evaluate(top => {
    window.__songScrollCalls = [];
    window.__expectedTop = top;
    window.scrollTo = options => window.__songScrollCalls.push({ ...options, status: document.querySelector("#songStatus").textContent });
  }, expectedSecondTop);
  await page.locator("#playSongBtn").click();
  await expect.poll(() => page.evaluate(() => window.__songScrollCalls.find(call => Math.abs(call.top - window.__expectedTop) < 2)?.status || ""), {
    timeout: 3000,
  }).toContain("Verse");
  await expect(page.locator("#songStatus")).toContainText("Chorus", { timeout: 3000 });
  await expect(page.locator(".song-section-card").nth(1)).toHaveClass(/is-playing/);
  await page.locator("#stopSongBtn").click();
});
