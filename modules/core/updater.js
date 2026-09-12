/**
 * AuraMusic - GitHub Auto-Updater
 * Detecta automáticamente nuevas versiones publicadas en el repositorio de GitHub:
 * https://github.com/enam49378-debug/auraMusic
 * 
 * Si hay una actualización disponible al abrir YouTube Music, despliega un modal elegante
 * que permite actualizar con 1 solo clic y reiniciar la extensión y YouTube Music automáticamente.
 */
(function () {
  'use strict';

  const GITHUB_MANIFEST_URL = 'https://raw.githubusercontent.com/enam49378-debug/auraMusic/main/manifest.json';
  const SERVER_CHECK_URL = 'http://localhost:3000/api/update/check';
  const SERVER_APPLY_URL = 'http://localhost:3000/api/update/apply';
  const GITHUB_ZIP_URL = 'https://github.com/enam49378-debug/auraMusic/archive/refs/heads/main.zip';

  function compareSemver(v1, v2) {
    const p1 = String(v1 || '0').split('.').map(n => parseInt(n, 10) || 0);
    const p2 = String(v2 || '0').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  function getLocalVersion() {
    try {
      if (chrome && chrome.runtime && chrome.runtime.getManifest) {
        return chrome.runtime.getManifest().version || '1.0.0';
      }
    } catch (_) {}
    return '1.0.0';
  }

  async function checkGithubUpdate(manualTrigger = false) {
    const localVer = getLocalVersion();
    let remoteVer = null;
    let serverAvailable = false;

    // 1. Intentar consultar vía auralyrics-server local
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(SERVER_CHECK_URL, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          serverAvailable = true;
          remoteVer = data.remoteVersion;
        }
      }
    } catch (_) {}

    // 2. Si el servidor local no respondió, consultar GitHub directamente
    if (!remoteVer) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${GITHUB_MANIFEST_URL}?_nocache=${Date.now()}`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok) {
          const manifest = await res.json();
          remoteVer = manifest.version;
        }
      } catch (e) {
        if (manualTrigger) {
          showToast('⚠️ No se pudo verificar la actualización con GitHub');
        }
        return;
      }
    }

    if (!remoteVer) return;

    const hasUpdate = compareSemver(remoteVer, localVer) > 0;

    if (hasUpdate) {
      showUpdateModal({ currentVersion: localVer, remoteVersion: remoteVer, serverAvailable });
    } else if (manualTrigger) {
      showToast(`✨ AuraMusic v${localVer} ya está al día`);
    }
  }

  function showToast(msg) {
    const existing = document.getElementById('auramusic-updater-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'auramusic-updater-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(18, 18, 24, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      padding: 12px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13.5px;
      font-weight: 500;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(138, 43, 226, 0.25);
      z-index: 9999999;
      backdrop-filter: blur(16px);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: auraToastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function showUpdateModal({ currentVersion, remoteVersion, serverAvailable }) {
    if (document.getElementById('auramusic-update-modal-backdrop')) return;

    // Inyectar estilos para el modal si no existen
    if (!document.getElementById('auramusic-updater-styles')) {
      const st = document.createElement('style');
      st.id = 'auramusic-updater-styles';
      st.textContent = `
        @keyframes auraModalFadeIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes auraPulseGlow {
          0%, 100% { box-shadow: 0 0 25px rgba(138, 43, 226, 0.3), 0 20px 45px rgba(0,0,0,0.7); }
          50% { box-shadow: 0 0 45px rgba(0, 242, 254, 0.4), 0 20px 50px rgba(0,0,0,0.8); }
        }
        @keyframes auraSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(st);
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'auramusic-update-modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(4, 4, 8, 0.75);
      backdrop-filter: blur(12px);
      z-index: 9999998;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 1;
      transition: opacity 0.25s ease;
    `;

    const card = document.createElement('div');
    card.id = 'auramusic-update-modal';
    card.style.cssText = `
      background: linear-gradient(135deg, rgba(26, 26, 38, 0.95), rgba(16, 16, 24, 0.98));
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 20px;
      padding: 30px;
      width: 440px;
      max-width: 90vw;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 0 35px rgba(138, 43, 226, 0.35), 0 25px 60px rgba(0,0,0,0.8);
      animation: auraModalFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1), auraPulseGlow 4s infinite ease-in-out;
      display: flex;
      flex-direction: column;
      gap: 18px;
      position: relative;
    `;

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #a855f7, #3b82f6); display: flex; align-items: center; justify-content: center; font-size: 18px;">
            ✨
          </div>
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #a855f7; font-weight: 700;">AuraMusic Actualizador</div>
            <div style="font-size: 18px; font-weight: 700; color: #fff;">¡Nueva versión disponible!</div>
          </div>
        </div>
        <button id="aura-update-close-btn" style="background: none; border: none; color: rgba(255,255,255,0.4); font-size: 20px; cursor: pointer; padding: 4px; border-radius: 6px; transition: color 0.2s;">✕</button>
      </div>

      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <span style="font-size: 12px; color: rgba(255,255,255,0.5);">Versión instalada</span>
          <div style="font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.8);">v${currentVersion}</div>
        </div>
        <div style="color: #00f2fe; font-size: 20px; font-weight: 700;">➔</div>
        <div>
          <span style="font-size: 12px; color: #00f2fe;">Nueva versión GitHub</span>
          <div style="font-size: 15px; font-weight: 700; color: #00f2fe;">v${remoteVersion}</div>
        </div>
      </div>

      <div style="font-size: 13.5px; line-height: 1.5; color: rgba(255,255,255,0.7);">
        Se han publicado mejoras importantes en el repositorio de GitHub: salto interactivo por verso, motor de letras animadas sincronizadas y mayor estabilidad.
      </div>

      <div id="aura-update-status" style="font-size: 12.5px; color: #a855f7; font-weight: 600; min-height: 18px;"></div>

      <div style="display: flex; gap: 10px; margin-top: 6px;">
        <button id="aura-update-now-btn" style="
          flex: 1;
          background: linear-gradient(135deg, #8a2be2, #00f2fe);
          border: none;
          color: #fff;
          padding: 12px 18px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 18px rgba(138, 43, 226, 0.4);
        ">
          🚀 Actualizar y Reiniciar
        </button>
        <button id="aura-update-later-btn" style="
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          padding: 12px 16px;
          border-radius: 12px;
          font-weight: 500;
          font-size: 13.5px;
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          Más tarde
        </button>
      </div>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    const closeBtn = card.querySelector('#aura-update-close-btn');
    const laterBtn = card.querySelector('#aura-update-later-btn');
    const nowBtn = card.querySelector('#aura-update-now-btn');
    const statusDiv = card.querySelector('#aura-update-status');

    function closeModal() {
      backdrop.style.opacity = '0';
      setTimeout(() => backdrop.remove(), 250);
    }

    closeBtn.onclick = closeModal;
    laterBtn.onclick = closeModal;

    nowBtn.onclick = async () => {
      nowBtn.disabled = true;
      laterBtn.disabled = true;
      closeBtn.style.display = 'none';

      nowBtn.innerHTML = `
        <span style="display: inline-block; width: 14px; height: 14px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: auraSpin 0.7s linear infinite;"></span>
        Descargando desde GitHub...
      `;
      nowBtn.style.opacity = '0.9';
      statusDiv.textContent = '⏳ Obteniendo última versión de GitHub con git pull...';

      let updateSuccess = false;

      // 1. Intentar actualizar vía servidor local auralyrics-server
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(SERVER_APPLY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal
        });
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok) {
            updateSuccess = true;
          }
        }
      } catch (_) {}

      if (updateSuccess) {
        statusDiv.style.color = '#10b981';
        statusDiv.textContent = '✅ ¡AuraMusic actualizado con éxito! Reiniciando... 🚀';
        nowBtn.innerHTML = '✨ ¡Completado!';
        nowBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

        setTimeout(() => {
          try {
            chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
          } catch (_) {}
          setTimeout(() => {
            window.location.reload();
          }, 600);
        }, 1200);
      } else {
        // Respaldo directo en caso de que el servidor local no esté abierto:
        statusDiv.style.color = '#00f2fe';
        statusDiv.textContent = '📦 Descargando paquete oficial .ZIP de GitHub...';
        window.open(GITHUB_ZIP_URL, '_blank');
        nowBtn.innerHTML = '⬇️ Descargado ZIP';
        setTimeout(() => {
          statusDiv.textContent = 'Extrae el archivo en tu carpeta de AuraMusic y recarga YouTube Music.';
          laterBtn.disabled = false;
          laterBtn.textContent = 'Cerrar';
        }, 2000);
      }
    };
  }

  // Exportar función global para poder consultar desde el menú de Cinema Lyrics
  window.__AuraMusicCheckUpdate = checkGithubUpdate;

  // Verificación automática al cargar YouTube Music (tras 4 segundos para no interferir con la carga inicial)
  setTimeout(() => {
    checkGithubUpdate(false);
  }, 4500);

})();
