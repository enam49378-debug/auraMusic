/**
 * AuraMusic - Módulo de Iluminación Ambiental Dinámica
 */
window.AuraMusic = window.AuraMusic || {};

(function() {
  'use strict';

  function getState() {
    return window.AuraMusic?.state || window.state || {};
  }

  // --- ILUMINACIÓN AMBIENTAL DINÁMICA ---
  function initAmbientGlow() {
    if (document.getElementById('auramusic-ambient-glow')) return;

    const ambientDiv = document.createElement('div');
    ambientDiv.id = 'auramusic-ambient-glow';
    ambientDiv.innerHTML = `
      <div class="auramusic-glow-layer" id="auramusic-glow-1"></div>
      <div class="auramusic-glow-layer" id="auramusic-glow-2"></div>
    `;
    document.body.appendChild(ambientDiv);
  }

  function applyAmbientGlow(enabled) {
    const state = getState();
    state.ambientGlow = !!enabled;
    const el = document.getElementById('auramusic-ambient-glow');
    if (!el && enabled) {
      initAmbientGlow();
    }
    const currentEl = document.getElementById('auramusic-ambient-glow');
    if (currentEl) {
      currentEl.style.display = enabled ? 'block' : 'none';
      if (enabled) updateAmbientGlowColor();
    }
  }

  let lastAnalyzedCoverSrc = '';

  function updateAmbientGlowColor() {
    const state = getState();
    const isCinemaActive = !!document.getElementById('auramusic-cinema-overlay')?.classList.contains('active');
    if (!state.ambientGlow && !isCinemaActive) return;

    const img = document.querySelector('#cinema-art-img, ytmusic-player-bar .image, #song-image img');
    if (!img || !img.src) return;
    if (img.src === lastAnalyzedCoverSrc) return; // Evitar recalcular la misma portada repetidamente
    lastAnalyzedCoverSrc = img.src;

    const tempImg = new Image();
    tempImg.crossOrigin = 'Anonymous';
    tempImg.src = img.src;

    tempImg.onload = function () {
      try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 16;
        offCanvas.height = 16;
        const oCtx = offCanvas.getContext('2d');
        oCtx.drawImage(tempImg, 0, 0, 16, 16);
        const data = oCtx.getImageData(0, 0, 16, 16).data;

        const validPixels = [];
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 120) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const lum = (max + min) / 2;

          // Descartar negros profundos, blancos lavados y grises neutros
          if (max < 35 || lum < 20 || lum > 240) continue;
          if (delta < 18) continue; // Poca saturación

          // Calcular vivacidad estilo Apple Music
          const saturation = delta / (lum > 127 ? (510 - max - min) : (max + min));
          const score = saturation * 2.0 + (1.0 - Math.abs(lum - 128) / 128);

          validPixels.push({ r, g, b, score, lum, saturation });
        }

        let primaryHex = '#00f2fe';
        let secondaryHex = '#ff2d78';

        if (validPixels.length > 0) {
          // Ordenar por vivacidad y saturación
          validPixels.sort((a, b) => b.score - a.score);

          // Color principal: el pixel más vibrante y saturado de la portada
          const top = validPixels[0];
          // Elevar luminosidad a rango óptimo para modo oscuro (45% - 65%)
          const pR = Math.min(255, Math.max(40, Math.floor(top.r * 1.35)));
          const pG = Math.min(255, Math.max(40, Math.floor(top.g * 1.35)));
          const pB = Math.min(255, Math.max(40, Math.floor(top.b * 1.35)));
          primaryHex = `#${((1 << 24) + (pR << 16) + (pG << 8) + pB).toString(16).slice(1)}`;

          // Buscar un color secundario con matiz armónico diferente
          const second = validPixels.find(p => {
            const dist = Math.abs(p.r - top.r) + Math.abs(p.g - top.g) + Math.abs(p.b - top.b);
            return dist > 100;
          });

          if (second) {
            const sR = Math.min(255, Math.max(40, Math.floor(second.r * 1.35)));
            const sG = Math.min(255, Math.max(40, Math.floor(second.g * 1.35)));
            const sB = Math.min(255, Math.max(40, Math.floor(second.b * 1.35)));
            secondaryHex = `#${((1 << 24) + (sR << 16) + (sG << 8) + sB).toString(16).slice(1)}`;
          } else {
            // Generar color complementario luminoso
            secondaryHex = `#${((1 << 24) + (pB << 16) + (pR << 8) + pG).toString(16).slice(1)}`;
          }
        }

        document.documentElement.style.setProperty('--auramusic-ambient-color', primaryHex);
        document.documentElement.style.setProperty('--auramusic-secondary', secondaryHex);

        const glow1 = document.getElementById('auramusic-glow-1');
        const glow2 = document.getElementById('auramusic-glow-2');
        if (glow1) glow1.style.background = `radial-gradient(circle, ${primaryHex} 0%, transparent 70%)`;
        if (glow2) glow2.style.background = `radial-gradient(circle, ${secondaryHex} 0%, transparent 70%)`;
      } catch (e) {}
    };
  }

  window.AuraMusic.Ambient = {
    initAmbientGlow,
    applyAmbientGlow,
    updateAmbientGlowColor
  };
})();
