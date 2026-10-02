# StrumLoop

A free browser-based practice tool for building and looping guitar strumming patterns.

## Current MVP features

- 8th-note and 16th-note strumming grids
- 1-bar and editable 2-bar phrases
- Down-strum / up-strum direction labels
- Per-strum accents with visible `>` markers and louder strum playback
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

`npm run test:unit` checks song data, serialization, conversion, transport sequencing, and Trainer accents. `npm run test:smoke` exercises the Trainer and Song Builder in Chromium at desktop and mobile widths.

## Manual smoke checklist

- Confirm Trainer start/stop, keyboard shortcuts, presets, saved patterns, and an existing shared pattern link.
- Hear both metronome and strum sounds, including their down/up and volume controls.
- Confirm count-in and practice-ramp behavior, including BPM restoration after stopping.
- Build a song with one- and two-bar sections, chord labels, repeats, and reordered sections.
- Loop one section, play a song once, and loop the whole song.
- Copy and reopen a song link; export and re-import a song file.
- Check chord entry, collapsing, and controls in mobile Chrome and Safari.

## Adding accents

Choose **Strums** above the grid to turn strums on or off. Choose **Accents** to
toggle emphasis on active strums; rests cannot be accented. The same editing mode
applies to clicks, taps, and slot keyboard shortcuts. A `>` marks an accent in the
grid and current-pattern text. Choose **Volume** or **Clack** under **Accent sound**
in the Strum Sound controls. Volume plays accented strums at 2.5 times their normal
gain. Clack keeps the strum at normal gain and adds a quieter metallic hit. Both
variants follow the strum volume and sound toggles; metronome clicks and count-in
are unchanged. The sound choice is remembered in this browser and included in
share links. Older links and stored settings default to Volume.

Turning a strum off removes its accent. Clear, Fill All, Randomize, and presets
reset accents on the bars they replace. Accents are included in saved patterns,
last-used state, and share links; older patterns and links load without accents.
Editing mode resets to Strums on reload.

## Verification

With Node.js installed, run the dependency-free regression tests and syntax check:

```bash
node --test tests/accents.test.cjs
node --check app.js
git diff --check
```

For browser smoke testing, check both subdivisions and bars on desktop and mobile,
including keyboard focus during playback, save/load, reload, and old share links
opened over an accented local pattern. Listen to accented and normal strums at
default settings and at 220 BPM with full-volume dense patterns.
