/**
 * AuraMusic - Content Script Injected into music.youtube.com
 * Advanced Customization Suite (Themes, Ambient Glow, Visualizer, EQ, Ad-Free)
 */

(function () {
  'use strict';

  console.log('%c✨ AuraMusic: Inicializando motor de personalización...', 'color: #00e5ff; font-weight: bold; font-size: 14px;');

  // --- 1. ESTADO GLOBAL POR DEFECTO ---
  const defaultSettings = {
    theme: 'oled', // 'oled', 'cyberpunk', 'glass', 'dynamic', 'default'
    primaryColor: '#00e5ff',
    ambientGlow: true,
    visualizer: 'bars', // 'bars', 'wave', 'off'
    volumeBoost: 100, // 100% a 300%
    playbackSpeed: 1.0,
    cleanMode: true,
    eq: {
      '60Hz': 0,
      '250Hz': 0,
      '1kHz': 0,
      '4kHz': 0,
      '12kHz': 0
    }
  };

  let state = { ...defaultSettings };
  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let gainNode = null;
  let eqFilters = {};
  let isAudioConnected = false;
  let animFrameId = null;

  // --- 2. CARGA Y PERSISTENCIA DE CONFIGURACIÓN ---
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['auramusic_settings'], (result) => {
        if (result && result.auramusic_settings) {
          state = { ...defaultSettings, ...result.auramusic_settings };
        }
        applyAllSettings();
      });
    } else {
      try {
        const saved = localStorage.getItem('auramusic_settings');
        if (saved) state = { ...defaultSettings, ...JSON.parse(saved) };
      } catch (e) {}
      applyAllSettings();
    }
  }

  function saveSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ auramusic_settings: state });
    }
    try {
      localStorage.setItem('auramusic_settings', JSON.stringify(state));
    } catch (e) {}
  }

  // --- 3. APLICAR AJUSTES A LA INTERFAZ ---
  function applyAllSettings() {
    applyTheme(state.theme);
    applyCleanMode(state.cleanMode);
    applyAmbientGlow(state.ambientGlow);
    applyPlaybackSpeed(state.playbackSpeed);
    applyVolumeBoost(state.volumeBoost);
    applyEQ();
    updateUIControls();
  }

  function applyTheme(themeName) {
    document.body.classList.remove(
      'auramusic-theme-oled',
      'auramusic-theme-cyberpunk',
      'auramusic-theme-glass',
      'auramusic-theme-dynamic'
    );

    if (themeName && themeName !== 'default') {
      document.body.classList.add(`auramusic-theme-${themeName}`);
    }

    document.documentElement.style.setProperty('--auramusic-primary', state.primaryColor);
  }

  function applyCleanMode(enabled) {
    document.body.classList.toggle('auramusic-clean-mode', !!enabled);
  }

  function applyAmbientGlow(enabled) {
    document.body.classList.toggle('auramusic-ambient-active', !!enabled);
  }

  function applyPlaybackSpeed(speed) {
    const video = document.querySelector('video');
    if (video) {
      video.playbackRate = parseFloat(speed) || 1.0;
    }
  }

  function applyVolumeBoost(boostVal) {
    if (gainNode) {
      // 100% = 1.0, 300% = 3.0
      const gain = Math.max(0, Math.min(3.0, (boostVal || 100) / 100));
      gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
    }
  }

  function applyEQ() {
    if (!isAudioConnected) return;
    for (const [freq, gain] of Object.entries(state.eq)) {
      if (eqFilters[freq]) {
        eqFilters[freq].gain.setValueAtTime(gain, audioCtx.currentTime);
      }
    }
  }

  // --- 4. MOTOR DE AUDIO WEB AUDIO API ---
  function initAudioEngine() {
    const video = document.querySelector('video');
    if (!video || isAudioConnected) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();

      sourceNode = audioCtx.createMediaElementSource(video);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;

      gainNode = audioCtx.createGain();
      applyVolumeBoost(state.volumeBoost);

      // Crear filtros de ecualizador de 5 bandas
      const frequencies = [
        { freq: 60, type: 'lowshelf', label: '60Hz' },
        { freq: 250, type: 'peaking', label: '250Hz' },
        { freq: 1000, type: 'peaking', label: '1kHz' },
        { freq: 4000, type: 'peaking', label: '4kHz' },
        { freq: 12000, type: 'highshelf', label: '12kHz' }
      ];

      let lastNode = sourceNode;
      frequencies.forEach(({ freq, type, label }) => {
        const filter = audioCtx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        filter.gain.value = state.eq[label] || 0;
        lastNode.connect(filter);
        lastNode = filter;
        eqFilters[label] = filter;
      });

      lastNode.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioCtx.destination);

      isAudioConnected = true;
      console.log('✅ AuraMusic: Motor Web Audio API conectado con éxito.');
    } catch (e) {
      console.warn('AuraMusic: AudioContext en modo seguro.', e);
    }
  }

  // Desbloquear AudioContext en la primera interacción del usuario
  ['click', 'keydown', 'play'].forEach((evt) => {
    window.addEventListener(evt, () => {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (!isAudioConnected) {
        initAudioEngine();
      }
    }, { once: true });
  });

  // --- 5. VISUALIZADOR DE AUDIO INTEGRADO ---
  function initVisualizerElements() {
    if (document.getElementById('auramusic-visualizer-container')) return;

    const playerBar = document.querySelector('ytmusic-player-bar');
    if (!playerBar) return;

    // Contenedor e Inserción sobre la barra de reproducción
    const container = document.createElement('div');
    container.id = 'auramusic-visualizer-container';

    const canvas = document.createElement('canvas');
    canvas.id = 'auramusic-visualizer-canvas';
    container.appendChild(canvas);

    // NUNCA sobreescribir position de ytmusic-player-bar para no romper el layout de YouTube Music
    playerBar.insertBefore(container, playerBar.firstChild);

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = 28;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    startVisualizerLoop(canvas);
  }

  function startVisualizerLoop(canvas) {
    const ctx = canvas.getContext('2d');
    const dataArray = new Uint8Array(64);

    let lastRenderTime = 0;
    function render(now) {
      animFrameId = requestAnimationFrame(render);

      if (state.visualizer === 'off') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      // Limitar a 30 FPS para máximo rendimiento y 0% de CPU
      const curTime = now || performance.now();
      if (curTime - lastRenderTime < 33) return;
      lastRenderTime = curTime;

      if (analyser && isAudioConnected) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Simulación sutil reactiva si el audio está en streaming directo
        const video = document.querySelector('video');
        const isPlaying = video && !video.paused;
        const time = performance.now() * 0.003;
        for (let i = 0; i < 32; i++) {
          dataArray[i] = isPlaying ? Math.floor(60 + Math.sin(time + i * 0.4) * 45) : 0;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const barCount = 36;
      const barWidth = (width / barCount) * 0.65;
      const gap = (width / barCount) * 0.35;

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, state.primaryColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
      ctx.fillStyle = grad;

      if (state.visualizer === 'bars') {
        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i] || 0;
          const barHeight = (val / 255) * height * 0.9;
          const x = i * (barWidth + gap) + gap / 2;
          const y = height - barHeight;

          ctx.fillRect(x, y, barWidth, barHeight);
        }
      } else if (state.visualizer === 'wave') {
        ctx.beginPath();
        ctx.strokeStyle = state.primaryColor;
        ctx.lineWidth = 2.5;

        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i] || 0;
          const y = height - (val / 255) * (height * 0.8) - 5;
          const x = i * (width / barCount);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    render();
  }

  // --- 6. ILUMINACIÓN AMBIENTAL DINÁMICA ---
  function initAmbientGlowElements() {
    if (document.getElementById('auramusic-ambient-glow')) return;

    const ambientDiv = document.createElement('div');
    ambientDiv.id = 'auramusic-ambient-glow';
    ambientDiv.innerHTML = `
      <div class="auramusic-glow-layer" id="auramusic-glow-1"></div>
      <div class="auramusic-glow-layer" id="auramusic-glow-2"></div>
    `;
    document.body.appendChild(ambientDiv);
  }

  function updateDynamicCoverColor() {
    const img = document.querySelector('ytmusic-player-bar .image, #song-image img');
    if (!img || !img.src) return;

    const tempImg = new Image();
    tempImg.crossOrigin = 'Anonymous';
    tempImg.src = img.src;

    tempImg.onload = function () {
      try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 16;
        offCanvas.height = 16;
        const oCtx = offCanvas.getContext('2d');
        oCtx.drawImage(tempImg, 0, 0, 16, 16);
        const data = oCtx.getImageData(0, 0, 16, 16).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 100) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        if (count > 0) {
          r = Math.min(255, Math.floor((r / count) * 1.3));
          g = Math.min(255, Math.floor((g / count) * 1.3));
          b = Math.min(255, Math.floor((b / count) * 1.3));
          const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

          document.documentElement.style.setProperty('--auramusic-ambient-color', hex);

          const glow1 = document.getElementById('auramusic-glow-1');
          const glow2 = document.getElementById('auramusic-glow-2');
          if (glow1) glow1.style.background = `radial-gradient(circle, ${hex} 0%, transparent 70%)`;
          if (glow2) glow2.style.background = `radial-gradient(circle, ${state.primaryColor} 0%, transparent 70%)`;
        }
      } catch (e) {}
    };
  }

  // --- 7. GUARDIÁN ANTI-DISTRACCIONES Y ANUNCIOS ---
  function initCleanWatchdog() {
    setInterval(() => {
      if (!state.cleanMode) return;

      // 1. Auto-confirmar diálogo "¿Sigues ahí?"
      const confirmBtn = document.querySelector('ytmusic-you-there-renderer #confirm-button, #confirm-button.yt-button-renderer');
      if (confirmBtn && confirmBtn.offsetParent !== null) {
        console.log('⚡ AuraMusic: Auto-confirmando sesión activa.');
        confirmBtn.click();
      }

      // 2. Cerrar banners promocionales de suscripción
      const dismissBtn = document.querySelector('ytmusic-mealbar-promo-renderer #dismiss-button');
      if (dismissBtn && dismissBtn.offsetParent !== null) {
        dismissBtn.click();
      }
    }, 1500);
  }

  // --- 8. CREACIÓN DEL PANEL DE CONTROL GLASSMORPHISM ---
  function injectLauncherAndHub() {
    if (document.getElementById('auramusic-launcher-btn')) return;

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
        </nav>

        <main class="auramusic-body">
          <!-- PESTAÑA 1: TEMAS -->
          <section class="auramusic-panel active" id="panel-themes">
            <div class="auramusic-card">
              <span class="auramusic-label">Estilo de Interfaz</span>
              <span class="auramusic-sublabel">Selecciona el tema que transformará la estética de YouTube Music.</span>
              <div class="auramusic-theme-grid">
                <button type="button" class="theme-pill-btn" data-theme="oled">🖤 OLED Pure Black</button>
                <button type="button" class="theme-pill-btn" data-theme="cyberpunk">🌆 Cyberpunk Neón</button>
                <button type="button" class="theme-pill-btn" data-theme="glass">❄️ Glassmorphism</button>
                <button type="button" class="theme-pill-btn" data-theme="dynamic">🎨 Color Dinámico</button>
                <button type="button" class="theme-pill-btn" data-theme="default">Default YouTube</button>
              </div>
            </div>

            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">Color de Acento Principal</span>
                  <span class="auramusic-sublabel">Color para botones, barras y brillos neón.</span>
                </div>
                <input type="color" id="auramusic-color-picker" value="${state.primaryColor}" style="cursor:pointer; border:none; width:36px; height:36px; border-radius:50%; background:transparent;">
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
                <span id="volume-boost-val" style="font-weight:700; color:var(--auramusic-primary);">${state.volumeBoost}%</span>
              </div>
              <input type="range" class="auramusic-range" id="volume-boost-slider" min="100" max="300" step="10" value="${state.volumeBoost}">
            </div>

            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">⚡ Velocidad de Reproducción</span>
                  <span class="auramusic-sublabel">Ajuste fino de tempo (0.25x a 3.0x).</span>
                </div>
                <span id="speed-val" style="font-weight:700; color:var(--auramusic-primary);">${state.playbackSpeed}x</span>
              </div>
              <input type="range" class="auramusic-range" id="speed-slider" min="0.25" max="3.0" step="0.05" value="${state.playbackSpeed}">
            </div>

            <div class="auramusic-card">
              <span class="auramusic-label">🎚️ Ecualizador de 5 Bandas (-12dB a +12dB)</span>
              <div class="auramusic-eq-container">
                ${['60Hz', '250Hz', '1kHz', '4kHz', '12kHz'].map(band => `
                  <div class="auramusic-eq-band">
                    <span class="auramusic-eq-val" id="eq-val-${band}">${state.eq[band]}dB</span>
                    <input type="range" class="auramusic-eq-slider" orient="vertical" data-band="${band}" min="-12" max="12" step="1" value="${state.eq[band]}">
                    <span class="auramusic-eq-label">${band}</span>
                  </div>
                `).join('')}
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
  }

  function setupHubEvents(launcher, overlay) {
    const closeBtn = document.getElementById('auramusic-close-btn');

    launcher.addEventListener('click', () => overlay.classList.add('active'));
    closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
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
      btn.addEventListener('click', () => {
        state.theme = btn.dataset.theme;
        applyTheme(state.theme);
        saveSettings();
        updateUIControls();
      });
    });

    // Selector de Visualizador
    overlay.querySelectorAll('.theme-pill-btn[data-vis]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.visualizer = btn.dataset.vis;
        saveSettings();
        updateUIControls();
      });
    });

    // Color Picker
    const colorPicker = document.getElementById('auramusic-color-picker');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        state.primaryColor = e.target.value;
        document.documentElement.style.setProperty('--auramusic-primary', state.primaryColor);
        saveSettings();
      });
    }

    // Toggle Iluminación Ambiental
    const toggleAmbient = document.getElementById('toggle-ambient');
    if (toggleAmbient) {
      toggleAmbient.addEventListener('change', (e) => {
        state.ambientGlow = e.target.checked;
        applyAmbientGlow(state.ambientGlow);
        saveSettings();
      });
    }

    // Toggle Limpieza
    const toggleClean = document.getElementById('toggle-clean');
    if (toggleClean) {
      toggleClean.addEventListener('change', (e) => {
        state.cleanMode = e.target.checked;
        applyCleanMode(state.cleanMode);
        saveSettings();
      });
    }

    // Volume Boost Slider
    const volumeSlider = document.getElementById('volume-boost-slider');
    const volumeVal = document.getElementById('volume-boost-val');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        state.volumeBoost = parseInt(e.target.value, 10);
        if (volumeVal) volumeVal.textContent = `${state.volumeBoost}%`;
        applyVolumeBoost(state.volumeBoost);
        saveSettings();
      });
    }

    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        state.playbackSpeed = parseFloat(e.target.value);
        if (speedVal) speedVal.textContent = `${state.playbackSpeed.toFixed(2)}x`;
        applyPlaybackSpeed(state.playbackSpeed);
        saveSettings();
      });
    }

    // Sliders de Ecualizador
    overlay.querySelectorAll('.auramusic-eq-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const band = slider.dataset.band;
        const val = parseInt(e.target.value, 10);
        state.eq[band] = val;
        const valSpan = document.getElementById(`eq-val-${band}`);
        if (valSpan) valSpan.textContent = `${val > 0 ? '+' : ''}${val}dB`;
        applyEQ();
        saveSettings();
      });
    });

    // Restablecer
    const resetBtn = document.getElementById('auramusic-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state = { ...defaultSettings };
        saveSettings();
        applyAllSettings();
      });
    }
  }

  function updateUIControls() {
    // Marcar tema activo
    document.querySelectorAll('.theme-pill-btn[data-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === state.theme);
    });
    // Marcar visualizador activo
    document.querySelectorAll('.theme-pill-btn[data-vis]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vis === state.visualizer);
    });
  }

  // --- 9. INICIALIZACIÓN GLOBAL CUANDO EL DOM ESTÉ LISTO ---
  function init() {
    loadSettings();
    injectLauncherAndHub();
    initAmbientGlowElements();
    initVisualizerElements();
    initCleanWatchdog();

    // Detección ultraliviana de cambio de canción (0% CPU, sin MutationObserver pesado)
    let lastCoverSrc = '';
    function checkSongChange() {
      const img = document.querySelector('ytmusic-player-bar .image, #song-image img');
      if (img && img.src && img.src !== lastCoverSrc) {
        lastCoverSrc = img.src;
        updateDynamicCoverColor();
      }
    }

    document.addEventListener('yt-page-data-updated', checkSongChange);
    const video = document.querySelector('video');
    if (video) {
      video.addEventListener('loadeddata', checkSongChange);
      video.addEventListener('play', checkSongChange);
    }
    setInterval(checkSongChange, 2000);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();
