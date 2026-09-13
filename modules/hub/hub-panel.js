/**
 * AuraMusic - Módulo de Interfaz de Usuario (Hub Modal Glassmorphism & Botón Flotante)
 */
window.AuraMusic = window.AuraMusic || {};

(function() {
  'use strict';

  function getState() {
    return window.AuraMusic?.state || window.state || window.defaultSettings || {};
  }

  function getExtVersion() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
        return chrome.runtime.getManifest().version || '1.3.3';
      }
    } catch (_) {}
    return '1.3.3';
  }

  // --- CREACIÓN DEL PANEL DE CONTROL GLASSMORPHISM ---
  function injectLauncherAndHub() {
    if (document.getElementById('auramusic-launcher-btn')) return;

    const state = getState();
    const extVer = getExtVersion();

    // Botón Lanzador Flotante
    const launcher = document.createElement('button');
    launcher.id = 'auramusic-launcher-btn';
    launcher.type = 'button';
    launcher.innerHTML = `<span class="sparkle">✨</span> <span>AuraMusic</span>`;
    document.body.appendChild(launcher);

    // Modal Hub Flotante
    const overlay = document.createElement('div');
    overlay.id = 'auramusic-hub-overlay';
    overlay.innerHTML = `
      <div id="auramusic-hub">
        <header class="auramusic-header">
          <div class="auramusic-title-group">
            <span class="auramusic-logo-badge">✨</span>
            <span class="auramusic-title">AuraMusic Hub</span>
            <span class="auramusic-version" id="hub-version-badge">v${extVer}</span>
          </div>
          <button type="button" class="auramusic-close-btn" id="auramusic-close-btn">✕</button>
        </header>

        <nav class="auramusic-tabs">
          <button type="button" class="auramusic-tab active" data-tab="themes">🎨 Temas</button>
          <button type="button" class="auramusic-tab" data-tab="visualizer">📊 Visualizador</button>
          <button type="button" class="auramusic-tab" data-tab="audio">🎚️ Audio & EQ</button>
          <button type="button" class="auramusic-tab" data-tab="clean">🚫 Limpieza</button>
          <button type="button" class="auramusic-tab" id="hub-cinema-lyrics-tab" style="color: #ff8fa3; font-weight: 700;">✨ Modo Letras</button>
          <button type="button" class="auramusic-tab" data-tab="store" id="hub-tab-store" style="color: #ffb703; font-weight: 700;">🛍️ Tienda</button>
          <button type="button" class="auramusic-tab" data-tab="updates" id="hub-tab-updates" style="position:relative;">
            🚀 Actualizaciones <span id="hub-update-dot" class="hub-tab-update-dot" style="display:none;"></span>
          </button>
        </nav>

        <main class="auramusic-body">
          <!-- PESTAÑA 1: TEMAS -->
          <section class="auramusic-panel active" id="panel-themes">
            <div class="auramusic-card">
              <span class="auramusic-label">Estilo de Interfaz</span>
              <span class="auramusic-sublabel">Selecciona el tema que transformará la estética de YouTube Music.</span>
              <div class="auramusic-theme-grid">
                <button type="button" class="theme-pill-btn" data-theme="auramusic" style="border-color: #00e5ff; box-shadow: 0 0 14px rgba(0, 229, 255, 0.4); font-weight: 700;">✨ AuraMusic</button>
                <button type="button" class="theme-pill-btn" data-theme="jesuluto">⚡ Jesuluto</button>
                <button type="button" class="theme-pill-btn" data-theme="komi">🐱 Komi-san</button>
                <button type="button" class="theme-pill-btn" data-theme="apple">🍎 Apple Music</button>
                <button type="button" class="theme-pill-btn" data-theme="spotify">🟢 Spotify</button>
                <button type="button" class="theme-pill-btn" data-theme="whatsapp">💬 WhatsApp</button>
                <button type="button" class="theme-pill-btn" data-theme="aesthetic">🌸 Aesthetic Pastel</button>
                <button type="button" class="theme-pill-btn" data-theme="minecraft">⛏️ Minecraft Pixel</button>
                <button type="button" class="theme-pill-btn" data-theme="cyberpunk">🤖 Cyberpunk Mecha</button>
                <button type="button" class="theme-pill-btn" data-theme="youtube">🔴 YouTube Red</button>
                <button type="button" class="theme-pill-btn" data-theme="oled">🖤 OLED Black</button>
                <button type="button" class="theme-pill-btn" data-theme="dynamic">🎨 Dinámico</button>
                <button type="button" class="theme-pill-btn" data-theme="default">⚙️ Default</button>
              </div>
            </div>

            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">Color de Acento Principal</span>
                  <span class="auramusic-sublabel">Color para botones, barras y brillos neón.</span>
                </div>
                <input type="color" id="auramusic-color-picker" value="${state.primaryColor || '#00e5ff'}" style="cursor:pointer; border:none; width:36px; height:36px; border-radius:50%; background:transparent;">
              </div>
            </div>
          </section>

          <!-- PESTAÑA 2: VISUALIZADOR & AMBIENTE -->
          <section class="auramusic-panel" id="panel-visualizer">
            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🌈 Iluminación Ambiental Reactiva</span>
                  <span class="auramusic-sublabel">Proyecta un aura viva en el fondo según los colores del álbum.</span>
                </div>
                <label class="auramusic-switch">
                  <input type="checkbox" id="toggle-ambient" ${state.ambientGlow ? 'checked' : ''}>
                  <span class="auramusic-slider"></span>
                </label>
              </div>
            </div>

            <div class="auramusic-card">
              <span class="auramusic-label">📊 Visualizador en la Barra de Reproducción</span>
              <span class="auramusic-sublabel">Renderizado en tiempo real de frecuencias musicales.</span>
              <div class="auramusic-theme-grid" style="margin-top: 8px;">
                <button type="button" class="theme-pill-btn" data-vis="bars">📶 Barras Neón</button>
                <button type="button" class="theme-pill-btn" data-vis="wave">〰️ Onda Líquida</button>
                <button type="button" class="theme-pill-btn" data-vis="off">✕ Desactivado</button>
              </div>
            </div>
          </section>

          <!-- PESTAÑA 3: AUDIO, EQ & VELOCIDAD -->
          <section class="auramusic-panel" id="panel-audio">
            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🔊 Potenciador de Volumen (Volume Boost)</span>
                  <span class="auramusic-sublabel">Sube el volumen hasta un 300% para canciones con baja ganancia.</span>
                </div>
                <span id="volume-boost-val" style="font-weight:700; color:var(--auramusic-primary);">${state.volumeBoost || 100}%</span>
              </div>
              <input type="range" class="auramusic-range" id="volume-boost-slider" min="100" max="300" step="10" value="${state.volumeBoost || 100}">
            </div>

            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">⚡ Velocidad de Reproducción</span>
                  <span class="auramusic-sublabel">Ajuste fino de tempo (0.25x a 3.0x).</span>
                </div>
                <span id="speed-val" style="font-weight:700; color:var(--auramusic-primary);">${state.playbackSpeed || 1.0}x</span>
              </div>
              <input type="range" class="auramusic-range" id="speed-slider" min="0.25" max="3.0" step="0.05" value="${state.playbackSpeed || 1.0}">
            </div>

            <div class="auramusic-card">
              <span class="auramusic-label">🎚️ Ecualizador de 5 Bandas (-12dB a +12dB)</span>
              <div class="auramusic-eq-container">
                ${['60Hz', '250Hz', '1kHz', '4kHz', '12kHz'].map(band => {
                  const val = (state.eq && typeof state.eq[band] === 'number') ? state.eq[band] : 0;
                  return `
                  <div class="auramusic-eq-band">
                    <span class="auramusic-eq-val" id="eq-val-${band}">${val > 0 ? '+' : ''}${val}dB</span>
                    <input type="range" class="auramusic-eq-slider" orient="vertical" data-band="${band}" min="-12" max="12" step="1" value="${val}">
                    <span class="auramusic-eq-label">${band}</span>
                  </div>
                `;}).join('')}
              </div>
            </div>
          </section>

          <!-- PESTAÑA 4: LIMPIEZA -->
          <section class="auramusic-panel" id="panel-clean">
            <div class="auramusic-card">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🚫 Modo Limpio y Anti-Distracciones</span>
                  <span class="auramusic-sublabel">Auto-cierra el aviso '¿Sigues ahí?' y oculta banners molestos de Premium.</span>
                </div>
                <label class="auramusic-switch">
                  <input type="checkbox" id="toggle-clean" ${state.cleanMode ? 'checked' : ''}>
                  <span class="auramusic-slider"></span>
                </label>
              </div>
            </div>

            <div class="auramusic-card" style="margin-top: 14px;">
              <div class="auramusic-row">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🎬 Intro Cinemática (YouTube on TV)</span>
                  <span class="auramusic-sublabel">Reproduce la animación de inicio oficial estilo Google / YouTube on TV al abrir la página.</span>
                </div>
                <label class="auramusic-switch">
                  <input type="checkbox" id="toggle-splash" ${state.splashScreen !== false ? 'checked' : ''}>
                  <span class="auramusic-slider"></span>
                </label>
              </div>

              <div class="auramusic-row" style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🔊 Sonido de Inicio (Startup Sound)</span>
                  <span class="auramusic-sublabel">Reproduce el icónico acorde sonoro de YouTube on TV al arrancar.</span>
                </div>
                <label class="auramusic-switch">
                  <input type="checkbox" id="toggle-splash-sound" ${state.splashSound !== false ? 'checked' : ''}>
                  <span class="auramusic-slider"></span>
                </label>
              </div>

              <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
                <button type="button" id="btn-preview-splash" class="auramusic-footer-check-btn" style="width: auto; padding: 6px 14px;">
                  ▶ Probar Intro
                </button>
              </div>
            </div>
          </section>

          <!-- PESTAÑA 5: ACTUALIZACIONES GITHUB -->
          <section class="auramusic-panel" id="panel-updates">
            <div class="auramusic-card">
              <div class="auramusic-row" style="align-items: center; justify-content: space-between;">
                <div class="auramusic-label-box">
                  <span class="auramusic-label">🚀 Actualizador GitHub (1 Clic)</span>
                  <span class="auramusic-sublabel">Sincroniza directamente con el repositorio oficial sin tocar chrome://extensions.</span>
                </div>
                <span id="hub-update-pill" class="hub-git-pill pill-checking">Comprobando...</span>
              </div>

              <div class="hub-update-status-card">
                <div class="hub-update-status-row">
                  <span class="hub-status-label">Versión Instalada:</span>
                  <span class="hub-status-value" id="hub-local-ver-text">v${extVer}</span>
                </div>
                <div class="hub-update-status-row">
                  <span class="hub-status-label">Versión en GitHub:</span>
                  <span class="hub-status-value" id="hub-remote-ver-text">Consultando...</span>
                </div>
                <div class="hub-update-status-row">
                  <span class="hub-status-label">Último Commit:</span>
                  <span class="hub-status-value monospace" id="hub-remote-commit-text">...</span>
                </div>
                <div class="hub-update-status-row" id="hub-remote-msg-row" style="display: none;">
                  <span class="hub-status-label">Novedades:</span>
                  <span class="hub-status-value hub-commit-msg-text" id="hub-remote-msg-text">...</span>
                </div>
              </div>

              <div id="hub-update-progress-area" class="hub-update-progress-area" style="display: none;">
                <div class="hub-update-progress-bar-bg">
                  <div class="hub-update-progress-bar-fill" id="hub-update-progress-bar"></div>
                </div>
                <div class="hub-update-progress-text" id="hub-update-progress-text">Iniciando actualización...</div>
              </div>

              <div class="hub-update-btn-row">
                <button type="button" id="hub-btn-apply-update" class="hub-btn-gradient-primary">
                  🚀 Actualizar desde GitHub
                </button>
                <button type="button" id="hub-btn-reload-now" class="hub-btn-ghost" title="Recargar la extensión en Chrome">
                  ⚡ Recargar
                </button>
                <button type="button" id="hub-btn-check-update" class="hub-btn-ghost" title="Comprobar si hay nueva versión">
                  🔄 Buscar
                </button>
              </div>

              <div class="hub-update-footer-note">
                💡 <strong>100% Automático:</strong> AuraMusic descarga las novedades directamente desde GitHub y recarga la extensión en segundo plano. No necesitas ir a chrome://extensions ni reiniciar Chrome.
              </div>
            </div>
          </section>

          <!-- PESTAÑA 6: TIENDA DE TEMAS DE LA COMUNIDAD (AURAMARKET BETA) -->
          <section class="auramusic-panel" id="panel-store">
            <div class="auramusic-card auramusic-store-header-card">
              <div class="auramusic-store-header-content">
                <div class="auramusic-store-badge">🛍️ AuraMarket Beta</div>
                <h3 class="auramusic-store-title">Tienda de Temas de la Comunidad</h3>
                <p class="auramusic-store-subtitle">Explora, prueba e instala temas creados por la comunidad y diseñadores para transformar YouTube Music.</p>
              </div>
            </div>

            <!-- Banner Informativo del Creador de Temas a Futuro -->
            <div class="auramusic-card auramusic-store-banner">
              <div class="auramusic-store-banner-icon">🎨</div>
              <div class="auramusic-store-banner-body">
                <div class="auramusic-store-banner-title">🚀 Próximamente: Estudio de Creación y Subida de Temas</div>
                <div class="auramusic-store-banner-text">
                  En una próxima versión podrás diseñar tus propios temas directamente con tus colores, fuentes, dock translúcido y fondos dinámicos, y publicarlos en esta tienda para compartirlos con toda la comunidad con 1 clic.
                </div>
              </div>
            </div>

            <!-- Filtros de Categorías -->
            <div class="auramusic-store-filters">
              <button type="button" class="store-filter-btn active" data-filter="all">🌟 Todos</button>
              <button type="button" class="store-filter-btn" data-filter="popular">🔥 Populares</button>
              <button type="button" class="store-filter-btn" data-filter="aesthetic">🌸 Aesthetic</button>
              <button type="button" class="store-filter-btn" data-filter="cyber">⚡ Cyberpunk</button>
              <button type="button" class="store-filter-btn" data-filter="lofi">☕ Lo-Fi</button>
            </div>

            <!-- Cuadrícula de Temas de la Comunidad -->
            <div class="auramusic-store-grid">
              <!-- Tarjeta 1: Sakura Neon Dream -->
              <div class="auramusic-store-item" data-category="aesthetic popular">
                <div class="store-item-preview preview-sakura">
                  <span class="store-preview-badge">🌸 Popular</span>
                  <div class="store-preview-glow"></div>
                  <div class="store-preview-chip-row">
                    <span class="store-color-chip" style="background:#ff8fa3;"></span>
                    <span class="store-color-chip" style="background:#c77dff;"></span>
                    <span class="store-color-chip" style="background:#ffd166;"></span>
                  </div>
                </div>
                <div class="store-item-body">
                  <div class="store-item-header">
                    <span class="store-item-name">Sakura Neon Dream</span>
                    <span class="store-item-rating">⭐ 4.9</span>
                  </div>
                  <div class="store-item-author">Por @KomiFan99 · <span class="store-downloads">📥 14.2k</span></div>
                  <p class="store-item-desc">Estética pastel suave con destellos de cerezo japonés y barra flotante de cristal translúcido.</p>
                  <div class="store-item-footer">
                    <span class="store-item-tag">#Aesthetic</span>
                    <button type="button" class="store-install-btn" data-theme-apply="aesthetic" data-accent="#ff8fa3">
                      ▶ Probar Tema
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tarjeta 2: Neo Tokyo 2077 -->
              <div class="auramusic-store-item" data-category="cyber popular">
                <div class="store-item-preview preview-cyber">
                  <span class="store-preview-badge" style="background: rgba(0, 245, 255, 0.25); color: #00f5ff; border-color: rgba(0,245,255,0.4);">⚡ Destacado</span>
                  <div class="store-preview-glow"></div>
                  <div class="store-preview-chip-row">
                    <span class="store-color-chip" style="background:#00f5ff;"></span>
                    <span class="store-color-chip" style="background:#ff2d78;"></span>
                    <span class="store-color-chip" style="background:#ffe600;"></span>
                  </div>
                </div>
                <div class="store-item-body">
                  <div class="store-item-header">
                    <span class="store-item-name">Neo Tokyo 2077</span>
                    <span class="store-item-rating">⭐ 5.0</span>
                  </div>
                  <div class="store-item-author">Por @JesulutoXd · <span class="store-downloads">📥 28.6k</span></div>
                  <p class="store-item-desc">Diseño mecha futurista con acentos glitch cian y rosa neón de alto contraste y dock holográfico.</p>
                  <div class="store-item-footer">
                    <span class="store-item-tag">#Cyberpunk</span>
                    <button type="button" class="store-install-btn" data-theme-apply="cyberpunk" data-accent="#00f5ff">
                      ▶ Probar Tema
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tarjeta 3: Midnight Lo-Fi Café -->
              <div class="auramusic-store-item" data-category="lofi popular">
                <div class="store-item-preview preview-lofi">
                  <span class="store-preview-badge" style="background: rgba(199, 125, 255, 0.25); color: #e0aaff; border-color: rgba(199,125,255,0.4);">🌙 Relajante</span>
                  <div class="store-preview-glow"></div>
                  <div class="store-preview-chip-row">
                    <span class="store-color-chip" style="background:#3c096c;"></span>
                    <span class="store-color-chip" style="background:#9d4edd;"></span>
                    <span class="store-color-chip" style="background:#e0aaff;"></span>
                  </div>
                </div>
                <div class="store-item-body">
                  <div class="store-item-header">
                    <span class="store-item-name">Midnight Lo-Fi Café</span>
                    <span class="store-item-rating">⭐ 4.8</span>
                  </div>
                  <div class="store-item-author">Por @ChillBeats · <span class="store-downloads">📥 9.8k</span></div>
                  <p class="store-item-desc">Atmósfera oscura con tonos púrpuras cálidos para estudiar y escuchar de noche sin fatiga visual.</p>
                  <div class="store-item-footer">
                    <span class="store-item-tag">#LoFi</span>
                    <button type="button" class="store-install-btn" data-theme-apply="oled" data-accent="#9d4edd">
                      ▶ Probar Tema
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tarjeta 4: Holographic Glass Pro -->
              <div class="auramusic-store-item" data-category="aesthetic">
                <div class="store-item-preview preview-glass">
                  <span class="store-preview-badge" style="background: rgba(112, 214, 255, 0.25); color: #70d6ff; border-color: rgba(112,214,255,0.4);">💎 Glass Pro</span>
                  <div class="store-preview-glow"></div>
                  <div class="store-preview-chip-row">
                    <span class="store-color-chip" style="background:#ffffff;"></span>
                    <span class="store-color-chip" style="background:#70d6ff;"></span>
                    <span class="store-color-chip" style="background:#ff70a6;"></span>
                  </div>
                </div>
                <div class="store-item-body">
                  <div class="store-item-header">
                    <span class="store-item-name">Hologram Glass Pro</span>
                    <span class="store-item-rating">⭐ 4.9</span>
                  </div>
                  <div class="store-item-author">Por @AuraDesign · <span class="store-downloads">📥 18.3k</span></div>
                  <p class="store-item-desc">Vidrio esmerilado translúcido con refracción cromática y dock ultra minimalista estilo Cupertino.</p>
                  <div class="store-item-footer">
                    <span class="store-item-tag">#Glass</span>
                    <button type="button" class="store-install-btn" data-theme-apply="apple" data-accent="#70d6ff">
                      ▶ Probar Tema
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tarjeta 5: Retro 8-Bit Pixel -->
              <div class="auramusic-store-item" data-category="popular">
                <div class="store-item-preview preview-pixel">
                  <span class="store-preview-badge" style="background: rgba(85, 255, 85, 0.25); color: #55ff55; border-color: rgba(85,255,85,0.4);">⛏️ Pixel Art</span>
                  <div class="store-preview-glow"></div>
                  <div class="store-preview-chip-row">
                    <span class="store-color-chip" style="background:#55ff55;"></span>
                    <span class="store-color-chip" style="background:#aa0000;"></span>
                    <span class="store-color-chip" style="background:#55ffff;"></span>
                  </div>
                </div>
                <div class="store-item-body">
                  <div class="store-item-header">
                    <span class="store-item-name">Retro 8-Bit Pixel</span>
                    <span class="store-item-rating">⭐ 4.7</span>
                  </div>
                  <div class="store-item-author">Por @StevePixel · <span class="store-downloads">📥 11.5k</span></div>
                  <p class="store-item-desc">Bloques clásicos, fuentes pixeladas y barras con textura de obsidiana y portal misterioso.</p>
                  <div class="store-item-footer">
                    <span class="store-item-tag">#PixelArt</span>
                    <button type="button" class="store-install-btn" data-theme-apply="minecraft" data-accent="#55ff55">
                      ▶ Probar Tema
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tarjeta 6: Matcha Cream Zen -->
              <div class="auramusic-store-item" data-category="aesthetic lofi">
                <div class="store-item-preview preview-matcha">
                  <span class="store-preview-badge" style="background: rgba(82, 183, 136, 0.25); color: #74c69d; border-color: rgba(82,183,136,0.4);">🍃 Zen Pastel</span>
                  <div class="store-preview-glow"></div>
                  <div class="store-preview-chip-row">
                    <span class="store-color-chip" style="background:#74c69d;"></span>
                    <span class="store-color-chip" style="background:#d8f3dc;"></span>
                    <span class="store-color-chip" style="background:#b7e4c7;"></span>
                  </div>
                </div>
                <div class="store-item-body">
                  <div class="store-item-header">
                    <span class="store-item-name">Matcha Cream Zen</span>
                    <span class="store-item-rating">⭐ 4.8</span>
                  </div>
                  <div class="store-item-author">Por @PastelWave · <span class="store-downloads">📥 7.4k</span></div>
                  <p class="store-item-desc">Paleta verde té matcha y marfil relajante para descansar la vista con elegancia y minimalismo.</p>
                  <div class="store-item-footer">
                    <span class="store-item-tag">#Zen</span>
                    <button type="button" class="store-install-btn" data-theme-apply="aesthetic" data-accent="#52b788">
                      ▶ Probar Tema
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div id="auramusic-store-toast" class="store-toast" style="display:none;"></div>
          </section>
        </main>

        <footer class="auramusic-footer">
          <button type="button" class="auramusic-reset-btn" id="auramusic-reset-btn">Restablecer Ajustes</button>
          <span style="font-size:0.75rem; color:rgba(255,255,255,0.4);">AuraMusic for YouTube Music</span>
        </footer>
      </div>
    `;
    document.body.appendChild(overlay);

    setupHubEvents(launcher, overlay);
    updateUIControls();
  }

  function setupHubEvents(launcher, overlay) {
    const closeBtn = document.getElementById('auramusic-close-btn');

    function openHub() {
      overlay.classList.add('active');
      updateUIControls();
      refreshHubUpdateStatus(false);
    }

    function closeHub() {
      overlay.classList.remove('active');
    }

    launcher.addEventListener('click', (e) => {
      e.stopPropagation();
      openHub();
    });

    const cinemaTabBtn = document.getElementById('hub-cinema-lyrics-tab');
    if (cinemaTabBtn) {
      cinemaTabBtn.addEventListener('click', () => {
        closeHub();
        if (window.AuraMusic?.Lyrics?.openCinemaMode) {
          window.AuraMusic.Lyrics.openCinemaMode();
        } else if (window.openCinemaMode) {
          window.openCinemaMode();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeHub();
      });
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeHub();
      }
    });

    // Cerrar con tecla Escape de forma confiable
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeHub();
      }
    });

    // Pestañas
    const tabs = overlay.querySelectorAll('.auramusic-tab');
    const panels = overlay.querySelectorAll('.auramusic-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(`panel-${tab.dataset.tab}`);
        if (target) target.classList.add('active');
      });
    });

    // Selector de Temas
    overlay.querySelectorAll('.theme-pill-btn[data-theme]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const theme = btn.dataset.theme;
        const state = getState();
        state.theme = theme;
        if (window.applyTheme) {
          window.applyTheme(theme);
        } else if (window.AuraMusic?.applyTheme) {
          window.AuraMusic.applyTheme(theme);
        }
        if (window.saveSettings) window.saveSettings();
        updateUIControls();
      });
    });

    // Selector de Visualizador
    overlay.querySelectorAll('.theme-pill-btn[data-vis]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const vis = btn.dataset.vis;
        const state = getState();
        state.visualizer = vis;
        if (window.applyVisualizerMode) {
          window.applyVisualizerMode(vis);
        } else if (window.AuraMusic?.applyVisualizerMode) {
          window.AuraMusic.applyVisualizerMode(vis);
        }
        if (window.saveSettings) window.saveSettings();
        updateUIControls();
      });
    });

    // Color Picker
    const colorPicker = document.getElementById('auramusic-color-picker');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        const state = getState();
        state.primaryColor = e.target.value;
        document.documentElement.style.setProperty('--auramusic-primary', state.primaryColor);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Toggle Iluminación Ambiental
    const toggleAmbient = document.getElementById('toggle-ambient');
    if (toggleAmbient) {
      toggleAmbient.addEventListener('change', (e) => {
        const state = getState();
        state.ambientGlow = e.target.checked;
        if (window.applyAmbientGlow) window.applyAmbientGlow(state.ambientGlow);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Toggle Limpieza
    const toggleClean = document.getElementById('toggle-clean');
    if (toggleClean) {
      toggleClean.addEventListener('change', (e) => {
        const state = getState();
        state.cleanMode = e.target.checked;
        if (window.applyCleanMode) window.applyCleanMode(state.cleanMode);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Toggle Pantalla de Carga (Intro Splash)
    const toggleSplash = document.getElementById('toggle-splash');
    if (toggleSplash) {
      toggleSplash.addEventListener('change', (e) => {
        const state = getState();
        state.splashScreen = e.target.checked;
        if (window.saveSettings) window.saveSettings();
      });
    }

    const toggleSplashSound = document.getElementById('toggle-splash-sound');
    if (toggleSplashSound) {
      toggleSplashSound.addEventListener('change', (e) => {
        const state = getState();
        state.splashSound = e.target.checked;
        if (window.saveSettings) window.saveSettings();
      });
    }

    const btnPreviewSplash = document.getElementById('btn-preview-splash');
    if (btnPreviewSplash) {
      btnPreviewSplash.addEventListener('click', (e) => {
        e.stopPropagation();
        closeHub();
        if (window.AuraMusic?.Splash?.preview) {
          window.AuraMusic.Splash.preview();
        }
      });
    }

    // Volume Boost Slider
    const volumeSlider = document.getElementById('volume-boost-slider');
    const volumeVal = document.getElementById('volume-boost-val');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const state = getState();
        state.volumeBoost = parseInt(e.target.value, 10);
        if (volumeVal) volumeVal.textContent = `${state.volumeBoost}%`;
        if (window.applyVolumeBoost) window.applyVolumeBoost(state.volumeBoost);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        const state = getState();
        state.playbackSpeed = parseFloat(e.target.value);
        if (speedVal) speedVal.textContent = `${state.playbackSpeed.toFixed(2)}x`;
        if (window.applyPlaybackSpeed) window.applyPlaybackSpeed(state.playbackSpeed);
        if (window.saveSettings) window.saveSettings();
      });
    }

    // Sliders de Ecualizador
    overlay.querySelectorAll('.auramusic-eq-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const band = slider.dataset.band;
        const val = parseInt(e.target.value, 10);
        const state = getState();
        if (!state.eq) state.eq = {};
        state.eq[band] = val;
        const valSpan = document.getElementById(`eq-val-${band}`);
        if (valSpan) valSpan.textContent = `${val > 0 ? '+' : ''}${val}dB`;
        if (window.applyEQ) window.applyEQ();
        if (window.saveSettings) window.saveSettings();
      });
    });

    // Restablecer
    const resetBtn = document.getElementById('auramusic-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const def = window.AuraMusic?.defaultSettings || window.defaultSettings || {};
        const state = getState();
        Object.assign(state, JSON.parse(JSON.stringify(def)));
        if (window.applyAllSettings) {
          window.applyAllSettings();
        }
        if (window.saveSettings) window.saveSettings();
        updateUIControls();
      });
    }

    // --- LÓGICA DE ACTUALIZACIÓN DESDE GITHUB (AuraMusic Hub) ---
    const btnApply = document.getElementById('hub-btn-apply-update');
    const btnReload = document.getElementById('hub-btn-reload-now');
    const btnCheck = document.getElementById('hub-btn-check-update');
    const progressArea = document.getElementById('hub-update-progress-area');
    const progressBar = document.getElementById('hub-update-progress-bar');
    const progressText = document.getElementById('hub-update-progress-text');

    async function refreshHubUpdateStatus(isManual = false) {
      const localVer = getExtVersion();
      const localVerEl = document.getElementById('hub-local-ver-text');
      const remoteVerEl = document.getElementById('hub-remote-ver-text');
      const remoteCommitEl = document.getElementById('hub-remote-commit-text');
      const remoteMsgEl = document.getElementById('hub-remote-msg-text');
      const remoteMsgRow = document.getElementById('hub-remote-msg-row');
      const pill = document.getElementById('hub-update-pill');
      const dot = document.getElementById('hub-update-dot');
      const headerBadge = document.getElementById('hub-version-badge');

      if (localVerEl) localVerEl.textContent = `v${localVer}`;
      if (headerBadge) headerBadge.textContent = `v${localVer}`;

      if (isManual && pill) {
        pill.className = 'hub-git-pill pill-checking';
        pill.textContent = 'Buscando...';
      }

      let info = null;
      try {
        if (window.AuraMusic?.Updater?.checkGithubUpdate) {
          info = await window.AuraMusic.Updater.checkGithubUpdate(false, false, false);
        }
        if (!info) {
          const res = await fetch('http://localhost:3000/api/update/check', { signal: AbortSignal.timeout(3500) });
          if (res.ok) {
            const data = await res.json();
            if (data && data.ok) {
              info = {
                hasUpdate: data.updateAvailable,
                remoteVersion: data.remoteVersion,
                remoteCommit: data.remoteCommit,
                remoteCommitMsg: data.remoteCommitMsg
              };
            }
          }
        }
      } catch (_) {}

      if (info) {
        if (remoteVerEl) remoteVerEl.textContent = info.remoteVersion ? `v${info.remoteVersion}` : `v${localVer}`;
        if (remoteCommitEl) remoteCommitEl.textContent = info.remoteCommit || 'latest';
        if (info.remoteCommitMsg && remoteMsgEl && remoteMsgRow) {
          remoteMsgEl.textContent = info.remoteCommitMsg;
          remoteMsgRow.style.display = 'flex';
        }

        if (info.hasUpdate) {
          if (pill) {
            pill.className = 'hub-git-pill pill-update';
            pill.textContent = '¡Nueva versión!';
          }
          if (dot) dot.style.display = 'block';
          if (btnApply) {
            btnApply.textContent = `🚀 Actualizar a v${info.remoteVersion || 'nueva'} (${info.remoteCommit || 'GitHub'})`;
          }
        } else {
          if (pill) {
            pill.className = 'hub-git-pill pill-synced';
            pill.textContent = 'Al día';
          }
          if (dot) dot.style.display = 'none';
          if (btnApply) {
            btnApply.textContent = '🚀 Sincronizar desde GitHub';
          }
        }
      } else {
        if (pill) {
          pill.className = 'hub-git-pill pill-synced';
          pill.textContent = 'Al día';
        }
        if (remoteVerEl) remoteVerEl.textContent = `v${localVer}`;
      }
    }

    if (btnApply) {
      btnApply.addEventListener('click', async () => {
        btnApply.disabled = true;
        btnApply.style.opacity = '0.7';
        if (progressArea) progressArea.style.display = 'block';
        if (progressBar) progressBar.style.width = '25%';
        if (progressText) progressText.textContent = '⏳ Conectando con GitHub y descargando última versión...';

        let success = false;
        let updateVersion = getExtVersion();

        if (window.AuraMusic?.Updater?.applyGithubUpdateAndReload) {
          const res = await window.AuraMusic.Updater.applyGithubUpdateAndReload({
            onProgress: (msg) => {
              if (progressText) progressText.textContent = `⏳ ${msg}`;
              if (progressBar) progressBar.style.width = '65%';
            },
            onSuccess: (msg) => {
              success = true;
              if (progressText) progressText.textContent = `✅ ${msg}`;
              if (progressBar) progressBar.style.width = '100%';
            },
            onError: (err) => {
              if (progressText) progressText.textContent = `⚠️ ${err}`;
              btnApply.disabled = false;
              btnApply.style.opacity = '1';
            }
          });
          if (res && res.ok) {
            success = true;
            if (res.version) updateVersion = res.version;
          }
        } else {
          try {
            const res = await fetch('http://localhost:3000/api/update/apply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(30000)
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.ok) {
                success = true;
                if (data.version) updateVersion = data.version;
              }
            }
          } catch (_) {}
        }

        if (success) {
          if (progressText) progressText.textContent = `✅ ¡Actualizado a v${updateVersion}! Recargando extensión...`;
          if (progressBar) progressBar.style.width = '100%';
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            try {
              await chrome.storage.local.set({
                auramusic_just_updated: true,
                auramusic_updated_version: updateVersion
              });
            } catch (_) {}
          }
          setTimeout(() => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
            }
            setTimeout(() => window.location.reload(), 600);
          }, 800);
        } else {
          if (progressText) progressText.textContent = '⚡ Recargando extensión en Chrome...';
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
          }
          setTimeout(() => window.location.reload(), 1000);
        }
      });
    }

    if (btnReload) {
      btnReload.addEventListener('click', () => {
        btnReload.disabled = true;
        if (progressArea) progressArea.style.display = 'block';
        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = '⚡ Recargando extensión y YouTube Music...';
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
        }
        setTimeout(() => window.location.reload(), 500);
      });
    }

    if (btnCheck) {
      btnCheck.addEventListener('click', () => {
        refreshHubUpdateStatus(true);
      });
    }

    // Inicializar comprobación de GitHub para el Hub
    setTimeout(() => {
      refreshHubUpdateStatus(false);
    }, 1500);

    // --- LÓGICA DE TIENDA DE TEMAS DE LA COMUNIDAD (AuraMarket) ---
    const filterBtns = overlay.querySelectorAll('.store-filter-btn');
    const storeItems = overlay.querySelectorAll('.auramusic-store-item');
    const storeToast = document.getElementById('auramusic-store-toast');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;

        storeItems.forEach(item => {
          if (filter === 'all') {
            item.style.display = 'flex';
          } else {
            const cats = (item.dataset.category || '').split(' ');
            item.style.display = cats.includes(filter) ? 'flex' : 'none';
          }
        });
      });
    });

    overlay.querySelectorAll('.store-install-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const themeToApply = btn.dataset.themeApply;
        const accent = btn.dataset.accent;
        const state = getState();

        if (themeToApply) {
          state.theme = themeToApply;
          if (window.applyTheme) window.applyTheme(themeToApply);
          else if (window.AuraMusic?.applyTheme) window.AuraMusic.applyTheme(themeToApply);
        }

        if (accent) {
          state.primaryColor = accent;
          document.documentElement.style.setProperty('--auramusic-primary', accent);
          const picker = document.getElementById('auramusic-color-picker');
          if (picker) picker.value = accent;
        }

        if (window.saveSettings) window.saveSettings();
        updateUIControls();

        if (storeToast) {
          const name = btn.closest('.auramusic-store-item')?.querySelector('.store-item-name')?.textContent || 'Tema';
          storeToast.textContent = `✨ ¡Tema "${name}" activado en YouTube Music!`;
          storeToast.style.display = 'block';
          storeToast.classList.add('show');
          setTimeout(() => {
            storeToast.classList.remove('show');
            setTimeout(() => { storeToast.style.display = 'none'; }, 300);
          }, 2800);
        }
      });
    });
  }

  function updateUIControls() {
    const state = getState();
    // Marcar tema activo
    document.querySelectorAll('.theme-pill-btn[data-theme]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === state.theme);
    });
    // Marcar visualizador activo
    document.querySelectorAll('.theme-pill-btn[data-vis]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vis === state.visualizer);
    });
    // Actualizar sliders y switches
    const colorPicker = document.getElementById('auramusic-color-picker');
    if (colorPicker && state.primaryColor) colorPicker.value = state.primaryColor;
    const toggleAmbient = document.getElementById('toggle-ambient');
    if (toggleAmbient) toggleAmbient.checked = !!state.ambientGlow;
    const toggleClean = document.getElementById('toggle-clean');
    if (toggleClean) toggleClean.checked = !!state.cleanMode;
    const toggleSplash = document.getElementById('toggle-splash');
    if (toggleSplash) toggleSplash.checked = state.splashScreen !== false;
    const toggleSplashSound = document.getElementById('toggle-splash-sound');
    if (toggleSplashSound) toggleSplashSound.checked = state.splashSound !== false;
    const volumeSlider = document.getElementById('volume-boost-slider');
    const volumeVal = document.getElementById('volume-boost-val');
    if (volumeSlider && state.volumeBoost) {
      volumeSlider.value = state.volumeBoost;
      if (volumeVal) volumeVal.textContent = `${state.volumeBoost}%`;
    }
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    if (speedSlider && state.playbackSpeed) {
      speedSlider.value = state.playbackSpeed;
      if (speedVal) speedVal.textContent = `${state.playbackSpeed.toFixed(2)}x`;
    }
    if (state.eq) {
      Object.keys(state.eq).forEach(band => {
        const slider = document.querySelector(`.auramusic-eq-slider[data-band="${band}"]`);
        const valSpan = document.getElementById(`eq-val-${band}`);
        if (slider) slider.value = state.eq[band];
        if (valSpan) valSpan.textContent = `${state.eq[band] > 0 ? '+' : ''}${state.eq[band]}dB`;
      });
    }
  }

  window.AuraMusic.Hub = {
    injectLauncherAndHub,
    setupHubEvents,
    updateUIControls
  };
})();
