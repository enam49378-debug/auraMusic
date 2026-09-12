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
  const MIN_PLAY_MS = 5200; // Tiempo para apreciar la caída, carga neón, fusión y logo final

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

      <!-- 2 & 3. Fila Doble Lado a Lado (YouTube Music + Divisor + AuraMusic) -->
      <div class="side-by-side-wrapper" id="splash-side-wrapper">
        <div class="yt-block" id="splash-yt-block">
          <div class="yt-red-pill">
            <div class="yt-play-arrow"></div>
          </div>
          <div class="yt-text-wrap">
            <span class="yt-txt-youtube">YouTube</span>
            <span class="yt-txt-music">Music</span>
          </div>
        </div>

        <div class="side-divider" id="splash-divider"></div>

        <div class="aura-block" id="splash-aura-block">
          <span class="aura-sparkle">✨</span>
          <span class="aura-title">AuraMusic</span>
        </div>
      </div>

      <!-- 4 & 5. Efectos de Fusión y Choque de Energía -->
      <div class="fusion-flash" id="splash-fusion-flash"></div>
      <div class="fusion-energy-ring" id="splash-energy-ring"></div>

      <!-- 6. Logo Final Triunfal de YouTube -->
      <div class="final-yt-stage" id="splash-final-stage">
        <div class="final-red-pill"></div>
        <span class="final-brand-title">YouTube</span>
        <span class="final-music-tag">Music</span>
      </div>

      <!-- Indicador inferior para omitir -->
      <div class="tv-skip-hint" id="splash-skip-hint">
        Haz clic o presiona <kbd>Esc</kbd> para omitir
      </div>
    `;

    const loaderBox = splash.querySelector('#splash-yt-loader');
    const loaderFill = splash.querySelector('#splash-loader-fill');
    const sideWrapper = splash.querySelector('#splash-side-wrapper');
    const ytBlock = splash.querySelector('#splash-yt-block');
    const divider = splash.querySelector('#splash-divider');
    const auraBlock = splash.querySelector('#splash-aura-block');
    const fusionFlash = splash.querySelector('#splash-fusion-flash');
    const energyRing = splash.querySelector('#splash-energy-ring');
    const finalStage = splash.querySelector('#splash-final-stage');
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

        ytBlock.style.transition = 'all 450ms cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        ytBlock.style.opacity = '1';
        ytBlock.style.transform = 'scale(1)';

        skipHint.style.opacity = '1';
      }, 1500));

      // 3. ¡CAÍDA DE AURAMUSIC AL LADO (SIDE-BY-SIDE, NO ENCIMA)!
      activeTimers.push(setTimeout(() => {
        divider.style.opacity = '0.5';
        divider.style.transform = 'scaleY(1)';

        auraBlock.style.transition = 'transform 550ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 250ms ease';
        auraBlock.style.opacity = '1';
        auraBlock.style.transform = 'translateY(0) scale(1) rotate(0deg)';
      }, 2050));

      // 4. ¡AURAMUSIC TOMA FUERZA (CARGA DE ENERGÍA NEÓN)!
      activeTimers.push(setTimeout(() => {
        auraBlock.classList.add('charging');
      }, 2750));

      // 5. ¡FUSIÓN CON YOUTUBE MUSIC! (Atracción magnética hacia el centro)
      activeTimers.push(setTimeout(() => {
        auraBlock.classList.remove('charging');
        auraBlock.style.filter = 'drop-shadow(0 0 35px #00f2fe) drop-shadow(0 0 25px #ff007f)';
        ytBlock.style.filter = 'drop-shadow(0 0 30px rgba(255, 0, 0, 0.85))';

        ytBlock.style.transition = 'all 420ms cubic-bezier(0.7, 0, 0.84, 0)';
        auraBlock.style.transition = 'all 420ms cubic-bezier(0.7, 0, 0.84, 0)';
        divider.style.transition = 'opacity 200ms ease';
        divider.style.opacity = '0';

        // Atracción al centro
        ytBlock.style.transform = 'translateX(90px) scale(0.9)';
        auraBlock.style.transform = 'translateX(-90px) scale(0.9)';

        // 6. ¡COLISIÓN, DESTELLO RADIAL Y SURGIMIENTO DEL LOGO DE YOUTUBE!
        activeTimers.push(setTimeout(() => {
          sideWrapper.style.opacity = '0';

          // Destello y onda de choque
          fusionFlash.style.opacity = '1';
          energyRing.style.opacity = '1';
          energyRing.style.transform = 'scale(7.5)';

          // Revelar logo final
          finalStage.classList.add('active');

          setTimeout(() => {
            fusionFlash.style.transition = 'opacity 350ms ease-out';
            fusionFlash.style.opacity = '0';
            energyRing.style.opacity = '0';
          }, 120);
        }, 420));

      }, 3550));
    });

    // Temporizador de seguridad máximo (nunca trabar la página)
    activeTimers.push(setTimeout(() => {
      dismissSplash(false);
    }, 7000));
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
