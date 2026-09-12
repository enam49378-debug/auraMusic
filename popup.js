document.addEventListener('DOMContentLoaded', () => {
  const themeBtns = document.querySelectorAll('.theme-btn');
  const allThemes = [
    'auramusic-theme-jesuluto',
    'auramusic-theme-komi',
    'auramusic-theme-apple',
    'auramusic-theme-spotify',
    'auramusic-theme-whatsapp',
    'auramusic-theme-oled',
    'auramusic-theme-cyberpunk',
    'auramusic-theme-glass',
    'auramusic-theme-dynamic',
    'auramusic-theme-youtube',
    'auramusic-theme-aesthetic',
    'auramusic-theme-minecraft'
  ];

  // 1. Mostrar versión actual
  const versionBadge = document.getElementById('popup-version-badge');
  const currentVer = (chrome.runtime?.getManifest) ? chrome.runtime.getManifest().version : '1.3.3';
  if (versionBadge) versionBadge.textContent = `v${currentVer}`;

  // 2. Comprobar estado de GitHub en el popup
  const updateMsg = document.getElementById('popup-update-msg');
  const updateBtn = document.getElementById('popup-update-btn');
  const reloadBtn = document.getElementById('popup-reload-btn');
  const gitIndicator = document.getElementById('popup-git-indicator');

  async function checkPopupGitStatus() {
    try {
      const res = await fetch('http://localhost:3000/api/update/check', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          if (data.updateAvailable) {
            if (gitIndicator) {
              gitIndicator.textContent = 'Actualización lista';
              gitIndicator.style.background = 'rgba(0, 242, 254, 0.2)';
              gitIndicator.style.color = '#00f2fe';
              gitIndicator.style.borderColor = '#00f2fe';
            }
            if (updateMsg) {
              updateMsg.innerHTML = `🎉 <strong>¡Nueva versión disponible en GitHub!</strong> (${data.remoteCommit || 'v' + data.remoteVersion}).`;
            }
          } else {
            if (gitIndicator) {
              gitIndicator.textContent = 'Al día';
              gitIndicator.style.background = 'rgba(0, 255, 136, 0.12)';
              gitIndicator.style.color = '#00ff88';
            }
            if (updateMsg) {
              updateMsg.textContent = `AuraMusic v${currentVer} está sincronizado con GitHub (${data.currentCommit || 'ok'}).`;
            }
          }
          return;
        }
      }
    } catch (_) {}

    // Fallback: GitHub directo
    try {
      const gRes = await fetch('https://raw.githubusercontent.com/enam49378-debug/auraMusic/main/manifest.json?_t=' + Date.now(), { signal: AbortSignal.timeout(3000) });
      if (gRes.ok) {
        const gManifest = await gRes.json();
        if (gManifest.version && gManifest.version !== currentVer) {
          if (gitIndicator) gitIndicator.textContent = 'Nueva versión';
          if (updateMsg) updateMsg.innerHTML = `🎉 <strong>v${gManifest.version} en GitHub</strong>. Presiona Actualizar.`;
        }
      }
    } catch (_) {}
  }
  checkPopupGitStatus();

  // 3. Botón Actualizar
  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      updateBtn.disabled = true;
      updateBtn.style.opacity = '0.7';
      if (updateMsg) updateMsg.innerHTML = '⏳ Descargando de GitHub y actualizando...';

      let applied = false;
      try {
        const res = await fetch('http://localhost:3000/api/update/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(25000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok) applied = true;
        }
      } catch (_) {}

      if (applied) {
        if (updateMsg) updateMsg.innerHTML = '✅ ¡Actualizado! Recargando extensión...';
        chrome.storage.local.set({ auramusic_just_updated: true }, () => {
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
            window.close();
          }, 600);
        });
      } else {
        if (updateMsg) updateMsg.innerHTML = '⚡ Recargando extensión en Chrome...';
        chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
        setTimeout(() => window.close(), 600);
      }
    });
  }

  // 4. Botón Recargar
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      reloadBtn.disabled = true;
      if (updateMsg) updateMsg.innerHTML = '⚡ Recargando extensión y YouTube Music...';
      chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
      setTimeout(() => window.close(), 500);
    });
  }

  // 5. Cargar estado de temas
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['auramusic_settings'], (result) => {
      if (result && result.auramusic_settings) {
        const theme = result.auramusic_settings.theme || 'apple';
        themeBtns.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.theme === theme);
        });
      }
    });
  }

  // 6. Cambiar tema
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selected = btn.dataset.theme;
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['auramusic_settings'], (res) => {
          const current = (res && res.auramusic_settings) || {};
          current.theme = selected;
          chrome.storage.local.set({ auramusic_settings: current }, () => {
            chrome.tabs.query({ url: '*://music.youtube.com/*' }, (tabs) => {
              tabs.forEach(tab => {
                chrome.scripting?.executeScript({
                  target: { tabId: tab.id },
                  func: (th, themes) => {
                    document.body.classList.remove(...themes);
                    if (th !== 'default') document.body.classList.add(`auramusic-theme-${th}`);
                  },
                  args: [selected, allThemes]
                }).catch(() => {});
              });
            });
          });
        });
      }
    });
  });
});
