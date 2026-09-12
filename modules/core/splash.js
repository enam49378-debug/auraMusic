/**
 * AuraMusic - Intro Cinemática (YouTube on TV + Caída de AuraMusic)
 * Animación programada en CSS/DOM puro que recrea la intro de YouTube on TV,
 * seguida de la caída e impacto con rebote del logo de AuraMusic.
 * Se ejecuta en document_start para evitar cualquier parpadeo de interfaz.
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

  let audioInstance = null;
  let isDismissed = false;
  let isReadyToDismiss = false;
  let activeTimers = [];
  const startTime = Date.now();
  const MIN_PLAY_MS = 3400; // Tiempo para apreciar el logo y la caída

  function getSoundUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL('assets/startup.mp4');
      }
    } catch (_) {}
    return 'assets/startup.mp4';
  }

  function playSoundIfAllowed(soundEnabled) {
    if (!soundEnabled) return;
    try {
      if (!audioInstance) {
        audioInstance = new Audio(getSoundUrl());
      }
      audioInstance.volume = 0.85;
      audioInstance.currentTime = 0;
      audioInstance.play().catch(e => {
        console.warn('AuraMusic: Autoplay con audio restringido por Chrome:', e);
      });
    } catch (e) {
      console.warn('AuraMusic: Error de audio:', e);
    }
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
    activeTimers.forEach(t => clearTimeout(t));
    activeTimers = [];

    const soundEnabled = isManualPreview ? true : (settings.splashSound !== false);

    const splash = document.createElement('div');
    splash.id = 'auramusic-splash-screen';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-label', 'AuraMusic Intro');

    splash.innerHTML = `
      <!-- 1. Línea Seeker de Carga YouTube TV -->
      <div class="yt-loader-box" id="splash-yt-loader">
        <div class="yt-loader-play-triangle"></div>
        <div class="yt-loader-track">
          <div class="yt-loader-fill" id="splash-loader-fill"></div>
        </div>
      </div>

      <!-- 2. Logo YouTube Music -->
      <div class="yt-logo-box" id="splash-yt-logo">
        <div class="yt-red-pill"></div>
        <div class="yt-text-group">
          <span class="yt-brand-youtube">YouTube</span>
          <span class="yt-brand-music">Music</span>
        </div>
      </div>

      <!-- 3. Caída e Impacto de AuraMusic -->
      <div class="aura-drop-container" id="splash-aura-container">
        <div class="aura-impact-shockwave" id="splash-shockwave"></div>
        <div class="aura-falling-logo" id="splash-falling-logo">
          <span class="aura-sparkle-icon">✨</span>
          <span class="aura-text-gradient">AuraMusic</span>
        </div>
        <div class="aura-sub-badge" id="splash-sub-badge">
          <span>Personalizador de YouTube Music</span>
          <span class="pill">v1.3.3</span>
        </div>
      </div>

      <!-- Indicador inferior para omitir -->
      <div class="tv-skip-hint" id="splash-skip-hint">
        Haz clic o presiona <kbd>Esc</kbd> para omitir
      </div>
    `;

    const loaderBox = splash.querySelector('#splash-yt-loader');
    const loaderFill = splash.querySelector('#splash-loader-fill');
    const logoBox = splash.querySelector('#splash-yt-logo');
    const fallingLogo = splash.querySelector('#splash-falling-logo');
    const shockwave = splash.querySelector('#splash-shockwave');
    const subBadge = splash.querySelector('#splash-sub-badge');
    const skipHint = splash.querySelector('#splash-skip-hint');

    // Inyectar en el documento
    const container = document.body || document.documentElement;
    if (container) {
      container.appendChild(splash);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        (document.body || document.documentElement).appendChild(splash);
      });
    }

    // Saltar con clic o teclado
    splash.addEventListener('click', () => dismissSplash(true));
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === ' ') {
        window.removeEventListener('keydown', onKey);
        dismissSplash(true);
      }
    };
    window.addEventListener('keydown', onKey);

    // --- SECUENCIA DE ANIMACIÓN PROGRAMADA ---
    requestAnimationFrame(() => {
      // 1. Llenar la línea roja seeker
      loaderFill.style.transition = 'width 1450ms cubic-bezier(0.25, 1, 0.5, 1)';
      loaderFill.style.width = '100%';

      // Iniciar sonido sincronizado
      playSoundIfAllowed(soundEnabled);

      // 2. Contraer línea y revelar YouTube Music
      activeTimers.push(setTimeout(() => {
        loaderBox.style.transition = 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)';
        loaderBox.style.opacity = '0';
        loaderBox.style.transform = 'scale(0.8)';

        logoBox.style.transition = 'all 450ms cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        logoBox.style.opacity = '1';
        logoBox.style.transform = 'scale(1)';

        skipHint.style.opacity = '1';
      }, 1500));

      // 3. ¡CAÍDA DEL TEXTO AURAMUSIC!
      activeTimers.push(setTimeout(() => {
        // Cae con rebote físico
        fallingLogo.style.transition = 'transform 550ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 250ms ease';
        fallingLogo.style.opacity = '1';
        fallingLogo.style.transform = 'translateY(0) scale(1) rotate(0deg)';

        // El logo de YouTube Music se desliza ligeramente para acompañar
        logoBox.style.transition = 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms ease';
        logoBox.style.transform = 'translateY(70px) scale(0.85)';
        logoBox.style.opacity = '0.75';

        // Onda expansiva de impacto
        activeTimers.push(setTimeout(() => {
          shockwave.style.transition = 'all 500ms cubic-bezier(0.16, 1, 0.3, 1)';
          shockwave.style.opacity = '0.85';
          shockwave.style.transform = 'scale(6)';
          setTimeout(() => { shockwave.style.opacity = '0'; }, 350);
        }, 300));

        // Subtítulo
        activeTimers.push(setTimeout(() => {
          subBadge.style.transition = 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)';
          subBadge.style.opacity = '1';
          subBadge.style.transform = 'translateY(0)';
        }, 380));

      }, 2100));
    });

    // Temporizador de seguridad máximo (nunca trabar la página)
    activeTimers.push(setTimeout(() => {
      dismissSplash(false);
    }, 6000));
  }

  function dismissSplash(immediate = false) {
    if (isDismissed) return;
    isDismissed = true;

    activeTimers.forEach(t => clearTimeout(t));

    const splash = document.getElementById('auramusic-splash-screen');
    if (!splash) return;

    // Desvanecer volumen suavemente si está sonando
    try {
      if (audioInstance && !audioInstance.paused) {
        let vol = audioInstance.volume;
        const fade = setInterval(() => {
          vol = Math.max(0, vol - 0.2);
          audioInstance.volume = vol;
          if (vol <= 0) {
            clearInterval(fade);
            audioInstance.pause();
          }
        }, 35);
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

  // Ejecución automática al arrancar la página
  createSplash(false);

  // Exponer API para pruebas o control desde el Hub
  window.AuraMusic = window.AuraMusic || {};
  window.AuraMusic.Splash = {
    dismiss: onPageReady,
    preview: () => createSplash(true)
  };
})();
