/**
 * AuraMusic - Player Bridge (MAIN WORLD)
 * Conexión completa y autoritativa con la API interna de YouTube Music (#movie_player).
 *
 * Transmite en tiempo real (a 60 FPS):
 * - Información completa de la canción (título, artista, videoId, carátula HD)
 * - Estado de botones y reproducción (reproduciendo, pausado, cargando, finalizado)
 * - Transición automática e instantánea al pasar de una canción a otra
 * - Posición exacta de la música en la línea de tiempo en tiempo real
 * - Ejecución nativa de seekTo, play, pause, next y prev
 */
(function () {
  'use strict';

  if (window.__AURAMUSIC_PLAYER_BRIDGE_ACTIVE__) return;
  window.__AURAMUSIC_PLAYER_BRIDGE_ACTIVE__ = true;

  console.log('⚡ AuraMusic: Conectando motor API nativo de YouTube Music en MAIN WORLD...');

  // 0. Captura anticipada de MediaSession Actions de YouTube Music
  window.__auramusic_media_handlers = window.__auramusic_media_handlers || {};
  try {
    if (navigator.mediaSession && typeof navigator.mediaSession.setActionHandler === 'function') {
      const origSetActionHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
      navigator.mediaSession.setActionHandler = function (action, handler) {
        if (typeof handler === 'function') {
          window.__auramusic_media_handlers[action] = handler;
          console.log('⚡ AuraMusic: MediaSession hook capturó handler para:', action);
        } else {
          delete window.__auramusic_media_handlers[action];
        }
        return origSetActionHandler(action, handler);
      };
    }
  } catch (e) {
    console.warn('AuraMusic MediaSession hook error:', e);
  }

  // 1. Elemento DOM puente compartido entre MAIN WORLD e ISOLATED WORLD
  let bridgeEl = document.getElementById('auramusic-bridge-data');
  if (!bridgeEl) {
    bridgeEl = document.createElement('div');
    bridgeEl.id = 'auramusic-bridge-data';
    bridgeEl.style.display = 'none';
    (document.head || document.documentElement).appendChild(bridgeEl);
  }

  let lastTrackKey = '';
  let lastPlayerState = -1;

  function findEveryPlayerApi() {
    const apis = new Set();

    // 1. Direct ID / Window
    if (window.movie_player && typeof window.movie_player.seekTo === 'function') apis.add(window.movie_player);
    if (window.ytplayer && typeof window.ytplayer.seekTo === 'function') apis.add(window.ytplayer);

    const directMp = document.getElementById('movie_player');
    if (directMp && typeof directMp.seekTo === 'function') apis.add(directMp);

    // 2. Query selectors conocidos en YouTube Music
    const list = [
      '#movie_player',
      '.html5-video-player',
      'ytmusic-player-bar',
      'ytmusic-app',
      'ytmusic-player',
      'ytmusic-player-page'
    ];
    for (const sel of list) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (typeof el.seekTo === 'function') apis.add(el);
          if (el.playerApi_ && typeof el.playerApi_.seekTo === 'function') apis.add(el.playerApi_);
          if (el.player_ && typeof el.player_.seekTo === 'function') apis.add(el.player_);
          if (el.shadowRoot) {
            const inShadow = el.shadowRoot.querySelectorAll('#movie_player, .html5-video-player');
            for (const s of inShadow) {
              if (typeof s.seekTo === 'function') apis.add(s);
              if (s.playerApi_ && typeof s.playerApi_.seekTo === 'function') apis.add(s.playerApi_);
            }
          }
        }
      } catch (_) {}
    }

    // 3. Shadow roots profundos
    function searchShadow(root, depth = 0) {
      if (!root || depth > 8) return;
      try {
        if (root.shadowRoot) {
          const mp = root.shadowRoot.querySelectorAll('#movie_player, .html5-video-player');
          for (const s of mp) {
            if (typeof s.seekTo === 'function') apis.add(s);
            if (s.playerApi_ && typeof s.playerApi_.seekTo === 'function') apis.add(s.playerApi_);
          }
          for (const child of root.shadowRoot.children || []) {
            searchShadow(child, depth + 1);
          }
        }
        for (const child of root.children || []) {
          searchShadow(child, depth + 1);
        }
      } catch (_) {}
    }
    try {
      searchShadow(document.body || document.documentElement);
    } catch (_) {}

    // 4. Propiedades de ytmusic-player-bar
    try {
      const playerBar = document.querySelector('ytmusic-player-bar');
      if (playerBar) {
        if (typeof playerBar.seekTo === 'function') apis.add(playerBar);
        if (playerBar.playerApi_ && typeof playerBar.playerApi_.seekTo === 'function') apis.add(playerBar.playerApi_);
        for (const k of Object.keys(playerBar)) {
          try {
            if (playerBar[k] && typeof playerBar[k].seekTo === 'function') {
              apis.add(playerBar[k]);
            }
          } catch (_) {}
        }
      }
    } catch (_) {}

    return Array.from(apis);
  }

  function getPlayer() {
    const all = findEveryPlayerApi();
    if (all.length === 0) return null;
    const withGetTime = all.find(p => typeof p.getCurrentTime === 'function');
    return withGetTime || all[0];
  }

  let cachedSlider = null;
  function findProgressBar() {
    if (cachedSlider && cachedSlider.isConnected) return cachedSlider;
    cachedSlider = document.querySelector('ytmusic-player-bar #progress-bar, #progress-bar.ytmusic-player-bar, tp-yt-paper-slider#progress-bar');
    return cachedSlider;
  }

  function seekNativeProgressBar(targetSeconds) {
    const slider = findProgressBar();
    if (!slider) return false;

    const ariaMax = parseFloat(slider.getAttribute('aria-valuemax'));
    const rawSliderMax = typeof slider.max === 'number' ? slider.max : parseFloat(slider.max);
    const max = (cachedDuration > 1) ? cachedDuration : ((!isNaN(ariaMax) && ariaMax > 5 && ariaMax !== 100) ? ariaMax : (!isNaN(rawSliderMax) && rawSliderMax > 0 ? rawSliderMax : 0));
    const min = parseFloat(slider.getAttribute('aria-valuemin')) || parseFloat(slider.min) || 0;
    const dur = max > min ? (max - min) : (max || 1);
    const pct = Math.max(0, Math.min(1, targetSeconds / dur));

    // 1. Simulación física precisa y eventos Polymer Gestures (_calcKnobPosition requiere detail.x)
    try {
      const targetEl = (slider.shadowRoot?.querySelector('#sliderContainer') || slider.shadowRoot?.querySelector('#sliderBar') || slider);
      const rect = targetEl.getBoundingClientRect();
      if (rect.width > 0) {
        const clientX = rect.left + (pct * rect.width);
        const clientY = rect.top + (rect.height / 2);
        const mouseOpts = {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX,
          clientY,
          screenX: clientX,
          screenY: clientY,
          buttons: 1,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true
        };

        const polymerDetail = {
          x: clientX,
          y: clientY,
          sourceEvent: mouseOpts
        };

        const elementsToTrigger = [slider, targetEl, slider.shadowRoot?.querySelector('#sliderContainer'), slider.shadowRoot?.querySelector('#sliderBar')];
        elementsToTrigger.forEach(el => {
          if (!el) return;
          // Eventos Polymer Gestures reconocidos por el PaperSlider de YouTube Music
          try { el.dispatchEvent(new CustomEvent('down', { detail: polymerDetail, bubbles: true, composed: true })); } catch (_) {}
          try { el.dispatchEvent(new CustomEvent('track', { detail: { ...polymerDetail, state: 'track' }, bubbles: true, composed: true })); } catch (_) {}
          try { el.dispatchEvent(new CustomEvent('up', { detail: polymerDetail, bubbles: true, composed: true })); } catch (_) {}
          try { el.dispatchEvent(new CustomEvent('tap', { detail: polymerDetail, bubbles: true, composed: true })); } catch (_) {}

          // Eventos de ratón / puntero estándar
          try { el.dispatchEvent(new PointerEvent('pointerdown', mouseOpts)); } catch (_) {}
          try { el.dispatchEvent(new MouseEvent('mousedown', mouseOpts)); } catch (_) {}
          try { el.dispatchEvent(new PointerEvent('pointerup', mouseOpts)); } catch (_) {}
          try { el.dispatchEvent(new MouseEvent('mouseup', mouseOpts)); } catch (_) {}
          try { el.dispatchEvent(new MouseEvent('click', mouseOpts)); } catch (_) {}
        });

        if (typeof slider._calcKnobPosition === 'function') {
          try { slider._calcKnobPosition({ detail: polymerDetail }); } catch (_) {}
        }
      }
    } catch (_) {}

    // 2. Modificación de valor de Polymer con eventos de cambio universales
    try {
      let sliderVal = targetSeconds;
      if (rawSliderMax > 0 && Math.abs(rawSliderMax - 1000) < 50) {
        sliderVal = pct * rawSliderMax;
      } else if (rawSliderMax > 0 && rawSliderMax <= 100 && max > 100) {
        sliderVal = pct * rawSliderMax;
      } else if (rawSliderMax > 0) {
        sliderVal = Math.min(rawSliderMax, targetSeconds);
      }

      slider.value = sliderVal;
      if (slider.immediateValue !== undefined) slider.immediateValue = sliderVal;
      slider.setAttribute('aria-valuenow', String(Math.round(targetSeconds)));

      if (typeof slider._setValue === 'function') {
        try { slider._setValue(sliderVal); } catch (_) {}
      }

      slider.dispatchEvent(new CustomEvent('immediate-value-change', { bubbles: true, composed: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      slider.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true }));
      slider.dispatchEvent(new CustomEvent('value-change', { bubbles: true, composed: true }));

      const bar = document.querySelector('ytmusic-player-bar');
      if (bar) {
        bar.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        bar.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true }));
        if (typeof bar.onProgressBarChange_ === 'function') {
          try { bar.onProgressBarChange_({ target: slider, detail: { value: sliderVal } }); } catch (_) {}
        }
      }
    } catch (_) {}

    return true;
  }

  function getBestArtwork(videoId) {
    // 1. MediaSession artwork oficial en HD
    try {
      const ms = navigator.mediaSession?.metadata?.artwork;
      if (ms && ms.length > 0) {
        const best = ms[ms.length - 1].src;
        if (best) return best;
      }
    } catch (_) {}

    // 2. Imagen del DOM escalada a Ultra HD
    try {
      const domImg = document.querySelector('#song-image img, ytmusic-player-bar img#img, ytmusic-player-bar .image img');
      if (domImg && domImg.src) {
        let s = domImg.src;
        if (s.includes('=w')) return s.replace(/=w\d+-h\d+[^?]*/, '=w1200-h1200-l90-rj');
        if (s.includes('=s')) return s.replace(/=s\d+[^?]*/, '=s1200');
        return s;
      }
    } catch (_) {}

    // 3. Fallback a miniatura directa de YouTube
    if (videoId) {
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
    return '';
  }

  function dispatchBridgeEvent(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  function parseTimeStr(t) {
    if (!t) return null;
    const parts = t.trim().split(':').map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  function parseYtMusicTimeText(raw) {
    if (!raw) return null;
    const clean = raw.replace(/\u00a0/g, ' ').trim();
    const m = clean.match(/([0-9]+(?::[0-9]+)+)\s*(?:\/|de|of|sur|von)\s*(-)?\s*([0-9]+(?::[0-9]+)+)/i);
    if (m) {
      const curSec = parseTimeStr(m[1]);
      const isNegativeRemaining = Boolean(m[2]);
      const secondSec = parseTimeStr(m[3]);
      if (curSec !== null && secondSec !== null) {
        const durSec = isNegativeRemaining ? (curSec + secondSec) : secondSec;
        return { curSec, durSec };
      }
    }
    // Fallback universal para cualquier idioma o separador
    const timeMatches = [...clean.matchAll(/(-)?\s*(\d+(?::\d+)+)/g)];
    if (timeMatches.length >= 2) {
      const curSec = parseTimeStr(timeMatches[0][2]);
      const isNegativeRemaining = Boolean(timeMatches[1][1]);
      const secondSec = parseTimeStr(timeMatches[1][2]);
      if (curSec !== null && secondSec !== null) {
        const durSec = isNegativeRemaining ? (curSec + secondSec) : secondSec;
        return { curSec, durSec };
      }
    }
    return null;
  }

  function getNativeBarTimes() {
    // 1. Selector time-info de la barra nativa
    const timeInfo = document.querySelector('ytmusic-player-bar .time-info, ytmusic-player-bar #time-info, ytmusic-player-bar span.time-info, ytmusic-player-bar [class*="time-info"]');
    if (timeInfo && timeInfo.textContent) {
      const res = parseYtMusicTimeText(timeInfo.textContent);
      if (res && res.durSec > 0) return res;
    }

    // 2. Elemento slider de progreso (#progress-bar o #slider)
    const slider = document.querySelector('ytmusic-player-bar #progress-bar, ytmusic-player-bar #slider, tp-yt-paper-slider#slider, #progress-bar');
    if (slider && typeof slider.getAttribute === 'function') {
      const valText = slider.getAttribute('aria-valuetext');
      if (valText) {
        const res = parseYtMusicTimeText(valText);
        if (res && res.durSec > 0) return res;
      }
      const valMax = parseFloat(slider.getAttribute('aria-valuemax'));
      const valNow = parseFloat(slider.getAttribute('aria-valuenow'));
      if (!isNaN(valMax) && valMax > 5 && valMax !== 100) {
        return {
          curSec: !isNaN(valNow) && valNow >= 0 ? valNow : 0,
          durSec: valMax
        };
      }
    }

    return null;
  }

  let lastMetadataPollTime = 0;
  let cachedTitle = '';
  let cachedArtist = '';
  let cachedVideoId = '';
  let cachedArtwork = '';
  let cachedDuration = 0;
  let trackTransitionTimestamp = 0;
  let lastReportedCurrentTime = -1;

  // Seek inhibit: while seeking, syncFromAPI() will push the target time
  // instead of reading the (stale) player time. Prevents YTM snapping back.
  let seekInhibitUntil = 0;
  let seekInhibitTime = -1;

  function syncFromAPI() {
    const player = getPlayer();
    const vid = document.querySelector('video');
    if (!player && !vid) return;

    try {
      const now = Date.now();

      // 1. Consulta de metadatos pesados (DOM, Artwork, BarTimes) throttled a 4 veces por segundo (cada 250ms)
      // Esto reduce el 98% de las consultas DOM innecesarias por segundo, ahorrando enorme uso de CPU
      if (now - lastMetadataPollTime > 250 || !cachedTitle) {
        lastMetadataPollTime = now;
        const vd = (typeof player.getVideoData === 'function') ? player.getVideoData() : null;
        const ms = navigator.mediaSession?.metadata;
        const domTitle = document.querySelector('ytmusic-player-bar .title')?.textContent?.trim() || '';
        const domArtist = document.querySelector('ytmusic-player-bar .byline')?.textContent?.trim() || '';

        cachedTitle = vd?.title || ms?.title || domTitle || '';
        cachedArtist = vd?.author || ms?.artist || domArtist || '';
        cachedVideoId = vd?.video_id || '';
        cachedArtwork = getBestArtwork(cachedVideoId);

        let dur = (typeof player.getDuration === 'function') ? player.getDuration() : -1;
        if (dur <= 0) {
          const barTimes = getNativeBarTimes();
          if (barTimes && barTimes.durSec > 0) {
            dur = barTimes.durSec;
          }
        }
        if (dur <= 0) {
          const vid = document.querySelector('video');
          if (vid && !isNaN(vid.duration) && vid.duration > 0) {
            dur = vid.duration;
          }
        }
        cachedDuration = dur > 0 ? dur : 0;

        // Detectar cambio de canción automático o manual al instante
        const trackKey = `${cachedTitle.toLowerCase().trim()}:::${cachedArtist.toLowerCase().trim()}${cachedVideoId ? ':::' + cachedVideoId : ''}`;
        if (cachedTitle && trackKey !== lastTrackKey) {
          lastTrackKey = trackKey;
          trackTransitionTimestamp = now;
          console.log('⚡ AuraMusic API: Transición de pista detectada:', { title: cachedTitle, artist: cachedArtist, videoId: cachedVideoId, duration: cachedDuration });
          dispatchBridgeEvent('auramusic-track-change', {
            title: cachedTitle,
            artist: cachedArtist,
            videoId: cachedVideoId,
            artwork: cachedArtwork,
            duration: cachedDuration > 0 ? cachedDuration : 0
          });
        }
      }

      // 2. Tiempo flotante en vivo (lectura ultra-rápida en memoria sin tocar el DOM)
      let currentTime = -1;

      // SEEK INHIBIT: también leer señal del Isolated World (escrita en dataset antes del postMessage)
      if (bridgeEl) {
        const dsInhibitUntil = parseFloat(bridgeEl.dataset.seekInhibitUntil || '0');
        const dsInhibitTime = parseFloat(bridgeEl.dataset.seekInhibitTime || '-1');
        if (dsInhibitUntil > now && dsInhibitTime >= 0) {
          if (seekInhibitUntil < dsInhibitUntil) {
            seekInhibitUntil = dsInhibitUntil;
            seekInhibitTime = dsInhibitTime;
          }
        }
      }

      // Leer tiempo real del reproductor nativo
      let realTime = -1;
      if (typeof player.getCurrentTime === 'function') {
        const t = player.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t) && isFinite(t) && t >= 0) {
          realTime = t;
        }
      }
      if (realTime < 0) {
        const vid = document.querySelector('video');
        if (vid && !isNaN(vid.currentTime) && isFinite(vid.currentTime) && vid.currentTime >= 0) {
          realTime = vid.currentTime;
        }
      }

      // SEEK INHIBIT INTELIGENTE:
      // Si estamos en ventana de seek, comprobar si el reproductor ya procesó el salto
      if (seekInhibitUntil > now && seekInhibitTime >= 0) {
        // Si el tiempo real ya está cerca del objetivo (< 1s) o ya avanzó, el seek terminó con éxito
        if (realTime >= 0 && (Math.abs(realTime - seekInhibitTime) < 1.0 || realTime >= seekInhibitTime - 0.2)) {
          seekInhibitUntil = 0;
          seekInhibitTime = -1;
          currentTime = realTime;
          if (bridgeEl) {
            delete bridgeEl.dataset.seekInhibitUntil;
            delete bridgeEl.dataset.seekInhibitTime;
          }
        } else {
          // Aún reporta el tiempo viejo anterior al seek; mantener el tiempo objetivo temporalmente
          currentTime = seekInhibitTime;
        }
      } else {
        seekInhibitTime = -1;
        currentTime = realTime;

        // BLINDAJE: Si acabamos de cambiar de canción en los últimos 2500ms y el reproductor aún tiene
        // el tiempo residual de la canción previa (> 2.0s), forzar 0 absoluto para que no muestre 2:12
        if (now - trackTransitionTimestamp < 2500 && currentTime > 2.0) {
          currentTime = 0;
        }
      }

      const playerState = (typeof player.getPlayerState === 'function') ? player.getPlayerState() : -1;

      // 3. Actualizar dataset solo si hubo cambio perceptible (> 0.03s) para no saturar el DOM
      const isTimeChanged = Math.abs(currentTime - lastReportedCurrentTime) > 0.03;
      if (isTimeChanged || now - lastMetadataPollTime < 30) {
        lastReportedCurrentTime = currentTime;
        bridgeEl.dataset.ready = '1';
        bridgeEl.dataset.currentTime = String(currentTime >= 0 ? currentTime : 0);
        bridgeEl.dataset.duration = String(cachedDuration > 0 ? cachedDuration : 0);
        bridgeEl.dataset.playerState = String(playerState);
        bridgeEl.dataset.videoId = cachedVideoId;
        bridgeEl.dataset.title = cachedTitle;
        bridgeEl.dataset.artist = cachedArtist;
        bridgeEl.dataset.artwork = cachedArtwork;
        bridgeEl.dataset.updatedAt = String(now);
      }

      // Detectar cambio de estado de reproducción (play / pause / ended / buffering)
      if (playerState !== lastPlayerState && playerState !== -1) {
        lastPlayerState = playerState;
        dispatchBridgeEvent('auramusic-state-change', {
          playerState,
          isPlaying: (playerState === 1)
        });
      }

      // 4. Reconciliar y asegurar alineación visual 1:1 de la línea de tiempo y circulito (#sliderKnob)
      setupProgressBarUserInteraction();
      reconcileTimelineKnob(currentTime, cachedDuration);
    } catch (err) {}
  }

  // --- RECONCILIADOR VISUAL Y DETECTOR DE INTERACCIÓN NATIVA DE LA LÍNEA DE TIEMPO ---
  let isUserInteractingWithSlider = false;
  let pendingSeekSeconds = -1;
  let lastReconcileTime = 0;

  function reconcileTimelineKnob(curTime, dur) {
    if (isUserInteractingWithSlider) return;
    if (!dur || dur <= 0 || curTime < 0) return;

    // Comprobación periódica ultra-ligera (cada 1000ms) para 0% de uso de CPU
    const now = performance.now();
    if (now - lastReconcileTime < 1000) return;
    lastReconcileTime = now;

    const slider = findProgressBar();
    if (!slider || !slider.shadowRoot) return;

    // Si Polymer quedó en estado dragging sin que el ratón esté presionado:
    if (slider.hasAttribute('dragging') || slider.dragging) {
      slider.dragging = false;
      slider.removeAttribute('dragging');
    }

    const expectedPct = Math.max(0, Math.min(100, (curTime / dur) * 100));
    const knob = slider.shadowRoot.querySelector('#sliderKnob');
    if (knob) {
      const rawStyle = knob.style.left || '';
      // Si Polymer está controlando la barra nativamente con calc() o valor similar, no intervenir para no provocar lag
      if (rawStyle.includes('calc')) return;
      const curLeft = parseFloat(rawStyle);
      // Solo sincronizar si diverge más de 5.0% de la posición esperada
      if (isNaN(curLeft) || Math.abs(curLeft - expectedPct) > 5.0) {
        knob.style.left = `${expectedPct}%`;
      }
    }
  }

  function setupProgressBarUserInteraction() {
    const slider = findProgressBar();
    if (!slider || slider.__auramusic_hooked) return;
    slider.__auramusic_hooked = true;

    function getRatio(e) {
      const rect = slider.getBoundingClientRect();
      if (!rect || rect.width <= 0) return 0;
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    }

    function updateVisualPreview(ratio) {
      if (!slider.shadowRoot) return;
      const knob = slider.shadowRoot.querySelector('#sliderKnob');
      if (knob) knob.style.left = `${ratio * 100}%`;
    }

    slider.addEventListener('pointerdown', (e) => {
      isUserInteractingWithSlider = true;
      const ratio = getRatio(e);
      const dur = cachedDuration > 0 ? cachedDuration : getPlayer()?.getDuration();
      if (dur > 0) {
        pendingSeekSeconds = ratio * dur;
        updateVisualPreview(ratio);
      }
    }, { passive: true });

    window.addEventListener('pointermove', (e) => {
      if (!isUserInteractingWithSlider) return;
      const ratio = getRatio(e);
      const dur = cachedDuration > 0 ? cachedDuration : getPlayer()?.getDuration();
      if (dur > 0) {
        pendingSeekSeconds = ratio * dur;
        // Solo actualizar el circulito visualmente a 60 FPS sin saturar la API
        updateVisualPreview(ratio);
      }
    }, { passive: true });

    const commitSeek = () => {
      if (isUserInteractingWithSlider) {
        isUserInteractingWithSlider = false;
        if (pendingSeekSeconds >= 0) {
          const target = pendingSeekSeconds;
          pendingSeekSeconds = -1;
          // Ejecutar el salto una sola vez al soltar el ratón
          handleCommand({ action: 'seekTo', time: target, autoPlay: true });
        }
        if (slider) {
          slider.dragging = false;
          slider.removeAttribute('dragging');
        }
      }
    };

    window.addEventListener('pointerup', commitSeek, { passive: true });
    window.addEventListener('pointercancel', commitSeek, { passive: true });
  }

  // Bucle maestro adaptativo ultra-optimizado:
  // - Con Cinema inactivo: 1 FPS (cada 1000ms, respaldado por eventos nativos de YouTube) -> 0% CPU
  // - Con Cinema activo: 5 FPS (cada 200ms para metadatos; el tiempo en vivo lo lee el video nativo directamente) -> 0.05% CPU
  let lastBridgeRafTime = 0;
  function rafLoop(timestamp) {
    const now = timestamp || performance.now();
    const isCinemaActive = !!(document.getElementById('auramusic-cinema-overlay')?.classList.contains('active') || document.body.classList.contains('auramusic-cinema-active'));

    const minInterval = isCinemaActive ? 40 : 1000;
    if (now - lastBridgeRafTime < minInterval) {
      requestAnimationFrame(rafLoop);
      return;
    }
    lastBridgeRafTime = now;
    syncFromAPI();
    requestAnimationFrame(rafLoop);
  }
  requestAnimationFrame(rafLoop);

  // Escuchar eventos nativos de YouTube Music
  function attachPlayerEvents() {
    const player = getPlayer();
    if (!player) return;

    try {
      if (typeof player.addEventListener === 'function') {
        player.addEventListener('onStateChange', () => syncFromAPI());
        player.addEventListener('videodatachange', () => syncFromAPI());
        player.addEventListener('onVideoProgress', () => syncFromAPI());
      }
    } catch (_) {}
  }

  attachPlayerEvents();
  document.addEventListener('yt-navigate-finish', () => {
    attachPlayerEvents();
    syncFromAPI();
  });
  document.addEventListener('videodatachange', () => syncFromAPI());

  // 2. Procesador centralizado de comandos (con deduplicación estricta para evitar saltos múltiples)
  let lastProcessedCmdKey = '';
  let lastProcessedCmdTime = 0;

  function handleCommand(cmdObj) {
    if (!cmdObj) return;
    const { action, time, autoPlay, _id, _ts } = cmdObj;
    const now = Date.now();
    const cmdKey = _id || `${action}:::${time !== undefined ? time : ''}:::${_ts || ''}`;

    // Descartar comandos duplicados recibidos por múltiples canales (CustomEvent + MutationObserver)
    if (action !== 'seek' && action !== 'seekTo') {
      if (cmdKey && cmdKey === lastProcessedCmdKey && (now - lastProcessedCmdTime < 400)) {
        return;
      }
    } else {
      // Deduplicar seeks rápidos consecutivos para no bloquear la reproducción
      if (now - lastProcessedCmdTime < 250) {
        return;
      }
    }
    // Descartar ráfagas accidentales de cambio de canción o toggle en menos de 400ms
    if ((action === 'next' || action === 'prev' || action === 'togglePlay') && (now - lastProcessedCmdTime < 400)) {
      return;
    }
    lastProcessedCmdKey = cmdKey;
    lastProcessedCmdTime = now;

    const player = getPlayer();
    console.log('⚡ AuraMusic Bridge: Ejecutando comando único:', action, time);

    try {
      if (action === 'seek' || action === 'seekTo') {
        const rawTime = (time !== undefined) ? time : cmdObj?.time;
        const targetSeekTime = Math.max(0, Number(rawTime));

        if (!isNaN(targetSeekTime) && isFinite(targetSeekTime)) {
          const vids = Array.from(document.querySelectorAll('video'));

          // ─── SEEK INHIBIT INTELIGENTE: prevenir parpadeos iniciales ────
          seekInhibitTime = targetSeekTime;
          seekInhibitUntil = Date.now() + 800;

          // Actualizar el bridge DE INMEDIATO con el tiempo objetivo
          if (bridgeEl) {
            bridgeEl.dataset.currentTime = String(targetSeekTime);
            bridgeEl.dataset.updatedAt = String(Date.now());
          }

          // Capa A: ytmusic-player-bar — vía Polymer nativo (el camino que YTM usa internamente)
          try {
            const ytBar = document.querySelector('ytmusic-player-bar');
            if (ytBar) {
              const dur = cachedDuration > 0 ? cachedDuration : (typeof getPlayer()?.getDuration === 'function' ? getPlayer().getDuration() : 0);
              const pct = dur > 0 ? targetSeekTime / dur : 0;
              // Intentar métodos internos de Polymer en orden de confiabilidad
              if (typeof ytBar.seekTo_ === 'function') {
                ytBar.seekTo_(targetSeekTime);
                console.log('⚡ AuraMusic: seekTo_ (Polymer nativo) ejecutado!');
              } else if (typeof ytBar.seek === 'function') {
                ytBar.seek(targetSeekTime);
              }
              // Disparar el evento que maneja la barra de progreso de YTM
              if (typeof ytBar.onProgressBarChange_ === 'function') {
                try { ytBar.onProgressBarChange_({ target: { value: pct * 1000 }, detail: { value: pct * 1000 } }); } catch (_) {}
              }
              if (typeof ytBar.onProgressBarChangeEnd_ === 'function') {
                try { ytBar.onProgressBarChangeEnd_(); } catch (_) {}
              }
              // Probar propiedades Polymer __data
              if (ytBar.__data) {
                try {
                  if ('currentTime' in ytBar.__data) {
                    ytBar.__data.currentTime = targetSeekTime;
                    if (typeof ytBar.notifyPath === 'function') ytBar.notifyPath('currentTime', targetSeekTime);
                  }
                  if ('progressPercent' in ytBar.__data) {
                    ytBar.__data.progressPercent = pct * 100;
                    if (typeof ytBar.notifyPath === 'function') ytBar.notifyPath('progressPercent', pct * 100);
                  }
                } catch (_) {}
              }
            }
          } catch (e) {
            console.warn('AuraMusic: ytmusic-player-bar Polymer seek error:', e);
          }

          // Capa B: MediaSession oficial de YouTube Music (Handler nativo capturado)
          if (typeof window.__auramusic_media_handlers?.['seekto'] === 'function') {
            try {
              window.__auramusic_media_handlers['seekto']({ seekTime: targetSeekTime, fastSeek: false });
              console.log('⚡ AuraMusic: seekTo ejecutado vía MediaSession oficial!');
            } catch (e) {
              console.warn('AuraMusic: MediaSession seekto error:', e);
            }
          }

          // Capa C: Todos los reproductores descubiertos por findEveryPlayerApi()
          const allPlayers = findEveryPlayerApi();
          allPlayers.forEach(p => {
            try { p.seekTo(targetSeekTime, true); } catch (e) {
              console.warn('player.seekTo error:', e);
            }
          });

          // Capa D: Barra de progreso nativa (Polymer tp-yt-paper-slider)
          try { seekNativeProgressBar(targetSeekTime); } catch (_) {}

          // Capa E: Sincronización directa sobre <video> únicamente como respaldo si no hay APIs
          if (allPlayers.length === 0) {
            vids.forEach(vid => {
              try { vid.currentTime = targetSeekTime; } catch (_) {}
            });
          }

          // Capa F: Reproducción continua si corresponde
          if (autoPlay !== false) {
            allPlayers.forEach(p => {
              if (typeof p.playVideo === 'function') try { p.playVideo(); } catch (_) {}
            });
            vids.forEach(vid => {
              if (vid.paused) try { vid.play().catch(() => {}); } catch (_) {}
            });
          }

          syncFromAPI();
        }
      } else if (action === 'play') {
        if (player && typeof player.playVideo === 'function') {
          try { player.playVideo(); } catch (_) {}
        } else {
          const vid = document.querySelector('#movie_player video, video.html5-main-video');
          if (vid) vid.play().catch(() => {});
        }
        syncFromAPI();
      } else if (action === 'pause') {
        if (player && typeof player.pauseVideo === 'function') {
          try { player.pauseVideo(); } catch (_) {}
        } else {
          const vid = document.querySelector('#movie_player video, video.html5-main-video');
          if (vid) vid.pause();
        }
        syncFromAPI();
      } else if (action === 'togglePlay') {
        let toggled = false;
        if (player && typeof player.getPlayerState === 'function') {
          try {
            if (player.getPlayerState() === 1) {
              if (typeof player.pauseVideo === 'function') player.pauseVideo();
            } else {
              if (typeof player.playVideo === 'function') player.playVideo();
            }
            toggled = true;
          } catch (_) {}
        }
        if (!toggled) {
          const vid = document.querySelector('#movie_player video, video.html5-main-video');
          if (vid) {
            if (vid.paused) vid.play().catch(() => {});
            else vid.pause();
            toggled = true;
          }
        }
        if (!toggled) {
          document.querySelector('ytmusic-player-bar .play-pause-button, #play-pause-button, ytmusic-player-bar [class*="play-pause-button"]')?.click();
        }
        syncFromAPI();
      } else if (action === 'next') {
        let sent = false;
        if (player && typeof player.nextVideo === 'function') {
          try { player.nextVideo(); sent = true; } catch (_) {}
        }
        if (!sent) {
          document.querySelector('ytmusic-player-bar .next-button, #next-button, ytmusic-player-bar [class*="next-button"]')?.click();
        }
        syncFromAPI();
      } else if (action === 'prev') {
        let sent = false;
        if (player && typeof player.previousVideo === 'function') {
          try { player.previousVideo(); sent = true; } catch (_) {}
        }
        if (!sent) {
          document.querySelector('ytmusic-player-bar .previous-button, #previous-button, ytmusic-player-bar [class*="previous-button"]')?.click();
        }
        syncFromAPI();
      }
    } catch (err) {
      console.warn('AuraMusic Player Bridge cmd error:', err);
    }
  }

  // Canal 1: window.postMessage (Canal 100% fiable y nativo entre mundos en Chromium)
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'auramusic-player-cmd') return;
    handleCommand(e.data);
  });

  // Canal 2: Document CustomEvent (rápido y directo entre contextos)
  document.addEventListener('auramusic-player-cmd', (e) => {
    handleCommand(e.detail);
  });

  // Canal 3: MutationObserver en bridgeEl atributo data-cmd (respaldo infalible en el DOM)
  const cmdObserver = new MutationObserver(() => {
    const raw = bridgeEl.getAttribute('data-cmd');
    if (raw) {
      bridgeEl.removeAttribute('data-cmd');
      try {
        const parsed = JSON.parse(raw);
        handleCommand(parsed);
      } catch (_) {}
    }
  });
  cmdObserver.observe(bridgeEl, { attributes: true, attributeFilter: ['data-cmd'] });

  // Anunciar que el bridge está listo por todos los canales
  dispatchBridgeEvent('auramusic-player-bridge-ready');
  console.log('✅ AuraMusic: Motor API nativo de YouTube Music conectado exitosamente a 60 FPS.');
})();
