// AuraMusic Background Service Worker
// Administra el documento de audio Offscreen para reproducción simultánea sin bloqueos de Autoplay

async function ensureOffscreenDocument() {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length > 0) return true;

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Reproducción simultánea de audio de la siguiente canción para crossfade sin restricciones de autoplay'
    });
    return true;
  } catch (e) {
    console.warn('AuraMusic: Error al crear offscreen document:', e);
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
