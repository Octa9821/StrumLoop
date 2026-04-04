# Guitar Strumming Pattern Builder

A lightweight browser-based practice tool for building and looping guitar strumming patterns.

## Current MVP features

- Clickable `1 + 2 + 3 + 4 +` strumming grid
- Down-strum / up-strum direction labels
- Built-in metronome with BPM slider and number input
- Separate metronome and strum playback toggles
- Separate metronome and strum volume controls
- Pattern tools: randomize, clear, fill, and presets
- Keyboard shortcuts for slot toggles, playback, randomize, and clear
- `localStorage` persistence for the last-used pattern and settings

## Project structure

- `index.html`: app markup
- `styles.css`: layout and visual styling
- `app.js`: rendering, audio playback, interactions, and persistence

## Running locally

Because this is a static app, you can open `index.html` directly in a browser or serve the folder with any simple static server.

Examples:

```bash
python3 -m http.server 8000
```

or

```bash
npx serve .
```

Then open `http://localhost:8000` or the URL printed by your server.

## Next suggested steps

1. Add shareable pattern URLs.
2. Add tap tempo.
3. Add a 16th-note mode.
4. Improve audio/timing quality once the feature set settles a bit more.
