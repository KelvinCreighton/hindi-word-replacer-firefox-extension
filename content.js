// content.js
// Walks every text node in the page and replaces matched English words
// with their Hindi equivalents from WORD_MAP (defined in words.js).

(function () {
  "use strict";

  // --- Config ---
  const SHOW_TOOLTIP  = true;   // Show romanized Hindi on hover
  const HIGHLIGHT     = true;   // Wrap replaced words in a styled <span>
  const STORAGE_KEY   = "hindiReplacerEnabled";

  // Tags whose text content we must NOT touch
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE",
    "NOSCRIPT", "IFRAME", "SELECT", "BUTTON", "LABEL"
  ]);

  // Build a single regex that matches any of the words in WORD_MAP.
  // Sort keys by length (descending) to ensure longer phrases match first.
  const keys = Object.keys(WORD_MAP).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    "\\b(" + keys.map(escapeRegex).join("|") + ")\\b",
    "gi"
  );

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // -------------------------------------------------------------------
  // Core replacement logic
  // Splits a text node into a fragment of text + <span> nodes.
  // -------------------------------------------------------------------
  function replaceInTextNode(textNode) {
    const original = textNode.nodeValue;
    if (!pattern.test(original)) return; 
    pattern.lastIndex = 0;               

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(original)) !== null) {
      const word      = match[0];
      const wordLower = word.toLowerCase();
      const entry     = WORD_MAP[wordLower];
      if (!entry) continue;

      // Text before this match
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(original.slice(lastIndex, match.index))
        );
      }

      // The replacement node
      const span = document.createElement("span");
      span.textContent = entry; // Corrected: entry is now just the Hinglish string
      span.className = HIGHLIGHT ? "hindi-replacer-word" : "";
      
      if (SHOW_TOOLTIP) {
        span.title = `Original: ${word}`;
      }

      // Metadata
      span.setAttribute("data-original", word);
      span.setAttribute("data-replacement", entry);

      fragment.appendChild(span);
      lastIndex = match.index + word.length;
    }

    // Remaining text after last match
    if (lastIndex < original.length) {
      fragment.appendChild(document.createTextNode(original.slice(lastIndex)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  // -------------------------------------------------------------------
  // DOM walker — visits every text node, skips unwanted tags
  // -------------------------------------------------------------------
  function walk(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip if parent is a forbidden tag
          if (SKIP_TAGS.has(node.parentNode.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip if already processed or inside a processed span
          if (node.parentNode.classList.contains("hindi-replacer-word")) {
            return NodeFilter.FILTER_REJECT;
          }
          // Only process nodes with actual text
          return node.nodeValue.trim().length > 0 ? 
            NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceInTextNode);
  }

  // -------------------------------------------------------------------
  // Styles & Observer
  // -------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("hindi-replacer-styles")) return;
    const style = document.createElement("style");
    style.id = "hindi-replacer-styles";
    style.textContent = `
      .hindi-replacer-word {
        color: inherit;
        border-bottom: 1.5px dotted #e07b39;
        cursor: help;
        font-family: inherit;
        font-size: inherit;
      }
      .hindi-replacer-word:hover {
        background-color: rgba(224, 123, 57, 0.12);
        border-radius: 2px;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            walk(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            // Check if parent is valid before processing
            if (!SKIP_TAGS.has(node.parentNode?.tagName) && 
                !node.parentNode?.classList.contains("hindi-replacer-word")) {
              replaceInTextNode(node);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // -------------------------------------------------------------------
  // Main execution
  // -------------------------------------------------------------------
  function run() {
    injectStyles();
    walk(document.body);
    setupObserver();
  }

  // Use 'chrome' or 'browser' depending on environment
  const api = typeof browser !== "undefined" ? browser : chrome;

  api.storage.local.get(STORAGE_KEY, (result) => {
    const enabled = result[STORAGE_KEY] !== false;
    if (enabled) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
      } else {
        run();
      }
    }
  });

})();
