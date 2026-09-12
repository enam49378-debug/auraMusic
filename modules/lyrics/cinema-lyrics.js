/**
 * AuraMusic - Módulo Cinema Lyrics (Letras Sincronizadas Estilo Apple Music)
 * Integración con LrcLib, Traducción Automática y Romanización K-Pop / J-Pop.
 */
window.AuraMusic = window.AuraMusic || {};

(function() {
  'use strict';

  function getState() {
    return window.AuraMusic?.state || window.state || {};
  }
  const state = new Proxy({}, {
    get: (target, prop) => getState()[prop],
    set: (target, prop, value) => { getState()[prop] = value; return true; }
  });

  // SISTEMA DE LETRAS ANIMADAS ESTILO APPLE MUSIC (CINEMATIC KARAOKE)
  // ==========================================================
  let currentLyrics = [];
  let isCinemaActive = false;

    // Obtener carátula en Ultra HD (1200x1200px)
  function getHighResCoverUrl(hintUrl) {
    let src = hintUrl || '';

    // 1. MediaSession (inmediato y oficial en Chrome / YouTube Music)
    if (!src && navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.artwork) {
      const arts = navigator.mediaSession.metadata.artwork;
      if (arts && arts.length > 0) {
        src = arts[arts.length - 1].src || '';
      }
    }

    // 2. Imagen del panel principal de YouTube Music
    if (!src) {
      const bigImg = document.querySelector('#song-image img, #main-panel img, ytmusic-player-page .image img, ytmusic-player-page #img');
      src = (bigImg && bigImg.src) ? bigImg.src : '';
    }

    // 3. Imagen de la barra inferior de reproducción (tag img real)
    if (!src) {
      const barImg = document.querySelector('ytmusic-player-bar img#img, ytmusic-player-bar .image img, ytmusic-player-bar #thumbnail img, ytmusic-player-bar img');
      src = (barImg && barImg.src) ? barImg.src : '';
    }

    // Escalar resolución a Ultra HD (1200x1200)
    if (src) {
      if (src.includes('=w')) {
        src = src.replace(/=w\d+-h\d+[^?]*/, '=w1200-h1200-l90-rj');
      } else if (src.includes('=s')) {
        src = src.replace(/=s\d+[^?]*/, '=s1200');
      }
    }
    return src;
  }

  // --- INTEGRACIÓN CON EL MOTOR DE YOUTUBE MUSIC API (MAIN WORLD) ---
  let isPlayerBridgeReady = false;
  let bridgeLastUpdate = 0;
  let bridgeCurrentTime = -1;
  let bridgeDuration = -1;
  let isFetchingLyrics = false;
  let currentTrackKey = '';

  function ensurePlayerBridgeInjected() {
    if (document.getElementById('auramusic-player-bridge-tag')) return;
    try {
      const script = document.createElement('script');
      script.id = 'auramusic-player-bridge-tag';
      script.src = chrome.runtime.getURL('modules/core/player-bridge.js');
      (document.head || document.documentElement).appendChild(script);
    } catch (_) {}
  }
  ensurePlayerBridgeInjected();

  function getBridgePlaybackData() {
    const el = document.getElementById('auramusic-bridge-data');
    if (!el || el.dataset.ready !== '1') return null;
    const cur = parseFloat(el.dataset.currentTime);
    const dur = parseFloat(el.dataset.duration);
    const st = parseInt(el.dataset.playerState, 10);
    const updated = parseFloat(el.dataset.updatedAt) || 0;
    const isFresh = (Date.now() - updated < 1500);

    if (isFresh) {
      bridgeLastUpdate = updated;
      if (!isNaN(cur) && isFinite(cur) && cur >= 0) bridgeCurrentTime = cur;
      if (!isNaN(dur) && isFinite(dur) && dur > 0) bridgeDuration = dur;
    }

    return {
      currentTime: !isNaN(cur) && isFinite(cur) && cur >= 0 ? cur : -1,
      duration: !isNaN(dur) && isFinite(dur) && dur > 0 ? dur : -1,
      playerState: !isNaN(st) ? st : -1,
      videoId: el.dataset.videoId || '',
      title: el.dataset.title || '',
      artist: el.dataset.artist || '',
      artwork: el.dataset.artwork || '',
      isFresh
    };
  }

  let cinemaCmdCounter = 0;
  function sendPlayerCommand(cmd) {
    const cmdId = `${cmd.action}-${Date.now()}-${++cinemaCmdCounter}`;
    const payload = { ...cmd, _id: cmdId, _ts: Date.now() };

    // 1. Canal document CustomEvent (inmediato y nativo entre mundos)
    try {
      document.dispatchEvent(new CustomEvent('auramusic-player-cmd', { detail: payload }));
    } catch (_) {}

    // 2. Canal DOM (MutationObserver en MAIN WORLD como respaldo infalible)
    const bridgeEl = document.getElementById('auramusic-bridge-data');
    if (bridgeEl) {
      bridgeEl.setAttribute('data-cmd', JSON.stringify(payload));
    }
  }

  window.addEventListener('auramusic-player-bridge-ready', () => {
    isPlayerBridgeReady = true;
  });
  document.addEventListener('auramusic-player-bridge-ready', () => {
    isPlayerBridgeReady = true;
  });

  function onBridgeTrackChange(e) {
    const { title, artist, videoId, artwork } = e.detail || {};
    if (!title) return;
    handleTrackChangeDetected(title, artist, videoId, artwork);
  }

  function onBridgeStateChange(e) {
    const { isPlaying } = e.detail || {};
    const playBtn = document.getElementById('cinema-play-btn');
    const waPlayBtn = document.getElementById('cinema-wa-play-btn');
    if (playBtn) playBtn.textContent = isPlaying ? '⏸' : '▶';
    if (waPlayBtn) waPlayBtn.textContent = isPlaying ? '⏸' : '▶';
  }

  document.addEventListener('auramusic-track-change', onBridgeTrackChange);
  window.addEventListener('auramusic-track-change', onBridgeTrackChange);

  document.addEventListener('auramusic-state-change', onBridgeStateChange);
  window.addEventListener('auramusic-state-change', onBridgeStateChange);

  function getActiveVideo() {
    const all = Array.from(document.querySelectorAll('video'));
    if (all.length === 0) return null;

    // 1. Priorizar el video que esté activamente reproduciendo y no haya finalizado
    const playing = all.find(v => !v.paused && !v.ended && v.currentTime > 0);
    if (playing) return playing;

    // 2. Priorizar el video principal dentro de #movie_player que no haya finalizado
    const moviePlayerVid = document.querySelector('#movie_player video, ytmusic-player-page video.html5-main-video, ytmusic-player video');
    if (moviePlayerVid && !moviePlayerVid.ended) return moviePlayerVid;

    // 3. Cualquier video que no haya finalizado
    const notEnded = all.find(v => !v.ended);
    if (notEnded) return notEnded;

    return moviePlayerVid || all[0];
  }

  function isTrackPlaying(video) {
    const bridge = getBridgePlaybackData();
    if (bridge && bridge.isFresh && bridge.playerState !== -1) {
      if (bridge.playerState === 1) return true;
      if (bridge.playerState === 2 || bridge.playerState === 0) return false;
    }
    if (navigator.mediaSession && navigator.mediaSession.playbackState) {
      if (navigator.mediaSession.playbackState === 'playing') return true;
      if (navigator.mediaSession.playbackState === 'paused') return false;
    }
    const nativePlay = document.querySelector('ytmusic-player-bar .play-pause-button, #play-pause-button');
    if (nativePlay) {
      const title = (nativePlay.getAttribute('title') || nativePlay.getAttribute('aria-label') || '').toLowerCase();
      if (title.includes('pause') || title.includes('pausar')) return true;
      if (title.includes('play') || title.includes('reproducir')) return false;
    }
    if (video) {
      return !video.paused && !video.ended;
    }
    return false;
  }

  function seekTrack(targetTime, autoPlay = true) {
    const duration = getYtMusicTrackDuration();
    let clampedTime = Math.max(0, targetTime);
    if (duration > 1 && clampedTime > duration - 0.2) {
      clampedTime = Math.max(0, duration - 0.3);
    }

    cinemaSeekTargetTime = clampedTime;
    cinemaSeekLockUntil = Date.now() + 800;
    lastRenderedPlaybackTime = clampedTime;

    // 1. Enviar comando nativo autoritativo al MAIN WORLD (#movie_player.seekTo)
    sendPlayerCommand({ action: 'seek', time: clampedTime, autoPlay: autoPlay !== false });

    // 2. Control directo e instantáneo sobre el elemento <video>
    const video = getActiveVideo();
    if (video) {
      try { video.currentTime = clampedTime; } catch (_) {}
      if (autoPlay !== false) {
        try { video.play().catch(() => {}); } catch (_) {}
      }
    }

    // 3. Actualizar inmediatamente la barra y tiempos de la interfaz
    const fill = document.getElementById('cinema-progress-fill');
    const curSpan = document.getElementById('cinema-current-time');
    const waTimePill = document.getElementById('cinema-wa-time');

    if (fill) {
      fill.classList.add('is-seeking');
      fill.style.setProperty('transition', 'none', 'important');
      if (duration > 0) {
        fill.style.width = `${Math.max(0, Math.min(100, (clampedTime / duration) * 100))}%`;
      }
    }
    if (curSpan) {
      curSpan.textContent = formatTime(clampedTime);
    }
    if (waTimePill) {
      waTimePill.textContent = `${formatTime(clampedTime)} / ${duration > 0 ? formatTime(duration) : '0:00'}`;
    }
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
    return null;
  }

  function getNativeBarTimes() {
    // 1. Selector time-info de la barra nativa (evita duraciones de clips completos y maneja tiempo restante)
    const timeInfo = document.querySelector('ytmusic-player-bar .time-info, ytmusic-player-bar #time-info, ytmusic-player-bar span.time-info, ytmusic-player-bar [class*="time-info"]');
    if (timeInfo && timeInfo.textContent) {
      const res = parseYtMusicTimeText(timeInfo.textContent);
      if (res && res.durSec > 0) return res;
    }

    // 2. Elemento slider de progreso (#progress-bar o #slider)
    const slider = document.querySelector('ytmusic-player-bar #progress-bar, ytmusic-player-bar #slider, tp-yt-paper-slider#slider, #progress-bar');
    if (slider) {
      const valText = slider.getAttribute('aria-valuetext');
      if (valText) {
        const res = parseYtMusicTimeText(valText);
        if (res && res.durSec > 0) return res;
      }
      const valMax = parseFloat(slider.getAttribute('aria-valuemax'));
      const valNow = parseFloat(slider.getAttribute('aria-valuenow'));
      if (!isNaN(valMax) && valMax > 5) {
        return {
          curSec: !isNaN(valNow) && valNow >= 0 ? valNow : 0,
          durSec: valMax
        };
      }
    }

    return null;
  }

  function getYtMusicPlaybackTimes() {
    let domCurrent = -1;
    let domDuration = -1;

    // 1. Priorizar el elemento de video nativo con precisión flotante sub-segundo a 60 FPS
    const video = getActiveVideo();
    if (video) {
      const cur = (!isNaN(video.currentTime) && isFinite(video.currentTime) && video.currentTime >= 0) ? video.currentTime : -1;
      const dur = (!isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) ? video.duration : -1;
      if (cur >= 0) domCurrent = cur;
      if (dur > 0) domDuration = dur;
    }

    // 2. Priorizar datos del Player Bridge si están actualizados y tienen precisión de reproducción
    const bridge = getBridgePlaybackData();
    if (bridge && bridge.isFresh && bridge.currentTime >= 0) {
      if (domCurrent < 0) domCurrent = bridge.currentTime;
      if (bridge.duration > 0 && domDuration <= 0) domDuration = bridge.duration;
    }

    // 3. Duración de la barra nativa (evita capítulos inflados) y fallback de tiempo actual como último recurso
    const barTimes = getNativeBarTimes();
    if (barTimes && barTimes.durSec > 0) {
      domDuration = barTimes.durSec;
      if (domCurrent < 0 && barTimes.curSec >= 0) domCurrent = barTimes.curSec;
    }

    return { domCurrent, domDuration };
  }

  function getYtMusicTrackDuration() {
    const { domDuration } = getYtMusicPlaybackTimes();
    if (domDuration > 3) return domDuration;

    const barTimes = getNativeBarTimes();
    if (barTimes && barTimes.durSec > 3) return barTimes.durSec;

    const bridge = getBridgePlaybackData();
    if (bridge && bridge.isFresh && bridge.duration > 3) {
      return bridge.duration;
    }

    const video = getActiveVideo();
    if (video && !isNaN(video.duration) && isFinite(video.duration) && video.duration > 3) {
      return video.duration;
    }
    return 0;
  }

  function parseLrc(lrcString, realDuration = 0) {
    const lines = lrcString.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    let offsetMs = 0;

    const offsetRegex = /\[offset:\s*([+-]?\d+)\s*\]/i;
    lines.forEach(line => {
      const offMatch = offsetRegex.exec(line);
      if (offMatch) {
        offsetMs = parseInt(offMatch[1], 10) || 0;
      }
    });

    lines.forEach(line => {
      const match = timeRegex.exec(line);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = parseFloat('0.' + match[3]);
        let time = min * 60 + sec + ms + (offsetMs / 1000);
        const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
        if (text && time >= 0) {
          result.push({ time, text });
        }
      }
    });

    result.sort((a, b) => a.time - b.time);

    // Si la primera línea empieza tras un intro instrumental largo (> 4s), insertar indicador de intro
    if (result.length > 0 && result[0].time > 4.0) {
      result.unshift({
        time: 0,
        text: '🎵 [Intro Instrumental]',
        isIntro: true
      });
    }

    // Si la canción dura más que la última frase cantada (Outro instrumental), añadir bloque de Outro
    if (result.length > 0 && realDuration > 15) {
      const lastLyricTime = result[result.length - 1].time;
      if (realDuration - lastLyricTime > 6.0) {
        const outroTime = Math.max(lastLyricTime + 1.5, realDuration - 8.0);
        result.push({
          time: outroTime,
          text: '🎵 [Final / Outro Instrumental]',
          isOutro: true
        });
      }
    }

    autoPopulateWordsForLines(result, realDuration);
    return result;
  }

  // ==========================================================================
  // MOTOR RÍTMICO SILÁBICO Y FONÉTICO AUTOMÁTICO (ANIMACIÓN DE PALABRAS Y FRASES)
  // Genera animaciones palabra por palabra fluidas y naturales en YouTube Music
  // sin necesidad de editor manual
  // ==========================================================================
  function countSyllablesSpanish(word) {
    if (!word) return 1;
    const clean = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
    if (clean.length === 0) return 1;

    // Detectar siglas o consonantes consecutivas (ej: SDLG -> es-de-ele-ge)
    if (/^[bcdfghjklmnñpqrstvwxyz]+$/i.test(clean)) {
      return Math.max(1, clean.length * 1.3);
    }

    let s = clean;
    // Hiato acentuado
    s = s.replace(/([aeoáéó])([íú])/g, '$1 $2').replace(/([íú])([aeoáéó])/g, '$1 $2');
    // Diptongos y triptongos
    s = s.replace(/[iuü][aeoáéó][iuü]/g, 'V');
    s = s.replace(/[iuü][aeoáéó]/g, 'V');
    s = s.replace(/[aeoáéó][iuü]/g, 'V');
    s = s.replace(/[iuü]{2}/g, 'V');
    s = s.replace(/[aeiouáéíóúü]/g, 'V');

    const matches = s.match(/V/g);
    return matches ? Math.max(1, matches.length) : 1;
  }

  const SHORT_PROCLITICS = new Set([
    'y', 'a', 'el', 'la', 'los', 'las', 'de', 'del', 'en', 'un', 'una', 'con', 
    'que', 'pa', 'tu', 'mi', 'su', 'al', 'se', 'me', 'te', 'nos', 'le', 'o'
  ]);

  function smartDistributeWords(line, nextLineTime) {
    const text = (line.text || '').replace(/^🎵\s*\[.*?\]\s*/, '').trim();
    const tokens = text.split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) {
      line.words = [];
      return line.words;
    }

    const startT = typeof line.time === 'number' ? line.time : 0.0;
    const availableWindow = (typeof nextLineTime === 'number' && nextLineTime > startT)
      ? nextLineTime - startT
      : Math.max(2.5, tokens.length * 0.55);

    const windowRatio = 0.84;
    const minWordDur = 0.18;
    const holdMultiplier = 1.25;

    const naturalSingingDuration = Math.min(
      Math.max(tokens.length * minWordDur, availableWindow * windowRatio),
      tokens.length * 0.82
    );

    const weights = tokens.map((token, idx) => {
      const clean = token.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
      const syllables = countSyllablesSpanish(clean);
      let w = syllables * 1.0;

      if (SHORT_PROCLITICS.has(clean)) {
        w *= 0.65;
      }
      if (/[áéíóú]/.test(token)) {
        w *= 1.15;
      }
      if (idx === tokens.length - 1) {
        w *= holdMultiplier;
      }
      if (/[,;:\.\?!]/.test(token)) {
        w *= 1.1;
      }
      return Math.max(0.5, w);
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

    let curT = startT;
    line.words = tokens.map((w, idx) => {
      const wordTime = Math.round(curT * 100) / 100;
      const dur = (weights[idx] / totalWeight) * naturalSingingDuration;
      curT += Math.max(minWordDur, dur);
      return {
        text: w,
        time: wordTime
      };
    });

    return line.words;
  }

  function autoPopulateWordsForLines(lines, totalDuration = 0) {
    if (!Array.isArray(lines) || lines.length === 0) return lines;
    lines.forEach((line, i) => {
      if (Array.isArray(line.words) && line.words.length > 0) return;
      if (line.isIntro || line.isOutro) return;

      const nextLineTime = (i < lines.length - 1)
        ? lines[i + 1].time
        : (totalDuration > line.time ? totalDuration : line.time + 4.0);

      smartDistributeWords(line, nextLineTime);
    });
    return lines;
  }

  function getLyricsServerMode() {
    try {
      return localStorage.getItem('auramusic_lyrics_server_mode') || 'personal';
    } catch (_) {
      return 'personal';
    }
  }

  function setLyricsServerMode(mode) {
    try {
      localStorage.setItem('auramusic_lyrics_server_mode', mode);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ auramusic_lyrics_server_mode: mode });
      }
    } catch (_) {}
  }

  function getSavedLyricsOffset() {
    try {
      const v = parseFloat(localStorage.getItem('auramusic_lyrics_sync_offset'));
      return (!isNaN(v) && isFinite(v)) ? Math.round(v * 100) / 100 : 0.0;
    } catch (_) {
      return 0.0;
    }
  }

  function setSavedLyricsOffset(val) {
    const num = Math.round(val * 100) / 100;
    userLyricsOffset = num;
    try {
      localStorage.setItem('auramusic_lyrics_sync_offset', String(num));
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ auramusic_lyrics_sync_offset: num });
      }
    } catch (_) {}
  }

  // --- SISTEMA DE AUTO-SINCRONIZACIÓN INTELIGENTE (COMPENSACIÓN AUTOMÁTICA DE HARDWARE) ---
  function getAutoSyncEnabled() {
    try {
      const v = localStorage.getItem('auramusic_lyrics_auto_sync');
      return v === null ? true : (v === 'true' || v === '1');
    } catch (_) {
      return true;
    }
  }

  function setAutoSyncEnabled(enabled) {
    try {
      localStorage.setItem('auramusic_lyrics_auto_sync', enabled ? 'true' : 'false');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ auramusic_lyrics_auto_sync: enabled });
      }
    } catch (_) {}
  }

  function detectHardwareAudioMetrics() {
    let hwLatency = 0.05; // Base promedio de buffer de sonido en PC
    let isBluetooth = false;
    try {
      const ctx = (window.AuraMusic?.Audio?.getAudioCtx && window.AuraMusic.Audio.getAudioCtx()) || window.audioCtx;
      if (ctx) {
        const out = (typeof ctx.outputLatency === 'number' && isFinite(ctx.outputLatency) && ctx.outputLatency > 0) ? ctx.outputLatency : 0;
        const base = (typeof ctx.baseLatency === 'number' && isFinite(ctx.baseLatency) && ctx.baseLatency > 0) ? ctx.baseLatency : 0;
        if (out > 0 || base > 0) {
          hwLatency = out + base;
        }
        if (hwLatency >= 0.12) {
          isBluetooth = true;
        }
      }
    } catch (_) {}

    // Compensación fisiológica y de ataque fonético (ajusta el retardo humano al pisar notas en el editor)
    const baseReactionLead = 0.14; 
    const extraHwLead = (hwLatency > 0.06) ? (hwLatency - 0.06) : 0;
    const totalLead = Math.min(0.40, Math.max(0.08, baseReactionLead + extraHwLead));

    return {
      rawLatencyMs: Math.round(hwLatency * 1000),
      isBluetooth,
      autoOffset: -Math.round(totalLead * 100) / 100
    };
  }

  function getEffectiveLyricsOffset() {
    const isAuto = getAutoSyncEnabled();
    const manualFineTune = getSavedLyricsOffset();
    if (isAuto) {
      const { autoOffset } = detectHardwareAudioMetrics();
      return Math.round((autoOffset + manualFineTune) * 100) / 100;
    }
    return manualFineTune;
  }

  async function fetchSyncedLyrics(title, artist, duration, videoId) {
    const cleanTitle = (title || '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
    const cleanArtist = (artist || '').split(/[•·,\/]/)[0].replace(/\s+/g, ' ').trim();
    const serverMode = getLyricsServerMode();

    // 0. Si el modo es 'personal' (Recomendado): Consultar Servidor Personal de Letras (AuraLyrics Studio en localhost:3000)
    if (serverMode === 'personal') {
      try {
        let personalUrl = `http://localhost:3000/api/lyrics/get?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`;
        if (videoId) {
          personalUrl += `&videoId=${encodeURIComponent(videoId)}`;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(personalUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.found && data.track && Array.isArray(data.track.lines) && data.track.lines.length > 0) {
            console.log('👑 AuraMusic: ¡Utilizando letra personalizada desde tu Servidor Personal AuraLyrics!', data.track.title);
            const mapped = data.track.lines.map(l => ({
              time: typeof l.time === 'number' ? l.time : parseFloat(l.time) || 0,
              text: (l.type === 'spoken' ? '🗣️ ' : '') + l.text,
              isPersonalServer: true,
              type: l.type || 'vocal',
              words: Array.isArray(l.words) && l.words.length > 0 ? l.words : null
            })).sort((a, b) => a.time - b.time);
            return autoPopulateWordsForLines(mapped, duration);
          }
        }
      } catch (_) {
        // El servidor local no está iniciado o aún no tiene esta canción, continuar con LRCLIB como respaldo
      }
    }

    // 1. Búsqueda exacta en LrcLib (/api/search?track_name=...&artist_name=...)
    try {
      const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      console.log('🎤 AuraMusic: Buscando letras sincronizadas en LrcLib...', searchUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          const withSynced = list.filter(item => item.syncedLyrics);
          if (withSynced.length > 0) {
            if (duration > 0) {
              withSynced.sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));
            }
            console.log('✨ AuraMusic: ¡Letras sincronizadas con éxito para:', withSynced[0].trackName, '!');
            return parseLrc(withSynced[0].syncedLyrics, duration);
          }
        }
      }
    } catch (e) {
      console.warn('AuraMusic: Fallback en búsqueda 1 LrcLib', e);
    }

    // 2. Búsqueda general por query libre (/api/search?q=...)
    try {
      const queryUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle + ' ' + cleanArtist)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(queryUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          const withSynced = list.filter(item => item.syncedLyrics);
          if (withSynced.length > 0) {
            if (duration > 0) {
              withSynced.sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));
            }
            console.log('✨ AuraMusic: ¡Letras sincronizadas vía query libre:', withSynced[0].trackName, '!');
            return parseLrc(withSynced[0].syncedLyrics, duration);
          }
        }
      }
    } catch (e) {}

    // 3. Intento directo con /api/get
    try {
      const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}&duration=${Math.round(duration || 180)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(getUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.syncedLyrics) {
          return parseLrc(data.syncedLyrics, duration);
        }
      }
    } catch (e) {}

    // 4. Fallback: Extraer letras nativas SOLO si corresponden a la canción actual
    try {
      const playerBarTitle = document.querySelector('ytmusic-player-bar .title, ytmusic-player-bar yt-formatted-string.title')?.textContent?.trim().toLowerCase();
      if (playerBarTitle && cleanTitle && playerBarTitle.includes(cleanTitle.toLowerCase())) {
        const localDesc = document.querySelector('ytmusic-description-shelf-renderer .description');
        if (localDesc && localDesc.textContent.trim()) {
          const rawLines = localDesc.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          const totalSec = duration > 0 ? duration : 200;
          const step = totalSec / Math.max(1, rawLines.length);

          const rawMapped = rawLines.map((text, idx) => ({
            time: idx * step,
            text: text
          }));
          return autoPopulateWordsForLines(rawMapped, duration);
        }
      }
    } catch (e) {}

    // 5. Si no se encontraron letras sincronizadas, retornar null para que el gestor controle el estado
    return null;
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

      const mainLineSpan = document.createElement('span');
      mainLineSpan.className = 'line-primary';

      // Renderizar palabras con ritmos silábicos naturales (Modo Frases y Palabras Automáticas)
      let lineWords = Array.isArray(item.words) && item.words.length > 0 ? item.words : null;
      if (hasTranslation || !lineWords) {
        lineWords = smartDistributeWords({ text: displayText, time: item.time }, nextItem ? nextItem.time : (item.time + 3.5));
      }

      if (Array.isArray(lineWords) && lineWords.length > 0) {
        lineWords.forEach((wObj, i) => {
          const wStart = typeof wObj.time === 'number' ? wObj.time : parseFloat(wObj.time) || item.time;
          let wEnd;
          if (i < lineWords.length - 1) {
            const nextW = lineWords[i + 1];
            wEnd = typeof nextW.time === 'number' ? nextW.time : parseFloat(nextW.time);
          } else {
            wEnd = nextItem ? nextItem.time : (wStart + 2.5);
          }
          if (isNaN(wEnd) || wEnd <= wStart) wEnd = wStart + 0.35;

          const span = document.createElement('span');
          span.className = 'k-word';
          span.textContent = (wObj.text || '').trim();
          span.dataset.start = wStart.toFixed(2);
          span.dataset.end = wEnd.toFixed(2);
          span.dataset.widx = String(i);
          mainLineSpan.appendChild(span);
          if (i < lineWords.length - 1) {
            mainLineSpan.appendChild(document.createTextNode(' '));
          }
        });
      } else {
        const words = displayText.trim().split(/\s+/).filter(w => w.length > 0);
        words.forEach((w, i) => {
          const span = document.createElement('span');
          span.className = 'k-word';
          span.textContent = (w || '').trim();
          mainLineSpan.appendChild(span);
          if (i < words.length - 1) {
            mainLineSpan.appendChild(document.createTextNode(' '));
          }
        });
      }
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

      if (item.isOutro) {
        lineDiv.classList.add('cinema-outro-line');
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
      } else {
        // En los demás temas, píldora estilizada con la marca de tiempo de la línea
        const timeBadge = document.createElement('span');
        timeBadge.className = 'cinema-line-time';
        timeBadge.textContent = formatTime(item.time);
        lineDiv.insertBefore(timeBadge, lineDiv.firstChild);
      }

      lineDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const duration = getYtMusicTrackDuration();

        let seekTime = item.time;
        let targetWordIdx = 0;
        const clickedWord = e.target.closest('.k-word');
        if (item.isOutro && duration > 10) {
          seekTime = Math.max(0, duration - 6);
        } else {
          if (clickedWord && clickedWord.dataset.start) {
            const wTime = parseFloat(clickedWord.dataset.start);
            if (!isNaN(wTime) && isFinite(wTime)) {
              seekTime = wTime;
              targetWordIdx = parseInt(clickedWord.dataset.widx, 10) || 0;
            }
          }
          const effectiveOffset = getEffectiveLyricsOffset();
          if (effectiveOffset !== 0) {
            seekTime = Math.max(0, seekTime + effectiveOffset);
          }
        }

        // 1. Resaltar visualmente de inmediato la línea seleccionada con animación viva
        const allLines = document.querySelectorAll('#cinema-lyrics-wrapper .cinema-lyric-line');
        allLines.forEach((l, lIdx) => {
          if (lIdx === index) {
            l.classList.remove('active-line', 'sung-line');
            void l.offsetWidth; // Forzar reinicio de animación CSS de entrada (cinemaPhraseEntrance)
            l.classList.add('active-line');

            // Actualizar palabras de la línea seleccionada inmediatamente
            const wordsInLine = l.querySelectorAll('.k-word');
            wordsInLine.forEach((w, wIdx) => {
              if (wIdx < targetWordIdx) {
                w.className = 'k-word sung';
              } else if (wIdx === targetWordIdx) {
                w.className = 'k-word active';
              } else {
                w.className = 'k-word';
              }
            });
          } else if (lIdx < index) {
            l.classList.remove('active-line');
            l.classList.add('sung-line');
            l.querySelectorAll('.k-word').forEach(w => w.className = 'k-word sung');
          } else {
            l.classList.remove('active-line', 'sung-line');
            l.querySelectorAll('.k-word').forEach(w => w.className = 'k-word');
          }
        });

        // 2. Centrar la línea en la vista suavemente
        const container = document.getElementById('cinema-right-scroll');
        if (container) {
          const cRect = container.getBoundingClientRect();
          const lRect = lineDiv.getBoundingClientRect();
          const targetScroll = container.scrollTop + (lRect.top - cRect.top) - (cRect.height * 0.38);
          container.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }

        // 3. Sincronizar de inmediato referencias y estado del bucle de animación para fluidez sin pausas
        cachedActiveLineEl = lineDiv;
        cachedWordEls = Array.from(lineDiv.querySelectorAll('.k-word'));
        lastSingingWordIdx = targetWordIdx;
        lastCinemaActiveIdx = index;

        // 4. Saltar y reproducir inmediatamente desde ese verso vía API oficial y control directo
        seekTrack(seekTime, true);
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
          <div id="cinema-sync-nudge-box" class="cinema-sync-nudge-box" title="Ajuste milimétrico de sincronización">
            <button type="button" class="cinema-nudge-btn auto-btn active" id="cinema-nudge-auto" title="Auto-Sync Inteligente de Hardware (Compensa latencia de PC/auriculares y marcado)">⚡ Auto</button>
            <button type="button" class="cinema-nudge-btn" id="cinema-nudge-minus-coarse" title="Adelantar medio segundo (-0.5s)">-0.5s</button>
            <button type="button" class="cinema-nudge-btn" id="cinema-nudge-minus" title="Adelantar una décima (-0.1s)">-0.1s</button>
            <span class="cinema-nudge-val" id="cinema-nudge-val" title="Desfase actual. Clic para reiniciar ajuste manual">0.0s</span>
            <button type="button" class="cinema-nudge-btn" id="cinema-nudge-plus" title="Retrasar una décima (+0.1s)">+0.1s</button>
            <button type="button" class="cinema-nudge-btn" id="cinema-nudge-plus-coarse" title="Retrasar medio segundo (+0.5s)">+0.5s</button>
          </div>
          <button type="button" class="cinema-icon-btn" id="cinema-translate-btn" title="Traducir letra (🌐)">🌐</button>
          <button type="button" class="cinema-icon-btn" id="cinema-config-btn" title="Configuración de Letras y Servidor (⚙️)">⚙️</button>
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

      <!-- Modal de Configuración AuraMusic (General y Letras) -->
      <div id="cinema-settings-modal" class="cinema-settings-overlay" style="display: none;">
        <div class="cinema-settings-card">
          <div class="cinema-settings-header">
            <div class="cinema-settings-title">
              <span class="settings-title-icon">⚙️</span>
              <span>Configuración AuraMusic</span>
            </div>
            <button type="button" class="cinema-settings-close-btn" id="cinema-settings-close-btn" title="Cerrar configuración">✕</button>
          </div>

          <div class="cinema-settings-body">
            <!-- Barra Lateral de Secciones -->
            <div class="cinema-settings-sidebar">
              <button type="button" class="cinema-settings-tab-btn" data-tab="general" id="cinema-tab-btn-general">
                <span class="tab-icon">⚙️</span>
                <span>General</span>
              </button>
              <button type="button" class="cinema-settings-tab-btn active" data-tab="lyrics" id="cinema-tab-btn-lyrics">
                <span class="tab-icon">🎵</span>
                <span>Letras</span>
              </button>
            </div>

            <!-- Panel de Contenido de Secciones -->
            <div class="cinema-settings-content">
              <!-- Sección 1: General (Vacía como solicitó el usuario) -->
              <div class="cinema-settings-panel" id="cinema-panel-general" style="display: none;">
                <div class="settings-empty-placeholder">
                  <div class="empty-placeholder-icon">📁</div>
                  <div class="empty-placeholder-title">Sección General</div>
                  <div class="empty-placeholder-sub">No hay opciones configurables en esta sección por el momento.</div>
                </div>
              </div>

              <!-- Sección 2: Letras -->
              <div class="cinema-settings-panel" id="cinema-panel-lyrics" style="display: block;">
                <div class="settings-panel-header">
                  <h3 class="settings-panel-title">Servidor de Letras</h3>
                  <p class="settings-panel-subtitle">Selecciona el servidor que usará YouTube Music para obtener y sincronizar las letras:</p>
                </div>

                <div class="settings-server-options">
                  <!-- Opción 1: Servidor Personal (Recomendado) -->
                  <div class="settings-server-card selected" id="server-card-personal">
                    <div class="server-card-radio-box">
                      <input type="radio" name="auramusic-lyrics-server" value="personal" id="server-opt-personal" checked>
                      <span class="server-custom-radio"></span>
                    </div>
                    <div class="server-card-info">
                      <div class="server-card-title-row">
                        <span class="server-card-title">Servidor Personal AuraLyrics</span>
                        <span class="server-badge-recommended">(Recomendado)</span>
                      </div>
                      <p class="server-card-desc">Carga las letras sincronizadas y animadas desde tu servidor personal (<code>localhost:3000</code>). Si la canción no está guardada, recurre automáticamente a LRCLIB.</p>
                      <div class="server-status-pill" id="personal-server-status">
                        <span class="server-status-dot"></span>
                        <span class="server-status-text">Verificando conexión...</span>
                      </div>
                    </div>
                  </div>

                  <!-- Opción 2: Servidor Público LRCLIB -->
                  <div class="settings-server-card" id="server-card-lrclib">
                    <div class="server-card-radio-box">
                      <input type="radio" name="auramusic-lyrics-server" value="lrclib" id="server-opt-lrclib">
                      <span class="server-custom-radio"></span>
                    </div>
                    <div class="server-card-info">
                      <div class="server-card-title-row">
                        <span class="server-card-title">Servidor Público (LRCLIB)</span>
                      </div>
                      <p class="server-card-desc">Consulta directamente el servidor público normal (<code>lrclib.net</code>). No utiliza las canciones guardadas en tu servidor personal.</p>
                    </div>
                  </div>
                </div>

                <!-- Sección Calibración y Desfase de Audio -->
                <div class="settings-calibration-card" style="margin-top: 18px; padding: 16px 18px; background: rgba(255, 255, 255, 0.03); border: 1.5px solid rgba(255, 255, 255, 0.1); border-radius: 14px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <div>
                      <div style="font-size: 1rem; font-weight: 700; color: #fff;">Calibración Automática de Hardware (Auto-Sync)</div>
                      <div style="font-size: 0.82rem; color: rgba(255, 255, 255, 0.6);">Compensa automáticamente la latencia de controladores de sonido, buffers de audio (WASAPI/Realtek), auriculares Bluetooth y tiempo de reacción al sincronizar letras.</div>
                    </div>
                    <label class="cinema-switch" style="position: relative; display: inline-block; width: 44px; height: 24px; margin-left: 10px; flex-shrink: 0;">
                      <input type="checkbox" id="cinema-auto-sync-switch" checked>
                      <span class="cinema-slider"></span>
                    </label>
                  </div>
                  <div id="settings-hw-metrics" style="font-size: 0.8rem; color: #00f2fe; margin-bottom: 10px; background: rgba(0, 242, 254, 0.08); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(0, 242, 254, 0.2);">
                    ⚡ Latencia de Audio detectada: 50ms | Compensación activa: -0.14s
                  </div>
                  <div style="font-size: 0.85rem; font-weight: 600; color: rgba(255, 255, 255, 0.8); margin-top: 6px;">
                    Ajuste Fino Manual Adicional: <span style="font-weight: 800; color: #00f2fe; font-family: monospace;" id="panel-sync-offset-val">0.0s</span>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap;">
                    <button type="button" class="cinema-nudge-btn" id="panel-nudge-m5" style="background: rgba(255,255,255,0.08); padding: 6px 12px; border-radius: 8px;">-0.5s</button>
                    <button type="button" class="cinema-nudge-btn" id="panel-nudge-m1" style="background: rgba(255,255,255,0.08); padding: 6px 12px; border-radius: 8px;">-0.1s</button>
                    <button type="button" class="cinema-nudge-btn" id="panel-nudge-zero" style="background: rgba(0, 242, 254, 0.15); color: #00f2fe; padding: 6px 12px; border-radius: 8px;">Reiniciar (0.0s)</button>
                    <button type="button" class="cinema-nudge-btn" id="panel-nudge-p1" style="background: rgba(255,255,255,0.08); padding: 6px 12px; border-radius: 8px;">+0.1s</button>
                    <button type="button" class="cinema-nudge-btn" id="panel-nudge-p5" style="background: rgba(255,255,255,0.08); padding: 6px 12px; border-radius: 8px;">+0.5s</button>
                  </div>
                </div>

                <div class="settings-feedback-row" id="settings-feedback-msg" style="display:none;">
                  ✓ Ajuste guardado. Actualizando letras en tiempo real...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Eventos del Overlay
    const closeBtn = document.getElementById('cinema-close-btn');
    closeBtn.addEventListener('click', closeCinemaMode);

    // Editor manual eliminado: el sistema anima y sincroniza frases y palabras automáticamente en YouTube Music

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

    // Calibración milimétrica de sincronización de letra (+/- 0.1s y +/- 0.5s) con memoria persistente y Auto-Sync
    const nudgeAutoBtn = document.getElementById('cinema-nudge-auto');
    const nudgeMinusCoarse = document.getElementById('cinema-nudge-minus-coarse');
    const nudgeMinus = document.getElementById('cinema-nudge-minus');
    const nudgePlus = document.getElementById('cinema-nudge-plus');
    const nudgePlusCoarse = document.getElementById('cinema-nudge-plus-coarse');
    const nudgeVal = document.getElementById('cinema-nudge-val');

    const autoSyncSwitch = document.getElementById('cinema-auto-sync-switch');
    const hwMetricsEl = document.getElementById('settings-hw-metrics');
    const panelNudgeM5 = document.getElementById('panel-nudge-m5');
    const panelNudgeM1 = document.getElementById('panel-nudge-m1');
    const panelNudgeZero = document.getElementById('panel-nudge-zero');
    const panelNudgeP1 = document.getElementById('panel-nudge-p1');
    const panelNudgeP5 = document.getElementById('panel-nudge-p5');
    const panelSyncOffsetVal = document.getElementById('panel-sync-offset-val');

    function updateNudgeDisplay() {
      const isAuto = getAutoSyncEnabled();
      const manualOffset = getSavedLyricsOffset();
      const effectiveOffset = getEffectiveLyricsOffset();
      userLyricsOffset = effectiveOffset;

      if (nudgeAutoBtn) {
        nudgeAutoBtn.classList.toggle('active', isAuto);
        nudgeAutoBtn.title = isAuto 
          ? `Auto-Sync Activado: Hardware compensado automáticamente (${effectiveOffset > 0 ? '+' : ''}${effectiveOffset.toFixed(2)}s). Clic para desactivar.` 
          : `Auto-Sync Desactivado. Clic para activar compensación automática de hardware.`;
      }

      if (autoSyncSwitch) {
        autoSyncSwitch.checked = isAuto;
      }

      if (hwMetricsEl) {
        const hw = detectHardwareAudioMetrics();
        if (isAuto) {
          hwMetricsEl.style.display = 'block';
          hwMetricsEl.innerHTML = `⚡ <strong>Auto-Sync Activo</strong> | Buffer Hardware: <strong>${hw.rawLatencyMs}ms</strong> (${hw.isBluetooth ? 'Bluetooth' : 'Altavoces/Línea'}) | Compensación: <strong>${hw.autoOffset.toFixed(2)}s</strong> | Offset total: <strong>${effectiveOffset > 0 ? '+' : ''}${effectiveOffset.toFixed(2)}s</strong>`;
        } else {
          hwMetricsEl.style.display = 'block';
          hwMetricsEl.innerHTML = `⚪ <strong>Auto-Sync Inactivo</strong> | Latencia de Audio: ${hw.rawLatencyMs}ms | Modo manual: <strong>${manualOffset > 0 ? '+' : ''}${manualOffset.toFixed(1)}s</strong>`;
        }
      }

      const sign = manualOffset > 0 ? '+' : '';
      const manualText = `${sign}${manualOffset.toFixed(1)}s`;
      
      if (nudgeVal) {
        if (isAuto) {
          const effSign = effectiveOffset > 0 ? '+' : '';
          nudgeVal.textContent = `⚡${effSign}${effectiveOffset.toFixed(2)}s`;
          nudgeVal.title = `Auto-Sync activo (${effectiveOffset.toFixed(2)}s). Desfase manual: ${manualText}. Clic para reiniciar ajuste fino manual.`;
        } else {
          nudgeVal.textContent = manualText;
          nudgeVal.title = `Desfase manual actual (${manualText}). Clic para reiniciar a 0.0s`;
        }
      }

      if (panelSyncOffsetVal) {
        panelSyncOffsetVal.textContent = manualText;
      }
    }

    function toggleAutoSync() {
      const next = !getAutoSyncEnabled();
      setAutoSyncEnabled(next);
      updateNudgeDisplay();
    }

    function changeLyricsOffset(delta) {
      const current = getSavedLyricsOffset();
      const nextVal = Math.round((current + delta) * 100) / 100;
      setSavedLyricsOffset(nextVal);
      updateNudgeDisplay();
    }

    if (nudgeAutoBtn) nudgeAutoBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleAutoSync(); });
    if (nudgeMinusCoarse) nudgeMinusCoarse.addEventListener('click', (e) => { e.stopPropagation(); changeLyricsOffset(-0.5); });
    if (nudgeMinus) nudgeMinus.addEventListener('click', (e) => { e.stopPropagation(); changeLyricsOffset(-0.1); });
    if (nudgePlus) nudgePlus.addEventListener('click', (e) => { e.stopPropagation(); changeLyricsOffset(0.1); });
    if (nudgePlusCoarse) nudgePlusCoarse.addEventListener('click', (e) => { e.stopPropagation(); changeLyricsOffset(0.5); });
    if (nudgeVal) nudgeVal.addEventListener('click', (e) => { e.stopPropagation(); setSavedLyricsOffset(0.0); updateNudgeDisplay(); });

    if (autoSyncSwitch) autoSyncSwitch.addEventListener('change', () => {
      setAutoSyncEnabled(autoSyncSwitch.checked);
      updateNudgeDisplay();
    });

    if (panelNudgeM5) panelNudgeM5.addEventListener('click', (e) => { e.stopPropagation(); changeLyricsOffset(-0.5); });
    if (panelNudgeM1) panelNudgeM1.addEventListener('click', (e) => { e.stopPropagation(); changeLyricsOffset(-0.1); });
    if (panelNudgeZero) panelNudgeZero.addEventListener('click', (e) => { e.stopPropagation(); setSavedLyricsOffset(0.0); updateNudgeDisplay(); });
    if (panelNudgeP1) panelNudgeP1.addEventListener('click', (e) => { e.stopPropagation(); changeLyricsOffset(0.1); });
    if (panelNudgeP5) panelNudgeP5.addEventListener('click', (e) => { e.stopPropagation(); changeLyricsOffset(0.5); });

    updateNudgeDisplay();

    // --- LÓGICA DE CONFIGURACIÓN Y SERVIDOR DE LETRAS ---
    const configBtn = document.getElementById('cinema-config-btn');
    const settingsModal = document.getElementById('cinema-settings-modal');
    const settingsCloseBtn = document.getElementById('cinema-settings-close-btn');
    const tabGeneral = document.getElementById('cinema-tab-btn-general');
    const tabLyrics = document.getElementById('cinema-tab-btn-lyrics');
    const panelGeneral = document.getElementById('cinema-panel-general');
    const panelLyrics = document.getElementById('cinema-panel-lyrics');
    const optPersonal = document.getElementById('server-opt-personal');
    const optLrclib = document.getElementById('server-opt-lrclib');
    const cardPersonal = document.getElementById('server-card-personal');
    const cardLrclib = document.getElementById('server-card-lrclib');
    const feedbackMsg = document.getElementById('settings-feedback-msg');

    function openSettingsModal() {
      if (!settingsModal) return;
      settingsModal.style.display = 'flex';
      settingsModal.classList.add('active');
      const curMode = getLyricsServerMode();
      if (optPersonal && optLrclib) {
        optPersonal.checked = (curMode === 'personal');
        optLrclib.checked = (curMode === 'lrclib');
      }
      if (cardPersonal && cardLrclib) {
        cardPersonal.classList.toggle('selected', curMode === 'personal');
        cardLrclib.classList.toggle('selected', curMode === 'lrclib');
      }
      updateNudgeDisplay();
      checkPersonalServerStatus();
    }

    function closeSettingsModal() {
      if (!settingsModal) return;
      settingsModal.classList.remove('active');
      settingsModal.style.display = 'none';
    }

    async function checkPersonalServerStatus() {
      const pill = document.getElementById('personal-server-status');
      if (!pill) return;
      const text = pill.querySelector('.server-status-text');
      try {
        const res = await fetch('http://localhost:3000/api/status', { signal: AbortSignal.timeout(1800) });
        if (res.ok) {
          const data = await res.json();
          pill.className = 'server-status-pill online';
          if (text) text.textContent = `Conectado (${data.totalTracks || 0} canciones en tu servidor)`;
        } else {
          throw new Error('Offline');
        }
      } catch (_) {
        pill.className = 'server-status-pill offline';
        if (text) text.textContent = 'Desconectado (Servidor local apagado)';
      }
    }

    function switchSettingsTab(tabName) {
      if (tabGeneral) tabGeneral.classList.toggle('active', tabName === 'general');
      if (tabLyrics) tabLyrics.classList.toggle('active', tabName === 'lyrics');
      if (panelGeneral) panelGeneral.style.display = (tabName === 'general') ? 'block' : 'none';
      if (panelLyrics) panelLyrics.style.display = (tabName === 'lyrics') ? 'block' : 'none';
    }

    function handleServerModeChange(newMode) {
      setLyricsServerMode(newMode);
      if (optPersonal && optLrclib) {
        optPersonal.checked = (newMode === 'personal');
        optLrclib.checked = (newMode === 'lrclib');
      }
      if (cardPersonal && cardLrclib) {
        cardPersonal.classList.toggle('selected', newMode === 'personal');
        cardLrclib.classList.toggle('selected', newMode === 'lrclib');
      }

      if (feedbackMsg) {
        feedbackMsg.style.display = 'block';
        feedbackMsg.textContent = newMode === 'personal'
          ? '✓ Servidor Personal activado (Recomendado). Recargando letras...'
          : '✓ Servidor Público (LRCLIB) activado. Recargando letras...';
        setTimeout(() => {
          if (feedbackMsg) feedbackMsg.style.display = 'none';
        }, 2600);
      }

      // Limpiar caché y forzar recarga inmediata de la canción activa con el nuevo servidor
      preloadLyricsCache = {};
      currentTrackKey = '';
      lastCinemaTrackId = '';
      const { title, artist, coverUrl, videoId } = getCurrentTrackInfo();
      if (title) {
        updateCinemaTrack(title, artist, coverUrl, videoId);
      }
    }

    if (configBtn) {
      configBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSettingsModal();
      });
    }

    if (settingsCloseBtn) {
      settingsCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSettingsModal();
      });
    }

    if (settingsModal) {
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
          closeSettingsModal();
        }
      });
    }

    if (tabGeneral) {
      tabGeneral.addEventListener('click', (e) => {
        e.stopPropagation();
        switchSettingsTab('general');
      });
    }

    if (tabLyrics) {
      tabLyrics.addEventListener('click', (e) => {
        e.stopPropagation();
        switchSettingsTab('lyrics');
      });
    }

    if (cardPersonal) {
      cardPersonal.addEventListener('click', (e) => {
        e.stopPropagation();
        handleServerModeChange('personal');
      });
    }

    if (cardLrclib) {
      cardLrclib.addEventListener('click', (e) => {
        e.stopPropagation();
        handleServerModeChange('lrclib');
      });
    }

    if (optPersonal) {
      optPersonal.addEventListener('change', () => handleServerModeChange('personal'));
    }

    if (optLrclib) {
      optLrclib.addEventListener('change', () => handleServerModeChange('lrclib'));
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isCinemaActive) {
        if (settingsModal && settingsModal.classList.contains('active')) {
          closeSettingsModal();
          return;
        }
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

    let lastUserNavClick = 0;

    function togglePlayback() {
      const now = Date.now();
      if (now - lastUserNavClick < 400) return;
      lastUserNavClick = now;
      sendPlayerCommand({ action: 'togglePlay' });
    }

    function triggerQuickTrackPoll() {
      let count = 0;
      const intId = setInterval(() => {
        checkCinemaTrackChange();
        count++;
        if (count > 5) clearInterval(intId);
      }, 350);
    }

    function playPrevTrack() {
      const now = Date.now();
      if (now - lastUserNavClick < 500) return;
      lastUserNavClick = now;
      sendPlayerCommand({ action: 'prev' });
      triggerQuickTrackPoll();
    }

    function playNextTrack() {
      const now = Date.now();
      if (now - lastUserNavClick < 500) return;
      lastUserNavClick = now;
      sendPlayerCommand({ action: 'next' });
      triggerQuickTrackPoll();
    }

    if (playBtn) playBtn.addEventListener('click', togglePlayback);
    if (prevBtn) prevBtn.addEventListener('click', playPrevTrack);
    if (nextBtn) nextBtn.addEventListener('click', playNextTrack);

    if (waPlayBtn) waPlayBtn.addEventListener('click', togglePlayback);
    if (waPrevBtn) waPrevBtn.addEventListener('click', playPrevTrack);
    if (waNextBtn) waNextBtn.addEventListener('click', playNextTrack);

    // Salto y arrastre fluido en la barra de tiempo (Pointer Events con bloqueo anti-rebote)
    const progressBg = document.getElementById('cinema-progress-bg');

    let lastSeekCommitTime = 0;
    let lastSeekCommitTarget = -1;

    function handleProgressSeek(e, commitToVideo) {
      const dur = getYtMusicTrackDuration() || (getActiveVideo()?.duration || 0);
      if (dur <= 0) return;
      const rect = progressBg.getBoundingClientRect();
      if (rect.width <= 0) return;

      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      let targetTime = pct * dur;

      // Proteger el borde final para que MSE no desborde
      if (dur > 1 && targetTime > dur - 0.2) {
        targetTime = Math.max(0, dur - 0.3);
      }
      targetTime = Math.max(0, targetTime);

      const fill = document.getElementById('cinema-progress-fill');
      const curSpan = document.getElementById('cinema-current-time');
      const waTimePill = document.getElementById('cinema-wa-time');

      if (fill) {
        fill.classList.add('is-seeking');
        fill.style.setProperty('transition', 'none', 'important');
        fill.style.width = `${Math.max(0, Math.min(100, (targetTime / dur) * 100))}%`;
      }
      if (curSpan) {
        curSpan.textContent = formatTime(targetTime);
      }
      if (waTimePill) {
        waTimePill.textContent = `${formatTime(targetTime)} / ${formatTime(dur)}`;
      }

      if (commitToVideo) {
        const now = Date.now();
        // Descartar seeks duplicados disparados en ráfaga por pointerup + click en menos de 220ms
        if (now - lastSeekCommitTime < 220 && Math.abs(targetTime - lastSeekCommitTarget) < 0.6) {
          return;
        }
        lastSeekCommitTime = now;
        lastSeekCommitTarget = targetTime;
        seekTrack(targetTime, true);
      }
    }

    if (progressBg) {
      progressBg.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { progressBg.setPointerCapture(e.pointerId); } catch (_) {}
        isUserDraggingProgress = true;
        handleProgressSeek(e, false);
      });

      progressBg.addEventListener('pointermove', (e) => {
        if (!isUserDraggingProgress) return;
        e.preventDefault();
        handleProgressSeek(e, false);
      });

      const endPointerSeek = (e) => {
        if (!isUserDraggingProgress) return;
        isUserDraggingProgress = false;
        try { progressBg.releasePointerCapture(e.pointerId); } catch (_) {}
        handleProgressSeek(e, true);
      };

      progressBg.addEventListener('pointerup', endPointerSeek);
      progressBg.addEventListener('pointercancel', endPointerSeek);

      // Clic directo en la barra para salto inmediato en cualquier punto
      progressBg.addEventListener('click', (e) => {
        handleProgressSeek(e, true);
      });
    }
  }

  let lastCinemaTrackId = '';
  let isUpdatingCinemaTrack = false;
  let cinemaTrackGen = 0;
  let lastCinemaActiveIdx = -1;
  let pendingCinemaTrackUpdate = null;
  let cinemaGraceUntil = 0;
  let cinemaSeekLockUntil = 0;
  let cinemaSeekTargetTime = -1;
  let isUserDraggingProgress = false;
  let lastRenderedPlaybackTime = 0;
  let cinemaTrackChangeTime = 0;
  let preloadLyricsCache = {};
  let preloadTriggeredForTrackId = '';
  let preloadNextTrackId = '';
  let userLyricsOffset = getSavedLyricsOffset();
  let lastPreloadCheckTime = 0;

  function attachVideoListeners(video) {
    if (!video || video.dataset.auramusicCinemaListening) return;
    video.dataset.auramusicCinemaListening = 'true';
    video.addEventListener('play', () => checkCinemaTrackChange());
    video.addEventListener('loadedmetadata', () => checkCinemaTrackChange());
    video.addEventListener('loadstart', () => {
      cinemaTrackChangeTime = Date.now();
      resetCinemaProgressImmediate();
      setTimeout(checkCinemaTrackChange, 60);
      setTimeout(checkCinemaTrackChange, 200);
      setTimeout(checkCinemaTrackChange, 500);
    });
    video.addEventListener('ended', () => {
      cinemaTrackChangeTime = Date.now();
      resetCinemaProgressImmediate();
      setTimeout(checkCinemaTrackChange, 60);
      setTimeout(checkCinemaTrackChange, 200);
      setTimeout(checkCinemaTrackChange, 500);
    });
    video.addEventListener('emptied', () => {
      cinemaTrackChangeTime = Date.now();
      resetCinemaProgressImmediate();
    });
    video.addEventListener('seeked', () => {
      cinemaSeekLockUntil = 0;
      cinemaSeekTargetTime = -1;
      if (video) lastRenderedPlaybackTime = video.currentTime;
      const fill = document.getElementById('cinema-progress-fill');
      if (fill) fill.classList.remove('is-seeking');
    });
  }

  // Escuchar navegación oficial SPA de YouTube Music para sincronizar cambios de canción al instante
  document.addEventListener('yt-navigate-finish', () => {
    if (isCinemaActive) {
      setTimeout(checkCinemaTrackChange, 60);
      setTimeout(checkCinemaTrackChange, 220);
      setTimeout(checkCinemaTrackChange, 550);
    }
  });

  function makeLyricsCacheKey(title, artist) {
    const t = (title || '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const a = (artist || '').split(/[•·,\/]/)[0].replace(/\s+/g, ' ').trim().toLowerCase();
    return `${t}:::${a}`;
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
    const curTrackKey = lastCinemaTrackId;
    if (!curTrackKey) return;

    if (timeLeft <= 14 && preloadTriggeredForTrackId !== curTrackKey) {
      const pred = getPredictedNextTrack();
      if (!pred || !pred.title) return;
      preloadTriggeredForTrackId = curTrackKey;
      const nextCacheKey = makeLyricsCacheKey(pred.title, pred.artist || '');
      if (preloadLyricsCache[nextCacheKey]) return;

      console.log('🔮 AuraMusic: Precargando letra de la siguiente canción:', pred.title);
      try {
        const estDuration = Math.max(120, Math.round(video.duration));
        const lyr = await fetchSyncedLyrics(pred.title, pred.artist || '', estDuration);
        if (lyr && lyr.length > 0 && !lyr.some(l => l.isFallback)) {
          preloadLyricsCache[nextCacheKey] = { lyrics: lyr, fetchedAt: Date.now() };
          console.log('✅ AuraMusic: Letra precargada con éxito para:', pred.title);
        }
      } catch (e) {
        console.warn('AuraMusic: Falló precarga de letra:', e);
      }
    }
  }

  function resetCinemaProgressImmediate() {
    const fill = document.getElementById('cinema-progress-fill');
    const curSpan = document.getElementById('cinema-current-time');
    const totSpan = document.getElementById('cinema-total-time');
    const waTimePill = document.getElementById('cinema-wa-time');

    isUserDraggingProgress = false;
    cinemaSeekTargetTime = -1;
    cinemaSeekLockUntil = 0;
    lastRenderedPlaybackTime = 0;

    if (fill) {
      fill.classList.remove('is-seeking');
      fill.style.setProperty('transition', 'none', 'important');
      fill.style.width = '0%';
    }
    if (curSpan) curSpan.textContent = '0:00';
    if (totSpan) totSpan.textContent = '0:00';
    if (waTimePill) waTimePill.textContent = '0:00 / 0:00';
  }

  function resetCinemaLyricsStateImmediate() {
    currentLyrics = [];
    lastCinemaActiveIdx = -1;
    isTranslationActive = false;
    userLyricsOffset = getEffectiveLyricsOffset();
    const nudgeVal = document.getElementById('cinema-nudge-val');
    const panelSyncOffsetVal = document.getElementById('panel-sync-offset-val');
    const nudgeAutoBtn = document.getElementById('cinema-nudge-auto');
    const autoSyncSwitch = document.getElementById('cinema-auto-sync-switch');
    const isAuto = getAutoSyncEnabled();
    const manualOffset = getSavedLyricsOffset();
    const effectiveOffset = getEffectiveLyricsOffset();
    if (nudgeAutoBtn) nudgeAutoBtn.classList.toggle('active', isAuto);
    if (autoSyncSwitch) autoSyncSwitch.checked = isAuto;
    if (nudgeVal) {
      if (isAuto) {
        const effSign = effectiveOffset > 0 ? '+' : '';
        nudgeVal.textContent = `⚡${effSign}${effectiveOffset.toFixed(2)}s`;
      } else {
        const sign = manualOffset > 0 ? '+' : '';
        nudgeVal.textContent = `${sign}${manualOffset.toFixed(1)}s`;
      }
    }
    if (panelSyncOffsetVal) {
      const sign = manualOffset > 0 ? '+' : '';
      panelSyncOffsetVal.textContent = `${sign}${manualOffset.toFixed(1)}s`;
    }
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
    let videoId = '';
    let coverUrl = '';

    // 0. Obtener videoId desde URL si existe
    let urlVideoId = '';
    try {
      const urlParams = new URLSearchParams(window.location.search);
      urlVideoId = urlParams.get('v') || '';
    } catch (_) {}

    // 1. Datos autoritativos directos del Bridge API de YouTube Music (#movie_player)
    const bridge = getBridgePlaybackData();
    // Comprobar si el bridge está sincronizado con la URL actual para no leer canciones rezagadas
    const bridgeMatchesUrl = !urlVideoId || !bridge?.videoId || bridge.videoId === urlVideoId;

    if (bridge && bridge.title && bridgeMatchesUrl) {
      title = bridge.title;
      artist = bridge.artist || '';
      videoId = bridge.videoId || urlVideoId;
      if (bridge.artwork) coverUrl = bridge.artwork;
    }

    // 2. MediaSession oficial de Chrome / YouTube Music
    if (!title && navigator.mediaSession && navigator.mediaSession.metadata) {
      const meta = navigator.mediaSession.metadata;
      if (meta.title) title = meta.title.trim();
      if (meta.artist) artist = meta.artist.trim();
      if (meta.artwork && meta.artwork.length > 0) {
        coverUrl = meta.artwork[meta.artwork.length - 1].src || '';
      }
    }

    // 3. DOM de YouTube Music (ytmusic-player-bar)
    if (!title) {
      const titleEl = document.querySelector('ytmusic-player-bar .title, ytmusic-player-bar yt-formatted-string.title, ytmusic-player-bar .middle-controls .title');
      if (titleEl) title = titleEl.textContent.trim();
      const artistEl = document.querySelector('ytmusic-player-bar .byline, ytmusic-player-bar yt-formatted-string.byline, ytmusic-player-bar .middle-controls .byline');
      if (artistEl) artist = artistEl.textContent.trim();
    }

    // 4. Fallback al título de la página
    if (!title && document.title) {
      const clean = document.title.replace(' - YouTube Music', '').replace(' | YouTube Music', '').trim();
      if (clean && clean !== 'YouTube Music') {
        if (clean.includes(' - ')) {
          const p = clean.split(' - ');
          title = p[0].trim();
          artist = p[1] ? p[1].trim() : '';
        } else {
          title = clean;
        }
      }
    }

    // 5. Video ID final
    if (!videoId) {
      videoId = urlVideoId;
      if (!videoId) {
        const linkEl = document.querySelector('ytmusic-player-bar a[href*="watch?v="]');
        if (linkEl && linkEl.href) {
          const m = linkEl.href.match(/[?&]v=([^&#]+)/);
          if (m) videoId = m[1];
        }
      }
    }

    if (!coverUrl) {
      coverUrl = getHighResCoverUrl();
    }

    return { title, artist, videoId, coverUrl };
  }

  // --- COLA DINÁMICA ESTILO WHATSAPP (LISTA DE CHATS LATERAL) ---
  function populateWhatsAppQueueList(currentTitle, currentArtist, currentCover) {
    const listEl = document.getElementById('whatsapp-songs-queue-list');
    if (!listEl) return;

    const queueItems = Array.from(document.querySelectorAll('ytmusic-player-queue-item, .queue-item, [role="listitem"] ytmusic-responsive-list-item-renderer'));
    const itemsData = [];

    // Fila 1: Canción activa
    itemsData.push({
      title: currentTitle || 'Canción actual',
      artist: currentArtist || 'Artista',
      cover: currentCover || '',
      isActive: true,
      time: 'Ahora'
    });

    // Filas siguientes desde el DOM de YouTube Music
    if (queueItems.length > 0) {
      queueItems.slice(0, 15).forEach((qEl, idx) => {
        try {
          const tEl = qEl.querySelector('.title, .flex-column yt-formatted-string:first-child, .song-title');
          const aEl = qEl.querySelector('.byline, .flex-column yt-formatted-string:last-child, .artist-name, .secondary-flex-columns');
          const imgEl = qEl.querySelector('img');
          const t = tEl ? tEl.textContent.trim() : '';
          const a = aEl ? aEl.textContent.trim() : '';
          let c = imgEl ? imgEl.src : '';
          if (c && c.includes('=w')) c = c.replace(/=w\d+-h\d+[^?]*/, '=w120-h120-l90-rj');

          if (t && t.toLowerCase() !== (currentTitle || '').toLowerCase()) {
            itemsData.push({
              title: t,
              artist: a,
              cover: c || currentCover,
              isActive: false,
              time: `${idx + 1}:00`,
              domElement: qEl
            });
          }
        } catch (_) {}
      });
    }

    listEl.innerHTML = '';
    itemsData.slice(0, 10).forEach(item => {
      const row = document.createElement('div');
      row.className = 'whatsapp-chat-row' + (item.isActive ? ' active-song-chat' : '');
      row.innerHTML = `
        <img src="${item.cover || 'assets/auramusic_icon_128.png'}" alt="Cover" class="wa-round-avatar" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">
        <div class="whatsapp-chat-row-info">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span class="whatsapp-chat-row-title">${item.title}</span>
            <span class="whatsapp-chat-row-time">${item.time}</span>
          </div>
          <span class="whatsapp-chat-row-sub">${item.isActive ? '▶ Reproduciendo ahora' : item.artist}</span>
        </div>
      `;

      row.addEventListener('click', () => {
        if (!item.isActive) {
          if (item.domElement) {
            try {
              const playClick = item.domElement.querySelector('.play-button, .thumbnail, [aria-label*="play" i], yt-icon') || item.domElement;
              playClick.click();
            } catch (_) {}
          }
          sendPlayerCommand({ action: 'next' });
          triggerQuickTrackPoll();
        }
      });

      listEl.appendChild(row);
    });
  }

  let activeTransitionFromTrackId = '';
  let activeTransitionTimestamp = 0;

  function handleTrackChangeDetected(newTitle, newArtist, newVideoId, newCover) {
    if (!newTitle || newTitle === 'Cargando...' || newTitle === 'YouTube Music') return;

    const cleanTitle = newTitle.replace(/\(.*?\)|\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
    const cleanArtist = (newArtist || '').split(/[•·,\/]/)[0].replace(/\s+/g, ' ').trim();
    if (!cleanTitle) return;

    // Track ID autoritativo que incluye videoId para diferenciar remakes, directos o canciones homónimas
    const trackId = `${cleanTitle.toLowerCase()}:::${cleanArtist.toLowerCase()}:::${newVideoId || ''}`;

    // Si es exactamente la misma pista activa que ya está reproduciéndose o cargando
    if (trackId === currentTrackKey) {
      if (isFetchingLyrics || (currentLyrics && currentLyrics.length > 0)) {
        return;
      }
    }

    // Filtro anti-rebote (Stale Bounce-Back Rejection):
    // Si acabamos de cambiar a otra canción hace menos de 2500ms, y nos llega un evento
    // rezagado de la canción previa que dejamos atrás, lo ignoramos.
    const now = Date.now();
    if (activeTransitionFromTrackId && trackId === activeTransitionFromTrackId && (now - activeTransitionTimestamp < 2500)) {
      console.log('🛡️ AuraMusic: Descartando rebote rezagado de canción previa:', cleanTitle);
      return;
    }

    console.log('🔄 AuraMusic: Cambio de canción confirmado:', trackId);
    activeTransitionFromTrackId = currentTrackKey;
    activeTransitionTimestamp = now;
    currentTrackKey = trackId;
    lastCinemaTrackId = trackId;
    cinemaTrackChangeTime = now;

    updateCinemaTrack(newTitle, newArtist, newCover, newVideoId);
  }

  function checkCinemaTrackChange() {
    if (!isCinemaActive) return;
    const { title, artist, videoId, coverUrl } = getCurrentTrackInfo();
    if (!title || title === 'Cargando...' || title === 'YouTube Music') return;
    handleTrackChangeDetected(title, artist, videoId, coverUrl);
  }

  async function updateCinemaTrack(title, artist, hintCover, videoId) {
    const curGen = ++cinemaTrackGen;
    isFetchingLyrics = true;

    const cleanTitle = (title || '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/\s+/g, ' ').trim() || 'Canción';
    const cleanArtist = (artist || '').split(/[•·,\/]/)[0].replace(/\s+/g, ' ').trim() || 'Artista';

    const trackTitleEl = document.getElementById('cinema-track-title');
    const trackArtistEl = document.getElementById('cinema-track-artist');
    const artImg = document.getElementById('cinema-art-img');
    const wrapper = document.getElementById('cinema-lyrics-wrapper');

    if (trackTitleEl) trackTitleEl.textContent = cleanTitle;
    if (trackArtistEl) trackArtistEl.textContent = cleanArtist;

    const newCover = getHighResCoverUrl(hintCover) || 'https://music.youtube.com/img/on_platform_logo.svg';
    if (artImg && newCover) {
      artImg.style.opacity = '0.3';
      artImg.style.transform = 'scale(0.96)';
      artImg.src = newCover;
      artImg.dataset.loadedSrc = newCover;

      artImg.onload = () => {
        if (curGen !== cinemaTrackGen) return;
        artImg.style.opacity = '1';
        artImg.style.transform = 'scale(1)';
        try {
          if (window.AuraMusic?.Ambient?.updateAmbientGlowColor) {
            window.AuraMusic.Ambient.updateAmbientGlowColor();
          }
        } catch (e) {}
      };
      artImg.onerror = () => {
        artImg.style.opacity = '1';
        artImg.style.transform = 'scale(1)';
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

    resetCinemaProgressImmediate();

    // 1. Comprobar caché de letras precargadas para hotload instantáneo
    let lyrics = null;
    const cacheKey = makeLyricsCacheKey(cleanTitle, cleanArtist);

    if (preloadLyricsCache[cacheKey] && Array.isArray(preloadLyricsCache[cacheKey].lyrics)) {
      const cached = preloadLyricsCache[cacheKey].lyrics;
      const isCachedFallback = cached.some(l => l.isFallback);
      if (!isCachedFallback && cached.length > 0) {
        lyrics = cached;
        console.log('⚡ AuraMusic: HOTLOAD! Letra en caché aplicada al instante para:', cleanTitle);
      }
    }

    // 2. Si no está en caché, mostrar estado de carga elegante
    if (!lyrics) {
      if (wrapper) {
        wrapper.innerHTML = '<div class="cinema-lyric-line active-line">Sincronizando letra...</div>';
      }

      let duration = getYtMusicTrackDuration();
      if (duration <= 0) {
        for (let tries = 0; tries < 4; tries++) {
          await new Promise(r => setTimeout(r, 80));
          if (curGen !== cinemaTrackGen) return;
          duration = getYtMusicTrackDuration();
          if (duration > 0) break;
        }
      }
      const video = getActiveVideo();
      if (duration <= 0) {
        duration = (video && !isNaN(video.duration) && video.duration > 0) ? video.duration : 180;
      }

      try {
        const curVidId = videoId || getCurrentTrackInfo().videoId;
        lyrics = await fetchSyncedLyrics(cleanTitle, cleanArtist, duration, curVidId);
      } catch (err) {
        console.warn('AuraMusic: Error al buscar letras:', err);
      }
    }

    // 3. Si se inició otra canción posterior mientras se consultaba la red, descartar
    if (curGen !== cinemaTrackGen) {
      console.log('⏭️ AuraMusic: Descartando resultado de letra obsoleta para:', cleanTitle);
      return;
    }

    // 4. Determinar si son letras reales o si usamos fallback de cortesía
    let isFallback = false;
    if (!lyrics || !Array.isArray(lyrics) || lyrics.length === 0) {
      isFallback = true;
      lyrics = autoPopulateWordsForLines([
        { time: 0, text: '♪ Disfruta de la música ♪', isFallback: true },
        { time: 4, text: cleanTitle || 'Canción', isFallback: true },
        { time: 10, text: cleanArtist || 'Artista', isFallback: true }
      ], 180);
    }

    let finalLyrics = lyrics;
    if (isTranslationActive && !isFallback) {
      try {
        const targetLang = (navigator.language || 'es').split('-')[0].toLowerCase();
        finalLyrics = await translateLyrics(lyrics, targetLang);
      } catch (_) {}
    }

    // 5. NUNCA guardar fallbacks dummy en la caché (solo guardar letras reales)
    if (!isFallback && Array.isArray(finalLyrics) && finalLyrics.length > 0) {
      preloadLyricsCache[cacheKey] = { lyrics: finalLyrics, fetchedAt: Date.now() };
    }

    currentLyrics = finalLyrics;
    isFetchingLyrics = false;
    lastCinemaActiveIdx = -1;
    renderCinemaLyricsDOM();

    const rightScroll = document.getElementById('cinema-right-scroll');
    if (rightScroll) {
      rightScroll.scrollTop = 0;
      rightScroll.scrollTo({ top: 0, behavior: 'instant' });
      requestAnimationFrame(() => {
        if (rightScroll) rightScroll.scrollTop = 0;
      });
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
    document.body.classList.add('auramusic-cinema-active');

    // Resetear llaves para forzar la carga y renderizado inmediato en el DOM
    currentTrackKey = '';
    lastCinemaTrackId = '';
    isFetchingLyrics = false;

    const barBtn = document.getElementById('auramusic-bar-lyrics-btn');
    if (barBtn) barBtn.classList.add('active');

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

    // Escuchar eventos directos del elemento de video para cambios instantáneos
    const video = getActiveVideo();
    if (video) {
      attachVideoListeners(video);
    }

    // Observar cambios en el título de YouTube Music (solo el nodo específico del título, no toda la barra)
    const titleEl = document.querySelector('ytmusic-player-bar .title');
    if (titleEl && !titleEl.dataset.auramusicCinemaObserved) {
      titleEl.dataset.auramusicCinemaObserved = 'true';
      let lastObservedTitle = '';
      const observer = new MutationObserver(() => {
        if (!isCinemaActive) return;
        const cur = titleEl.textContent?.trim();
        if (cur && cur !== lastObservedTitle) {
          lastObservedTitle = cur;
          checkCinemaTrackChange();
        }
      });
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    // Poblar de inmediato la primera canción seleccionada
    const trackInfo = getCurrentTrackInfo();
    if (trackInfo && trackInfo.title) {
      updateCinemaTrack(trackInfo.title, trackInfo.artist, trackInfo.coverUrl, trackInfo.videoId);
    } else {
      checkCinemaTrackChange();
    }
    try {
      if (window.AuraMusic?.Ambient?.updateAmbientGlowColor) {
        window.AuraMusic.Ambient.updateAmbientGlowColor();
      }
    } catch (_) {}

    startCinemaSyncLoop();
  }

  function closeCinemaMode() {
    const overlay = document.getElementById('auramusic-cinema-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
    }
    const settingsModal = document.getElementById('cinema-settings-modal');
    if (settingsModal) {
      settingsModal.classList.remove('active');
      settingsModal.style.display = 'none';
    }
    isCinemaActive = false;
    document.body.classList.remove('auramusic-cinema-active');

    const barBtn = document.getElementById('auramusic-bar-lyrics-btn');
    if (barBtn) barBtn.classList.remove('active');

    if (typeof destroyJesuluto3D === 'function') {
      destroyJesuluto3D();
    }
  }

  let syncLoopRunning = false;
  function startCinemaSyncLoop() {
    if (syncLoopRunning) return;
    syncLoopRunning = true;
    lastCinemaActiveIdx = -1;
    let lastSyncTrackPollTime = 0;
    let lastDurationPollTime = 0;
    let cachedDuration = 0;
    let lastCoverCheckTime = 0;
    let lastLyricsOffsetCheckTime = 0;
    let cachedEffectiveOffset = 0;
    let lastWhatsAppCheckTime = 0;
    let lastRenderedDisplayTime = -1;
    let cachedVideo = null;
    let cachedFill = null;
    let cachedCurSpan = null;
    let cachedTotSpan = null;
    let cachedPlayBtn = null;
    let cachedArtImg = null;
    let cachedActiveLineEl = null;
    let cachedWordEls = [];
    let lastSyncFrameTime = 0;
    let lastSyncIsPlaying = true;
    let lastSingingWordIdx = -1;
    let lastRenderedDuration = -1;

    function sync(timestamp) {
      if (!isCinemaActive) {
        syncLoopRunning = false;
        cachedVideo = null;
        cachedFill = null;
        cachedCurSpan = null;
        cachedTotSpan = null;
        cachedPlayBtn = null;
        cachedArtImg = null;
        cachedActiveLineEl = null;
        cachedWordEls = [];
        return;
      }

      // Capping adaptativo: 42 FPS (24ms) en reproducción para máximo ahorro de CPU, 4 FPS (250ms) en pausa
      const nowTs = timestamp || performance.now();
      const minFrameInterval = lastSyncIsPlaying ? 24 : 250;
      if (nowTs - lastSyncFrameTime < minFrameInterval) {
        requestAnimationFrame(sync);
        return;
      }
      lastSyncFrameTime = nowTs;

      try {
        const now = Date.now();

        // 1. Verificación periódica ligera de cambio de canción a 200ms
        if (now - lastSyncTrackPollTime > 200) {
          lastSyncTrackPollTime = now;
          checkCinemaTrackChange();
        }

        if (now - lastPreloadCheckTime > 2000) {
          lastPreloadCheckTime = now;
          preloadNextTrackLyricsIfNearEnd();
        }

        // Cachear referencias del DOM para evitar querySelector en cada frame (60-144 FPS)
        if (!cachedFill || !cachedFill.isConnected) cachedFill = document.getElementById('cinema-progress-fill');
        if (!cachedCurSpan || !cachedCurSpan.isConnected) cachedCurSpan = document.getElementById('cinema-current-time');
        if (!cachedTotSpan || !cachedTotSpan.isConnected) cachedTotSpan = document.getElementById('cinema-total-time');
        if (!cachedPlayBtn || !cachedPlayBtn.isConnected) cachedPlayBtn = document.getElementById('cinema-play-btn');
        if (!cachedArtImg || !cachedArtImg.isConnected) cachedArtImg = document.getElementById('cinema-art-img');
        if (!cachedVideo || !cachedVideo.isConnected) {
          cachedVideo = getActiveVideo();
          if (cachedVideo) attachVideoListeners(cachedVideo);
        }

        const bridge = getBridgePlaybackData();
        let currentTime = 0;
        let isPlaying = false;

        // 2. Duración precisa (recalcular solo cada 500ms para ahorrar CPU)
        if (now - lastDurationPollTime > 500 || cachedDuration <= 0) {
          lastDurationPollTime = now;
          const barTimes = getNativeBarTimes();
          if (barTimes && barTimes.durSec > 0) {
            cachedDuration = barTimes.durSec;
          } else if (cachedVideo && !isNaN(cachedVideo.duration) && isFinite(cachedVideo.duration) && cachedVideo.duration > 0) {
            cachedDuration = cachedVideo.duration;
          } else if (bridge && bridge.duration > 0) {
            cachedDuration = bridge.duration;
          } else {
            cachedDuration = getYtMusicTrackDuration() || 0;
          }
        }
        const duration = cachedDuration;

        // 3. TIEMPO ACTUAL EN VIVO: Sub-segundo fluido en memoria
        const vidTime = (cachedVideo && !isNaN(cachedVideo.currentTime) && isFinite(cachedVideo.currentTime) && cachedVideo.currentTime >= 0) ? cachedVideo.currentTime : -1;
        if (vidTime >= 0) {
          currentTime = vidTime;
          isPlaying = isTrackPlaying(cachedVideo);
        } else if (bridge && bridge.isFresh && bridge.currentTime >= 0) {
          currentTime = bridge.currentTime;
          isPlaying = (bridge.playerState === 1);
        }
        lastSyncIsPlaying = isPlaying;

        // BLINDAJE ANTI-RESIDUAL: Si la pista cambió hace menos de 2500ms y el reproductor todavía reporta
        // la posición final de la canción previa (> 2.0s), forzar 0 absoluto para que el contador jamás salga en 2:12
        const isRecentTrackChange = (now - cinemaTrackChangeTime < 2500);
        if (isRecentTrackChange && !isUserDraggingProgress && cinemaSeekTargetTime < 0) {
          if (currentTime > 2.0) {
            currentTime = 0;
            lastRenderedPlaybackTime = 0;
          }
        }

        const isSeekingLocked = (now < cinemaSeekLockUntil && cinemaSeekTargetTime >= 0);

        let displayTime = currentTime;
        if (isUserDraggingProgress) {
          // El usuario está arrastrando interactivamente la barra
        } else if (isSeekingLocked) {
          if (Math.abs(currentTime - cinemaSeekTargetTime) < 1.0 || now >= cinemaSeekLockUntil) {
            cinemaSeekLockUntil = 0;
            cinemaSeekTargetTime = -1;
            displayTime = currentTime;
            lastRenderedPlaybackTime = currentTime;
            if (cachedFill) cachedFill.classList.remove('is-seeking');
          } else {
            displayTime = cinemaSeekTargetTime;
          }
        } else {
          lastRenderedPlaybackTime = currentTime;
          displayTime = currentTime;
          if (cachedFill && cachedFill.classList.contains('is-seeking')) cachedFill.classList.remove('is-seeking');
        }

        // 4. Actualizar barra de progreso visual solo si el tiempo cambió perceptiblemente
        if (!isUserDraggingProgress) {
          if (Math.abs(displayTime - lastRenderedDisplayTime) > 0.05) {
            lastRenderedDisplayTime = displayTime;
            if (cachedFill) {
              if (duration > 0) {
                const pct = Math.max(0, Math.min(100, (displayTime / duration) * 100));
                cachedFill.style.width = `${pct}%`;
              } else {
                cachedFill.style.width = '0%';
              }
            }
            if (cachedCurSpan) {
              const formattedCur = formatTime(displayTime);
              if (cachedCurSpan.textContent !== formattedCur) cachedCurSpan.textContent = formattedCur;
            }
          }
        }

        if (cachedTotSpan && duration !== lastRenderedDuration) {
          lastRenderedDuration = duration;
          cachedTotSpan.textContent = duration > 0 ? formatTime(duration) : '0:00';
        }

        // 5. Botón de reproducción / pausa basado en estado real
        if (cachedPlayBtn) {
          const expectedIcon = isPlaying ? '⏸' : '▶';
          if (cachedPlayBtn.textContent !== expectedIcon) cachedPlayBtn.textContent = expectedIcon;
        }

        // 6. Verificación de portada throttled a 1 vez por segundo
        if (now - lastCoverCheckTime > 1000) {
          lastCoverCheckTime = now;
          if (cachedArtImg) {
            const freshCover = getHighResCoverUrl();
            if (freshCover && cachedArtImg.dataset.loadedSrc !== freshCover) {
              cachedArtImg.dataset.loadedSrc = freshCover;
              cachedArtImg.src = freshCover;
            }
          }
        }

        if (state.theme === 'jesuluto' && typeof updateJesulutoAnimation === 'function') {
          updateJesulutoAnimation(displayTime, isPlaying);
        }

        // 7. Offset de sincronización throttled a cada 500ms
        if (now - lastLyricsOffsetCheckTime > 500) {
          lastLyricsOffsetCheckTime = now;
          cachedEffectiveOffset = getEffectiveLyricsOffset();
        }
        const effectiveTime = displayTime - cachedEffectiveOffset;

        // 8. Sincronización de letras
        if (currentLyrics.length > 0) {
          let activeIdx = -1;
          for (let i = 0; i < currentLyrics.length; i++) {
            if (effectiveTime >= currentLyrics[i].time) {
              activeIdx = i;
            } else {
              break;
            }
          }

          // Tema WhatsApp: Throttled a 150ms para no saturar queries
          if (state.theme === 'whatsapp' && now - lastWhatsAppCheckTime > 150) {
            lastWhatsAppCheckTime = now;
            const allLines = document.querySelectorAll('#cinema-lyrics-wrapper .cinema-lyric-line');
            const typingBubble = document.getElementById('whatsapp-typing-bubble');
            const topStatus = document.querySelector('.whatsapp-top-status');
            const waPlayBtn = document.getElementById('cinema-wa-play-btn');
            const waTimePill = document.getElementById('cinema-wa-time');

            if (waPlayBtn) {
              const expectedWaIcon = isPlaying ? '⏸' : '▶';
              if (waPlayBtn.textContent !== expectedWaIcon) waPlayBtn.textContent = expectedWaIcon;
            }
            if (waTimePill) {
              waTimePill.textContent = `${formatTime(displayTime)} / ${duration > 0 ? formatTime(duration) : '0:00'}`;
            }

            if (activeIdx === -1) {
              allLines.forEach(l => l.classList.remove('wa-sent'));
              const container = document.getElementById('cinema-right-scroll');
              if (container && container.scrollTop > 10) {
                container.scrollTo({ top: 0, behavior: 'smooth' });
              }
            } else {
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
            }

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

          if (activeIdx === -1) {
            if (lastCinemaActiveIdx !== -1) {
              lastCinemaActiveIdx = -1;
              lastSingingWordIdx = -1;
              cachedActiveLineEl = null;
              cachedWordEls = [];
              const allLines = document.querySelectorAll('.cinema-lyric-line');
              allLines.forEach(l => {
                l.classList.remove('active-line', 'sung-line');
                l.querySelectorAll('.k-word').forEach(w => w.className = 'k-word');
              });
            }
            const container = document.getElementById('cinema-right-scroll');
            if (container && container.scrollTop > 10) {
              container.scrollTo({ top: 0, behavior: 'smooth' });
            }
          } else if (activeIdx !== lastCinemaActiveIdx) {
            const prevIdx = lastCinemaActiveIdx;
            lastCinemaActiveIdx = activeIdx;
            lastSingingWordIdx = -1;

            // Actualización selectiva ultrarrápida: solo tocar la línea previa y la nueva
            if (prevIdx >= 0) {
              const prevLine = document.querySelector(`.cinema-lyric-line[data-index="${prevIdx}"]`);
              if (prevLine) {
                prevLine.classList.remove('active-line');
                prevLine.classList.add('sung-line');
                prevLine.querySelectorAll('.k-word').forEach(w => {
                  if (w.className !== 'k-word sung') w.className = 'k-word sung';
                });
              }
            }

            cachedActiveLineEl = document.querySelector(`.cinema-lyric-line[data-index="${activeIdx}"]`);
            if (cachedActiveLineEl) {
              cachedActiveLineEl.classList.add('active-line');
              cachedActiveLineEl.classList.remove('sung-line');
              cachedWordEls = Array.from(cachedActiveLineEl.querySelectorAll('.k-word'));

              const container = document.getElementById('cinema-right-scroll');
              if (container) {
                const cRect = container.getBoundingClientRect();
                const lRect = cachedActiveLineEl.getBoundingClientRect();
                const targetScroll = container.scrollTop + (lRect.top - cRect.top) - (cRect.height * 0.38);
                container.scrollTo({ top: targetScroll, behavior: 'smooth' });
              }
            } else {
              cachedWordEls = [];
            }
          }

          // Karaoke palabra por palabra: actualización reactiva SOLO cuando la palabra cantada cambia
          if (activeIdx >= 0 && activeIdx < currentLyrics.length && cachedActiveLineEl) {
            const lineObj = currentLyrics[activeIdx];
            let words = lineObj?.words;
            if (!Array.isArray(words) || words.length === 0) {
              const nextLineTime = (activeIdx < currentLyrics.length - 1)
                ? currentLyrics[activeIdx + 1].time
                : (lineObj.time + 3.5);
              words = smartDistributeWords(lineObj, nextLineTime);
              lineObj.words = words;
            }

            if (Array.isArray(words) && words.length > 0) {
              let singingIdx = -1;
              const nextLineTime = (activeIdx < currentLyrics.length - 1)
                ? currentLyrics[activeIdx + 1].time
                : (words[words.length - 1].time + 2.5);

              for (let w = 0; w < words.length; w++) {
                const wTime = typeof words[w].time === 'number' ? words[w].time : parseFloat(words[w].time);
                const nextWTime = (w < words.length - 1)
                  ? (typeof words[w + 1].time === 'number' ? words[w + 1].time : parseFloat(words[w + 1].time))
                  : nextLineTime;

                if (effectiveTime >= wTime && effectiveTime < nextWTime) {
                  singingIdx = w;
                  break;
                } else if (w === words.length - 1 && effectiveTime >= wTime) {
                  singingIdx = w;
                }
              }

              if (singingIdx !== lastSingingWordIdx) {
                lastSingingWordIdx = singingIdx;
                cachedWordEls.forEach((wEl, wIdx) => {
                  const wObj = words[wIdx];
                  const wTime = wObj ? (typeof wObj.time === 'number' ? wObj.time : parseFloat(wObj.time)) : parseFloat(wEl.dataset.start);
                  const hasBeenSung = !isNaN(wTime) && effectiveTime >= wTime;

                  if (wIdx === singingIdx) {
                    if (wEl.className !== 'k-word active') wEl.className = 'k-word active';
                  } else if (hasBeenSung) {
                    if (wEl.className !== 'k-word sung') wEl.className = 'k-word sung';
                  } else {
                    if (wEl.className !== 'k-word') wEl.className = 'k-word';
                  }
                });
              }
            } else if (cachedWordEls.length > 0) {
              cachedWordEls.forEach(w => {
                const start = parseFloat(w.dataset.start);
                const end = parseFloat(w.dataset.end);
                if (!isNaN(start) && !isNaN(end)) {
                  if (effectiveTime >= end) {
                    if (w.className !== 'k-word sung') w.className = 'k-word sung';
                  } else if (effectiveTime >= start && effectiveTime < end) {
                    if (w.className !== 'k-word active') w.className = 'k-word active';
                  } else {
                    if (w.className !== 'k-word') w.className = 'k-word';
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
          const container = document.getElementById('cinema-right-scroll');
          if (container && container.scrollTop > 10) {
            container.scrollTop = 0;
          }
          lastCinemaActiveIdx = -1;
        }
      } catch (err) {
        console.warn('AuraMusic: Error en ciclo de sincronización cinema:', err);
      } finally {
        if (isCinemaActive) {
          requestAnimationFrame(sync);
        } else {
          syncLoopRunning = false;
        }
      }
    }

    requestAnimationFrame(sync);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
    const totalSecs = Math.floor(seconds);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const sStr = s < 10 ? '0' + s : s;
    if (h > 0) {
      const mStr = m < 10 ? '0' + m : m;
      return `${h}:${mStr}:${sStr}`;
    }
    return `${m}:${sStr}`;
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

    // Inyectar también el icono nativo de Micrófono SVG directo en la barra del reproductor
    const rightControls = document.querySelector('ytmusic-player-bar .right-controls-buttons');
    if (rightControls && !document.getElementById('auramusic-bar-lyrics-btn')) {
      const barBtn = document.createElement('button');
      barBtn.id = 'auramusic-bar-lyrics-btn';
      barBtn.className = 'auramusic-bar-lyrics-btn' + (isCinemaActive ? ' active' : '');
      barBtn.type = 'button';
      barBtn.title = 'Letras Sincronizadas en Pantalla Completa (L)';
      barBtn.setAttribute('aria-label', 'Letras Sincronizadas');
      barBtn.innerHTML = `
        <svg class="auramusic-mic-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
          <line x1="8" x2="16" y1="22" y2="22"/>
        </svg>
      `;
      barBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCinemaMode();
      });
      rightControls.insertBefore(barBtn, rightControls.firstChild);
      console.log('🎤 AuraMusic: Botón moderno de micrófono SVG inyectado en barra inferior.');
    }
  }

  function toggleCinemaMode() {
    if (isCinemaActive) {
      closeCinemaMode();
    } else {
      openCinemaMode();
    }
  }

  window.AuraMusic.Lyrics = {
    openCinemaMode,
    closeCinemaMode,
    toggleCinemaMode,
    fetchSyncedLyrics,
    checkAndInjectLyricsButton,
    checkCinemaTrackChange,
    isCinemaActive: () => isCinemaActive
  };
})();

