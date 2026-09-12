// AuraMusic Background Service Worker
// Administra el documento de audio Offscreen y la recarga en caliente sin tocar chrome://extensions

let creatingOffscreenPromise = null;

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument?.()) {
    return true;
  }
  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return true;
  }
  try {
    creatingOffscreenPromise = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Reproducción simultánea de audio de la siguiente canción para crossfade sin restricciones de autoplay'
    });
    await creatingOffscreenPromise;
    creatingOffscreenPromise = null;
    return true;
  } catch (err) {
    creatingOffscreenPromise = null;
    if (err.message && err.message.includes('Only a single offscreen document')) {
      return true;
    }
    console.warn('AuraMusic: Warning al crear offscreen document:', err);
    return false;
  }
}

// Al instalarse, actualizarse o recargarse la extensión
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('✨ AuraMusic Service Worker iniciado:', details.reason);
  try {
    const data = await chrome.storage.local.get(['auramusic_reload_tabs', 'auramusic_just_updated']);
    if (data && (data.auramusic_reload_tabs || data.auramusic_just_updated)) {
      await chrome.storage.local.set({ auramusic_reload_tabs: false });
      // Recargar limpiamente las pestañas de YouTube Music con la nueva versión cargada
      setTimeout(() => {
        chrome.tabs.query({ url: "*://music.youtube.com/*" }, (tabs) => {
          if (tabs && tabs.length > 0) {
            tabs.forEach(t => {
              try { chrome.tabs.reload(t.id); } catch (_) {}
            });
          }
        });
      }, 400);
    }
  } catch (_) {}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_DJ_STUDIO') {
    const url = chrome.runtime.getURL('dj-studio.html');
    chrome.tabs.create({ url });
    sendResponse({ status: 'opened' });
    return true;
  }

  // Recarga en caliente la extensión sin necesidad de ir a chrome://extensions
  if (message.action === 'RELOAD_EXTENSION') {
    sendResponse({ status: 'reloading' });
    chrome.storage.local.set({ auramusic_reload_tabs: true }, () => {
      setTimeout(() => {
        chrome.runtime.reload();
      }, 150);
    });
    return true;
  }

  if (message.target === 'background') {
    if (message.action === 'ENSURE_OFFSCREEN') {
      ensureOffscreenDocument().then((ok) => sendResponse({ status: ok ? 'ready' : 'error' }));
      return true;
    }
  }

  // Reenviar mensajes dirigidos al reproductor offscreen
  if (message.target === 'offscreen') {
    ensureOffscreenDocument().then(() => {
      chrome.runtime.sendMessage(message).catch(() => {});
    });
    sendResponse({ status: 'forwarded' });
    return true;
  }
});
