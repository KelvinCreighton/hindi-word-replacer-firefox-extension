// popup.js
(function() {
  "use strict";

  const STORAGE_KEY = "hindiReplacerEnabled";
  const MODE_KEY    = "hindiReplacerMode";
  const toggle      = document.getElementById("toggle");
  const wordCount   = document.getElementById("word-count");
  const modeRadios  = document.querySelectorAll('input[name="mode"]');

  const api = typeof browser !== "undefined" ? browser : chrome;

  function updateWordCount(mode) {
    if (!wordCount) return;
    
    let count = 0;
    if (mode === "easy") {
      count = Object.keys(EASY_WORDS).length;
    } else if (mode === "hard") {
      count = Object.keys(EASY_WORDS).length + Object.keys(NORMAL_WORDS).length + Object.keys(HARD_WORDS).length;
    } else {
      // normal
      count = Object.keys(EASY_WORDS).length + Object.keys(NORMAL_WORDS).length;
    }
    wordCount.textContent = count;
  }

  // Load current state
  api.storage.local.get([STORAGE_KEY, MODE_KEY], (result) => {
    if (toggle) {
      toggle.checked = result[STORAGE_KEY] !== false; // default ON
    }
    
    const savedMode = result[MODE_KEY] || "normal";
    modeRadios.forEach(radio => {
      if (radio.value === savedMode) {
        radio.checked = true;
      }
    });
    updateWordCount(savedMode);
  });

  // Save on change
  toggle?.addEventListener("change", () => {
    api.storage.local.set({ [STORAGE_KEY]: toggle.checked });
  });

  modeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        api.storage.local.set({ [MODE_KEY]: radio.value });
        updateWordCount(radio.value);
      }
    });
  });

})();
