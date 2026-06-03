# English to Hinglish Replacer — Firefox Extension

Replaces English words on any webpage with their romanized Hindi (Hinglish) equivalents to help you learn Hindi while browsing.

---

## Faail (File) Structure

```
hindi-replacer/
├── manifest.json   # Extension metadata and permissions
├── words.js        # WORD DATABASE — categorized by difficulty
├── content.js      # Core logic — runs on every page
├── popup.html      # Browser toolbar UI (on/off toggle & mode selection)
├── popup.js        # Popup interaction logic
└── preset-exclusion-list.txt
```

---

## Difficulty Modes

You can switch between modes via the extension popup to control how much Hindi you see:

- **Easy**: Replaces basic nouns, common verbs, and simple numbers. Great for absolute beginners.
- **Normal**: Adds complex phrases, greetings, and more advanced vocabulary.
- **Hard**: (Placeholder) Designed for full-sentence replacements and advanced learning features.

---

## Adding Words

Open `words.js`. You can add words to the appropriate category (`EASY_WORDS`, `NORMAL_WORDS`, or `HARD_WORDS`). 

Entries follow a simple key-value format:
```js
"water": "paani",
```
- The **key** is the English word or phrase in lowercase.
- The **value** is the Hinglish replacement.

*Note: Multi-word phrases should be added to `NORMAL_WORDS` or `HARD_WORDS`.*

---

## Adding Preset Exclusions

Preset exclusions live in `preset-exclusion-list.txt` and are loaded automatically as part of the normal "All sites except these" exclusions. Add one hostname per line:

```txt
example.com
wikipedia.org
```

Lines beginning with `#` are ignored.

---

## How to Load in Firefox (Temporary Install)

1. Open Firefox and go to `about:debugging`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on...**
4. Navigate to this folder and select `manifest.json`
5. Done — the extension is now active.

---

## How It Works

1. **Category Logic**: `content.js` reads your selected mode and builds a replacement map (e.g., "Normal" includes everything in "Easy" + "Normal").
2. **Smart Matching**: It builds a dynamic regex that ensures only whole words are matched. It uses advanced boundary detection to handle punctuation like commas and apostrophes (e.g., "you're" and "hello," match correctly).
3. **Safe DOM Walking**: The extension uses a `TreeWalker` to visit text nodes and skips code, inputs, and scripts to avoid breaking websites.
4. **Auto-Update**: A `MutationObserver` watches for page changes, so words are replaced even as you scroll or new content loads.

---

## Known Limitations

- Words inside SVG text, canvas, and shadow DOM are not reached.
- No per-site toggle yet — it's global via the popup.
