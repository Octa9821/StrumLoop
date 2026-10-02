const { test, expect } = require("@playwright/test");

// Playwright exposes native taps but no native hold API for WebKit. Replay the
// pointer sequence in the actual WebKit engine; Chromium's CDP suite separately
// covers trusted touch input, native scroll cancellation, and compatibility clicks.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const mode of ["trainer", "song"]) {
  test(`${mode}: mobile WebKit taps and hold/release replay edit once`, async ({ page }) => {
    if (mode === "song") await page.locator('#songModeBtn').tap();
    const first = page.locator(mode === "song" ? '.song-grid .slot' : '#grid .slot').first();
    await first.tap();
    await expect(first).not.toHaveClass(/\bactive\b/);
    await first.tap();
    await expect(first).toHaveClass(/\bactive\b/);
    await first.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0, clientX: 100, clientY: 100 });
    await page.waitForTimeout(650);
    await expect(first).toHaveClass(/\baccented\b/);
    await first.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0 });
    await first.dispatchEvent('click', { detail: 1 });
    await expect(first).toHaveClass(/\baccented\b/);
    await expect(first).toHaveClass(/\bactive\b/);
    await first.tap();
    await expect(first).not.toHaveClass(/\bactive\b|\baccented\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`${mode}: WebKit cancellation removes the hold timer`, async ({ page }) => {
    if (mode === "song") await page.locator('#songModeBtn').tap();
    const first = page.locator(mode === "song" ? '.song-grid .slot' : '#grid .slot').first();
    await first.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 9, isPrimary: true, button: 0, clientX: 100, clientY: 100 });
    await first.dispatchEvent('pointercancel', { pointerType: 'touch', pointerId: 9, isPrimary: true });
    await page.waitForTimeout(650);
    await expect(first).not.toHaveClass(/\baccented\b/);
    await first.tap();
    await expect(first).not.toHaveClass(/\bactive\b/);
  });
}
