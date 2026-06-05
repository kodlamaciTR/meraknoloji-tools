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
      
      if (mimeType.startsWith('text/html')) {
        fileRecord.content.text()
          .then((text) => {
            const scriptToInject = `\n<!-- PWA SW & Manifest Platform Shield & IFrame Download Proxy -->
<script id="pwa-interceptor">
  (function() {
    console.log('[Platform] Shielding virtual env and proxing sandbox downloads.');
    if ('serviceWorker' in navigator) {
      const mockRegistration = {
        scope: window.location.origin + window.location.pathname,
        active: { 
          state: 'activated', 
          scriptURL: window.location.href + 'sw.js',
          postMessage: function() {}, 
          addEventListener: function() {}, 
          removeEventListener: function() {} 
        },
        installing: null,
        waiting: null,
        update: function() { return Promise.resolve(this); },
        unregister: function() { return Promise.resolve(true); },
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      };

      const mockServiceWorkerContainer = {
        register: function(script, options) {
          console.log('[Platform Proxy] Intercepted register(' + script + ') -> Bypassed to preserve host IndexedDB assets mapping.');
          return Promise.resolve(mockRegistration);
        },
        getRegistration: function() {
          return Promise.resolve(mockRegistration);
        },
        getRegistrations: function() {
          return Promise.resolve([mockRegistration]);
        },
        ready: Promise.resolve(mockRegistration),
        controller: null,
        oncontrollerchange: null,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      };

      try {
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          get: function() { return mockServiceWorkerContainer; }
        });
      } catch (e) {
        navigator.serviceWorker.register = mockServiceWorkerContainer.register;
        navigator.serviceWorker.getRegistration = mockServiceWorkerContainer.getRegistration;
        navigator.serviceWorker.getRegistrations = mockServiceWorkerContainer.getRegistrations;
      }
    }

    // Intercept download events for sandbox iframe compatibility
    function triggerParentDownload(href, filename) {
      if (!href) return;
      console.log('[Platform Proxy] Intercepted download trigger:', filename, href);
      
      let resolvedUrl = href;
      if (!href.startsWith('blob:') && !href.startsWith('data:') && !href.startsWith('http:') && !href.startsWith('https:')) {
        resolvedUrl = new URL(href, window.location.href).href;
      }
      
      fetch(resolvedUrl)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload = function() {
            window.parent.postMessage({
              type: 'VIRTUAL_APP_DOWNLOAD',
              filename: filename || 'download',
              dataUrl: reader.result
            }, '*');
          };
          reader.readAsDataURL(blob);
        })
        .catch(err => {
          console.error('[Platform Proxy] Fetch download data failed, sending direct URL message:', err);
          window.parent.postMessage({
            type: 'VIRTUAL_APP_DOWNLOAD_URL',
            filename: filename || 'download',
            url: resolvedUrl
          }, '*');
        });
    }

    // Live click intercept
    document.addEventListener('click', function(e) {
      const a = e.target.closest('a');
      if (a && a.hasAttribute('download')) {
        e.preventDefault();
        e.stopPropagation();
        triggerParentDownload(a.href, a.getAttribute('download'));
      }
    }, true);

    // Override prototype anchor click
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.hasAttribute('download')) {
        triggerParentDownload(this.href, this.getAttribute('download'));
      } else {
        originalClick.apply(this, arguments);
      }
    };
  })();
</script>\n`;
            
            let modifiedText = text;
            if (text.includes('<head>')) {
              modifiedText = text.replace('<head>', '<head>' + scriptToInject);
            } else if (text.includes('<HEAD>')) {
              modifiedText = text.replace('<HEAD>', '<HEAD>' + scriptToInject);
            } else {
              modifiedText = scriptToInject + text;
            }

            resolve(new Response(new Blob([modifiedText], { type: 'text/html; charset=utf-8' }), {
              headers: { 
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Access-Control-Allow-Origin': '*'
              }
            }));
          })
          .catch((err) => {
            console.error('[SW Text Parse Error]', err);
            resolve(new Response(fileRecord.content, {
              headers: { 
                'Content-Type': mimeType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Access-Control-Allow-Origin': '*'
              }
            }));
          });
      } else {
        resolve(new Response(fileRecord.content, {
          headers: { 
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Access-Control-Allow-Origin': '*'
          }
        }));
      }
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
  } else {
    // If the request doesn't start with /virtual-app/, check if the requesting client is a virtual app iframe.
    // This allows us to serve absolute paths (e.g. /assets/style.css) requested inside the iframe 
    // since the browser resolves absolute paths relative to root (port 3000) instead of /virtual-app/:appId/
    if (event.clientId && url.origin === self.location.origin && !url.pathname.startsWith('/sw.js') && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/src/')) {
      const fallbackPromise = self.clients.get(event.clientId)
        .then((client) => {
          if (client && client.url) {
            const clientUrl = new URL(client.url);
            if (clientUrl.pathname.startsWith('/virtual-app/')) {
              const clientMatch = clientUrl.pathname.match(/^\/virtual-app\/([^\/]+)/);
              if (clientMatch) {
                const appId = clientMatch[1];
                let filePath = url.pathname.replace(/^\/+/, ''); // Clean leading slash for DB search

                try {
                  filePath = decodeURIComponent(filePath);
                } catch (e) {}

                console.log(`[SW Client Absolute Intercept] Serving absolute path asset from IndexedDB. Client: ${client.id}, appId: ${appId}, file: ${filePath}`);

                return getDB()
                  .then((db) => {
                    return new Promise((resolve) => {
                      loadFileAndRespond(db, appId, filePath, resolve);
                    });
                  });
              }
            }
          }
          return fetch(event.request);
        })
        .catch((err) => {
          console.error('[SW Client Absolute Intercept Error]:', err);
          return fetch(event.request);
        });

      event.respondWith(fallbackPromise);
    }
  }
});
