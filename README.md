# StrumLoop

A free browser-based practice tool for building and looping guitar strumming patterns.

## Current MVP features

- 8th-note and 16th-note strumming grids
- 1-bar and editable 2-bar phrases
- Down-strum / up-strum direction labels
- Built-in metronome with BPM slider, number input, tap tempo, and count-in
- Practice ramp with configurable BPM increase and bar interval
- Separate metronome and strum playback toggles
- Separate metronome and strum volume controls
- Up/down sound toggles for both metronome and strum playback
- Pattern tools: randomize, clear, fill, and presets
- Shareable links for exact patterns and settings
- `localStorage` persistence for the last-used pattern and settings
- Mobile-friendly responsive layout
- Separate Song Builder mode with any number of named sections
- One- or two-bar sections with repeat counts and accessible reordering
- Beat-aligned chord-change labels, including offbeat up-strums
- Per-section looping and ordered whole-song playback
- Locally saved songs, versioned share links, and JSON import/export

## Project structure

- `index.html`: app markup
- `styles.css`: layout and visual styling
- `app.js`: rendering, audio playback, interactions, and persistence
- `song-core.js`: versioned song documents, serialization, conversion, and transport logic
- `song.js`: Song Builder rendering, playback, persistence, sharing, and file transfer

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

## Tests

Install the development dependencies and Playwright browser once, then run the full suite:

```bash
npm install
npx playwright install chromium
npm test
```

`npm run test:unit` checks song data, serialization, conversion, and transport sequencing. `npm run test:smoke` exercises the Trainer and Song Builder in Chromium at desktop and mobile widths.

## Manual smoke checklist

- Confirm Trainer start/stop, keyboard shortcuts, presets, saved patterns, and an existing shared pattern link.
- Hear both metronome and strum sounds, including their down/up and volume controls.
- Confirm count-in and practice-ramp behavior, including BPM restoration after stopping.
- Build a song with one- and two-bar sections, chord labels, repeats, and reordered sections.
- Loop one section, play a song once, and loop the whole song.
- Copy and reopen a song link; export and re-import a song file.
- Check chord entry, collapsing, and controls in mobile Chrome and Safari.
