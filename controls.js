(function () {
  "use strict";

  function getControlName(input) {
    const explicitLabel = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    const wrappingLabel = input.closest("label");
    const label = explicitLabel || wrappingLabel;
    const text = label?.querySelector("span")?.textContent || input.getAttribute("aria-label") || "value";
    return text.trim().replace(/[:.]$/, "") || "value";
  }

  function updateButtons(input, decreaseButton, increaseButton) {
    const value = Number(input.value);
    const minimum = input.min === "" ? -Infinity : Number(input.min);
    const maximum = input.max === "" ? Infinity : Number(input.max);
    decreaseButton.disabled = input.disabled || (Number.isFinite(value) && value <= minimum);
    increaseButton.disabled = input.disabled || (Number.isFinite(value) && value >= maximum);
  }

  function enhanceNumberInput(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== "number" || input.dataset.stepperEnhanced === "true") return;

    input.dataset.stepperEnhanced = "true";
    const name = getControlName(input);
    const wrapper = document.createElement("div");
    wrapper.className = "number-stepper";
    const decreaseButton = document.createElement("button");
    decreaseButton.type = "button";
    decreaseButton.className = "number-stepper-button";
    decreaseButton.textContent = "−";
    decreaseButton.setAttribute("aria-label", `Decrease ${name}`);
    const increaseButton = document.createElement("button");
    increaseButton.type = "button";
    increaseButton.className = "number-stepper-button";
    increaseButton.textContent = "+";
    increaseButton.setAttribute("aria-label", `Increase ${name}`);

    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(decreaseButton, input, increaseButton);

    function step(direction) {
      if (input.value.trim() === "") input.value = input.min || "0";
      direction < 0 ? input.stepDown() : input.stepUp();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      updateButtons(input, decreaseButton, increaseButton);
    }

    decreaseButton.addEventListener("click", () => step(-1));
    increaseButton.addEventListener("click", () => step(1));
    input.addEventListener("input", () => updateButtons(input, decreaseButton, increaseButton));
    input.addEventListener("change", () => updateButtons(input, decreaseButton, increaseButton));
    updateButtons(input, decreaseButton, increaseButton);
  }

  function enhanceWithin(root) {
    if (root instanceof HTMLInputElement) enhanceNumberInput(root);
    root.querySelectorAll?.('input[type="number"]').forEach(enhanceNumberInput);
  }

  function syncAll() {
    document.querySelectorAll('input[type="number"][data-stepper-enhanced="true"]').forEach(input => {
      const wrapper = input.closest(".number-stepper");
      const buttons = wrapper?.querySelectorAll(".number-stepper-button");
      if (buttons?.length === 2) updateButtons(input, buttons[0], buttons[1]);
    });
  }

  enhanceWithin(document);
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) enhanceWithin(node);
    }));
  }).observe(document.body, { childList: true, subtree: true });
  window.StrumLoopControls = { enhance: enhanceWithin, sync: syncAll };
})();
