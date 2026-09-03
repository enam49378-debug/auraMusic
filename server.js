// AuraMusic Local Companion Server
// Administra la pre-descarga ultrarrápida, reproducción y auto-borrado para crossfade real sin bloqueos

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = 8080;
const PUBLIC_DIR = __dirname;
const CACHE_DIR = path.join(PUBLIC_DIR, 'cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

const downloadingMap = new Map();

function downloadTrack(videoId) {
  if (downloadingMap.has(videoId)) {
    return downloadingMap.get(videoId);
  }

  const targetMp3 = path.join(CACHE_DIR, `cache_${videoId}.mp3`);
  if (fs.existsSync(targetMp3)) {
    return Promise.resolve(targetMp3);
  }

  const promise = new Promise((resolve, reject) => {
    console.log(`📥 AuraMusic Server: Descargando audio de pista "${videoId}" con yt-dlp...`);
    const args = [
      '--extractor-args', 'youtube:player_client=android',
      '-x', '--audio-format', 'mp3',
      '-o', path.join(CACHE_DIR, `cache_${videoId}.%(ext)s`),
      `https://www.youtube.com/watch?v=${videoId}`
    ];

    execFile('yt-dlp', args, (error, stdout, stderr) => {
      downloadingMap.delete(videoId);
      if (error) {
        console.error(`❌ Error al descargar ${videoId}:`, error.message);
        return reject(error);
      }
      if (fs.existsSync(targetMp3)) {
        console.log(`✅ Pista "${videoId}" descargada y lista para crossfade: ${targetMp3}`);
        resolve(targetMp3);
      } else {
        reject(new Error('Archivo no encontrado tras conversión'));
      }
    });
  });

  downloadingMap.set(videoId, promise);
  return promise;
}

function cleanupTrack(videoId) {
  try {
    const targetMp3 = path.join(CACHE_DIR, `cache_${videoId}.mp3`);
    if (fs.existsSync(targetMp3)) {
      fs.unlinkSync(targetMp3);
      console.log(`🗑️ Pista anterior "${videoId}" eliminada del disco para ahorrar espacio.`);
    }
  } catch (e) {
    console.warn(`Error al eliminar ${videoId}:`, e.message);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // Endpoint 1: Pre-descarga de la siguiente canción
  if (pathname === '/prefetch') {
    const videoId = parsedUrl.searchParams.get('id');
    if (!videoId || videoId.length !== 11) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'videoId inválido' }));
      return;
    }

    try {
      await downloadTrack(videoId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ready',
        videoId: videoId,
        url: `http://localhost:${PORT}/cache/cache_${videoId}.mp3`
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Endpoint 2: Limpieza de la canción anterior tras el crossfade
  if (pathname === '/cleanup') {
    const videoId = parsedUrl.searchParams.get('id');
    if (videoId) cleanupTrack(videoId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'cleaned', videoId: videoId }));
    return;
  }

  // Servir archivos estáticos y la carpeta de caché
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'crossfade-lab.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 No encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Soporte para streaming de audio con Range Requests (Permite adelantar y pausar sin errores)
    const range = req.headers.range;
    if (range && (ext === '.mp3' || ext === '.wav')) {
      const total = stats.size;
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': stats.size,
      'Content-Type': contentType
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🎛️ AuraMusic Companion Server activo en: http://localhost:${PORT}`);
  console.log(`📁 Carpeta de caché temporal: ${CACHE_DIR}`);
});
