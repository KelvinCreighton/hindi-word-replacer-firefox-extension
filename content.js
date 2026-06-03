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
  const PRESET_EXCLUSION_LIST_FILE = "preset-exclusion-list.txt";

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

    // Add curly quote variants to the map so they match exactly
    for (const key in activeMap) {
      if (key.includes("'")) {
        activeMap[key.replace(/'/g, "’")] = activeMap[key];
      }
    }

    const keys = Object.keys(activeMap).sort((a, b) => b.length - a.length);
    // Treat straight and curly apostrophes as part of the word
    const boundary = "[^a-zA-Z0-9'’]";
    pattern = new RegExp(
      "(?:^|(?<=" + boundary + "))(" + keys.map(escapeRegex).join("|") + ")(?=" + boundary + "|$)",
      "gi"
    );
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Matches the case of the original word to the replacement string.
   */
  function matchCase(original, replacement) {
    if (!original || !replacement) return replacement;
    // Check for all caps (but not single letters like 'A', usually indices/variables)
    if (original === original.toUpperCase() && original.length > 1) {
      return replacement.toUpperCase();
    }
    // Check for title case
    if (original[0] === original[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
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

  function parsePresetHostList(value) {
    return Array.from(new Set(
      String(value || "")
        .split(/\r?\n/)
        .map((line) => line.replace(/#.*$/, ""))
        .flatMap((line) => line.split(/[\s,]+/))
        .map(normalizeHost)
        .filter(Boolean)
    ));
  }

  async function fetchExtensionText(path) {
    const response = await fetch(api.runtime.getURL(path));
    if (!response.ok) {
      throw new Error(`Unable to load ${path}`);
    }
    return response.text();
  }

  async function mergePresetExclusionList(rawSettings) {
    const settings = getSiteSettings(rawSettings);

    try {
      const text = await fetchExtensionText(PRESET_EXCLUSION_LIST_FILE);
      const presetHosts = parsePresetHostList(text);
      return {
        ...settings,
        allExcept: Array.from(new Set([
          ...settings.allExcept,
          ...presetHosts
        ]))
      };
    } catch (error) {
      return settings;
    }
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
      const replacedText = matchCase(word, entry);
      span.textContent = replacedText;
      span.className = HIGHLIGHT ? "hindi-replacer-word" : "";
      
      if (SHOW_TOOLTIP) {
        span.title = `Original: ${word}`;
      }

      // Metadata
      span.setAttribute("data-original", word);
      span.setAttribute("data-replacement", replacedText);

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
  const usesPromiseApi = typeof browser !== "undefined" && api === browser;

  function getStorage(keys) {
    if (usesPromiseApi) {
      return api.storage.local.get(keys);
    }

    return new Promise((resolve) => {
      api.storage.local.get(keys, resolve);
    });
  }

  getStorage([STORAGE_KEY, MODE_KEY, SITE_SETTINGS_KEY]).then(async (result) => {
    const enabled = result[STORAGE_KEY] !== false;
    const mode = result[MODE_KEY] || "normal";
    const siteSettings = await mergePresetExclusionList(result[SITE_SETTINGS_KEY]);

    if (enabled && isSiteEnabled(siteSettings)) {
      initPattern(mode);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
      } else {
        run();
      }
    }
  });

})();
