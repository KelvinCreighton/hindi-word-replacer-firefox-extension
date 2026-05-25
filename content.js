// content.js
// Walks every text node in the page and replaces matched English words
// with their Hindi equivalents from WORD_MAP (defined in words.js).

(function () {
  "use strict";

  // --- Config ---
  const SHOW_TOOLTIP  = true;   // Show romanized Hindi on hover
  const HIGHLIGHT     = true;   // Wrap replaced words in a styled <span>
  const STORAGE_KEY = "hindiReplacerEnabled";
  const MODE_KEY    = "hindiReplacerMode";
  const SITE_SETTINGS_KEY = "hindiReplacerSiteSettings";

  let activeMap = {};
  let pattern = null;

  /**
   * Builds the active word map and regex pattern based on difficulty.
   */
  function initPattern(mode) {
    if (mode === "easy") {
      activeMap = { ...EASY_WORDS };
    } else if (mode === "hard") {
      activeMap = { ...EASY_WORDS, ...NORMAL_WORDS, ...HARD_WORDS };
    } else {
      // Default to normal
      activeMap = { ...EASY_WORDS, ...NORMAL_WORDS };
    }

    const keys = Object.keys(activeMap).sort((a, b) => b.length - a.length);
    pattern = new RegExp(
      "(?:^|(?<=[^a-zA-Z0-9]))(" + keys.map(escapeRegex).join("|") + ")(?=[^a-zA-Z0-9]|$)",
      "gi"
    );
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeHost(host) {
    return String(host || "")
      .trim()
      .toLowerCase()
      .replace(/^\.+|\.+$/g, "");
  }

  function getSiteSettings(rawSettings) {
    const settings = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    return {
      scope: settings.scope === "none" ? "none" : "all",
      allExcept: Array.isArray(settings.allExcept)
        ? settings.allExcept.map(normalizeHost).filter(Boolean)
        : [],
      noneExcept: Array.isArray(settings.noneExcept)
        ? settings.noneExcept.map(normalizeHost).filter(Boolean)
        : []
    };
  }

  function hostMatchesList(host, entries) {
    const normalizedHost = normalizeHost(host);
    return entries.some((entry) =>
      normalizedHost === entry || normalizedHost.endsWith(`.${entry}`)
    );
  }

  function isSiteEnabled(rawSettings) {
    const host = normalizeHost(window.location.hostname);
    if (!host) return true;

    const settings = getSiteSettings(rawSettings);
    if (settings.scope === "none") {
      return hostMatchesList(host, settings.noneExcept);
    }
    return !hostMatchesList(host, settings.allExcept);
  }

  // Tags whose text content we must NOT touch
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE",
    "NOSCRIPT", "IFRAME", "SELECT", "BUTTON", "LABEL",
    "SUB", "SUP"
  ]);

  /**
   * Determines if a node or any of its ancestors are editable or should be skipped.
   */
  function shouldSkipNode(node) {
    let curr = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (curr && curr !== document.documentElement) {
      if (SKIP_TAGS.has(curr.tagName)) return true;
      if (curr.isContentEditable) return true;
      const role = curr.getAttribute("role");
      if (role === "textbox" || role === "combobox" || role === "searchbox") return true;
      if (curr.classList.contains("hindi-replacer-word")) return true;
      curr = curr.parentElement;
    }
    return false;
  }

  // -------------------------------------------------------------------
  // Core replacement logic
  // Splits a text node into a fragment of text + <span> nodes.
  // -------------------------------------------------------------------
  function replaceInTextNode(textNode) {
    // Safety check: ensure the node still has a parent and we should process it
    if (!textNode.parentNode || shouldSkipNode(textNode) || !pattern) return;

    const original = textNode.nodeValue;
    if (!pattern.test(original)) return; 
    pattern.lastIndex = 0;               

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(original)) !== null) {
      const word      = match[0];
      const wordLower = word.toLowerCase();
      const entry     = activeMap[wordLower];
      if (!entry) continue;

      // Text before this match
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(original.slice(lastIndex, match.index))
        );
      }

      // The replacement node
      const span = document.createElement("span");
      span.textContent = entry;
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

    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  }

  // -------------------------------------------------------------------
  // DOM walker — visits every text node, skips unwanted tags
  // -------------------------------------------------------------------
  function walk(root) {
    if (shouldSkipNode(root)) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (shouldSkipNode(node)) {
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
            replaceInTextNode(node);
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

  api.storage.local.get([STORAGE_KEY, MODE_KEY, SITE_SETTINGS_KEY], (result) => {
    const enabled = result[STORAGE_KEY] !== false;
    const mode = result[MODE_KEY] || "normal";

    if (enabled && isSiteEnabled(result[SITE_SETTINGS_KEY])) {
      initPattern(mode);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
      } else {
        run();
      }
    }
  });

})();
