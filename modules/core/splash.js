/**
 * AuraMusic - Intro Cinemática de Inicio (YouTube on TV Startup)
 * Ejecuta en document_start la animación y sonido oficial de inicio estilo Google / YouTube on TV.
 * Cubre 100% la pantalla para evitar FOUC y ofrecer una experiencia premium idéntica a YouTube en Smart TVs.
 */
(function () {
  'use strict';

  function getSettings() {
    try {
      const saved = localStorage.getItem('auramusic_settings');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return { splashScreen: true, splashSound: true };
  }

  let activeVideo = null;
  let isDismissed = false;
  let isReadyToDismiss = false;
  const startTime = Date.now();
  const MIN_PLAY_MS = 3600; // Garantiza que suene el icónico acorde de YouTube
  const MAX_SAFETY_TIMEOUT_MS = 7400; // Duración total del video

  function getStartupVideoUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL('assets/startup.mp4');
      }
    } catch (_) {}
    return 'assets/startup.mp4';
  }

  function createSplash(isManualPreview = false) {
    const settings = getSettings();
    if (!isManualPreview && settings.splashScreen === false) {
      return;
    }

    const existing = document.getElementById('auramusic-splash-screen');
    if (existing) existing.remove();

    isDismissed = false;
    isReadyToDismiss = false;

    const soundEnabled = isManualPreview ? true : (settings.splashSound !== false);
    const videoUrl = getStartupVideoUrl();

    const splash = document.createElement('div');
    splash.id = 'auramusic-splash-screen';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-label', 'AuraMusic Intro');

    splash.innerHTML = `
      <video id="auramusic-startup-video" playsinline preload="auto">
        <source src="${videoUrl}" type="video/mp4">
      </video>

      <div class="splash-tv-overlay">
        <div class="splash-top-bar">
          <span class="splash-brand-badge">AuraMusic • YouTube on TV</span>
          <button type="button" class="splash-sound-btn" id="splash-sound-toggle">
            ${soundEnabled ? '🔊 Sonido Activado' : '🔇 Silenciado'}
          </button>
        </div>

        <div class="splash-bottom-bar">
          <div class="splash-tv-hint">
            Haz clic o presiona <kbd>Esc</kbd> para omitir
          </div>
        </div>
      </div>
    `;

    const video = splash.querySelector('#auramusic-startup-video');
    const soundBtn = splash.querySelector('#splash-sound-toggle');
    activeVideo = video;

    // Configurar audio
    video.volume = 0.85;
    video.muted = !soundEnabled;

    // Intentar reproducir con sonido
    const tryPlay = () => {
      const p = video.play();
      if (p !== undefined) {
        p.catch((err) => {
          // Si Chrome bloquea el audio automático previo a la interacción del usuario:
          console.warn('AuraMusic: Autoplay con audio restringido por Chrome. Iniciando silenciado...', err);
          video.muted = true;
          if (soundBtn) soundBtn.textContent = '🔇 Silenciado (Clic para activar)';
          video.play().catch(() => {});
        });
      }
    };

    // Botón de sonido
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        if (!video.muted) {
          video.volume = 0.85;
          soundBtn.textContent = '🔊 Sonido Activado';
        } else {
          soundBtn.textContent = '🔇 Silenciado';
        }
      });
    }

    // Saltar con clic o tecla Escape / Espacio
    splash.addEventListener('click', () => dismissSplash(true));
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === ' ') {
        window.removeEventListener('keydown', onKey);
        dismissSplash(true);
      }
    };
    window.addEventListener('keydown', onKey);

    // Al terminar el video
    video.addEventListener('ended', () => {
      dismissSplash(false);
    });

    video.addEventListener('error', () => {
      console.warn('AuraMusic: Error cargando video de inicio, continuando.');
      dismissSplash(true);
    });

    // Inyectar en el documento
    const container = document.body || document.documentElement;
    if (container) {
      container.appendChild(splash);
      tryPlay();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        (document.body || document.documentElement).appendChild(splash);
        tryPlay();
      });
    }

    // Temporizador máximo de seguridad
    setTimeout(() => {
      dismissSplash(false);
    }, MAX_SAFETY_TIMEOUT_MS);
  }

  function dismissSplash(immediate = false) {
    if (isDismissed) return;
    isDismissed = true;

    const splash = document.getElementById('auramusic-splash-screen');
    if (!splash) return;

    // Desvanecer el volumen suavemente para un cierre profesional
    try {
      if (activeVideo && !activeVideo.paused && !activeVideo.muted) {
        let vol = activeVideo.volume;
        const fadeTimer = setInterval(() => {
          vol = Math.max(0, vol - 0.18);
          activeVideo.volume = vol;
          if (vol <= 0) {
            clearInterval(fadeTimer);
            try { activeVideo.pause(); } catch (_) {}
          }
        }, 30);
      }
    } catch (_) {}

    splash.classList.add('splash-dismissed');
    setTimeout(() => {
      try { splash.remove(); } catch (_) {}
    }, 620);
  }

  function onPageReady() {
    isReadyToDismiss = true;
    const elapsed = Date.now() - startTime;
    if (elapsed >= MIN_PLAY_MS) {
      dismissSplash(false);
    } else {
      setTimeout(() => {
        dismissSplash(false);
      }, MIN_PLAY_MS - elapsed);
    }
  }

  // Iniciar automáticamente en document_start
  createSplash(false);

  // Asegurar que quede montado si el body se construye después
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const splash = document.getElementById('auramusic-splash-screen');
      if (splash && document.body && splash.parentElement !== document.body) {
        document.body.appendChild(splash);
      }
    });
  }

  // Exponer API global
  window.AuraMusic = window.AuraMusic || {};
  window.AuraMusic.Splash = {
    dismiss: onPageReady,
    preview: () => createSplash(true)
  };
})();
