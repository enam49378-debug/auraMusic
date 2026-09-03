// ============================================================================
// AuraMusic - Módulo de Crossfade y Transición Continua (crossfade.js)
// Arquitectura Modular: Solapamiento Simultáneo Real, Pre-descarga y Relevo Continuo
// ============================================================================

(function() {
  'use strict';

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

  // Trackers de canciones para el relevo continuo (A -> B -> C -> D)
  let _currentPlayingVideoId = '';
  let _upcomingNextVideoId = '';
  let _companionAudio = null;
  let _companionReady = false;

  let _fadeInterval = null;
  let _crossfadeWatchdogInterval = null;

  // 1. Identificador canónico de la pista actual en pantalla
  function getCanonicalTrackKey() {
    const img = document.querySelector('ytmusic-player-bar .image, #song-image img');
    const title = document.querySelector('ytmusic-player-bar .title, .middle-controls .title');
    const src = img?.src || '';
    const text = title?.textContent?.trim() || '';
    if (!src && !text) return '';
    return `${src}||${text}`;
  }

  // 2. Puente inyectado en el contexto principal para leer la cola de YouTube Music en tiempo real
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

  // 3. Extracción del ID de la siguiente canción real de la lista
  function getNextTrackVideoId() {
    // A. Del puente del contexto principal (Polymer Memory / movie_player playlist)
    const fromBridge = document.documentElement.dataset.auramusicNextVideoId;
    if (fromBridge && typeof fromBridge === 'string' && fromBridge.length === 11) {
      return fromBridge;
    }

    // B. De la API interna #movie_player
    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.getPlaylist === 'function') {
        const list = player.getPlaylist();
        const curId = player.getVideoData?.()?.video_id;
        const idx = (Array.isArray(list) && curId) ? list.indexOf(curId) : (typeof player.getPlaylistIndex === 'function' ? player.getPlaylistIndex() : -1);
        if (Array.isArray(list) && idx >= 0 && idx + 1 < list.length) {
          const id = list[idx + 1];
          if (id && typeof id === 'string' && id.length === 11) return id;
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
          if (m) return m[1];
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
          if (m) return m[1];
        }
      }
    } catch (e) {}

    return '';
  }

  // 4. Matemáticas de Curva de Ganancia Acústica
  function calculateGainCurve(progress, curveType = 'equal-power') {
    const p = Math.max(0, Math.min(1, progress));
    if (curveType === 'equal-power') {
      // Curva Equal-Power (Spotify): cos & sin para preservar la energía acústica total
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

  // 5. Control de Volumen Triple Capa (#movie_player, video.volume, y Web Audio)
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

  // 6. Cancelar y limpiar inmediatamente todo audio externo (al pausar, saltar canción o mover barra)
  function stopAndDestroySecondaryPlayer(reason = 'cleanup') {
    if (shadowFadeInterval) {
      clearInterval(shadowFadeInterval);
      shadowFadeInterval = null;
    }
    if (_fadeInterval) {
      clearInterval(_fadeInterval);
      _fadeInterval = null;
    }

    if (_companionAudio) {
      try {
        _companionAudio.pause();
        _companionAudio.currentTime = 0;
      } catch (e) {}
      _companionAudio = null;
    }
    _companionReady = false;

    try {
      chrome.runtime.sendMessage({ target: 'offscreen', action: 'STOP_CROSSFADE' }).catch(() => {});
    } catch (e) {}

    _upcomingNextVideoId = '';
    _xfadeStatus = XFADE_STATE.IDLE;
    console.log(`🔀 AuraMusic Crossfade: Reproductor secundario detenido y limpiado (${reason}).`);
  }

  // 7. Precarga de la siguiente pista (Servidor Companion o Motor Offscreen)
  function prepareUpcomingTrack(nextVideoId) {
    if (!nextVideoId || _upcomingNextVideoId === nextVideoId) return;
    stopAndDestroySecondaryPlayer('nueva_precarga');

    _upcomingNextVideoId = nextVideoId;
    _xfadeStatus = XFADE_STATE.PREPARING_NEXT;

    // A. Intentar pre-descarga ultrarrápida mediante el servidor companion (si está activo en localhost:8080)
    try {
      fetch(`http://localhost:8080/prefetch?id=${nextVideoId}`).then(res => {
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
          _xfadeStatus = XFADE_STATE.CROSSFADE_READY;
          console.log(`🔀 AuraMusic: Audio real de "${nextVideoId}" pre-descargado y listo para crossfade: ${data.url}`);
        }
      }).catch(() => {
        _companionReady = false;
      });
    } catch (e) {
      _companionReady = false;
    }

    // B. Preparar motor Offscreen como respaldo
    try {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'PREPARE_TRACK',
        videoId: nextVideoId
      }, (res) => {
        if (!_companionReady) {
          _xfadeStatus = XFADE_STATE.CROSSFADE_READY;
          console.log(`🔀 AuraMusic: Motor Offscreen preparado para pista "${nextVideoId}".`);
        }
      });
    } catch (e) {
      if (!_companionReady) _xfadeStatus = XFADE_STATE.CROSSFADE_READY;
    }
  }

  // 8. Disparo de la siguiente pista en YouTube Music nativo (Con prevención de rebotes)
  function triggerNextTrack() {
    _isProgrammaticSkip = true;
    _lastSkipTime = performance.now();

    try {
      const player = document.querySelector('#movie_player');
      if (player && typeof player.nextVideo === 'function') {
        player.nextVideo();
        console.log('🔀 AuraMusic: Siguiente canción disparada con movie_player.nextVideo()');
        setTimeout(() => { _isProgrammaticSkip = false; }, 1200);
        return;
      }
    } catch (e) {}

    try {
      const nextBtn = document.querySelector('ytmusic-player-bar .next-button, #next-button, paper-icon-button.next-button');
      if (nextBtn) {
        nextBtn.click();
        console.log('🔀 AuraMusic: Siguiente canción disparada con nextBtn.click()');
      }
    } catch (e) {}

    setTimeout(() => { _isProgrammaticSkip = false; }, 1200);
  }

  let shadowFadeInterval = null;

  // 9. Inicio del solapamiento simultáneo real
  function startCrossfade(fadeSec, targetVideoId) {
    if (_xfadeStatus === XFADE_STATE.CROSSFADE_ACTIVE) return;
    _xfadeStatus = XFADE_STATE.CROSSFADE_ACTIVE;

    const previousId = _currentPlayingVideoId;
    _currentPlayingVideoId = targetVideoId;
    const initialCanonicalKey = _currentTrackCanonicalId;

    console.log(`🔀 AuraMusic: 🔥 SOLAPAMIENTO SIMULTÁNEO INICIADO (${fadeSec}s) hacia pista "${targetVideoId}".`);

    // Iniciar Pista B
    if (_companionReady && _companionAudio) {
      console.log('🔀 AuraMusic: Reproduciendo audio real pre-descargado en simultáneo!');
      _companionAudio.currentTime = 0;
      _companionAudio.volume = 0.0;
      _companionAudio.play().catch(() => {});
    } else {
      try {
        chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'START_CROSSFADE',
          videoId: targetVideoId,
          duration: fadeSec
        }).catch(() => {});
      } catch (e) {}
    }

    const startTime = performance.now();
    const durationMs = fadeSec * 1000;
    const curveType = window.state?.crossfadeCurve || 'equal-power';

    if (shadowFadeInterval) clearInterval(shadowFadeInterval);
    shadowFadeInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const { gainA, gainB } = calculateGainCurve(progress, curveType);

      // Pista A: baja de volumen suavemente (100% -> 0%)
      setPlayerVolume(gainA);

      // Pista B: sube de volumen suavemente (0% -> 100%)
      if (_companionReady && _companionAudio) {
        _companionAudio.volume = Math.max(0, Math.min(1, gainB));
      }

      if (progress >= 1) {
        clearInterval(shadowFadeInterval);
        shadowFadeInterval = null;
        _isTransitioningToNext = true;
        _lastSkipTime = performance.now();
        _pendingSeekTime = fadeSec; // Guardar el descuento de tiempo para la Pista B

        console.log(`🔀 AuraMusic: Fin del solapamiento (${fadeSec}s). Verificando si YouTube Music ya cambió...`);

        // Comprobar si YouTube Music ya avanzó automáticamente a la Pista B por haber terminado la Pista A
        const player = document.querySelector('#movie_player');
        const currentVideoId = player?.getVideoData?.()?.video_id || '';
        const currentKey = getCanonicalTrackKey();

        const alreadyOnNext = (currentVideoId && currentVideoId === targetVideoId) || (currentKey && currentKey !== initialCanonicalKey);

        if (alreadyOnNext) {
          console.log(`🔀 AuraMusic: YouTube Music ya está en Pista B ("${targetVideoId}"). ¡No se dispara salto adicional para no saltar a la Pista C!`);
          const v = document.querySelector('video');
          if (v && isFinite(v.duration) && v.duration > fadeSec) {
            try {
              v.currentTime = fadeSec;
              console.log(`🔀 AuraMusic: Intro de Pista B descontado -> Sincronizado en ${fadeSec}s.`);
              _pendingSeekTime = 0;
            } catch (e) {}
          }
        } else {
          console.log(`🔀 AuraMusic: Forzando avance único a Pista B ("${targetVideoId}")...`);
          triggerNextTrack();
        }

        setTimeout(() => {
          setPlayerVolume(1.0);

          if (_companionAudio) {
            _companionAudio.pause();
            _companionAudio = null;
            _companionReady = false;
          }

          // Eliminar archivo de la pista anterior del disco para no ocupar espacio
          if (previousId && previousId !== targetVideoId) {
            fetch(`http://localhost:8080/cleanup?id=${previousId}`).catch(() => {});
          }

          stopAndDestroySecondaryPlayer('fin_transicion');
          _xfadeStatus = XFADE_STATE.IDLE;
        }, 1200);
      }
    }, 30);
  }

  // 10. Bucle maestro de vigilancia y chequeo continuo (cada 50ms)
  function handleCrossfadeCheck() {
    if (!window.state?.crossfade) return;
    const video = document.querySelector('video');
    if (!video || !video.duration || isNaN(video.duration) || video.paused) return;

    const dur = video.duration;
    const cur = video.currentTime;
    const fadeSec = Math.max(1, Math.min(15, window.state?.crossfadeDuration || 5));
    const trackKey = getCanonicalTrackKey();

    // Sincronización instantánea de intro descontado en la nueva pista (B) tan pronto como empieza en 0:00
    if (_pendingSeekTime > 0 && cur < 2.0 && dur > _pendingSeekTime) {
      try {
        video.currentTime = _pendingSeekTime;
        console.log(`🔀 AuraMusic: Intro de Pista B descontado con éxito -> Sincronizado en ${_pendingSeekTime}s.`);
        _pendingSeekTime = 0;
      } catch (e) {}
    }

    // A. DETECCIÓN DE CAMBIO DE CANCIÓN (La pista B pasa a ser la nueva pista A, y C será la nueva B)
    if (trackKey && trackKey !== _currentTrackCanonicalId) {
      console.log(`🔀 AuraMusic: 🔄 Nueva pista activa: "${trackKey}". Relevo completado: B pasa a ser A.`);
      _currentTrackCanonicalId = trackKey;
      _hasFadedOutThisTrack = false;
      _isTransitioningToNext = false;
      _xfadeStatus = XFADE_STATE.IDLE;
      _companionReady = false;
      if (_companionAudio) {
        _companionAudio.pause();
        _companionAudio = null;
      }
      _upcomingNextVideoId = '';

      if (_fadeInterval) {
        clearInterval(_fadeInterval);
        _fadeInterval = null;
      }

      setPlayerVolume(1.0);
      return;
    }

    if (dur < 3) return;
    const rem = dur - cur;

    // B. PRE-DESCARGA Y PRE-CALENTAMIENTO DE LA SIGUIENTE PISTA (Faltando entre fadeSec+25s y fadeSec)
    if (rem <= fadeSec + 25 && rem > fadeSec && _xfadeStatus === XFADE_STATE.IDLE) {
      const nextId = getNextTrackVideoId();
      if (nextId) {
        prepareUpcomingTrack(nextId);
      }
    }

    // C. DISPARO DEL SOLAPAMIENTO SIMULTÁNEO REAL (Al tocar rem <= fadeSec)
    if (rem <= fadeSec && rem > 0.15 && !_hasFadedOutThisTrack) {
      _hasFadedOutThisTrack = true;
      const effectiveFadeSec = Math.min(fadeSec, Math.max(1, Math.round(rem * 10) / 10));

      const nextId = _upcomingNextVideoId || getNextTrackVideoId();
      if (nextId) {
        startCrossfade(effectiveFadeSec, nextId);
        return;
      }

      // Si no hay siguiente canción (fin de lista), fundido de salida suave
      console.log(`🔀 AuraMusic: Fin de lista -> Desvanecimiento suave (${effectiveFadeSec}s)...`);
      if (_fadeInterval) clearInterval(_fadeInterval);
      const startTime = performance.now();
      const fadeDurationMs = effectiveFadeSec * 1000;
      const curve = window.state?.crossfadeCurve || 'equal-power';

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
  }

  // 11. Listeners de sincronización: Pausa, Play y Salto Manual
  function setupListeners() {
    const video = document.querySelector('video');
    if (!video) return;

    if (video._auramusicCrossfadeBound) return;
    video._auramusicCrossfadeBound = true;

    // Intervalo de vigilancia de 50ms (Preciso y nunca se congela)
    if (!_crossfadeWatchdogInterval) {
      _crossfadeWatchdogInterval = setInterval(handleCrossfadeCheck, 50);
    }

    // Al PAUSAR YouTube Music: Pausar inmediatamente el audio secundario
    video.addEventListener('pause', () => {
      if (_companionAudio) {
        try { _companionAudio.pause(); } catch (e) {}
      }
      try {
        chrome.runtime.sendMessage({ target: 'offscreen', action: 'PAUSE' }).catch(() => {});
      } catch (e) {}
    });

    // Al REANUDAR YouTube Music: Reanudar audio secundario si el crossfade está activo
    video.addEventListener('play', () => {
      if (!_isTransitioningToNext && !_hasFadedOutThisTrack) {
        setPlayerVolume(1.0);
      }
      if (_xfadeStatus === XFADE_STATE.CROSSFADE_ACTIVE) {
        if (_companionAudio && _companionReady) {
          try { _companionAudio.play().catch(() => {}); } catch (e) {}
        }
        try {
          chrome.runtime.sendMessage({ target: 'offscreen', action: 'PLAY' }).catch(() => {});
        } catch (e) {}
      }
    });

    // Al ADELANTAR / RETROCEDER MANUALMENTE EN LA BARRA:
    video.addEventListener('seeking', () => {
      stopAndDestroySecondaryPlayer('usuario_adelanto_barra');
      _hasFadedOutThisTrack = false;
      _isTransitioningToNext = false;
      setPlayerVolume(1.0);
    });

    // Al HACER CLIC EN CUALQUIER CANCIÓN DE LA LISTA O BOTÓN SIGUIENTE/ANTERIOR:
    document.addEventListener('click', (e) => {
      if (_isProgrammaticSkip) return;

      const isQueueTrackClick = e.target.closest('ytmusic-player-queue-item, ytmusic-responsive-list-item-renderer, .song-button, [role="listitem"]');
      const isManualSkipBtn = e.target.closest('.next-button, .previous-button, #next-button, #previous-button, tp-yt-paper-slider, #progress-bar');

      if (isQueueTrackClick || isManualSkipBtn) {
        stopAndDestroySecondaryPlayer('usuario_cambio_pista_manual');
        _hasFadedOutThisTrack = false;
        _isTransitioningToNext = false;
        setPlayerVolume(1.0);
      }
    }, true);
  }

  // API Pública del Módulo Crossfade
  window.AuraCrossfade = {
    init: function() {
      injectMainWorldBridge();
      setupListeners();
      console.log('🔀 AuraMusic: Módulo modular de Crossfade (crossfade.js) inicializado.');
    },
    apply: function(enabled) {
      if (enabled) {
        setupListeners();
      } else {
        stopAndDestroySecondaryPlayer('crossfade_desactivado');
        setPlayerVolume(1.0);
      }
    },
    setDuration: function(sec) {
      if (!window.state) window.state = {};
      window.state.crossfadeDuration = sec;
      console.log(`🔀 AuraMusic Crossfade: Duración actualizada a ${sec}s.`);
    },
    setCurve: function(curve) {
      if (!window.state) window.state = {};
      window.state.crossfadeCurve = curve;
      console.log(`🔀 AuraMusic Crossfade: Curva actualizada a "${curve}".`);
    },
    setVolume: setPlayerVolume,
    stop: stopAndDestroySecondaryPlayer
  };

})();
