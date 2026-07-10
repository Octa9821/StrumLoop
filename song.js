(function () {
  "use strict";
  const Core = window.StrumLoopSongCore;
  if (!Core) return;

  const DRAFT_KEY = "strumloop:song-draft:v1";
  const LIBRARY_KEY = "strumloop:saved-songs:v1";
  const MODE_KEY = "strumloop:app-mode";
  const MAX_SHARE_LENGTH = 8000;
  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD = 0.12;
  const LEAD_SECONDS = 0.04;
  const $ = id => document.getElementById(id);
  const elements = {
    trainerMode: $("trainerMode"), songMode: $("songMode"), trainerModeBtn: $("trainerModeBtn"), songModeBtn: $("songModeBtn"),
    title: $("songTitle"), eighth: $("songEighthBtn"), sixteenth: $("songSixteenthBtn"), bpm: $("songBpm"),
    countIn: $("songCountIn"), practiceRamp: $("songPracticeRamp"), rampStep: $("songRampStep"), rampBars: $("songRampBars"),
    metronome: $("songMetronome"), metroDown: $("songMetroDown"), metroUp: $("songMetroUp"), strum: $("songStrum"),
    strumDown: $("songStrumDown"), strumUp: $("songStrumUp"), metroVolume: $("songMetroVolume"),
    strumVolume: $("songStrumVolume"), loopSong: $("loopSongToggle"), play: $("playSongBtn"), stop: $("stopSongBtn"),
    add: $("addSectionBtn"), status: $("songStatus"), sections: $("songSections"), savedForm: $("savedSongForm"),
    savedName: $("savedSongName"), savedStatus: $("savedSongStatus"), savedList: $("savedSongList"),
    copy: $("copySongLinkBtn"), export: $("exportSongBtn"), import: $("importSongBtn"), importFile: $("importSongFile"),
    shareStatus: $("songShareStatus"),
  };

  let loadMessage = "";
  let song = loadInitialSong();
  let savedSongs = loadSavedSongs();
  let collapsedSections = new Set();
  let sectionTints = new Map();
  let nextSectionTint = 0;
  let statusTimer = null;
  const transport = {
    timerId: null, audioContext: null, nextNoteTime: 0, cursor: Core.initialCursor(0), mode: "song",
    sectionIndex: 0, countInRemaining: 0, completedBars: 0, startBpm: null, current: null, uiTimeouts: [], finishTimeout: null,
    lastFocusedSectionIndex: null, lastAnticipatedSectionIndex: null, autoScrollPausedUntil: 0,
  };

  attachListeners();
  applySongToControls();
  renderSections();
  renderSavedSongs();
  const initialMode = window.StrumLoopPendingSongParam || localStorage.getItem(MODE_KEY) === "song" ? "song" : "trainer";
  setAppMode(initialMode);
  if (loadMessage) setShareStatus(loadMessage);

  function loadInitialSong() {
    if (window.StrumLoopPendingSongParam) {
      try { return Core.deserializeSong(window.StrumLoopPendingSongParam); }
      catch (error) { loadMessage = error.message; }
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? Core.createSong(JSON.parse(raw)) : Core.createSong();
    } catch (error) { return Core.createSong(); }
  }

  function loadSavedSongs() {
    try {
      const value = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
      if (!Array.isArray(value)) return [];
      return value.map(item => ({ id: cleanId(item.id), name: String(item.name || "").trim().slice(0, 80), song: Core.createSong(item.song) }))
        .filter(item => item.id && item.name).slice(0, 50);
    } catch (error) { return []; }
  }

  function cleanId(value) { return typeof value === "string" && /^[a-zA-Z0-9-]+$/.test(value) ? value : makeId(); }
  function makeId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function persistSong() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(song)); }
    catch (error) { setShareStatus("This song could not be saved in browser storage."); }
  }
  function persistLibrary() {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(savedSongs)); return true; }
    catch (error) { setSavedStatus("Could not save more songs in this browser."); return false; }
  }

  function setAppMode(mode) {
    const isSong = mode === "song";
    if (isSong && typeof window.stopMetronome === "function") window.stopMetronome();
    stopPlayback();
    elements.trainerMode.hidden = isSong;
    elements.songMode.hidden = !isSong;
    elements.trainerModeBtn.setAttribute("aria-pressed", isSong ? "false" : "true");
    elements.songModeBtn.setAttribute("aria-pressed", isSong ? "true" : "false");
    localStorage.setItem(MODE_KEY, isSong ? "song" : "trainer");
  }

  function applySongToControls() {
    elements.title.value = song.title;
    elements.eighth.setAttribute("aria-pressed", song.subdivisionMode === Core.MODES.eighth ? "true" : "false");
    elements.sixteenth.setAttribute("aria-pressed", song.subdivisionMode === Core.MODES.sixteenth ? "true" : "false");
    elements.bpm.value = song.bpm; elements.countIn.checked = song.countInEnabled; elements.practiceRamp.checked = song.practiceRampEnabled;
    elements.rampStep.value = song.practiceRampStepBpm; elements.rampBars.value = song.practiceRampEveryBars;
    elements.metronome.checked = song.metronomeEnabled; elements.metroDown.checked = song.metronomeDownEnabled; elements.metroUp.checked = song.metronomeUpEnabled;
    elements.strum.checked = song.strumEnabled; elements.strumDown.checked = song.strumDownEnabled; elements.strumUp.checked = song.strumUpEnabled;
    elements.metroVolume.value = song.metronomeVolume; elements.strumVolume.value = song.strumVolume;
    elements.loopSong.checked = song.loopSong;
    window.StrumLoopControls?.sync();
  }

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function subdivisions() {
    if (song.subdivisionMode === Core.MODES.sixteenth) {
      return ["1","e","+","a","2","e","+","a","3","e","+","a","4","e","+","a"].map((count, index) => ({ count, direction: index % 2 ? "U" : "D" }));
    }
    return ["1","+","2","+","3","+","4","+"].map((count, index) => ({ count, direction: index % 2 ? "U" : "D" }));
  }

  function getSectionTint(section) {
    if (!sectionTints.has(section.id)) {
      sectionTints.set(section.id, nextSectionTint % 6);
      nextSectionTint += 1;
    }
    return sectionTints.get(section.id);
  }

  function renderSections() {
    elements.sections.innerHTML = song.sections.map((section, sectionIndex) => {
      const isCollapsed = collapsedSections.has(section.id);
      const playing = transport.current && transport.current.sectionIndex === sectionIndex;
      return `<article class="panel song-section-card section-tint-${getSectionTint(section)}${playing ? " is-playing" : ""}" data-section-card="${section.id}">
        <div class="song-section-header">
          <label class="field song-section-name"><span class="sr-only">Section name</span><input data-section-name="${section.id}" maxlength="40" value="${escapeHtml(section.name)}" aria-label="Section name" /></label>
          <div class="field field-compact song-bar-setting">
            <span>Bars</span>
            <div class="bar-count-toggle" role="group" aria-label="Bars in ${escapeHtml(section.name)}">
              <button class="bar-count-button" type="button" data-action="bars" data-id="${section.id}" data-value="1" aria-pressed="${section.barCount === 1}">1 Bar</button>
              <button class="bar-count-button" type="button" data-action="bars" data-id="${section.id}" data-value="2" aria-pressed="${section.barCount === 2}">2 Bars</button>
            </div>
          </div>
          <label class="field field-compact song-repeat-setting"><span>Repeats</span><input data-section-repeat="${section.id}" type="number" min="1" max="16" value="${section.repeatCount}" /></label>
          <div class="song-section-actions">
            <button type="button" data-action="loop" data-id="${section.id}">Loop Section</button>
            <button type="button" data-action="up" data-id="${section.id}"${sectionIndex === 0 ? " disabled" : ""} aria-label="Move ${escapeHtml(section.name)} up">↑</button>
            <button type="button" data-action="down" data-id="${section.id}"${sectionIndex === song.sections.length - 1 ? " disabled" : ""} aria-label="Move ${escapeHtml(section.name)} down">↓</button>
            <button type="button" data-action="duplicate" data-id="${section.id}">Duplicate</button>
            <button type="button" data-action="delete" data-id="${section.id}"${song.sections.length === 1 ? " disabled" : ""}>Delete</button>
            <button type="button" data-action="collapse" data-id="${section.id}" aria-expanded="${!isCollapsed}">${isCollapsed ? "Expand" : "Collapse"}</button>
          </div>
        </div>
        <div class="song-bars"${isCollapsed ? " hidden" : ""}>${section.bars.map((bar, barIndex) => renderSongBar(section, sectionIndex, bar, barIndex)).join("")}</div>
      </article>`;
    }).join("");
  }

  function renderSongBar(section, sectionIndex, bar, barIndex) {
    const labels = subdivisions();
    return `<section class="song-bar"><h3>Bar ${barIndex + 1}</h3><div class="song-grid" data-mode="${song.subdivisionMode}">
      ${labels.map(({ count, direction }, slotIndex) => {
        const current = transport.current && transport.current.sectionIndex === sectionIndex && transport.current.barIndex === barIndex && transport.current.stepIndex === slotIndex;
        return `<div class="song-slot${current ? " current-step" : ""}">
          <button class="slot${bar.pattern[slotIndex] ? " active" : ""}" type="button" data-action="slot" data-id="${section.id}" data-bar="${barIndex}" data-slot="${slotIndex}" aria-pressed="${bar.pattern[slotIndex]}" aria-label="${escapeHtml(section.name)}, bar ${barIndex + 1}, ${count} ${direction}"><span class="slot-number">${count}</span><span class="slot-direction">${direction}</span></button>
          <input class="chord-input" data-chord="${section.id}" data-bar="${barIndex}" data-slot="${slotIndex}" maxlength="12" value="${escapeHtml(bar.chords[slotIndex] || "")}" placeholder="Chord" aria-label="Chord at ${count} ${direction}" />
        </div>`;
      }).join("")}</div></section>`;
  }

  function sectionById(id) { return song.sections.find(section => section.id === id); }
  function sectionIndexById(id) { return song.sections.findIndex(section => section.id === id); }
  function commitAndRender() { persistSong(); renderSections(); }
  function structuralChange(update) { stopPlayback(); update(); commitAndRender(); }

  function captureSectionPositions() {
    return new Map(Array.from(elements.sections.querySelectorAll("[data-section-card]")).map(card => [card.dataset.sectionCard, card.getBoundingClientRect()]));
  }

  function animateSectionReorder(previousPositions, movedId) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    window.requestAnimationFrame(() => {
      elements.sections.querySelectorAll("[data-section-card]").forEach(card => {
        const previous = previousPositions.get(card.dataset.sectionCard);
        if (!previous) return;
        const current = card.getBoundingClientRect();
        const deltaY = previous.top - current.top;
        if (Math.abs(deltaY) < 1) return;
        card.animate([{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }], {
          duration: 340,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
      });
      elements.sections.querySelector(`[data-section-card="${CSS.escape(movedId)}"]`)?.animate(
        [{ boxShadow: "0 0 0 0 rgba(96, 165, 250, 0)" }, { boxShadow: "0 0 0 4px rgba(96, 165, 250, 0.2)" }, { boxShadow: "0 0 0 0 rgba(96, 165, 250, 0)" }],
        { duration: 520, easing: "ease-out" }
      );
    });
  }

  function addSection() {
    structuralChange(() => song.sections.push(Core.createSection(song.subdivisionMode, { name: `Section ${song.sections.length + 1}` }, song.sections.length)));
  }
  function duplicateSection(id) {
    structuralChange(() => {
      const index = sectionIndexById(id); if (index < 0) return;
      const copy = Core.createSection(song.subdivisionMode, JSON.parse(JSON.stringify(song.sections[index])), index + 1);
      copy.id = makeId(); copy.name = `${copy.name} Copy`.slice(0, 40); song.sections.splice(index + 1, 0, copy);
    });
  }
  function moveSection(id, offset) {
    const index = sectionIndexById(id); const target = index + offset;
    if (index < 0 || target < 0 || target >= song.sections.length) return;
    const previousPositions = captureSectionPositions();
    stopPlayback();
    const [item] = song.sections.splice(index, 1); song.sections.splice(target, 0, item);
    persistSong(); renderSections(); animateSectionReorder(previousPositions, id);
  }
  function deleteSection(id) {
    if (song.sections.length === 1) return;
    structuralChange(() => { song.sections = song.sections.filter(section => section.id !== id); collapsedSections.delete(id); sectionTints.delete(id); });
  }
  function setBarCount(id, value) {
    structuralChange(() => { const section = sectionById(id); if (!section) return; const count = Number(value) === 2 ? 2 : 1;
      while (section.bars.length < count) section.bars.push(Core.createSection(song.subdivisionMode, {}, 0).bars[0]);
      section.bars = section.bars.slice(0, count); section.barCount = count; });
  }
  function setSongMode(mode) {
    if (mode === song.subdivisionMode) return;
    if (mode === Core.MODES.eighth && Core.hasLossySixteenthData(song) && !window.confirm("Changing to 8th notes will remove strums and chords on e/a slots. Continue?")) return;
    stopPlayback(); song = Core.convertSongMode(song, mode); applySongToControls(); commitAndRender();
  }

  function renderSavedSongs() {
    elements.savedList.innerHTML = savedSongs.length ? savedSongs.map(item => `<article class="saved-pattern-card"><div class="saved-pattern-info"><strong>${escapeHtml(item.name)}</strong><span>${item.song.sections.length} section${item.song.sections.length === 1 ? "" : "s"}</span></div><div class="saved-pattern-actions"><button class="secondary" data-saved-action="load" data-id="${item.id}" type="button">Load</button><button class="saved-pattern-delete" data-saved-action="delete" data-id="${item.id}" type="button">Delete</button></div></article>`).join("") : '<p class="saved-pattern-empty">No saved songs yet.</p>';
  }
  function setSavedStatus(message) { elements.savedStatus.textContent = message; window.setTimeout(() => { elements.savedStatus.textContent = ""; }, 2400); }
  function saveSong(name) {
    const trimmed = String(name || "").trim().slice(0, 80); if (!trimmed) return;
    const index = savedSongs.findIndex(item => item.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    const item = { id: index >= 0 ? savedSongs[index].id : makeId(), name: trimmed, song: Core.createSong(song) };
    if (index >= 0) savedSongs.splice(index, 1); savedSongs.unshift(item); savedSongs = savedSongs.slice(0, 50);
    if (persistLibrary()) { renderSavedSongs(); elements.savedName.value = ""; setSavedStatus(index >= 0 ? `Updated "${trimmed}".` : `Saved "${trimmed}".`); }
  }

  function buildSongUrl() { const url = new URL(window.location.href); url.search = ""; url.searchParams.set("song", Core.serializeSong(song)); return url; }
  function setShareStatus(message, temporary) {
    window.clearTimeout(statusTimer); elements.shareStatus.textContent = message;
    if (temporary) statusTimer = window.setTimeout(() => { elements.shareStatus.textContent = "Share the complete song or export a backup file."; }, 2600);
  }
  async function copySongLink() {
    const url = buildSongUrl().toString();
    if (url.length > MAX_SHARE_LENGTH) { setShareStatus("This song is too large for a reliable link. Use Export Song instead."); return; }
    try { await navigator.clipboard.writeText(url); setShareStatus("Song link copied.", true); }
    catch (error) { setShareStatus("Copy failed. Export the song or copy the link from the address bar."); }
  }
  function exportSong() {
    const data = JSON.stringify(Core.compactSong(song), null, 2); const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `${(song.title || "strumloop-song").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "strumloop-song"}.strumloop.json`;
    link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 0); setShareStatus("Song exported.", true);
  }
  async function importSong(file) {
    if (!file) return;
    try {
      const imported = Core.expandSong(JSON.parse(await file.text()));
      const hasDraft = song.title || song.sections.length > 1 || song.sections.some(section => section.bars.some(bar => Object.keys(bar.chords).length));
      if (hasDraft && !window.confirm("Replace the current song with the imported song?")) return;
      stopPlayback(); song = imported; collapsedSections.clear(); sectionTints = new Map(); nextSectionTint = 0; applySongToControls(); commitAndRender(); setShareStatus("Song imported.", true);
    } catch (error) { setShareStatus(error.message || "Could not import this song file."); }
    finally { elements.importFile.value = ""; }
  }

  function ensureAudio() {
    if (!transport.audioContext) transport.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (transport.audioContext.state === "suspended") transport.audioContext.resume();
  }
  function tone(frequency, volume, when, duration, type) {
    if (volume <= 0) return; ensureAudio(); const oscillator = transport.audioContext.createOscillator(); const gain = transport.audioContext.createGain();
    oscillator.type = type || "sine"; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), when + 0.003); gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain); gain.connect(transport.audioContext.destination); oscillator.start(when); oscillator.stop(when + duration + 0.01);
  }
  function click(stepIndex, when, force) {
    if (!song.metronomeEnabled && !force) return; const down = stepIndex % 2 === 0;
    if (!force && ((down && !song.metronomeDownEnabled) || (!down && !song.metronomeUpEnabled))) return;
    tone(down ? 1180 : 1620, song.metronomeVolume / 100 * (down ? 0.24 : 0.16), when, 0.045, "sine");
  }
  function strum(stepIndex, when, cursor) {
    const bar = song.sections[cursor.sectionIndex].bars[cursor.barIndex]; if (!song.strumEnabled || !bar.pattern[stepIndex]) return;
    const down = stepIndex % 2 === 0; const frequencies = down ? [196,247,294] : [294,370,440];
    if ((down && !song.strumDownEnabled) || (!down && !song.strumUpEnabled)) return;
    frequencies.forEach((frequency, index) => tone(frequency, song.strumVolume / 100 * (0.11 - index * 0.02), when + index * 0.01, 0.12, index === 1 ? "triangle" : "sine"));
  }
  function stepSeconds() { return song.subdivisionMode === Core.MODES.sixteenth ? 15 / song.bpm : 30 / song.bpm; }

  function ensureSectionExpanded(sectionIndex) {
    const section = song.sections[sectionIndex];
    const card = section && elements.sections.querySelector(`[data-section-card="${CSS.escape(section.id)}"]`);
    if (!card) return null;
    const bars = card.querySelector(".song-bars");
    if (bars?.hidden) {
      bars.hidden = false;
      collapsedSections.delete(section.id);
      const collapseButton = card.querySelector('[data-action="collapse"]');
      if (collapseButton) { collapseButton.textContent = "Collapse"; collapseButton.setAttribute("aria-expanded", "true"); }
    }
    return card;
  }

  function scrollSectionIntoFocus(sectionIndex, anticipating) {
    if (Date.now() < transport.autoScrollPausedUntil) return;
    const card = ensureSectionExpanded(sectionIndex);
    if (!card) return;
    const top = Math.max(0, window.scrollY + card.getBoundingClientRect().top - 16);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    window.scrollTo({ top, behavior });
    if (anticipating) transport.lastAnticipatedSectionIndex = sectionIndex;
    else transport.lastFocusedSectionIndex = sectionIndex;
  }

  function updatePlaybackUi(cursor) {
    const previousSectionIndex = transport.current?.sectionIndex;
    transport.current = cursor;
    const section = song.sections[cursor.sectionIndex];
    elements.status.textContent = `${section.name} · Bar ${cursor.barIndex + 1} · Repeat ${cursor.repetition}`;
    elements.sections.querySelectorAll(".song-section-card.is-playing").forEach(card => card.classList.remove("is-playing"));
    elements.sections.querySelectorAll(".song-slot.current-step").forEach(slot => slot.classList.remove("current-step"));
    const card = elements.sections.querySelector(`[data-section-card="${CSS.escape(section.id)}"]`);
    card?.classList.add("is-playing");
    card?.querySelector(`[data-action="slot"][data-bar="${cursor.barIndex}"][data-slot="${cursor.stepIndex}"]`)?.closest(".song-slot")?.classList.add("current-step");

    if (previousSectionIndex !== cursor.sectionIndex) {
      ensureSectionExpanded(cursor.sectionIndex);
      if (transport.lastAnticipatedSectionIndex === cursor.sectionIndex) transport.lastFocusedSectionIndex = cursor.sectionIndex;
      else scrollSectionIntoFocus(cursor.sectionIndex, false);
    }

    if (transport.mode !== "song") return;
    const stepsPerBeat = song.subdivisionMode === Core.MODES.sixteenth ? 4 : 2;
    const anticipationStep = Core.slotCount(song.subdivisionMode) - stepsPerBeat;
    if (cursor.repetition === section.repeatCount && cursor.barIndex === section.barCount - 1 && cursor.stepIndex === anticipationStep) {
      const nextIndex = cursor.sectionIndex + 1 < song.sections.length ? cursor.sectionIndex + 1 : song.loopSong ? 0 : null;
      if (nextIndex !== null && transport.lastAnticipatedSectionIndex !== nextIndex) scrollSectionIntoFocus(nextIndex, true);
    }
  }

  function queueUi(when, cursor) {
    const timeout = window.setTimeout(() => { transport.uiTimeouts = transport.uiTimeouts.filter(id => id !== timeout); updatePlaybackUi(cursor); }, Math.max(0, (when - transport.audioContext.currentTime) * 1000));
    transport.uiTimeouts.push(timeout);
  }
  function schedule() {
    if (!transport.timerId || !transport.audioContext) return;
    const until = transport.audioContext.currentTime + SCHEDULE_AHEAD;
    while (transport.nextNoteTime < until && transport.timerId) {
      if (transport.countInRemaining > 0) {
        const beat = 5 - transport.countInRemaining; click((beat - 1) * (song.subdivisionMode === Core.MODES.sixteenth ? 4 : 2), transport.nextNoteTime, true);
        transport.countInRemaining -= 1; transport.nextNoteTime += 60 / song.bpm; continue;
      }
      const current = { ...transport.cursor }; click(current.stepIndex, transport.nextNoteTime, false); strum(current.stepIndex, transport.nextNoteTime, current); queueUi(transport.nextNoteTime, current);
      const result = Core.advanceCursor(song, transport.cursor, { sectionOnly: transport.mode === "section" });
      if (result.completedBar) {
        transport.completedBars += 1;
        if (song.practiceRampEnabled && transport.completedBars % song.practiceRampEveryBars === 0 && song.bpm < 220) {
          song.bpm = Math.min(220, song.bpm + song.practiceRampStepBpm); elements.bpm.value = song.bpm; persistSong(); window.StrumLoopControls?.sync();
        }
      }
      transport.cursor = result.cursor; transport.nextNoteTime += stepSeconds();
      if (result.completedSong && transport.mode === "song" && !song.loopSong) {
        window.clearInterval(transport.timerId); transport.timerId = null;
        transport.finishTimeout = window.setTimeout(() => stopPlayback("Complete"), Math.max(0, (transport.nextNoteTime - transport.audioContext.currentTime) * 1000));
        break;
      }
    }
  }
  function startPlayback(mode, sectionIndex) {
    stopPlayback(); ensureAudio(); transport.mode = mode; transport.sectionIndex = sectionIndex || 0;
    transport.cursor = Core.initialCursor(transport.sectionIndex); transport.nextNoteTime = transport.audioContext.currentTime + LEAD_SECONDS;
    transport.countInRemaining = song.countInEnabled ? 4 : 0; transport.completedBars = 0; transport.startBpm = song.bpm; transport.current = null;
    transport.lastFocusedSectionIndex = null; transport.lastAnticipatedSectionIndex = null; transport.autoScrollPausedUntil = 0;
    elements.play.disabled = true; elements.stop.disabled = false;
    elements.status.textContent = song.countInEnabled ? "Count-in" : "Starting…"; transport.timerId = window.setInterval(schedule, LOOKAHEAD_MS); schedule();
  }
  function stopPlayback(message) {
    if (transport.timerId) window.clearInterval(transport.timerId); transport.timerId = null;
    if (transport.finishTimeout) window.clearTimeout(transport.finishTimeout); transport.finishTimeout = null;
    transport.uiTimeouts.forEach(id => window.clearTimeout(id)); transport.uiTimeouts = []; transport.current = null;
    if (song && song.practiceRampEnabled && Number.isFinite(transport.startBpm)) { song.bpm = transport.startBpm; elements.bpm.value = song.bpm; persistSong(); }
    transport.startBpm = null; transport.completedBars = 0;
    transport.lastFocusedSectionIndex = null; transport.lastAnticipatedSectionIndex = null;
    if (elements.play) { elements.play.disabled = false; elements.stop.disabled = true; elements.status.textContent = message || "Ready"; }
    if (elements.sections) renderSections();
  }

  function attachListeners() {
    elements.trainerModeBtn.addEventListener("click", () => setAppMode("trainer")); elements.songModeBtn.addEventListener("click", () => setAppMode("song"));
    elements.add.addEventListener("click", addSection); elements.play.addEventListener("click", () => startPlayback("song", 0)); elements.stop.addEventListener("click", () => stopPlayback());
    elements.title.addEventListener("input", event => { song.title = event.target.value.trim().slice(0, 80); persistSong(); });
    elements.eighth.addEventListener("click", () => setSongMode(Core.MODES.eighth)); elements.sixteenth.addEventListener("click", () => setSongMode(Core.MODES.sixteenth));
    [[elements.bpm,"bpm",40,220],[elements.rampStep,"practiceRampStepBpm",1,20],[elements.rampBars,"practiceRampEveryBars",1,16],[elements.metroVolume,"metronomeVolume",0,100],[elements.strumVolume,"strumVolume",0,100]].forEach(([control,key,min,max]) => control.addEventListener("input", event => { song[key] = Math.min(max, Math.max(min, Number(event.target.value) || (key === "bpm" ? 90 : min))); persistSong(); }));
    [[elements.countIn,"countInEnabled"],[elements.practiceRamp,"practiceRampEnabled"],[elements.metronome,"metronomeEnabled"],[elements.metroDown,"metronomeDownEnabled"],[elements.metroUp,"metronomeUpEnabled"],[elements.strum,"strumEnabled"],[elements.strumDown,"strumDownEnabled"],[elements.strumUp,"strumUpEnabled"],[elements.loopSong,"loopSong"]].forEach(([control,key]) => control.addEventListener("change", event => { song[key] = event.target.checked; persistSong(); }));
    elements.sections.addEventListener("click", event => {
      const button = event.target.closest("[data-action]"); if (!button) return; const id = button.dataset.id; const action = button.dataset.action;
      if (action === "slot") { const section = sectionById(id); const bar = section && section.bars[Number(button.dataset.bar)]; if (!bar) return; bar.pattern[Number(button.dataset.slot)] = !bar.pattern[Number(button.dataset.slot)]; commitAndRender(); }
      if (action === "loop") startPlayback("section", sectionIndexById(id)); if (action === "up") moveSection(id, -1); if (action === "down") moveSection(id, 1);
      if (action === "bars") setBarCount(id, button.dataset.value);
      if (action === "duplicate") duplicateSection(id); if (action === "delete") deleteSection(id);
      if (action === "collapse") { collapsedSections.has(id) ? collapsedSections.delete(id) : collapsedSections.add(id); renderSections(); }
    });
    elements.sections.addEventListener("input", event => {
      const section = sectionById(event.target.dataset.sectionName || event.target.dataset.chord || event.target.dataset.sectionRepeat); if (!section) return;
      if (event.target.dataset.sectionName) section.name = event.target.value.trim().slice(0, 40) || "Untitled Section";
      if (event.target.dataset.sectionRepeat) section.repeatCount = Math.min(16, Math.max(1, Number(event.target.value) || 1));
      if (event.target.dataset.chord) { const bar = section.bars[Number(event.target.dataset.bar)]; const slot = Number(event.target.dataset.slot); const value = event.target.value.trim().slice(0, 12); if (value) bar.chords[slot] = value; else delete bar.chords[slot]; }
      persistSong();
    });
    elements.savedForm.addEventListener("submit", event => { event.preventDefault(); saveSong(elements.savedName.value); });
    elements.savedList.addEventListener("click", event => { const button = event.target.closest("[data-saved-action]"); if (!button) return; const index = savedSongs.findIndex(item => item.id === button.dataset.id); if (index < 0) return;
      if (button.dataset.savedAction === "load") { stopPlayback(); song = Core.createSong(savedSongs[index].song); collapsedSections.clear(); sectionTints = new Map(); nextSectionTint = 0; applySongToControls(); commitAndRender(); setSavedStatus(`Loaded "${savedSongs[index].name}".`); }
      else { const [removed] = savedSongs.splice(index, 1); persistLibrary(); renderSavedSongs(); setSavedStatus(`Deleted "${removed.name}".`); } });
    elements.copy.addEventListener("click", copySongLink); elements.export.addEventListener("click", exportSong);
    elements.import.addEventListener("click", () => elements.importFile.click()); elements.importFile.addEventListener("change", event => importSong(event.target.files[0]));
    ["wheel", "touchstart"].forEach(eventName => window.addEventListener(eventName, () => {
      if (transport.timerId) transport.autoScrollPausedUntil = Date.now() + 4000;
    }, { passive: true }));
    window.addEventListener("keydown", event => {
      if (transport.timerId && ["PageUp", "PageDown", "Home", "End"].includes(event.key)) transport.autoScrollPausedUntil = Date.now() + 4000;
    });
  }
})();
