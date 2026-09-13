/**
 * AuraMusic - Motor de Efectos de Sonido de UI (Web Audio API)
 * Genera sonidos táctiles, limpios y futuristas en tiempo real mediante síntesis WebAudio.
 * REGLA: Activo ÚNICA Y EXCLUSIVAMENTE cuando el tema actual es 'auramusic'.
 */
window.AuraMusic = window.AuraMusic || {};

(function () {
  'use strict';

  let uiAudioCtx = null;
  let masterGain = null;
  let lastSoundTime = 0;
  let lastHoverSoundTime = 0;
  let lastVolSoundTime = 0;
  let lastTrackStartTime = 0;

  function getState() {
    return window.AuraMusic?.state || window.state || {};
  }

  function isAuraThemeActive() {
    const s = getState();
    return (s.theme === 'auramusic' || document.body.classList.contains('auramusic-theme-auramusic'));
  }

  function getAudioContext() {
    if (!uiAudioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        uiAudioCtx = new AudioContextClass();
        masterGain = uiAudioCtx.createGain();
        masterGain.gain.setValueAtTime(0.35, uiAudioCtx.currentTime); // Volumen suave y agradable
        masterGain.connect(uiAudioCtx.destination);
      }
    }
    if (uiAudioCtx && uiAudioCtx.state === 'suspended') {
      uiAudioCtx.resume().catch(() => {});
    }
    return uiAudioCtx;
  }

  // --- GENERADORES SINTÉTICOS DE SONIDO ---

  /**
   * Clic táctil micro-definido (estilo háptico Apple / Nintendo Switch)
   */
  function playClick() {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.022);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  /**
   * Micro-blip sutil al pasar el cursor sobre botones (Hover)
   */
  function playHover() {
    if (!isAuraThemeActive()) return;
    const nowMs = Date.now();
    if (nowMs - lastHoverSoundTime < 140) return; // Anti-spam suave
    lastHoverSoundTime = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1120, now + 0.016);

    gain.gain.setValueAtTime(0.06, now); // Muy sutil
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.018);
  }

  /**
   * Salto o arrastre en la barra de tiempo (Gota de cristal resonante)
   */
  function playSeek() {
    if (!isAuraThemeActive()) return;
    const nowMs = Date.now();
    if (nowMs - lastSoundTime < 65) return; // Anti-saturación durante arrastre rápido
    lastSoundTime = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1320, now);
    osc1.frequency.exponentialRampToValueAtTime(1080, now + 0.05);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2640, now);
    osc2.frequency.exponentialRampToValueAtTime(2160, now + 0.04);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.065);
    osc2.stop(now + 0.065);
  }

  /**
   * Campana celestial armónica al pulsar una letra sincronizada
   */
  function playLyricJump() {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [1046.5, 1567.98]; // C6 y G6 (Quinta perfecta cristalina)

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      const amp = (idx === 0) ? 0.22 : 0.12;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.15);
    });
  }

  /**
   * Reproducir o Pausar (Acorde ascendente en Play, descendente en Pause)
   */
  function playPlayPause(isPlay) {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const fStart = isPlay ? 587.33 : 880; // D5 -> A5 o A5 -> D5
    const fEnd = isPlay ? 880 : 587.33;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(fStart, now);
    osc.frequency.exponentialRampToValueAtTime(fEnd, now + 0.09);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Siguiente o Anterior canción (Deslizamiento láser)
   */
  function playTrackNav(isNext = true) {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    if (isNext) {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.08); // A4 -> B5
    } else {
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.08); // B5 -> A4
    }

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Interruptor o Toggle de opción (Activado / Desactivado)
   */
  function playToggle(isOn) {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isOn ? 659.25 : 523.25, now); // E5 o C5
    osc.frequency.setValueAtTime(isOn ? 880 : 440, now + 0.035);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Sonido al mover el control deslizante de volumen
   */
  function playVolumeTick(vol = 50) {
    if (!isAuraThemeActive()) return;
    const nowMs = Date.now();
    if (nowMs - lastVolSoundTime < 45) return;
    lastVolSoundTime = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freq = 600 + Math.min(800, vol * 8);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.022);
  }

  /**
   * Campanadas al dar Me Gusta (Like)
   */
  function playLike() {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [659.25, 880, 1318.5, 1760]; // E5, A5, E6, A6 brillante festivo

    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.028);

      gain.gain.setValueAtTime(0.15, now + idx * 0.028);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.028 + 0.16);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + idx * 0.028);
      osc.stop(now + idx * 0.028 + 0.18);
    });
  }

  /**
   * Apertura o cierre espacial del Hub (Whoosh)
   */
  function playHubWoosh(isOpen = true) {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    if (isOpen) {
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.14);
    } else {
      osc.frequency.setValueAtTime(780, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.12);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, now);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isOpen ? 0.15 : 0.13));

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Foco en buscador (Efecto escáner sci-fi)
   */
  function playSearchFocus() {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(1450, now + 0.04);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.055);
  }

  /**
   * Resonancia celestial al arrancar o cambiar de canción
   */
  function playTrackStart() {
    if (!isAuraThemeActive()) return;
    const nowMs = Date.now();
    if (nowMs - lastTrackStartTime < 2000) return;
    lastTrackStartTime = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [392.0, 587.33, 880.0, 1174.66]; // G4, D5, A5, D6 aura armónico

    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.04);

      gain.gain.setValueAtTime(0.12, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.28);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.3);
    });
  }

  /**
   * Activación del tema AuraMusic (Acorde holográfico de firma)
   */
  function playThemeSelect() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // Acorde C Mayor puro luminoso (C5, E5, G5, C6)

    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.025);

      gain.gain.setValueAtTime(0.18, now + idx * 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.025 + 0.22);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + idx * 0.025);
      osc.stop(now + idx * 0.025 + 0.25);
    });
  }

  /**
   * Modo Aleatorio (Shuffle) o Repetir (Repeat)
   */
  function playShuffleRepeat(isActive = true) {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isActive ? 740 : 880, now);
    osc.frequency.exponentialRampToValueAtTime(isActive ? 1175 : 587, now + 0.04);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Silenciar o reactivar sonido (Mute / Unmute)
   */
  function playMute(isMuted = true) {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    if (isMuted) {
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.06);
    } else {
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.05);
    }

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.075);
  }

  /**
   * Toque en canción de lista de reproducción o cola
   */
  function playQueueSelect() {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.025);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  /**
   * Activación / Cierre de Modo Letras / Modo Cine
   */
  function playCinemaModeToggle(isOpen = true) {
    if (!isAuraThemeActive()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = isOpen ? [523.25, 659.25, 987.77, 1318.5] : [1046.5, 783.99, 523.25];

    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.03);

      gain.gain.setValueAtTime(0.14, now + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.16);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + idx * 0.03);
      osc.stop(now + idx * 0.03 + 0.18);
    });
  }

  // --- ESCUCHADOR GLOBAL INTELIGENTE DE EVENTOS DOM ---
  function initGlobalListeners() {
    // 1. Clics en la interfaz
    document.addEventListener('click', (e) => {
      if (!isAuraThemeActive()) return;

      const target = e.target;
      if (!target) return;

      // Modo Letras / Cine
      if (target.closest('#cinema-lyrics-toggle, .cinema-toggle-btn, #hub-cinema-lyrics-tab, #cinema-close-btn')) {
        const overlay = document.getElementById('auramusic-cinema-overlay');
        const isClosing = overlay && overlay.classList.contains('active');
        playCinemaModeToggle(!isClosing);
        return;
      }

      // Play/Pause botones
      if (target.closest('.play-pause-button, #play-pause-button, #cinema-play-btn, .cinema-play-btn, #cinema-wa-play-btn')) {
        const video = document.querySelector('video');
        const isCurrentlyPlaying = video ? !video.paused : false;
        playPlayPause(!isCurrentlyPlaying);
        return;
      }

      // Next botones
      if (target.closest('.next-button, #next-button, #cinema-next-btn, #cinema-wa-next-btn')) {
        playTrackNav(true);
        return;
      }

      // Previous botones
      if (target.closest('.previous-button, #previous-button, #cinema-prev-btn, #cinema-wa-prev-btn')) {
        playTrackNav(false);
        return;
      }

      // Shuffle y Repeat botones
      if (target.closest('.shuffle, .repeat, #shuffle-button, #repeat-button, tp-yt-paper-icon-button.shuffle, tp-yt-paper-icon-button.repeat')) {
        const btn = target.closest('.shuffle, .repeat, #shuffle-button, #repeat-button, tp-yt-paper-icon-button.shuffle, tp-yt-paper-icon-button.repeat');
        const isSelected = btn && (btn.getAttribute('aria-pressed') === 'true' || btn.classList.contains('active'));
        playShuffleRepeat(!isSelected);
        return;
      }

      // Mute / Volumen icono
      if (target.closest('.volume-slider-icon, #volume-slider-icon, #volume-button, tp-yt-paper-icon-button#volume-slider')) {
        const video = document.querySelector('video');
        const isMuted = video ? video.muted : false;
        playMute(!isMuted);
        return;
      }

      // Botón de Me Gusta (Like)
      if (target.closest('.like, [aria-label*="Me gusta"], [aria-label*="Like"], #like-button-renderer')) {
        playLike();
        return;
      }

      // Letras sincronizadas
      if (target.closest('.cinema-lyric-line, .cinema-line, .cinema-line-word, .k-word, .cinema-line-time')) {
        playLyricJump();
        return;
      }

      // Pestañas del Hub y lanzador
      if (target.closest('.auramusic-launcher-btn, .auramusic-hub-close')) {
        const hubOverlay = document.getElementById('auramusic-hub-overlay');
        const isClosing = hubOverlay && hubOverlay.classList.contains('active');
        playHubWoosh(!isClosing);
        return;
      }

      if (target.closest('.auramusic-tab, .auramusic-icon-btn')) {
        playClick();
        return;
      }

      // Botones de temas
      if (target.closest('.theme-pill-btn, .theme-btn')) {
        const tBtn = target.closest('.theme-pill-btn, .theme-btn');
        if (tBtn.dataset.theme === 'auramusic') {
          playThemeSelect();
        } else {
          playClick();
        }
        return;
      }

      // Checkboxes o toggles
      if (target.matches('input[type="checkbox"]') || target.closest('.auramusic-toggle, .toggle-switch')) {
        const chk = target.matches('input[type="checkbox"]') ? target : target.querySelector('input[type="checkbox"]');
        playToggle(chk ? chk.checked : true);
        return;
      }

      // Canción en lista o cola
      if (target.closest('ytmusic-player-queue-item, ytmusic-responsive-list-item-renderer, .ytmusic-player-queue-item')) {
        playQueueSelect();
        return;
      }

      // Cualquier botón general o enlace interactivo
      if (target.closest('button, tp-yt-paper-icon-button, yt-icon-button, [role="button"]')) {
        playClick();
      }
    }, true);

    // 2. Hover suave en elementos interactivos
    document.addEventListener('mouseover', (e) => {
      if (!isAuraThemeActive()) return;
      const target = e.target;
      if (!target) return;

      if (target.closest('button, .theme-pill-btn, .auramusic-tab, .cinema-line, ytmusic-chip-cloud-chip-renderer, .play-pause-button')) {
        playHover();
      }
    }, { passive: true, capture: true });

    // 3. Foco en el buscador
    document.addEventListener('focusin', (e) => {
      if (!isAuraThemeActive()) return;
      if (e.target.closest('ytmusic-search-box, input#input')) {
        playSearchFocus();
      }
    }, true);

    // 4. Arrastre y saltos en barra de tiempo y volumen
    document.addEventListener('input', (e) => {
      if (!isAuraThemeActive()) return;
      if (e.target.matches('#cinema-progress-input, #progress-bar, input[type="range"]')) {
        playSeek();
      } else if (e.target.closest('#volume-slider, input#volume')) {
        playVolumeTick(Number(e.target.value) || 50);
      }
    }, true);

    // 5. Cambio de pista (Anuncio armónico)
    document.addEventListener('auramusic-track-change', () => {
      playTrackStart();
    });
  }

  // Desbloquear AudioContext en la primera interacción
  ['click', 'touchstart', 'keydown'].forEach(evt => {
    document.addEventListener(evt, () => {
      if (uiAudioCtx && uiAudioCtx.state === 'suspended') {
        uiAudioCtx.resume().catch(() => {});
      }
    }, { once: true, capture: true });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobalListeners);
  } else {
    initGlobalListeners();
  }

  window.AuraMusic.UISounds = {
    playClick,
    playHover,
    playSeek,
    playLyricJump,
    playPlayPause,
    playTrackNav,
    playToggle,
    playVolumeTick,
    playLike,
    playHubWoosh,
    playSearchFocus,
    playTrackStart,
    playThemeSelect,
    playShuffleRepeat,
    playMute,
    playQueueSelect,
    playCinemaModeToggle,
    isAuraThemeActive
  };
})();
