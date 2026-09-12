// AuraMusic Background Service Worker
// Administra el documento de audio Offscreen para reproducción simultánea sin bloqueos de Autoplay

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_DJ_STUDIO') {
    const url = chrome.runtime.getURL('dj-studio.html');
    chrome.tabs.create({ url });
    sendResponse({ status: 'opened' });
    return true;
  }

  if (message.action === 'RELOAD_EXTENSION') {
    sendResponse({ status: 'reloading' });
    setTimeout(() => {
      chrome.runtime.reload();
    }, 150);
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
