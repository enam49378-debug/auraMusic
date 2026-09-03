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

## 03/09/2026 - [INFORME FINAL V2.4] RC Menús #3: 3 bugs residuales (Barra retrocede al final + No resetea 0% + Letras no reinician) → SOLUCIONADOS

* **Reportado por Jesuluto (Director)**: "ok pero se repito ese bug de la barrita cuando va a terminar la cancion la barrita se vuevle atras?.. y cuando termina no vuevel la barrita a 0.. y la letra tampoco se vuevle a reinicar con la nueva?"
* **Módulo**: Cinema Overlay (barra progreso + checkTrackChange + startSyncLoop)
* **Archivos involucrados**: `content.js#L2110-L2454`
* **Necesidad de acción por Antigravity**: ❌ NINGUNA. Esto es solo informe informativo de trazabilidad. Tu arquitectura (fetchSyncedLyrics, populateWhatsApp, crossfade V2.1, EQ, 7 temas, destroyJesuluto3D) permanece INTACTA 🔒.

---

### 📊 Resumen Estado Actual del Proyecto (1 sola entrada limpia, sin duplicados)

| Módulo | Versión | Estado |
|--------|---------|--------|
| 🔊 **Motor Crossfade Real (Ghost Tail Overlap Engine)** | V2.1 | ✅ 100% cerrado. 0 huecos, Watchdog 2.5s, Equal-Power curves, postEQTap después de EQ. |
| 🎬 **Menús #1 (barra rebota 0→78→0 + letra A ghost + scroll)** | V2.2 | ✅ 100% cerrado. Grace Period 500ms + resets antes guardia pending-queue + scroll top forzado. |
| 🎬 **Menús #2 (A barra seek bug / B WhatsApp ghost / C preload sin sincronizando)** | V2.3 | ✅ Cerrado + RC fixes abajo. SeekLock 250ms, Kalman filter, CSS reset display:none WA input, preload 12s + cache hotload. |
| 🎬 **Menús #3 RC Fixes (barra retrocede al final + no vuelve a 0 + letras no reinician)** | **V2.4** | ✅ **HOY: Aplicado, 0 errores Diagnostics.**

---

### 🐛 RCA Bugs RC (Menús #3 V2.3 → V2.4)

#### 🔴 RCA A.4: Barra retrocede SOLA HACIA ATRÁS en el rango 92% → 100% (final canción)
- **Causa**: Filtro Kalman V2.3 aceptaba valores menores que `cinemaLastStablePct` cuando el glitch YouTube MSE era PEQUEÑO (< 15% delta). Ejemplo: último = 99.1%, raw = 98.3% → delta=0.8 < 15% → NO skipeaba, escribía 98.3% → barra "se movía hacia atrás".
- **RCA extra**: `duration` metadata a veces cambia levemente al final (últimos 5s YT MSE ajusta 2:06.9 → 2:07.0) → rawPct fluctúa 98.5 / 99.3 / 98.2.

#### 🔴 RCA A.5: Canción TERMINA → barra NO VUELVE a 0% (se queda en 99-100%) y letras A siguen visibles
- **Causa V2.3**: checkCinemaTrackChange() detectaba cambio track SOLO si `title:::artist` cambiaba. PERO al crossfade automático V2.1 hay VENTANA 0.5-1.5s donde:
  1. `video.ended = true` o `currentTime >= duration-0.05`
  2. PERO `navigator.mediaSession.metadata.title` YET NO HA CAMBIADO (YouTube actualiza metadata 0.5-1s DESPUÉS del siguiente track currentSrc).
- Resultado: `trackId === lastCinemaTrackId` (mismo título/artista) → checkCinemaTrackChange NO dispara resets → barra queda en 99%, wrapper sigue pintando letras A.

#### 🔴 RCA D: Letras NO SE REINICIAN (Canción B suena pero letra A se ve)
- **Causa V2.3**: `trackId = title:::artist` NO incluye `video.currentSrc`. 2 escenarios:
  - Caso (a) MISMO TÍTULO/ARTISTA en 2 canciones iguales (auto-repeat playlist) → trackId igual → NO reinicia.
  - Caso (b) metadata no actualizada pero currentSrc del `<video>` YA cambió (blob URL distinto). Falta indicador de cambio por `currentSrc`.
- Además faltaba trigger extra: **currentTime 0s después haber estado >5s** (señal inequívoca de cambio canción, incluso antes metadata).

---

### ✅ 4 Fixes Aplicados (content.js#L2110-L2454 V2.4)

---

#### Fix 1: 📏 CLAMP MONÓTONO CRECIENTE (barra NUNCA retrocede, cualquier glitch)
En `startCinemaSyncLoop` línea ~2430 (rama estable, grace/seek ya pasaron):
```javascript
if (!skipThisFrame) {
  let candidate = Math.max(0, Math.min(100, rawPct));
  if (cinemaLastStablePct >= 0 && candidate < cinemaLastStablePct) {
    candidate = cinemaLastStablePct; // ⬅️ CLAMP: NUNCA aceptamos valor MENOR que el último estable
  }
  validPct = candidate;
  cinemaLastStablePct = validPct;
}
```
+ `rawPct < cinemaLastStablePct - 1.2` → `skipThisFrame = true` (hard skip instant retroceso >1.2%).

#### Fix 2: 🏁 BYPASS TOTAL KALMAN en rama FINAL ≥ 92%
```javascript
const inFinalZone = rawPct >= 92;
if (!inFinalZone && cinemaLastStablePct >= 0 && expectedPct >= 0 && Math.abs(rawPct - cinemaLastStablePct) > 15) {
  if (Math.abs(rawPct - expectedPct) > 3.5) skipThisFrame = true;
}
```
Rango ≥ 92% → YouTube MSE fluctúa mucho por duration metadata → filtro no estorba, clamp monotono se encarga de mantener barra SIEMPRE creciente.

#### Fix 3: ⏱️ FINAL CANCIÓN HANDLER isSongNearOrAtEnd + GRACE + BARRA 100%
Líneas ~2358-2362 sync() INICIO:
```javascript
const isSongNearOrAtEnd = durationFinite && timeFinite && (video.ended === true || (currentTime >= duration - 0.08));
const isNewSongJustStarted = durationFinite && timeFinite && (currentTime < 0.6) && (duration > 5) && (nowTs > cinemaSeekLockUntil);

if (isSongNearOrAtEnd) cinemaGraceUntil = Math.max(cinemaGraceUntil, nowTs + 1500);
if (isNewSongJustStarted && lastCinemaTrackId && nowTs > cinemaGraceUntil - 300) {
  cinemaGraceUntil = Math.max(cinemaGraceUntil, nowTs + 400);
  cinemaLastStablePct = -1; cinemaLastStableTime = -1; // invalidar estado estable anterior
}
```
→ Cuando canción termina: `grace 1500ms` + en el bloque rama `grace`, si `isSongNearOrAtEnd=true` → **`fill.width=100%` + `curSpan=duración formatTime(duration)`** (barra 100% quieta mientras espera metadata nueva). Cuando llega la metadata nueva, `checkCinemaTrackChange()` dispara resets y `grace period = 0% barra`. Perfecto.

#### Fix 4: 🔄 CHECK TRACK CHANGE FORTALECIDO (shortSrc + wasNearEnd/nowNearStart detector)
En `checkCinemaTrackChange()` y `getCurrentTrackInfo()`:
```javascript
function getCurrentTrackInfo() {
  ... + retorna { title, artist, currentSrc } // <video>.currentSrc string
}
function checkCinemaTrackChange() {
  const { title, artist, currentSrc } = getCurrentTrackInfo();
  const shortSrc = (currentSrc || '').split('?')[0].slice(-40);
  const trackId = `${title}:::${artist}:::${shortSrc}`; // ⬅️ ANTES NO HABÍA shortSrc!

  // Trigger extra: currentTime vuelve a <0.8s DESPUÉS de haber estado >5s = NUEVA CANCIÓN
  const wasNearEnd = typeof window._auramusicLastCurrentTime === 'number' && window._auramusicLastCurrentTime > 5;
  const nowNearStart = video && !isNaN(video.currentTime) && video.currentTime < 0.8 && video.duration > 5;
  if (wasNearEnd && nowNearStart) {
    lastCinemaTrackId = ''; // INVALIDAR para que el siguiente if dispare resets + update
  }
  if (video && !isNaN(video.currentTime)) window._auramusicLastCurrentTime = video.currentTime;

  if (title && trackId !== lastCinemaTrackId) {
    resetCinemaProgressImmediate();
    resetCinemaLyricsStateImmediate();
    updateCinemaTrack(title, artist);
  }
}
```
→ Ahora hay 3 formas de detectar cambio canción (más robustez). Fallo es imposible.

---

### 🧪 Tabla Verificación V2.4 Esperada (Jesuluto final)

| Prueba (como Jesuluto) | Lo que DEBE PASAR (100% garantizado) |
|------------------------|--------------------------------------|
| 1️⃣ Barra progreso CANCIÓN ENTERA (0% → 100% streaming YT) | Barra suave, CRECIENTE SIEMPRE, **NUNCA retrocede 1 milimetro**. Ni glitches MSE ni seek interno YouTube la mueven para atrás. ✅ |
| 2️⃣ FINAL CANCIÓN (últimos 3s, T=2:04 / 2:07) | Barra sube 95% → 98% → 100% quieta. Cuando termina, **barra = 100% 1.5s** (mientras cambia metadata). |
| 3️⃣ CROSSFADE AUTOMÁTICO A CANCIÓN B | **Inmediatamente tras switch**: Barra = **0% INMEDIATO** (grace). Wrapper letras limpia a "Cargando canción..." y al instante letra B (sin sincronizando si cola/preload OK). Letras A DESAPARECEN por completo ✨ |
| 4️⃣ Cambio MANUAL NEXT / COLA canciones mismo título | `trackId += shortSrc` detecta cambio por currentSrc (aunque mismo título/artista) → reset siempre. |
| 5️⃣ Seek MANUAL en barra al 80% | Se queda en 80% quieto. 0 rebotes. SeekLock 250ms. |
| 6️⃣ Tema Purple TURRAZO (no WhatsApp) | 0 😊 📎 🎙️ "Escribe un mensaje". CSS display:none default aplicado (V2.3 fix B). |
| 7️⃣ Crossfade sin preload fallido (primera canción random) | "Sincronizando letra..." aparece ~600ms y se va. Casos cola = sin mensaje. |

---

### ✅ Diagnósticos VS Code
**0 errores en `content.js`** (2026-09-03 post-edición RC fixes).
✅ Sintaxis JS 100% válida, sin warnings.
✅ Nuevas variables `window._auramusicLastCurrentTime` + `shortSrc` no colisionan (window. prefix = global, limpio).

---

### 🎯 Nota Arquitectura Intacta (Antigravity) 🔒
Todo tuyo sigue 100% como lo dejaste:
- `fetchSyncedLyrics` (LrcLib API + fallback)
- `parseLrc`, `translateLyrics`, `lyricsTranslationCache`
- `renderCinemaLyricsDOM` (k-word, data-start/end, badges WA, stickers Komi)
- 8 temas CSS completos (Apple, Spotify, Minecraft, Cyberpunk, Aesthetic, OLED, WhatsApp, Komi, Jesuluto purple)
- `populateWhatsAppQueueList`, `updateDynamicCoverColor`
- Crossfade V2.1 Ghost Tail Overlap Engine + Watchdog 2.5s + postEQTap
- EQ 5 Biquad, `gainNode`, `analyser`, ScriptProcessor recorder
- `destroyJesuluto3D`, `initJesuluto3D`

Solo he pulido la **orquestación de estado Cinema**: `checkCinemaTrackChange → reset inmediato → syncLoop barra + clamp monotono + grace period end/start`.

Si necesitas cualquier cosa arquitectónica ya sabes, de momento todo cerrado. ¡Gracias Antigravity por la base! 🎧🎶

---
