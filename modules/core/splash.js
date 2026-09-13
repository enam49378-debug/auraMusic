/**
 * AuraMusic - Intro Cinemática con Portal Triangular Transparente
 * 
 * Secuencia de animación:
 * 1. Seeker line roja con flare que llena suavemente la pantalla.
 * 2. El punto flare se expande convirtiéndose en el botón de YouTube Music mientras escribe el texto.
 * 3. AuraMusic cae con física elástica al lado derecho.
 * 4. Carga de energía neón vibrante en ambos bloques.
 * 5. Fusión magnética al centro con destello, ondas de choque y chispas.
 * 6. Nacimiento del emblema circular 50/50 (mitad YouTube Music, mitad Aura).
 * 7. Apertura del portal: el triángulo de reproducción ▶ se vuelve 100% transparente,
 *    revelando la página real de YouTube Music cargada al fondo, mientras la cámara
 *    se sumerge dentro del triángulo en un zoom infinito hasta entrar fluidamente a la app.
 * 
 * NOTA: La intro NO se puede omitir con clics ni teclas accidentales.
 * Solo puede desactivarse desde la configuración en el panel de AuraMusic.
 */

(function () {
  'use strict';

  // Solo ejecutar en la ventana principal (no en iframes de anuncios o reproductores embebidos)
  if (window.top !== window.self) return;

  function getSettings() {
    try {
      const saved = localStorage.getItem('auramusic_settings');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return { splashScreen: true, splashSound: true };
  }

  function getSoundUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL('assets/startup.mp4');
      }
    } catch (_) {}
    return 'assets/startup.mp4';
  }

  function getLogoUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL('assets/aura_logo_5050.png');
      }
    } catch (_) {}
    return 'assets/aura_logo_5050.png';
  }

  let audioInstance = null;
  let isDismissed = false;
  let activeTimers = [];
  let activeMotions = [];
  let portalFrame = 0;
  let activeSparks = [];

  function clearAllAnimations() {
    if (portalFrame) {
      cancelAnimationFrame(portalFrame);
      portalFrame = 0;
    }
    activeTimers.forEach(id => clearTimeout(id));
    activeTimers = [];

    activeMotions.forEach(anim => {
      try { anim.cancel(); } catch (_) {}
    });
    activeMotions = [];

    activeSparks.forEach(s => {
      try { s.remove(); } catch (_) {}
    });
    activeSparks = [];
  }

  function later(fn, delay) {
    const id = setTimeout(fn, delay);
    activeTimers.push(id);
    return id;
  }

  function motion(el, keyframes, duration, easing = 'linear') {
    if (!el) return null;
    const anim = el.animate(keyframes, {
      duration,
      easing,
      fill: 'forwards'
    });
    activeMotions.push(anim);
    return anim;
  }

  function playSoundIfAllowed(soundEnabled) {
    if (!soundEnabled) return;
    try {
      if (!audioInstance) {
        audioInstance = new Audio(getSoundUrl());
      }
      audioInstance.currentTime = 0;
      audioInstance.volume = 0.85;
      audioInstance.play().catch(() => {
        // Silencio seguro si las políticas de autoplay de Chrome lo restringen
      });
    } catch (_) {}
  }

  function createSplash(isManualPreview = false) {
    const settings = getSettings();
    if (!isManualPreview && settings.splashScreen === false) {
      return;
    }

    const existing = document.getElementById('auramusic-splash-screen');
    if (existing) {
      try { existing.remove(); } catch (_) {}
    }

    isDismissed = false;
    clearAllAnimations();

    // Bloquear scroll de la página para evitar que aparezca la barra lateral fea
    document.documentElement.classList.add('auramusic-splash-active');
    if (document.body) document.body.classList.add('auramusic-splash-active');

    const soundEnabled = isManualPreview ? true : (settings.splashSound !== false);
    const logoUrl = getLogoUrl();

    const splash = document.createElement('div');
    splash.id = 'auramusic-splash-screen';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-label', 'AuraMusic Intro');

    splash.innerHTML = `
      <!-- Fondo oscuro continuo con máscara de portal triangular -->
      <svg class="splash-stage-backdrop" id="splash-stage-backdrop" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <defs>
          <radialGradient id="splash-bg-glow-yt" cx="30%" cy="55%" r="60%">
            <stop id="splash-glow-stop-yt" offset="0%" stop-color="#ff0000" stop-opacity="0.10"/>
            <stop offset="70%" stop-color="#ff0000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="splash-bg-glow-aura" cx="70%" cy="55%" r="60%">
            <stop id="splash-glow-stop-aura" offset="0%" stop-color="#a855f7" stop-opacity="0.10"/>
            <stop offset="70%" stop-color="#a855f7" stop-opacity="0"/>
          </radialGradient>
          <!-- Máscara de portal continuo: blanco es opaco (#08090f), negro es transparente a YouTube Music -->
          <mask id="splash-backdrop-mask" maskUnits="userSpaceOnUse" x="-50000" y="-50000" width="100000" height="100000">
            <rect x="-50000" y="-50000" width="100000" height="100000" fill="white"/>
            <polygon id="splash-portal-triangle" points="0,0 0,0 0,0" fill="black"/>
          </mask>
        </defs>
        <g mask="url(#splash-backdrop-mask)">
          <rect width="100%" height="100%" fill="#08090f"/>
          <rect width="100%" height="100%" fill="url(#splash-bg-glow-yt)"/>
          <rect width="100%" height="100%" fill="url(#splash-bg-glow-aura)"/>
        </g>
      </svg>

      <div class="splash-intro-stage" id="splash-intro-stage">

        <!-- 1. Línea Seeker YouTube TV -->
        <div class="yt-loader-box" id="splash-yt-loader">
          <div class="yt-loader-play-triangle"></div>
          <div class="yt-loader-track">
            <div class="yt-loader-fill" id="splash-loader-fill">
              <div class="yt-loader-flare"></div>
            </div>
          </div>
        </div>

        <!-- 2. Bloque YouTube Music (se revela desde el punto flare) -->
        <div class="yt-block" id="splash-yt-block">
          <div class="yt-red-pill">
            <div class="yt-play-arrow"></div>
            <span class="yt-point-skin" aria-hidden="true"></span>
          </div>
          <div class="yt-text-wrap">
            <span class="yt-txt-youtube">YouTube</span>
            <span class="yt-txt-music">Music</span>
          </div>
        </div>

        <!-- Separador de neón -->
        <div class="side-divider" id="splash-divider"></div>

        <!-- 3. Bloque AuraMusic -->
        <div class="aura-block" id="splash-aura-block">
          <span class="aura-sparkle">✨</span>
          <span class="aura-title">AuraMusic</span>
        </div>

        <!-- 4 & 5. Efectos de Fusión y Choque -->
        <div class="fusion-flash" id="splash-fusion-flash"></div>
        <div class="fusion-ring"   id="splash-fusion-ring"></div>
        <div class="fusion-ring-2" id="splash-fusion-ring-2"></div>

        <!-- 6. Emblema 50/50 y Portal Triangular Transparente -->
        <div class="final-fused-stage" id="splash-final-stage">
          <div class="fused-emblem-box" id="splash-emblem-box">
            <div class="fused-ambient-glow" id="splash-emblem-glow"></div>
            <div class="fused-emblem-circle" id="splash-emblem-circle">
              <svg class="fused-emblem-svg" id="splash-portal-logo" xmlns="http://www.w3.org/2000/svg" viewBox="142 142 1316 1316" role="img" aria-label="AuraMusic Emblema 50/50">
                <defs>
                  <clipPath id="aura-disc-clip"><circle cx="800" cy="800" r="658"/></clipPath>
                  <linearGradient id="aura-gradient-half" gradientUnits="userSpaceOnUse" x1="800" y1="800" x2="1458" y2="800">
                    <stop offset="0" stop-color="#ff7959"/>
                    <stop offset=".15" stop-color="#e86d5d"/>
                    <stop offset=".30" stop-color="#cd5e64"/>
                    <stop offset=".46" stop-color="#ad4c6b"/>
                    <stop offset=".61" stop-color="#8e3b6f"/>
                    <stop offset=".76" stop-color="#6f2b78"/>
                    <stop offset="1" stop-color="#461281"/>
                  </linearGradient>

                  <!-- Máscara interna para perforar el triángulo en el disco 50/50 -->
                  <mask id="aura-disc-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1600">
                    <rect width="1600" height="1600" fill="white"/>
                    <path id="splash-portal-hole" d="M679 625 L965 789 L679 962 Z" fill="black" opacity="0"/>
                  </mask>
                </defs>

                <!-- Grupo enmascarado del disco circular -->
                <g mask="url(#aura-disc-mask)" clip-path="url(#aura-disc-clip)">
                  <g id="splash-animated-logo" opacity="0">
                    <g id="splash-brand-halves" transform="rotate(0 800 800)">
                      <path d="M800 142 A658 658 0 0 0 800 1458 Z" fill="#f10921"/>
                      <path d="M800 142 A658 658 0 0 1 800 1458 Z" fill="url(#aura-gradient-half)"/>
                    </g>
                    <circle cx="800" cy="800" r="331" fill="none" stroke="white" stroke-width="33"/>
                  </g>
                  <image id="splash-reference-logo" href="${logoUrl}" width="1316" height="1316" x="142" y="142"/>
                </g>

                <!-- Triángulo central del logo que se desvanece suavemente al abrirse el portal -->
                <path id="splash-center-triangle" d="M679 625 L965 789 L679 962 Z" fill="white" opacity="0"/>
              </svg>
              <div class="fused-shimmer"></div>
            </div>
          </div>
        </div>

      </div>
    `;

    // Inyección limpia en el documento
    const container = document.body || document.documentElement;
    if (container) {
      container.appendChild(splash);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        (document.body || document.documentElement).appendChild(splash);
      });
    }

    // ── OBTENCIÓN DE ELEMENTOS ─────────────────────────────────────────
    const stage          = splash.querySelector('#splash-intro-stage');
    const backdrop       = splash.querySelector('#splash-stage-backdrop');
    const loaderBox      = splash.querySelector('#splash-yt-loader');
    const loaderFill     = splash.querySelector('#splash-loader-fill');
    const loaderTrack    = loaderBox.querySelector('.yt-loader-track');
    const loaderFlare    = loaderBox.querySelector('.yt-loader-flare');
    const loaderTriangle = loaderBox.querySelector('.yt-loader-play-triangle');
    const ytBlock        = splash.querySelector('#splash-yt-block');
    const ytPill         = ytBlock.querySelector('.yt-red-pill');
    const ytArrow        = ytBlock.querySelector('.yt-play-arrow');
    const pointSkin      = ytBlock.querySelector('.yt-point-skin');
    const ytWords        = [
      { el: ytBlock.querySelector('.yt-txt-youtube'), text: 'YouTube' },
      { el: ytBlock.querySelector('.yt-txt-music'),   text: 'Music' }
    ];
    const auraBlock      = splash.querySelector('#splash-aura-block');
    const divider        = splash.querySelector('#splash-divider');
    const flashEl        = splash.querySelector('#splash-fusion-flash');
    const ringEl         = splash.querySelector('#splash-fusion-ring');
    const ring2El        = splash.querySelector('#splash-fusion-ring-2');
    const finalStage     = splash.querySelector('#splash-final-stage');
    const emblemBox      = splash.querySelector('#splash-emblem-box');
    const portalHole     = splash.querySelector('#splash-portal-hole');
    const portalTriangle = splash.querySelector('#splash-portal-triangle');
    const centerTriangle = splash.querySelector('#splash-center-triangle');
    const brandHalves    = splash.querySelector('#splash-brand-halves');
    const referenceLogo  = splash.querySelector('#splash-reference-logo');
    const animatedLogo   = splash.querySelector('#splash-animated-logo');

    // Helper para generar partículas de choque
    function spawnSparks(count = 22) {
      if (!stage || !divider) return;
      const frame = stage.getBoundingClientRect();
      const divRect = divider.getBoundingClientRect();
      const cx = (divRect.left + divRect.width / 2) - frame.left;
      const cy = (divRect.top  + divRect.height / 2) - frame.top;

      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'spark-particle';
        const hue = Math.random() > 0.5 ? 15 : 285;
        p.style.cssText = `
          left: ${cx}px; top: ${cy}px;
          background: hsl(${hue}, 100%, 70%);
          box-shadow: 0 0 6px hsl(${hue}, 100%, 70%);
        `;
        stage.appendChild(p);
        activeSparks.push(p);

        const angle = (Math.random() * 360) * Math.PI / 180;
        const dist  = 60 + Math.random() * 120;
        const dur   = 0.4 + Math.random() * 0.4;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;

        motion(p, [
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0.2)`, opacity: 0 }
        ], dur * 1000, 'cubic-bezier(.16,1,.3,1)');

        later(() => {
          try { p.remove(); } catch (_) {}
        }, dur * 1000 + 50);
      }
    }

    // Revelar YouTube Music desde el punto final del seeker
    function revealYouTubeFromPoint(ytOff) {
      if (isDismissed) return;
      const dotRect = loaderFlare.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const sx = stageRect.width / stage.offsetWidth || 1;
      const sy = stageRect.height / stage.offsetHeight || 1;

      ytBlock.style.transition = 'none';
      ytBlock.style.transform = `translateX(${ytOff}px) scale(1)`;
      ytBlock.style.opacity = '1';

      const widths = ytWords.map(({ el }) => el.getBoundingClientRect().width / sx);
      ytWords.forEach(({ el }, i) => {
        el.style.width = `${widths[i]}px`;
        el.textContent = '';
        el.style.visibility = 'visible';
      });

      const target = ytPill.getBoundingClientRect();
      const dx = (dotRect.left + dotRect.width / 2 - target.left - target.width / 2) / sx;
      const dy = (dotRect.top + dotRect.height / 2 - target.top - target.height / 2) / sy;
      const fromX = dotRect.width / Math.max(target.width, 1);
      const fromY = dotRect.height / Math.max(target.height, 1);

      const clamp = n => Math.max(0, Math.min(1, n));
      const smooth = n => { n = clamp(n); return n * n * n * (10 + n * (-15 + 6 * n)); };
      const frames = [];

      // 30 frames optimizados 100% para GPU compositor (cero recálculo de diseño o rasterización en CPU)
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const grow = smooth(u / .27);
        const travel = smooth((u - .16) / .84);
        const lift = Math.min(32, stage.offsetHeight * .07);
        const x = dx * (1 - travel);
        const y = dy * (1 - travel) - lift * Math.sin(Math.PI * travel);
        const scaleX = fromX + (1 - fromX) * grow;
        const scaleY = fromY + (1 - fromY) * grow;
        frames.push({
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`,
          offset: u
        });
      }

      ytPill.style.transform = frames[0].transform;
      loaderFlare.style.opacity = '0';
      motion(ytPill, frames, 880);
      motion(pointSkin, [{ opacity: 1 }, { opacity: 0 }], 180, 'ease-out');
      motion(ytArrow, [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: .35 },
        { opacity: 1, offset: 1 }
      ], 300, 'ease-out');

      motion(loaderTrack, [
        { transform: 'scaleX(1)', opacity: 1 },
        { transform: 'scaleX(0)', opacity: 0 }
      ], 220, 'cubic-bezier(.4,0,.2,1)');
      motion(loaderTriangle, [{ opacity: 1 }, { opacity: 0 }], 160, 'ease-out');

      later(() => {
        loaderBox.style.opacity = '0';
      }, 230);

      let letter = 0;
      ytWords.forEach(({ el, text }) => {
        for (let count = 1; count <= text.length; count++) {
          const len = count;
          later(() => {
            if (!isDismissed) el.textContent = text.slice(0, len);
          }, 280 + letter * 43);
          letter++;
        }
      });
    }

    // ── INICIALIZACIÓN Y FLUJO PRINCIPAL DE TIEMPOS ───────────────────
    // La barra inicia vacía (0%) en reposo silencioso mientras YouTube Music procesa scripts
    loaderFill.style.width = '0%';
    loaderFlare.style.opacity = '0';

    function waitForAppReady(minMs = 600, maxMs = 2200) {
      return new Promise(resolve => {
        const start = Date.now();
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          resolve();
        };

        if (document.readyState === 'complete') {
          setTimeout(done, minMs);
        } else {
          window.addEventListener('load', () => {
            const elapsed = Date.now() - start;
            setTimeout(done, Math.max(0, minMs - elapsed));
          }, { once: true });
        }

        // Límite máximo de seguridad para garantizar que jamás se quede esperando
        setTimeout(done, maxMs);
      });
    }

    // ── CONTROLADOR DE RELOJ MAESTRO DE AUDIO (INMUNE A LAG Y CAÍDAS DE FPS) ──
    const T_FILL_END   = 1.05;
    const T_DROP       = 1.53;
    const T_CHARGE     = 2.18;
    const T_COLLIDE    = 2.98;
    const T_IMPACT     = 3.48;
    const T_PORTAL     = 4.68;
    const T_PORTAL_DUR = 3.40;
    const T_END        = 8.08;

    let triggered = {
      reveal: false,
      drop: false,
      charge: false,
      collide: false,
      impact: false,
      portalInit: false,
      ended: false
    };

    // Parámetros calculados para el vuelo de cámara del portal triangular
    const clamp = n => Math.max(0, Math.min(1, n));
    const smooth = n => { n = clamp(n); return n * n * n * (10 + n * (-15 + 6 * n)); };
    let portalOriginX = 0;
    let portalOriginY = 0;
    let portalSize = 190;
    let portalUnit = 190 / 1316;
    let portalEndScale = 45;
    let dx = -38 * portalUnit;
    let dy = -10 * portalUnit;
    let cx_v = -25.67 * portalUnit;
    let cy_v = -8.0 * portalUnit;
    let holdTransform = '';

    function onMasterClockTick(t, ytOff, auOff) {
      if (isDismissed) return;

      // 1. Seeker Fill: La barra roja sigue matemáticamente el tiempo exacto del audio
      if (t < T_FILL_END) {
        loaderFlare.style.opacity = '1';
        const progress = Math.min(1, Math.max(0, t / T_FILL_END));
        loaderFill.style.width = (progress * 100).toFixed(1) + '%';
      }

      // 2. Revelación de YouTube Music (1.05s)
      if (t >= T_FILL_END && !triggered.reveal) {
        triggered.reveal = true;
        loaderFill.style.width = '100%';
        revealYouTubeFromPoint(ytOff);
      }

      // 3. Caída elástica de AuraMusic (1.53s)
      if (t >= T_DROP && !triggered.drop) {
        triggered.drop = true;
        divider.style.transition = 'all 320ms ease';
        divider.style.opacity = '0.55';
        divider.style.transform = 'scaleY(1)';

        auraBlock.style.transition = 'none';
        motion(auraBlock, [
          { transform: `translateX(${auOff}px) translateY(-280px) scale(1.1)`, opacity: 0, offset: 0, easing: 'cubic-bezier(.3,0,.6,1)' },
          { transform: `translateX(${auOff}px) translateY(7px) scale(1.015,.985)`, opacity: 1, offset: .68, easing: 'cubic-bezier(.16,1,.3,1)' },
          { transform: `translateX(${auOff}px) translateY(-3px) scale(.998,1.002)`, opacity: 1, offset: .86, easing: 'ease-in-out' },
          { transform: `translateX(${auOff}px) translateY(0) scale(1)`, opacity: 1, offset: 1 }
        ], 650);
      }

      // 4. Carga de energía neón en ambos bloques (2.18s)
      if (t >= T_CHARGE && !triggered.charge) {
        triggered.charge = true;
        ytBlock.classList.add('charging');
        auraBlock.classList.add('charging');
        divider.classList.add('lit');
        backdrop.classList.add('energized');
      }

      // 5. Fusión magnética hacia el centro (2.98s)
      if (t >= T_COLLIDE && !triggered.collide) {
        triggered.collide = true;
        ytBlock.classList.remove('charging');
        auraBlock.classList.remove('charging');

        [ [ytBlock, ytOff], [auraBlock, auOff] ].forEach(([el, offset]) => {
          el.style.transition = 'none';
          motion(el, [
            { transform: `translateX(${offset}px) scale(1)`, opacity: 1, filter: 'blur(0px)', offset: 0, easing: 'ease-out' },
            { transform: `translateX(${offset + Math.sign(offset) * 10}px) scale(1.02)`, opacity: 1, filter: 'blur(0px)', offset: .22, easing: 'cubic-bezier(.65,0,.85,.3)' },
            { transform: 'translateX(0px) scale(.78)', opacity: 0, filter: 'blur(2px)', offset: 1 }
          ], 500);
        });

        divider.style.transition = 'all 200ms ease';
        divider.style.transform = 'scaleY(2)';
      }

      // 6. Impacto sonoro, flash, anillos de choque, chispas y nacimiento del logo 50/50 (3.48s)
      if (t >= T_IMPACT && !triggered.impact) {
        triggered.impact = true;
        spawnSparks(22);
        ytBlock.style.opacity = '0';
        auraBlock.style.opacity = '0';
        divider.classList.remove('lit');
        divider.style.opacity = '0';
        backdrop.classList.remove('energized');

        flashEl.style.transition = 'none';
        motion(flashEl, [
          { opacity: 0, offset: 0 },
          { opacity: .88, offset: .12, easing: 'cubic-bezier(.22,1,.36,1)' },
          { opacity: 0, offset: 1 }
        ], 480);

        ringEl.style.transition = 'none';
        ring2El.style.transition = 'none';
        motion(ringEl, [
          { transform: 'scale(.15)', opacity: 0, offset: 0, easing: 'cubic-bezier(.16,1,.3,1)' },
          { transform: 'scale(5.5)', opacity: .9, offset: .38, easing: 'ease-out' },
          { transform: 'scale(8.5)', opacity: 0, offset: 1 }
        ], 690);

        later(() => {
          if (!isDismissed) {
            motion(ring2El, [
              { transform: 'scale(.1)', opacity: 0, offset: 0, easing: 'cubic-bezier(.16,1,.3,1)' },
              { transform: 'scale(6.5)', opacity: .65, offset: .4, easing: 'ease-out' },
              { transform: 'scale(11)', opacity: 0, offset: 1 }
            ], 760);
          }
        }, 80);

        later(() => {
          if (!isDismissed) finalStage.classList.add('active');
        }, 60);
      }

      // 7. Vuelo hacia el interior del triángulo del portal (4.68s - 8.08s)
      if (t >= T_PORTAL) {
        if (!triggered.portalInit) {
          triggered.portalInit = true;

          // Medir el centro físico y escala exactos del emblema directamente en el momento del vuelo
          const bRect = backdrop.getBoundingClientRect();
          const eRect = emblemBox.getBoundingClientRect();
          portalOriginX = (eRect.left + eRect.width / 2) - bRect.left;
          portalOriginY = (eRect.top + eRect.height / 2) - bRect.top;
          portalSize = eRect.width || 190;
          portalUnit = portalSize / 1316;

          const inRadiusPx = 96 * portalUnit;
          const screenRadius = Math.hypot(bRect.width / 2, bRect.height / 2);
          portalEndScale = Math.max(35, (screenRadius / inRadiusPx) * 1.65);

          dx = -38 * portalUnit;
          dy = -10 * portalUnit;
          cx_v = -25.67 * portalUnit;
          cy_v = -8.0 * portalUnit;

          holdTransform = getComputedStyle(finalStage).transform;
          finalStage.style.transform = holdTransform;
          finalStage.style.opacity = '1';
          finalStage.classList.add('portal-flight');
          splash.classList.add('portal-active');

          motion(finalStage, [
            { transform: holdTransform },
            { transform: 'matrix(1, 0, 0, 1, 0, 0)' }
          ], 260, 'cubic-bezier(.2,0,0,1)');

          later(() => {
            if (!isDismissed) finalStage.style.transform = 'matrix(1, 0, 0, 1, 0, 0)';
          }, 270);

          animatedLogo.style.opacity = '1';
          motion(referenceLogo, [{ opacity: 1 }, { opacity: 0 }], 180, 'ease-in-out');
          if (centerTriangle) {
            motion(centerTriangle, [{ opacity: 1 }, { opacity: 0 }], 180, 'ease-out');
          }
        }

        const u = clamp((t - T_PORTAL) / T_PORTAL_DUR);

        // Transformación de cámara acoplada frame a frame al audio
        const angle = 360 * smooth((u - .15) / .55);
        const cameraTravel = .12 * smooth(u / .70) + .88 * smooth((u - .43) / .57);
        const scale = Math.exp(Math.log(portalEndScale) * cameraTravel);
        const align = smooth((u - .28) / .40);
        const rad = angle * Math.PI / 180;

        const tx = -(dx * Math.cos(rad) - dy * Math.sin(rad)) * scale * align;
        const ty = -(dx * Math.sin(rad) + dy * Math.cos(rad)) * scale * align;

        emblemBox.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
        portalHole.setAttribute('opacity', smooth(u / 0.05).toFixed(3));

        // Rotación continua 50/50
        const angleHalves = 180 * smooth((u - .06) / .49);
        brandHalves.setAttribute('transform', `rotate(${angleHalves.toFixed(1)} 800 800)`);

        // Recorte exacto en el fondo oscuro
        if (portalTriangle) {
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const openU = Math.min(1.10, Math.max(0, smooth(u / 0.08) * 1.10));

          if (openU > 0) {
            const calcPt = (vx, vy) => {
              const lx = cx_v + (vx - cx_v) * openU;
              const ly = cy_v + (vy - cy_v) * openU;
              const rx = (lx * cos - ly * sin) * scale;
              const ry = (lx * sin + ly * cos) * scale;
              return `${(portalOriginX + tx + rx).toFixed(1)},${(portalOriginY + ty + ry).toFixed(1)}`;
            };

            const p1 = calcPt(-121 * portalUnit, -175 * portalUnit);
            const p2 = calcPt(165 * portalUnit, -11 * portalUnit);
            const p3 = calcPt(-121 * portalUnit, 162 * portalUnit);

            portalTriangle.setAttribute('points', `${p1} ${p2} ${p3}`);
          } else {
            portalTriangle.setAttribute('points', '0,0 0,0 0,0');
          }
        }
      }

      // 8. Conclusión e ingreso definitivo a YouTube Music
      if (t >= T_END && !triggered.ended) {
        triggered.ended = true;
        brandHalves.setAttribute('transform', 'rotate(180 800 800)');
        finalStage.style.display = 'none';
        stage.style.display = 'none';
        dismissSplash(true);
      }
    }

    waitForAppReady(600, 2200).then(() => {
      if (isDismissed) return;

      const frameW = stage.offsetWidth || window.innerWidth;
      const ytOff  = -Math.round(frameW * 0.20);
      const auOff  = Math.round(frameW * 0.20);

      // Estado inicial de bloques
      ytBlock.style.transform = `translateX(${ytOff}px) scale(0.85)`;
      auraBlock.style.transform = `translateX(${auOff}px) translateY(-280px) scale(1.1)`;

      let masterFrame = 0;
      let fallbackStartTime = 0;
      let isAudioMaster = false;

      function masterTick() {
        if (isDismissed) return;
        let t = 0;
        if (isAudioMaster && audioInstance && !audioInstance.paused) {
          t = audioInstance.currentTime;
        } else if (fallbackStartTime > 0) {
          t = (performance.now() - fallbackStartTime) / 1000;
        }

        onMasterClockTick(t, ytOff, auOff);

        if (!triggered.ended) {
          masterFrame = requestAnimationFrame(masterTick);
          portalFrame = masterFrame;
        }
      }

      function startMasterLoop() {
        if (!isAudioMaster) {
          fallbackStartTime = performance.now();
        }
        masterFrame = requestAnimationFrame(masterTick);
        portalFrame = masterFrame;
      }

      if (soundEnabled) {
        try {
          if (!audioInstance) {
            audioInstance = new Audio(getSoundUrl());
          }
          audioInstance.preload = 'auto';
          audioInstance.currentTime = 0;
          audioInstance.volume = 0.85;

          let started = false;
          const onAudioPlaying = () => {
            if (started) return;
            started = true;
            isAudioMaster = true;
            startMasterLoop();
          };

          audioInstance.addEventListener('playing', onAudioPlaying, { once: true });
          audioInstance.addEventListener('timeupdate', () => {
            if (!started && audioInstance.currentTime > 0) {
              onAudioPlaying();
            }
          });
          audioInstance.addEventListener('ended', () => {
            if (!isDismissed) dismissSplash(true);
          });

          const p = audioInstance.play();
          if (p && p.then) {
            p.then(() => {}).catch(() => {
              // Autoplay bloqueado por Chrome -> fallback inmediato sin trabarse
              if (!started) {
                started = true;
                isAudioMaster = false;
                startMasterLoop();
              }
            });
          }

          // Timeout de seguridad en caso de que el driver de audio demore
          setTimeout(() => {
            if (!started) {
              started = true;
              if (audioInstance && !audioInstance.paused && audioInstance.currentTime > 0) {
                isAudioMaster = true;
              } else {
                isAudioMaster = false;
              }
              startMasterLoop();
            }
          }, 350);
        } catch (e) {
          isAudioMaster = false;
          startMasterLoop();
        }
      } else {
        isAudioMaster = false;
        startMasterLoop();
      }
    });

    // Temporizador de seguridad máximo (garantiza que jamás se bloquee la pantalla ante cualquier imprevisto)
    later(() => {
      dismissSplash(false);
    }, 12000);
  }

  function dismissSplash(immediate = false) {
    if (isDismissed) return;
    isDismissed = true;

    document.documentElement.classList.remove('auramusic-splash-active');
    if (document.body) document.body.classList.remove('auramusic-splash-active');

    const splash = document.getElementById('auramusic-splash-screen');
    if (splash) {
      // Ocultar de inmediato los elementos internos para que JAMÁS salte el logo al final
      const finalStage = splash.querySelector('#splash-final-stage');
      if (finalStage) finalStage.style.display = 'none';
      const stage = splash.querySelector('#splash-intro-stage');
      if (stage) stage.style.display = 'none';
      const backdrop = splash.querySelector('#splash-stage-backdrop');
      if (backdrop) backdrop.style.display = 'none';
    }

    // Desvanecer volumen de audio suavemente si está reproduciéndose
    try {
      if (audioInstance && !audioInstance.paused) {
        let vol = audioInstance.volume;
        const fade = setInterval(() => {
          vol = Math.max(0, vol - 0.2);
          audioInstance.volume = vol;
          if (vol <= 0) {
            clearInterval(fade);
            audioInstance.pause();
          }
        }, 30);
      }
    } catch (_) {}

    clearAllAnimations();

    if (splash) {
      if (immediate) {
        try { splash.remove(); } catch (_) {}
      } else {
        splash.classList.add('splash-dismissed');
        setTimeout(() => {
          try { splash.remove(); } catch (_) {}
        }, 180);
      }
    }
  }

  function onPageReady() {
    // La página terminó de cargar sus componentes en segundo plano.
    // Permitimos que la intro corra completa hasta culminar el zoom del portal de forma fluida.
  }

  // Ejecución automática al arrancar la página
  createSplash(false);

  // Exponer API para pruebas o control desde el Hub de AuraMusic
  window.AuraMusic = window.AuraMusic || {};
  window.AuraMusic.Splash = {
    dismiss: onPageReady,
    preview: () => createSplash(true),
    updateStatus: () => {}
  };
})();
