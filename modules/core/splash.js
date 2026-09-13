/**
 * AuraMusic - Intro Cinemática con Portal Triangular Transparente
 * 
 * Recrea la secuencia de alta gama estilo YouTube TV + AuraMusic:
 * 1. Línea Seeker de carga roja con estela y destello.
 * 2. El punto final se expande y se convierte en el botón rojo de YouTube Music.
 * 3. AuraMusic desciende con física elástica al lado derecho.
 * 4. Carga de energía neón vibrante en ambos bloques.
 * 5. Fusión magnética al centro con colisión, destello, ondas de choque y chispas.
 * 6. Nacimiento del emblema circular 50/50 (mitad YouTube Music, mitad Aura).
 * 7. Apertura del portal: el triángulo de reproducción ▶ se vuelve 100% transparente,
 *    revelando la página real y cargada de YouTube Music al fondo, mientras la cámara
 *    se sumerge dentro del triángulo en un zoom infinito hasta entrar a la app.
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
      audioInstance.play().catch(e => {
        // Política de autoplay de Chrome (se silencia sin trabar la animación)
        console.warn('AuraMusic: Autoplay de audio diferido por política de navegador.');
      });
    } catch (e) {
      console.warn('AuraMusic: Error de audio startup:', e);
    }
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

    const soundEnabled = isManualPreview ? true : (settings.splashSound !== false);
    const logoUrl = getLogoUrl();

    const splash = document.createElement('div');
    splash.id = 'auramusic-splash-screen';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-label', 'AuraMusic Intro');

    splash.innerHTML = `
      <!-- Fondo oscuro previo al portal -->
      <div class="splash-stage-backdrop" id="splash-stage-backdrop"></div>

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

                  <!-- Máscara de apertura: El triángulo negro corta un orificio 100% transparente en el fondo y en el logo -->
                  <mask id="aura-play-aperture" maskUnits="userSpaceOnUse" x="-50000" y="-50000" width="100000" height="100000" style="mask-type:luminance">
                    <rect x="-50000" y="-50000" width="100000" height="100000" fill="white"/>
                    <path id="splash-portal-hole" d="M679 625 L965 789 L679 962 Z" fill="black" opacity="0"/>
                  </mask>
                </defs>

                <!-- Grupo Enmascarado: Se perfora en el triángulo dejando ver YouTube Music al fondo -->
                <g mask="url(#aura-play-aperture)">
                  <rect id="splash-portal-bg-canvas" x="-50000" y="-50000" width="100000" height="100000" fill="#08090f" opacity="0"/>

                  <g clip-path="url(#aura-disc-clip)">
                    <g id="splash-animated-logo" opacity="0">
                      <g id="splash-brand-halves" transform="rotate(0 800 800)">
                        <path d="M800 142 A658 658 0 0 0 800 1458 Z" fill="#f10921"/>
                        <path d="M800 142 A658 658 0 0 1 800 1458 Z" fill="url(#aura-gradient-half)"/>
                      </g>
                      <circle cx="800" cy="800" r="331" fill="none" stroke="white" stroke-width="33"/>
                      <path d="M679 625 L965 789 L679 962 Z" fill="white"/>
                    </g>
                    <image id="splash-reference-logo" href="${logoUrl}" width="1316" height="1316" x="142" y="142"/>
                  </g>
                </g>
              </svg>
              <div class="fused-shimmer"></div>
            </div>
          </div>
        </div>

        <!-- Indicador para omitir -->
        <div class="tv-skip-hint" id="splash-skip-hint">
          Haz clic o presiona <kbd>Esc</kbd> para omitir
        </div>

      </div>
    `;

    // Inyección en el DOM
    const container = document.body || document.documentElement;
    if (container) {
      container.appendChild(splash);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        (document.body || document.documentElement).appendChild(splash);
      });
    }

    // Omitir con Clic o Teclado
    const onSkipClick = (e) => {
      e.stopPropagation();
      dismissSplash(true);
    };
    splash.addEventListener('click', onSkipClick);

    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === ' ') {
        window.removeEventListener('keydown', onKeyDown);
        dismissSplash(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);

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
    const emblemGlow     = splash.querySelector('#splash-emblem-glow');
    const portalHole     = splash.querySelector('#splash-portal-hole');
    const portalBgCanvas = splash.querySelector('#splash-portal-bg-canvas');
    const brandHalves    = splash.querySelector('#splash-brand-halves');
    const referenceLogo  = splash.querySelector('#splash-reference-logo');
    const animatedLogo   = splash.querySelector('#splash-animated-logo');
    const skipHint       = splash.querySelector('#splash-skip-hint');

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

      for (let i = 0; i <= 90; i++) {
        const u = i / 90;
        const grow = smooth(u / .27);
        const travel = smooth((u - .16) / .84);
        const lift = Math.min(32, stage.offsetHeight * .07);
        const x = dx * (1 - travel);
        const y = dy * (1 - travel) - lift * Math.sin(Math.PI * travel);
        const scaleX = fromX + (1 - fromX) * grow;
        const scaleY = fromY + (1 - fromY) * grow;
        frames.push({
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`,
          borderRadius: `calc(${50 * (1 - grow)}% + ${14 * grow}px)`,
          offset: u
        });
      }

      ytPill.style.transform = frames[0].transform;
      loaderFlare.style.opacity = '0';
      motion(ytPill, frames, 880);
      motion(pointSkin, [{ opacity: 1 }, { opacity: 0 }], 200, 'ease-in-out');
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

      skipHint.style.opacity = '1';
    }

    // ── VUELO DEL PORTAL: EL TRIÁNGULO SE VUELVE TRANSPARENTE ──────────
    function flyThroughEmblem() {
      if (isDismissed) return;

      const holdTransform = getComputedStyle(finalStage).transform;
      finalStage.style.transform = holdTransform;
      finalStage.style.opacity = '1';
      finalStage.classList.add('portal-flight');
      skipHint.style.opacity = '0';

      // Activamos el canvas de fondo oscuro del SVG y desvanecemos el backdrop exterior.
      // De esta forma, lo ÚNICO transparente en la pantalla es la apertura del triángulo ▶.
      if (portalBgCanvas) portalBgCanvas.style.opacity = '1';
      motion(backdrop, [{ opacity: 1 }, { opacity: 0 }], 300, 'ease-out');

      const size = emblemBox.offsetWidth || 190;
      const unit = size / 1316;
      const apertureRadius = 90 * unit;
      const diagonal = Math.hypot(window.innerWidth, window.innerHeight);
      const endScale = Math.max(22, (diagonal / (2 * apertureRadius)) * 1.35);
      const duration = 3400;

      const clamp = n => Math.max(0, Math.min(1, n));
      const smooth = n => { n = clamp(n); return n * n * n * (10 + n * (-15 + 6 * n)); };
      const frames = [];
      const holeFrames = [];
      const glowFrames = [];

      for (let i = 0; i <= 180; i++) {
        const u = i / 180;
        const angle = 360 * smooth((u - .15) / .55);
        const cameraTravel = .12 * smooth(u / .70) + .88 * smooth((u - .43) / .57);
        const scale = Math.exp(Math.log(endScale) * cameraTravel);
        const align = smooth((u - .28) / .40);
        const radians = angle * Math.PI / 180;
        const dx = -25.1 * unit;
        const dy = -7.4 * unit;
        const tx = -(dx * Math.cos(radians) - dy * Math.sin(radians)) * scale * align;
        const ty = -(dx * Math.sin(radians) + dy * Math.cos(radians)) * scale * align;

        frames.push({
          transform: `translate3d(${tx}px, ${ty}px, 0) rotate(${angle}deg) scale(${scale})`,
          offset: u
        });

        // El orificio triangular se vuelve 100% transparente al inicio del vuelo
        // para que se aprecie la página de YouTube Music ya cargada al fondo.
        holeFrames.push({ opacity: smooth((u - .08) / .24), offset: u });
        glowFrames.push({ opacity: .8 * (1 - smooth(u / .42)), offset: u });
      }

      motion(finalStage, [
        { transform: holdTransform },
        { transform: 'matrix(1, 0, 0, 1, 0, 0)' }
      ], 500, 'cubic-bezier(.2,0,0,1)');

      // Reemplazo limpio a vectores nítidos para zoom infinito
      animatedLogo.style.opacity = '1';
      motion(referenceLogo, [{ opacity: 1 }, { opacity: 0 }], 180, 'ease-in-out');

      const camera = motion(emblemBox, frames, duration);

      const syncHalves = () => {
        if (!camera) return;
        const u = clamp((Number(camera.currentTime) || 0) / duration);
        const angle = 180 * smooth((u - .06) / .49);
        brandHalves.setAttribute('transform', `rotate(${angle} 800 800)`);
        if (camera.playState === 'running' || camera.playState === 'pending') {
          portalFrame = requestAnimationFrame(syncHalves);
        } else {
          portalFrame = 0;
        }
      };
      syncHalves();

      motion(portalHole, holeFrames, duration);
      motion(emblemGlow, glowFrames, duration);

      if (camera && camera.finished) {
        camera.finished.then(() => {
          if (camera.playState !== 'finished') return;
          if (portalFrame) cancelAnimationFrame(portalFrame);
          portalFrame = 0;
          brandHalves.setAttribute('transform', 'rotate(180 800 800)');
          finalStage.classList.add('portal-complete');
          stage.classList.add('stage-out');
          
          // Conclusión cinematográfica: se descarta el splash revelando YouTube Music por completo
          dismissSplash(false);
        }).catch(() => {});
      }
    }

    // ── INICIALIZACIÓN Y FLUJO PRINCIPAL DE TIEMPOS ───────────────────
    requestAnimationFrame(() => {
      const frameW = stage.offsetWidth || window.innerWidth;
      const ytOff  = -Math.round(frameW * 0.20);
      const auOff  = Math.round(frameW * 0.20);

      // Estado inicial de bloques
      ytBlock.style.transform = `translateX(${ytOff}px) scale(0.85)`;
      auraBlock.style.transform = `translateX(${auOff}px) translateY(-280px) scale(1.1)`;

      // PASO 1: Seeker line llena
      const fillDuration = 1420;
      loaderFill.style.transition = `width ${fillDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      loaderFill.style.width = '100%';
      playSoundIfAllowed(soundEnabled);

      // PASO 2: Revelar YouTube Music desde el punto
      later(() => revealYouTubeFromPoint(ytOff), fillDuration + 40);

      // PASO 3: Caída elástica de AuraMusic al lado derecho
      const dropAt = fillDuration + 560;
      later(() => {
        if (isDismissed) return;
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
      }, dropAt);

      // PASO 4: Carga de poder neón
      const chargeAt = dropAt + 700;
      later(() => {
        if (isDismissed) return;
        ytBlock.classList.add('charging');
        auraBlock.classList.add('charging');
        divider.classList.add('lit');
        backdrop.classList.add('energized');
      }, chargeAt);

      // PASO 5: Fusión y colisión magnética hacia el centro
      const fusionAt = chargeAt + 850;
      later(() => {
        if (isDismissed) return;
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
      }, fusionAt);

      // PASO 6: Impacto (flash, anillos, chispas) y nacimiento del logo 50/50
      later(() => {
        if (isDismissed) return;
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

      }, fusionAt + 500);

      // PASO 7: Vuelo hacia el interior del triángulo ▶ (portal transparente a YouTube Music)
      later(flyThroughEmblem, fusionAt + 500 + 1300);
    });

    // Temporizador de seguridad máximo (garantiza que jamás se bloquee la pantalla ante cualquier imprevisto)
    later(() => {
      dismissSplash(false);
    }, 12000);
  }

  function dismissSplash(immediate = false) {
    if (isDismissed) return;
    isDismissed = true;

    clearAllAnimations();

    const splash = document.getElementById('auramusic-splash-screen');
    if (!splash) return;

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
        }, 35);
      }
    } catch (_) {}

    if (immediate) {
      splash.classList.add('splash-dismissed');
      setTimeout(() => {
        try { splash.remove(); } catch (_) {}
      }, 400);
    } else {
      splash.classList.add('splash-dismissed');
      setTimeout(() => {
        try { splash.remove(); } catch (_) {}
      }, 650);
    }
  }

  function onPageReady() {
    // Si la página de YouTube Music terminó de inicializarse, no interrumpimos la intro abruptamente,
    // permitimos que el viaje a través del portal culmine de forma cinematográfica.
    // Solo si el usuario hace clic o presiona Esc se omite de inmediato.
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
