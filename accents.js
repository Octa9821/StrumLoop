(function () {
  "use strict";

  const volumeMultiplier = 2.5;
  const clackVoices = [
    { frequency: 800, gain: 0.06, duration: 0.09 },
    { frequency: 1100, gain: 0.036, duration: 0.06 },
  ];

  // Track touch pointers outside the grid too: scrolling and leaving the slot
  // must cancel a hold, and its eventual compatibility click must not edit twice.
  function attachLongPress(root, onAccent) {
    let press = null;
    let suppressedClick = null;

    function clearTimer() {
      if (press) window.clearTimeout(press.timer);
    }
    function cancel() {
      clearTimer();
      if (press) suppressedClick = { slot: press.slot, expires: Date.now() + 800 };
      press = null;
    }
    function slotIdentity(slot) {
      return JSON.stringify(slot.dataset);
    }

    window.addEventListener("pointerdown", event => {
      if (press && event.pointerId !== press.id) cancel();
      else if (!press) suppressedClick = null;
    }, true);
    root.addEventListener("pointerdown", event => {
      if (event.pointerType !== "touch" || event.isPrimary === false || event.button !== 0) return;
      const slot = event.target.closest(".slot");
      if (!slot || !root.contains(slot)) return;
      clearTimer();
      press = { id: event.pointerId, slot, identity: slotIdentity(slot), x: event.clientX, y: event.clientY, triggered: false };
      const started = press;
      press.timer = window.setTimeout(() => {
        if (press !== started || !slot.isConnected || !slot.getClientRects().length || slotIdentity(slot) !== started.identity) {
          cancel();
          return;
        }
        started.triggered = true;
        onAccent(slot);
      }, 500);
    });
    window.addEventListener("pointermove", event => {
      if (press && event.pointerId === press.id && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancel();
    }, true);
    window.addEventListener("pointerup", event => {
      if (!press || event.pointerId !== press.id) return;
      clearTimer();
      if (press.triggered) suppressedClick = { slot: press.slot, expires: Date.now() + 800 };
      press = null;
    }, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", cancel);
    window.addEventListener("click", event => {
      if (!suppressedClick || Date.now() > suppressedClick.expires) return;
      if (event.detail === 0) return; // Keyboard activation is never a touch click.
      if (event.target.closest(".slot") !== suppressedClick.slot) return;
      suppressedClick = null;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    root.addEventListener("contextmenu", event => {
      if (event.target.closest(".slot")) event.preventDefault();
    });
    return { cancel };
  }

  window.StrumLoopAccents = { volumeMultiplier, clackVoices, attachLongPress };
})();
