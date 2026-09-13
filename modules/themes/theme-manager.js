/**
 * AuraMusic - Gestor Modular de Diseños y Temas
 * Carga dinámica desde /diseños/<tema>/ y activación de animaciones (Sakura, 3D Blockbench).
 */
window.AuraMusic = window.AuraMusic || {};

(function() {
  'use strict';

  function getState() {
    return window.AuraMusic?.state || window.state || {};
  }

  const ALL_THEMES = [
    'auramusic-theme-auramusic',
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

  const MODULAR_THEMES = ['jesuluto', 'komi', 'minecraft', 'spotify', 'whatsapp'];

  function applyTheme(themeName) {
    const state = getState();
    state.theme = themeName || 'default';

    // 1. Aplicar clase en document.body
    document.body.classList.remove(...ALL_THEMES);
    if (themeName && themeName !== 'default') {
      document.body.classList.add(`auramusic-theme-${themeName}`);
    }

    if (state.primaryColor) {
      document.documentElement.style.setProperty('--auramusic-primary', state.primaryColor);
    }

    // 2. Carga de hoja de estilo modular desde /diseños/<tema>/theme.css si existe
    ensureModularThemeStylesheet(themeName);

    // 3. Sincronizar estilos directos en el Shadow DOM del reproductor
    updateSliderShadowDom(themeName);

    // 4. Activación temática específica
    if (themeName === 'jesuluto') {
      const jStage = document.getElementById('jesuluto-3d-stage');
      if (jStage) jStage.style.setProperty('display', 'flex', 'important');
      setTimeout(initJesuluto3D, 50);
    } else {
      destroyJesuluto3D();
      const jStage = document.getElementById('jesuluto-3d-stage');
      if (jStage) jStage.style.setProperty('display', 'none', 'important');
    }

    if (themeName === 'komi') {
      initKomiSakura();
    } else {
      destroyKomiSakura();
    }

    if (themeName === 'aesthetic') {
      initAestheticSparkles();
    } else {
      destroyAestheticSparkles();
    }

    if (themeName === 'spotify') {
      updateSpotifyBrandElements();
    } else {
      removeSpotifyBrandElements();
    }
  }

  function ensureModularThemeStylesheet(themeName) {
    let link = document.getElementById('auramusic-modular-theme-link');
    if (!themeName || themeName === 'default' || !MODULAR_THEMES.includes(themeName)) {
      if (link) link.remove();
      return;
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        const themeCssUrl = chrome.runtime.getURL(`diseños/${themeName}/theme.css`);
        if (!link) {
          link = document.createElement('link');
          link.id = 'auramusic-modular-theme-link';
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }
        link.href = themeCssUrl;
      }
    } catch(e) {}
  }

  // --- ENHANCER KOMI-SAN: PÉTALOS DE SAKURA (Puro CSS y partículas limpias) ---
  function initKomiSakura() {
    if (!document.getElementById('komi-sakura-container')) {
      const container = document.createElement('div');
      container.id = 'komi-sakura-container';
      container.className = 'komi-sakura-container';

      for (let i = 0; i < 18; i++) {
        const petal = document.createElement('div');
        petal.className = 'komi-petal';
        const size = 10 + Math.floor(Math.random() * 8);
        petal.style.width = `${size}px`;
        petal.style.height = `${Math.floor(size * 1.35)}px`;
        petal.style.left = `${Math.random() * 100}vw`;
        petal.style.animationDuration = `${8 + Math.random() * 8}s`;
        petal.style.animationDelay = `${Math.random() * 7}s`;
        container.appendChild(petal);
      }
      document.body.appendChild(container);
    }
  }

  function destroyKomiSakura() {
    const container = document.getElementById('komi-sakura-container');
    if (container) container.remove();
  }

  // --- ENHANCER AESTHETIC: DESTELLOS Y BURBUJAS PASTEL FLOTANTES ---
  function initAestheticSparkles() {
    if (!document.getElementById('aesthetic-sparkles-container')) {
      const container = document.createElement('div');
      container.id = 'aesthetic-sparkles-container';
      container.className = 'aesthetic-sparkles-container';

      const colors = ['#ff8fa3', '#c77dff', '#ffccd5', '#e0aaff', '#ffd6e0'];
      const symbols = ['✦', '✧', '★', '∘', '･', '⋆'];

      for (let i = 0; i < 24; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'aesthetic-sparkle';
        const isSymbol = Math.random() > 0.45;
        if (isSymbol) {
          sparkle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
          sparkle.style.fontSize = `${13 + Math.floor(Math.random() * 14)}px`;
          sparkle.style.color = colors[Math.floor(Math.random() * colors.length)];
        } else {
          const size = 6 + Math.floor(Math.random() * 8);
          sparkle.style.width = `${size}px`;
          sparkle.style.height = `${size}px`;
          sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
        }
        sparkle.style.left = `${Math.random() * 100}vw`;
        sparkle.style.animationDuration = `${9 + Math.random() * 9}s`;
        sparkle.style.animationDelay = `${Math.random() * 8}s`;
        container.appendChild(sparkle);
      }
      document.body.appendChild(container);
    }
  }

  function destroyAestheticSparkles() {
    const container = document.getElementById('aesthetic-sparkles-container');
    if (container) container.remove();
  }

  // --- CONTROL DIRECTO Y VISIBILIDAD GARANTIZADA DEL REPRODUCTOR EN SHADOW DOM ---
  function getProgressShadowCss(theme) {
    let containerBg = 'rgba(255, 255, 255, 0.25)';
    let containerBorder = 'none';
    let containerShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.4)';
    let primaryBg = 'var(--auramusic-primary, #00e5ff)';
    let primaryGlow = '0 0 14px var(--auramusic-primary, #00e5ff)';
    let secondaryBg = 'rgba(255, 255, 255, 0.35)';
    let borderRadius = '999px';
    let extraAnimation = '';

    switch (theme) {
      case 'aesthetic':
        containerBg = 'rgba(255, 255, 255, 0.32)';
        containerBorder = '1px solid rgba(255, 143, 163, 0.45)';
        containerShadow = 'inset 0 1px 4px rgba(0, 0, 0, 0.45), 0 0 10px rgba(255, 143, 163, 0.3)';
        primaryBg = 'linear-gradient(90deg, #ff8fa3 0%, #c77dff 50%, #70d6ff 100%)';
        primaryGlow = '0 0 18px rgba(255, 143, 163, 1), 0 0 30px rgba(199, 125, 255, 0.85)';
        secondaryBg = 'rgba(199, 125, 255, 0.45)';
        borderRadius = '999px';
        extraAnimation = `
          @keyframes aestheticPrimaryGlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          #primaryProgress {
            background-size: 200% 100% !important;
            animation: aestheticPrimaryGlow 4s linear infinite !important;
          }
        `;
        break;

      case 'minecraft':
        containerBg = '#1e1e1e';
        containerBorder = '2px solid #000000';
        containerShadow = 'inset 2px 2px 0 #111111, inset -2px -2px 0 #333333';
        primaryBg = '#55ff55';
        primaryGlow = 'inset 0 2px 0 #aaffaa, inset 0 -2px 0 #00aa00, 0 0 12px rgba(85, 255, 85, 0.8)';
        secondaryBg = '#2e552e';
        borderRadius = '0px';
        break;

      case 'cyberpunk':
        containerBg = 'rgba(0, 245, 255, 0.22)';
        containerBorder = '1px solid rgba(0, 245, 255, 0.5)';
        containerShadow = 'inset 0 0 8px rgba(0, 245, 255, 0.3)';
        primaryBg = 'linear-gradient(90deg, #ff2d78 0%, #a855f7 50%, #00f5ff 100%)';
        primaryGlow = '0 0 20px #00f5ff, 0 0 30px rgba(255, 45, 120, 0.8)';
        secondaryBg = 'rgba(255, 45, 120, 0.35)';
        borderRadius = '3px';
        break;

      case 'spotify':
        containerBg = '#404040';
        containerBorder = 'none';
        containerShadow = 'none';
        primaryBg = '#1ed760';
        primaryGlow = '0 0 14px rgba(30, 215, 96, 0.75)';
        secondaryBg = 'rgba(255, 255, 255, 0.25)';
        borderRadius = '999px';
        break;

      case 'whatsapp':
        containerBg = 'rgba(255, 255, 255, 0.25)';
        containerBorder = '1px solid rgba(0, 168, 132, 0.3)';
        containerShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.3)';
        primaryBg = 'linear-gradient(90deg, #00a884, #25d366)';
        primaryGlow = '0 0 14px rgba(0, 168, 132, 0.9)';
        secondaryBg = 'rgba(0, 168, 132, 0.35)';
        borderRadius = '999px';
        break;

      case 'apple':
        containerBg = 'rgba(255, 255, 255, 0.22)';
        containerBorder = '1px solid rgba(255, 255, 255, 0.15)';
        containerShadow = 'inset 0 1px 2px rgba(0, 0, 0, 0.3)';
        primaryBg = 'linear-gradient(90deg, #fc3c44, #ff2d55)';
        primaryGlow = '0 0 16px rgba(252, 60, 68, 0.85)';
        secondaryBg = 'rgba(255, 255, 255, 0.4)';
        borderRadius = '999px';
        break;

      case 'oled':
        containerBg = '#111111';
        containerBorder = '1px solid rgba(0, 229, 255, 0.3)';
        containerShadow = '0 0 8px rgba(0, 229, 255, 0.15)';
        primaryBg = '#00e5ff';
        primaryGlow = '0 0 20px #00e5ff, 0 0 35px rgba(0, 229, 255, 0.7)';
        secondaryBg = '#222222';
        borderRadius = '999px';
        break;

      case 'komi':
        containerBg = 'rgba(203, 180, 228, 0.38)';
        containerBorder = '1px solid rgba(255, 141, 176, 0.4)';
        containerShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.3)';
        primaryBg = 'linear-gradient(90deg, #ff8db0, #c084fc)';
        primaryGlow = '0 0 16px rgba(255, 141, 176, 0.9)';
        secondaryBg = 'rgba(255, 141, 176, 0.35)';
        borderRadius = '999px';
        break;

      case 'jesuluto':
        containerBg = 'rgba(0, 255, 119, 0.18)';
        containerBorder = '1px solid rgba(0, 255, 119, 0.35)';
        containerShadow = '0 0 10px rgba(0, 255, 119, 0.2)';
        primaryBg = 'linear-gradient(90deg, #00ff77, #00e5ff)';
        primaryGlow = '0 0 18px #00ff77, 0 0 28px rgba(0, 255, 119, 0.6)';
        secondaryBg = 'rgba(0, 255, 119, 0.3)';
        borderRadius = '4px';
        break;

      default:
        containerBg = 'rgba(255, 255, 255, 0.25)';
        primaryBg = '#ff0000';
        primaryGlow = '0 0 16px rgba(255, 0, 0, 0.9)';
        secondaryBg = 'rgba(255, 255, 255, 0.35)';
        borderRadius = '999px';
        break;
    }

    return `
      :host {
        height: 8px !important;
        display: block !important;
      }
      #progressContainer {
        height: 8px !important;
        background: ${containerBg} !important;
        border: ${containerBorder} !important;
        box-shadow: ${containerShadow} !important;
        border-radius: ${borderRadius} !important;
        overflow: hidden !important;
      }
      #primaryProgress {
        height: 8px !important;
        background: ${primaryBg} !important;
        box-shadow: ${primaryGlow} !important;
        border-radius: ${borderRadius} !important;
        transition: width 0.1s linear !important;
      }
      #secondaryProgress {
        height: 8px !important;
        background: ${secondaryBg} !important;
        border-radius: ${borderRadius} !important;
      }
      ${extraAnimation}
    `;
  }

  function getSliderShadowCss(theme) {
    let knobStyles = '';

    switch (theme) {
      case 'auramusic':
        knobStyles = `
          width: 22px !important;
          height: 22px !important;
          min-width: 22px !important;
          min-height: 22px !important;
          border-radius: 50% !important;
          background: #ffffff !important;
          border: 3.5px solid #00e5ff !important;
          box-shadow: 0 0 18px #00e5ff, 0 0 32px rgba(189, 0, 255, 0.95), 0 2px 8px rgba(0, 0, 0, 0.6) !important;
          transform: scale(1) !important;
        `;
        break;

      case 'aesthetic':
        knobStyles = `
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          border-radius: 50% !important;
          background: #ffffff !important;
          border: 3.5px solid #ff8fa3 !important;
          box-shadow: 0 0 16px rgba(255, 143, 163, 1), 0 0 28px rgba(199, 125, 255, 0.95), 0 2px 6px rgba(0, 0, 0, 0.5) !important;
          transform: scale(1) !important;
        `;
        break;

      case 'minecraft':
        knobStyles = `
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          border-radius: 0px !important;
          background: #ffff55 !important;
          border: 2px solid #000000 !important;
          box-shadow: inset 2px 2px 0 #ffffff, inset -2px -2px 0 #aa5500, 0 0 16px rgba(255, 255, 85, 0.95) !important;
          image-rendering: pixelated !important;
          transform: scale(1) !important;
        `;
        break;

      case 'cyberpunk':
        knobStyles = `
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          border-radius: 2px !important;
          background: #00f5ff !important;
          border: 2.5px solid #ff2d78 !important;
          box-shadow: 0 0 20px #00f5ff, 0 0 32px #ff2d78 !important;
          transform: rotate(45deg) scale(1) !important;
        `;
        break;

      case 'spotify':
        knobStyles = `
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          border-radius: 50% !important;
          background: #ffffff !important;
          border: 3px solid #1ed760 !important;
          box-shadow: 0 0 14px rgba(30, 215, 96, 0.9), 0 2px 8px rgba(0, 0, 0, 0.6) !important;
          transform: scale(1) !important;
        `;
        break;

      case 'whatsapp':
        knobStyles = `
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          border-radius: 50% !important;
          background: #00a884 !important;
          border: 3.5px solid #ffffff !important;
          box-shadow: 0 0 18px rgba(0, 168, 132, 0.95), 0 2px 8px rgba(0, 0, 0, 0.5) !important;
          transform: scale(1) !important;
        `;
        break;

      case 'apple':
        knobStyles = `
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          border-radius: 50% !important;
          background: #ffffff !important;
          border: 3.5px solid #fc3c44 !important;
          box-shadow: 0 0 18px rgba(252, 60, 68, 0.9), 0 3px 10px rgba(0, 0, 0, 0.5) !important;
          transform: scale(1) !important;
        `;
        break;

      case 'oled':
        knobStyles = `
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          border-radius: 50% !important;
          background: #000000 !important;
          border: 3.5px solid #00e5ff !important;
          box-shadow: 0 0 20px #00e5ff, 0 0 35px rgba(0, 229, 255, 0.7) !important;
          transform: scale(1) !important;
        `;
        break;

      case 'jesuluto':
        knobStyles = `
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          border-radius: 50% !important;
          background: #00ff77 !important;
          border: 3px solid #ffffff !important;
          box-shadow: 0 0 20px #00ff77, 0 0 35px rgba(0, 255, 119, 0.8) !important;
          transform: scale(1) !important;
        `;
        break;

      case 'komi':
        knobStyles = `
          width: 26px !important;
          height: 26px !important;
          min-width: 26px !important;
          min-height: 26px !important;
          border-radius: 0px !important;
          border: none !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none'%3E%3Cpath d='M 6 12 L 3 3 L 12 6 C 13.5 5.5 18.5 5.5 20 6 L 29 3 L 26 12 C 29 16 29 22 26 26 C 22 30 10 30 6 26 C 3 22 3 16 6 12 Z' fill='%23ffffff' stroke='%23181820' stroke-width='2.2' stroke-linejoin='round' stroke-linecap='round'/%3E%3Cpolygon points='6,10 5,5 10,7' fill='%23f8b6cf'/%3E%3Cpolygon points='26,10 27,5 22,7' fill='%23f8b6cf'/%3E%3Cellipse cx='11' cy='17' rx='1.8' ry='2.2' fill='%23181820'/%3E%3Cellipse cx='21' cy='17' rx='1.8' ry='2.2' fill='%23181820'/%3E%3Cpolygon points='16,19 14.8,17.8 17.2,17.8' fill='%23f8b6cf'/%3E%3Cpath d='M 14.5 20 C 15 21 16 21 16 20 C 16 21 17 21 17.5 20' stroke='%23181820' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E") !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          background-size: contain !important;
          filter: drop-shadow(0 2px 8px rgba(255, 141, 176, 0.95)) !important;
          transform: scale(1.2) !important;
        `;
        break;

      default:
        knobStyles = `
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          min-height: 20px !important;
          border-radius: 50% !important;
          background: #ff0000 !important;
          border: 3.5px solid #ffffff !important;
          box-shadow: 0 0 18px rgba(255, 0, 0, 1), 0 2px 8px rgba(0, 0, 0, 0.5) !important;
          transform: scale(1) !important;
        `;
        break;
    }

    return `
      :host {
        overflow: visible !important;
        height: 24px !important;
      }
      #sliderContainer {
        height: 24px !important;
        margin: 0 !important;
        padding: 0 10px !important;
        overflow: visible !important;
      }
      #sliderBar {
        height: 8px !important;
        border-radius: 999px !important;
        overflow: hidden !important;
      }
      #sliderKnob {
        width: 32px !important;
        height: 32px !important;
        top: 50% !important;
        margin-top: -16px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        overflow: visible !important;
      }
      #sliderKnobInner,
      #sliderKnobInner.tp-yt-paper-slider,
      :host #sliderKnobInner,
      :host:not([dragging]):not(:hover) #sliderKnobInner,
      :host:not([dragging]):not(:hover) #sliderKnobInner.tp-yt-paper-slider,
      #sliderKnob.ring > #sliderKnobInner,
      :host([pin]) #sliderKnobInner,
      :host([disabled]) #sliderKnobInner {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        margin: 0 auto !important;
        cursor: grab !important;
        box-sizing: border-box !important;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease !important;
        ${knobStyles}
      }
      :host(:hover) #sliderKnobInner,
      :host([dragging]) #sliderKnobInner,
      #sliderKnob:hover #sliderKnobInner {
        ${theme === 'cyberpunk' ? 'transform: rotate(45deg) scale(1.4) !important;' : (theme === 'komi' ? 'transform: scale(1.55) rotate(6deg) !important;' : 'transform: scale(1.4) !important;')}
        cursor: grabbing !important;
      }
    `;
  }

  function getAllSliders() {
    const sliders = new Set();
    function scan(root) {
      if (!root) return;
      try {
        const found = root.querySelectorAll('#progress-bar, tp-yt-paper-slider#progress-bar, ytmusic-player-bar tp-yt-paper-slider, #volume-slider tp-yt-paper-slider, tp-yt-paper-slider');
        found.forEach(s => sliders.add(s));
      } catch (e) {}

      try {
        const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
        for (let i = 0; i < allElements.length; i++) {
          if (allElements[i].shadowRoot) {
            scan(allElements[i].shadowRoot);
          }
        }
      } catch (e) {}
    }

    scan(document);
    return Array.from(sliders);
  }

  function updateSliderShadowDom(themeName) {
    const theme = themeName || getState().theme || 'default';
    const sliders = getAllSliders();

    sliders.forEach(slider => {
      // 1. Asignar variables CSS en el host para componentes Polymer nativos
      slider.style.setProperty('--paper-slider-height', '8px', 'important');
      slider.style.setProperty('--paper-progress-height', '8px', 'important');
      slider.style.setProperty('--paper-slider-knob-size', '24px', 'important');
      slider.style.setProperty('--paper-slider-knob-start-size', '24px', 'important');

      if (!slider || !slider.shadowRoot) return;

      // 2. Inyectar/actualizar estilo en tp-yt-paper-slider
      let style = slider.shadowRoot.getElementById('auramusic-slider-shadow-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'auramusic-slider-shadow-style';
        style.dataset.theme = theme;
        style.textContent = getSliderShadowCss(theme);
        slider.shadowRoot.appendChild(style);
      } else if (style.dataset.theme !== theme) {
        style.dataset.theme = theme;
        style.textContent = getSliderShadowCss(theme);
      }

      // 3. Inyectar/actualizar estilo en el sub-componente tp-yt-paper-progress (#sliderBar)
      const sliderBar = slider.shadowRoot.querySelector('#sliderBar, tp-yt-paper-progress');
      if (sliderBar && sliderBar.shadowRoot) {
        sliderBar.style.setProperty('--paper-progress-height', '8px', 'important');
        let barStyle = sliderBar.shadowRoot.getElementById('auramusic-progress-shadow-style');
        if (!barStyle) {
          barStyle = document.createElement('style');
          barStyle.id = 'auramusic-progress-shadow-style';
          barStyle.dataset.theme = theme;
          barStyle.textContent = getProgressShadowCss(theme);
          sliderBar.shadowRoot.appendChild(barStyle);
        } else if (barStyle.dataset.theme !== theme) {
          barStyle.dataset.theme = theme;
          barStyle.textContent = getProgressShadowCss(theme);
        }
      }
    });
  }

  // Vigilante periódico de bajo impacto y eventos para mantener los estilos de Shadow DOM siempre activos
  setInterval(() => {
    const curTheme = getState().theme || 'default';
    updateSliderShadowDom(curTheme);
  }, 1200);

  document.addEventListener('auramusic-track-change', () => {
    const curTheme = getState().theme || 'default';
    setTimeout(() => updateSliderShadowDom(curTheme), 200);
    setTimeout(() => updateSliderShadowDom(curTheme), 800);
  });

  // --- INYECCIÓN DE ELEMENTOS OFICIALES DE SPOTIFY (LOGO, BOTÓN HOME, PLACEHOLDER) ---
  function updateSpotifyBrandElements() {
    const state = getState();
    const isSpotify = state.theme === 'spotify';

    // 1. Buscador: Cambiar placeholder a "¿Qué quieres reproducir?"
    const searchInput = document.querySelector('ytmusic-search-box input, input#input');
    if (searchInput) {
      if (isSpotify && !searchInput.dataset.originalPlaceholder) {
        searchInput.dataset.originalPlaceholder = searchInput.placeholder;
        searchInput.placeholder = '¿Qué quieres reproducir?';
      } else if (!isSpotify && searchInput.dataset.originalPlaceholder) {
        searchInput.placeholder = searchInput.dataset.originalPlaceholder;
        delete searchInput.dataset.originalPlaceholder;
      }
    }

    // 2. Botón Home (🏠) en barra superior
    const searchBox = document.querySelector('ytmusic-search-box');
    if (searchBox) {
      let homeBtn = document.getElementById('auramusic-spotify-home-btn');
      if (isSpotify && !homeBtn) {
        homeBtn = document.createElement('button');
        homeBtn.id = 'auramusic-spotify-home-btn';
        homeBtn.title = 'Inicio';
        homeBtn.innerHTML = '🏠';
        homeBtn.addEventListener('click', () => {
          const homeNav = document.querySelector('ytmusic-guide-entry-renderer:first-child a');
          if (homeNav) homeNav.click();
        });
        searchBox.parentNode.insertBefore(homeBtn, searchBox);
      } else if (!isSpotify && homeBtn) {
        homeBtn.remove();
      }
    }

    // 3. Reemplazo del logo por el de Spotify
    const logoContainer = document.querySelector('ytmusic-nav-bar #logo');
    if (logoContainer) {
      let spotLogo = document.getElementById('auramusic-spotify-logo');
      if (isSpotify && !spotLogo) {
        spotLogo = document.createElement('div');
        spotLogo.id = 'auramusic-spotify-logo';
        spotLogo.className = 'auramusic-spotify-brand-logo';
        spotLogo.innerHTML = `
          <svg width="34" height="34" viewBox="0 0 24 24" fill="#1ed760">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.467-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.112.294.18.386.563.207.857zm1.224-2.72c-.226.368-.71.485-1.077.26-2.69-1.654-6.79-2.134-9.97-1.168-.413.125-.852-.108-.977-.52-.125-.413.108-.852.52-.977 3.633-1.103 8.147-.568 11.244 1.328.368.226.485.71.26 1.077zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.128-1.168-.622-.15-.494.128-1.018.622-1.168 3.532-1.072 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z"/>
          </svg>
          <span style="font-weight: 800; font-size: 1.2rem; color: #ffffff; letter-spacing: -0.04em;">Spotify</span>
        `;
        logoContainer.style.display = 'flex';
        logoContainer.style.alignItems = 'center';
        logoContainer.appendChild(spotLogo);
        const originalSvg = logoContainer.querySelector('g#youtube-music-logo, yt-icon, #logo-icon');
        if (originalSvg) originalSvg.style.display = 'none';
      } else if (!isSpotify && spotLogo) {
        spotLogo.remove();
        const originalSvg = logoContainer.querySelector('g#youtube-music-logo, yt-icon, #logo-icon');
        if (originalSvg) originalSvg.style.display = '';
      }
    }
  }

  function removeSpotifyBrandElements() {
    const searchInput = document.querySelector('ytmusic-search-box input, input#input');
    if (searchInput && searchInput.dataset.originalPlaceholder) {
      searchInput.placeholder = searchInput.dataset.originalPlaceholder;
      delete searchInput.dataset.originalPlaceholder;
    }
    const homeBtn = document.getElementById('auramusic-spotify-home-btn');
    if (homeBtn) homeBtn.remove();
    const spotLogo = document.getElementById('auramusic-spotify-logo');
    if (spotLogo) {
      spotLogo.remove();
      const logoContainer = document.querySelector('ytmusic-nav-bar #logo');
      if (logoContainer) {
        const originalSvg = logoContainer.querySelector('g#youtube-music-logo, yt-icon, #logo-icon');
        if (originalSvg) originalSvg.style.display = '';
      }
    }
  }

  // ==========================================================================
  // ⚡ MOTOR 3D BLOCKBENCH V2: RIG COMPLETO (12 CUBOS + CAPAS 3D + SKINS CUSTOM)
  // ==========================================================================
  const JESULUTO_DANCE_DATA = {"transform_overlay2": [{"tick": 60.0, "r": [0.0, 0.0, 0.17453294], "t": [0.0, 0.0, 0.0]}, {"tick": 63.0, "r": [0.0, 0.0, 0.17453294], "t": [0.0, 0.0, 0.0]}, {"tick": 65.0, "r": [0.0, 0.0, 0.06981318], "t": [0.0, 0.0, 0.0]}, {"tick": 67.0, "r": [0.0, 0.0, -0.08726645], "t": [0.0, 0.03125, 0.0]}, {"tick": 71.0, "r": [0.0, 0.0, -0.08726645], "t": [0.0, 0.0, 0.0]}, {"tick": 74.0, "r": [0.0, 0.0, 0.0], "t": [-0.03125, 0.0, 0.0]}, {"tick": 77.0, "r": [0.0, 0.0, 0.13962635], "t": [-0.03125, 0.0, 0.0]}, {"tick": 80.0, "r": [0.0, 0.0, 0.13962635], "t": [-0.03125, 0.0, 0.0]}, {"tick": 83.0, "r": [0.0, 0.0, 0.13962635], "t": [-0.03125, 0.0, 0.0]}, {"tick": 86.0, "r": [0.0, 0.0, 0.13962635], "t": [-0.03125, 0.0, 0.0]}, {"tick": 89.0, "r": [0.0, 0.0, -0.03490657], "t": [-0.03125, 0.0, 0.0]}, {"tick": 101.0, "r": [0.0, 0.0, -0.03490657], "t": [-0.03125, 0.0, 0.0]}], "pose:low_body": [{"tick": 60.0, "r": [0.0, 0.0, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 64.0, "r": [0.104719765, -0.13962635, -0.104719765], "t": [0.0, -0.9375, 0.0]}, {"tick": 67.0, "r": [0.0, -0.13962635, -0.052359886], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [0.0, 0.2094395, 0.06981316], "t": [0.875, 0.0, 0.0]}, {"tick": 74.0, "r": [0.0, 0.0, 0.0], "t": [0.0, -0.6875, 0.0]}, {"tick": 80.0, "r": [0.0, 0.0, 0.0], "t": [-0.8125, -0.75, 0.0]}, {"tick": 83.0, "r": [-0.122173056, -0.15707964, -0.15707964], "t": [-0.8125, -0.5, 0.0]}, {"tick": 86.0, "r": [0.0, -0.052359883, 0.052359883], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [0.0, 0.104719765, 0.052359883], "t": [0.21875, -0.625, 0.0]}, {"tick": 92.0, "r": [0.0, 0.104719765, 0.052359883], "t": [0.21875, 0.0, 0.0]}, {"tick": 95.0, "r": [-0.06981318, 0.22689281, 0.052359883], "t": [0.21875, -0.78125, 0.0]}, {"tick": 98.0, "r": [0.0, 0.15707964, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [0.0, 0.03490659, -0.122173056], "t": [0.0, 0.0, 0.0]}], "pose:torso": [{"tick": 60.0, "r": [0.0, 0.0, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 63.0, "r": [0.0, -0.17453294, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 67.0, "r": [0.0, 0.24434611, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [0.0, 0.052359883, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 77.0, "r": [0.0, -0.24434611, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 83.0, "r": [0.0, -0.122173056, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [0.0, 0.0, 0.0], "t": [0.0, 0.0, 0.0]}], "pose:head": [{"tick": 60.0, "r": [-0.19198622, 0.06981319, -0.017453294], "t": [0.0, 0.0, 0.0]}, {"tick": 63.0, "r": [0.03490659, -0.40142575, -0.017453294], "t": [0.0, 0.0, 0.0]}, {"tick": 65.0, "r": [0.19198622, -0.3141593, -0.122173056], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [-0.017453285, 0.122173056, 0.13962635], "t": [0.0, 0.0, 0.0]}, {"tick": 74.0, "r": [0.06981318, 0.0, 0.13962635], "t": [0.0, 0.0, 0.0]}, {"tick": 77.0, "r": [0.06981318, -0.22689281, 0.13962635], "t": [0.0, 0.0, 0.0]}, {"tick": 80.0, "r": [0.19198622, -0.5061455, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 83.0, "r": [0.20943953, -0.33161253, -0.087266445], "t": [0.0, 0.0, 0.0]}, {"tick": 86.0, "r": [0.17453295, -0.33161253, -0.03490657], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [0.052359894, 0.10471979, -0.087266445], "t": [0.0, 0.0, 0.0]}, {"tick": 92.0, "r": [0.052359894, 0.10471979, 0.0], "t": [0.0, 0.0, 0.0]}, {"tick": 95.0, "r": [0.052359894, 0.0698132, 0.12217308], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [-0.17453294, -0.08726647, 0.122173056], "t": [0.0, 0.0, 0.0]}], "pose:right_arm": [{"tick": 60.0, "r": [1.1693707, 0.8028515, 0.0], "t": [0.0, -1.375, -2.25]}, {"tick": 63.0, "r": [1.1693707, 0.4188791, 0.0], "t": [0.0, -1.375, -2.25]}, {"tick": 65.0, "r": [0.9250245, 0.052359946, 0.31415927], "t": [0.0, -1.375, -2.25]}, {"tick": 67.0, "r": [0.62831855, 0.052359946, 0.31415927], "t": [0.0, -1.375, -2.25]}, {"tick": 71.0, "r": [-0.03490659, 0.052359946, 0.6632251], "t": [-0.59375, -0.78125, -1.0625]}, {"tick": 74.0, "r": [-0.03490659, 0.052359946, 0.26179934], "t": [-0.59375, -0.78125, -1.0625]}, {"tick": 77.0, "r": [0.41887906, -0.15707964, 0.45378563], "t": [0.0, 0.0, 0.0]}, {"tick": 80.0, "r": [0.7679449, -0.45378563, 0.45378563], "t": [0.0, 0.0, 0.0]}, {"tick": 83.0, "r": [1.134464, 0.03490655, 0.19198626], "t": [0.0, 0.0, 0.0]}, {"tick": 86.0, "r": [1.3613569, 0.22689277, 0.19198626], "t": [0.0, 0.0, 0.0]}, {"tick": 92.0, "r": [0.36651915, -0.20943953, 0.31415927], "t": [0.0, 0.0, 0.0]}, {"tick": 95.0, "r": [0.17453294, -0.20943953, 0.50614554], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [0.0, 0.0, 0.33161256], "t": [0.0, 0.0, 0.0]}], "pose:left_arm": [{"tick": 60.0, "r": [0.0, 0.34906587, -0.47123894], "t": [0.0, 0.0, -0.34375]}, {"tick": 63.0, "r": [0.0, 0.34906587, -0.64577186], "t": [0.0, 0.0, -0.34375]}, {"tick": 65.0, "r": [0.593412, 0.7330383, -0.40142575], "t": [0.0, 0.0, -0.34375]}, {"tick": 67.0, "r": [0.8552114, 0.8552114, -0.40142575], "t": [0.0, 0.0, -0.34375]}, {"tick": 71.0, "r": [1.3439035, 0.0, 0.0], "t": [0.96875, 0.0, 0.0]}, {"tick": 74.0, "r": [1.4486233, -0.104719765, 0.0], "t": [0.96875, 0.0, 0.0]}, {"tick": 77.0, "r": [0.5235988, 0.5585054, -0.296706], "t": [0.0, 0.0, 0.0]}, {"tick": 80.0, "r": [0.22689281, 0.33161265, -0.5585054], "t": [0.0, 0.0, 0.0]}, {"tick": 83.0, "r": [-0.087266445, 0.1919863, -0.6981318], "t": [0.0, 0.0, 0.0]}, {"tick": 86.0, "r": [-0.087266445, 0.1919863, -0.8203049], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [1.1170108, 0.6981318, -0.31415936], "t": [0.0, 0.0, 0.0]}, {"tick": 95.0, "r": [1.2566372, 0.052359946, -0.31415936], "t": [0.0, 0.0, 0.0]}, {"tick": 101.0, "r": [1.2217306, -0.38397238, -0.17453302], "t": [0.0, -0.65625, 0.0]}], "pose:right_leg": [{"tick": 60.0, "r": [0.06981318, -0.33161253, 0.24434611], "t": [-0.125, 1.21875, -2.6875]}, {"tick": 65.0, "r": [0.34906587, 0.0, -0.2617994], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [-0.104719765, 0.0, 0.2617994], "t": [-0.3125, 0.0, -0.96875]}, {"tick": 74.0, "r": [-0.2617994, 0.0, 0.0], "t": [0.0, 0.0, -0.78125]}, {"tick": 80.0, "r": [0.0, 0.0, 0.15707964], "t": [-1.1875, 0.0, -1.6875]}, {"tick": 83.0, "r": [-0.08726647, 0.0, 0.15707964], "t": [-1.1875, 0.0, -3.15625]}, {"tick": 86.0, "r": [0.34906587, 0.0, -0.20943953], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [-0.052359883, 0.0, 0.12217303], "t": [0.0, 0.0, -2.21875]}, {"tick": 95.0, "r": [-0.052359883, 0.0, 0.40142575], "t": [-0.59375, -0.125, -2.21875]}, {"tick": 101.0, "r": [-0.13962635, 0.0, -0.296706], "t": [0.0, 0.0, 0.0]}], "pose:left_leg": [{"tick": 60.0, "r": [0.19198622, 0.45378563, -0.2792527], "t": [0.65625, 0.0, -1.5625]}, {"tick": 65.0, "r": [-0.19198622, 0.0, 0.19198622], "t": [0.0, 0.0, 0.0]}, {"tick": 71.0, "r": [-0.19198622, 0.15707964, -0.122173056], "t": [1.15625, 0.0, -0.90625]}, {"tick": 74.0, "r": [0.0, 0.0, 0.104719765], "t": [0.0, 0.34375, -2.71875]}, {"tick": 80.0, "r": [-0.03490659, 0.40142575, -0.24434611], "t": [0.6875, -0.625, -1.4375]}, {"tick": 83.0, "r": [-0.03490659, 0.40142575, -0.40142575], "t": [0.6875, -0.625, -1.4375]}, {"tick": 86.0, "r": [0.0, 0.0, 0.19198622], "t": [0.0, 0.0, 0.0]}, {"tick": 89.0, "r": [-0.38397244, 0.0, 0.19198622], "t": [0.0, 0.0, -1.34375]}, {"tick": 95.0, "r": [-0.15707964, 0.22689281, -0.052359883], "t": [1.03125, -0.25, -2.34375]}, {"tick": 101.0, "r": [-0.122173056, 0.15707964, 0.017453294], "t": [0.0, 0.0, -3.0]}]};

  let jesulutoScene = null;
  let jesulutoCamera = null;
  let jesulutoRenderer = null;
  let jesulutoRig = null;
  let jesulutoCurrentSkinImg = null;
  let isJesuluto3DInitialized = false;

  function initJesuluto3D() {
    const container = document.getElementById('jesuluto-3d-stage');
    if (!container) return;
    if (typeof THREE === 'undefined') {
      if (document.getElementById('auramusic-three-script')) return;
      const s = document.createElement('script');
      s.id = 'auramusic-three-script';
      s.src = (typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL('three.min.js') : 'three.min.js';
      s.onload = () => initJesuluto3D();
      (document.head || document.documentElement).appendChild(s);
      return;
    }
    if (isJesuluto3DInitialized && jesulutoRenderer) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 480;

    jesulutoScene = new THREE.Scene();
    jesulutoCamera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    jesulutoCamera.position.set(0, 15, 64);
    jesulutoCamera.lookAt(0, 13, 0);

    jesulutoRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    jesulutoRenderer.setSize(width, height);
    jesulutoRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    container.innerHTML = '';
    container.appendChild(jesulutoRenderer.domElement);

    const ped = document.createElement('div');
    ped.className = 'jesuluto-stage-pedestal';
    container.appendChild(ped);

    setupJesulutoSkinUpload(container);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    jesulutoScene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0x00ff77, 1.1);
    dirLight.position.set(15, 35, 25);
    jesulutoScene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x00e5ff, 0.6);
    backLight.position.set(-15, 15, -25);
    jesulutoScene.add(backLight);

    const savedSkin = localStorage.getItem('auramusic_custom_skin');
    const defaultSkinUrl = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
      ? chrome.runtime.getURL('assets/jesuluto_skin.png')
      : 'assets/jesuluto_skin.png';
    loadSkinAndBuildRig(savedSkin || defaultSkinUrl);

    isJesuluto3DInitialized = true;
  }

  function setupJesulutoSkinUpload(container) {
    let controls = document.getElementById('jesuluto-skin-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'jesuluto-skin-controls';
      controls.className = 'jesuluto-skin-controls';
      controls.innerHTML = `
        <input type="file" id="jesuluto-skin-file-input" accept="image/png" style="display:none;">
        <button type="button" id="jesuluto-skin-upload-btn" class="jesuluto-skin-action-btn">
          <span>👕</span> Subir Skin (.png)
        </button>
        <button type="button" id="jesuluto-skin-reset-btn" class="jesuluto-skin-action-btn" style="display:none;" title="Volver a la skin original">
          <span>↺</span>
        </button>
      `;
      container.appendChild(controls);

      const fileInput = controls.querySelector('#jesuluto-skin-file-input');
      const uploadBtn = controls.querySelector('#jesuluto-skin-upload-btn');
      const resetBtn = controls.querySelector('#jesuluto-skin-reset-btn');

      uploadBtn.onclick = () => fileInput.click();

      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target.result;
          try {
            localStorage.setItem('auramusic_custom_skin', dataUrl);
          } catch(err) {}
          loadSkinAndBuildRig(dataUrl);
          if (resetBtn) resetBtn.style.display = 'inline-flex';
        };
        reader.readAsDataURL(file);
      };

      if (resetBtn) {
        if (localStorage.getItem('auramusic_custom_skin')) resetBtn.style.display = 'inline-flex';
        resetBtn.onclick = () => {
          localStorage.removeItem('auramusic_custom_skin');
          const defaultSkinUrl = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
            ? chrome.runtime.getURL('assets/jesuluto_skin.png')
            : 'assets/jesuluto_skin.png';
          loadSkinAndBuildRig(defaultSkinUrl);
          resetBtn.style.display = 'none';
        };
      }
    }
  }

  function loadSkinAndBuildRig(urlOrData) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      jesulutoCurrentSkinImg = img;
      buildJesulutoMinecraftRig(img);
    };
    img.src = urlOrData;
  }

  function createBoxFaceMaterial(image, x, y, w, h, isOuterLayer = false) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.abs(w));
    canvas.height = Math.max(1, Math.abs(h));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const sx = Math.min(x, x + w);
    const sy = Math.min(y, y + h);
    const sw = Math.abs(w);
    const sh = Math.abs(h);

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;

    return new THREE.MeshLambertMaterial({
      map: tex,
      transparent: true,
      alphaTest: isOuterLayer ? 0.35 : 0.05,
      side: THREE.FrontSide
    });
  }

  function buildJesulutoMinecraftRig(img) {
    if (!jesulutoScene || typeof THREE === 'undefined') return;

    if (jesulutoRig && jesulutoRig.root) {
      jesulutoScene.remove(jesulutoRig.root);
    }

    const root = new THREE.Group();
    root.position.set(0, 0, 0);

    function makePart(w, h, d, uvMap, inflate = 0, isOuter = false) {
      const mats = [
        createBoxFaceMaterial(img, uvMap.east[0], uvMap.east[1], uvMap.east[2]-uvMap.east[0], uvMap.east[3]-uvMap.east[1], isOuter),
        createBoxFaceMaterial(img, uvMap.west[0], uvMap.west[1], uvMap.west[2]-uvMap.west[0], uvMap.west[3]-uvMap.west[1], isOuter),
        createBoxFaceMaterial(img, uvMap.up[0], uvMap.up[1], uvMap.up[2]-uvMap.up[0], uvMap.up[3]-uvMap.up[1], isOuter),
        createBoxFaceMaterial(img, uvMap.down[0], uvMap.down[1], uvMap.down[2]-uvMap.down[0], uvMap.down[3]-uvMap.down[1], isOuter),
        createBoxFaceMaterial(img, uvMap.north[0], uvMap.north[1], uvMap.north[2]-uvMap.north[0], uvMap.north[3]-uvMap.north[1], isOuter),
        createBoxFaceMaterial(img, uvMap.south[0], uvMap.south[1], uvMap.south[2]-uvMap.south[0], uvMap.south[3]-uvMap.south[1], isOuter)
      ];
      const geom = new THREE.BoxGeometry(w + inflate * 2, h + inflate * 2, d + inflate * 2);
      return new THREE.Mesh(geom, mats);
    }

    // 1. PELVIS / LOW_BODY
    const lowBodyGroup = new THREE.Group();
    lowBodyGroup.position.set(0, 12, 0);

    // 2. TORSO
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0, 0);

    const torsoBase = makePart(8, 12, 4, {
      north: [20, 20, 28, 32], east: [16, 20, 20, 32], south: [32, 20, 40, 32],
      west: [28, 20, 32, 32], up: [20, 16, 28, 20], down: [28, 16, 36, 20]
    });
    torsoBase.position.set(0, 6, 0);
    torsoGroup.add(torsoBase);

    const torsoOuter = makePart(8, 12, 4, {
      north: [20, 36, 28, 48], east: [16, 36, 20, 48], south: [32, 36, 40, 48],
      west: [28, 36, 32, 48], up: [20, 32, 28, 36], down: [28, 32, 36, 36]
    }, 0.35, true);
    torsoOuter.position.set(0, 6, 0);
    torsoGroup.add(torsoOuter);

    // 3. CABEZA
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 12, 0);

    const headBase = makePart(8, 8, 8, {
      north: [8, 8, 16, 16], east: [0, 8, 8, 16], south: [24, 8, 32, 16],
      west: [16, 8, 24, 16], up: [8, 0, 16, 8], down: [16, 0, 24, 8]
    });
    headBase.position.set(0, 4, 0);
    headGroup.add(headBase);

    const headOuter = makePart(8, 8, 8, {
      north: [40, 8, 48, 16], east: [32, 8, 40, 16], south: [56, 8, 64, 16],
      west: [48, 8, 56, 16], up: [40, 0, 48, 8], down: [48, 0, 56, 8]
    }, 0.55, true);
    headOuter.position.set(0, 4, 0);
    headGroup.add(headOuter);
    torsoGroup.add(headGroup);

    // 4. BRAZO DERECHO
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(5.5, 10, 0);

    const rightArmBase = makePart(3, 12, 4, {
      north: [44, 20, 47, 32], east: [40, 20, 44, 32], south: [51, 20, 54, 32],
      west: [47, 20, 51, 32], up: [44, 16, 47, 20], down: [47, 16, 50, 20]
    });
    rightArmBase.position.set(0, -5, 0);
    rightArmGroup.add(rightArmBase);

    const rightArmOuter = makePart(3, 12, 4, {
      north: [44, 36, 47, 48], east: [40, 36, 44, 48], south: [51, 36, 54, 48],
      west: [47, 36, 51, 48], up: [44, 32, 47, 36], down: [47, 32, 50, 36]
    }, 0.3, true);
    rightArmOuter.position.set(0, -5, 0);
    rightArmGroup.add(rightArmOuter);
    torsoGroup.add(rightArmGroup);

    // 5. BRAZO IZQUIERDO
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-5.5, 10, 0);

    const leftArmBase = makePart(3, 12, 4, {
      north: [36, 52, 39, 64], east: [32, 52, 36, 64], south: [43, 52, 46, 64],
      west: [39, 52, 43, 64], up: [36, 48, 39, 52], down: [39, 48, 42, 52]
    });
    leftArmBase.position.set(0, -5, 0);
    leftArmGroup.add(leftArmBase);

    const leftArmOuter = makePart(3, 12, 4, {
      north: [52, 52, 55, 64], east: [48, 52, 52, 64], south: [59, 52, 62, 64],
      west: [55, 52, 59, 64], up: [52, 48, 55, 52], down: [55, 48, 58, 52]
    }, 0.3, true);
    leftArmOuter.position.set(0, -5, 0);
    leftArmGroup.add(leftArmOuter);
    torsoGroup.add(leftArmGroup);

    lowBodyGroup.add(torsoGroup);

    // 6. PIERNA DERECHA
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(1.9, 0, 0);

    const rightLegBase = makePart(4, 12, 4, {
      north: [4, 20, 8, 32], east: [0, 20, 4, 32], south: [12, 20, 16, 32],
      west: [8, 20, 12, 32], up: [4, 16, 8, 20], down: [8, 16, 12, 20]
    });
    rightLegBase.position.set(0, -6, 0);
    rightLegGroup.add(rightLegBase);

    const rightLegOuter = makePart(4, 12, 4, {
      north: [4, 36, 8, 48], east: [0, 36, 4, 48], south: [12, 36, 16, 48],
      west: [8, 36, 12, 48], up: [4, 32, 8, 36], down: [8, 32, 12, 36]
    }, 0.3, true);
    rightLegOuter.position.set(0, -6, 0);
    rightLegGroup.add(rightLegOuter);
    lowBodyGroup.add(rightLegGroup);

    // 7. PIERNA IZQUIERDA
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-1.9, 0, 0);

    const leftLegBase = makePart(4, 12, 4, {
      north: [20, 52, 24, 64], east: [16, 52, 20, 64], south: [28, 52, 32, 64],
      west: [24, 52, 28, 64], up: [20, 48, 24, 52], down: [24, 48, 28, 52]
    });
    leftLegBase.position.set(0, -6, 0);
    leftLegGroup.add(leftLegBase);

    const leftLegOuter = makePart(4, 12, 4, {
      north: [4, 52, 8, 64], east: [0, 52, 4, 64], south: [12, 52, 16, 64],
      west: [8, 52, 12, 64], up: [4, 48, 8, 52], down: [8, 48, 12, 52]
    }, 0.3, true);
    leftLegOuter.position.set(0, -6, 0);
    leftLegGroup.add(leftLegOuter);
    lowBodyGroup.add(leftLegGroup);

    root.add(lowBodyGroup);
    jesulutoScene.add(root);

    jesulutoRig = {
      root,
      lowBody: lowBodyGroup,
      torso: torsoGroup,
      head: headGroup,
      rightArm: rightArmGroup,
      leftArm: leftArmGroup,
      rightLeg: rightLegGroup,
      leftLeg: leftLegGroup
    };

    if (jesulutoRenderer && jesulutoScene && jesulutoCamera) {
      jesulutoRenderer.render(jesulutoScene, jesulutoCamera);
    }
  }

  function updateJesulutoAnimation(currentTime, isPlaying) {
    if (!jesulutoRig || !isJesuluto3DInitialized) return;

    if (!isPlaying) {
      jesulutoRig.root.rotation.y = 0.2 + Math.sin(currentTime * 1.5) * 0.08;
      if (jesulutoRenderer && jesulutoScene && jesulutoCamera) {
        jesulutoRenderer.render(jesulutoScene, jesulutoCamera);
      }
      return;
    }

    const animLen = 41.0;
    const currentTick = 60.0 + ((currentTime * 20.0) % animLen);

    function sampleKf(channelName) {
      const kfs = JESULUTO_DANCE_DATA[channelName];
      if (!kfs || kfs.length === 0) return { r: [0, 0, 0], t: [0, 0, 0] };

      let p0 = kfs[0];
      let p1 = kfs[kfs.length - 1];

      for (let i = 0; i < kfs.length - 1; i++) {
        if (currentTick >= kfs[i].tick && currentTick <= kfs[i + 1].tick) {
          p0 = kfs[i];
          p1 = kfs[i + 1];
          break;
        }
      }

      const span = p1.tick - p0.tick;
      const factor = span > 0 ? (currentTick - p0.tick) / span : 0;

      const r = [
        p0.r[0] + (p1.r[0] - p0.r[0]) * factor,
        p0.r[1] + (p1.r[1] - p0.r[1]) * factor,
        p0.r[2] + (p1.r[2] - p0.r[2]) * factor
      ];

      const t = [
        p0.t[0] + (p1.t[0] - p0.t[0]) * factor,
        p0.t[1] + (p1.t[1] - p0.t[1]) * factor,
        p0.t[2] + (p1.t[2] - p0.t[2]) * factor
      ];

      return { r, t };
    }

    const overlayKf = sampleKf('transform_overlay2');
    const lowBodyKf = sampleKf('pose:low_body');
    const torsoKf = sampleKf('pose:torso');
    const headKf = sampleKf('pose:head');
    const rArmKf = sampleKf('pose:right_arm');
    const lArmKf = sampleKf('pose:left_arm');
    const rLegKf = sampleKf('pose:right_leg');
    const lLegKf = sampleKf('pose:left_leg');

    jesulutoRig.root.rotation.z = overlayKf.r[2];
    jesulutoRig.root.rotation.y = 0.22 + Math.sin(currentTime * 2) * 0.12;

    jesulutoRig.lowBody.position.y = 12 + (lowBodyKf.t[1] || 0) * 0.6;
    jesulutoRig.lowBody.position.x = (lowBodyKf.t[0] || 0) * 0.6;
    jesulutoRig.lowBody.rotation.set(lowBodyKf.r[0], lowBodyKf.r[1], lowBodyKf.r[2]);

    jesulutoRig.torso.rotation.set(torsoKf.r[0], torsoKf.r[1], torsoKf.r[2]);
    jesulutoRig.head.rotation.set(headKf.r[0], headKf.r[1], headKf.r[2]);

    jesulutoRig.rightArm.rotation.set(rArmKf.r[0], rArmKf.r[1], rArmKf.r[2]);
    jesulutoRig.rightArm.position.set(5.5 + (rArmKf.t[0] || 0) * 0.4, 10 + (rArmKf.t[1] || 0) * 0.4, (rArmKf.t[2] || 0) * 0.4);

    jesulutoRig.leftArm.rotation.set(lArmKf.r[0], lArmKf.r[1], lArmKf.r[2]);
    jesulutoRig.leftArm.position.set(-5.5 + (lArmKf.t[0] || 0) * 0.4, 10 + (lArmKf.t[1] || 0) * 0.4, (lArmKf.t[2] || 0) * 0.4);

    jesulutoRig.rightLeg.rotation.set(rLegKf.r[0], rLegKf.r[1], rLegKf.r[2]);
    jesulutoRig.rightLeg.position.set(1.9 + (rLegKf.t[0] || 0) * 0.3, (rLegKf.t[1] || 0) * 0.3, (rLegKf.t[2] || 0) * 0.3);

    jesulutoRig.leftLeg.rotation.set(lLegKf.r[0], lLegKf.r[1], lLegKf.r[2]);
    jesulutoRig.leftLeg.position.set(-1.9 + (lLegKf.t[0] || 0) * 0.3, (lLegKf.t[1] || 0) * 0.3, (lLegKf.t[2] || 0) * 0.3);

    if (jesulutoRenderer && jesulutoScene && jesulutoCamera) {
      jesulutoRenderer.render(jesulutoScene, jesulutoCamera);
    }
  }

  function destroyJesuluto3D() {
    if (!isJesuluto3DInitialized) return;
    try {
      if (jesulutoRenderer) {
        jesulutoRenderer.dispose();
        if (jesulutoRenderer.forceContextLoss) {
          jesulutoRenderer.forceContextLoss();
        }
        if (jesulutoRenderer.domElement && jesulutoRenderer.domElement.parentNode) {
          jesulutoRenderer.domElement.parentNode.removeChild(jesulutoRenderer.domElement);
        }
      }
      if (jesulutoScene) {
        jesulutoScene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
          }
        });
      }
    } catch(e) {}
    jesulutoScene = null;
    jesulutoCamera = null;
    jesulutoRenderer = null;
    jesulutoRig = null;
    isJesuluto3DInitialized = false;
  }

  window.AuraMusic.Themes = {
    ALL_THEMES,
    applyTheme,
    updateSliderShadowDom,
    initKomiSakura,
    destroyKomiSakura,
    initAestheticSparkles,
    destroyAestheticSparkles,
    initJesuluto3D,
    destroyJesuluto3D,
    updateJesulutoAnimation,
    updateSpotifyBrandElements,
    removeSpotifyBrandElements
  };

  // Exportar en window para acceso global
  window.updateSliderShadowDom = updateSliderShadowDom;
  window.updateJesulutoAnimation = updateJesulutoAnimation;
})();
