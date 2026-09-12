/**
 * AuraMusic - Content Script Principal (music.youtube.com)
 * Orquestador Modular: Audio, Visualizador, Cinema Lyrics, Temas y Hub.
 */
(function () {
  'use strict';

  // --- 0. INYECTOR DE FUENTES GOOGLE Y PLAYER BRIDGE (MAIN WORLD) ---
  function injectGoogleFonts() {
    if (document.getElementById('auramusic-google-fonts')) return;
    const link = document.createElement('link');
    link.id = 'auramusic-google-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Caveat:wght@600;700&family=Comfortaa:wght@600;700&family=Orbitron:wght@600;800;900&family=Press+Start+2P&family=Plus+Jakarta+Sans:wght@500;700&family=Quicksand:wght@600;700&family=Rajdhani:wght@600;700&family=Silkscreen:wght@400;700&family=Space+Grotesk:wght@500;700&display=swap';
    document.head.appendChild(link);
    console.log('✨ AuraMusic: Fuentes tipográficas temáticas cargadas.');
  }
  injectGoogleFonts();


  console.log('%c✨ AuraMusic: Inicializando suite modular...', 'color: #00e5ff; font-weight: bold; font-size: 14px;');

  // --- 1. GUARDIÁN ANTI-DISTRACCIONES Y ANUNCIOS (Ejecutado periódicamente) ---
  function runCleanWatchdog() {
    const isClean = window.AuraMusic?.state?.cleanMode ?? window.state?.cleanMode ?? true;
    if (!isClean) return;

    const confirmBtn = document.querySelector('ytmusic-you-there-renderer #confirm-button, #confirm-button.yt-button-renderer');
    if (confirmBtn && confirmBtn.offsetParent !== null) {
      confirmBtn.click();
    }
    const dismissBtn = document.querySelector('ytmusic-mealbar-promo-renderer #dismiss-button');
    if (dismissBtn && dismissBtn.offsetParent !== null) {
      dismissBtn.click();
    }
  }

  // --- 2. INICIALIZACIÓN GLOBAL CUANDO EL DOM ESTÁ LISTO ---
  let isAuraMusicInitialized = false;

  function init() {
    if (isAuraMusicInitialized) return;
    isAuraMusicInitialized = true;

    console.log('%c🚀 AuraMusic: Conectando módulos...', 'color: #00e5ff; font-weight: bold;');
    if (window.AuraMusic?.Splash?.updateStatus) {
      window.AuraMusic.Splash.updateStatus('Cargando ajustes y temas...', 45);
    }

    // 1. Cargar ajustes persistentes (activa automáticamente applyAllSettings)
    if (typeof window.loadSettings === 'function') {
      window.loadSettings();
    } else if (window.AuraMusic?.loadSettings) {
      window.AuraMusic.loadSettings();
    }

    // 2. Garantizar que el tema guardado se renderice inmediatamente en el DOM
    const curTheme = window.AuraMusic?.state?.theme || window.state?.theme || 'oled';
    if (typeof window.applyTheme === 'function') {
      window.applyTheme(curTheme);
    } else if (window.AuraMusic?.Themes?.applyTheme) {
      window.AuraMusic.Themes.applyTheme(curTheme);
    }

    if (window.AuraMusic?.Splash?.updateStatus) {
      window.AuraMusic.Splash.updateStatus('Iniciando interfaz y módulos...', 80);
    }

    // 3. Inyectar Hub Flotante y Lanzador
    if (window.AuraMusic?.Hub?.injectLauncherAndHub) {
      window.AuraMusic.Hub.injectLauncherAndHub();
    }

    // 4. Desbloquear AudioContext en la primera interacción del usuario
    const audioEvents = ['click', 'play', 'keydown', 'touchstart'];
    const tryConnectAudio = () => {
      if (window.AuraMusic?.Audio?._tryConnectAudio) {
        window.AuraMusic.Audio._tryConnectAudio();
      }
    };
    audioEvents.forEach(evt => document.addEventListener(evt, tryConnectAudio, { once: true }));

    // 5. Atajos de teclado (Alt+A para Hub, L para Lyrics)
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const hubOverlay = document.getElementById('auramusic-hub-overlay');
        if (hubOverlay) {
          hubOverlay.classList.toggle('active');
          if (window.AuraMusic?.Hub?.updateUIControls) {
            window.AuraMusic.Hub.updateUIControls();
          }
        }
      }
      if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (window.AuraMusic?.Lyrics?.toggleCinemaMode) {
          window.AuraMusic.Lyrics.toggleCinemaMode();
        }
      }
    });

    // 6. Bucle maestro cada 2.5s (canción, watchdog, lyrics button)
    let lastTrackKey = '';
    setInterval(() => {
      const titleEl = document.querySelector('ytmusic-player-bar .title');
      const artistEl = document.querySelector('ytmusic-player-bar .byline');
      const curKey = (titleEl ? titleEl.textContent : '') + ' - ' + (artistEl ? artistEl.textContent : '');

      if (curKey !== ' - ' && curKey !== lastTrackKey) {
        lastTrackKey = curKey;
        if (window.AuraMusic?.Ambient?.updateAmbientGlowColor) {
          window.AuraMusic.Ambient.updateAmbientGlowColor();
        }
        if (window.AuraMusic?.Lyrics?.checkCinemaTrackChange) {
          window.AuraMusic.Lyrics.checkCinemaTrackChange();
        }
      }

      runCleanWatchdog();

      if (window.AuraMusic?.Lyrics?.checkAndInjectLyricsButton) {
        window.AuraMusic.Lyrics.checkAndInjectLyricsButton();
      }
    }, 2500);

    console.log('✅ AuraMusic: Inicialización completa.');

    // 7. Desvanecer la pantalla de carga suavemente
    if (window.AuraMusic?.Splash?.dismiss) {
      window.AuraMusic.Splash.dismiss();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
