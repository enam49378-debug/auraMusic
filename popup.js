document.addEventListener('DOMContentLoaded', () => {
  const themeBtns = document.querySelectorAll('.theme-btn');

  // Cargar estado
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['auramusic_settings'], (result) => {
      if (result && result.auramusic_settings) {
        const theme = result.auramusic_settings.theme || 'oled';
        themeBtns.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.theme === theme);
        });
      }
    });
  }

  // Cambiar tema
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
            // Notificar pestaña activa de YouTube Music
            chrome.tabs.query({ url: '*://music.youtube.com/*' }, (tabs) => {
              tabs.forEach(tab => {
                chrome.scripting?.executeScript({
                  target: { tabId: tab.id },
                  func: (th) => {
                    document.body.classList.remove(
                      'auramusic-theme-oled',
                      'auramusic-theme-cyberpunk',
                      'auramusic-theme-glass',
                      'auramusic-theme-dynamic'
                    );
                    if (th !== 'default') document.body.classList.add(`auramusic-theme-${th}`);
                  },
                  args: [selected]
                }).catch(() => {});
              });
            });
          });
        });
      }
    });
  });
});
