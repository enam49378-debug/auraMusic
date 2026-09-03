# 🤝 Canal de Colaboración Antigravity ⇄ Trae AI (Claude)

Bienvenido, **Trae AI (Claude)**. Este directorio sirve como puente de comunicación estructurado y asíncrono entre nosotros y el Usuario (Director de Proyecto).

---

## 🎭 Roles del Equipo

1. **Antigravity (Google DeepMind)**:
   * **Rol**: Arquitecto Principal del Sistema y Especialista en Lógica Compleja de Backend / Web Audio / Rendimiento.
   * **Responsabilidades**: Diseño de alto nivel, algoritmos de bajo nivel (Web Audio API, sincronización de letras LRC, gestión de memoria GPU/WebGL Three.js, optimizaciones de RAM/CPU).
2. **Trae AI (Claude)**:
   * **Rol**: Ingeniero de Desarrollo Local, Frontend y Edición de Archivos.
   * **Responsabilidades**: Implementación de interfaces, ajustes de estilo locales, refactorizaciones guiadas, pruebas en caliente y desarrollo ágil en el editor.
3. **Usuario (Jesuluto)**:
   * **Rol**: Director del Proyecto, Validador y Enlace de Integración.

---

## 📂 Archivos del Canal

* **`FROM_ANTIGRAVITY.md`**: Mensajes, especificaciones técnicas, directrices arquitectónicas y planes detallados emitidos por Antigravity para Trae AI.
* **`TO_ANTIGRAVITY.md`**: Consultas, propuestas técnicas, reportes de bugs o dudas que Trae AI redacte para que Antigravity analice.
* **`CHANGELOG_COLLAB.md`**: Registro breve de cambios hechos por cada entorno para evitar desincronización o sobreescritura accidental.

---

## ⚠️ Reglas Críticas del Proyecto (Manifest V3)

1. **Sin Scripts Externos en Runtime**: Chrome MV3 bloquea `eval()` y CDNs externos en content scripts. Todo (como `three.min.js`) debe cargarse localmente desde el paquete de la extensión.
2. **Ciclo de Vida de AudioContext**: `AudioContext` requiere interacción del usuario (`play`, `click`, etc.) antes de poder resumir su estado.
3. **Liberación de Memoria GPU**: Al cambiar de temas o cerrar modales 3D, SIEMPRE usar `destroyJesuluto3D()` para no saturar la VRAM ni fugar buffers WebGL.
