(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StrumLoopMetronome = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function sanitizePulse(value) {
    return ["quarter", "8th", "16th", "legacy"].includes(value) ? value : "quarter";
  }

  function pulseFromSource(source) {
    if (!source) return "quarter";
    return source.metronomePulse === undefined ? "legacy" : sanitizePulse(source.metronomePulse);
  }

  // Offsets belong to this grid step, including the extra click when a
  // sixteenth-note metronome plays over an eighth-note strumming grid.
  function clicksForStep(settings, stepIndex, stepDuration) {
    const pulse = sanitizePulse(settings.metronomePulse);
    if (pulse === "legacy") {
      const strong = stepIndex % 2 === 0;
      if ((strong && !settings.metronomeDownEnabled) || (!strong && !settings.metronomeUpEnabled)) return [];
      return [{ offset: 0, strong }];
    }
    const ticksPerStep = settings.subdivisionMode === "16th" ? 1 : 2;
    const spacing = pulse === "quarter" ? 4 : pulse === "8th" ? 2 : 1;
    const clicks = [];
    for (let offsetTick = 0; offsetTick < ticksPerStep; offsetTick += 1) {
      const tick = stepIndex * ticksPerStep + offsetTick;
      if (tick % spacing === 0) clicks.push({ offset: stepDuration * offsetTick / ticksPerStep, strong: tick % 4 === 0 });
    }
    return clicks;
  }

  return { sanitizePulse, pulseFromSource, clicksForStep };
});
