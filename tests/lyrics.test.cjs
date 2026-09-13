const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  let now = 10000;
  const frames = new Map();
  const timers = new Map();
  const commands = [];
  const warnings = [];
  let nextId = 0;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
      this.dataset = {}; this.className = ''; this.attributes = {}; this.events = {};
      this.style = { setProperty(name, value) { this[name] = value; } };
      this.textContent = ''; this.scrollTop = 0; this.value = '0';
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
        toggle: (name, enabled) => { if (enabled ?? !this.classList.contains(name)) this.classList.add(name); else this.classList.remove(name); }
      };
    }
    get isConnected() { return this === document.body || this === document.head || !!this.parentNode?.isConnected; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    insertBefore(child, before) { child.parentNode = this; const i = this.children.indexOf(before); this.children.splice(i < 0 ? 0 : i, 0, child); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
    get firstChild() { return this.children[0]; }
    set innerHTML(html) {
      this.children.forEach(child => { child.parentNode = null; }); this.children = [];
      // Only the overlay's element IDs are needed for event registration in these tests.
      for (const match of html.matchAll(/\bid="([^"]+)"/g)) { const child = new Element(); child.id = match[1]; this.appendChild(child); }
    }
    get innerHTML() { return ''; }
    getBoundingClientRect() { return { top: 0, left: 0, width: 1000, height: 700 }; }
    scrollTo({ top }) { this.scrollTop = top; }
    addEventListener(event, callback) { (this.events[event] ||= []).push(callback); }
    dispatchEvent(event) { return this.emit(event.type, event); }
    emit(type, details = {}) {
      const event = { type, target: this, stopPropagation() {}, preventDefault() {}, ...details };
      return Promise.all((this.events[type] || []).map(callback => callback(event)));
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    matches(selector) {
      if (selector === '*') return true;
      if (selector.startsWith('#')) return this.id === selector.slice(1);
      if (selector === 'video' || selector.includes(' video')) return this.tagName === 'VIDEO';
      if (selector.startsWith('.')) {
        const match = selector.match(/^\.([\w-]+)(?:\[data-index="(\d+)"\])?$/);
        return !!match && this.classList.contains(match[1]) && (!match[2] || String(this.dataset.index) === match[2]);
      }
      return false;
    }
    querySelectorAll(selector) {
      if (selector.startsWith('#cinema-lyrics-wrapper ')) return document.getElementById('cinema-lyrics-wrapper')?.querySelectorAll(selector.slice(23)) || [];
      const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      return all.filter(child => selector.split(',').some(part => child.matches(part.trim())));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector); }
  }
  const document = {
    body: new Element('body'), head: new Element('head'), documentElement: new Element('html'),
    createElement: tag => new Element(tag), createTextNode: text => { const el = new Element('text'); el.textContent = text; return el; },
    getElementById: id => document.body.querySelector('#' + id) || document.head.querySelector('#' + id),
    querySelectorAll: selector => [...document.body.querySelectorAll(selector), ...document.head.querySelectorAll(selector)],
    querySelector: selector => document.querySelectorAll(selector)[0] || null,
    addEventListener() {}, dispatchEvent() {}
  };
  const video = new Element('video');
  Object.assign(video, { currentTime: 0, duration: 180, paused: false, ended: false, playbackRate: 1,
    play() { this.paused = false; return Promise.resolve(); } });
  document.body.appendChild(video);
  const saved = { auramusic_lyrics_auto_sync: 'false', auramusic_lyrics_offset: '0' };
  const sandbox = vm.createContext({ document, navigator: { language: 'es' },
    location: { href: 'https://music.youtube.com/' }, URL, URLSearchParams,
    console: { log() {}, warn(...args) { warnings.push(args); } },
    Date: class extends Date { static now() { return now; } }, performance: { now: () => now },
    setTimeout(callback) { timers.set(++nextId, callback); return nextId; }, clearTimeout: id => timers.delete(id),
    setInterval() { return ++nextId; }, clearInterval() {},
    requestAnimationFrame(callback) { frames.set(++nextId, callback); return nextId; }, cancelAnimationFrame: id => frames.delete(id),
    addEventListener() {}, postMessage: message => commands.push(message),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    MutationObserver: class { observe() {} },
    localStorage: { getItem: key => saved[key] ?? null, setItem: (key, value) => { saved[key] = String(value); } },
    chrome: { runtime: { getURL: file => 'chrome-extension://test/' + file }, storage: { local: { set() {} } } },
    AbortController, AbortSignal, fetch: async () => ({ ok: false }), AuraMusic: { state: { theme: 'auramusic' } }
  });
  sandbox.window = sandbox;
  let source = fs.readFileSync(process.env.AURAMUSIC_LYRICS_BASELINE || path.join(__dirname, '../modules/lyrics/cinema-lyrics.js'), 'utf8');
  // Test-only access to closure state. Production exports remain unchanged.
  source = source.replace('  window.AuraMusic.Lyrics = {', `
  window.lyricsTest = {
    parseLrc, smartDistributeWords, renderCinemaLyricsDOM, startCinemaSyncLoop,
    updateCinemaTrack, seekTrack, handleTrackChangeDetected, onBridgeTrackChange,
    getYtMusicTrackDuration, translateLyrics, makeLyricsCacheKey,
    set(values) {
      if ('lyrics' in values) currentLyrics = values.lyrics;
      if ('active' in values) isCinemaActive = values.active;
      if ('translation' in values) isTranslationActive = values.translation;
      if ('changedAt' in values) cinemaTrackChangeTime = values.changedAt;
      if ('fetch' in values) fetchSyncedLyrics = values.fetch;
      if ('translate' in values) translateLyrics = values.translate;
      if ('info' in values) getCurrentTrackInfo = values.info;
    },
    snapshot: () => ({ lyrics: currentLyrics, fetching: isFetchingLyrics, dragging: isUserDraggingProgress,
      display: lastRenderedDisplayTime, seekTarget: cinemaSeekTargetTime, track: currentTrackKey })
  };
  window.AuraMusic.Lyrics = {`);
  vm.runInContext(source, sandbox);
  sandbox.lyricsTest.set({ info: () => ({ title: '', artist: '', videoId: '' }) });
  return { sandbox, api: sandbox.AuraMusic.Lyrics, internal: sandbox.lyricsTest, document, video, frames, timers, commands, warnings,
    element(id) { const element = new Element(); element.id = id; document.body.appendChild(element); return element; },
    async open() { await sandbox.AuraMusic.Lyrics.openCinemaMode(); },
    tick(ms = 40) { now += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); assert.deepEqual(warnings, []); },
    now: () => now
  };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const line = (time, text) => ({ time, text, words: [{ text, time }] });

test('LRC handles tenths, repeated tags and negative offsets without losing the first verse', () => {
  const f = fixture();
  const lyrics = f.internal.parseLrc('[offset:-500]\n[00:00.1]Inicio\n[00:03.5][00:07.5]Otra');
  assert.equal(lyrics[0].text, 'Inicio');
  assert.equal(lyrics[0].time, 0);
  assert.deepEqual(Array.from(lyrics, lyric => lyric.time), [0, 3, 7]);
});

test('enhanced LRC keeps word timestamps and never displays timestamp markup', () => {
  const f = fixture();
  const lyrics = f.internal.parseLrc('[offset:100]\n[00:01.00]<00:01.00>Hola <00:01.40>mundo<00:02.00>');
  assert.equal(lyrics[0].text, 'Hola mundo');
  assert.equal(lyrics[0].words[1].time, 1.5);
  assert.equal(lyrics[0].words[1].end, 2.1);
});

test('blank timed LRC lines end a verse and no outro is invented over the final lyric', () => {
  const f = fixture();
  const lyrics = f.internal.parseLrc('[00:00.00]Verso\n[00:05.00]\n[00:09.00]Final sostenido', 16);
  assert.ok(lyrics[1].isInstrumental);
  assert.equal(lyrics.some(item => item.isOutro), false);
  assert.equal(lyrics.at(-1).text, 'Final sostenido');
});

test('invalid LRC input is harmless', () => {
  assert.equal(fixture().internal.parseLrc(null).length, 0);
});

test('fast phrases keep every generated word inside their verse', () => {
  const words = fixture().internal.smartDistributeWords({ time: 10, text: 'a b c d e f g h i j' }, 10.5);
  assert.ok(words.every(word => word.time >= 10 && word.time < 10.5));
});

test('opening midway uses the actual playback position immediately', async () => {
  const f = fixture(); await f.open();
  f.video.currentTime = 65;
  f.internal.set({ changedAt: f.now(), lyrics: [line(0, 'A'), line(60, 'B')] });
  f.internal.renderCinemaLyricsDOM(); f.tick();
  assert.equal(f.document.getElementById('cinema-current-time').textContent, '1:05');
  assert.ok(f.document.querySelector('.cinema-lyric-line[data-index="1"]').classList.contains('active-line'));
});

test('closing and reopening cancels the old animation and repeated open is idempotent', async () => {
  const f = fixture(); await f.open();
  assert.equal(f.frames.size, 1);
  f.api.closeCinemaMode(); assert.equal(f.frames.size, 0);
  await f.open(); await f.open();
  assert.equal(f.frames.size, 1);
  f.tick(); assert.equal(f.frames.size, 1);
});

test('going back exactly one verse clears sung status from the future verse', async () => {
  const f = fixture(); await f.open();
  f.internal.set({ lyrics: [line(0, 'A'), line(10, 'B'), line(20, 'C')] });
  f.internal.renderCinemaLyricsDOM(); f.video.currentTime = 11; f.tick();
  f.video.currentTime = 1; f.tick();
  const future = f.document.querySelector('.cinema-lyric-line[data-index="1"]');
  assert.equal(future.classList.contains('sung-line'), false);
  assert.equal(future.querySelector('.k-word').className, 'k-word');
});

test('rerendering a translation reacquires the active DOM line at the same position', async () => {
  const f = fixture(); await f.open();
  f.internal.set({ lyrics: [line(0, 'Original')] });
  f.internal.renderCinemaLyricsDOM(); f.video.currentTime = 0.5; f.tick();
  const old = f.document.querySelector('.cinema-lyric-line');
  f.internal.renderCinemaLyricsDOM(); f.tick();
  const fresh = f.document.querySelector('.cinema-lyric-line');
  assert.notEqual(fresh, old);
  assert.ok(fresh.classList.contains('active-line'));
  assert.equal(fresh.querySelector('.k-word').className, 'k-word active');
});

test('translated word counts use their own displayed timing', async () => {
  const f = fixture(); await f.open();
  f.internal.set({ translation: true, lyrics: [{ ...line(0, 'Hello'), translatedText: 'Hola a todo el mundo', originalText: 'Hello' }, line(5, 'Next')] });
  f.internal.renderCinemaLyricsDOM();
  const words = f.document.querySelector('.cinema-lyric-line').querySelectorAll('.k-word');
  f.video.currentTime = Number(words[2].dataset.start) + 0.01; f.tick();
  assert.equal(words[2].className, 'k-word active');
  assert.equal(words[0].className, 'k-word sung');
});

test('a final word becomes sung after its actual end', async () => {
  const f = fixture(); await f.open();
  f.internal.set({ lyrics: [{ time: 0, text: 'Final', words: [{ time: 0, end: 1, text: 'Final' }] }] });
  f.internal.renderCinemaLyricsDOM(); f.video.currentTime = 2; f.tick();
  assert.equal(f.document.querySelector('.k-word').className, 'k-word sung');
});

test('word click seeks to that word instead of restarting the verse', async () => {
  const f = fixture(); await f.open();
  f.internal.set({ lyrics: [{ time: 10, text: 'Hola mundo', words: [{ time: 10, text: 'Hola' }, { time: 12, text: 'mundo' }] }] });
  f.internal.renderCinemaLyricsDOM();
  const verse = f.document.querySelector('.cinema-lyric-line');
  await verse.emit('click', { target: verse.querySelectorAll('.k-word')[1] });
  assert.equal(f.commands.at(-1).time, 12);
  assert.equal(f.video.currentTime, 12);
});

test('backward seek holds its target while the old video position is still reported', async () => {
  const f = fixture(); await f.open();
  const bridge = f.element('auramusic-bridge-data');
  bridge.dataset = { ready: '1', playerState: '1', duration: '180' };
  f.video.currentTime = 90;
  f.internal.seekTrack(10); f.tick();
  assert.equal(f.internal.snapshot().display, 10);
  assert.equal(f.internal.snapshot().seekTarget, 10);
  f.video.currentTime = 10.1; f.tick();
  assert.equal(f.internal.snapshot().seekTarget, -1);
});

test('drag preview follows input and compatibility events commit only once', async () => {
  const f = fixture(); await f.open();
  const input = f.document.getElementById('cinema-progress-input');
  input.value = '500'; await input.emit('input'); f.tick();
  assert.equal(f.internal.snapshot().display, 90);
  for (const type of ['change', 'pointerup', 'mouseup', 'touchend']) await input.emit(type);
  assert.equal(f.commands.filter(command => command.action === 'seek').length, 1);
  assert.equal(f.internal.snapshot().dragging, false);
});

test('cancelled pointer releases preview mode without seeking', async () => {
  const f = fixture(); await f.open();
  const input = f.document.getElementById('cinema-progress-input');
  input.value = '500'; await input.emit('input'); await input.emit('pointercancel');
  assert.equal(f.internal.snapshot().dragging, false);
  assert.equal(f.commands.length, 0);
});

test('invalid seeks and unavailable durations cannot create NaN playback', () => {
  const f = fixture(); f.internal.seekTrack(NaN);
  assert.equal(f.commands.length, 0);
  f.video.duration = NaN;
  f.internal.set({ lyrics: [line(999, 'Old song')] });
  assert.equal(f.internal.getYtMusicTrackDuration(), 0);
});

test('pending translations from a prior track cannot overwrite the current lyrics', async () => {
  const f = fixture(); await f.open();
  const a = deferred(), b = deferred();
  f.internal.set({ translation: true, fetch: async title => [line(0, title)], translate: lyrics => lyrics[0].text === 'A' ? a.promise : b.promise });
  const first = f.internal.updateCinemaTrack('A', 'artist', '', 'a'); await flush();
  const second = f.internal.updateCinemaTrack('B', 'artist', '', 'b'); await flush();
  b.resolve([line(0, 'B translated')]); await second;
  a.resolve([line(0, 'A translated')]); await first;
  assert.equal(f.internal.snapshot().lyrics[0].text, 'B translated');
});

test('translation button discards late results after changing songs', async () => {
  const f = fixture(); await f.open();
  const pending = deferred();
  f.internal.set({ lyrics: [line(0, 'A')], translate: () => pending.promise });
  const translating = f.document.getElementById('cinema-translate-btn').emit('click');
  f.internal.set({ translation: false, fetch: async () => [line(0, 'B')] });
  await f.internal.updateCinemaTrack('B', 'artist', '', 'b');
  pending.resolve([line(0, 'A translated')]); await translating;
  assert.equal(f.internal.snapshot().lyrics[0].text, 'B');
});

test('closing cancels the ownership of in-flight lyrics', async () => {
  const f = fixture(); await f.open(); const pending = deferred();
  f.internal.set({ fetch: () => pending.promise });
  const loading = f.internal.updateCinemaTrack('A', 'artist', '', 'a');
  f.api.closeCinemaMode(); pending.resolve([line(0, 'A')]); await loading;
  assert.equal(f.internal.snapshot().lyrics.length, 0);
  assert.equal(f.internal.snapshot().fetching, false);
});

test('switching tracks clears the previous lyrics while loading', async () => {
  const f = fixture(); await f.open(); const pending = deferred();
  f.internal.set({ lyrics: [line(0, 'Old')], fetch: () => pending.promise });
  const loading = f.internal.updateCinemaTrack('New', 'artist', '', 'b');
  assert.equal(f.internal.snapshot().lyrics.length, 0);
  pending.resolve([line(0, 'New')]); await loading;
});

test('returning immediately to the previous song is not rejected as stale', async () => {
  const f = fixture(); await f.open();
  f.internal.set({ fetch: async title => [line(0, title)] });
  f.internal.handleTrackChangeDetected('A', 'artist', 'a', ''); await flush();
  f.internal.handleTrackChangeDetected('B', 'artist', 'b', ''); await flush();
  f.internal.handleTrackChangeDetected('A', 'artist', 'a', ''); await flush();
  assert.equal(f.internal.snapshot().lyrics[0].text, 'A');
});

test('bridge track events do not fetch or redraw when cinema is closed', () => {
  const f = fixture(); let requests = 0;
  f.internal.set({ fetch: async () => { requests++; return []; } });
  f.internal.onBridgeTrackChange({ detail: { title: 'A', artist: 'artist', videoId: 'a' } });
  assert.equal(requests, 0);
});

test('opening a known track does not fetch it twice on the first animation tick', async () => {
  const f = fixture(); let requests = 0;
  f.internal.set({ info: () => ({ title: 'A', artist: 'artist', videoId: 'a' }), fetch: () => { requests++; return new Promise(() => {}); } });
  await f.open(); f.tick();
  assert.equal(requests, 1);
});

test('lyric cache distinguishes recording IDs, live versions and server modes', () => {
  const f = fixture();
  const key = f.internal.makeLyricsCacheKey('Song', 'Artist', 'one');
  assert.notEqual(key, f.internal.makeLyricsCacheKey('Song', 'Artist', 'two'));
  assert.notEqual(f.internal.makeLyricsCacheKey('Song (Live)', 'Artist'), f.internal.makeLyricsCacheKey('Song', 'Artist'));
  f.sandbox.localStorage.setItem('auramusic_lyrics_server_mode', 'lrclib');
  assert.notEqual(key, f.internal.makeLyricsCacheKey('Song', 'Artist', 'one'));
});

test('translated results for different lyric content never reuse a stale translation cache', async () => {
  const f = fixture();
  f.sandbox.fetch = async url => ({ ok: true, json: async () => [[new URL(url).searchParams.get('q') === 'A' ? 'Uno' : 'Dos', 'en']] });
  const first = await f.internal.translateLyrics([line(0, 'A')]);
  const second = await f.internal.translateLyrics([line(0, 'B')]);
  assert.equal(first[0].translatedText, 'Uno');
  assert.equal(second[0].translatedText, 'Dos');
});

test('mismatched translation batches use individual lines instead of shifting verses', async () => {
  const f = fixture();
  f.sandbox.fetch = async url => {
    const text = new URL(url).searchParams.get('q');
    return { ok: true, json: async () => [[text.includes('\n') ? 'Merged translation' : text === 'A' ? 'Uno' : 'Dos', 'en']] };
  };
  const translated = await f.internal.translateLyrics([line(0, 'A'), line(5, 'B')]);
  assert.equal(translated[0].translatedText, 'Uno');
  assert.equal(translated[1].translatedText, 'Dos');
});

test('turning translation off while loading prevents the result from being committed', async () => {
  const f = fixture(); await f.open(); const pending = deferred();
  const original = [line(0, 'Original')];
  f.internal.set({ lyrics: original, translate: () => pending.promise });
  const button = f.document.getElementById('cinema-translate-btn');
  const enabling = button.emit('click'); await button.emit('click');
  pending.resolve([line(0, 'Translated')]); await enabling;
  assert.equal(f.internal.snapshot().lyrics[0].text, 'Original');
  assert.equal(button.style.opacity, '1');
});

test('real 100-second duration is not replaced by stale bridge data', () => {
  const f = fixture(); f.video.duration = 100;
  const bridge = f.element('auramusic-bridge-data');
  bridge.dataset = { ready: '1', currentTime: '0', duration: '240', updatedAt: String(f.now()) };
  assert.equal(f.internal.getYtMusicTrackDuration(), 100);
});

test('sync loop does not invent duration from the last lyric timestamp', async () => {
  const f = fixture(); await f.open(); f.video.duration = NaN;
  f.internal.set({ lyrics: [line(999, 'Final')] }); f.internal.renderCinemaLyricsDOM(); f.tick();
  assert.equal(f.document.getElementById('cinema-total-time').textContent, '0:00');
});

test('duration arriving while paused refreshes progress even if time has not changed', async () => {
  const f = fixture(); await f.open(); f.video.currentTime = 50; f.video.duration = 100; f.video.paused = true;
  f.tick(); assert.equal(f.document.getElementById('cinema-progress-fill').style.width, '50%');
  f.video.duration = 200; f.tick(600);
  assert.equal(f.document.getElementById('cinema-progress-fill').style.width, '25%');
});

test('Jesuluto cinema uses the theme module instead of an undefined global', async () => {
  const f = fixture(); let starts = 0; let stops = 0;
  f.sandbox.AuraMusic.state.theme = 'jesuluto';
  f.sandbox.AuraMusic.Themes = { initJesuluto3D() { starts++; }, destroyJesuluto3D() { stops++; } };
  await f.open();
  for (const callback of f.timers.values()) callback();
  assert.equal(starts, 1); f.api.closeCinemaMode(); assert.equal(stops, 1);
});
