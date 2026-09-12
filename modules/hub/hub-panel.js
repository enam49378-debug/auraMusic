/**
 * AuraMusic - Módulo de Interfaz de Usuario (Hub Modal Glassmorphism & Botón Flotante)
 */
window.AuraMusic = window.AuraMusic || {};

(function() {
  'use strict';

  function getState() {
    return window.AuraMusic?.state || window.state || window.defaultSettings || {};
  }

  // --- CREACIÓN DEL PANEL DE CONTROL GLASSMORPHISM ---
  function injectLauncherAndHub() {
    if (document.getElementById('auramusic-launcher-btn')) return;

    const state = getState();

    // Botón Lanzador Flotante
    const launcher = document.createElement('button');
    launcher.id = 'auramusic-launcher-btn';
    launcher.type = 'button';
    launcher.innerHTML = `<span class="sparkle">✨</span> <span>AuraMusic</span>`;
    document.body.appendChild(launcher);

    // Modal Hub Flotante
    const overlay = document.createElement('div');
    overlay.id = 'auramusic-hub-overlay';
    overlay.innerHTML = `
      <div id="auramusic-hub">
        <header class="auramusic-header">
          <div class="auramusic-title-group">
            <span class="auramusic-logo-badge">✨</span>
            <span class="auramusic-title">AuraMusic Hub</span>
            <span class="auramusic-version">v1.0</span>
          </div>
          <button type="button" class="auramusic-close-btn" id="auramusic-close-btn">✕</button>
        </header>

        <nav class="auramusic-tabs">
          <button type="button" class="auramusic-tab active" data-tab="themes">🎨 Temas</button>
          <button type="button" class="auramusic-tab" data-tab="visualizer">📊 Visualizador</button>
          <button type="button" class="auramusic-tab" data-tab="audio">🎚️ Audio & EQ</button>
          <button type="button" class="auramusic-tab" data-tab="clean">🚫 Limpieza</button>
          <button type="button" class="auramusic-tab" id="hub-cinema-lyrics-tab" style="color: #ff8fa3; font-weight: 700;">✨ Modo Letras</button>
        </nav>

        <main class="auramusic-body">
          <!-- PESTAÑA 1: TEMAS -->
          <section class="auramusic-panel active" id="panel-themes">
            <div class="auramusic-card">
              <span class="auramusic-label">Estilo de Interfaz</span>
              <span class="auramusic-sublabel">Selecciona el tema que transformará la estética de YouTube Music.</span>
              <div class="auramusic-theme-grid">
                <button type="button" class="theme-pill-btn" data-theme="jesuluto">⚡ Jesuluto</button>
                <button type="button" class="theme-pill-btn" data-theme="komi">🐱 Komi-san</button>
                <button type="button" class="theme-pill-btn" data-theme="apple">🍎 Apple Music</button>
                <button type="button" class="theme-pill-btn" data-theme="spotify">🟢 Spotify</button>
                <button type="button" class="theme-pill-btn" data-theme="whatsapp">💬 WhatsApp</button>
                <button type="button" class="theme-pill-btn" data-theme="aesthetic">🌸 Aesthetic Pastel</button>
                <button type="button" class="theme-pill-btn" data-theme="minecraft">⛏️ Minecraft Pixel</button>
                <button type="button" class="theme-pill-btn" data-theme="cyberpunk">🤖 Cyberpunk Mecha</button>
                <button type="button" class="theme-pill-btn" data-theme="youtube">🔴 YouTube Red</button>
                <button type="button" class="theme-pill-btn" data-theme="oled">🖤 OLED Black</button>
                <button type="button" class="theme-pill-btn" data-theme="dynamic">🎨 Dinámico</button>
                <button type="button" class="theme-pill-btn" data-theme="default">⚙️ Default</button>
              </div>
            </div>

            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">Color de Acento Principal</span>
                  <span class="auramusic-sublabel">Color para botones, barras y brillos neón.</span>
                </div>
                <input type="color" id="auramusic-color-picker" value="${state.primaryColor || '#00e5ff'}" style="cursor:pointer; border:none; width:36px; height:36px; border-radius:50%; background:transparent;">
              </div>
            </div>
          </section>

          <!-- PESTAÑA 2: VISUALIZADOR & AMBIENTE -->
          <section class="auramusic-panel" id="panel-visualizer">
            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🌈 Iluminación Ambiental Reactiva</span>
                  <span class="auramusic-sublabel">Proyecta un aura viva en el fondo según los colores del álbum.</span>
                </div>
                <label class="auramusic-switch">
                  <input type="checkbox" id="toggle-ambient" ${state.ambientGlow ? 'checked' : ''}>
                  <span class="auramusic-slider"></span>
                </label>
              </div>
            </div>

            <div class="auramusic-card">
              <span class="auramusic-label">📊 Visualizador en la Barra de Reproducción</span>
              <span class="auramusic-sublabel">Renderizado en tiempo real de frecuencias musicales.</span>
              <div class="auramusic-theme-grid" style="margin-top: 8px;">
                <button type="button" class="theme-pill-btn" data-vis="bars">📶 Barras Neón</button>
                <button type="button" class="theme-pill-btn" data-vis="wave">〰️ Onda Líquida</button>
                <button type="button" class="theme-pill-btn" data-vis="off">✕ Desactivado</button>
              </div>
            </div>
          </section>

          <!-- PESTAÑA 3: AUDIO, EQ & VELOCIDAD -->
          <section class="auramusic-panel" id="panel-audio">
            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🔊 Potenciador de Volumen (Volume Boost)</span>
                  <span class="auramusic-sublabel">Sube el volumen hasta un 300% para canciones con baja ganancia.</span>
                </div>
                <span id="volume-boost-val" style="font-weight:700; color:var(--auramusic-primary);">${state.volumeBoost || 100}%</span>
              </div>
              <input type="range" class="auramusic-range" id="volume-boost-slider" min="100" max="300" step="10" value="${state.volumeBoost || 100}">
            </div>

            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">⚡ Velocidad de Reproducción</span>
                  <span class="auramusic-sublabel">Ajuste fino de tempo (0.25x a 3.0x).</span>
                </div>
                <span id="speed-val" style="font-weight:700; color:var(--auramusic-primary);">${state.playbackSpeed || 1.0}x</span>
              </div>
              <input type="range" class="auramusic-range" id="speed-slider" min="0.25" max="3.0" step="0.05" value="${state.playbackSpeed || 1.0}">
            </div>

            <div class="auramusic-card">
              <span class="auramusic-label">🎚️ Ecualizador de 5 Bandas (-12dB a +12dB)</span>
              <div class="auramusic-eq-container">
                ${['60Hz', '250Hz', '1kHz', '4kHz', '12kHz'].map(band => {
                  const val = (state.eq && typeof state.eq[band] === 'number') ? state.eq[band] : 0;
                  return `
                  <div class="auramusic-eq-band">
                    <span class="auramusic-eq-val" id="eq-val-${band}">${val > 0 ? '+' : ''}${val}dB</span>
                    <input type="range" class="auramusic-eq-slider" orient="vertical" data-band="${band}" min="-12" max="12" step="1" value="${val}">
                    <span class="auramusic-eq-label">${band}</span>
                  </div>
                `;}).join('')}
              </div>
            </div>
          </section>

          <!-- PESTAÑA 4: LIMPIEZA -->
          <section class="auramusic-panel" id="panel-clean">
            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🚫 Modo Limpio y Anti-Distracciones</span>
                  <span class="auramusic-sublabel">Auto-cierra el aviso '¿Sigues ahí?' y oculta banners molestos de Premium.</span>
                </div>
                <label class="auramusic-switch">
                  <input type="checkbox" id="toggle-clean" ${state.cleanMode ? 'checked' : ''}>
                  <span class="auramusic-slider"></span>
                </label>
              </div>
            </div>
          </section>
        </main>

        <footer class="auramusic-footer">
          <button type="button" class="auramusic-reset-btn" id="auramusic-reset-btn">Restablecer Ajustes</button>
          <span style="font-size:0.75rem; color:rgba(255,255,255,0.4);">AuraMusic for YouTube Music</span>
        </footer>
      </div>
    `;
    document.body.appendChild(overlay);

    setupHubEvents(launcher, overlay);
    updateUIControls();
  }

  function setupHubEvents(launcher, overlay) {
    const closeBtn = document.getElementById('auramusic-close-btn');

    function openHub() {
      overlay.classList.add('active');
      updateUIControls();
    }

    function closeHub() {
      overlay.classList.remove('active');
    }

    launcher.addEventListener('click', (e) => {
      e.stopPropagation();
      openHub();
    });

    const cinemaTabBtn = document.getElementById('hub-cinema-lyrics-tab');
    if (cinemaTabBtn) {
      cinemaTabBtn.addEventListener('click', () => {
        closeHub();
        if (window.AuraMusic?.Lyrics?.openCinemaMode) {
          window.AuraMusic.Lyrics.openCinemaMode();
        } else if (window.openCinemaMode) {
          window.openCinemaMode();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeHub();
      });
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeHub();
      }
    });

    // Cerrar con tecla Escape de forma confiable
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeHub();
      }
    });

    // Pestañas
    const tabs = overlay.querySelectorAll('.auramusic-tab');
    const panels = overlay.querySelectorAll('.auramusic-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(`panel-${tab.dataset.tab}`);
        if (target) target.classList.add('active');
      });
    });

    // Selector de Temas
    overlay.querySelectorAll('.theme-pill-btn[data-theme]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const theme = btn.dataset.theme;
        const state = getState();
        state.theme = theme;
        if (window.applyTheme) {
          window.applyTheme(theme);
        } else if (window.AuraMusic?.applyTheme) {
          window.AuraMusic.applyTheme(theme);
        }
        if (window.saveSettings) window.saveSettings();
        updateUIControls();
      });
    });

    // Selector de Visualizador
    overlay.querySelectorAll('.theme-pill-btn[data-vis]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const vis = btn.dataset.vis;
        const state = getState();
        state.visualizer = vis;
        if (window.applyVisualizerMode) {
          window.applyVisualizerMode(vis);
        } else if (window.AuraMusic?.applyVisualizerMode) {
          window.AuraMusic.applyVisualizerMode(vis);
        }
        if (window.saveSettings) window.saveSettings();
        updateUIControls();
      });
    });

    // Color Picker
    const colorPicker = document.getElementById('auramusic-color-picker');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        const state = getState();
        state.primaryColor = e.target.value;
        document.documentElement.style.setProperty('--auramusic-primary', state.primaryColor);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Toggle Iluminación Ambiental
    const toggleAmbient = document.getElementById('toggle-ambient');
    if (toggleAmbient) {
      toggleAmbient.addEventListener('change', (e) => {
        const state = getState();
        state.ambientGlow = e.target.checked;
        if (window.applyAmbientGlow) window.applyAmbientGlow(state.ambientGlow);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Toggle Limpieza
    const toggleClean = document.getElementById('toggle-clean');
    if (toggleClean) {
      toggleClean.addEventListener('change', (e) => {
        const state = getState();
        state.cleanMode = e.target.checked;
        if (window.applyCleanMode) window.applyCleanMode(state.cleanMode);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Volume Boost Slider
    const volumeSlider = document.getElementById('volume-boost-slider');
    const volumeVal = document.getElementById('volume-boost-val');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const state = getState();
        state.volumeBoost = parseInt(e.target.value, 10);
        if (volumeVal) volumeVal.textContent = `${state.volumeBoost}%`;
        if (window.applyVolumeBoost) window.applyVolumeBoost(state.volumeBoost);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        const state = getState();
        state.playbackSpeed = parseFloat(e.target.value);
        if (speedVal) speedVal.textContent = `${state.playbackSpeed.toFixed(2)}x`;
        if (window.applyPlaybackSpeed) window.applyPlaybackSpeed(state.playbackSpeed);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Sliders de Ecualizador
    overlay.querySelectorAll('.auramusic-eq-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const band = slider.dataset.band;
        const val = parseInt(e.target.value, 10);
        const state = getState();
        if (!state.eq) state.eq = {};
        state.eq[band] = val;
        const valSpan = document.getElementById(`eq-val-${band}`);
        if (valSpan) valSpan.textContent = `${val > 0 ? '+' : ''}${val}dB`;
        if (window.applyEQ) window.applyEQ();
        if (window.saveSettings) window.saveSettings();
      });
    });

    // Restablecer
    const resetBtn = document.getElementById('auramusic-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const def = window.AuraMusic?.defaultSettings || window.defaultSettings || {};
        const state = getState();
        Object.assign(state, JSON.parse(JSON.stringify(def)));
        if (window.applyAllSettings) {
          window.applyAllSettings();
        }
        if (window.saveSettings) window.saveSettings();
        updateUIControls();
      });
    }
  }

  function updateUIControls() {
    const state = getState();
    // Marcar tema activo
    document.querySelectorAll('.theme-pill-btn[data-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === state.theme);
    });
    // Marcar visualizador activo
    document.querySelectorAll('.theme-pill-btn[data-vis]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vis === state.visualizer);
    });
    // Actualizar sliders y switches
    const colorPicker = document.getElementById('auramusic-color-picker');
    if (colorPicker && state.primaryColor) colorPicker.value = state.primaryColor;
    const toggleAmbient = document.getElementById('toggle-ambient');
    if (toggleAmbient) toggleAmbient.checked = !!state.ambientGlow;
    const toggleClean = document.getElementById('toggle-clean');
    if (toggleClean) toggleClean.checked = !!state.cleanMode;
    const volumeSlider = document.getElementById('volume-boost-slider');
    const volumeVal = document.getElementById('volume-boost-val');
    if (volumeSlider && state.volumeBoost) {
      volumeSlider.value = state.volumeBoost;
      if (volumeVal) volumeVal.textContent = `${state.volumeBoost}%`;
    }
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    if (speedSlider && state.playbackSpeed) {
      speedSlider.value = state.playbackSpeed;
      if (speedVal) speedVal.textContent = `${state.playbackSpeed.toFixed(2)}x`;
    }
    if (state.eq) {
      Object.keys(state.eq).forEach(band => {
        const slider = document.querySelector(`.auramusic-eq-slider[data-band="${band}"]`);
        const valSpan = document.getElementById(`eq-val-${band}`);
        if (slider) slider.value = state.eq[band];
        if (valSpan) valSpan.textContent = `${state.eq[band] > 0 ? '+' : ''}${state.eq[band]}dB`;
      });
    }
  }

  window.AuraMusic.Hub = {
    injectLauncherAndHub,
    setupHubEvents,
    updateUIControls
  };
})();
