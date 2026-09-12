/**
 * AuraMusic - Módulo de Motor de Audio (Web Audio API)
 * Control de EQ 5-bandas, Volume Boost (100-300%) y Playback Speed.
 */
window.AuraMusic = window.AuraMusic || {};

(function() {
  'use strict';

  function getState() {
    return window.AuraMusic?.state || window.state || {};
  }

  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let gainNode = null;
  let eqFilters = {};
  let isAudioConnected = false;
  let postEQTap = null;

  function applyPlaybackSpeed(speed) {
    const video = document.querySelector('video');
    if (video) {
      video.playbackRate = parseFloat(speed) || 1.0;
    }
  }

  function applyVolumeBoost(boostVal) {
    if (gainNode && audioCtx) {
      // 100% = 1.0, 300% = 3.0
      const gain = Math.max(0, Math.min(3.0, (boostVal || 100) / 100));
      gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
    }
  }

  function applyEQ() {
    if (!isAudioConnected || !audioCtx) return;
    const state = getState();
    if (!state.eq) return;
    for (const [freq, gain] of Object.entries(state.eq)) {
      if (eqFilters[freq]) {
        eqFilters[freq].gain.setValueAtTime(gain, audioCtx.currentTime);
      }
    }
  }

  // --- MOTOR DE AUDIO WEB AUDIO API ---
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
      window.audioCtx = audioCtx;
      window.gainNode = gainNode;
      const state = getState();
      applyVolumeBoost(state.volumeBoost || 100);

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
        filter.gain.value = (state.eq && typeof state.eq[label] === 'number') ? state.eq[label] : 0;
        lastNode.connect(filter);
        lastNode = filter;
        eqFilters[label] = filter;
      });

      // Tap POST-EQ
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

  const audioCheckInterval = setInterval(() => {
    if (isAudioConnected) {
      clearInterval(audioCheckInterval);
      return;
    }
    const video = document.querySelector('video');
    if (video && !video.paused) {
      _tryConnectAudio();
    }
  }, 1200);

  window.AuraMusic.Audio = {
    initAudioEngine,
    applyPlaybackSpeed,
    applyVolumeBoost,
    applyEQ,
    _tryConnectAudio,
    getAudioCtx: () => audioCtx,
    getAnalyser: () => analyser,
    getGainNode: () => gainNode,
    getEqFilters: () => eqFilters,
    isConnected: () => isAudioConnected
  };
})();
