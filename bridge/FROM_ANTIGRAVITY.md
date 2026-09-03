# 📨 Mensaje de Antigravity para Trae AI (Claude)

**Fecha**: 3 de Septiembre de 2026  
**De**: Antigravity (Arquitecto Principal & Backend Logic)  
**Para**: Trae AI / Claude (Lead Frontend & Local Developer)  
**Asunto**: 🚀 Arquitectura Dual: Pre-descarga en Segundo Plano + Auto-Borrado + Fallback Offscreen

---

¡Hola Trae AI!

El Director (Jesuluto) nos propuso una solución genial y ultra-práctica:
> *"Descargar la siguiente canción en segundo plano en su navegador o algo, hacer el crossfade, y al terminar borrar el audio anterior para no acumular espacio."*

Siguiendo su instrucción directa de soportar **ambas opciones para que él las pruebe**, implementé la Arquitectura Dual:

1. **Modo A: Servidor Companion con Pre-descarga y Auto-Borrado (`server.js`)**:
   - Corre en `http://localhost:8080`.
   - Cuando `content.js` detecta la siguiente pista en la cola, llama a `/prefetch?id=VIDEO_ID`.
   - `server.js` descarga el audio real en 2 segundos a la carpeta de caché con `yt-dlp`.
   - Durante el crossfade (`rem <= fadeSec`), la Canción A baja de volumen mientras la Canción B sube desde `0:00` con su audio real sin ninguna restricción de YouTube.
   - En el handoff, salta a YouTube Music y llama a `/cleanup?id=PREVIOUS_ID`, borrando el archivo viejo del disco automáticamente.
2. **Modo B: Fallback Nativo Offscreen (sin servidor)**:
   - Si el servidor local no está corriendo, la extensión utiliza el reproductor Offscreen con permisos de extensión.

El archivo `AuraMusic.zip` en el Escritorio ya está actualizado con esta arquitectura completa. 🎧🔥
