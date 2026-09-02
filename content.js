/**
 * AuraMusic - Content Script Injected into music.youtube.com
 * Advanced Customization Suite (Themes, Ambient Glow, Visualizer, EQ, Ad-Free)
 */

(function () {
  // --- 0. INYECTOR DE FUENTES GOOGLE (Minecraft, Aesthetic, Cyberpunk, OLED) ---
  function injectGoogleFonts() {
    if (document.getElementById('auramusic-google-fonts')) return;
    const link = document.createElement('link');
    link.id = 'auramusic-google-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Comfortaa:wght@600;700&family=Orbitron:wght@600;800;900&family=Press+Start+2P&family=Plus+Jakarta+Sans:wght@500;700&family=Quicksand:wght@600;700&family=Rajdhani:wght@600;700&family=Silkscreen:wght@400;700&family=Space+Grotesk:wght@500;700&display=swap';
    document.head.appendChild(link);
    console.log('✨ AuraMusic: Fuentes tipográficas temáticas cargadas.');
  }
  injectGoogleFonts();

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

  // --- 2. CARGA Y PERSISTENCIA SEGURA (INMUNE A EXTENSION CONTEXT INVALIDATED) ---
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
      if (saved) state = { ...defaultSettings, ...JSON.parse(saved) };
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
              state = { ...defaultSettings, ...result.auramusic_settings };
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
        chrome.storage.local.set({ auramusic_settings: state }, () => {
          if (chrome.runtime?.lastError) {}
        });
      } catch (e) {}
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

  const ALL_THEMES = [
    'auramusic-theme-apple',
    'auramusic-theme-spotify',
    'auramusic-theme-oled',
    'auramusic-theme-cyberpunk',
    'auramusic-theme-glass',
    'auramusic-theme-dynamic',
    'auramusic-theme-youtube',
    'auramusic-theme-aesthetic',
    'auramusic-theme-minecraft'
  ];

  function applyTheme(themeName) {
    document.body.classList.remove(...ALL_THEMES);

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

      const activeColor = getComputedStyle(document.documentElement).getPropertyValue('--auramusic-primary').trim() || state.primaryColor;

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, activeColor);
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
        ctx.strokeStyle = activeColor;
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
          <button type="button" class="auramusic-tab" id="hub-cinema-lyrics-tab" style="color: #ff8fa3; font-weight: 700;">🎤 Modo Letras</button>
        </nav>

        <main class="auramusic-body">
          <!-- PESTAÑA 1: TEMAS -->
          <section class="auramusic-panel active" id="panel-themes">
            <div class="auramusic-card">
              <span class="auramusic-label">Estilo de Interfaz</span>
              <span class="auramusic-sublabel">Selecciona el tema que transformará la estética de YouTube Music.</span>
              <div class="auramusic-theme-grid">
                <button type="button" class="theme-pill-btn" data-theme="apple">🍎 Apple Music</button>
                <button type="button" class="theme-pill-btn" data-theme="spotify">🟢 Spotify</button>
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
    const cinemaTabBtn = document.getElementById('hub-cinema-lyrics-tab');
    if (cinemaTabBtn) {
      cinemaTabBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        openCinemaMode();
      });
    }
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

    function onGlobalSongChange() {
      checkSongChange();
      if (typeof checkCinemaTrackChange === 'function') {
        checkCinemaTrackChange();
      }
    }

    document.addEventListener('yt-page-data-updated', onGlobalSongChange);
    const video = document.querySelector('video');
    if (video) {
      video.addEventListener('loadeddata', onGlobalSongChange);
      video.addEventListener('play', onGlobalSongChange);
    }
    setInterval(onGlobalSongChange, 1500);
  }

  
  // ==========================================================
  // SISTEMA DE LETRAS ANIMADAS ESTILO APPLE MUSIC (CINEMATIC KARAOKE)
  // ==========================================================
  let currentLyrics = [];
  let isCinemaActive = false;

    // Obtener carátula en Ultra HD (1200x1200px)
  function getHighResCoverUrl() {
    const bigImg = document.querySelector('#song-image img, #main-panel img, ytmusic-player-page .image');
    let src = (bigImg && bigImg.src) ? bigImg.src : '';

    if (!src) {
      const barImg = document.querySelector('ytmusic-player-bar .image');
      src = (barImg && barImg.src) ? barImg.src : '';
    }

    if (src) {
      if (src.includes('=w')) {
        src = src.replace(/=w\d+-h\d+[^?]*/, '=w1200-h1200-l90-rj');
      } else if (src.includes('=s')) {
        src = src.replace(/=s\d+[^?]*/, '=s1200');
      }
    }
    return src;
  }

  function parseLrc(lrcString) {
    const lines = lrcString.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    lines.forEach(line => {
      const match = timeRegex.exec(line);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = parseFloat('0.' + match[3]);
        const time = min * 60 + sec + ms;
        const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
        if (text) {
          result.push({ time, text });
        }
      }
    });

    return result.sort((a, b) => a.time - b.time);
  }

  async function fetchSyncedLyrics(title, artist, duration) {
    const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    // Limpiar artista tomando el primer nombre ("J Balvin • Colores • 2020" -> "J Balvin")
    const cleanArtist = artist.split(/[•·,\/]/)[0].trim();

    // 1. Búsqueda amplia y robusta en LrcLib (/api/search)
    try {
      const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      console.log('🎤 AuraMusic: Buscando letras sincronizadas en LrcLib...', searchUrl);

      const res = await fetch(searchUrl);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          const withSynced = list.filter(item => item.syncedLyrics);
          if (withSynced.length > 0) {
            // Ordenar por cercanía a la duración real para máxima sincronía
            if (duration > 0) {
              withSynced.sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));
            }
            console.log('✨ AuraMusic: ¡Letras sincronizadas con éxito para:', withSynced[0].trackName, '!');
            return parseLrc(withSynced[0].syncedLyrics);
          }
        }
      }
    } catch (e) {
      console.warn('AuraMusic: Fallback en búsqueda LrcLib', e);
    }

    // 2. Intento directo con /api/get si la búsqueda no trajo resultados
    try {
      const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}&duration=${Math.round(duration || 180)}`;
      const res = await fetch(getUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.syncedLyrics) {
          return parseLrc(data.syncedLyrics);
        }
      }
    } catch (e) {}

    // 2. Fallback: Extraer las letras nativas de la pestaña LETRA de YouTube Music
    const localDesc = document.querySelector('ytmusic-description-shelf-renderer .description');
    if (localDesc && localDesc.textContent.trim()) {
      const rawLines = localDesc.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const totalSec = duration > 0 ? duration : 200;
      const step = totalSec / Math.max(1, rawLines.length);

      return rawLines.map((text, idx) => ({
        time: idx * step,
        text: text
      }));
    }

    // 3. Fallback en caso de no haber letra
    return [
      { time: 0, text: 'Disfruta de la melodía...' },
      { time: 10, text: title },
      { time: 30, text: artist }
    ];
  }

  // --- SISTEMA DE TRADUCCIÓN SIMULTÁNEA INTELIGENTE ---
  let isTranslationActive = false;
  let lyricsTranslationCache = {};

  async function translateLyrics(lyrics, targetLang = 'es') {
    if (!lyrics || lyrics.length === 0) return lyrics;
    const cacheKey = `${lastCinemaTrackId}:::${targetLang}`;
    if (lyricsTranslationCache[cacheKey]) {
      return lyricsTranslationCache[cacheKey];
    }

    try {
      const chunkSize = 12;
      const translatedList = [];

      for (let i = 0; i < lyrics.length; i += chunkSize) {
        const chunk = lyrics.slice(i, i + chunkSize);
        const textToTranslate = chunk.map(l => l.text).join('\n');
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=autodetect|${targetLang}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Translation request failed');
        const data = await res.json();
        const rawTrans = data.responseData?.translatedText || '';
        const transLines = rawTrans.split('\n');

        chunk.forEach((item, cIdx) => {
          const trans = (transLines[cIdx] || '').trim();
          const isDifferent = trans && trans.toLowerCase() !== item.text.toLowerCase() && !trans.includes('PLEASE SELECT TWO DISTINCT LANGUAGES');
          translatedList.push({
            ...item,
            translatedText: isDifferent ? trans : null,
            originalText: item.text
          });
        });
      }

      lyricsTranslationCache[cacheKey] = translatedList;
      return translatedList;
    } catch (e) {
      console.warn('Traducción no disponible:', e);
      return lyrics.map(l => ({ ...l, translatedText: null, originalText: l.text }));
    }
  }

  function renderCinemaLyricsDOM() {
    const wrapper = document.getElementById('cinema-lyrics-wrapper');
    const video = document.querySelector('video');
    if (!wrapper || !currentLyrics || currentLyrics.length === 0) return;

    wrapper.innerHTML = '';
    const itemsToRender = currentLyrics;

    itemsToRender.forEach((item, index) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'cinema-lyric-line';
      lineDiv.dataset.time = item.time;
      lineDiv.dataset.index = index;

      // Si la traducción está activa y hay traducción distinta, usarla como texto principal
      const hasTranslation = isTranslationActive && item.translatedText;
      const displayText = hasTranslation ? item.translatedText : (item.originalText || item.text);

      const nextItem = itemsToRender[index + 1];
      const rawDuration = nextItem ? (nextItem.time - item.time) : 3.5;
      const words = displayText.trim().split(/\s+/).filter(w => w.length > 0);
      const totalDuration = Math.max(0.8, rawDuration);

      const weights = words.map(w => Math.max(2, w.length));
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      const mainLineSpan = document.createElement('div');
      mainLineSpan.className = 'line-primary';

      let currentOffset = 0;
      words.forEach((w, i) => {
        const frac = weights[i] / totalWeight;
        const wDur = frac * totalDuration;
        const wStart = item.time + currentOffset;
        const wEnd = wStart + wDur;
        currentOffset += wDur;

        const span = document.createElement('span');
        span.className = 'k-word';
        span.textContent = w;
        span.dataset.start = wStart.toFixed(2);
        span.dataset.end = wEnd.toFixed(2);
        mainLineSpan.appendChild(span);
        if (i < words.length - 1) {
          mainLineSpan.appendChild(document.createTextNode(' '));
        }
      });
      lineDiv.appendChild(mainLineSpan);

      // Si está traducido, poner la frase original en paréntesis abajito
      if (hasTranslation) {
        const subDiv = document.createElement('div');
        subDiv.className = 'line-original-sub';
        subDiv.textContent = `(${item.originalText})`;
        lineDiv.appendChild(subDiv);
      }

      lineDiv.addEventListener('click', () => {
        if (video) video.currentTime = item.time;
      });

      wrapper.appendChild(lineDiv);
    });
  }

  function createCinemaOverlay() {
    if (document.getElementById('auramusic-cinema-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'auramusic-cinema-overlay';
    overlay.innerHTML = `
      <div class="cinema-mesh-bg"></div>

      <div class="cinema-top-bar">
        <button type="button" class="cinema-header-btn" id="cinema-translate-btn" title="Traducir letra al idioma de tu sistema">
          <span>🌐</span> <span id="cinema-translate-text">Traducir</span>
        </button>
        <button type="button" class="cinema-header-btn cinema-close-btn" id="cinema-close-btn">
          <span>✕</span> <span>Salir de Letra Animada</span>
        </button>
      </div>

      <div class="cinema-content-grid">
        <!-- Columna Izquierda: Portada y Controles -->
        <div class="cinema-left">
          <div class="cinema-artwork-box">
            <img id="cinema-art-img" src="" alt="Portada">
          </div>

          <div class="cinema-meta-info">
            <div class="cinema-track-title" id="cinema-track-title">Cargando...</div>
            <div class="cinema-track-artist" id="cinema-track-artist">Artista</div>
          </div>

          <div class="cinema-timeline-box">
            <div class="cinema-progress-bg" id="cinema-progress-bg">
              <div class="cinema-progress-fill" id="cinema-progress-fill"></div>
            </div>
            <div class="cinema-time-row">
              <span id="cinema-current-time">0:00</span>
              <span id="cinema-total-time">0:00</span>
            </div>
          </div>

          <div class="cinema-controls">
            <button type="button" class="cinema-ctrl-btn" id="cinema-prev-btn" title="Anterior">⏮</button>
            <button type="button" class="cinema-play-btn" id="cinema-play-btn" title="Reproducir / Pausar">▶</button>
            <button type="button" class="cinema-ctrl-btn" id="cinema-next-btn" title="Siguiente">⏭</button>
          </div>
        </div>

        <!-- Columna Derecha: Letras Cinematográficas -->
        <div class="cinema-right" id="cinema-right-scroll">
          <div class="cinema-lyrics-wrapper" id="cinema-lyrics-wrapper">
            <div class="cinema-lyric-line active-line">Cargando letra sincronizada...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Eventos del Overlay
    const closeBtn = document.getElementById('cinema-close-btn');
    closeBtn.addEventListener('click', closeCinemaMode);

    const translateBtn = document.getElementById('cinema-translate-btn');
    const translateText = document.getElementById('cinema-translate-text');

    translateBtn.addEventListener('click', async () => {
      isTranslationActive = !isTranslationActive;
      translateBtn.classList.toggle('active', isTranslationActive);

      if (isTranslationActive) {
        if (translateText) translateText.textContent = 'Traduciendo...';
        const targetLang = (navigator.language || 'es').split('-')[0].toLowerCase();
        currentLyrics = await translateLyrics(currentLyrics, targetLang);
        if (translateText) translateText.textContent = `Traducido (${targetLang.toUpperCase()})`;
      } else {
        if (translateText) translateText.textContent = 'Traducir';
      }

      renderCinemaLyricsDOM();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isCinemaActive) {
        closeCinemaMode();
      }
    });

    // Controles dentro del modo cine
    const playBtn = document.getElementById('cinema-play-btn');
    const prevBtn = document.getElementById('cinema-prev-btn');
    const nextBtn = document.getElementById('cinema-next-btn');

    playBtn.addEventListener('click', () => {
      const nativePlay = document.querySelector('.play-pause-button.ytmusic-player-bar');
      if (nativePlay) nativePlay.click();
    });

    function triggerQuickTrackPoll() {
      let count = 0;
      const intId = setInterval(() => {
        checkCinemaTrackChange();
        count++;
        if (count > 15) clearInterval(intId);
      }, 250);
    }

    prevBtn.addEventListener('click', () => {
      const nativePrev = document.querySelector('.previous-button.ytmusic-player-bar');
      if (nativePrev) nativePrev.click();
      triggerQuickTrackPoll();
    });

    nextBtn.addEventListener('click', () => {
      const nativeNext = document.querySelector('.next-button.ytmusic-player-bar');
      if (nativeNext) nativeNext.click();
      triggerQuickTrackPoll();
    });

    // Salto en la barra de tiempo
    const progressBg = document.getElementById('cinema-progress-bg');
    progressBg.addEventListener('click', (e) => {
      const video = document.querySelector('video');
      if (!video || !video.duration) return;
      const rect = progressBg.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      video.currentTime = pct * video.duration;
    });
  }

  let lastCinemaTrackId = '';
  let isUpdatingCinemaTrack = false;
  let cinemaTrackGen = 0;

  function getCurrentTrackInfo() {
    let title = '';
    let artist = '';

    // 1. MediaSession API (Oficial y ultra confiable)
    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      title = navigator.mediaSession.metadata.title || '';
      artist = navigator.mediaSession.metadata.artist || '';
    }

    // 2. Selectores de ytmusic-player-bar
    if (!title) {
      const titleEl = document.querySelector('ytmusic-player-bar .title, ytmusic-player-bar yt-formatted-string.title');
      if (titleEl) title = titleEl.textContent.trim();
    }
    if (!artist) {
      const artistEl = document.querySelector('ytmusic-player-bar .byline, ytmusic-player-bar yt-formatted-string.byline');
      if (artistEl) artist = artistEl.textContent.trim();
    }

    // 3. Document Title
    if (!title && document.title) {
      const clean = document.title.replace(' - YouTube Music', '').replace(' | YouTube Music', '').trim();
      if (clean.includes(' - ')) {
        const p = clean.split(' - ');
        title = p[0].trim();
        artist = p[1] ? p[1].trim() : '';
      } else {
        title = clean;
      }
    }

    return { title, artist };
  }

  function checkCinemaTrackChange() {
    if (!isCinemaActive) return;

    const { title, artist } = getCurrentTrackInfo();
    const trackId = `${title}:::${artist}`;

    if (title && trackId !== lastCinemaTrackId) {
      lastCinemaTrackId = trackId;
      console.log('🔄 AuraMusic: Cambio de canción en vivo detectado:', trackId);
      updateCinemaTrack(title, artist);
    }
  }

  async function updateCinemaTrack(title, artist) {
    if (isUpdatingCinemaTrack) return;
    isUpdatingCinemaTrack = true;
    const curGen = ++cinemaTrackGen;

    try {
      const trackTitleEl = document.getElementById('cinema-track-title');
      const trackArtistEl = document.getElementById('cinema-track-artist');
      const artImg = document.getElementById('cinema-art-img');
      const wrapper = document.getElementById('cinema-lyrics-wrapper');
      const video = document.querySelector('video');

      if (trackTitleEl) trackTitleEl.textContent = title || 'Canción';
      if (trackArtistEl) trackArtistEl.textContent = artist || 'Artista';

      // Transición suave de portada
      const newCover = getHighResCoverUrl();
      if (artImg && newCover) {
        artImg.style.opacity = '0.3';
        artImg.style.transform = 'scale(0.96)';
        artImg.src = newCover;
        artImg.onload = () => {
          artImg.style.opacity = '1';
          artImg.style.transform = 'scale(1)';
          updateDynamicCoverColor(); // Actualiza colores dinámicos del fondo
        };
      }

      if (wrapper) {
        wrapper.innerHTML = '<div class="cinema-lyric-line active-line">Sincronizando letra...</div>';
      }

      const duration = video ? video.duration : 180;
      const lyrics = await fetchSyncedLyrics(title, artist, duration);

      // Descartar si cambió la canción mientras cargaba
      if (curGen !== cinemaTrackGen) return;

      if (isTranslationActive) {
        const targetLang = (navigator.language || 'es').split('-')[0].toLowerCase();
        currentLyrics = await translateLyrics(lyrics, targetLang);
      } else {
        currentLyrics = lyrics;
      }

      renderCinemaLyricsDOM();
    } catch (e) {
      console.error('Error actualizando track en modo cine:', e);
    } finally {
      isUpdatingCinemaTrack = false;
    }
  }

  async function openCinemaMode() {
    createCinemaOverlay();
    const overlay = document.getElementById('auramusic-cinema-overlay');
    if (!overlay) return;

    isCinemaActive = true;
    overlay.classList.add('active');
    lastCinemaTrackId = ''; // Forzar actualización

    checkCinemaTrackChange();
    startCinemaSyncLoop();
  }

  function closeCinemaMode() {
    const overlay = document.getElementById('auramusic-cinema-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    isCinemaActive = false;
  }

  function startCinemaSyncLoop() {
    let lastActiveIdx = -1;
    let frameCounter = 0;

    function sync() {
      if (!isCinemaActive) return;

      // Verificar cambio de canción cada 10 cuadros (tiempo real instantáneo)
      frameCounter++;
      if (frameCounter % 10 === 0) {
        checkCinemaTrackChange();
      }

      const video = document.querySelector('video');
      if (video) {
        const currentTime = video.currentTime;
        const duration = video.duration || 1;

        // Actualizar barra de progreso y tiempos
        const fill = document.getElementById('cinema-progress-fill');
        const curSpan = document.getElementById('cinema-current-time');
        const totSpan = document.getElementById('cinema-total-time');
        const playBtn = document.getElementById('cinema-play-btn');

        if (fill) fill.style.width = `${(currentTime / duration) * 100}%`;
        if (curSpan) curSpan.textContent = formatTime(currentTime);
        if (totSpan) totSpan.textContent = formatTime(duration);
        if (playBtn) playBtn.textContent = video.paused ? '▶' : '⏸';

        // Buscar línea activa de letra (-1 si es la intro instrumental)
        let activeIdx = -1;
        for (let i = 0; i < currentLyrics.length; i++) {
          if (currentTime >= currentLyrics[i].time) {
            activeIdx = i;
          } else {
            break;
          }
        }

        if (activeIdx !== lastActiveIdx) {
          lastActiveIdx = activeIdx;
          const allLines = document.querySelectorAll('.cinema-lyric-line');
          allLines.forEach((l, idx) => {
            if (idx === activeIdx) {
              l.classList.add('active-line');
              l.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              l.classList.remove('active-line');
              const words = l.querySelectorAll('.k-word');
              if (idx < activeIdx) {
                words.forEach(w => w.className = 'k-word sung');
              } else {
                words.forEach(w => w.className = 'k-word');
              }
            }
          });
        }

        // Actualización precisa palabra por palabra en tiempo real (60 FPS)
        if (activeIdx >= 0 && activeIdx < currentLyrics.length) {
          const activeLineEl = document.querySelector(`.cinema-lyric-line[data-index="${activeIdx}"]`);
          if (activeLineEl) {
            const words = activeLineEl.querySelectorAll('.k-word');
            words.forEach(w => {
              const start = parseFloat(w.dataset.start);
              const end = parseFloat(w.dataset.end);
              if (currentTime >= end) {
                w.className = 'k-word sung';
              } else if (currentTime >= start && currentTime < end) {
                w.className = 'k-word active';
              } else {
                w.className = 'k-word';
              }
            });
          }
        }
      }

      requestAnimationFrame(sync);
    }

    requestAnimationFrame(sync);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Inyectar el botón de "Letra Animada" en la pestaña LETRA de YouTube Music
  function checkAndInjectLyricsButton() {
    const lyricsTab = document.querySelector('ytmusic-tab-renderer[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"], #tabsContent ytmusic-tab-header-renderer:nth-child(2)');
    const lyricsShelf = document.querySelector('ytmusic-description-shelf-renderer');

    if (lyricsShelf && !document.getElementById('auramusic-cinema-trigger-btn')) {
      const btn = document.createElement('button');
      btn.id = 'auramusic-cinema-trigger-btn';
      btn.type = 'button';
      btn.innerHTML = `<span>✨</span> <span>Ver Letra Animada (Estilo Apple Music)</span>`;
      btn.addEventListener('click', openCinemaMode);

      lyricsShelf.parentNode.insertBefore(btn, lyricsShelf);
      console.log('🎤 AuraMusic: Botón de Letra Animada inyectado con éxito!');
    }
  }

  setInterval(checkAndInjectLyricsButton, 1500);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();

