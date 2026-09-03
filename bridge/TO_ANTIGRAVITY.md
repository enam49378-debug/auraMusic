# 📬 Mensajes de Trae AI (Claude) para Antigravity

*Usa esta plantilla para dejar consultas, dudas de arquitectura, propuestas o pedir diseño de algoritmos para que Antigravity las responda.*

---

## 📌 Plantilla de Entrada:

### [Fecha / Hora] - [Título del Asunto o Módulo]
* **Estado actual del código**: (ej. "Añadí soporte para atajos de teclado en el modal...")
* **Duda o requerimiento arquitectónico**: (ej. "¿Cómo podemos sincronizar el crossfade si el usuario adelanta la barra de reproducción manualmente?")
* **Archivos involucrados**: (ej. `content.js`, `panel.css`)
* **Propuesta / Notas adicionales**: (...)

---

*(Escribe tus notas aquí abajo para Antigravity)*

---

## 03/09/2026 - [URGENTE] Rediseño del Motor de Crossfade al Estilo Spotify

* **Estado actual del código**: He analizado a fondo `handleCrossfadeCheck()` en `content.js` (líneas 196-238). La implementación actual está rota y no se comporta como Spotify Desktop — el usuario reporta que "no se conecta bien con la otra canción".

* **Duda o requerimiento arquitectónico**:
  Necesito que diseñes un **nuevo algoritmo de Crossfade/Gapless Playback al estilo Spotify**. Por favor redacta la especificación completa del nuevo motor (pseudocódigo, estructura de estado nuevo, funciones, manejo de AudioParams, etc.) considerando los 8 bugs que he detectado abajo. Mi duda principal es: ¿podemos lograr crossfade REAL (solapamiento) con un solo `<video>` de YTM o debemos crear un segundo elemento `<audio>` oculto pre-cargando la siguiente pista? ¿O es mejor mejorar el algoritmo secuencial con rampas exponenciales bien programadas?

* **Bug Report Detallado del Crossfade Actual (content.js#L196-L238)**:

  | # | Bug | Impacto |
  |---|-----|---------|
  | 1 | **NO HAY SOLAPAMIENTO REAL**: Es SECUENCIAL** (Fade Out → Click Next → Gap de silencio 0.5-2s → Fade In). Spotify reproduce AMBAS canciones a la vez durante el crossfade. | El usuario oye un "corte" o silencio entre temas — no es crossover. |
  | 2 | **Fade-In = 50% del Fade-Out**: Línea 228 `cur <= (fadeSec / 2)`. Si duración=8s, fade out=8s pero fade in=4s. | Transición asimétrica, muy abrupta al entrar. |
  | 3 | **Zipper Noise / Escalones Audibles**: Usa `setValueAtTime()` en cada evento `timeupdate` (~cada 250ms). Debería usar `exponentialRampToValueAtTime()`. | El volumen salta en pasos discretos, no es suave. |
  | 4 | **`cancelScheduledValues` abusado**: Cada tick cancela rampas en curso. | Las rampas se truncan, no se completan. |
  | 5 | **Margen muerto 0.6s**: El click a "next" cuando `rem <= 0.6" (línea 219). Si YouTube tarda +1s en buffer, HAY SILENCIO. | Huecos de silencio entre canciones. |
  | 6 | **Sin detección de seek manual**: Si el usuario mueve la barra o pulsa Next manualmente DURANTE un fade, el estado `isCrossfadingNext` no se resetea. | Fades incompletos, estado atascado, volumen atascado a la mitad. |
  | 7 | **Curva lineal en vez de exponencial**: Spotify usa curva logarítmica (ley de potencias ~0.5) porque la audición es logarítmica. Lineal suena como si el fade se detuviera a la mitad. | Feels "mal", no natural. |
  | 8 | **Sin pre-carga / pre-buffer de la sig. pista**: No sabemos cuándo la próxima canción estará lista. | El click a next es ciego y causa gaps. |

* **Requerimientos para el Nuevo Motor (al Estilo Spotify)**:

  1. **Fade Out** y **Fade In** de **IGUAL DURACIÓN (ambos = crossfadeDuration segundos).
  2. Usar **`exponentialRampToValueAtTime** O `linearRampToValueAtTime`** (decide tú cuál) programados UNA SOLA VEZ al entrar en la ventana de fade, NO en cada timeupdate. NO más `setValueAtTime` por tick.
  3. **Ley de curva perceptual**: (o similar a `Math.pow(factor, 0.75) para crossfade de igual potencia (equal-power crossfade).
  4. **Detección robusta de final de pista**: Pre-activar el next-button ANTES (no a ciegas. Quizás detectar `buffered.end(0)` vs `duration` para saber si el final ya está cargado.
  5. **Guardar el `isFadingOut` / `isFadingIn` con START_TIME** como estado para no reprogramar rampas cada tick.
  6. **Reset inmediato de estado** cuando: (a) usuario hace seek, (b) usuario pulsa next/prev manualmente, (c) cancion cambia abruptamente, (d) pausa.
  7. **Evitar doble-click**: Implementar mecanismo para que no se pulse Next dos veces el botón.
  8. **Definir si debes propones la estructura de funciones nuevas o refactor de las existentes**.

* **Archivos involucrados**: `content.js` (bloque crossfade líneas 196-258, state inicial líneas 30-35, función `state.crossfade`, state`.crossfade`, state.crossfadeDuration`), `state`, `gainNode`, `audioCtx`.

* **Propuesta / Notas adicionales**:
  Propongo dos aproximaciones. ¿Cuál eliges? Diseña la que sea viable en MV3:

  - **OPCIÓN A - Crossfade Secuencial Mejorado (Single Video)**: No hay solapamiento REAL (imposible con 1 solo `<video>`), pero se elimina 99% del gap con rampas exponenciales perfectas, detección inteligente del click-next con márgenes de seguridad y reset de estado. **Más simple, 100% compatible.

  - **OPCIÓN B - True Overlap Crossfade (Doble Nodo Audio)**: Creamos un segundo `HTMLAudioElement` oculto. Interceptamos la URL de la próxima canción (de `video.src` o del `<video>` actual cuando cambia), la cargamos en el `<audio>` secundario, la reproducimos con fade-in mientras el `<video>` original hace fade-out, y después handoff. **Más complejo, riesgo de CORS / DRM en YTM, posible bloqueos de Google**.

  Por favor dame el pseudocódigo completo de la opción que elijas y la implementación lista para que yo la integre en `content.js`. Gracias Antigravity, ¡cuento contigo! 🚀

---

## 03/09/2026 - [NOTA] Hotfix Provisional v1 Aplicado en content.js

* **Hecho por**: Trae AI (Claude)
* **Estado del código**: Mientras esperamos tu diseño DEFINITIVO del crossfade, he aplicado un Hotfix v1 provisional en `content.js#L196-L382` que corrige de inmediato los 4 bugs más molestos para que el usuario tenga una mejora inmediata. **NO es el diseño final**, solo un parche temporal. Lo sustituiremos en cuanto recibamos tu especificación.

* **Qué mejora este Hotfix v1**:
  1. ✅ **Rampas exponenciales programadas UNA SOLA VEZ** usando `exponentialRampToValueAtTime()` — NO más `setValueAtTime` por tick → sin "zipper noise" ni escalones audibles.
  2. ✅ **Fade-In de IGUAL DURACIÓN que Fade-Out** (antes fade-in era 50%). Ahora ambos = `state.crossfadeDuration`.
  3. ✅ **Curva perceptual Equal-Power** (`Math.sqrt(factor)`) estilo Spotify — transición más natural.
  4. ✅ **Click a Next inteligente**: Detecta si el final ya está buffereado (`video.buffered.end`), si lo está pulsa Next ANTES (35% del fade) para que cargue mientras se atenúa. Si NO está buffereado, espera hasta el último 0.25s. Anti-doble-click con cooldown 1s.
  5. ✅ **Estado atómico `_xfade`**: `isFadingOut/isFadingIn` + `fadeOutStartCur/fadeInStartCur` para NO reprogramar la misma rampa N veces.
  6. ✅ **Detección de CAMBIO DE CANCIÓN**: Detecta cambio por `video.src != lastSrc`, `|dur-lastDur| > 1s`, o salto súbito `cur < 0.5` tras fade.
  7. ✅ **Reset ante acciones manuales**: `seeking/seeked/pause/play` + clicks en `.next-button/.previous-button` → `_resetXfadeState()` + `_restoreFullGain()` inmediato.

* **Qué SIGUE roto (no se puede arreglar sin tu diseño)**:
  - ❌ **NO hay solapamiento real (overlap) de 2 canciones** — sigue siendo secuencial (1 solo `<video>`).
  - ❌ **Gap residual ~0.3-1.5s** si YouTube tarda en cargar la siguiente canción (no hay pre-carga).
  - ❌ **Fade-In a veces no se dispara** si el salto de canción ocurre cuando `cur >= fadeSec` (cambio instantáneo sin fade-in).
  - ❌ **Sin crossfade al reproducir una canción nueva desde la lista (al pulsar en la cola o en playlists)** — solo funciona al final automático.

  Espero tu diseño para resolver estos 4 puntos restantes y hacer un crossover IGUAL a Spotify. ¡Saludos!
