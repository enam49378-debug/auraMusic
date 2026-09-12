# 🎵 AuraMusic - Personalizador Avanzado para YouTube Music

AuraMusic es una extensión moderna (Manifest V3) que transforma por completo la experiencia visual y auditiva de **YouTube Music**.

---

## ✨ Características Principales

### 🎤 Modo Cine con Letras Sincronizadas y Animadas (Apple Music Sing Style)
- **Animación Palabra por Palabra**: Las palabras se elevan y brillan con un resplandor de neón en el momento exacto en que se cantan.
- **Interacción Total**: Haz clic en cualquier verso o palabra para saltar directamente a ese segundo con animación fluida inmediata.
- **Diseños y Temas Exclusivos**:
  - 🍎 **Apple Music Sing**: Pantalla completa cinematográfica con fondo líquido reactivo.
  - 🟢 **Spotify**: Tipografía limpia y dock centrado.
  - 💬 **WhatsApp**: Formato de chat interactivo con burbujas de mensajes.
  - 🌸 **Komi-san**: Tema morado/lila nocturno kawaii con stickers y lluvia de pétalos de sakura.
  - 🎮 **Jesuluto 3D**: Modelo 3D interactivo en WebGL (Three.js) bailando al ritmo del beat.
  - ⛏️ **Minecraft**: Estética voxel y tipografía pixel art.

### 🌈 Malla Ambiental Radiante (Ambient Glow 4-Orb Mesh)
- **Extracción Inteligente de Colores**: Analiza la carátula del álbum en tiempo real, aislando los colores más vivos y vibrantes sin zonas negras muertas.
- **Rendimiento Ultraligero (0% CPU adicional)**: Generado mediante gradientes radiales elípticos procesados 100% en la GPU sin convolución gaussiana por software.

### ⚡ Auto-Sync Engine y Calibración de Hardware
- **Detección de Latencia de Hardware**: Compensa automáticamente el buffer de salida de audio (outputLatency + aseLatency) para una sincronización milimétrica entre voz y texto.
- **Controles de Micro-Ajuste**: Micro-nudge desde -0.5s hasta +0.5s para calibrar cualquier tipo de auriculares Bluetooth o DAC USB.

### 📊 Visualizadores de Audio en Tiempo Real y Ecualizador
- Visualizadores dinámicos integrados con Web Audio API y procesamiento en offscreen document.
- Presets de audio y ecualizador multibanda.

---

## 🚀 Instalación en Modo Desarrollador

1. Clona este repositorio:
   \\\ash
   git clone https://github.com/enam49378-debug/auraMusic.git
   \\\
2. Abre Google Chrome o cualquier navegador compatible con Chromium (Brave, Edge, Opera).
3. Dirígete a \chrome://extensions/\.
4. Activa el **Modo de desarrollador** en la esquina superior derecha.
5. Haz clic en **Cargar descomprimida** y selecciona la carpeta de este proyecto.
6. Abre [YouTube Music](https://music.youtube.com/) y ¡disfruta de la experiencia!

---

## 🛠️ Estructura del Proyecto

\\\
ytm-auramusic/
├── manifest.json            # Manifiesto V3 de la extensión
├── content.js               # Script de contenido principal y orquestador
├── background.js            # Service worker en segundo plano
├── offscreen.html / .js     # Documento offscreen para procesamiento de audio
├── popup.html / .js / .css  # Menú emergente de la extensión
├── cinema-lyrics.css        # Estilos visuales del Modo Cine y temas
├── modules/
│   ├── ambient/             # Extracción de colores y malla ambiental
│   ├── audio/               # Motor de audio y ecualizador
│   ├── core/                # Puente con el reproductor nativo y estado
│   ├── hub/                 # Panel flotante de controles
│   ├── lyrics/              # Motor de sincronización y letras animadas
│   ├── themes/              # Gestor modular de temas
│   └── visualizer/          # Visualizadores de audio
├── diseños/                 # Módulos de temas (Jesuluto, Komi, Minecraft, etc.)
└── icons/                   # Iconos de la extensión
\\\

---

## 📄 Licencia
Este proyecto es de uso personal y educativo. Todos los derechos reservados a sus respectivos autores.
