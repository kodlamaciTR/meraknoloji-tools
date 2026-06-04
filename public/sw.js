// Service Worker for Web App Platform - Native Serving Virtual Apps from IndexedDB
const DB_NAME = 'WebAppPlatformDB';
const DB_VERSION = 1;

let dbInstance = null;

function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('apps')) {
        db.createObjectStore('apps', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };
    request.onerror = (event) => {
      console.error('[SW DB] Open Error:', request.error);
      reject(request.error);
    };
  });
}

self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker Activating...');
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('[SW] Service Worker Clients Claimed.');
    })
  );
});

function loadFileAndRespond(db, appId, filePath, resolve) {
  const transaction = db.transaction('files', 'readonly');
  const store = transaction.objectStore('files');
  const key = `${appId}/${filePath}`;
  const request = store.get(key);

  request.onsuccess = () => {
    const fileRecord = request.result;
    if (fileRecord) {
      let mimeType = fileRecord.mimeType || 'text/plain';
      
      // Ensure proper charset for text assets
      if (mimeType.startsWith('text/') || mimeType === 'application/javascript' || mimeType === 'application/json') {
        if (!mimeType.includes('charset')) {
          mimeType += '; charset=utf-8';
        }
      }

      console.log(`[SW] Serving virtual file: ${key} (${mimeType})`);
      resolve(new Response(fileRecord.content, {
        headers: { 
          'Content-Type': mimeType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Access-Control-Allow-Origin': '*'
        }
      }));
    } else {
      console.warn(`[SW] Virtual file not found in DB: ${key}`);
      resolve(new Response(`<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Dosya Bulunamadı</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center; }
        .card { max-width: 500px; margin: 2rem auto; padding: 2rem; background: #1e293b; border-radius: 12px; border: 1px solid #334155; }
        h1 { color: #f43f5e; margin-top: 0; }
        p { color: #94a3b8; line-height: 1.6; }
        .path { font-family: monospace; background: #0f172a; padding: 0.5rem; border-radius: 6px; color: #38bdf8; }
    </style>
</head>
<body>
    <div class="card">
        <h1>⚠️ Dosya Bulunamadı</h1>
        <p>Aradığınız dosya sanal uygulama dizininde bulunamadı:</p>
        <p class="path">${filePath}</p>
        <p>Lütfen uygulamanın giriş noktasını (Entry Point) doğru belirlediğinizden ve tüm gerekli dosyaları tam olarak yüklediğinizden emin olun.</p>
    </div>
</body>
</html>`, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }));
    }
  };

  request.onerror = () => {
    console.error(`[SW] Read Error for ${key}:`, request.error);
    resolve(new Response(`Veritabanı Okuma Hatası: ${request.error ? request.error.message : 'Bilinmeyen Hata'}`, { status: 500 }));
  };
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercept any path inside /virtual-app/:appId/...
  if (url.pathname.startsWith('/virtual-app/')) {
    // Robust pathname match supporting both trailing slash, no slash, and paths
    const match = url.pathname.match(/^\/virtual-app\/([^\/]+)(?:\/(.*))?$/);
    if (match) {
      const appId = match[1];
      let filePath = match[2] || '';

      // Decoded path to match saved database file name format
      try {
        filePath = decodeURIComponent(filePath);
      } catch (e) {}

      console.log(`[SW Fetch Intercept] appId: ${appId}, file: ${filePath || '(index fallback)'}`);

      event.respondWith(
        getDB()
          .then((db) => {
            return new Promise((resolve) => {
              // Default empty file paths or trailing slash paths to entryPoint
              if (!filePath || filePath.endsWith('/')) {
                const appTransaction = db.transaction('apps', 'readonly');
                const appsStore = appTransaction.objectStore('apps');
                const appRequest = appsStore.get(appId);

                appRequest.onsuccess = () => {
                  const appMeta = appRequest.result;
                  const targetEntryPoint = (appMeta && appMeta.entryPoint) ? appMeta.entryPoint : 'index.html';
                  filePath = (filePath + targetEntryPoint).replace(/\/+/g, '/');
                  console.log(`[SW Fallback] Redirecting root request to entryPoint: ${filePath}`);
                  loadFileAndRespond(db, appId, filePath, resolve);
                };

                appRequest.onerror = () => {
                  filePath = (filePath + 'index.html').replace(/\/+/g, '/');
                  console.log(`[SW Fallback Error] Redirecting to default: ${filePath}`);
                  loadFileAndRespond(db, appId, filePath, resolve);
                };
              } else {
                loadFileAndRespond(db, appId, filePath, resolve);
              }
            });
          })
          .catch((err) => {
            console.error('[SW Fetch Error] Database failed to load:', err);
            return new Response(`Hata: ${err.message}`, { status: 500 });
          })
      );
    }
  }
});
