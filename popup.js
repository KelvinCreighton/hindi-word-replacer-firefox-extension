// popup.js
(function() {
  "use strict";

  const STORAGE_KEY = "hindiReplacerEnabled";
  const MODE_KEY    = "hindiReplacerMode";
  const SITE_SETTINGS_KEY = "hindiReplacerSiteSettings";
  const PRESET_EXCLUSION_LIST_FILE = "preset-exclusion-list.txt";
  const toggle      = document.getElementById("toggle");
  const wordCount   = document.getElementById("word-count");
  const modeRadios  = document.querySelectorAll('input[name="mode"]');
  const scopeRadios = document.querySelectorAll('input[name="site-scope"]');
  const allExceptInput = document.getElementById("all-except-list");
  const noneExceptInput = document.getElementById("none-except-list");
  const currentSiteLabel = document.getElementById("current-site");
  const currentSiteToggle = document.getElementById("current-site-toggle");

  const api = typeof browser !== "undefined" ? browser : chrome;
  const usesPromiseApi = typeof browser !== "undefined" && api === browser;
  let activeHostname = "";
  let siteSettings = getDefaultSiteSettings();

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

  function getDefaultSiteSettings() {
    return {
      scope: "all",
      allExcept: [],
      noneExcept: []
    };
  }

  function normalizeHost(host) {
    return String(host || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .replace(/^\.+|\.+$/g, "");
  }

  function normalizeSiteSettings(rawSettings) {
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

  function parseHostList(value) {
    return Array.from(new Set(
      String(value || "")
        .split(/[\s,]+/)
        .map(normalizeHost)
        .filter(Boolean)
    ));
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

  function formatHostList(entries) {
    return entries.join("\n");
  }

  function hostMatchesList(host, entries) {
    const normalizedHost = normalizeHost(host);
    return entries.some((entry) =>
      normalizedHost === entry || normalizedHost.endsWith(`.${entry}`)
    );
  }

  function findMatchingEntry(host, entries) {
    const normalizedHost = normalizeHost(host);
    return entries.find((entry) =>
      normalizedHost === entry || normalizedHost.endsWith(`.${entry}`)
    );
  }

  function isSiteEnabled(hostname, settings) {
    if (!hostname) return false;
    if (settings.scope === "none") {
      return hostMatchesList(hostname, settings.noneExcept);
    }
    return !hostMatchesList(hostname, settings.allExcept);
  }

  async function getActiveTabHostname() {
    try {
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs && tabs[0];
      if (!currentTab || !currentTab.url) return "";
      const url = new URL(currentTab.url);
      return normalizeHost(url.hostname);
    } catch (error) {
      return "";
    }
  }

  async function reloadActiveTab() {
    try {
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs && tabs[0];
      if (currentTab && typeof currentTab.id === "number") {
        await api.tabs.reload(currentTab.id);
      }
    } catch (error) {
      // Ignore restricted pages and reload failures.
    }
  }

  function getStorage(keys) {
    if (usesPromiseApi) {
      return api.storage.local.get(keys);
    }

    return new Promise((resolve) => {
      api.storage.local.get(keys, resolve);
    });
  }

  function setStorage(value) {
    if (usesPromiseApi) {
      return api.storage.local.set(value);
    }

    return new Promise((resolve) => {
      api.storage.local.set(value, resolve);
    });
  }

  function syncScopeInputs(settings) {
    scopeRadios.forEach((radio) => {
      radio.checked = radio.value === settings.scope;
    });

    if (allExceptInput) {
      allExceptInput.value = formatHostList(settings.allExcept);
      allExceptInput.disabled = settings.scope !== "all";
    }
    if (noneExceptInput) {
      noneExceptInput.value = formatHostList(settings.noneExcept);
      noneExceptInput.disabled = settings.scope !== "none";
    }
  }

  function syncCurrentSiteUI() {
    if (currentSiteLabel) {
      currentSiteLabel.textContent = activeHostname || "Unavailable on this page";
    }

    if (!currentSiteToggle) return;

    if (!activeHostname) {
      currentSiteToggle.disabled = true;
      currentSiteToggle.textContent = "Current site unavailable";
      return;
    }

    const enabled = isSiteEnabled(activeHostname, siteSettings);
    currentSiteToggle.disabled = false;

    if (siteSettings.scope === "all") {
      currentSiteToggle.textContent = enabled
        ? "Exclude this site"
        : "Include this site";
      return;
    }

    currentSiteToggle.textContent = enabled
      ? "Remove this site"
      : "Include this site";
  }

  async function persistSiteSettings(nextSettings, shouldReload = true) {
    siteSettings = normalizeSiteSettings(nextSettings);
    syncScopeInputs(siteSettings);
    syncCurrentSiteUI();
    await setStorage({ [SITE_SETTINGS_KEY]: siteSettings });
    if (shouldReload) {
      await reloadActiveTab();
    }
  }

  async function fetchExtensionText(path) {
    const response = await fetch(api.runtime.getURL(path));
    if (!response.ok) {
      throw new Error(`Unable to load ${path}`);
    }
    return response.text();
  }

  async function fetchPresetExclusionList() {
    const text = await fetchExtensionText(PRESET_EXCLUSION_LIST_FILE);
    return parsePresetHostList(text);
  }

  async function mergePresetExclusionList(settings) {
    try {
      const hosts = await fetchPresetExclusionList();
      if (!hosts.length) return normalizeSiteSettings(settings);

      const nextSet = new Set(settings.allExcept);
      hosts.forEach((host) => nextSet.add(host));
      const nextSettings = normalizeSiteSettings({
        ...settings,
        allExcept: Array.from(nextSet)
      });

      if (nextSettings.allExcept.length !== settings.allExcept.length) {
        await setStorage({ [SITE_SETTINGS_KEY]: nextSettings });
      }

      return nextSettings;
    } catch (error) {
      return normalizeSiteSettings(settings);
    }
  }

  // Load current state
  getStorage([STORAGE_KEY, MODE_KEY, SITE_SETTINGS_KEY]).then(async (result) => {
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

    siteSettings = await mergePresetExclusionList(
      normalizeSiteSettings(result[SITE_SETTINGS_KEY])
    );
    syncScopeInputs(siteSettings);
    activeHostname = await getActiveTabHostname();
    syncCurrentSiteUI();
  });

  // Save on change
  toggle?.addEventListener("change", () => {
    setStorage({ [STORAGE_KEY]: toggle.checked });
  });

  modeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        setStorage({ [MODE_KEY]: radio.value });
        updateWordCount(radio.value);
      }
    });
  });

  scopeRadios.forEach((radio) => {
    radio.addEventListener("change", async () => {
      if (!radio.checked) return;
      await persistSiteSettings({
        ...siteSettings,
        scope: radio.value
      });
    });
  });

  allExceptInput?.addEventListener("change", async () => {
    await persistSiteSettings({
      ...siteSettings,
      allExcept: parseHostList(allExceptInput.value)
    });
  });

  noneExceptInput?.addEventListener("change", async () => {
    await persistSiteSettings({
      ...siteSettings,
      noneExcept: parseHostList(noneExceptInput.value)
    });
  });

  currentSiteToggle?.addEventListener("click", async () => {
    if (!activeHostname) return;

    if (siteSettings.scope === "all") {
      const nextSet = new Set(siteSettings.allExcept);
      const matchingEntry = findMatchingEntry(activeHostname, siteSettings.allExcept);
      if (matchingEntry) {
        nextSet.delete(matchingEntry);
      } else {
        nextSet.add(activeHostname);
      }

      await persistSiteSettings({
        ...siteSettings,
        allExcept: Array.from(nextSet)
      });
      return;
    }

    const nextSet = new Set(siteSettings.noneExcept);
    const matchingEntry = findMatchingEntry(activeHostname, siteSettings.noneExcept);
    if (matchingEntry) {
      nextSet.delete(matchingEntry);
    } else {
      nextSet.add(activeHostname);
    }

    await persistSiteSettings({
      ...siteSettings,
      noneExcept: Array.from(nextSet)
    });
  });

})();
