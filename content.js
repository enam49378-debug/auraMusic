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
    crossfade: false,
    crossfadeDuration: 5, // 1 a 12 segundos
    crossfadeMode: 'real', // 'real' (Doble Reproductor Simultáneo) o 'fallback' (Fundido Secuencial)
    crossfadeCurve: 'equal-power', // 'equal-power', 'smoothstep', 'linear'
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
  let postEQTap = null;

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
    applyCrossfade(state.crossfade);
    updateUIControls();
  }

  const ALL_THEMES = [
    'auramusic-theme-jesuluto',
    'auramusic-theme-komi',
    'auramusic-theme-apple',
    'auramusic-theme-spotify',
    'auramusic-theme-whatsapp',
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

    // AISLAMIENTO ESTRICTO: Solo mostrar el escenario 3D en el tema Jesuluto
    const jStage = document.getElementById('jesuluto-3d-stage');
    const artBox = document.querySelector('.cinema-artwork-box');
    if (jStage) {
      jStage.style.setProperty('display', (themeName === 'jesuluto') ? 'flex' : 'none', 'important');
      if (themeName === 'jesuluto') {
        setTimeout(initJesuluto3D, 50);
      } else {
        if (typeof destroyJesuluto3D === 'function') destroyJesuluto3D();
      }
    } else {
      if (themeName !== 'jesuluto' && typeof destroyJesuluto3D === 'function') {
        destroyJesuluto3D();
      }
    }
    if (artBox) {
      artBox.style.setProperty('display', (themeName === 'jesuluto') ? 'none' : 'block');
    }
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
  // ==========================================================================
  // 🔀 MOTOR DE CROSSFADE PROFESIONAL AURA-PRO (MODO REAL DUAL + MODO FALLBACK)
  // ==========================================================================
  const XFADE_STATE = {
    IDLE: 'IDLE',
    PREPARING_NEXT: 'PREPARING_NEXT',
    CROSSFADE_READY: 'CROSSFADE_READY',
    CROSSFADE_ACTIVE: 'CROSSFADE_ACTIVE',
    NEXT_TRACK_ACTIVE: 'NEXT_TRACK_ACTIVE'
  };

  let _xfadeStatus = XFADE_STATE.IDLE;
  let _currentTrackCanonicalId = '';
  let _hasFadedOutThisTrack = false;
  let _isTransitioningToNext = false;
  let _isProgrammaticSkip = false;
  let _lastSkipTime = 0;
  let _pendingSeekTime = 0;

  // Shadow Player Controller (Player B)
  let shadowPlayerIframe = null;
  let shadowNextVideoId = '';
  let shadowIsReady = false;
  let shadowFadeInterval = null;
  let shadowMsgHandler = null;

  // 1. Identificador canónico e inmutable de la pista actual
  function _getCanonicalTrackKey() {
    const img = document.querySelector('ytmusic-player-bar .image, #song-image img');
    const title = document.querySelector('ytmusic-player-bar .title, .middle-controls .title');
    const src = img?.src || '';
    const text = title?.textContent?.trim() || '';
    if (!src && !text) return '';
    return `${src}||${text}`;
  }

  // Puente inyectado en el contexto principal para leer la cola de YouTube Music directamente
  function injectMainWorldBridge() {
    if (document.getElementById('auramusic-main-bridge')) return;
    const script = document.createElement('script');
    script.id = 'auramusic-main-bridge';
    script.textContent = `
      (function() {
        function scanQueue() {
          try {
            const page = document.querySelector('ytmusic-player-page') || document.querySelector('ytmusic-app');
            const pq = page?.playerQueue || document.querySelector('ytmusic-player-queue');
            const q = pq?.queue || page?.playerQueue?.queue;
            if (q && Array.isArray(q.items) && typeof q.selectedItemIndex === 'number') {
              const nextItem = q.items[q.selectedItemIndex + 1];
              const renderer = nextItem?.playlistPanelVideoRenderer || 
                               nextItem?.data?.playlistPanelVideoRenderer ||
                               nextItem?.data?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
              const vid = renderer?.videoId || nextItem?.videoId;
              if (vid && typeof vid === 'string' && vid.length === 11) {
                document.documentElement.dataset.auramusicNextVideoId = vid;
                return;
              }
            }
          } catch (e) {}

          try {
            const player = document.querySelector('#movie_player');
            if (player && typeof player.getPlaylist === 'function') {
              const list = player.getPlaylist();
              const idx = player.getPlaylistIndex();
              if (Array.isArray(list) && idx >= 0 && idx + 1 < list.length) {
                document.documentElement.dataset.auramusicNextVideoId = list[idx + 1];
                return;
              }
            }
          } catch (e) {}
        }
        setInterval(scanQueue, 400);
        scanQueue();
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
  }

  // 2. Extracción del ID de la siguiente canción de la cola de YouTube Music
  function getNextTrackVideoId() {
    // 0. ID directo obtenido desde el puente en el mundo principal de YouTube Music
    const fromBridge = document.documentElement.dataset.auramusicNextVideoId;
    if (fromBridge && typeof fromBridge === 'string' && fromBridge.length === 11) {
      return fromBridge;
    }

    // A. API oficial interna de YouTube (#movie_player)
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.getPlaylist === 'function' && typeof player.getPlaylistIndex === 'function') {
        const list = player.getPlaylist();
        const idx = player.getPlaylistIndex();
        if (Array.isArray(list) && idx >= 0 && idx + 1 < list.length) {
          const id = list[idx + 1];
          if (id && typeof id === 'string' && id.length === 11) return id;
        }
      }
    } catch (e) {}

    // B. Elemento siguiente en la cola visual de YouTube Music
    try {
      const currentQueueItem = document.querySelector('ytmusic-player-queue-item[play-button-state="playing"], ytmusic-player-queue-item.selected, ytmusic-player-queue-item[selected]');
      if (currentQueueItem && currentQueueItem.nextElementSibling) {
        const link = currentQueueItem.nextElementSibling.querySelector('a[href*="watch?v="]');
        if (link && link.href) {
          const m = link.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (m) return m[1];
        }
        const img = currentQueueItem.nextElementSibling.querySelector('img[src*="/vi/"]');
        if (img && img.src) {
          const m = img.src.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
          if (m) return m[1];
        }
      }
    } catch (e) {}

    // C. Búsqueda secuencial en los elementos de la cola del DOM
    try {
      const items = Array.from(document.querySelectorAll('ytmusic-player-queue-item, ytmusic-responsive-list-item-renderer, [role="listitem"]'));
      let curIndex = -1;
      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        if (el.hasAttribute('selected') || el.classList.contains('selected') || el.getAttribute('play-button-state') === 'playing' || el.querySelector('[aria-selected="true"]')) {
          curIndex = i;
          break;
        }
      }
      if (curIndex >= 0 && curIndex + 1 < items.length) {
        const nextItem = items[curIndex + 1];
        const link = nextItem.querySelector('a[href*="watch?v="]');
        if (link && link.href) {
          const m = link.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (m) return m[1];
        }
        const img = nextItem.querySelector('img[src*="/vi/"]');
        if (img && img.src) {
          const m = img.src.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
          if (m) return m[1];
        }
      }
    } catch (e) {}

    return null;
  }

  // 3. Funciones matemáticas para curvas de ganancia
  function calculateGainCurve(progress, curveType = 'equal-power') {
    const p = Math.max(0, Math.min(1, progress));
    if (curveType === 'equal-power') {
      // Curva Equal-Power (Spotify): suma de potencias = 1
      const gainA = Math.cos(p * 0.5 * Math.PI);
      const gainB = Math.sin(p * 0.5 * Math.PI);
      return { gainA, gainB };
    } else if (curveType === 'smoothstep') {
      // Curva en S sedosa: 3p^2 - 2p^3
      const s = p * p * (3 - 2 * p);
      return { gainA: 1 - s, gainB: s };
    } else {
      // Rampa lineal clásica
      return { gainA: 1 - p, gainB: p };
    }
  }

  // 4. Gestión del Shadow Player (Player B para solapamiento simultáneo real)
  function _sendShadowCommand(func, args = []) {
    if (!shadowPlayerIframe || !shadowPlayerIframe.contentWindow) return;
    try {
      shadowPlayerIframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: func,
        args: args
      }), '*');
    } catch (e) {}
  }

  function destroyShadowPlayer() {
    if (shadowFadeInterval) {
      clearInterval(shadowFadeInterval);
      shadowFadeInterval = null;
    }
    try {
      chrome.runtime.sendMessage({ target: 'offscreen', action: 'STOP_CROSSFADE' }).catch(() => {});
    } catch (e) {}

    shadowNextVideoId = '';
    shadowIsReady = false;
  }

  function cancelShadowCrossfade(reason = 'manual_reset') {
    destroyShadowPlayer();
    _xfadeStatus = XFADE_STATE.IDLE;
    _hasFadedOutThisTrack = false;
    _isTransitioningToNext = false;
    setPlayerVolume(1.0);
    console.log(`🔀 AuraMusic: Crossfade cancelado limpiamente (${reason}).`);
  }

  let _companionAudio = null;
  let _companionReady = false;
  let _currentPlayingTrackId = '';

  function prepareShadowPlayer(videoId) {
    if (shadowNextVideoId === videoId) return;
    destroyShadowPlayer();

    shadowNextVideoId = videoId;
    shadowIsReady = false;
    _xfadeStatus = XFADE_STATE.PREPARING_NEXT;

    // 1. Intentar pre-descarga ultrarrápida mediante el servidor companion (si está activo)
    try {
      fetch(`http://localhost:8080/prefetch?id=${videoId}`).then(res => {
        if (res.ok) return res.json();
      }).then(data => {
        if (data && data.status === 'ready' && data.url) {
          if (_companionAudio) {
            _companionAudio.pause();
            _companionAudio = null;
          }
          _companionAudio = new Audio(data.url);
          _companionAudio.volume = 0;
          _companionAudio.preload = 'auto';
          _companionReady = true;
          shadowIsReady = true;
          _xfadeStatus = XFADE_STATE.CROSSFADE_READY;
          console.log(`🔀 AuraMusic Companion: Audio real descargado y listo para crossfade: ${data.url}`);
        }
      }).catch(() => {
        _companionReady = false;
      });
    } catch (e) {
      _companionReady = false;
    }

    // 2. Preparar el motor Offscreen como respaldo
    try {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'PREPARE_TRACK',
        videoId: videoId
      }, (res) => {
        shadowIsReady = true;
        _xfadeStatus = XFADE_STATE.CROSSFADE_READY;
        console.log(`🔀 AuraMusic: Motor Offscreen preparado para Canción B ("${videoId}").`);
      });
    } catch (e) {
      shadowIsReady = true;
      _xfadeStatus = XFADE_STATE.CROSSFADE_READY;
    }
  }

  function startShadowCrossfade(fadeSec, forcedVideoId = null) {
    if (_xfadeStatus === XFADE_STATE.CROSSFADE_ACTIVE) return;
    _xfadeStatus = XFADE_STATE.CROSSFADE_ACTIVE;

    const targetId = forcedVideoId || shadowNextVideoId || getNextTrackVideoId();
    const previousTrackId = _currentPlayingTrackId;
    _currentPlayingTrackId = targetId;

    console.log(`🔀 AuraMusic: 🔥 SOLAPAMIENTO SIMULTÁNEO INICIADO (${fadeSec}s) con videoId "${targetId}".`);

    // Modo A: Si el companion server descargó el audio real, usarlo directamente
    if (_companionReady && _companionAudio) {
      console.log('🔀 AuraMusic: Usando audio real pre-descargado para solapamiento simultáneo!');
      _companionAudio.currentTime = 0;
      _companionAudio.volume = 0.0;
      _companionAudio.play().catch(() => {});
    } else {
      // Modo B: Motor Offscreen con permisos de extensión
      try {
        chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'START_CROSSFADE',
          videoId: targetId,
          duration: fadeSec
        }).catch(() => {});
      } catch (e) {}
    }

    // Fundido suave de Canción A en la página principal
    const startTime = performance.now();
    const durationMs = fadeSec * 1000;
    const curveType = state.crossfadeCurve || 'equal-power';

    if (shadowFadeInterval) clearInterval(shadowFadeInterval);
    shadowFadeInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const { gainA, gainB } = calculateGainCurve(progress, curveType);

      // Canción A desciende progresivamente en sus 3 capas de audio
      setPlayerVolume(gainA);

      // Si tenemos audio companion, sube progresivamente de 0% a 100%
      if (_companionReady && _companionAudio) {
        _companionAudio.volume = Math.max(0, Math.min(1, gainB));
      }

      if (progress >= 1) {
        clearInterval(shadowFadeInterval);
        shadowFadeInterval = null;
        _isTransitioningToNext = true;
        _lastSkipTime = performance.now();
        _pendingSeekTime = fadeSec; // Descontar los segundos de la intro en la Canción B

        console.log(`🔀 AuraMusic: Fin del solapamiento (${fadeSec}s). Verificando si YouTube Music ya cambió...`);

        // Comprobar si YouTube Music ya avanzó automáticamente a Canción B por haber terminado la Canción A
        const player = document.querySelector('#movie_player');
        const currentVideoId = player?.getVideoData?.()?.video_id || '';
        const currentKey = _getCanonicalTrackKey();

        const alreadyOnNext = (currentVideoId && currentVideoId === targetId) || (currentKey && currentKey !== previousTrackId);

        if (alreadyOnNext) {
          console.log(`🔀 AuraMusic: YouTube Music ya está en Canción B ("${targetId}"). ¡No se dispara salto adicional para no saltar a Canción C!`);
          const v = document.querySelector('video');
          if (v && isFinite(v.duration) && v.duration > fadeSec) {
            try {
              v.currentTime = fadeSec;
              console.log(`🔀 AuraMusic: Intro de Canción B descontado -> Sincronizado en ${fadeSec}s.`);
              _pendingSeekTime = 0;
            } catch (e) {}
          }
        } else {
          console.log(`🔀 AuraMusic: Forzando avance a Canción B ("${targetId}")...`);
          triggerNextTrack();
        }

        setTimeout(() => {
          setPlayerVolume(1.0);

          if (_companionAudio) {
            _companionAudio.pause();
            _companionAudio = null;
            _companionReady = false;
          }

          // Eliminar archivo de la canción anterior del disco para ahorrar espacio
          if (previousTrackId) {
            fetch(`http://localhost:8080/cleanup?id=${previousTrackId}`).catch(() => {});
          }

          destroyShadowPlayer();
          _xfadeStatus = XFADE_STATE.IDLE;
        }, 1200);
      }
    }, 30);
  }

  let _fadeInterval = null;

  let _lastUserVolume100 = 100;

  // Control universal de audio triple: movie_player (YTM nativo), video.volume (HTML5) y gainNode (Web Audio)
  function setPlayerVolume(volumeFactor) {
    const vf = Math.max(0, Math.min(1, volumeFactor));

    // 1. YouTube Music Player API interna (#movie_player)
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.setVolume === 'function') {
        if (!_hasFadedOutThisTrack && !_isTransitioningToNext && typeof player.getVolume === 'function') {
          const curV = player.getVolume();
          if (curV > 0) _lastUserVolume100 = curV;
        }
        player.setVolume(Math.round(vf * _lastUserVolume100));
      }
    } catch (e) {}

    // 2. Control directo en el elemento <video> de HTML5
    const video = document.querySelector('video');
    if (video) {
      try {
        video.volume = vf * (_lastUserVolume100 / 100);
      } catch (e) {}
    }

    // 3. Control en Web Audio GainNode
    if (gainNode && audioCtx && audioCtx.state !== 'closed') {
      try {
        const baseGain = Math.max(0, Math.min(3.0, (state.volumeBoost || 100) / 100));
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.setValueAtTime(vf * baseGain, audioCtx.currentTime);
      } catch (e) {}
    }
  }

  function restoreVideoFullGain(instant = false) {
    if (_fadeInterval) {
      clearInterval(_fadeInterval);
      _fadeInterval = null;
    }
    setPlayerVolume(1.0);
  }

  function triggerNextTrack() {
    _isTransitioningToNext = true;
    _isProgrammaticSkip = true;

    // 1. YouTube Music API nativa (#movie_player)
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.nextVideo === 'function') {
        player.nextVideo();
        console.log('🔀 AuraMusic: Siguiente canción disparada con movie_player.nextVideo()');
      }
    } catch (e) {}

    // 2. Click en botón nativo
    try {
      const nextBtn = document.querySelector('ytmusic-player-bar .next-button, #next-button');
      if (nextBtn) {
        nextBtn.click();
        console.log('🔀 AuraMusic: Siguiente canción disparada con nextBtn.click()');
      }
    } catch (e) {}

    setTimeout(() => { _isProgrammaticSkip = false; }, 1000);
  }

  // 5. Bucle maestro de detección y disparo de crossfade
  function handleCrossfadeCheck() {
    if (!state.crossfade) return;
    const video = document.querySelector('video');
    if (!video || !video.duration || isNaN(video.duration) || video.paused) return;

    if (!isAudioConnected) {
      initAudioEngine();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const dur = video.duration;
    const cur = video.currentTime;
    const fadeSec = Math.max(1, Math.min(12, state.crossfadeDuration || 5));
    const trackKey = _getCanonicalTrackKey();

    // Sincronización instantánea de intro descontado en Canción B tan pronto como arranca en 0:00
    if (_pendingSeekTime > 0 && cur < 2.0 && dur > _pendingSeekTime) {
      try {
        video.currentTime = _pendingSeekTime;
        console.log(`🔀 AuraMusic: Intro de Canción B descontado con éxito -> Sincronizado en ${_pendingSeekTime}s.`);
        _pendingSeekTime = 0;
      } catch (e) {}
    }

    // A. DETECCIÓN DE CAMBIO DE CANCIÓN
    if (trackKey && trackKey !== _currentTrackCanonicalId) {
      _currentTrackCanonicalId = trackKey;
      _hasFadedOutThisTrack = false;
      _xfadeStatus = XFADE_STATE.IDLE;

      if (_fadeInterval) {
        clearInterval(_fadeInterval);
        _fadeInterval = null;
      }

      // Aplicar descuento de tiempo exacto a la Canción B (avanzar los segundos del crossfade)
      if (_pendingSeekTime > 0) {
        const seekTarget = _pendingSeekTime;
        _pendingSeekTime = 0;
        setTimeout(() => {
          try {
            const v = document.querySelector('video');
            if (v && isFinite(v.duration) && v.duration > seekTarget) {
              v.currentTime = seekTarget;
              console.log(`🔀 AuraMusic: Intro de Canción B descontado con éxito -> Sincronizado en el segundo ${seekTarget}s.`);
            }
          } catch (e) {}
        }, 350);
      }

      if (_isTransitioningToNext) {
        _isTransitioningToNext = false;
        console.log(`🔀 AuraMusic: Canción B iniciada -> Iniciando Fade-In suave hacia el 100%...`);

        setPlayerVolume(0.15);

        const inStartTime = performance.now();
        const inDurationMs = Math.min(fadeSec, 3.0) * 1000;
        const inCurve = state.crossfadeCurve || 'equal-power';

        _fadeInterval = setInterval(() => {
          const elapsed = performance.now() - inStartTime;
          const progress = Math.min(1, elapsed / inDurationMs);
          const { gainB } = calculateGainCurve(progress, inCurve);
          setPlayerVolume(gainB);

          if (progress >= 1) {
            clearInterval(_fadeInterval);
            _fadeInterval = null;
            setPlayerVolume(1.0);
            console.log('🔀 AuraMusic: Fade-In completado. Volumen restaurado al 100%.');
          }
        }, 30);
      } else {
        // Reproducción manual: volumen 100% inmediato sin recortes
        setPlayerVolume(1.0);
        console.log('🔀 AuraMusic: Reproducción manual -> Volumen 100% inmediato.');
      }
      return;
    }

    if (dur < 3) return; // Pistas menores a 3s

    const rem = dur - cur;

    // B. PRE-CARGA Y PRE-CALENTAMIENTO DE LA CANCIÓN B (30s antes de terminar)
    // Esto precarga y pre-almacena los primeros 2-3 segundos de la canción B en memoria RAM para arranque instantáneo
    if (rem <= fadeSec + 30 && rem > fadeSec && _xfadeStatus === XFADE_STATE.IDLE) {
      const nextId = getNextTrackVideoId();
      if (nextId) {
        console.log(`🔀 AuraMusic: Precargando y pre-calentando Canción B ("${nextId}") en RAM...`);
        prepareShadowPlayer(nextId);
      }
    }

    // C. INICIO DEL SOLAPAMIENTO REAL O ADAPTATIVO (Al tocar rem <= fadeSec)
    if (rem <= fadeSec && rem > 0.15 && !_hasFadedOutThisTrack) {
      _hasFadedOutThisTrack = true;
      const effectiveFadeSec = Math.min(fadeSec, Math.max(1, Math.round(rem * 10) / 10));

      const nextId = shadowNextVideoId || getNextTrackVideoId();
      if (nextId) {
        startShadowCrossfade(effectiveFadeSec, nextId);
        return;
      }

      // Si no hay siguiente canción en la cola (fin de lista), ejecutar desvanecimiento suave de fin:
      console.log(`🔀 AuraMusic: 📉 Fin de lista -> Desvanecimiento suave (${effectiveFadeSec}s restantes)...`);
      if (_fadeInterval) clearInterval(_fadeInterval);
      const startTime = performance.now();
      const fadeDurationMs = effectiveFadeSec * 1000;
      const curve = state.crossfadeCurve || 'equal-power';

      _fadeInterval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / fadeDurationMs);
        const { gainA } = calculateGainCurve(progress, curve);
        setPlayerVolume(gainA);

        if (progress >= 1) {
          clearInterval(_fadeInterval);
          _fadeInterval = null;
        }
      }, 30);
    }

    // D. DISPARO DE LA SIGUIENTE PISTA (Desactivado si el Crossfade está activo para no saltar pistas)
    if (!state.crossfade && rem <= 1.0 && rem > 0.05 && !_isTransitioningToNext) {
      const now = performance.now();
      if (now - _lastSkipTime < 4000) return;
      _lastSkipTime = now;
      _isTransitioningToNext = true;
      triggerNextTrack();
    }
  }

  let _crossfadeWatchdogInterval = null;

  function setupCrossfadeListeners() {
    const video = document.querySelector('video');
    if (video) {
      video.removeEventListener('timeupdate', handleCrossfadeCheck);
      video.addEventListener('timeupdate', handleCrossfadeCheck);
    }

    // Intervalo continuo de 50ms: Nunca depende de listeners del DOM y se ejecuta con precisión
    if (!_crossfadeWatchdogInterval) {
      _crossfadeWatchdogInterval = setInterval(() => {
        if (state.crossfade) {
          handleCrossfadeCheck();
        }
      }, 50);
    }

    if (video._auramusicXfadeEventsBound) return;
    video._auramusicXfadeEventsBound = true;

    // Cuando el usuario adelanta o retrocede manualmente la barra:
    video.addEventListener('seeking', () => {
      if (_fadeInterval) {
        clearInterval(_fadeInterval);
        _fadeInterval = null;
      }
      destroyShadowPlayer();
      _xfadeStatus = XFADE_STATE.IDLE;
      _hasFadedOutThisTrack = false;
      _isTransitioningToNext = false;
      setPlayerVolume(1.0);
    });

    video.addEventListener('pause', () => {
      try {
        chrome.runtime.sendMessage({ target: 'offscreen', action: 'PAUSE' }).catch(() => {});
      } catch (e) {}
    });

    video.addEventListener('play', () => {
      if (!_isTransitioningToNext && !_hasFadedOutThisTrack) {
        setPlayerVolume(1.0);
      }
      if (_xfadeStatus === XFADE_STATE.CROSSFADE_ACTIVE) {
        try {
          chrome.runtime.sendMessage({ target: 'offscreen', action: 'PLAY' }).catch(() => {});
        } catch (e) {}
      }
    });
  }

  function _installManualActionListeners() {
    const playerBar = document.querySelector('ytmusic-player-bar');
    if (playerBar && !playerBar.dataset.xfadeBound) {
      playerBar.dataset.xfadeBound = 'true';
      playerBar.addEventListener('click', (e) => {
        if (_isProgrammaticSkip) return;

        const isProgressBar = e.target.closest('#progress-bar, .progress-bar, tp-yt-paper-slider');
        const isSkipBtn = e.target.closest('.next-button, .previous-button, #next-button, #previous-button');
        if (isProgressBar || isSkipBtn) {
          if (_fadeInterval) {
            clearInterval(_fadeInterval);
            _fadeInterval = null;
          }
          _hasFadedOutThisTrack = false;
          _isTransitioningToNext = false;
          setPlayerVolume(1.0);
        }
      });
    }
  }

  function applyCrossfade(enabled) {
    if (enabled) {
      initAudioEngine();
      setupCrossfadeListeners();
      _installManualActionListeners();
    } else {
      if (_fadeInterval) {
        clearInterval(_fadeInterval);
        _fadeInterval = null;
      }
      _hasFadedOutThisTrack = false;
      _isTransitioningToNext = false;
      setPlayerVolume(1.0);
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

      // Tap POST-EQ: punto de derivación para el grabador de Crossfade (Ghost Tail).
      // Así el buffer PCM graba audio YA ecualizado, no audio crudo del <video>.
      // El gain=1.0 no altera la señal en absoluto (unity gain).
      postEQTap = audioCtx.createGain();
      postEQTap.gain.setValueAtTime(1.0, audioCtx.currentTime);
      lastNode.connect(postEQTap);
      postEQTap.connect(gainNode);

      gainNode.connect(analyser);
      analyser.connect(audioCtx.destination);

      isAudioConnected = true;
      console.log('✅ AuraMusic: Motor Web Audio API conectado con éxito.');
    } catch (e) {
      console.warn('AuraMusic: AudioContext en modo seguro.', e);
    }
  }

  // Desbloquear y conectar AudioContext en cualquier interacción del usuario
  function _tryConnectAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (!isAudioConnected) {
      initAudioEngine();
    }
  }

  ['click', 'keydown', 'pointerdown'].forEach((evt) => {
    window.addEventListener(evt, _tryConnectAudio, { passive: true });
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
    if (!canvas) canvas = document.getElementById('auramusic-vis-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (state.visualizer === 'off') {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (animFrameId) return; // Evitar bucles concurrentes

    const dataArray = new Uint8Array(64);
    let lastRenderTime = 0;

    function render(now) {
      // 0% CPU cuando el visualizador está apagado o la pestaña está oculta
      if (state.visualizer === 'off' || document.hidden) {
        if (animFrameId) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      animFrameId = requestAnimationFrame(render);

      // Limitar a 30 FPS para máximo ahorro de CPU/GPU
      const curTime = now || performance.now();
      if (curTime - lastRenderTime < 33) return;
      lastRenderTime = curTime;

      if (analyser && isAudioConnected) {
        analyser.getByteFrequencyData(dataArray);
      } else {
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

  // Suspender loops cuando la pestaña se minimiza para liberar memoria RAM
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    } else {
      if (state.visualizer !== 'off') {
        startVisualizerLoop();
      }
    }
  });

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

  // --- 7. GUARDIÁN ANTI-DISTRACCIONES Y ANUNCIOS (Se ejecuta en el bucle maestro)
  function runCleanWatchdog() {
    if (!state.cleanMode) return;
    const confirmBtn = document.querySelector('ytmusic-you-there-renderer #confirm-button, #confirm-button.yt-button-renderer');
    if (confirmBtn && confirmBtn.offsetParent !== null) {
      confirmBtn.click();
    }
    const dismissBtn = document.querySelector('ytmusic-mealbar-promo-renderer #dismiss-button');
    if (dismissBtn && dismissBtn.offsetParent !== null) {
      dismissBtn.click();
    }
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

            <!-- TRANSICIÓN ENTRE CANCIONES (CROSSFADE / CROSSOVER) -->
            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🔀 Transición entre Canciones (Crossfade)</span>
                  <span class="auramusic-sublabel">Transición suave de volumen sin silencios entre el fin de una pista y el inicio de la siguiente.</span>
                </div>
                <label class="auramusic-switch">
                  <input type="checkbox" id="toggle-crossfade" ${state.crossfade ? 'checked' : ''}>
                  <span class="auramusic-slider"></span>
                </label>
              </div>
              <div id="crossfade-slider-container" style="display: ${state.crossfade ? 'block' : 'none'}; margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06);">
                <div class="auramusic-row" style="margin-bottom: 6px;">
                  <span class="auramusic-sublabel">Duración del solapamiento</span>
                  <span id="crossfade-duration-val" style="font-weight:700; color:var(--auramusic-primary);">${state.crossfadeDuration || 5}s</span>
                </div>
                <input type="range" class="auramusic-range" id="crossfade-duration-slider" min="1" max="12" step="1" value="${state.crossfadeDuration || 5}">

                <div style="margin-top: 12px;">
                  <div class="auramusic-row" style="margin-bottom: 4px;">
                    <span class="auramusic-sublabel">Modo de Transición</span>
                  </div>
                  <select class="auramusic-select" id="crossfade-mode-select">
                    <option value="real" ${state.crossfadeMode === 'real' ? 'selected' : ''}>🔥 Modo Real (Doble Reproductor Simultáneo)</option>
                    <option value="fallback" ${state.crossfadeMode === 'fallback' ? 'selected' : ''}>⏳ Modo Fallback (Fundido Secuencial)</option>
                  </select>
                </div>

                <div style="margin-top: 10px;">
                  <div class="auramusic-row" style="margin-bottom: 4px;">
                    <span class="auramusic-sublabel">Curva de Ganancia Sonora</span>
                  </div>
                  <select class="auramusic-select" id="crossfade-curve-select">
                    <option value="equal-power" ${state.crossfadeCurve === 'equal-power' ? 'selected' : ''}>Equal Power (Spotify - Recomendada)</option>
                    <option value="smoothstep" ${state.crossfadeCurve === 'smoothstep' ? 'selected' : ''}>Smoothstep (Curva en S sedosa)</option>
                    <option value="linear" ${state.crossfadeCurve === 'linear' ? 'selected' : ''}>Lineal</option>
                  </select>
                </div>
              </div>
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

    function openHub() {
      overlay.classList.add('active');
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
        openCinemaMode();
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

    // Toggle Crossfade y Slider
    const toggleCrossfade = document.getElementById('toggle-crossfade');
    const crossfadeContainer = document.getElementById('crossfade-slider-container');
    const crossfadeSlider = document.getElementById('crossfade-duration-slider');
    const crossfadeVal = document.getElementById('crossfade-duration-val');
    const crossfadeModeSelect = document.getElementById('crossfade-mode-select');
    const crossfadeCurveSelect = document.getElementById('crossfade-curve-select');

    if (toggleCrossfade) {
      toggleCrossfade.addEventListener('change', (e) => {
        state.crossfade = e.target.checked;
        if (crossfadeContainer) {
          crossfadeContainer.style.display = state.crossfade ? 'block' : 'none';
        }
        applyCrossfade(state.crossfade);
        saveSettings();
      });
    }

    if (crossfadeSlider) {
      crossfadeSlider.addEventListener('input', (e) => {
        state.crossfadeDuration = parseInt(e.target.value, 10) || 5;
        if (crossfadeVal) crossfadeVal.textContent = `${state.crossfadeDuration}s`;
        saveSettings();
      });
    }

    if (crossfadeModeSelect) {
      crossfadeModeSelect.addEventListener('change', (e) => {
        state.crossfadeMode = e.target.value || 'real';
        saveSettings();
        console.log(`🔀 AuraMusic: Modo de Crossfade cambiado a "${state.crossfadeMode}".`);
      });
    }

    if (crossfadeCurveSelect) {
      crossfadeCurveSelect.addEventListener('change', (e) => {
        state.crossfadeCurve = e.target.value || 'equal-power';
        saveSettings();
        console.log(`🔀 AuraMusic: Curva de Crossfade cambiada a "${state.crossfadeCurve}".`);
      });
    }

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

    // Sincronizar Crossfade
    const toggleCrossfade = document.getElementById('toggle-crossfade');
    const crossfadeContainer = document.getElementById('crossfade-slider-container');
    const crossfadeSlider = document.getElementById('crossfade-duration-slider');
    const crossfadeVal = document.getElementById('crossfade-duration-val');
    const crossfadeModeSelect = document.getElementById('crossfade-mode-select');
    const crossfadeCurveSelect = document.getElementById('crossfade-curve-select');

    if (toggleCrossfade) toggleCrossfade.checked = !!state.crossfade;
    if (crossfadeContainer) crossfadeContainer.style.display = state.crossfade ? 'block' : 'none';
    if (crossfadeSlider) crossfadeSlider.value = state.crossfadeDuration || 5;
    if (crossfadeVal) crossfadeVal.textContent = `${state.crossfadeDuration || 5}s`;
    if (crossfadeModeSelect) crossfadeModeSelect.value = state.crossfadeMode || 'real';
    if (crossfadeCurveSelect) crossfadeCurveSelect.value = state.crossfadeCurve || 'equal-power';
  }

  // --- 9. INICIALIZACIÓN GLOBAL CUANDO EL DOM ESTÉ LISTO ---
  function init() {
    loadSettings();
    injectMainWorldBridge();
    injectLauncherAndHub();
    initAmbientGlowElements();
    initVisualizerElements();
    // initCleanWatchdog integrado en bucle maestro

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

    // BUCLE MAESTRO UNIFICADO (2500ms, 0% CPU si la pestaña no está visible)
    setInterval(() => {
      if (document.hidden) return; // Si la pestaña está oculta, 0% CPU!

      onGlobalSongChange();
      runCleanWatchdog();
      checkAndInjectLyricsButton();
      setupCrossfadeListeners();

      if (state.theme === 'spotify' || document.getElementById('auramusic-spotify-logo')) {
        updateSpotifyBrandElements();
      }
    }, 2500);
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

  function isValidTranslationText(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    if (lower.includes('query length limit exceeded')) return false;
    if (lower.includes('mymemory warning')) return false;
    if (lower.includes('please select two distinct languages')) return false;
    if (lower.includes('invalid request')) return false;
    if (lower.includes('error:')) return false;
    return true;
  }

  async function translateSingleLine(text, targetLang = 'es') {
    try {
      const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${targetLang}&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) return { text, isDifferent: false };
      const data = await res.json();
      const trans = data[0][0];
      const lang = (data[0][1] || '').toLowerCase();
      const isDiff = isValidTranslationText(trans) && trans.toLowerCase() !== text.toLowerCase() && lang !== targetLang;
      return { text: trans, isDifferent: isDiff };
    } catch (e) {
      return { text, isDifferent: false };
    }
  }

  // MOTOR INTELIGENTE DE DOS PASOS: Traduce en bloque y aísla frases en otro idioma (ej. "We're just having fun")
  async function translateLyrics(lyrics, targetLang = 'es') {
    if (!lyrics || lyrics.length === 0) return lyrics;
    const cacheKey = `${lastCinemaTrackId}:::${targetLang}`;
    if (lyricsTranslationCache[cacheKey]) {
      return lyricsTranslationCache[cacheKey];
    }

    try {
      const allText = lyrics.map(l => l.text).join('\n');
      const googleUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${targetLang}&q=${encodeURIComponent(allText)}`;

      let batchLines = [];
      try {
        const res = await fetch(googleUrl);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data[0] && typeof data[0][0] === 'string') {
            batchLines = data[0][0].split('\n');
          }
        }
      } catch (e) {}

      // Paso 2: Verificar líneas individualmente si la canción es mixta (frases en inglés dentro de temas en español)
      const translatedList = await Promise.all(lyrics.map(async (item, idx) => {
        const batchTrans = (batchLines[idx] || '').trim();
        const isBatchDiff = isValidTranslationText(batchTrans) && batchTrans.toLowerCase() !== item.text.toLowerCase();

        if (isBatchDiff) {
          return {
            ...item,
            translatedText: batchTrans,
            originalText: item.text
          };
        }

        // Si el lote general no la cambió (porque la canción es mayormente en español), aislar esta frase
        const single = await translateSingleLine(item.text, targetLang);
        return {
          ...item,
          translatedText: single.isDifferent ? single.text : null,
          originalText: item.text
        };
      }));

      lyricsTranslationCache[cacheKey] = translatedList;
      console.log('✅ AuraMusic: Traducción inteligente completada verso por verso.');
      return translatedList;
    } catch (err) {
      console.warn('Google Translate no disponible, usando motor de respaldo seguro...', err);
      return await fallbackTranslateLyrics(lyrics, targetLang, cacheKey);
    }
  }

  // MOTOR SECUNDARIO: Particionado MyMemory con validación
  async function fallbackTranslateLyrics(lyrics, targetLang, cacheKey) {
    try {
      const chunks = [];
      let curChunk = [];
      let curLen = 0;

      lyrics.forEach(item => {
        const len = item.text.length + 1;
        if (curLen + len > 280 && curChunk.length > 0) {
          chunks.push(curChunk);
          curChunk = [item];
          curLen = len;
        } else {
          curChunk.push(item);
          curLen += len;
        }
      });
      if (curChunk.length > 0) chunks.push(curChunk);

      const translatedList = [];
      for (const chunk of chunks) {
        const textToTranslate = chunk.map(l => l.text).join('\n');
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=autodetect|${targetLang}`;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error('Fetch error');
          const data = await res.json();
          const rawTrans = data.responseData?.translatedText || '';

          if (isValidTranslationText(rawTrans)) {
            const transLines = rawTrans.split('\n');
            chunk.forEach((item, cIdx) => {
              const trans = (transLines[cIdx] || '').trim();
              const isDiff = isValidTranslationText(trans) && trans.toLowerCase() !== item.text.toLowerCase();
              translatedList.push({
                ...item,
                translatedText: isDiff ? trans : null,
                originalText: item.text
              });
            });
          } else {
            chunk.forEach(item => translatedList.push({ ...item, translatedText: null, originalText: item.text }));
          }
        } catch (e) {
          chunk.forEach(item => translatedList.push({ ...item, translatedText: null, originalText: item.text }));
        }
      }
      lyricsTranslationCache[cacheKey] = translatedList;
      return translatedList;
    } catch (e) {
      return lyrics.map(l => ({ ...l, translatedText: null, originalText: l.text }));
    }
  }

  function renderCinemaLyricsDOM() {
    const wrapper = document.getElementById('cinema-lyrics-wrapper');
    const video = document.querySelector('video');
    if (!wrapper) return;

    wrapper.innerHTML = '';

    if (!currentLyrics || currentLyrics.length === 0) {
      if (state.theme === 'whatsapp') {
        wrapper.innerHTML = `
          <div class="whatsapp-encryption-badge">
            <span>🔒 Los mensajes y llamadas están cifrados de extremo a extremo.</span>
          </div>
          <div class="cinema-lyric-line wa-sent active-line">
            🎵 Letra no disponible o tema instrumental
            <div class="whatsapp-msg-meta"><span class="whatsapp-time">0:00</span> <span class="whatsapp-checks">✓✓</span></div>
          </div>
        `;
      } else {
        wrapper.innerHTML = '<div class="cinema-lyric-line active-line">🎵 Letra no disponible para esta canción</div>';
      }
      return;
    }

    if (state.theme === 'whatsapp') {
      const encBadge = document.createElement('div');
      encBadge.className = 'whatsapp-encryption-badge';
      encBadge.innerHTML = '<span>🔒 Los mensajes y llamadas están cifrados de extremo a extremo. Nadie fuera de este chat, ni siquiera WhatsApp, puede leerlos ni escucharlos.</span>';
      wrapper.appendChild(encBadge);
    }

    const itemsToRender = currentLyrics;

    itemsToRender.forEach((item, index) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'cinema-lyric-line';
      lineDiv.dataset.time = item.time;
      lineDiv.dataset.index = index;

      const hasTranslation = isTranslationActive && item.translatedText;
      const displayText = hasTranslation ? item.translatedText : (item.originalText || item.text);

      const nextItem = itemsToRender[index + 1];
      const rawDuration = nextItem ? (nextItem.time - item.time) : 3.5;
      const words = displayText.trim().split(/\s+/).filter(w => w.length > 0);

      const wordCount = words.length;
      const wordsPerSec = wordCount / Math.max(0.6, rawDuration);

      let totalDuration;
      if (rawDuration > 7.0) {
        totalDuration = Math.min(rawDuration * 0.65, Math.max(2.5, wordCount * 0.45));
      } else {
        if (wordsPerSec >= 2.2) {
          totalDuration = Math.min(rawDuration, wordCount * 0.32);
        } else if (wordsPerSec <= 1.2) {
          totalDuration = Math.max(0.8, rawDuration * 0.92);
        } else {
          totalDuration = Math.max(0.8, rawDuration * 0.88);
        }
      }

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

      if (hasTranslation) {
        const subDiv = document.createElement('div');
        subDiv.className = 'line-original-sub';
        subDiv.textContent = `(${item.originalText})`;
        lineDiv.appendChild(subDiv);
      }

      // STICKER DE EXPRESIÓN CONTEXTUAL PARA EL CUADERNO DE KOMI-SAN 🌸💖
      if (state.theme === 'komi') {
        const loveRegex = /\b(amor|love|coraz[oó]n|quiero|quiera|quiso|amo|enamorad[oa]|beso|quererte|amarte|cariño|abrazo|sentir|sentimiento|tatuaje|tattoo|mente|fr[aá]gil|labios|vida|ciel[oa])\b/i;
        if (loveRegex.test(displayText)) {
          const sticker = document.createElement('div');
          sticker.className = 'komi-inline-sticker komi-sticker-love';
          const stickerUrl = chrome.runtime?.getURL('assets/komi_sticker_love.png') || 'assets/komi_sticker_love.png';
          sticker.innerHTML = `<img src="${stickerUrl}" alt="Komi Amor Sticker">`;
          lineDiv.appendChild(sticker);
        }
      }

      // Metadatos de mensaje EXCLUSIVOS para WhatsApp (NUNCA en otros temas)
      if (state.theme === 'whatsapp') {
        const metaSpan = document.createElement('div');
        metaSpan.className = 'whatsapp-msg-meta';
        const m = Math.floor(item.time / 60);
        const s = Math.floor(item.time % 60);
        const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        metaSpan.innerHTML = `<span class="whatsapp-time">${timeStr}</span> <span class="whatsapp-checks">✓✓</span>`;
        lineDiv.appendChild(metaSpan);
      }

      lineDiv.addEventListener('click', () => {
        if (video) video.currentTime = item.time;
      });

      wrapper.appendChild(lineDiv);
    });

    if (state.theme === 'whatsapp') {
      const typingBubble = document.createElement('div');
      typingBubble.id = 'whatsapp-typing-bubble';
      typingBubble.className = 'wa-typing-bubble';
      typingBubble.style.display = 'none';
      typingBubble.innerHTML = '<span class="wa-typing-text">escribiendo</span><span class="wa-dot"></span><span class="wa-dot"></span><span class="wa-dot"></span>';
      wrapper.appendChild(typingBubble);
    }
  }

  function createCinemaOverlay() {
    if (document.getElementById('auramusic-cinema-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'auramusic-cinema-overlay';
    overlay.innerHTML = `
      <div class="cinema-mesh-bg"></div>

      <!-- Cabecera Superior: Adaptativa a WhatsApp o Estándar -->
      <div class="cinema-top-bar">
        <div id="cinema-top-left-info">
          <img id="cinema-top-art-img" src="" alt="Cover" class="whatsapp-top-avatar" style="display:none;">
          <div class="whatsapp-top-text" id="whatsapp-top-text" style="display:none;">
            <div class="whatsapp-top-title" id="whatsapp-top-title">Canción</div>
            <div class="whatsapp-top-status"><span class="wa-online-dot"></span> en línea</div>
          </div>
        </div>

        <!-- Controles de Reproducción Integrados en la Cabecera de WhatsApp -->
        <div id="whatsapp-top-controls" style="display:none;">
          <button type="button" class="cinema-ctrl-btn" id="cinema-wa-prev-btn" title="Anterior">⏮</button>
          <button type="button" class="cinema-play-btn" id="cinema-wa-play-btn" title="Reproducir / Pausar">▶</button>
          <button type="button" class="cinema-ctrl-btn" id="cinema-wa-next-btn" title="Siguiente">⏭</button>
          <div class="whatsapp-time-pill" id="cinema-wa-time">0:00 / 0:00</div>
        </div>

        <div class="cinema-top-actions" style="display: flex; align-items: center; gap: 10px;">
          <button type="button" class="cinema-icon-btn whatsapp-action-icon" style="display:none;" title="Videollamada">📹</button>
          <button type="button" class="cinema-icon-btn whatsapp-action-icon" style="display:none;" title="Llamada">📞</button>
          <button type="button" class="cinema-icon-btn" id="cinema-translate-btn" title="Traducir letra (🌐)">🌐</button>
          <button type="button" class="cinema-icon-btn cinema-close-btn" id="cinema-close-btn" title="Cerrar (✕)">✕</button>
        </div>
      </div>

      <div class="cinema-content-grid">
        <!-- Columna Izquierda: Portada estándar O Lista de Chats de WhatsApp (Cola de siguientes canciones) -->
        <div class="cinema-left">
          <!-- Modo estándar (Apple, Spotify, Minecraft, etc.) -->
          <div class="cinema-standard-left">
            <div class="cinema-artwork-box">
              <img id="cinema-art-img" src="" alt="Portada">
            </div>
            <div id="jesuluto-3d-stage" class="jesuluto-3d-stage" style="display: none;"><div class="jesuluto-stage-pedestal"></div></div>
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

          <!-- Modo WhatsApp: Lista de Chats con Siguientes Canciones -->
          <div id="whatsapp-chatlist-panel" style="display:none;">
            <div class="whatsapp-sidebar-header">
              <div class="whatsapp-sidebar-user">
                <img id="whatsapp-user-avatar" src="" alt="Avatar" class="wa-round-avatar">
                <span style="font-weight: 700; font-size: 1.1rem; color:#e9edef;">Chats</span>
              </div>
              <div class="whatsapp-sidebar-icons">
                <span title="Estados">⭕</span>
                <span title="Nuevo chat">💬</span>
                <span title="Menú">⋮</span>
              </div>
            </div>

            <div class="whatsapp-search-bar-box">
              <div class="whatsapp-search-inner">
                <span>🔍</span>
                <span>Buscar un chat o iniciar uno nuevo</span>
              </div>
            </div>

            <div class="whatsapp-filter-pills">
              <span class="wa-pill active">Todos</span>
              <span class="wa-pill">Siguientes</span>
              <span class="wa-pill">Favoritos</span>
            </div>

            <!-- Lista de Canciones en la Cola de WhatsApp -->
            <div class="whatsapp-songs-queue-list" id="whatsapp-songs-queue-list">
              <!-- Se puebla dinámicamente -->
            </div>
          </div>
        </div>

        <!-- Columna Derecha: Letras Cinematográficas (Chat con Burbujas a la Derecha) -->
        <div class="cinema-right" id="cinema-right-scroll">
          <div class="cinema-lyrics-wrapper" id="cinema-lyrics-wrapper">
            <div class="cinema-lyric-line active-line">Cargando letra sincronizada...</div>
          </div>

          <!-- Barra de Entrada Inferior de WhatsApp -->
          <div class="cinema-whatsapp-input-bar">
            <span style="font-size: 1.3rem; cursor: pointer;" title="Emojis">😊</span>
            <span style="font-size: 1.3rem; cursor: pointer;" title="Adjuntar">📎</span>
            <div class="whatsapp-input-box">
              <span id="whatsapp-live-typing-preview">Escribe un mensaje</span>
              <span style="animation: blink 1s infinite;">|</span>
            </div>
            <span style="font-size: 1.4rem; color: #00a884; cursor: pointer;" title="Nota de voz">🎙️</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Eventos del Overlay
    const closeBtn = document.getElementById('cinema-close-btn');
    closeBtn.addEventListener('click', closeCinemaMode);

    const translateBtn = document.getElementById('cinema-translate-btn');

    translateBtn.addEventListener('click', async () => {
      isTranslationActive = !isTranslationActive;
      translateBtn.classList.toggle('active', isTranslationActive);

      if (isTranslationActive) {
        translateBtn.style.opacity = '0.5';
        const targetLang = (navigator.language || 'es').split('-')[0].toLowerCase();
        currentLyrics = await translateLyrics(currentLyrics, targetLang);
        translateBtn.style.opacity = '1';
      }

      renderCinemaLyricsDOM();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isCinemaActive) {
        closeCinemaMode();
      }
    });

    // Controles dentro del modo cine (estándar y WhatsApp)
    const playBtn = document.getElementById('cinema-play-btn');
    const prevBtn = document.getElementById('cinema-prev-btn');
    const nextBtn = document.getElementById('cinema-next-btn');
    const waPlayBtn = document.getElementById('cinema-wa-play-btn');
    const waPrevBtn = document.getElementById('cinema-wa-prev-btn');
    const waNextBtn = document.getElementById('cinema-wa-next-btn');

    function togglePlayback() {
      const nativePlay = document.querySelector('ytmusic-player-bar .play-pause-button, #play-pause-button');
      if (nativePlay) {
        nativePlay.click();
      } else {
        const video = document.querySelector('video');
        if (video) {
          if (video.paused) video.play();
          else video.pause();
        }
      }
    }

    function triggerQuickTrackPoll() {
      let count = 0;
      const intId = setInterval(() => {
        checkCinemaTrackChange();
        count++;
        if (count > 15) clearInterval(intId);
      }, 250);
    }

    function playPrevTrack() {
      const nativePrev = document.querySelector('ytmusic-player-bar .previous-button, #previous-button');
      if (nativePrev) nativePrev.click();
      triggerQuickTrackPoll();
    }

    function playNextTrack() {
      const nativeNext = document.querySelector('ytmusic-player-bar .next-button, #next-button');
      if (nativeNext) nativeNext.click();
      triggerQuickTrackPoll();
    }

    if (playBtn) playBtn.addEventListener('click', togglePlayback);
    if (prevBtn) prevBtn.addEventListener('click', playPrevTrack);
    if (nextBtn) nextBtn.addEventListener('click', playNextTrack);

    if (waPlayBtn) waPlayBtn.addEventListener('click', togglePlayback);
    if (waPrevBtn) waPrevBtn.addEventListener('click', playPrevTrack);
    if (waNextBtn) waNextBtn.addEventListener('click', playNextTrack);

    // Salto en la barra de tiempo
    const progressBg = document.getElementById('cinema-progress-bg');
    progressBg.addEventListener('mousedown', (e) => {
      cinemaSeekLockUntil = Date.now() + 250;
      cinemaLastStablePct = -1;
      const video = document.querySelector('video');
      if (!video || !video.duration || !isFinite(video.duration)) return;
      const rect = progressBg.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const t = pct * video.duration;
      video.currentTime = t;
      const fill = document.getElementById('cinema-progress-fill');
      if (fill) {
        fill.style.transition = 'none !important';
        fill.style.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
      }
    });
    progressBg.addEventListener('click', (e) => {
      cinemaSeekLockUntil = Date.now() + 200;
      cinemaLastStablePct = -1;
      const video = document.querySelector('video');
      if (!video || !video.duration || !isFinite(video.duration)) return;
      const rect = progressBg.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const t = pct * video.duration;
      video.currentTime = t;
      const fill = document.getElementById('cinema-progress-fill');
      if (fill) {
        fill.style.transition = 'none !important';
        fill.style.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
        void fill.offsetHeight;
      }
    });
  }

  let lastCinemaTrackId = '';
  let isUpdatingCinemaTrack = false;
  let cinemaTrackGen = 0;
  let lastCinemaActiveIdx = -1;
  let pendingCinemaTrackUpdate = null;
  let cinemaGraceUntil = 0;
  let cinemaSeekLockUntil = 0;
  let cinemaLastStablePct = -1;
  let cinemaLastStableTime = -1;
  let preloadLyricsCache = {};
  let preloadTriggeredForTrackId = '';
  let preloadNextTrackId = '';

  function makeLyricsCacheKey(title, artist, duration) {
    const t = (title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const a = (artist || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const d = Math.round(duration || 0);
    return `${t}:::${a}:::${d}`;
  }

  function getPredictedNextTrack() {
    try {
      const queueItems = document.querySelectorAll('ytmusic-player-queue-item, .queue-item, [role="listitem"] ytmusic-responsive-list-item-renderer, .middle-controls yt-formatted-string');
      let nextTitle = '';
      let nextArtist = '';
      for (const el of queueItems) {
        try {
          const titleEl = el.querySelector('.title, .flex-column yt-formatted-string:first-child, .song-title');
          const artistEl = el.querySelector('.byline, .flex-column yt-formatted-string:last-child, .artist-name, .secondary-flex-columns');
          if (titleEl) {
            const tx = titleEl.textContent.trim();
            if (tx && tx.length > 1) {
              const curArtist = (navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.artist) ? navigator.mediaSession.metadata.artist.trim() : '';
              const curTitle = (navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.title) ? navigator.mediaSession.metadata.title.trim() : '';
              const localCurTitle = document.querySelector('ytmusic-player-bar .title, ytmusic-player-bar yt-formatted-string.title');
              const localCurArtist = document.querySelector('ytmusic-player-bar .byline, ytmusic-player-bar yt-formatted-string.byline');
              const actTitle = (curTitle || (localCurTitle ? localCurTitle.textContent.trim() : '')).toLowerCase();
              const actArtist = (curArtist || (localCurArtist ? localCurArtist.textContent.trim() : '')).toLowerCase();
              if (tx.toLowerCase() !== actTitle && tx.toLowerCase().replace(/\s+/g, '') !== actTitle.replace(/\s+/g, '')) {
                nextTitle = tx;
                if (artistEl) {
                  let at = artistEl.textContent.trim();
                  const splitIdx = at.indexOf('•');
                  if (splitIdx > 0) at = at.slice(0, splitIdx).trim();
                  nextArtist = at;
                }
                return { title: nextTitle, artist: nextArtist };
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  async function preloadNextTrackLyricsIfNearEnd() {
    if (!isCinemaActive) return;
    const video = document.querySelector('video');
    if (!video || !isFinite(video.duration) || video.duration <= 0 || isNaN(video.currentTime)) return;
    const timeLeft = video.duration - video.currentTime;
    const currentDuration = video.duration;
    const curTrackKey = lastCinemaTrackId;
    if (!curTrackKey) return;

    const video2 = document.querySelector('video');
    const curTitle = (navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.title) || (document.querySelector('ytmusic-player-bar .title, ytmusic-player-bar yt-formatted-string.title')?.textContent?.trim());
    const curArtist = (navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.artist) || (document.querySelector('ytmusic-player-bar .byline, ytmusic-player-bar yt-formatted-string.byline')?.textContent?.trim());
    if (!curTitle) return;

    if (timeLeft <= 12 && preloadTriggeredForTrackId !== curTrackKey) {
      const pred = getPredictedNextTrack();
      if (!pred || !pred.title) return;
      preloadTriggeredForTrackId = curTrackKey;
      const nextTrackKey = `${pred.title}:::${pred.artist || ''}`;
      preloadNextTrackId = nextTrackKey;
      const cacheKey = makeLyricsCacheKey(pred.title, pred.artist || '', Math.max(0, currentDuration));
      if (preloadLyricsCache[cacheKey]) {
        console.log('⚡ AuraMusic: Letra siguiente canción YA está en cache (hotload!):', nextTrackKey);
        return;
      }
      console.log('🔮 AuraMusic: PRELOADING letra canción SIGUIENTE en background (faltan ~12s):', nextTrackKey);
      try {
        const estDuration = Math.max(120, Math.round(currentDuration));
        const lyr = await fetchSyncedLyrics(pred.title, pred.artist || '', estDuration);
        preloadLyricsCache[cacheKey] = { lyrics: lyr, fetchedAt: Date.now() };
        console.log('✅ AuraMusic: LETRA PRECARGADA lista!:', nextTrackKey);
      } catch (e) {
        console.warn('AuraMusic: Falló preload de letra, nada grave...', e);
      }
    }
  }

  function resetCinemaProgressImmediate() {
    const fill = document.getElementById('cinema-progress-fill');
    const curSpan = document.getElementById('cinema-current-time');
    const totSpan = document.getElementById('cinema-total-time');
    const waTimePill = document.getElementById('cinema-wa-time');

    cinemaGraceUntil = Date.now() + 500;
    cinemaSeekLockUntil = 0;
    cinemaLastStablePct = -1;
    cinemaLastStableTime = -1;

    if (fill) {
      fill.style.transition = 'none !important';
      fill.style.width = '0%';
      void fill.offsetHeight;
    }
    if (curSpan) curSpan.textContent = '0:00';
    if (totSpan) totSpan.textContent = '0:00';
    if (waTimePill) waTimePill.textContent = '0:00 / 0:00';
  }

  function resetCinemaLyricsStateImmediate() {
    currentLyrics = [];
    lastCinemaActiveIdx = -1;
    isTranslationActive = false;
    const transBtn = document.getElementById('cinema-translate-btn');
    if (transBtn) transBtn.classList.remove('active');
    const wrapper = document.getElementById('cinema-lyrics-wrapper');
    if (wrapper) wrapper.innerHTML = '<div class="cinema-lyric-line active-line">Cargando canción...</div>';
    const typingBubble = document.getElementById('whatsapp-typing-bubble');
    if (typingBubble) typingBubble.style.display = 'none';
    const topStatus = document.querySelector('.whatsapp-top-status');
    if (topStatus) topStatus.innerHTML = '<span class="wa-online-dot"></span> en línea';
    const container = document.getElementById('cinema-right-scroll');
    if (container) container.scrollTo({ top: 0, behavior: 'instant' });
  }

  function getCurrentTrackInfo() {
    let title = '';
    let artist = '';
    let currentSrc = '';

    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      title = navigator.mediaSession.metadata.title || '';
      artist = navigator.mediaSession.metadata.artist || '';
    }

    if (!title) {
      const titleEl = document.querySelector('ytmusic-player-bar .title, ytmusic-player-bar yt-formatted-string.title');
      if (titleEl) title = titleEl.textContent.trim();
    }
    if (!artist) {
      const artistEl = document.querySelector('ytmusic-player-bar .byline, ytmusic-player-bar yt-formatted-string.byline');
      if (artistEl) artist = artistEl.textContent.trim();
    }

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

    const vid = document.querySelector('video');
    if (vid && vid.currentSrc) currentSrc = vid.currentSrc;

    return { title, artist, currentSrc };
  }

  function checkCinemaTrackChange() {
    if (!isCinemaActive) return;

    const { title, artist, currentSrc } = getCurrentTrackInfo();
    const shortSrc = (currentSrc || '').split('?')[0].slice(-40);
    const trackId = `${title}:::${artist}:::${shortSrc}`;

    const video = document.querySelector('video');
    const wasNearEnd = typeof window._auramusicLastCurrentTime === 'number' && window._auramusicLastCurrentTime > 5;
    const nowNearStart = video && !isNaN(video.currentTime) && video.currentTime < 0.8 && video.duration > 5;
    if (wasNearEnd && nowNearStart) {
      console.log('🔄 AuraMusic: DETECTADO CAMBIO POR REINICIO 0s (canción nueva)');
      lastCinemaTrackId = '';
      window._auramusicLastCurrentTime = 0;
    }
    if (video && !isNaN(video.currentTime)) window._auramusicLastCurrentTime = video.currentTime;

    if (title && trackId !== lastCinemaTrackId) {
      lastCinemaTrackId = trackId;
      console.log('🔄 AuraMusic: Cambio de canción en vivo detectado:', trackId);
      resetCinemaProgressImmediate();
      resetCinemaLyricsStateImmediate();
      updateCinemaTrack(title, artist);
    }
  }

  async function updateCinemaTrack(title, artist) {
    const curGen = ++cinemaTrackGen;
    pendingCinemaTrackUpdate = { title, artist, gen: curGen };

    resetCinemaProgressImmediate();
    resetCinemaLyricsStateImmediate();

    if (isUpdatingCinemaTrack) {
      return;
    }
    isUpdatingCinemaTrack = true;

    try {
      while (pendingCinemaTrackUpdate && pendingCinemaTrackUpdate.gen === cinemaTrackGen) {
        const t = pendingCinemaTrackUpdate.title;
        const a = pendingCinemaTrackUpdate.artist;
        pendingCinemaTrackUpdate = null;

        const thisGen = cinemaTrackGen;

        const trackTitleEl = document.getElementById('cinema-track-title');
        const trackArtistEl = document.getElementById('cinema-track-artist');
        const artImg = document.getElementById('cinema-art-img');
        const wrapper = document.getElementById('cinema-lyrics-wrapper');
        const video = document.querySelector('video');

        const cleanTitle = t || document.title.replace(' - YouTube Music', '').replace(' | YouTube Music', '').trim() || 'Canción';
        const cleanArtist = a || 'Artista';

        if (trackTitleEl) trackTitleEl.textContent = cleanTitle;
        if (trackArtistEl) trackArtistEl.textContent = cleanArtist;

        const newCover = getHighResCoverUrl() || 'https://music.youtube.com/img/on_platform_logo.svg';
        if (artImg && newCover) {
          artImg.style.opacity = '0.3';
          artImg.style.transform = 'scale(0.96)';
          artImg.src = newCover;
          artImg.onload = () => {
            if (thisGen !== cinemaTrackGen) return;
            artImg.style.opacity = '1';
            artImg.style.transform = 'scale(1)';
            try { updateDynamicCoverColor(); } catch (e) {}
          };
        }

        const waTopTitle = document.getElementById('whatsapp-top-title');
        const waTopAvatar = document.getElementById('cinema-top-art-img');
        const waUserAvatar = document.getElementById('whatsapp-user-avatar');
        if (waTopTitle) waTopTitle.textContent = `${cleanTitle} • ${cleanArtist}`;
        if (waTopAvatar) {
          waTopAvatar.src = newCover;
          waTopAvatar.style.display = (state.theme === 'whatsapp') ? 'block' : 'none';
        }
        if (waUserAvatar) waUserAvatar.src = newCover;

        if (state.theme === 'whatsapp') {
          try { populateWhatsAppQueueList(cleanTitle, cleanArtist, newCover); } catch (e) {}
        }

        const duration = video ? video.duration : 180;

        let lyrics = null;
        let usedPreload = false;
        // 🎯 FEATURE C: Check precarga inteligente. Si la letra CANCIÓN B está pre-cargada, NO mostramos "Sincronizando letra..."
        try {
          const cacheKey = makeLyricsCacheKey(t, a, duration);
          if (preloadLyricsCache[cacheKey]) {
            lyrics = preloadLyricsCache[cacheKey].lyrics;
            usedPreload = true;
            console.log('⚡ AuraMusic: HOTLOAD! Letra precargada aplicada SIN mensaje de carga:', cleanTitle);
          } else {
            // Probamos también preloadNextTrackId si coincide (para crossfade "adivinado" en cola YouTube)
            const predictedId = preloadNextTrackId;
            const myId = `${cleanTitle.trim().toLowerCase()}:::${cleanArtist.trim().toLowerCase()}`;
            if (predictedId && predictedId.trim().toLowerCase().split(':::')[0] === cleanTitle.trim().toLowerCase()) {
              for (const k of Object.keys(preloadLyricsCache)) {
                if (!usedPreload && preloadLyricsCache[k]) {
                  lyrics = preloadLyricsCache[k].lyrics;
                  usedPreload = true;
                  preloadLyricsCache[cacheKey] = preloadLyricsCache[k];
                  console.log('⚡ AuraMusic: HOTLOAD por predicción idéntica! Letra aplicada:', cleanTitle);
                  break;
                }
              }
            }
          }
        } catch (e) { usedPreload = false; }

        // Si hubo preload => NO pintamos "Sincronizando letra..." => mensaje desaparece completamente.
        if (!usedPreload && wrapper) {
          wrapper.innerHTML = '<div class="cinema-lyric-line active-line">Sincronizando letra...</div>';
        }

        if (!lyrics) {
          lyrics = await fetchSyncedLyrics(t, a, duration);
        }

        if (thisGen !== cinemaTrackGen) continue;

        let finalLyrics = lyrics;
        if (isTranslationActive) {
          const targetLang = (navigator.language || 'es').split('-')[0].toLowerCase();
          finalLyrics = await translateLyrics(lyrics, targetLang);
          if (thisGen !== cinemaTrackGen) continue;
        }

        if (usedPreload === false) {
          const finalCacheKey = makeLyricsCacheKey(t, a, duration);
          if (!preloadLyricsCache[finalCacheKey]) {
            preloadLyricsCache[finalCacheKey] = { lyrics: finalLyrics, fetchedAt: Date.now() };
          }
        }

        currentLyrics = finalLyrics;
        lastCinemaActiveIdx = -1;
        renderCinemaLyricsDOM();
        const rightScroll = document.getElementById('cinema-right-scroll');
        if (rightScroll) rightScroll.scrollTo({ top: 0, behavior: 'instant' });
      }
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
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    overlay.classList.add('active');
    lastCinemaTrackId = ''; // Forzar actualización

    const jStage = document.getElementById('jesuluto-3d-stage');
    const artBox = document.querySelector('.cinema-standard-left .cinema-artwork-box');
    if (state.theme === 'jesuluto') {
      if (jStage) jStage.style.display = 'flex';
      if (artBox) artBox.style.display = 'none';
      setTimeout(initJesuluto3D, 100);
    } else {
      if (jStage) jStage.style.display = 'none';
      if (artBox) artBox.style.display = 'block';
    }

    checkCinemaTrackChange();
    startCinemaSyncLoop();
  }

  function closeCinemaMode() {
    const overlay = document.getElementById('auramusic-cinema-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
    }
    isCinemaActive = false;
    if (typeof destroyJesuluto3D === 'function') {
      destroyJesuluto3D();
    }
  }

  function startCinemaSyncLoop() {
    lastCinemaActiveIdx = -1;
    let frameCounter = 0;
    let _lastSeekWriteVideo = -1;

    function sync() {
      if (!isCinemaActive) return;

      checkCinemaTrackChange();
      preloadNextTrackLyricsIfNearEnd();
      frameCounter++;

      const video = document.querySelector('video');
      if (video) {
        const currentTime = video.currentTime;
        const duration = video.duration || 1;
        const nowTs = Date.now();

        const durationFinite = duration > 0 && !isNaN(duration) && isFinite(duration);
        const timeFinite = !isNaN(currentTime) && isFinite(currentTime);

        const isSongNearOrAtEnd = durationFinite && timeFinite && (video.ended === true || (currentTime >= duration - 0.08));
        const isNewSongJustStarted = durationFinite && timeFinite && (currentTime < 0.6) && (duration > 5) && (nowTs > cinemaSeekLockUntil);

        if (isSongNearOrAtEnd) {
          cinemaGraceUntil = Math.max(cinemaGraceUntil, nowTs + 1500);
        }
        if (isNewSongJustStarted && lastCinemaTrackId && nowTs > cinemaGraceUntil - 300) {
          cinemaGraceUntil = Math.max(cinemaGraceUntil, nowTs + 400);
          cinemaLastStablePct = -1;
          cinemaLastStableTime = -1;
        }

        const inGracePeriod = nowTs < cinemaGraceUntil;
        const inSeekLockPeriod = nowTs < cinemaSeekLockUntil;
        const isSeekingLive = video.seeking === true;

        const fill = document.getElementById('cinema-progress-fill');
        const curSpan = document.getElementById('cinema-current-time');
        const totSpan = document.getElementById('cinema-total-time');
        const playBtn = document.getElementById('cinema-play-btn');

        if (currentLyrics.length === 0 || inGracePeriod || inSeekLockPeriod || isSeekingLive) {
          if (fill) {
            fill.style.transition = 'none !important';
            if (isSongNearOrAtEnd) {
              fill.style.width = '100%';
              cinemaLastStablePct = 100;
            } else if (currentLyrics.length === 0 || inGracePeriod) {
              fill.style.width = '0%';
            } else {
              if (durationFinite && timeFinite) {
                const pct = Math.max(0, Math.min(100, (currentTime / duration) * 100));
                fill.style.width = `${pct}%`;
                cinemaLastStablePct = pct;
              } else if (cinemaLastStablePct >= 0) {
                fill.style.width = `${cinemaLastStablePct}%`;
              }
            }
          }
          if (isSongNearOrAtEnd) {
            if (curSpan && durationFinite) curSpan.textContent = formatTime(duration);
            if (totSpan && durationFinite) totSpan.textContent = formatTime(duration);
          } else if ((currentLyrics.length === 0 || inGracePeriod)) {
            if (curSpan) curSpan.textContent = '0:00';
            if (totSpan) totSpan.textContent = '0:00';
          } else {
            if (curSpan && !isNaN(currentTime)) curSpan.textContent = formatTime(currentTime);
            if (totSpan && durationFinite) totSpan.textContent = formatTime(duration);
          }
        } else {
          let validPct = -1;
          if (durationFinite && timeFinite) {
            const rawPct = (currentTime / duration) * 100;
            const dt = (cinemaLastStableTime >= 0) ? (currentTime - cinemaLastStableTime) : 0.1;
            let expectedPct = -1;
            if (cinemaLastStablePct >= 0 && cinemaLastStableTime >= 0 && dt > 0 && dt < 2.5) {
              const perSec = 100 / duration;
              expectedPct = cinemaLastStablePct + (dt * perSec);
            }
            let skipThisFrame = false;

            const inFinalZone = rawPct >= 92;
            if (!inFinalZone && cinemaLastStablePct >= 0 && expectedPct >= 0 && Math.abs(rawPct - cinemaLastStablePct) > 15) {
              if (Math.abs(rawPct - expectedPct) > 3.5) {
                skipThisFrame = true;
              }
            }
            if (!skipThisFrame && cinemaLastStablePct >= 0 && rawPct < cinemaLastStablePct - 1.2) {
              skipThisFrame = true;
            }

            if (!skipThisFrame) {
              let candidate = Math.max(0, Math.min(100, rawPct));
              if (cinemaLastStablePct >= 0 && candidate < cinemaLastStablePct) {
                candidate = cinemaLastStablePct;
              }
              validPct = candidate;
              cinemaLastStablePct = validPct;
              cinemaLastStableTime = currentTime;
              if (_lastSeekWriteVideo !== currentTime) {
                fill.style.transition = '';
                fill.style.width = `${validPct}%`;
                _lastSeekWriteVideo = currentTime;
              }
              if (curSpan && !isNaN(currentTime)) curSpan.textContent = formatTime(currentTime);
              if (totSpan && durationFinite) totSpan.textContent = formatTime(duration);
            } else if (cinemaLastStablePct >= 0) {
              validPct = cinemaLastStablePct;
              fill.style.transition = 'none !important';
              fill.style.width = `${validPct}%`;
            }
          } else if (cinemaLastStablePct >= 0) {
            validPct = cinemaLastStablePct;
            fill.style.transition = 'none !important';
            fill.style.width = `${validPct}%`;
          }
        }
        if (state.theme === 'jesuluto' && typeof updateJesulutoAnimation === 'function') {
          updateJesulutoAnimation(currentTime, video && !video.paused);
        }
        if (playBtn) playBtn.textContent = video.paused ? '▶' : '⏸';

        const effectiveTime = currentTime + 0.05;

        if (currentLyrics.length > 0) {
          let activeIdx = -1;
          for (let i = 0; i < currentLyrics.length; i++) {
            if (effectiveTime >= currentLyrics[i].time) {
              activeIdx = i;
            } else {
              break;
            }
          }


          if (state.theme === 'whatsapp') {
            const allLines = document.querySelectorAll('#cinema-lyrics-wrapper .cinema-lyric-line');
            const typingBubble = document.getElementById('whatsapp-typing-bubble');
            const topStatus = document.querySelector('.whatsapp-top-status');
            const waPlayBtn = document.getElementById('cinema-wa-play-btn');
            const waTimePill = document.getElementById('cinema-wa-time');

            if (waPlayBtn) waPlayBtn.textContent = (video && !video.paused) ? '⏸' : '▶';
            if (waTimePill && !isNaN(currentTime) && !isNaN(duration) && isFinite(duration)) {
              waTimePill.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
            }

            allLines.forEach((l) => {
              const lTime = parseFloat(l.dataset.time);
              if (!isNaN(lTime) && effectiveTime >= lTime) {
                if (!l.classList.contains('wa-sent')) {
                  l.classList.add('wa-sent');
                  const container = document.getElementById('cinema-right-scroll');
                  if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                }
              } else {
                l.classList.remove('wa-sent');
              }
            });

            const isPlaying = video && !video.paused;
            const nextIdx = activeIdx + 1;
            if (nextIdx < currentLyrics.length && isPlaying && typingBubble) {
              const timeToNext = currentLyrics[nextIdx].time - effectiveTime;
              if (timeToNext <= 2.5 && timeToNext > 0) {
                typingBubble.style.display = 'flex';
                if (topStatus) topStatus.innerHTML = '<span class="wa-online-dot"></span> escribiendo...';
                const container = document.getElementById('cinema-right-scroll');
                if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
              } else {
                typingBubble.style.display = 'none';
                if (topStatus) topStatus.innerHTML = '<span class="wa-online-dot"></span> en línea';
              }
            } else if (typingBubble) {
              typingBubble.style.display = 'none';
              if (topStatus) topStatus.innerHTML = '<span class="wa-online-dot"></span> en línea';
            }
          }

          if (activeIdx !== lastCinemaActiveIdx) {
            lastCinemaActiveIdx = activeIdx;
            const allLines = document.querySelectorAll('.cinema-lyric-line');
            allLines.forEach((l, idx) => {
              if (idx === activeIdx) {
                l.classList.add('active-line');
                const container = document.getElementById('cinema-right-scroll');
                if (container) {
                  const cRect = container.getBoundingClientRect();
                  const lRect = l.getBoundingClientRect();
                  const targetScroll = container.scrollTop + (lRect.top - cRect.top) - (cRect.height * 0.38);
                  container.scrollTo({ top: targetScroll, behavior: 'smooth' });
                }
              } else {
                l.classList.remove('active-line');
                const words = l.querySelectorAll('.k-word');
                if (idx < activeIdx) {
                  words.forEach(w => w.className = 'k-word sung');
                  l.classList.add('sung-line');
                } else {
                  words.forEach(w => w.className = 'k-word');
                  l.classList.remove('sung-line');
                }
              }
            });
          }

          if (activeIdx >= 0 && activeIdx < currentLyrics.length) {
            const activeLineEl = document.querySelector(`.cinema-lyric-line[data-index="${activeIdx}"]`);
            if (activeLineEl) {
              const words = activeLineEl.querySelectorAll('.k-word');
              words.forEach(w => {
                const start = parseFloat(w.dataset.start);
                const end = parseFloat(w.dataset.end);
                if (!isNaN(start) && !isNaN(end)) {
                  if (effectiveTime >= end) {
                    w.className = 'k-word sung';
                  } else if (effectiveTime >= start && effectiveTime < end) {
                    w.className = 'k-word active';
                  } else {
                    w.className = 'k-word';
                  }
                }
              });
            }
          }
        } else {
          const allLines = document.querySelectorAll('.cinema-lyric-line');
          allLines.forEach(l => {
            if (l.dataset.index !== undefined) {
              l.classList.remove('active-line', 'sung-line', 'wa-sent');
              const ws = l.querySelectorAll('.k-word');
              ws.forEach(w => w.className = 'k-word');
            }
          });
          const typingBubble = document.getElementById('whatsapp-typing-bubble');
          if (typingBubble) typingBubble.style.display = 'none';
          const topStatus = document.querySelector('.whatsapp-top-status');
          if (topStatus) topStatus.innerHTML = '<span class="wa-online-dot"></span> en línea';
          lastCinemaActiveIdx = -1;
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

  // Inyectar el botón de "Letra Animada" en la pestaña LETRA de YouTube Music (Diseño Floating Glass)
  function checkAndInjectLyricsButton() {
    const lyricsShelf = document.querySelector('ytmusic-description-shelf-renderer');

    if (lyricsShelf && !document.getElementById('auramusic-cinema-trigger-btn')) {
      const btn = document.createElement('button');
      btn.id = 'auramusic-cinema-trigger-btn';
      btn.type = 'button';
      btn.innerHTML = `<span>✨</span> <span>Abrir Pantalla Completa con Letra Animada</span>`;
      btn.addEventListener('click', openCinemaMode);

      lyricsShelf.parentNode.insertBefore(btn, lyricsShelf);
      console.log('🎤 AuraMusic: Botón premium de Letra Animada inyectado con éxito!');
    }

    // Inyectar también el icono nativo de Micrófono (🎤) directo en la barra del reproductor
    const rightControls = document.querySelector('ytmusic-player-bar .right-controls-buttons');
    if (rightControls && !document.getElementById('auramusic-bar-lyrics-btn')) {
      const barBtn = document.createElement('button');
      barBtn.id = 'auramusic-bar-lyrics-btn';
      barBtn.className = 'auramusic-bar-lyrics-btn';
      barBtn.type = 'button';
      barBtn.title = 'Letras Animadas en Pantalla Completa (🎤)';
      barBtn.innerHTML = '🎤';
      barBtn.addEventListener('click', openCinemaMode);
      rightControls.insertBefore(barBtn, rightControls.firstChild);
      console.log('🎤 AuraMusic: Botón de micrófono en barra inferior inyectado con éxito!');
    }
  }

  // (checkAndInjectLyricsButton integrado en el bucle maestro unificado)

  // --- INYECCIÓN DE ELEMENTOS OFICIALES DE SPOTIFY (LOGO, BOTÓN HOME, PLACEHOLDER) ---
  function updateSpotifyBrandElements() {
    const isSpotify = state.theme === 'spotify';

    // 1. Buscador: Cambiar placeholder a "¿Qué quieres reproducir?"
    const searchInput = document.querySelector('ytmusic-search-box input, input#input');
    if (searchInput) {
      if (isSpotify && !searchInput.dataset.originalPlaceholder) {
        searchInput.dataset.originalPlaceholder = searchInput.placeholder;
        searchInput.placeholder = '¿Qué quieres reproducir?';
      } else if (!isSpotify && searchInput.dataset.originalPlaceholder) {
        searchInput.placeholder = searchInput.dataset.originalPlaceholder;
        delete searchInput.dataset.originalPlaceholder;
      }
    }

    // 2. Botón Home (🏠) en barra superior
    const searchBox = document.querySelector('ytmusic-search-box');
    if (searchBox) {
      let homeBtn = document.getElementById('auramusic-spotify-home-btn');
      if (isSpotify && !homeBtn) {
        homeBtn = document.createElement('button');
        homeBtn.id = 'auramusic-spotify-home-btn';
        homeBtn.title = 'Inicio';
        homeBtn.innerHTML = '🏠';
        homeBtn.addEventListener('click', () => {
          const homeNav = document.querySelector('ytmusic-guide-entry-renderer:first-child a');
          if (homeNav) homeNav.click();
        });
        searchBox.parentNode.insertBefore(homeBtn, searchBox);
      } else if (!isSpotify && homeBtn) {
        homeBtn.remove();
      }
    }

    // 3. Reemplazo del logo por el de Spotify
    const logoContainer = document.querySelector('ytmusic-nav-bar #logo');
    if (logoContainer) {
      let spotLogo = document.getElementById('auramusic-spotify-logo');
      if (isSpotify && !spotLogo) {
        spotLogo = document.createElement('div');
        spotLogo.id = 'auramusic-spotify-logo';
        spotLogo.className = 'auramusic-spotify-brand-logo';
        spotLogo.innerHTML = `
          <svg width="34" height="34" viewBox="0 0 24 24" fill="#1ed760">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.467-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.112.294.18.386.563.207.857zm1.224-2.72c-.226.368-.71.485-1.077.26-2.69-1.654-6.79-2.134-9.97-1.168-.413.125-.852-.108-.977-.52-.125-.413.108-.852.52-.977 3.633-1.103 8.147-.568 11.244 1.328.368.226.485.71.26 1.077zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.128-1.168-.622-.15-.494.128-1.018.622-1.168 3.532-1.072 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z"/>
          </svg>
          <span style="font-weight: 800; font-size: 1.2rem; color: #ffffff; letter-spacing: -0.04em;">Spotify</span>
        `;
        logoContainer.style.display = 'flex';
        logoContainer.style.alignItems = 'center';
        logoContainer.appendChild(spotLogo);
        const originalSvg = logoContainer.querySelector('g#youtube-music-logo, yt-icon, #logo-icon');
        if (originalSvg) originalSvg.style.display = 'none';
      } else if (!isSpotify && spotLogo) {
        spotLogo.remove();
        const originalSvg = logoContainer.querySelector('g#youtube-music-logo, yt-icon, #logo-icon');
        if (originalSvg) originalSvg.style.display = '';
      }
    }
  }

  // (updateSpotifyBrandElements integrado en el bucle maestro unificado)


  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();





// ==========================================================================
// ⚡ MOTOR 3D BLOCKBENCH V2: RIG COMPLETO (12 CUBOS + CAPAS 3D + SKINS CUSTOM)
// ==========================================================================
const JESULUTO_DANCE_DATA = {"transform_overlay2": [{"tick": 60.0, "r": [0.0, 0.0, 0.17453294], "t": [0.0, 0.0, 0.0]}, {"tick": 63.0, "r": [0.0, 0.0, 0.17453294], "t": [0.0, 0.0, 0.0]}, {"tick": 65.0, "r": [0.0, 0.0, 0.06981318], "t": [0.0, 0.0, 0.0]}, {"tick": 67.0, "r": [0.0, 0.0, -0.08726645], "t": [0.0, 0.03125, 0.0]}, {"tick": 71.0, "r": [0.0, 0.0, -0.08726645], "t": [0.0, 0.0, 0.0]}, {"tick": 74.0, "r": [0.0, 0.0, 0.0], "t": [-0.03125, 0.0, 0.0]}, {"tick": 77.0, "r": [0.0, 0.0, 0.13962635], "t": [-0.03125, 0.0, 0.0]}, {"tick": 80.0, "r": [0.0, 0.0, 0.13962635], "t": [-0.03125, 0.0, 0.0]}, {"tick": 83.0, "r": [0.0, 0.0, 0.13962635], "t": [-0.03125, 0.0, 0.0]}, {"tick": 86.0, "r": [0.0, 0.0, 0.13962635], "t": [-0.03125, 0.0, 0.0]}, {"tick": 89.0, "r": [0.0, 0.0, -0.03490657], "t": [-0.03125, 0.0, 0.0]}, {"tick": 101.0, "r": [0.0, 0.0, -0.03490657], "t": [-0.03125, 0.0, 0.0]}], "pose:low_body": [{"tick": 60.0, "r": [0.0, 0.0, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 64.0, "r": [0.104719765, -0.13962635, -0.104719765], "t": [0.0, -0.9375, 0.0]}, {"tick": 67.0, "r": [0.0, -0.13962635, -0.052359886], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [0.0, 0.2094395, 0.06981316], "t": [0.875, 0.0, 0.0]}, {"tick": 74.0, "r": [0.0, 0.0, 0.0], "t": [0.0, -0.6875, 0.0]}, {"tick": 80.0, "r": [0.0, 0.0, 0.0], "t": [-0.8125, -0.75, 0.0]}, {"tick": 83.0, "r": [-0.122173056, -0.15707964, -0.15707964], "t": [-0.8125, -0.5, 0.0]}, {"tick": 86.0, "r": [0.0, -0.052359883, 0.052359883], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [0.0, 0.104719765, 0.052359883], "t": [0.21875, -0.625, 0.0]}, {"tick": 92.0, "r": [0.0, 0.104719765, 0.052359883], "t": [0.21875, 0.0, 0.0]}, {"tick": 95.0, "r": [-0.06981318, 0.22689281, 0.052359883], "t": [0.21875, -0.78125, 0.0]}, {"tick": 98.0, "r": [0.0, 0.15707964, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [0.0, 0.03490659, -0.122173056], "t": [0.0, 0.0, 0.0]}], "pose:torso": [{"tick": 60.0, "r": [0.0, 0.0, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 63.0, "r": [0.0, -0.17453294, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 67.0, "r": [0.0, 0.24434611, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [0.0, 0.052359883, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 77.0, "r": [0.0, -0.24434611, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 83.0, "r": [0.0, -0.122173056, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [0.0, 0.0, 0.0], "t": [0.0, 0.0, 0.0]}], "pose:head": [{"tick": 60.0, "r": [-0.19198622, 0.06981319, -0.017453294], "t": [0.0, 0.0, 0.0]}, {"tick": 63.0, "r": [0.03490659, -0.40142575, -0.017453294], "t": [0.0, 0.0, 0.0]}, {"tick": 65.0, "r": [0.19198622, -0.3141593, -0.122173056], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [-0.017453285, 0.122173056, 0.13962635], "t": [0.0, 0.0, 0.0]}, {"tick": 74.0, "r": [0.06981318, 0.0, 0.13962635], "t": [0.0, 0.0, 0.0]}, {"tick": 77.0, "r": [0.06981318, -0.22689281, 0.13962635], "t": [0.0, 0.0, 0.0]}, {"tick": 80.0, "r": [0.19198622, -0.5061455, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 83.0, "r": [0.20943953, -0.33161253, -0.087266445], "t": [0.0, 0.0, 0.0]}, {"tick": 86.0, "r": [0.17453295, -0.33161253, -0.03490657], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [0.052359894, 0.10471979, -0.087266445], "t": [0.0, 0.0, 0.0]}, {"tick": 92.0, "r": [0.052359894, 0.10471979, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 95.0, "r": [0.052359894, 0.0698132, 0.12217308], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [-0.17453294, -0.08726647, 0.122173056], "t": [0.0, 0.0, 0.0]}], "pose:right_arm": [{"tick": 60.0, "r": [1.1693707, 0.8028515, 0.0], "t": [0.0, -1.375, -2.25]}, {"tick": 63.0, "r": [1.1693707, 0.4188791, 0.0], "t": [0.0, -1.375, -2.25]}, {"tick": 65.0, "r": [0.9250245, 0.052359946, 0.31415927], "t": [0.0, -1.375, -2.25]}, {"tick": 67.0, "r": [0.62831855, 0.052359946, 0.31415927], "t": [0.0, -1.375, -2.25]}, {"tick": 71.0, "r": [-0.03490659, 0.052359946, 0.6632251], "t": [-0.59375, -0.78125, -1.0625]}, {"tick": 74.0, "r": [-0.03490659, 0.052359946, 0.26179934], "t": [-0.59375, -0.78125, -1.0625]}, {"tick": 77.0, "r": [0.41887906, -0.15707964, 0.45378563], "t": [0.0, 0.0, 0.0]}, {"tick": 80.0, "r": [0.7679449, -0.45378563, 0.45378563], "t": [0.0, 0.0, 0.0]}, {"tick": 83.0, "r": [1.134464, 0.03490655, 0.19198626], "t": [0.0, 0.0, 0.0]}, {"tick": 86.0, "r": [1.3613569, 0.22689277, 0.19198626], "t": [0.0, 0.0, 0.0]}, {"tick": 92.0, "r": [0.36651915, -0.20943953, 0.31415927], "t": [0.0, 0.0, 0.0]}, {"tick": 95.0, "r": [0.17453294, -0.20943953, 0.50614554], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [0.0, 0.0, 0.33161256], "t": [0.0, 0.0, 0.0]}], "pose:left_arm": [{"tick": 60.0, "r": [0.0, 0.34906587, -0.47123894], "t": [0.0, 0.0, -0.34375]}, {"tick": 63.0, "r": [0.0, 0.34906587, -0.64577186], "t": [0.0, 0.0, -0.34375]}, {"tick": 65.0, "r": [0.593412, 0.7330383, -0.40142575], "t": [0.0, 0.0, -0.34375]}, {"tick": 67.0, "r": [0.8552114, 0.8552114, -0.40142575], "t": [0.0, 0.0, -0.34375]}, {"tick": 71.0, "r": [1.3439035, 0.0, 0.0], "t": [0.96875, 0.0, 0.0]}, {"tick": 74.0, "r": [1.4486233, -0.104719765, 0.0], "t": [0.96875, 0.0, 0.0]}, {"tick": 77.0, "r": [0.5235988, 0.5585054, -0.296706], "t": [0.0, 0.0, 0.0]}, {"tick": 80.0, "r": [0.22689281, 0.33161265, -0.5585054], "t": [0.0, 0.0, 0.0]}, {"tick": 83.0, "r": [-0.087266445, 0.1919863, -0.6981318], "t": [0.0, 0.0, 0.0]}, {"tick": 86.0, "r": [-0.087266445, 0.1919863, -0.8203049], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [1.1170108, 0.6981318, -0.31415936], "t": [0.0, 0.0, 0.0]}, {"tick": 95.0, "r": [1.2566372, 0.052359946, -0.31415936], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [1.2217306, -0.38397238, -0.17453302], "t": [0.0, -0.65625, 0.0]}], "pose:right_leg": [{"tick": 60.0, "r": [0.06981318, -0.33161253, 0.24434611], "t": [-0.125, 1.21875, -2.6875]}, {"tick": 65.0, "r": [0.34906587, 0.0, -0.2617994], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [-0.104719765, 0.0, 0.2617994], "t": [-0.3125, 0.0, -0.96875]}, {"tick": 74.0, "r": [-0.2617994, 0.0, 0.0], "t": [0.0, 0.0, -0.78125]}, {"tick": 80.0, "r": [0.0, 0.0, 0.15707964], "t": [-1.1875, 0.0, -1.6875]}, {"tick": 83.0, "r": [-0.08726647, 0.0, 0.15707964], "t": [-1.1875, 0.0, -3.15625]}, {"tick": 86.0, "r": [0.34906587, 0.0, -0.20943953], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [-0.052359883, 0.0, 0.12217303], "t": [0.0, 0.0, -2.21875]}, {"tick": 95.0, "r": [-0.052359883, 0.0, 0.40142575], "t": [-0.59375, -0.125, -2.21875]}, {"tick": 101.0, "r": [-0.13962635, 0.0, -0.296706], "t": [0.0, 0.0, 0.0]}], "pose:left_leg": [{"tick": 60.0, "r": [0.19198622, 0.45378563, -0.2792527], "t": [0.65625, 0.0, -1.5625]}, {"tick": 65.0, "r": [-0.19198622, 0.0, 0.19198622], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [-0.19198622, 0.15707964, -0.122173056], "t": [1.15625, 0.0, -0.90625]}, {"tick": 74.0, "r": [0.0, 0.0, 0.104719765], "t": [0.0, 0.34375, -2.71875]}, {"tick": 80.0, "r": [-0.03490659, 0.40142575, -0.24434611], "t": [0.6875, -0.625, -1.4375]}, {"tick": 83.0, "r": [-0.03490659, 0.40142575, -0.40142575], "t": [0.6875, -0.625, -1.4375]}, {"tick": 86.0, "r": [0.0, 0.0, 0.19198622], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [-0.38397244, 0.0, 0.19198622], "t": [0.0, 0.0, -1.34375]}, {"tick": 95.0, "r": [-0.15707964, 0.22689281, -0.052359883], "t": [1.03125, -0.25, -2.34375]}, {"tick": 101.0, "r": [-0.122173056, 0.15707964, 0.017453294], "t": [0.0, 0.0, -3.0]}]};

let jesulutoScene = null;
let jesulutoCamera = null;
let jesulutoRenderer = null;
let jesulutoRig = null;
let jesulutoCurrentSkinImg = null;
let isJesuluto3DInitialized = false;

// 🧹 LIBERACIÓN COMPLETA DE RECURSOS THREE.JS (LIBERA RAM Y VRAM)
function destroyJesuluto3D() {
  if (!isJesuluto3DInitialized) return;
  try {
    if (jesulutoRenderer) {
      jesulutoRenderer.dispose();
      if (jesulutoRenderer.forceContextLoss) {
        jesulutoRenderer.forceContextLoss();
      }
      if (jesulutoRenderer.domElement && jesulutoRenderer.domElement.parentNode) {
        jesulutoRenderer.domElement.parentNode.removeChild(jesulutoRenderer.domElement);
      }
    }
    if (jesulutoScene) {
      jesulutoScene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }
  } catch(e) {}
  jesulutoScene = null;
  jesulutoCamera = null;
  jesulutoRenderer = null;
  jesulutoRig = null;
  isJesuluto3DInitialized = false;
  console.log('🧹 AuraMusic: Recursos 3D liberados (memoria RAM/GPU optimizada).');
}

function initJesuluto3D() {
  const container = document.getElementById('jesuluto-3d-stage');
  if (!container || typeof THREE === 'undefined') return;
  if (isJesuluto3DInitialized && jesulutoRenderer) return;

  const width = container.clientWidth || 320;
  const height = container.clientHeight || 480;

  jesulutoScene = new THREE.Scene();
  jesulutoCamera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
  jesulutoCamera.position.set(0, 15, 64);
  jesulutoCamera.lookAt(0, 13, 0);

  jesulutoRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  jesulutoRenderer.setSize(width, height);
  jesulutoRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Limpiar e insertar canvas + controles de skin
  container.innerHTML = '';
  container.appendChild(jesulutoRenderer.domElement);

  // Pedestal holográfico
  const ped = document.createElement('div');
  ped.className = 'jesuluto-stage-pedestal';
  container.appendChild(ped);

  // Botón para subir skins personalizadas
  setupJesulutoSkinUpload(container);

  // Iluminación Mecha / Cyber Verde
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  jesulutoScene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0x00ff77, 1.1);
  dirLight.position.set(15, 35, 25);
  jesulutoScene.add(dirLight);

  const backLight = new THREE.DirectionalLight(0x00e5ff, 0.6);
  backLight.position.set(-15, 15, -25);
  jesulutoScene.add(backLight);

  // Cargar textura inicial (Skin guardada o David por defecto)
  const savedSkin = localStorage.getItem('auramusic_custom_skin');
  const defaultSkinUrl = chrome.runtime?.getURL('assets/jesuluto_skin.png') || 'assets/jesuluto_skin.png';
  loadSkinAndBuildRig(savedSkin || defaultSkinUrl);

  isJesuluto3DInitialized = true;
}

function setupJesulutoSkinUpload(container) {
  let controls = document.getElementById('jesuluto-skin-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'jesuluto-skin-controls';
    controls.className = 'jesuluto-skin-controls';
    controls.innerHTML = `
      <input type="file" id="jesuluto-skin-file-input" accept="image/png" style="display:none;">
      <button type="button" id="jesuluto-skin-upload-btn" class="jesuluto-skin-action-btn">
        <span>👕</span> Subir Skin (.png)
      </button>
      <button type="button" id="jesuluto-skin-reset-btn" class="jesuluto-skin-action-btn" style="display:none;" title="Volver a la skin original">
        <span>↺</span>
      </button>
    `;
    container.appendChild(controls);

    const fileInput = controls.querySelector('#jesuluto-skin-file-input');
    const uploadBtn = controls.querySelector('#jesuluto-skin-upload-btn');
    const resetBtn = controls.querySelector('#jesuluto-skin-reset-btn');

    uploadBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        try {
          localStorage.setItem('auramusic_custom_skin', dataUrl);
        } catch(err) {}
        loadSkinAndBuildRig(dataUrl);
        if (resetBtn) resetBtn.style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
    };

    if (resetBtn) {
      if (localStorage.getItem('auramusic_custom_skin')) resetBtn.style.display = 'inline-flex';
      resetBtn.onclick = () => {
        localStorage.removeItem('auramusic_custom_skin');
        const defaultSkinUrl = chrome.runtime?.getURL('assets/jesuluto_skin.png') || 'assets/jesuluto_skin.png';
        loadSkinAndBuildRig(defaultSkinUrl);
        resetBtn.style.display = 'none';
      };
    }
  }
}

function loadSkinAndBuildRig(urlOrData) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    jesulutoCurrentSkinImg = img;
    buildJesulutoMinecraftRig(img);
  };
  img.src = urlOrData;
}

function createBoxFaceMaterial(image, x, y, w, h, isOuterLayer = false) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.abs(w));
  canvas.height = Math.max(1, Math.abs(h));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const sx = Math.min(x, x + w);
  const sy = Math.min(y, y + h);
  const sw = Math.abs(w);
  const sh = Math.abs(h);

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;

  return new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    alphaTest: isOuterLayer ? 0.35 : 0.05,
    side: THREE.FrontSide
  });
}

function buildJesulutoMinecraftRig(img) {
  if (!jesulutoScene) return;

  // Si ya existía un rig, eliminarlo de la escena
  if (jesulutoRig && jesulutoRig.root) {
    jesulutoScene.remove(jesulutoRig.root);
  }

  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  function makePart(w, h, d, uvMap, inflate = 0, isOuter = false) {
    const mats = [
      createBoxFaceMaterial(img, uvMap.east[0], uvMap.east[1], uvMap.east[2]-uvMap.east[0], uvMap.east[3]-uvMap.east[1], isOuter),
      createBoxFaceMaterial(img, uvMap.west[0], uvMap.west[1], uvMap.west[2]-uvMap.west[0], uvMap.west[3]-uvMap.west[1], isOuter),
      createBoxFaceMaterial(img, uvMap.up[0], uvMap.up[1], uvMap.up[2]-uvMap.up[0], uvMap.up[3]-uvMap.up[1], isOuter),
      createBoxFaceMaterial(img, uvMap.down[0], uvMap.down[1], uvMap.down[2]-uvMap.down[0], uvMap.down[3]-uvMap.down[1], isOuter),
      createBoxFaceMaterial(img, uvMap.north[0], uvMap.north[1], uvMap.north[2]-uvMap.north[0], uvMap.north[3]-uvMap.north[1], isOuter),
      createBoxFaceMaterial(img, uvMap.south[0], uvMap.south[1], uvMap.south[2]-uvMap.south[0], uvMap.south[3]-uvMap.south[1], isOuter)
    ];
    const geom = new THREE.BoxGeometry(w + inflate * 2, h + inflate * 2, d + inflate * 2);
    return new THREE.Mesh(geom, mats);
  }

  // 1. PELVIS / LOW_BODY (Pivote de animación en y = 12)
  const lowBodyGroup = new THREE.Group();
  lowBodyGroup.position.set(0, 12, 0);

  // 2. TORSO (Cuerpo y Chaqueta 3D)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0, 0);

  // Capa base torso
  const torsoBase = makePart(8, 12, 4, {
    north: [20, 20, 28, 32], east: [16, 20, 20, 32], south: [32, 20, 40, 32],
    west: [28, 20, 32, 32], up: [20, 16, 28, 20], down: [28, 16, 36, 20]
  });
  torsoBase.position.set(0, 6, 0);
  torsoGroup.add(torsoBase);

  // Capa exterior torso (Chaqueta / Bufanda / Armor)
  const torsoOuter = makePart(8, 12, 4, {
    north: [20, 36, 28, 48], east: [16, 36, 20, 48], south: [32, 36, 40, 48],
    west: [28, 36, 32, 48], up: [20, 32, 28, 36], down: [28, 32, 36, 36]
  }, 0.35, true);
  torsoOuter.position.set(0, 6, 0);
  torsoGroup.add(torsoOuter);

  // 3. CABEZA (Base + Headwear / Pelo 3D con 0.5 inflate)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 12, 0); // Encima del torso

  const headBase = makePart(8, 8, 8, {
    north: [8, 8, 16, 16], east: [0, 8, 8, 16], south: [24, 8, 32, 16],
    west: [16, 8, 24, 16], up: [8, 0, 16, 8], down: [16, 0, 24, 8]
  });
  headBase.position.set(0, 4, 0);
  headGroup.add(headBase);

  const headOuter = makePart(8, 8, 8, {
    north: [40, 8, 48, 16], east: [32, 8, 40, 16], south: [56, 8, 64, 16],
    west: [48, 8, 56, 16], up: [40, 0, 48, 8], down: [48, 0, 56, 8]
  }, 0.55, true);
  headOuter.position.set(0, 4, 0);
  headGroup.add(headOuter);
  torsoGroup.add(headGroup);

  // 4. BRAZO DERECHO (Base + Manga exterior 3D)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(5.5, 10, 0);

  const rightArmBase = makePart(3, 12, 4, {
    north: [44, 20, 47, 32], east: [40, 20, 44, 32], south: [51, 20, 54, 32],
    west: [47, 20, 51, 32], up: [44, 16, 47, 20], down: [47, 16, 50, 20]
  });
  rightArmBase.position.set(0, -5, 0);
  rightArmGroup.add(rightArmBase);

  const rightArmOuter = makePart(3, 12, 4, {
    north: [44, 36, 47, 48], east: [40, 36, 44, 48], south: [51, 36, 54, 48],
    west: [47, 36, 51, 48], up: [44, 32, 47, 36], down: [47, 32, 50, 36]
  }, 0.3, true);
  rightArmOuter.position.set(0, -5, 0);
  rightArmGroup.add(rightArmOuter);
  torsoGroup.add(rightArmGroup);

  // 5. BRAZO IZQUIERDO (Base + Manga exterior 3D)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-5.5, 10, 0);

  const leftArmBase = makePart(3, 12, 4, {
    north: [36, 52, 39, 64], east: [32, 52, 36, 64], south: [43, 52, 46, 64],
    west: [39, 52, 43, 64], up: [36, 48, 39, 52], down: [39, 48, 42, 52]
  });
  leftArmBase.position.set(0, -5, 0);
  leftArmGroup.add(leftArmBase);

  const leftArmOuter = makePart(3, 12, 4, {
    north: [52, 52, 55, 64], east: [48, 52, 52, 64], south: [59, 52, 62, 64],
    west: [55, 52, 59, 64], up: [52, 48, 55, 52], down: [55, 48, 58, 52]
  }, 0.3, true);
  leftArmOuter.position.set(0, -5, 0);
  leftArmGroup.add(leftArmOuter);
  torsoGroup.add(leftArmGroup);

  lowBodyGroup.add(torsoGroup);

  // 6. PIERNA DERECHA (Base + Pantalón exterior 3D)
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(1.9, 0, 0);

  const rightLegBase = makePart(4, 12, 4, {
    north: [4, 20, 8, 32], east: [0, 20, 4, 32], south: [12, 20, 16, 32],
    west: [8, 20, 12, 32], up: [4, 16, 8, 20], down: [8, 16, 12, 20]
  });
  rightLegBase.position.set(0, -6, 0);
  rightLegGroup.add(rightLegBase);

  const rightLegOuter = makePart(4, 12, 4, {
    north: [4, 36, 8, 48], east: [0, 36, 4, 48], south: [12, 36, 16, 48],
    west: [8, 36, 12, 48], up: [4, 32, 8, 36], down: [8, 32, 12, 36]
  }, 0.3, true);
  rightLegOuter.position.set(0, -6, 0);
  rightLegGroup.add(rightLegOuter);
  lowBodyGroup.add(rightLegGroup);

  // 7. PIERNA IZQUIERDA (Base + Pantalón exterior 3D)
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-1.9, 0, 0);

  const leftLegBase = makePart(4, 12, 4, {
    north: [20, 52, 24, 64], east: [16, 52, 20, 64], south: [28, 52, 32, 64],
    west: [24, 52, 28, 64], up: [20, 48, 24, 52], down: [24, 48, 28, 52]
  });
  leftLegBase.position.set(0, -6, 0);
  leftLegGroup.add(leftLegBase);

  const leftLegOuter = makePart(4, 12, 4, {
    north: [4, 52, 8, 64], east: [0, 52, 4, 64], south: [12, 52, 16, 64],
    west: [8, 52, 12, 64], up: [4, 48, 8, 52], down: [8, 48, 12, 52]
  }, 0.3, true);
  leftLegOuter.position.set(0, -6, 0);
  leftLegGroup.add(leftLegOuter);
  lowBodyGroup.add(leftLegGroup);

  root.add(lowBodyGroup);
  jesulutoScene.add(root);

  jesulutoRig = {
    root,
    lowBody: lowBodyGroup,
    torso: torsoGroup,
    head: headGroup,
    rightArm: rightArmGroup,
    leftArm: leftArmGroup,
    rightLeg: rightLegGroup,
    leftLeg: leftLegGroup
  };

  console.log('✅ AuraMusic: Rig 3D completo de Jesuluto (12 cubos + capas exteriores) cargado!');
  if (jesulutoRenderer && jesulutoScene && jesulutoCamera) {
    jesulutoRenderer.render(jesulutoScene, jesulutoCamera);
  }
}

function updateJesulutoAnimation(currentTime, isPlaying) {
  if (!jesulutoRig || !isJesuluto3DInitialized) return;

  if (!isPlaying) {
    jesulutoRig.root.rotation.y = 0.2 + Math.sin(currentTime * 1.5) * 0.08;
    if (jesulutoRenderer && jesulutoScene && jesulutoCamera) {
      jesulutoRenderer.render(jesulutoScene, jesulutoCamera);
    }
    return;
  }

  // Baile de 41 ticks (tick 60.0 a 101.0)
  const animLen = 41.0;
  const currentTick = 60.0 + ((currentTime * 20.0) % animLen);

  function sampleKf(channelName) {
    const kfs = JESULUTO_DANCE_DATA[channelName];
    if (!kfs || kfs.length === 0) return { r: [0, 0, 0], t: [0, 0, 0] };

    let p0 = kfs[0];
    let p1 = kfs[kfs.length - 1];

    for (let i = 0; i < kfs.length - 1; i++) {
      if (currentTick >= kfs[i].tick && currentTick <= kfs[i + 1].tick) {
        p0 = kfs[i];
        p1 = kfs[i + 1];
        break;
      }
    }

    const span = p1.tick - p0.tick;
    const factor = span > 0 ? (currentTick - p0.tick) / span : 0;

    const r = [
      p0.r[0] + (p1.r[0] - p0.r[0]) * factor,
      p0.r[1] + (p1.r[1] - p0.r[1]) * factor,
      p0.r[2] + (p1.r[2] - p0.r[2]) * factor
    ];

    const t = [
      p0.t[0] + (p1.t[0] - p0.t[0]) * factor,
      p0.t[1] + (p1.t[1] - p0.t[1]) * factor,
      p0.t[2] + (p1.t[2] - p0.t[2]) * factor
    ];

    return { r, t };
  }

  const overlayKf = sampleKf('transform_overlay2');
  const lowBodyKf = sampleKf('pose:low_body');
  const torsoKf = sampleKf('pose:torso');
  const headKf = sampleKf('pose:head');
  const rArmKf = sampleKf('pose:right_arm');
  const lArmKf = sampleKf('pose:left_arm');
  const rLegKf = sampleKf('pose:right_leg');
  const lLegKf = sampleKf('pose:left_leg');

  // 1. Inclinación y balanceo corporal completo (transform_overlay2)
  jesulutoRig.root.rotation.z = overlayKf.r[2];
  jesulutoRig.root.rotation.y = 0.22 + Math.sin(currentTime * 2) * 0.12;

  // 2. Rebote y pelvis (low_body)
  jesulutoRig.lowBody.position.y = 12 + (lowBodyKf.t[1] || 0) * 0.6;
  jesulutoRig.lowBody.position.x = (lowBodyKf.t[0] || 0) * 0.6;
  jesulutoRig.lowBody.rotation.set(lowBodyKf.r[0], lowBodyKf.r[1], lowBodyKf.r[2]);

  // 3. Torso y Cabeza
  jesulutoRig.torso.rotation.set(torsoKf.r[0], torsoKf.r[1], torsoKf.r[2]);
  jesulutoRig.head.rotation.set(headKf.r[0], headKf.r[1], headKf.r[2]);

  // 4. Brazos (Rotación + Desplazamiento de baile)
  jesulutoRig.rightArm.rotation.set(rArmKf.r[0], rArmKf.r[1], rArmKf.r[2]);
  jesulutoRig.rightArm.position.set(5.5 + (rArmKf.t[0] || 0) * 0.4, 10 + (rArmKf.t[1] || 0) * 0.4, (rArmKf.t[2] || 0) * 0.4);

  jesulutoRig.leftArm.rotation.set(lArmKf.r[0], lArmKf.r[1], lArmKf.r[2]);
  jesulutoRig.leftArm.position.set(-5.5 + (lArmKf.t[0] || 0) * 0.4, 10 + (lArmKf.t[1] || 0) * 0.4, (lArmKf.t[2] || 0) * 0.4);

  // 5. Piernas (Rotación + Desplazamiento de pasos)
  jesulutoRig.rightLeg.rotation.set(rLegKf.r[0], rLegKf.r[1], rLegKf.r[2]);
  jesulutoRig.rightLeg.position.set(1.9 + (rLegKf.t[0] || 0) * 0.3, (rLegKf.t[1] || 0) * 0.3, (rLegKf.t[2] || 0) * 0.3);

  jesulutoRig.leftLeg.rotation.set(lLegKf.r[0], lLegKf.r[1], lLegKf.r[2]);
  jesulutoRig.leftLeg.position.set(-1.9 + (lLegKf.t[0] || 0) * 0.3, (lLegKf.t[1] || 0) * 0.3, (lLegKf.t[2] || 0) * 0.3);

  if (jesulutoRenderer && jesulutoScene && jesulutoCamera) {
    jesulutoRenderer.render(jesulutoScene, jesulutoCamera);
  }
}
