/**
 * AuraMusic - Núcleo de Estado Global y Persistencia (modules/core/state.js)
 * Provee el estado compartido reactivo y las funciones puente para todos los módulos.
 */
var AuraMusic = window.AuraMusic = window.AuraMusic || {};

var defaultSettings = window.defaultSettings = AuraMusic.defaultSettings = {
  theme: 'oled',
  primaryColor: '#00e5ff',
  ambientGlow: true,
  visualizer: 'bars',
  volumeBoost: 100,
  playbackSpeed: 1.0,
  cleanMode: true,
  splashScreen: true,
  splashSound: true,
  eq: {
    '60Hz': 0,
    '250Hz': 0,
    '1kHz': 0,
    '4kHz': 0,
    '12kHz': 0
  }
};

var state = window.state = AuraMusic.state = { ...defaultSettings };

function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

function fallbackLoadSettings() {
  try {
    const saved = localStorage.getItem('auramusic_settings');
    if (saved) {
      Object.assign(state, defaultSettings, JSON.parse(saved));
    }
  } catch (e) {}
  applyAllSettings();
}

function loadSettings() {
  if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
    try {
      chrome.storage.local.get(['auramusic_settings'], (result) => {
        try {
          if (chrome.runtime?.lastError) {
            fallbackLoadSettings();
            return;
          }
          if (result && result.auramusic_settings) {
            Object.assign(state, defaultSettings, result.auramusic_settings);
          }
          applyAllSettings();
        } catch (e) {
          fallbackLoadSettings();
        }
      });
      return;
    } catch (e) {
      fallbackLoadSettings();
      return;
    }
  }
  fallbackLoadSettings();
}

function saveSettings() {
  if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
    try {
      chrome.storage.local.set({ auramusic_settings: state }, () => {});
    } catch (e) {}
  }
  try {
    localStorage.setItem('auramusic_settings', JSON.stringify(state));
  } catch (e) {}
}

function applyAllSettings() {
  applyTheme(state.theme);
  applyCleanMode(state.cleanMode);
  applyAmbientGlow(state.ambientGlow);
  applyPlaybackSpeed(state.playbackSpeed);
  applyVolumeBoost(state.volumeBoost);
  applyEQ();
  updateUIControls();
}

// Puentes globales para todos los módulos
function applyTheme(themeName) {
  state.theme = themeName || 'default';
  
  // 1. Remover todas las clases de tema del body
  const allThemes = [
    'auramusic-theme-jesuluto', 'auramusic-theme-komi', 'auramusic-theme-apple',
    'auramusic-theme-spotify', 'auramusic-theme-whatsapp', 'auramusic-theme-oled',
    'auramusic-theme-cyberpunk', 'auramusic-theme-glass', 'auramusic-theme-dynamic',
    'auramusic-theme-youtube', 'auramusic-theme-aesthetic', 'auramusic-theme-minecraft'
  ];
  document.body.classList.remove(...allThemes);

  // 2. Agregar clase correspondiente
  if (state.theme && state.theme !== 'default') {
    document.body.classList.add(`auramusic-theme-${state.theme}`);
  }

  // 3. Establecer color de acento
  if (state.primaryColor) {
    document.documentElement.style.setProperty('--auramusic-primary', state.primaryColor);
  }

  // 4. Invocar theme-manager si está disponible
  if (window.AuraMusic.Themes?.applyTheme) {
    window.AuraMusic.Themes.applyTheme(state.theme);
  }

  updateUIControls();
}

function applyCleanMode(enabled) {
  state.cleanMode = !!enabled;
  document.body.classList.toggle('auramusic-clean-mode', !!enabled);
}

function applyAmbientGlow(enabled) {
  state.ambientGlow = !!enabled;
  if (window.AuraMusic.Ambient?.applyAmbientGlow) {
    window.AuraMusic.Ambient.applyAmbientGlow(enabled);
  }
}

function applyPlaybackSpeed(speed) {
  state.playbackSpeed = parseFloat(speed) || 1.0;
  if (window.AuraMusic.Audio?.applyPlaybackSpeed) {
    window.AuraMusic.Audio.applyPlaybackSpeed(state.playbackSpeed);
  }
}

function applyVolumeBoost(boost) {
  state.volumeBoost = parseInt(boost, 10) || 100;
  if (window.AuraMusic.Audio?.applyVolumeBoost) {
    window.AuraMusic.Audio.applyVolumeBoost(state.volumeBoost);
  }
}

function applyEQ() {
  if (window.AuraMusic.Audio?.applyEQ) {
    window.AuraMusic.Audio.applyEQ();
  }
}

function applyVisualizerMode(mode) {
  state.visualizer = mode;
  if (window.AuraMusic.Visualizer?.applyVisualizerMode) {
    window.AuraMusic.Visualizer.applyVisualizerMode(mode);
  }
  updateUIControls();
}

function updateUIControls() {
  if (window.AuraMusic.Hub?.updateUIControls) {
    window.AuraMusic.Hub.updateUIControls();
  }
}

// Exportar globalmente en window y window.AuraMusic
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.applyAllSettings = applyAllSettings;
window.applyTheme = applyTheme;
window.applyCleanMode = applyCleanMode;
window.applyAmbientGlow = applyAmbientGlow;
window.applyPlaybackSpeed = applyPlaybackSpeed;
window.applyVolumeBoost = applyVolumeBoost;
window.applyEQ = applyEQ;
window.applyVisualizerMode = applyVisualizerMode;
window.updateUIControls = updateUIControls;

AuraMusic.loadSettings = loadSettings;
AuraMusic.saveSettings = saveSettings;
AuraMusic.applyAllSettings = applyAllSettings;
AuraMusic.applyTheme = applyTheme;
AuraMusic.applyCleanMode = applyCleanMode;
AuraMusic.applyAmbientGlow = applyAmbientGlow;
AuraMusic.applyPlaybackSpeed = applyPlaybackSpeed;
AuraMusic.applyVolumeBoost = applyVolumeBoost;
AuraMusic.applyEQ = applyEQ;
AuraMusic.applyVisualizerMode = applyVisualizerMode;
AuraMusic.updateUIControls = updateUIControls;
