// AuraMusic Offscreen Audio Player
// Entorno con permisos de audio completos otorgados por Chrome (sin bloqueos de autoplay ni CSP)

let shadowIframe = null;
let shadowFadeInterval = null;
let currentVideoId = '';

function setupShadowPlayer(videoId) {
  if (shadowIframe && currentVideoId === videoId) return;
  if (shadowIframe) {
    shadowIframe.remove();
    shadowIframe = null;
  }
  currentVideoId = videoId;

  const container = document.getElementById('player-container');
  container.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&playsinline=1`;
  iframe.allow = 'autoplay *; encrypted-media *;';
  iframe.style.width = '300px';
  iframe.style.height = '300px';
  container.appendChild(iframe);
  shadowIframe = iframe;
}

function sendCommand(func, args = []) {
  if (shadowIframe && shadowIframe.contentWindow) {
    try {
      shadowIframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: func,
        args: args
      }), '*');
    } catch (e) {}
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;

  if (msg.action === 'PREPARE_TRACK') {
    if (msg.videoId) {
      setupShadowPlayer(msg.videoId);
      setTimeout(() => {
        sendCommand('pauseVideo');
        sendCommand('seekTo', [0, true]);
        sendCommand('setVolume', [0]);
      }, 1500);
    }
    sendResponse({ status: 'prepared' });
  }

  if (msg.action === 'START_CROSSFADE') {
    if (msg.videoId && (!shadowIframe || currentVideoId !== msg.videoId)) {
      setupShadowPlayer(msg.videoId);
    }

    // Bucle de reintento de arranque (10 intentos cada 150ms) para garantizar que el iframe reciba la orden en cuanto cargue
    let playAttempts = 0;
    const playTimer = setInterval(() => {
      sendCommand('unMute');
      sendCommand('seekTo', [0, true]);
      sendCommand('playVideo');
      playAttempts++;
      if (playAttempts >= 12) clearInterval(playTimer);
    }, 150);

    const durationMs = (msg.duration || 5) * 1000;
    const startTime = performance.now();

    if (shadowFadeInterval) clearInterval(shadowFadeInterval);
    shadowFadeInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Curva Equal-Power: sin(p * PI/2)
      const gainB = Math.sin(progress * 0.5 * Math.PI);
      const vol = Math.round(gainB * 100);

      sendCommand('unMute');
      sendCommand('setVolume', [vol]);

      if (progress >= 1) {
        clearInterval(shadowFadeInterval);
        shadowFadeInterval = null;
        clearInterval(playTimer);
        sendCommand('setVolume', [100]);
      }
    }, 35);

    sendResponse({ status: 'crossfade_started' });
  }

  if (msg.action === 'STOP_CROSSFADE') {
    if (shadowFadeInterval) {
      clearInterval(shadowFadeInterval);
      shadowFadeInterval = null;
    }
    sendCommand('stopVideo');
    if (shadowIframe) {
      shadowIframe.remove();
      shadowIframe = null;
    }
    currentVideoId = '';
    sendResponse({ status: 'stopped' });
  }

  if (msg.action === 'PAUSE') {
    sendCommand('pauseVideo');
    sendResponse({ status: 'paused' });
  }

  if (msg.action === 'PLAY') {
    sendCommand('playVideo');
    sendResponse({ status: 'playing' });
  }
});
