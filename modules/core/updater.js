/**
 * AuraMusic - GitHub Auto-Updater
 * Detecta automáticamente nuevas versiones y commits publicados en el repositorio de GitHub:
 * https://github.com/enam49378-debug/auraMusic
 * 
 * Permite actualizar con 1 solo clic y reiniciar la extensión y YouTube Music automáticamente,
 * sin necesidad de abrir chrome://extensions ni descomprimir archivos manualmente.
 */
(function () {
  'use strict';

  const GITHUB_MANIFEST_URL = 'https://raw.githubusercontent.com/enam49378-debug/auraMusic/main/manifest.json';
  const GITHUB_COMMITS_URL = 'https://api.github.com/repos/enam49378-debug/auraMusic/commits/main';
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
      if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
        return chrome.runtime.getManifest().version || '1.3.3';
      }
    } catch (_) {}
    return '1.3.3';
  }

  // Comprueba si hay actualizaciones en GitHub (por versión SemVer o nuevo Commit SHA)
  // Comprueba si hay actualizaciones en GitHub (por versión SemVer o nuevo Commit SHA)
  async function checkGithubUpdate(manualTrigger = false, forceShowModal = false, showModalIfAvailable = false) {
    const localVer = getLocalVersion();
    let remoteVer = null;
    let localCommit = '';
    let remoteCommit = '';
    let remoteCommitMsg = '';
    let remoteCommitDate = '';
    let serverAvailable = false;
    let hasSemverUpdate = false;
    let hasCommitUpdate = false;

    // 1. Intentar consultar vía auralyrics-server local (puerto 3000)
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(SERVER_CHECK_URL, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          serverAvailable = true;
          remoteVer = data.remoteVersion;
          localCommit = data.currentCommit;
          remoteCommit = data.remoteCommit;
          remoteCommitMsg = data.remoteCommitMsg;
          remoteCommitDate = data.remoteCommitDate;
          hasSemverUpdate = Boolean(data.hasSemverUpdate);
          hasCommitUpdate = Boolean(data.hasCommitUpdate);
        }
      }
    } catch (_) {}

    // 2. Si el servidor local no respondió, consultar GitHub directamente
    if (!remoteVer || !remoteCommit) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5500);

        const [manifestRes, commitRes] = await Promise.all([
          fetch(`${GITHUB_MANIFEST_URL}?_nocache=${Date.now()}`, { signal: ctrl.signal }).catch(() => null),
          fetch(GITHUB_COMMITS_URL, {
            signal: ctrl.signal,
            headers: { 'Accept': 'application/vnd.github.v3+json' }
          }).catch(() => null)
        ]);
        clearTimeout(tid);

        if (manifestRes && manifestRes.ok) {
          const manifest = await manifestRes.json();
          remoteVer = manifest.version;
        }

        if (commitRes && commitRes.ok) {
          const commitData = await commitRes.json();
          if (commitData?.sha) {
            remoteCommit = commitData.sha.substring(0, 7);
            remoteCommitMsg = commitData.commit?.message?.split('\n')[0] || '';
            remoteCommitDate = commitData.commit?.author?.date || '';
          }
        }
      } catch (e) {
        if (manualTrigger) {
          showToast('⚠️ No se pudo conectar con GitHub en este momento');
        }
        return { hasUpdate: false, error: 'Connection error' };
      }
    }

    if (!remoteVer) remoteVer = localVer;

    // Si no tenemos commit local del servidor, leer del almacenamiento local
    if (!localCommit && typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get(['auramusic_current_commit']);
        localCommit = stored?.auramusic_current_commit || '';
      } catch (_) {}
    }

    const isHexSha = s => typeof s === 'string' && /^[0-9a-f]{6,40}$/i.test(s.trim());
    const semverDiff = compareSemver(remoteVer, localVer);

    // Comparación robusta contra falsos positivos:
    // Si la versión local es mayor que la de GitHub (ej. desarrollo local v1.3.7 vs GitHub v1.3.6):
    // Jamás se debe notificar como actualización.
    if (semverDiff < 0) {
      hasSemverUpdate = false;
      hasCommitUpdate = false;
    } else if (semverDiff > 0) {
      hasSemverUpdate = true;
      hasCommitUpdate = false;
    } else {
      // Misma versión semver (semverDiff === 0):
      hasSemverUpdate = false;
      if (serverAvailable) {
        // El servidor local ya verificó commitsAhead y commitsBehind vía git rev-list
        hasCommitUpdate = Boolean(hasCommitUpdate);
      } else if (isHexSha(remoteCommit) && isHexSha(localCommit) && remoteCommit.toLowerCase() !== localCommit.toLowerCase()) {
        hasCommitUpdate = true;
      } else {
        hasCommitUpdate = false;
      }
    }

    const hasUpdate = hasSemverUpdate || hasCommitUpdate;

    const result = {
      hasUpdate,
      localVersion: localVer,
      remoteVersion: remoteVer,
      localCommit: localCommit || 'local',
      remoteCommit: remoteCommit || 'latest',
      remoteCommitMsg: remoteCommitMsg || 'Mejoras y correcciones en GitHub',
      remoteCommitDate,
      serverAvailable
    };

    // Solo mostrar modal si fue forzado (botón explícito), si el usuario hizo clic manual en buscar actualización,
    // o si explícitamente se pidió showModalIfAvailable (por defecto false para no molestar mientras se escucha música).
    if (forceShowModal || (hasUpdate && (manualTrigger || showModalIfAvailable))) {
      showUpdateModal(result);
    } else if (manualTrigger) {
      showToast(`✨ AuraMusic v${localVer} ya está al día con GitHub`);
    }

    return result;
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
      background: rgba(14, 18, 28, 0.95);
      border: 1px solid rgba(0, 242, 254, 0.35);
      color: #fff;
      padding: 13px 22px;
      border-radius: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13.5px;
      font-weight: 600;
      box-shadow: 0 12px 35px rgba(0,0,0,0.6), 0 0 24px rgba(0, 242, 254, 0.25);
      z-index: 9999999;
      backdrop-filter: blur(16px);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: auraToastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function showUpdateModal(info) {
    const {
      localVersion,
      remoteVersion,
      localCommit,
      remoteCommit,
      remoteCommitMsg,
      serverAvailable
    } = info;

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
        @keyframes auraToastIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(st);
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'auramusic-update-modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(4, 4, 8, 0.78);
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
      background: linear-gradient(135deg, rgba(22, 26, 42, 0.96), rgba(12, 16, 26, 0.98));
      border: 1px solid rgba(0, 242, 254, 0.3);
      border-radius: 20px;
      padding: 28px;
      width: 470px;
      max-width: 92vw;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 0 35px rgba(0, 242, 254, 0.25), 0 25px 60px rgba(0,0,0,0.8);
      animation: auraModalFadeIn 0.32s cubic-bezier(0.16, 1, 0.3, 1), auraPulseGlow 4s infinite ease-in-out;
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: relative;
    `;

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #00f2fe, #8a2be2); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 16px rgba(0,242,254,0.4);">
            ✨
          </div>
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #00f2fe; font-weight: 700;">AuraMusic Actualizador</div>
            <div style="font-size: 18px; font-weight: 700; color: #fff;">¡Actualización de GitHub lista!</div>
          </div>
        </div>
        <button id="aura-update-close-btn" style="background: none; border: none; color: rgba(255,255,255,0.4); font-size: 20px; cursor: pointer; padding: 4px; border-radius: 6px; transition: color 0.2s;">✕</button>
      </div>

      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <span style="font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase;">Instalada</span>
          <div style="font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.85);">v${localVersion} <span style="font-size: 12px; color: rgba(255,255,255,0.4);">(${localCommit || 'local'})</span></div>
        </div>
        <div style="color: #00f2fe; font-size: 20px; font-weight: 700;">➔</div>
        <div style="text-align: right;">
          <span style="font-size: 11px; color: #00f2fe; text-transform: uppercase;">Disponible en GitHub</span>
          <div style="font-size: 15px; font-weight: 700; color: #00f2fe;">v${remoteVersion} <span style="font-size: 12px; color: #a8ff78;">(${remoteCommit || 'latest'})</span></div>
        </div>
      </div>

      <div style="background: rgba(0, 242, 254, 0.05); border-left: 3px solid #00f2fe; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: rgba(255,255,255,0.85); line-height: 1.45;">
        <span style="color: #00f2fe; font-weight: 600;">Último cambio en GitHub:</span><br>
        <span style="color: #fff; font-style: italic;">"${remoteCommitMsg}"</span>
      </div>

      <div style="font-size: 12.5px; line-height: 1.4; color: rgba(255,255,255,0.65);">
        La actualización descargará los cambios directamente desde GitHub y recargará la extensión y YouTube Music automáticamente en 1 solo clic. <strong>No necesitas ir a chrome://extensions.</strong>
      </div>

      <div id="aura-update-status" style="font-size: 12.5px; color: #00f2fe; font-weight: 600; min-height: 18px; display: flex; align-items: center; gap: 8px;"></div>

      <div style="display: flex; gap: 10px; margin-top: 6px;">
        <button id="aura-update-now-btn" style="
          flex: 1;
          background: linear-gradient(135deg, #00f2fe, #8a2be2);
          border: none;
          color: #fff;
          padding: 12px 18px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 18px rgba(0, 242, 254, 0.35);
        ">
          🚀 Actualizar y Reiniciar Ahora
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
        Actualizando desde GitHub...
      `;
      nowBtn.style.opacity = '0.9';

      await applyGithubUpdateAndReload({
        remoteVersion,
        remoteCommit,
        onProgress: (msg) => {
          statusDiv.innerHTML = `<span>⏳</span> <span>${msg}</span>`;
        },
        onSuccess: (msg) => {
          statusDiv.style.color = '#10b981';
          statusDiv.innerHTML = `<span>✅</span> <span>${msg}</span>`;
          nowBtn.innerHTML = '✨ ¡Completado!';
          nowBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        },
        onError: (err) => {
          statusDiv.style.color = '#ffbb00';
          statusDiv.innerHTML = `<span>⚠️</span> <span>${err}</span>`;
          laterBtn.disabled = false;
          laterBtn.textContent = 'Cerrar';
        }
      });
    };
  }

  // Recarga en caliente la extensión en Chrome y la página de YouTube Music
  function reloadExtensionAndPage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
      }
    } catch (_) {}
    setTimeout(() => {
      window.location.reload();
    }, 450);
  }

  // Ejecuta la actualización directa desde GitHub vía el servidor local o script de sincronización,
  // recarga la extensión en Chrome y reinicia YouTube Music automáticamente.
  async function applyGithubUpdateAndReload(options = {}) {
    const { onProgress, onSuccess, onError, remoteVersion, remoteCommit } = options;
    if (typeof onProgress === 'function') {
      onProgress('Conectando con GitHub y descargando la última versión...');
    }

    let updateSuccess = false;
    let updateOutput = '';
    let finalVer = remoteVersion || getLocalVersion();
    let finalCommit = remoteCommit || '';

    // 1. Intentar actualizar vía servidor local auralyrics-server
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 35000);
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
          updateOutput = data.output || '';
          if (data.version) finalVer = data.version;
          if (data.commit) finalCommit = data.commit;
        }
      }
    } catch (err) {
      console.warn('auralyrics-server apply update warning:', err);
    }

    // Guardar marca de actualización en almacenamiento local de Chrome
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({
          auramusic_just_updated: true,
          auramusic_updated_version: finalVer,
          auramusic_current_commit: finalCommit
        });
      } catch (_) {}
    }

    if (updateSuccess) {
      if (typeof onSuccess === 'function') {
        onSuccess(`¡AuraMusic v${finalVer} sincronizado con GitHub! Recargando extensión... 🚀`);
      }
      setTimeout(() => {
        reloadExtensionAndPage();
      }, 1000);
      return { ok: true, output: updateOutput, version: finalVer, commit: finalCommit };
    } else {
      // Fallback: Si el servidor local no estaba corriendo, informar con opción rápida
      if (typeof onError === 'function') {
        onError('El servidor local no está activo. Ejecuta «Actualizar_AuraMusic.bat» o recarga la extensión.');
      }
      // Respaldo de descarga oficial si el usuario lo desea
      window.open(GITHUB_ZIP_URL, '_blank');
      setTimeout(() => {
        reloadExtensionAndPage();
      }, 2500);
      return { ok: false, fallback: true };
    }
  }

  // Comprobar si acabamos de actualizar para mostrar felicitaciones
  async function checkJustUpdatedToast() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const data = await chrome.storage.local.get([
          'auramusic_just_updated',
          'auramusic_updated_version',
          'auramusic_current_commit'
        ]);
        if (data && data.auramusic_just_updated) {
          await chrome.storage.local.set({ auramusic_just_updated: false });
          const ver = data.auramusic_updated_version || getLocalVersion();
          const commit = data.auramusic_current_commit ? ` (${data.auramusic_current_commit})` : '';
          setTimeout(() => {
            showToast(`🎉 ¡AuraMusic se actualizó exitosamente a v${ver}${commit}!`);
          }, 1500);
        }
      } catch (_) {}
    }
  }

  // Exportar funciones globales para poder consultar desde el menú de Cinema Lyrics y AuraMusic Hub
  window.__AuraMusicCheckUpdate = checkGithubUpdate;
  window.__AuraMusicApplyUpdateAndReload = applyGithubUpdateAndReload;
  window.__AuraMusicReloadExtension = reloadExtensionAndPage;
  window.AuraMusic = window.AuraMusic || {};
  window.AuraMusic.Updater = {
    checkGithubUpdate,
    applyGithubUpdateAndReload,
    reloadExtensionAndPage,
    getLocalVersion
  };

  // Verificación de toast al iniciar
  checkJustUpdatedToast();

  // Verificación inicial con GitHub al cargar YouTube Music (tras 4.5 segundos)
  setTimeout(() => {
    checkGithubUpdate(false);
  }, 4500);

  // Verificación automática periódica de GitHub en segundo plano (cada 45 minutos)
  const AUTO_CHECK_INTERVAL = 45 * 60 * 1000;
  setInterval(() => {
    console.log('🔄 AuraMusic Auto-Updater: Comprobación programada en segundo plano...');
    checkGithubUpdate(false);
  }, AUTO_CHECK_INTERVAL);

})();
