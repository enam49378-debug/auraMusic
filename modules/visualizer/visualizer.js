/**
 * AuraMusic - Módulo Visualizador de Audio (Barras / Onda en tiempo real)
 */
window.AuraMusic = window.AuraMusic || {};

(function() {
  'use strict';

  function getState() {
    return window.AuraMusic?.state || window.state || {};
  }

  let animFrameId = null;

  // --- VISUALIZADOR DE AUDIO INTEGRADO ---
  function initVisualizer() {
    if (document.getElementById('auramusic-visualizer-container')) return;

    const playerBar = document.querySelector('ytmusic-player-bar');
    if (!playerBar) return;

    const container = document.createElement('div');
    container.id = 'auramusic-visualizer-container';

    const canvas = document.createElement('canvas');
    canvas.id = 'auramusic-visualizer-canvas';
    container.appendChild(canvas);

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
    if (!canvas) canvas = document.getElementById('auramusic-visualizer-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const state = getState();
    if (state.visualizer === 'off') {
      stopVisualizerLoop(ctx, canvas);
      return;
    }

    if (animFrameId) return; // Evitar bucles concurrentes

    const dataArray = new Uint8Array(64);
    let lastRenderTime = 0;
    let wasPaused = false;
    let lastColorCheckTime = 0;
    let cachedActiveColor = '#00e5ff';

    function render(now) {
      const curState = getState();
      if (curState.visualizer === 'off' || document.hidden) {
        stopVisualizerLoop(ctx, canvas);
        return;
      }

      animFrameId = requestAnimationFrame(render);

      // Si el modo Cinema está abierto, el visualizador de la barra inferior queda 100% tapado: no gastar CPU/GPU
      const cinemaOverlay = document.getElementById('auramusic-cinema-overlay');
      if (cinemaOverlay && cinemaOverlay.classList.contains('active')) return;

      // Limitar a 30 FPS para máximo ahorro de CPU/GPU
      const curTime = now || performance.now();
      if (curTime - lastRenderTime < 33) return;
      lastRenderTime = curTime;

      const video = document.querySelector('video');
      const isPlaying = video && !video.paused;

      // Si la música está pausada, limpiar el canvas una sola vez y no seguir calculando
      if (!isPlaying) {
        if (!wasPaused) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          wasPaused = true;
        }
        return;
      }
      wasPaused = false;

      const analyser = window.AuraMusic?.Audio?.getAnalyser?.();
      const isConnected = window.AuraMusic?.Audio?.isConnected?.();

      if (analyser && isConnected) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        const time = curTime * 0.003;
        for (let i = 0; i < 32; i++) {
          dataArray[i] = Math.floor(60 + Math.sin(time + i * 0.4) * 45);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const barCount = 36;
      const barWidth = (width / barCount) * 0.65;
      const gap = (width / barCount) * 0.35;

      // Cachear color primario cada 1 segundo en vez de llamar a getComputedStyle 30 veces por segundo
      if (curTime - lastColorCheckTime > 1000) {
        lastColorCheckTime = curTime;
        cachedActiveColor = getComputedStyle(document.documentElement).getPropertyValue('--auramusic-primary').trim() || curState.primaryColor || '#00e5ff';
      }

      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, cachedActiveColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
      ctx.fillStyle = grad;

      if (curState.visualizer === 'bars') {
        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i] || 0;
          const barHeight = (val / 255) * height * 0.9;
          const x = i * (barWidth + gap) + gap / 2;
          const y = height - barHeight;
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      } else if (curState.visualizer === 'wave') {
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

  function stopVisualizerLoop(ctx, canvas) {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function applyVisualizerMode(mode) {
    const state = getState();
    state.visualizer = mode;
    if (mode === 'off') {
      const canvas = document.getElementById('auramusic-visualizer-canvas');
      const ctx = canvas ? canvas.getContext('2d') : null;
      stopVisualizerLoop(ctx, canvas);
    } else {
      initVisualizer();
      startVisualizerLoop();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    } else {
      const state = getState();
      if (state.visualizer !== 'off') {
        startVisualizerLoop();
      }
    }
  });

  window.AuraMusic.Visualizer = {
    initVisualizer,
    applyVisualizerMode,
    startVisualizerLoop,
    stopVisualizerLoop
  };
})();
