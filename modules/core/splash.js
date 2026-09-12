/**
 * AuraMusic - Pantalla de Carga e Intro de Inicio (Splash Screen)
 * Se ejecuta en document_start para cubrir la página antes de que se renderice nada,
 * ocultando cualquier parpadeo (FOUC) mientras se aplican los temas y módulos.
 */
(function () {
  'use strict';

  // 1. Comprobar si el usuario desactivó la intro en ajustes
  try {
    const saved = localStorage.getItem('auramusic_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.splashScreen === false) {
        return;
      }
    }
  } catch (_) {}

  const startTime = Date.now();
  const MIN_DISPLAY_MS = 850;      // Tiempo mínimo agradable para apreciar la intro
  const MAX_SAFETY_TIMEOUT_MS = 3800; // Respaldo máximo para garantizar que nunca se bloquee
  let isDismissed = false;

  function getVersion() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
        return chrome.runtime.getManifest().version || '1.3.2';
      }
    } catch (_) {}
    return '1.3.2';
  }

  function injectSplash() {
    if (document.getElementById('auramusic-splash-screen')) return;

    const splash = document.createElement('div');
    splash.id = 'auramusic-splash-screen';
    splash.setAttribute('role', 'status');
    splash.setAttribute('aria-live', 'polite');

    const ver = getVersion();

    splash.innerHTML = `
      <div class="auramusic-splash-backdrop">
        <div class="splash-orb splash-orb-1"></div>
        <div class="splash-orb splash-orb-2"></div>
        <div class="splash-orb splash-orb-3"></div>
        <div class="splash-mesh-grid"></div>
      </div>

      <div class="auramusic-splash-content" id="auramusic-splash-card">
        <div class="splash-emblem-box">
          <div class="splash-glow-ring"></div>
          <div class="splash-logo-sparkle">✨</div>
        </div>

        <div class="splash-title-wrap">
          <h1 class="splash-main-title">AuraMusic</h1>
          <span class="splash-version-pill">v${ver}</span>
        </div>

        <p class="splash-tagline">Personalizador Avanzado para YouTube Music</p>

        <div class="splash-progress-track">
          <div class="splash-progress-fill" id="splash-progress-bar" style="width: 25%;"></div>
        </div>

        <div class="splash-status-container">
          <span class="splash-status-spinner"></span>
          <span class="splash-status-text" id="splash-status-label">Iniciando interfaz y temas...</span>
        </div>

        <div class="splash-hint-text">
          Presiona <kbd>Esc</kbd> o haz clic para continuar
        </div>
      </div>
    `;

    // Saltarse la intro con un clic o tecla Escape
    splash.addEventListener('click', () => dismissSplash(true));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('auramusic-splash-screen')) {
        dismissSplash(true);
      }
    }, { once: true });

    // Inyectar de inmediato en el contenedor raíz
    const target = document.body || document.documentElement;
    if (target) {
      target.appendChild(splash);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('auramusic-splash-screen')) {
          (document.body || document.documentElement).appendChild(splash);
        }
      });
    }
  }

  function updateStatus(text, percent = null) {
    if (isDismissed) return;
    const label = document.getElementById('splash-status-label');
    const bar = document.getElementById('splash-progress-bar');
    if (label && text) label.textContent = text;
    if (bar && typeof percent === 'number') {
      bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
  }

  function dismissSplash(immediate = false) {
    if (isDismissed) return;
    const splash = document.getElementById('auramusic-splash-screen');
    if (!splash) return;

    const elapsed = Date.now() - startTime;
    const delay = (immediate || elapsed >= MIN_DISPLAY_MS) ? 0 : (MIN_DISPLAY_MS - elapsed);

    setTimeout(() => {
      if (isDismissed) return;
      isDismissed = true;

      updateStatus('✨ ¡Todo listo!', 100);

      setTimeout(() => {
        splash.classList.add('splash-dismissed');
        setTimeout(() => {
          splash.remove();
        }, 650);
      }, immediate ? 40 : 250);
    }, delay);
  }

  // Ejecución inmediata
  injectSplash();

  // Si document.body se creó después, asegurar que esté en el body
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const splash = document.getElementById('auramusic-splash-screen');
      if (splash && document.body && splash.parentElement !== document.body) {
        document.body.appendChild(splash);
      }
    });
  }

  // Respaldo de seguridad: nunca dejar la pantalla bloqueada más de 3.8s
  setTimeout(() => {
    dismissSplash(true);
  }, MAX_SAFETY_TIMEOUT_MS);

  // Exponer API global
  window.AuraMusic = window.AuraMusic || {};
  window.AuraMusic.Splash = {
    dismiss: dismissSplash,
    updateStatus: updateStatus,
    inject: injectSplash
  };
})();
