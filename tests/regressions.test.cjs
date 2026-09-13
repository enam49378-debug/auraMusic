const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function run(file, sandbox) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
}
function classes() {
  const values = new Set();
  return {
    add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    contains: item => values.has(item),
    toggle(item, enabled) { if (enabled) values.add(item); else values.delete(item); }
  };
}
function stateFixture(saved) {
  const listeners = [];
  const storage = {};
  const applied = [];
  const document = {
    body: { classList: classes() },
    documentElement: { style: { setProperty() {} } }
  };
  const chrome = {
    runtime: { id: 'test-extension' },
    storage: {
      local: {
        get(_keys, cb) { cb({ auramusic_settings: saved }); },
        set(data, cb) { saved = data.auramusic_settings; cb(); }
      },
      onChanged: { addListener(cb) { listeners.push(cb); } }
    }
  };
  const sandbox = vm.createContext({ document, chrome, console,
    localStorage: { getItem: key => storage[key] || null, setItem: (key, value) => { storage[key] = value; } }
  });
  sandbox.window = sandbox;
  run('modules/core/state.js', sandbox);
  sandbox.AuraMusic.Visualizer = { applyVisualizerMode: mode => applied.push(mode) };
  return { sandbox, document, applied, storage,
    change(value, area = 'local') { listeners.forEach(cb => cb({ auramusic_settings: { newValue: value } }, area)); }
  };
}

test('editing EQ does not mutate factory defaults', () => {
  const { sandbox } = stateFixture();
  sandbox.state.eq['60Hz'] = 9;
  assert.equal(sandbox.defaultSettings.eq['60Hz'], 0);
});

test('partial stored EQ keeps the other bands and restores the visualizer', () => {
  const { sandbox, applied } = stateFixture({ eq: { '60Hz': 6 }, visualizer: 'wave' });
  sandbox.loadSettings();
  assert.equal(sandbox.state.eq['60Hz'], 6);
  assert.equal(sandbox.state.eq['250Hz'], 0);
  assert.deepEqual(applied, ['wave']);
});

test('localStorage fallback merges partial settings without sharing defaults', () => {
  const { sandbox, storage } = stateFixture();
  sandbox.chrome.runtime.id = null;
  storage.auramusic_settings = JSON.stringify({ theme: 'komi', eq: { '4kHz': -3 } });
  sandbox.loadSettings();
  assert.equal(sandbox.state.theme, 'komi');
  assert.equal(sandbox.state.eq['4kHz'], -3);
  assert.equal(sandbox.state.eq['1kHz'], 0);
  sandbox.state.eq['1kHz'] = 2;
  assert.equal(sandbox.defaultSettings.eq['1kHz'], 0);
});

test('external settings update the page, module, controls and fallback copy', () => {
  const fixture = stateFixture();
  const themes = [];
  let controls = 0;
  fixture.sandbox.AuraMusic.Themes = { applyTheme: theme => themes.push(theme) };
  fixture.sandbox.AuraMusic.Hub = { updateUIControls() { controls++; } };
  fixture.change({ theme: 'spotify', visualizer: 'off' });
  assert.equal(fixture.sandbox.state.theme, 'spotify');
  assert.deepEqual(themes, ['spotify']);
  assert.deepEqual(fixture.applied, ['off']);
  assert.ok(controls > 0);
  assert.equal(JSON.parse(fixture.storage.auramusic_settings).theme, 'spotify');
  fixture.change({ theme: 'komi' }, 'sync');
  assert.equal(fixture.sandbox.state.theme, 'spotify');
});

test('removing stored settings restores defaults', () => {
  const fixture = stateFixture();
  fixture.change({ theme: 'spotify', eq: { '60Hz': 7 } });
  assert.equal(fixture.sandbox.state.theme, 'spotify');
  fixture.change(undefined);
  assert.equal(fixture.sandbox.state.theme, 'auramusic');
  assert.equal(fixture.sandbox.state.eq['60Hz'], 0);
});

test('switching from AuraMusic removes its old body class', () => {
  const { sandbox, document } = stateFixture();
  sandbox.applyTheme('auramusic');
  sandbox.applyTheme('spotify');
  assert.equal(document.body.classList.contains('auramusic-theme-auramusic'), false);
  assert.equal(document.body.classList.contains('auramusic-theme-spotify'), true);
});

test('popup selects the default theme and propagates a choice without scripting permission', () => {
  const fixture = stateFixture();
  const buttons = ['auramusic', 'spotify'].map(theme => ({
    dataset: { theme }, classList: classes(),
    addEventListener(_event, callback) { this.click = callback; }
  }));
  const popup = vm.createContext({ console, chrome: fixture.sandbox.chrome,
    AbortSignal, fetch: async () => ({ ok: false }),
    document: {
      querySelectorAll: () => buttons, getElementById: () => null,
      addEventListener(_event, callback) { this.ready = callback; }
    }
  });
  fixture.sandbox.chrome.runtime.getManifest = () => ({ version: '1.5.3' });
  fixture.sandbox.chrome.storage.local.set = (data, callback) => {
    fixture.change(data.auramusic_settings);
    callback();
  };
  run('popup.js', popup);
  popup.document.ready();
  assert.ok(buttons[0].classList.contains('active'));
  buttons[1].click();
  assert.equal(fixture.sandbox.state.theme, 'spotify');
  assert.equal(fixture.document.body.classList.contains('auramusic-theme-spotify'), true);
});

function visualizerFixture() {
  const elements = new Map();
  const frames = new Map();
  let sequence = 0;
  let strokes = 0;
  const ctx = {
    clearRect() {}, createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { strokes++; }
  };
  const player = { insertBefore(element) { elements.set(element.id, element); } };
  const document = {
    hidden: false, documentElement: {}, addEventListener() {},
    querySelector: selector => selector === 'video' ? { paused: false } : player,
    getElementById: id => elements.get(id),
    createElement: () => ({ isConnected: true, getContext: () => ctx,
      appendChild(child) { elements.set(child.id, child); } })
  };
  const sandbox = vm.createContext({ document, console, Uint8Array,
    performance: { now: () => 1200 },
    getComputedStyle: () => ({ getPropertyValue: () => '#abc123' }),
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: id => frames.delete(id),
    addEventListener() {}, removeEventListener() {}, innerWidth: 800,
    AuraMusic: { state: { visualizer: 'wave' } }
  });
  sandbox.window = sandbox;
  run('modules/visualizer/visualizer.js', sandbox);
  return { sandbox, frames, elements, ctx, strokes: () => strokes };
}

test('wave renders with the selected color and off cancels animation', () => {
  const fixture = visualizerFixture();
  fixture.sandbox.AuraMusic.Visualizer.applyVisualizerMode('wave');
  assert.equal(fixture.strokes(), 1);
  assert.equal(fixture.ctx.strokeStyle, '#abc123');
  assert.equal(fixture.frames.size, 1);
  fixture.sandbox.AuraMusic.Visualizer.applyVisualizerMode('off');
  assert.equal(fixture.frames.size, 0);
});

test('replacing the player canvas cancels the old loop', () => {
  const fixture = visualizerFixture();
  fixture.sandbox.AuraMusic.state.visualizer = 'bars';
  fixture.sandbox.AuraMusic.Visualizer.initVisualizer();
  const firstFrame = [...fixture.frames.keys()][0];
  fixture.elements.clear();
  fixture.sandbox.AuraMusic.Visualizer.initVisualizer();
  assert.equal(fixture.frames.size, 1);
  assert.equal(fixture.frames.has(firstFrame), false);
});

function audioFixture() {
  let video = { paused: false, playbackRate: 1 };
  const contexts = [];
  const callbacks = {};
  let poll;
  function node() {
    return { connections: [], connect(target) { this.connections.push(target); },
      disconnect() { this.connections = []; },
      gain: { value: 0, setValueAtTime(value) { this.value = value; } }, frequency: { value: 0 }
    };
  }
  class AudioContext {
    constructor() {
      this.state = 'suspended'; this.currentTime = 0; this.destination = {};
      this.sources = new Map(); this.resumes = 0; contexts.push(this);
    }
    createMediaElementSource(element) {
      if (this.sources.has(element)) throw Error('Source already exists');
      const source = node(); this.sources.set(element, source); return source;
    }
    createAnalyser() { return node(); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
  }
  const sandbox = vm.createContext({ console, AudioContext,
    AuraMusic: { state: { volumeBoost: 180, playbackSpeed: 1.5, eq: { '60Hz': 4 } } },
    document: { querySelector: () => video, addEventListener(event, callback) { callbacks[event] = callback; } },
    addEventListener() {}, setInterval(callback) { poll = callback; return 1; }, clearInterval() {}
  });
  sandbox.window = sandbox;
  run('modules/audio/audio-engine.js', sandbox);
  return { sandbox, contexts, callbacks, poll: () => poll(), video: () => video, replace: value => { video = value; } };
}

test('first audio connection restores speed and resumes its context', () => {
  const fixture = audioFixture();
  fixture.sandbox.AuraMusic.Audio._tryConnectAudio();
  assert.equal(fixture.video().playbackRate, 1.5);
  assert.equal(fixture.contexts[0].resumes, 1);
  assert.equal(fixture.sandbox.AuraMusic.Audio.getGainNode().gain.value, 1.8);
});

test('replacement videos reuse EQ and context, including a previously connected video', () => {
  const fixture = audioFixture();
  const firstVideo = fixture.video();
  fixture.poll();
  const context = fixture.contexts[0];
  const analyser = fixture.sandbox.AuraMusic.Audio.getAnalyser();
  const secondVideo = { paused: false, playbackRate: 1 };
  fixture.replace(secondVideo);
  fixture.poll();
  assert.equal(fixture.contexts.length, 1);
  assert.equal(context.sources.size, 2);
  assert.equal(context.sources.get(firstVideo).connections.length, 0);
  assert.equal(context.sources.get(secondVideo).connections.length, 1);
  assert.equal(secondVideo.playbackRate, 1.5);
  assert.equal(fixture.sandbox.AuraMusic.Audio.getAnalyser(), analyser);
  fixture.replace(firstVideo);
  fixture.poll();
  assert.equal(context.sources.size, 2);
  assert.equal(context.sources.get(firstVideo).connections.length, 1);
  assert.equal(context.sources.get(secondVideo).connections.length, 0);
});

test('new metadata restores the saved speed on the current video', () => {
  const fixture = audioFixture();
  fixture.callbacks.loadedmetadata({ target: fixture.video() });
  assert.equal(fixture.video().playbackRate, 1.5);
});

test('saving unchanged settings does not restart visual effects', () => {
  const fixture = stateFixture();
  fixture.sandbox.applyAllSettings();
  const initialApplications = fixture.applied.length;
  fixture.change(JSON.parse(JSON.stringify(fixture.sandbox.state)));
  assert.equal(fixture.applied.length, initialApplications);
});

test('project includes valid MIT open source LICENSE and updated README', () => {
  const licensePath = path.join(__dirname, '..', 'LICENSE');
  assert.ok(fs.existsSync(licensePath), 'LICENSE file must exist');
  const licenseText = fs.readFileSync(licensePath, 'utf8');
  assert.ok(licenseText.includes('MIT License'), 'LICENSE must be MIT');
  assert.ok(licenseText.includes('AuraMusic Contributors'), 'LICENSE must credit AuraMusic');

  const readmePath = path.join(__dirname, '..', 'README.md');
  const readmeText = fs.readFileSync(readmePath, 'utf8');
  assert.ok(readmeText.includes('Licencia y Código Abierto'), 'README must declare open source');
  assert.ok(readmeText.includes('Licencia MIT'), 'README must mention MIT license');
});

test('sliderKnob shadow DOM CSS enforces pointer-events: none and no flex on container', () => {
  const themeManagerSrc = fs.readFileSync(path.join(__dirname, '..', 'modules/themes/theme-manager.js'), 'utf8');
  assert.ok(themeManagerSrc.includes('#sliderKnob {'), 'theme-manager must style #sliderKnob');
  assert.ok(!themeManagerSrc.includes('#sliderContainer {\n        height: 24px !important;\n        position: relative !important;\n        display: flex'), 'sliderContainer must not use display: flex');
  assert.ok(themeManagerSrc.includes('#sliderKnob {\n        position: absolute !important;\n        width: 24px !important;\n        height: 24px !important;\n        top: 50% !important;\n        margin-top: -12px !important;\n        margin-left: -12px !important;'), 'sliderKnob must be vertically and horizontally centered with 24px diameter');
});

test('player-bridge includes active watchdog reconcileTimelineKnob and user interaction handler', () => {
  const bridgeSrc = fs.readFileSync(path.join(__dirname, '..', 'modules/core/player-bridge.js'), 'utf8');
  assert.ok(bridgeSrc.includes('function reconcileTimelineKnob'), 'reconcileTimelineKnob must exist');
  assert.ok(bridgeSrc.includes('function setupProgressBarUserInteraction'), 'setupProgressBarUserInteraction must exist');
  assert.ok(bridgeSrc.includes("knob.style.left = `${expectedPct}%`"), 'reconcileTimelineKnob must sync knob position');
  assert.ok(bridgeSrc.includes("slider.removeAttribute('dragging')"), 'reconcileTimelineKnob must clear stuck dragging state');
});

