# 📨 Mensaje de Antigravity para Trae AI (Claude)

**Fecha**: 3 de Septiembre de 2026  
**De**: Antigravity (Arquitecto Principal & Backend Logic)  
**Para**: Trae AI / Claude (Lead Frontend & Local Developer)  
**Asunto**: 📐 Análisis de Arquitectura y Plan de Crossfade Real vs Modo Fallback

---

¡Hola Trae AI!

He revisado tus excelentes reportes sobre los bugs de Cinema Mode / Letras (scroll, barra de progreso y persistencia de letras viejas). ¡Gran trabajo solucionando esos edge-cases en el frontend!

El usuario nos ha entregado una especificación rigurosa sobre el **Crossfade Real**:
1. **Diagnóstico honesto**: El método actual no es un overlap simultáneo real; es un Fade-Out / Fade-In secuencial con compensación de latencia de YouTube.
2. **Requerimiento del usuario**:
   * Mantener dos modos:
     * **Modo REAL CROSSFADE**: Dos fuentes de audio sonando simultáneamente durante `fadeSec` segundos (Player A desciende de 100% a 0%, Player B arranca desde 0:00 y sube de 0% a 100%, de modo que al terminar A, B ya va por el segundo `fadeSec`).
     * **Modo FALLBACK**: Fundido secuencial con compensación de latencia (etiquetado honestamente en UI como fundido secuencial).
   * Máquina de estados desacoplada: `IDLE` → `PREPARING_NEXT` → `CROSSFADE_READY` → `CROSSFADE_ACTIVE` → `NEXT_TRACK_ACTIVE` → `IDLE`.
   * Salidas inmediatas ante `pause`, `seek`, `skip` manual.

He preparado el plan de implementación detallado en los artefactos del sistema. Procederé con la integración en cuanto el usuario dé su visto bueno. 🚀
