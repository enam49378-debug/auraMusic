// ============================================================================
// AuraMusic - AuraPlayer: Reproductor Autónomo de Doble Deck (crossfade.js)
// Arquitectura 100% Propietaria: Control Total de Audio, Cero Dependencia de YouTube
// ============================================================================

(function() {
  'use strict';

  // 1. Estado del Reproductor Autónomo AuraPlayer
  const AuraPlayer = {
    deck1: null,
    deck2: null,
    activeDeckNum: 1, // 1 o 2
    currentVideoId: '',
    nextVideoId: '',
    isCrossfading: false,
    isPlaying: false,
    fadeInterval: null,
    watchdogInterval: null,
    isProgrammaticNav: false,
    lastNavTime: 0,

    getActiveDeck: function() {
      return this.activeDeckNum === 1 ? this.deck1 : this.deck2;
    },

    getInactiveDeck: function() {
      return this.activeDeckNum === 1 ? this.deck2 : this.deck1;
    },

    getActiveDeckNum: function() {
      return this.activeDeckNum;
    },

    swapDecks: function() {
      this.activeDeckNum = this.activeDeckNum === 1 ? 2 : 1;
    }
  };

  // 2. Extraer el VideoId actual de YouTube Music
  function getCurrentYouTubeVideoId() {
    const fromPlayer = document.querySelector('#movie_player')?.getVideoData?.()?.video_id;
    if (fromPlayer && fromPlayer.length === 11) return fromPlayer;
    const fromUrl = new URLSearchParams(window.location.search).get('v');
    if (fromUrl && fromUrl.length === 11) return fromUrl;
    return '';
  }

  // 3. Extraer el VideoId de la siguiente canción de la lista (Álbum / Cola)
  function getNextTrackVideoId() {
    const curId = AuraPlayer.currentVideoId || getCurrentYouTubeVideoId();

    function isValid(id) {
      return id && typeof id === 'string' && id.length === 11 && id !== curId;
    }

    // A. Del puente del contexto principal (Polymer Memory)
    const fromBridge = document.documentElement.dataset.auramusicNextVideoId;
    if (isValid(fromBridge)) return fromBridge;

    // B. De la API interna #movie_player
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.getPlaylist === 'function') {
        const list = player.getPlaylist();
        const curVid = curId || player.getVideoData?.()?.video_id;
        const idx = (Array.isArray(list) && curVid) ? list.indexOf(curVid) : (typeof player.getPlaylistIndex === 'function' ? player.getPlaylistIndex() : -1);
        if (Array.isArray(list) && idx >= 0 && idx + 1 < list.length) {
          const id = list[idx + 1];
          if (isValid(id)) return id;
        }
      }
    } catch (e) {}

    // C. De la lista de canciones en pantalla (Álbumes / Responsive Tracklist)
    try {
      const allRows = Array.from(document.querySelectorAll('ytmusic-responsive-list-item-renderer'));
      let activeIdx = -1;
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        if (row.querySelector('[play-button-state="playing"], .playing-icon, ytmusic-play-button-renderer[state="playing"]') || row.classList.contains('selected')) {
          activeIdx = i;
          break;
        }
      }
      if (activeIdx >= 0 && activeIdx + 1 < allRows.length) {
        const nextRow = allRows[activeIdx + 1];
        const link = nextRow.querySelector('a[href*="watch?v="]');
        if (link && link.href) {
          const m = link.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (m && isValid(m[1])) return m[1];
        }
      }
    } catch (e) {}

    // D. De los elementos visibles de la cola en el DOM
    try {
      const queueItems = Array.from(document.querySelectorAll('ytmusic-player-queue-item'));
      const activeQueueIdx = queueItems.findIndex(el => 
        el.hasAttribute('selected') || 
        el.classList.contains('selected') || 
        el.querySelector('[play-button-state="playing"]')
      );
      if (activeQueueIdx >= 0 && activeQueueIdx + 1 < queueItems.length) {
        const nextQueueItem = queueItems[activeQueueIdx + 1];
        const link = nextQueueItem.querySelector('a[href*="watch?v="]');
        if (link && link.href) {
          const m = link.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (m && isValid(m[1])) return m[1];
        }
      }
    } catch (e) {}

    return '';
  }

  // 4. Curvas de Ganancia Acústica
  function calculateGainCurve(progress, curveType = 'equal-power') {
    const p = Math.max(0, Math.min(1, progress));
    if (curveType === 'equal-power') {
      return {
        gainA: Math.cos(p * 0.5 * Math.PI),
        gainB: Math.sin(p * 0.5 * Math.PI)
      };
    } else if (curveType === 'smoothstep') {
      const s = p * p * (3 - 2 * p);
      return { gainA: 1 - s, gainB: s };
    } else {
      return { gainA: 1 - p, gainB: p };
    }
  }

  // 5. Silenciamiento Absoluto de YouTube (YouTube NO emite audio)
  function enforceYouTubeSilent() {
    if (!window.state?.crossfade) return;

    const video = document.querySelector('video');
    if (video) {
      if (video.volume > 0) {
        try { video.volume = 0; } catch (e) {}
      }
      if (!video.muted) {
        try { video.muted = true; } catch (e) {}
      }
    }

    const player = document.querySelector('#movie_player');
    if (player && typeof player.setVolume === 'function' && typeof player.getVolume === 'function') {
      if (player.getVolume() > 0) {
        try { player.setVolume(0); } catch (e) {}
      }
    }
  }

  // 6. Avanzar la interfaz visual de YouTube Music a la siguiente pista
  function navigateYouTubeUIToTrack(targetId) {
    const now = performance.now();
    if (now - AuraPlayer.lastNavTime < 2500) return;
    AuraPlayer.lastNavTime = now;
    AuraPlayer.isProgrammaticNav = true;

    // A. Si estamos en un álbum en pantalla, hacer clic en la siguiente fila
    try {
      const allRows = Array.from(document.querySelectorAll('ytmusic-responsive-list-item-renderer'));
      let activeIdx = -1;
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        if (row.querySelector('[play-button-state="playing"], .playing-icon, ytmusic-play-button-renderer[state="playing"]') || row.classList.contains('selected')) {
          activeIdx = i;
          break;
        }
      }
      if (activeIdx >= 0 && activeIdx + 1 < allRows.length) {
        const nextRow = allRows[activeIdx + 1];
        const playBtn = nextRow.querySelector('ytmusic-play-button-renderer, .play-button, #play-button, a[href*="watch?v="]');
        if (playBtn) {
          playBtn.click();
          console.log('🔀 AuraPlayer: Interfaz de álbum actualizada a la siguiente fila.');
          setTimeout(() => { AuraPlayer.isProgrammaticNav = false; }, 1200);
          return;
        }
      }
    } catch (e) {}

    // B. Si la cola está abierta, avanzar en la cola
    try {
      const queueItems = Array.from(document.querySelectorAll('ytmusic-player-queue-item'));
      const activeQueueIdx = queueItems.findIndex(el => 
        el.hasAttribute('selected') || 
        el.classList.contains('selected') || 
        el.querySelector('[play-button-state="playing"]')
      );
      if (activeQueueIdx >= 0 && activeQueueIdx + 1 < queueItems.length) {
        const nextQueueItem = queueItems[activeQueueIdx + 1];
        const playBtn = nextQueueItem.querySelector('.play-button, ytmusic-play-button-renderer, #play-button');
        if (playBtn) {
          playBtn.click();
          console.log('🔀 AuraPlayer: Interfaz de cola actualizada.');
          setTimeout(() => { AuraPlayer.isProgrammaticNav = false; }, 1200);
          return;
        }
      }
    } catch (e) {}

    // C. Por API movie_player
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.nextVideo === 'function') {
        player.nextVideo();
        if (typeof player.playVideo === 'function') player.playVideo();
        console.log('🔀 AuraPlayer: Siguiente canción activada con movie_player.nextVideo().');
        setTimeout(() => { AuraPlayer.isProgrammaticNav = false; }, 1200);
        return;
      }
    } catch (e) {}

    // D. Botón next en la barra
    try {
      const nextBtn = document.querySelector('ytmusic-player-bar .next-button, #next-button');
      if (nextBtn) nextBtn.click();
    } catch (e) {}

    setTimeout(() => { AuraPlayer.isProgrammaticNav = false; }, 1200);
  }

  // 7. Actualizar la barra inferior de YouTube Music (Minutero, Progreso y Botón Play/Pausa)
  function updatePlayerBarUI(cur, dur, isPlaying) {
    if (!dur || dur <= 0 || isNaN(dur)) return;

    // A. Texto del minutero (ej. "1:15 / 2:48")
    const timeInfo = document.querySelector('ytmusic-player-bar .time-info, ytmusic-player-bar #time-info, .time-info');
    if (timeInfo) {
      const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      timeInfo.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }

    // B. Slider de progreso (#progress-bar)
    const progressBar = document.querySelector('ytmusic-player-bar #progress-bar, #progress-bar');
    if (progressBar) {
      progressBar.value = cur;
      progressBar.max = dur;
      progressBar.setAttribute('value', cur);
      progressBar.setAttribute('max', dur);
    }

    // C. Relleno visual del slider (#primaryProgress)
    const primaryProgress = document.querySelector('ytmusic-player-bar #primaryProgress, ytmusic-player-bar #sliderBar #primaryProgress');
    if (primaryProgress) {
      const pct = Math.max(0, Math.min(1, cur / dur));
      primaryProgress.style.transform = `scaleX(${pct})`;
      primaryProgress.style.transformOrigin = 'left center';
    }

    // D. Reflejar estado de Play / Pausa en el botón nativo
    const playPauseBtn = document.querySelector('ytmusic-player-bar #play-pause-button, #play-pause-button');
    if (playPauseBtn) {
      const icon = playPauseBtn.querySelector('iron-icon, yt-icon, svg');
      if (icon) {
        if (isPlaying) {
          playPauseBtn.setAttribute('title', 'Pausar');
          playPauseBtn.setAttribute('aria-label', 'Pausar');
        } else {
          playPauseBtn.setAttribute('title', 'Reproducir');
          playPauseBtn.setAttribute('aria-label', 'Reproducir');
        }
      }
    }
  }

  // 8. Cargar y reproducir una canción en un Deck de AuraPlayer
  async function loadTrackIntoDeck(deckNum, videoId) {
    try {
      console.log(`🔀 AuraPlayer: Precargando pista "${videoId}" en Deck ${deckNum}...`);
      const res = await fetch(`http://localhost:8080/prefetch?id=${videoId}`);
      if (!res.ok) throw new Error('Servidor companion devolvió error HTTP');
      const data = await res.json();
      if (!data || !data.url) throw new Error('URL de audio inválida');

      const audio = new Audio(data.url);
      audio.preload = 'auto';

      if (deckNum === 1) {
        if (AuraPlayer.deck1) {
          try { AuraPlayer.deck1.pause(); AuraPlayer.deck1.src = ''; } catch (e) {}
        }
        AuraPlayer.deck1 = audio;
      } else {
        if (AuraPlayer.deck2) {
          try { AuraPlayer.deck2.pause(); AuraPlayer.deck2.src = ''; } catch (e) {}
        }
        AuraPlayer.deck2 = audio;
      }

      console.log(`✅ AuraPlayer: Deck ${deckNum} listo con audio de "${videoId}".`);
      return audio;
    } catch (e) {
      console.warn(`❌ AuraPlayer: Error al cargar en Deck ${deckNum}:`, e.message);
      return null;
    }
  }

  // 9. Iniciar reproducción de una canción en AuraPlayer
  async function playTrack(videoId) {
    if (!videoId) return;

    // Si ya es la canción que está sonando, solo asegurarse de que esté en Play
    if (AuraPlayer.currentVideoId === videoId && AuraPlayer.getActiveDeck()) {
      const active = AuraPlayer.getActiveDeck();
      if (active.paused) {
        active.play().catch(() => {});
        AuraPlayer.isPlaying = true;
      }
      return;
    }

    AuraPlayer.currentVideoId = videoId;
    AuraPlayer.nextVideoId = '';
    AuraPlayer.isCrossfading = false;

    // Silenciar YouTube nativo inmediatamente
    enforceYouTubeSilent();

    const targetDeckNum = AuraPlayer.activeDeckNum;
    const audio = await loadTrackIntoDeck(targetDeckNum, videoId);
    if (!audio) return;

    audio.volume = 1.0;
    audio.currentTime = 0;
    audio.play().then(() => {
      AuraPlayer.isPlaying = true;
      console.log(`🎵 AuraPlayer: Reproduciendo "${videoId}" en Deck ${targetDeckNum} al 100% de volumen.`);
    }).catch(e => {
      console.warn('Error al reproducir audio de AuraPlayer:', e.message);
    });
  }

  // 10. Disparar el Crossfade de Estudio entre Deck 1 y Deck 2
  function startAuraCrossfade(fadeSec, nextVideoId) {
    if (AuraPlayer.isCrossfading) return;
    AuraPlayer.isCrossfading = true;

    const outgoingDeck = AuraPlayer.getActiveDeck();
    const incomingDeck = AuraPlayer.getInactiveDeck();
    const incomingDeckNum = AuraPlayer.activeDeckNum === 1 ? 2 : 1;
    const outgoingId = AuraPlayer.currentVideoId;

    if (!outgoingDeck || !incomingDeck) {
      AuraPlayer.isCrossfading = false;
      return;
    }

    const durationMs = fadeSec * 1000;
    const startTime = performance.now();
    const curveType = window.state?.crossfadeCurve || 'equal-power';

    console.log(`🔀 AuraPlayer: 🔥 Mezcla en vivo (${fadeSec}s) desde Deck ${AuraPlayer.activeDeckNum} hacia Deck ${incomingDeckNum} ("${nextVideoId}").`);

    incomingDeck.currentTime = 0;
    incomingDeck.volume = 0;
    incomingDeck.play().catch(() => {});

    if (AuraPlayer.fadeInterval) clearInterval(AuraPlayer.fadeInterval);
    AuraPlayer.fadeInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const { gainA, gainB } = calculateGainCurve(progress, curveType);

      outgoingDeck.volume = Math.max(0, Math.min(1, gainA));
      incomingDeck.volume = Math.max(0, Math.min(1, gainB));

      if (progress >= 1) {
        clearInterval(AuraPlayer.fadeInterval);
        AuraPlayer.fadeInterval = null;
        AuraPlayer.isCrossfading = false;

        // Detener y limpiar el deck saliente
        outgoingDeck.pause();
        outgoingDeck.currentTime = 0;

        if (outgoingId && outgoingId !== nextVideoId) {
          fetch(`http://localhost:8080/cleanup?id=${outgoingId}`).catch(() => {});
        }

        // Relevo oficial: el deck entrante es el nuevo master
        AuraPlayer.swapDecks();
        AuraPlayer.currentVideoId = nextVideoId;
        AuraPlayer.nextVideoId = '';

        // Actualizar la interfaz de YouTube Music a la nueva canción
        navigateYouTubeUIToTrack(nextVideoId);
        setTimeout(enforceYouTubeSilent, 150);
        setTimeout(enforceYouTubeSilent, 500);

        console.log(`🔀 AuraPlayer: ¡Mezcla completada! Deck ${AuraPlayer.activeDeckNum} continúa de corrido sin interrupción.`);
      }
    }, 30);
  }

  // 11. Bucle Maestro de Vigilancia Continua (cada 50ms)
  function handleWatchdog() {
    if (!window.state?.crossfade) return;

    enforceYouTubeSilent();

    const currentYtId = getCurrentYouTubeVideoId();

    // Si el usuario cambió de canción manualmente en la interfaz de YouTube Music:
    if (currentYtId && currentYtId !== AuraPlayer.currentVideoId && !AuraPlayer.isCrossfading && !AuraPlayer.isProgrammaticNav) {
      console.log(`🔀 AuraPlayer: Detectado cambio manual de canción a "${currentYtId}".`);
      playTrack(currentYtId);
      return;
    }

    const activeDeck = AuraPlayer.getActiveDeck();
    if (!activeDeck) {
      if (currentYtId && !AuraPlayer.isCrossfading) {
        playTrack(currentYtId);
      }
      return;
    }

    const cur = activeDeck.currentTime;
    const dur = activeDeck.duration;
    const isPaused = activeDeck.paused;

    AuraPlayer.isPlaying = !isPaused;

    if (!dur || dur < 3) return;

    // Actualizar barra y minutero en vivo segundo a segundo
    updatePlayerBarUI(cur, dur, !isPaused);

    if (isPaused) return;

    const rem = dur - cur;
    const fadeSec = Math.max(1, Math.min(15, window.state?.crossfadeDuration || 5));

    // A. Pre-descarga de la siguiente canción cuando faltan entre fadeSec+25s y fadeSec
    if (rem <= fadeSec + 25 && rem > fadeSec && !AuraPlayer.nextVideoId && !AuraPlayer.isCrossfading) {
      const nextId = getNextTrackVideoId();
      if (nextId) {
        AuraPlayer.nextVideoId = nextId;
        const targetDeckNum = AuraPlayer.activeDeckNum === 1 ? 2 : 1;
        loadTrackIntoDeck(targetDeckNum, nextId);
      }
    }

    // B. Disparar mezcla continua de estudio al tocar rem <= fadeSec
    if (rem <= fadeSec && rem > 0.2 && !AuraPlayer.isCrossfading) {
      const effectiveFadeSec = Math.min(fadeSec, Math.max(1, Math.round(rem * 10) / 10));
      const nextId = AuraPlayer.nextVideoId || getNextTrackVideoId();
      if (nextId) {
        startAuraCrossfade(effectiveFadeSec, nextId);
      }
    }
  }

  // 12. Controles de Usuario: Play / Pausa / Barra de Tiempo
  function togglePlayPause() {
    const active = AuraPlayer.getActiveDeck();
    if (!active) return;

    if (active.paused) {
      active.play().catch(() => {});
      AuraPlayer.isPlaying = true;
      console.log('▶️ AuraPlayer: Reanudado por usuario.');
    } else {
      active.pause();
      AuraPlayer.isPlaying = false;
      console.log('⏸️ AuraPlayer: Pausado por usuario.');
    }
  }

  function seekToSeconds(sec) {
    const active = AuraPlayer.getActiveDeck();
    if (!active || isNaN(sec)) return;
    active.currentTime = Math.max(0, Math.min(active.duration || 9999, sec));
    console.log(`⏩ AuraPlayer: Posición actualizada a ${sec}s.`);
  }

  // 13. Listeners Globales
  function setupListeners() {
    // A. Interceptar clics en el botón nativo de Play/Pausa
    document.addEventListener('click', (e) => {
      const playPauseBtn = e.target.closest('#play-pause-button, ytmusic-player-bar #play-pause-button');
      if (playPauseBtn) {
        e.stopPropagation();
        togglePlayPause();
      }
    }, true);

    // B. Interceptar tecla Espacio para Play/Pausa
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.target.matches('input, textarea, select, [contenteditable="true"]')) {
        e.preventDefault();
        togglePlayPause();
      }
    });

    // C. Interceptar arrastre o clic en la barra deslizadora de tiempo
    document.addEventListener('input', (e) => {
      if (e.target.matches('ytmusic-player-bar #progress-bar, #progress-bar, tp-yt-paper-slider')) {
        const sec = parseFloat(e.target.value);
        if (!isNaN(sec)) seekToSeconds(sec);
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.matches('ytmusic-player-bar #progress-bar, #progress-bar, tp-yt-paper-slider')) {
        const sec = parseFloat(e.target.value);
        if (!isNaN(sec)) seekToSeconds(sec);
      }
    });

    // Iniciar bucle de vigilancia de 50ms
    if (!AuraPlayer.watchdogInterval) {
      AuraPlayer.watchdogInterval = setInterval(handleWatchdog, 50);
    }
  }

  // 14. Inyectar puente para lectura de memoria de cola
  function injectMainWorldBridge() {
    if (document.getElementById('auramusic-main-bridge')) return;
    const script = document.createElement('script');
    script.id = 'auramusic-main-bridge';
    script.textContent = `
      (function() {
        function scanQueue() {
          try {
            const player = document.querySelector('#movie_player');
            if (player && typeof player.getPlaylist === 'function') {
              const list = player.getPlaylist();
              const curId = player.getVideoData?.()?.video_id;
              const idx = (Array.isArray(list) && curId) ? list.indexOf(curId) : (typeof player.getPlaylistIndex === 'function' ? player.getPlaylistIndex() : -1);
              if (Array.isArray(list) && idx >= 0 && idx + 1 < list.length) {
                const nextId = list[idx + 1];
                if (nextId && typeof nextId === 'string' && nextId.length === 11) {
                  document.documentElement.dataset.auramusicNextVideoId = nextId;
                  return;
                }
              }
            }
          } catch (e) {}

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
        }
        setInterval(scanQueue, 300);
        scanQueue();
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
  }

  // 15. API Pública
  window.AuraCrossfade = {
    init: function() {
      injectMainWorldBridge();
      setupListeners();
      console.log('🎛️ AuraPlayer: Reproductor Autónomo de Doble Deck inicializado.');
    },
    apply: function(enabled) {
      if (!enabled) {
        if (AuraPlayer.deck1) { try { AuraPlayer.deck1.pause(); } catch (e) {} }
        if (AuraPlayer.deck2) { try { AuraPlayer.deck2.pause(); } catch (e) {} }
        AuraPlayer.isPlaying = false;
        const v = document.querySelector('video');
        if (v) { v.muted = false; v.volume = 1.0; }
        const p = document.querySelector('#movie_player');
        if (p && typeof p.setVolume === 'function') p.setVolume(100);
      }
    },
    setDuration: function(sec) {
      if (!window.state) window.state = {};
      window.state.crossfadeDuration = sec;
    },
    setCurve: function(curve) {
      if (!window.state) window.state = {};
      window.state.crossfadeCurve = curve;
    },
    player: AuraPlayer
  };

})();
