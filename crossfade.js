// ============================================================================
// AuraMusic - Módulo de Crossfade y Transición Continua (crossfade.js)
// Arquitectura True Dual-Deck: Motor DJ de Dos Decks Continuos Sin Microcortes
// ============================================================================

(function() {
  'use strict';

  // 1. Estado del Motor Dual-Deck
  let _activeDeck = 'native'; // 'native' | 'deckA' | 'deckB'
  let _deckA = null; // HTMLAudioElement
  let _deckB = null; // HTMLAudioElement
  let _deckAVideoId = '';
  let _deckBVideoId = '';
  let _currentPlayingVideoId = '';
  let _upcomingNextVideoId = '';
  let _isCrossfading = false;
  let _fadeInterval = null;
  let _watchdogInterval = null;
  let _isProgrammaticSkip = false;
  let _lastSkipTime = 0;

  // 2. Identificador canónico de la pista en pantalla
  function getCanonicalTrackKey() {
    const img = document.querySelector('ytmusic-player-bar .image, #song-image img');
    const title = document.querySelector('ytmusic-player-bar .title, .middle-controls .title');
    const src = img?.src || '';
    const text = title?.textContent?.trim() || '';
    if (!src && !text) return '';
    return `${src}||${text}`;
  }

  // 3. Puente inyectado en el contexto principal para leer la cola de YouTube Music en tiempo real
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

  // 4. Extracción del ID de la siguiente canción real de la lista
  function getNextTrackVideoId() {
    const currentVid = document.querySelector('#movie_player')?.getVideoData?.()?.video_id || 
                       new URLSearchParams(window.location.search).get('v') || '';

    function isValid(id) {
      return id && typeof id === 'string' && id.length === 11 && id !== currentVid;
    }

    // A. Del puente del contexto principal (Polymer Memory / movie_player playlist)
    const fromBridge = document.documentElement.dataset.auramusicNextVideoId;
    if (isValid(fromBridge)) {
      return fromBridge;
    }

    // B. De la API interna #movie_player
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.getPlaylist === 'function') {
        const list = player.getPlaylist();
        const curId = currentVid || player.getVideoData?.()?.video_id;
        const idx = (Array.isArray(list) && curId) ? list.indexOf(curId) : (typeof player.getPlaylistIndex === 'function' ? player.getPlaylistIndex() : -1);
        if (Array.isArray(list) && idx >= 0 && idx + 1 < list.length) {
          const id = list[idx + 1];
          if (isValid(id)) return id;
        }
      }
    } catch (e) {}

    // C. De la lista de canciones en pantalla (Álbumes / Responsive Tracklist)
    try {
      const allRows = Array.from(document.querySelectorAll('ytmusic-responsive-list-item-renderer'));
      let playingIndex = -1;
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const isPlaying = row.querySelector('[play-button-state="playing"], [aria-selected="true"], .playing-icon, ytmusic-play-button-renderer[state="playing"]');
        if (isPlaying || row.classList.contains('selected')) {
          playingIndex = i;
          break;
        }
      }
      if (playingIndex >= 0 && playingIndex + 1 < allRows.length) {
        const nextRow = allRows[playingIndex + 1];
        const link = nextRow.querySelector('a[href*="watch?v="]');
        if (link && link.href) {
          const m = link.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (m && isValid(m[1])) return m[1];
        }
      }
    } catch (e) {}

    // D. De los elementos visibles de la cola en el DOM
    try {
      const currentQueueItem = document.querySelector('ytmusic-player-queue-item[play-button-state="playing"], ytmusic-player-queue-item.selected, ytmusic-player-queue-item[selected]');
      if (currentQueueItem && currentQueueItem.nextElementSibling) {
        const link = currentQueueItem.nextElementSibling.querySelector('a[href*="watch?v="]');
        if (link && link.href) {
          const m = link.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          if (m && isValid(m[1])) return m[1];
        }
      }
    } catch (e) {}

    return '';
  }

  // 5. Curvas de Ganancia Acústica (Spotify Equal Power, Smoothstep, Lineal)
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

  // 6. Control de Volumen Triple Capa (#movie_player, video.volume, y Web Audio)
  function setPlayerVolume(volumeFactor) {
    const vf = Math.max(0, Math.min(1, volumeFactor));

    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.setVolume === 'function') {
        player.setVolume(Math.round(vf * 100));
      }
    } catch (e) {}

    const video = document.querySelector('video');
    if (video) {
      try { video.volume = vf; } catch (e) {}
    }

    if (window.gainNode && window.audioCtx && window.audioCtx.state === 'running') {
      try {
        const bg = window.baseGain || 1.0;
        window.gainNode.gain.setValueAtTime(vf * bg, window.audioCtx.currentTime);
      } catch (e) {}
    }
  }

  // 7. Mantener el video nativo de YouTube completamente en silencio cuando un Deck externo está activo
  function keepNativeVideoSilent() {
    if (!window.state?.crossfade || _activeDeck === 'native') return;

    const video = document.querySelector('video');
    if (video && video.volume > 0) {
      try { video.volume = 0; } catch (e) {}
    }

    const player = document.querySelector('#movie_player');
    if (player && typeof player.setVolume === 'function' && typeof player.getVolume === 'function') {
      if (player.getVolume() > 0) {
        try { player.setVolume(0); } catch (e) {}
      }
    }
  }

  // 8. Actualizar la interfaz gráfica de YouTube Music respetando la lista (Álbum, Playlist y Cola)
  function advanceToNextTrackInList(targetVideoId) {
    const now = performance.now();
    if (now - _lastSkipTime < 2500) return;
    _lastSkipTime = now;
    _isProgrammaticSkip = true;

    // A. Si estamos en una vista de Álbum o Playlist en pantalla, hacer clic en la siguiente fila
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
          console.log('🔀 AuraMusic: Siguiente canción seleccionada directamente en la lista del álbum.');
          setTimeout(() => { _isProgrammaticSkip = false; }, 1200);
          return;
        }
      }
    } catch (e) {}

    // B. Si la cola lateral de reproducción está activa, avanzar al siguiente elemento de la cola
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
          console.log('🔀 AuraMusic: Siguiente canción seleccionada directamente en la cola.');
          setTimeout(() => { _isProgrammaticSkip = false; }, 1200);
          return;
        }
      }
    } catch (e) {}

    // C. Por API oficial de YouTube Music (#movie_player)
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.nextVideo === 'function') {
        player.nextVideo();
        if (typeof player.playVideo === 'function') player.playVideo();
        console.log('🔀 AuraMusic: Siguiente canción activada con movie_player.nextVideo().');
        setTimeout(() => { _isProgrammaticSkip = false; }, 1200);
        return;
      }
    } catch (e) {}

    // D. Botón siguiente en la barra del reproductor
    try {
      const nextBtn = document.querySelector('ytmusic-player-bar .next-button, #next-button');
      if (nextBtn) {
        nextBtn.click();
        console.log('🔀 AuraMusic: Siguiente canción activada con botón next.');
      }
    } catch (e) {}

    setTimeout(() => { _isProgrammaticSkip = false; }, 1200);
  }

  // 9. Bloquear el avance automático nativo de YouTube Music (Solo con Crossfade Activo)
  function interceptYouTubeAutoAdvance() {
    const video = document.querySelector('video');
    if (!video || video._auramusicAutoAdvanceBlocked) return;
    video._auramusicAutoAdvanceBlocked = true;

    // A. Interceptar 'ended' en fase de captura para anularlo
    video.addEventListener('ended', (e) => {
      if (window.state?.crossfade) {
        e.stopImmediatePropagation();
        e.preventDefault();
        console.log('🔀 AuraMusic: Avance nativo de YouTube Music bloqueado con éxito.');
      }
    }, true);

    // B. Pausar video nativo 0.35s antes del fin si crossfade está activo para evitar el salto nativo
    video.addEventListener('timeupdate', () => {
      if (window.state?.crossfade && _activeDeck === 'native' && video.duration && !video.paused) {
        if (video.duration - video.currentTime <= 0.35) {
          video.pause();
        }
      }
    });
  }

  // 10. Reseteo a modo nativo (al pausar, desactivar crossfade o hacer clic manual en otra pista)
  function resetToNative(reason = 'reset') {
    if (_fadeInterval) {
      clearInterval(_fadeInterval);
      _fadeInterval = null;
    }
    _isCrossfading = false;

    if (_deckA) {
      try { _deckA.pause(); _deckA.currentTime = 0; } catch (e) {}
      _deckA = null;
    }
    if (_deckB) {
      try { _deckB.pause(); _deckB.currentTime = 0; } catch (e) {}
      _deckB = null;
    }

    _deckAVideoId = '';
    _deckBVideoId = '';
    _upcomingNextVideoId = '';
    _activeDeck = 'native';

    setPlayerVolume(1.0);
    console.log(`🔀 AuraMusic: Motor Dual-Deck reseteado a modo nativo (${reason}).`);
  }

  // 11. Pre-descarga de la siguiente pista en el Deck inactivo
  function prepareUpcomingDeck(nextVideoId) {
    if (!nextVideoId || _upcomingNextVideoId === nextVideoId) return;
    _upcomingNextVideoId = nextVideoId;

    fetch(`http://localhost:8080/prefetch?id=${nextVideoId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.status === 'ready' && data.url) {
          const targetAudio = new Audio(data.url);
          targetAudio.volume = 0;
          targetAudio.preload = 'auto';

          if (_activeDeck === 'native' || _activeDeck === 'deckA') {
            if (_deckB) { try { _deckB.pause(); } catch (e) {} }
            _deckB = targetAudio;
            _deckBVideoId = nextVideoId;
            console.log(`🔀 AuraMusic: Audio de pista "${nextVideoId}" preparado en Deck B.`);
          } else {
            if (_deckA) { try { _deckA.pause(); } catch (e) {} }
            _deckA = targetAudio;
            _deckAVideoId = nextVideoId;
            console.log(`🔀 AuraMusic: Audio de pista "${nextVideoId}" preparado en Deck A.`);
          }
        }
      })
      .catch(() => {});
  }

  // 12. Ejecución de la Mezcla Dual-Deck (Flip-Flop Continuo Sin Saltos)
  function executeDualDeckCrossfade(fadeSec, nextVideoId) {
    if (_isCrossfading) return;
    _isCrossfading = true;

    const durationMs = fadeSec * 1000;
    const startTime = performance.now();
    const curveType = window.state?.crossfadeCurve || 'equal-power';

    console.log(`🔀 AuraMusic: 🔥 Iniciando mezcla Dual-Deck (${fadeSec}s) desde "${_activeDeck}" hacia pista "${nextVideoId}".`);

    if (_activeDeck === 'native') {
      // Caso 1: Pista A (Native Video) -> Pista B (Deck B)
      const incomingDeck = _deckB;
      if (!incomingDeck) {
        _isCrossfading = false;
        return;
      }

      incomingDeck.currentTime = 0;
      incomingDeck.volume = 0;
      incomingDeck.play().catch(() => {});

      if (_fadeInterval) clearInterval(_fadeInterval);
      _fadeInterval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const { gainA, gainB } = calculateGainCurve(progress, curveType);

        setPlayerVolume(gainA);
        incomingDeck.volume = Math.max(0, Math.min(1, gainB));

        if (progress >= 1) {
          clearInterval(_fadeInterval);
          _fadeInterval = null;
          _isCrossfading = false;

          // Silenciar video nativo para evitar interferencias
          const v = document.querySelector('video');
          if (v) {
            try { v.volume = 0; v.muted = true; } catch (e) {}
          }

          _activeDeck = 'deckB';
          _currentPlayingVideoId = nextVideoId;
          _upcomingNextVideoId = '';

          // Actualizar UI de YouTube Music manteniendo silencio en video nativo
          advanceToNextTrackInList(nextVideoId);
          setTimeout(keepNativeVideoSilent, 150);
          setTimeout(keepNativeVideoSilent, 600);
          setTimeout(keepNativeVideoSilent, 1200);
          console.log(`🔀 AuraMusic: ¡Transición impecable! Deck B continúa reproduciéndose sin ningún corte.`);
        }
      }, 30);

    } else if (_activeDeck === 'deckB') {
      // Caso 2: Pista B (Deck B) -> Pista C (Deck A)
      const outgoingDeck = _deckB;
      const incomingDeck = _deckA;
      const outgoingId = _deckBVideoId;

      if (!incomingDeck) {
        _isCrossfading = false;
        return;
      }

      incomingDeck.currentTime = 0;
      incomingDeck.volume = 0;
      incomingDeck.play().catch(() => {});

      if (_fadeInterval) clearInterval(_fadeInterval);
      _fadeInterval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const { gainA, gainB } = calculateGainCurve(progress, curveType);

        outgoingDeck.volume = Math.max(0, Math.min(1, gainA));
        incomingDeck.volume = Math.max(0, Math.min(1, gainB));

        if (progress >= 1) {
          clearInterval(_fadeInterval);
          _fadeInterval = null;
          _isCrossfading = false;

          outgoingDeck.pause();
          _deckB = null;

          if (outgoingId) {
            fetch(`http://localhost:8080/cleanup?id=${outgoingId}`).catch(() => {});
          }

          _activeDeck = 'deckA';
          _currentPlayingVideoId = nextVideoId;
          _upcomingNextVideoId = '';

          advanceToNextTrackInList(nextVideoId);
          setTimeout(keepNativeVideoSilent, 150);
          setTimeout(keepNativeVideoSilent, 600);
          setTimeout(keepNativeVideoSilent, 1200);
          console.log(`🔀 AuraMusic: ¡Transición impecable! Deck A continúa reproduciéndose sin ningún corte.`);
        }
      }, 30);

    } else if (_activeDeck === 'deckA') {
      // Caso 3: Pista C (Deck A) -> Pista D (Deck B)
      const outgoingDeck = _deckA;
      const incomingDeck = _deckB;
      const outgoingId = _deckAVideoId;

      if (!incomingDeck) {
        _isCrossfading = false;
        return;
      }

      incomingDeck.currentTime = 0;
      incomingDeck.volume = 0;
      incomingDeck.play().catch(() => {});

      if (_fadeInterval) clearInterval(_fadeInterval);
      _fadeInterval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const { gainA, gainB } = calculateGainCurve(progress, curveType);

        outgoingDeck.volume = Math.max(0, Math.min(1, gainA));
        incomingDeck.volume = Math.max(0, Math.min(1, gainB));

        if (progress >= 1) {
          clearInterval(_fadeInterval);
          _fadeInterval = null;
          _isCrossfading = false;

          outgoingDeck.pause();
          _deckA = null;

          if (outgoingId) {
            fetch(`http://localhost:8080/cleanup?id=${outgoingId}`).catch(() => {});
          }

          _activeDeck = 'deckB';
          _currentPlayingVideoId = nextVideoId;
          _upcomingNextVideoId = '';

          advanceToNextTrackInList(nextVideoId);
          setTimeout(keepNativeVideoSilent, 150);
          setTimeout(keepNativeVideoSilent, 600);
          setTimeout(keepNativeVideoSilent, 1200);
          console.log(`🔀 AuraMusic: ¡Transición impecable! Deck B continúa reproduciéndose sin ningún corte.`);
        }
      }, 30);
    }
  }

  // 13. Vigilancia continua del Motor Dual-Deck (cada 50ms)
  function handleDualDeckCheck() {
    if (!window.state?.crossfade) return;

    keepNativeVideoSilent();

    let cur = 0;
    let dur = 0;
    let isPaused = false;

    if (_activeDeck === 'native') {
      const video = document.querySelector('video');
      if (!video || !video.duration || isNaN(video.duration)) return;
      cur = video.currentTime;
      dur = video.duration;
      isPaused = video.paused;
    } else if (_activeDeck === 'deckB' && _deckB) {
      cur = _deckB.currentTime;
      dur = _deckB.duration;
      isPaused = _deckB.paused;
    } else if (_activeDeck === 'deckA' && _deckA) {
      cur = _deckA.currentTime;
      dur = _deckA.duration;
      isPaused = _deckA.paused;
    }

    if (!dur || dur < 3) return;

    // Sincronizar la barra de tiempo y el menú de YouTube Music con el Deck que está sonando
    if (_activeDeck !== 'native') {
      updatePlayerBarUI(cur, dur);
    }

    if (isPaused) return;

    const rem = dur - cur;
    const fadeSec = Math.max(1, Math.min(15, window.state?.crossfadeDuration || 5));

    // A. Pre-descarga de la siguiente pista cuando faltan entre fadeSec+25s y fadeSec
    if (rem <= fadeSec + 25 && rem > fadeSec && !_upcomingNextVideoId && !_isCrossfading) {
      const nextId = getNextTrackVideoId();
      if (nextId) {
        prepareUpcomingDeck(nextId);
      }
    }

    // B. Disparo de la mezcla simultánea al tocar rem <= fadeSec
    if (rem <= fadeSec && rem > 0.2 && !_isCrossfading) {
      const effectiveFadeSec = Math.min(fadeSec, Math.max(1, Math.round(rem * 10) / 10));
      const nextId = _upcomingNextVideoId || getNextTrackVideoId();
      if (nextId) {
        executeDualDeckCrossfade(effectiveFadeSec, nextId);
      }
    }
  }

  // Actualizar directamente la barra de progreso, minutero y slider de YouTube Music
  function updatePlayerBarUI(cur, dur) {
    if (!dur || dur <= 0 || isNaN(dur)) return;

    // A. Actualizar texto de tiempo (ej. "0:14 / 2:48")
    const timeInfo = document.querySelector('ytmusic-player-bar .time-info, ytmusic-player-bar #time-info, .time-info');
    if (timeInfo) {
      const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      timeInfo.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }

    // B. Actualizar barra deslizadora (#progress-bar)
    const progressBar = document.querySelector('ytmusic-player-bar #progress-bar, #progress-bar');
    if (progressBar) {
      progressBar.value = cur;
      progressBar.max = dur;
      progressBar.setAttribute('value', cur);
      progressBar.setAttribute('max', dur);
    }

    // C. Actualizar relleno visual de la barra de progreso (#primaryProgress)
    const primaryProgress = document.querySelector('ytmusic-player-bar #primaryProgress, ytmusic-player-bar #sliderBar #primaryProgress');
    if (primaryProgress) {
      const pct = Math.max(0, Math.min(1, cur / dur));
      primaryProgress.style.transform = `scaleX(${pct})`;
      primaryProgress.style.transformOrigin = 'left center';
    }
  }

  // 14. Listeners de sincronización: Play, Pausa, Búsqueda y Clics manuales
  function setupListeners() {
    const video = document.querySelector('video');
    if (!video) return;

    interceptYouTubeAutoAdvance();

    if (video._auramusicDualDeckBound) return;
    video._auramusicDualDeckBound = true;

    if (!_watchdogInterval) {
      _watchdogInterval = setInterval(handleDualDeckCheck, 50);
    }

    // Sincronizar PLAY / PAUSE cuando el usuario hace clic en el botón de YouTube Music
    document.addEventListener('click', (e) => {
      const playPauseBtn = e.target.closest('#play-pause-button, ytmusic-player-bar #play-pause-button');
      if (playPauseBtn) {
        if (_activeDeck === 'deckB' && _deckB) {
          if (_deckB.paused) _deckB.play().catch(() => {});
          else _deckB.pause();
        } else if (_activeDeck === 'deckA' && _deckA) {
          if (_deckA.paused) _deckA.play().catch(() => {});
          else _deckA.pause();
        }
      }
    }, true);

    // Sincronizar PLAY / PAUSE con la barra espaciadora
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.target.matches('input, textarea, select, [contenteditable="true"]')) {
        if (_activeDeck === 'deckB' && _deckB) {
          if (_deckB.paused) _deckB.play().catch(() => {});
          else _deckB.pause();
        } else if (_activeDeck === 'deckA' && _deckA) {
          if (_deckA.paused) _deckA.play().catch(() => {});
          else _deckA.pause();
        }
      }
    });

    // Sincronizar cuando el usuario hace clic o arrastra la barra de progreso
    document.addEventListener('input', (e) => {
      if (e.target.matches('ytmusic-player-bar #progress-bar, #progress-bar, tp-yt-paper-slider')) {
        const targetSec = parseFloat(e.target.value);
        if (!isNaN(targetSec)) {
          if (_activeDeck === 'deckB' && _deckB) _deckB.currentTime = targetSec;
          else if (_activeDeck === 'deckA' && _deckA) _deckA.currentTime = targetSec;
        }
      }
    });
    document.addEventListener('change', (e) => {
      if (e.target.matches('ytmusic-player-bar #progress-bar, #progress-bar, tp-yt-paper-slider')) {
        const targetSec = parseFloat(e.target.value);
        if (!isNaN(targetSec)) {
          if (_activeDeck === 'deckB' && _deckB) _deckB.currentTime = targetSec;
          else if (_activeDeck === 'deckA' && _deckA) _deckA.currentTime = targetSec;
        }
      }
    });

    // Clics manuales en canciones o botones de siguiente/anterior
    document.addEventListener('click', (e) => {
      if (_isProgrammaticSkip) return;

      const isQueueTrackClick = e.target.closest('ytmusic-player-queue-item, ytmusic-responsive-list-item-renderer, .song-button, [role="listitem"]');
      const isManualSkipBtn = e.target.closest('.next-button, .previous-button, #next-button, #previous-button');

      if (isQueueTrackClick || isManualSkipBtn) {
        resetToNative('usuario_cambio_pista_manual');
      }
    }, true);
  }

  // 15. API Pública de AuraCrossfade
  window.AuraCrossfade = {
    init: function() {
      injectMainWorldBridge();
      setupListeners();
      console.log('🔀 AuraMusic: Motor Dual-Deck Continuo (crossfade.js) inicializado al 100%.');
    },
    apply: function(enabled) {
      if (enabled) {
        setupListeners();
      } else {
        resetToNative('crossfade_desactivado');
      }
    },
    setDuration: function(sec) {
      if (!window.state) window.state = {};
      window.state.crossfadeDuration = sec;
      console.log(`🔀 AuraMusic: Duración de crossfade configurada a ${sec}s.`);
    },
    setCurve: function(curve) {
      if (!window.state) window.state = {};
      window.state.crossfadeCurve = curve;
      console.log(`🔀 AuraMusic: Curva de ganancia configurada a "${curve}".`);
    },
    reset: resetToNative
  };

})();
