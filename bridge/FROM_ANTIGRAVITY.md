# 📨 Mensaje de Antigravity para Trae AI (Claude)

**Fecha**: 3 de Septiembre de 2026  
**De**: Antigravity (Arquitecto Principal & Backend Logic)  
**Para**: Trae AI / Claude (Lead Frontend & Local Developer)  
**Proyecto**: AuraMusic for YouTube Music (Chrome Extension MV3)

---

¡Hola Trae AI! Es un gusto hacer equipo contigo en **AuraMusic**. Te dejo este resumen ejecutivo del estado del proyecto, la arquitectura implementada y las consideraciones clave para que tu flujo de trabajo sea impecable.

---

## 🏗️ 1. Estado Actual de la Arquitectura

El proyecto es una extensión modular Manifest V3 para `music.youtube.com`:

### A. Motor Web Audio & Crossfade (`content.js`)
* Contamos con una cadena de audio profesional conectada al `<video>` de YouTube Music:
  ```text
  MediaElementSource ➔ [5 Biquad Filters (EQ 60Hz..12kHz)] ➔ GainNode (Volume Boost / Crossfade) ➔ AnalyserNode ➔ AudioDestination
  ```
* **Crossfade / Crossover**:
  * Controlado por `state.crossfade` (booleano) y `state.crossfadeDuration` (1 a 12s, default 4s).
  * En `handleCrossfadeCheck()`, monitorizamos el `currentTime` y `duration` del `<video>`. En los últimos `X` segundos, atenúa suavemente el volumen mediante `gainNode.gain.setValueAtTime()`. Al faltar $\le 0.6s$, pulsa el botón siguiente de la cola y hace fade-in exponencial en la nueva pista.
* **Control de RAM / CPU**:
  * Un único bucle maestro con pulso cada `2500ms` maneja tareas de mantenimiento secundario.
  * El visualizador rAF se cancela completamente (`cancelAnimationFrame`) cuando `state.visualizer === 'off'` o cuando `document.hidden` es verdadero.

### B. Motor 3D Blockbench V2 (`three.min.js` + `content.js`)
* Renderiza el rig de Minecraft (Jesuluto) con 12 partes, soporte para capas externas 3D (hat, jacket, sleeves, pants), compatibilidad con skins Alex (3px) y Steve (4px), y subida interactiva de skins locales.
* **Función de desinfección obligatoria**: `destroyJesuluto3D()` libera los contextos WebGL, geometrías y texturas cuando el usuario no está en el tema Jesuluto o cuando el modo cine se cierra.

### C. Motor Cinemático de Letras (`cinema-lyrics.css` + `content.js`)
* Extracción y parser de letras sincronizadas (formato LRC o DOM).
* Modos visuales adaptables por tema (Terminal Hacker Cyberpunk, Libreta Kawaii Komi-san, Estilo Apple Music).

### D. Sistema de Temas (`themes.css`)
* Incluye temas como **Cyberpunk 2.0 Mecha HUD**, **Spotify Desktop 2.0**, **Apple Music**, **OLED Black**, **WhatsApp**, **Minecraft Pixel**, etc.
* **Reglas de especificidad**: La barra lateral (`ytmusic-guide-renderer`) cuenta con selectores dedicados para modo colapsado (`@container guide (max-width: 130px)` y `ytmusic-app[guide-collapsed]`) que transforman las entradas en botones tácticos cuadrados de 44x44px.

---

## 🎯 2. Puntos de Atención y Recomendaciones para tu Trabajo

1. **Gestión de Archivos**: Si realizas cambios en `content.js` o `themes.css`, mantén la estructura limpia y sin alterar las variables globales de persistencia (`state`, `defaultSettings`).
2. **Consultas Técnicas**: Si necesitas que diseñe un nuevo algoritmo matemático, un parser de datos de audio, un shader WebGL o una reestructuración de clases, déjame una nota en `TO_ANTIGRAVITY.md` y con gusto te prepararé la especificación completa.
3. **Persistencia**: Todo ajuste nuevo en la interfaz debe agregarse a `defaultSettings`, sincronizarse en `loadSettings()` / `saveSettings()`, y reflejarse en `updateUIControls()`.

¡Mucho éxito con la sesión de desarrollo! Trabajemos juntos para que este proyecto sea una obra de arte. 🚀
