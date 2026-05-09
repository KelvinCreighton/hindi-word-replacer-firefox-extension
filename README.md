# English to Hinglish Replacer — Firefox Extension

Replaces English words on any webpage with their romanized Hindi (Hinglish) equivalents.

---

## Faail (File) Structure

```
hindi-replacer/
├── manifest.json   # Extension metadata and permissions
├── words.js        # YOUR WORD DATABASE — edit this
├── content.js      # Runs on every page, does the actual replacement
├── popup.html      # Browser toolbar popup (on/off toggle)
└── popup.js        # Popup logic
```

---

## How to Load in Firefox (Temporary Install)

1. Open Firefox and go to `about:debugging`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on...**
4. Navigate to this folder and select `manifest.json`
5. Done — the extension is now active on all tabs

---

## Adding Words

Open `words.js`. Each entry is a simple key-value pair:

```js
"water": "paani",
```

- The **key** is the English word in lowercase.
- The **value** is the Hinglish replacement.

---

## Config Options (top of content.js)

| Constant        | Default | Effect |
|-----------------|---------|--------|
| `SHOW_TOOLTIP`  | `true`  | Hover over a replaced word to see the original English |
| `HIGHLIGHT`     | `true`  | Underlines replaced words with an orange dotted border |

---

## How It Works

1. `words.js` is loaded first — it defines `WORD_MAP`, a plain JS object.
2. `content.js` builds a single regex from all keys in `WORD_MAP` using word boundaries (`\b`), so only whole words are matched — "sun" won't match inside "Sunday".
3. The DOM walker skips `<script>`, `<style>`, `<textarea>`, `<input>`, `<code>`, `<pre>` and similar tags to avoid breaking page functionality.
4. Each matched text node is split into a document fragment: plain text nodes for unmatched parts, and `<span>` elements for replaced words.

---

## Known Limitations / Next Steps

- The extension now uses a `MutationObserver`. Dynamically injected content (infinite scroll, SPAs) is **automatically** replaced.
- Improved DOM traversal using `TreeWalker` for better performance and reliability.
- Phrases are prioritized over individual words (e.g., "good morning" is matched before "good").
- Unified support for both Firefox (`browser`) and Chrome (`chrome`) APIs.
- No per-site toggle yet — it's all-or-nothing via the popup.
- Words inside SVG text, canvas, and shadow DOM are not reached.
