// popup.js
(function() {
  "use strict";

  const STORAGE_KEY = "hindiReplacerEnabled";
  const toggle      = document.getElementById("toggle");
  const wordCount   = document.getElementById("word-count");

  const api = typeof browser !== "undefined" ? browser : chrome;

  // Show how many words are in the database
  if (wordCount && typeof WORD_MAP !== "undefined") {
    wordCount.textContent = Object.keys(WORD_MAP).length;
  }

  // Load current state
  api.storage.local.get(STORAGE_KEY, (result) => {
    if (toggle) {
      toggle.checked = result[STORAGE_KEY] !== false; // default ON
    }
  });

  // Save on change
  toggle?.addEventListener("change", () => {
    api.storage.local.set({ [STORAGE_KEY]: toggle.checked });
  });

})();
