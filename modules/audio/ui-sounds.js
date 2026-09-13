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

  // --- ESCUCHADOR GLOBAL INTELIGENTE DE EVENTOS DOM ---
  function initGlobalListeners() {
    // 1. Clics en la interfaz
    document.addEventListener('click', (e) => {
      if (!isAuraThemeActive()) return;

      const target = e.target;
      if (!target) return;

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

      // Letras sincronizadas
      if (target.closest('.cinema-line, .cinema-line-word, .k-word, .cinema-line-time')) {
        playLyricJump();
        return;
      }

      // Pestañas del Hub
      if (target.closest('.auramusic-tab, .auramusic-launcher-btn, .auramusic-icon-btn, .auramusic-hub-close')) {
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

      // Cualquier botón general o enlace interactivo
      if (target.closest('button, tp-yt-paper-icon-button, yt-icon-button, [role="button"]')) {
        playClick();
      }
    }, true);

    // 2. Arrastre y saltos en barra de tiempo
    document.addEventListener('input', (e) => {
      if (!isAuraThemeActive()) return;
      if (e.target.matches('#cinema-progress-input, #progress-bar, input[type="range"]')) {
        playSeek();
      }
    }, true);
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
    playSeek,
    playLyricJump,
    playPlayPause,
    playTrackNav,
    playToggle,
    playThemeSelect,
    isAuraThemeActive
  };
})();
