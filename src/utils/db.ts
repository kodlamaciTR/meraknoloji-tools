/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebApp, WebAppFile } from '../types';

const DB_NAME = 'WebAppPlatformDB';
const DB_VERSION = 1;

/**
 * Open the native IndexedDB instance
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for web applications metadata
      if (!db.objectStoreNames.contains('apps')) {
        db.createObjectStore('apps', { keyPath: 'id' });
      }
      
      // Store for web application files (HTML, CSS, JS, Assets)
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Saves or updates a WebApp metadata and its files
 */
export async function saveApp(
  app: WebApp, 
  files: { path: string; content: Blob; mimeType: string }[]
): Promise<void> {
  const db = await openDB();
  
  return new Promise<void>((resolve, reject) => {
    // Initiate transaction for both apps and files
    const transaction = db.transaction(['apps', 'files'], 'readwrite');
    const appsStore = transaction.objectStore('apps');
    const filesStore = transaction.objectStore('files');

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    // Store App Metadata
    appsStore.put(app);

    // Store File Records
    for (const file of files) {
      const fileId = `${app.id}/${file.path}`;
      const record: WebAppFile = {
        id: fileId,
        appId: app.id,
        path: file.path,
        content: file.content,
        mimeType: file.mimeType
      };
      filesStore.put(record);
    }
  });
}

/**
 * Retrieves all WebApps metadata ordered by upload date descending
 */
export async function getAllApps(): Promise<WebApp[]> {
  const db = await openDB();
  return new Promise<WebApp[]>((resolve, reject) => {
    const transaction = db.transaction('apps', 'readonly');
    const store = transaction.objectStore('apps');
    const request = store.getAll();

    request.onsuccess = () => {
      const apps = request.result as WebApp[];
      // Sort: Newest uploaded first
      apps.sort((a, b) => b.uploadedAt - a.uploadedAt);
      resolve(apps);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Retrieves a single WebApp by its ID
 */
export async function getApp(id: string): Promise<WebApp | null> {
  const db = await openDB();
  return new Promise<WebApp | null>((resolve, reject) => {
    const transaction = db.transaction('apps', 'readonly');
    const store = transaction.objectStore('apps');
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Updates a WebApp metadata details only (name, description, category, icon, isFavorite, lastOpenedAt)
 */
export async function updateAppMetadata(app: WebApp): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('apps', 'readwrite');
    const store = transaction.objectStore('apps');
    const request = store.put(app);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Deletes a WebApp metadata and ALL associated file assets
 */
export async function deleteApp(appId: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['apps', 'files'], 'readwrite');
    const appsStore = transaction.objectStore('apps');
    const filesStore = transaction.objectStore('files');

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    // 1. Delete app meta
    appsStore.delete(appId);

    // 2. Query and delete files starting with "appId/" using IDBKeyRange
    const range = IDBKeyRange.bound(`${appId}/`, `${appId}/\uffff`);
    const cursorRequest = filesStore.openCursor(range);

    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  });
}

/**
 * Scans a file path to guestimate mimeType
 */
export function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
    case 'mjs':
      return 'application/javascript';
    case 'json':
      return 'application/json';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'ico':
      return 'image/x-icon';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'mp4':
      return 'video/mp4';
    case 'woff':
      return 'font/woff';
    case 'woff2':
      return 'font/woff2';
    case 'ttf':
      return 'font/ttf';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Converts a Blob to a Base64 encoded DataURL
 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a Base64 encoded DataURL back to a native Blob
 */
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Export all apps and files inside IndexedDB as a single backup structure
 */
export async function exportAllData(): Promise<string> {
  const db = await openDB();
  const apps = await getAllApps();
  
  // Get all files
  const files: WebAppFile[] = await new Promise((resolve, reject) => {
    const transaction = db.transaction('files', 'readonly');
    const store = transaction.objectStore('files');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as WebAppFile[]);
    request.onerror = () => reject(request.error);
  });

  // Convert files with Blobs to base64 serializable files
  const serializedFiles = await Promise.all(
    files.map(async (f) => {
      const dataUrl = await blobToDataURL(f.content);
      return {
        id: f.id,
        appId: f.appId,
        path: f.path,
        mimeType: f.mimeType,
        content: dataUrl
      };
    })
  );

  return JSON.stringify({
    version: 1,
    exportedAt: Date.now(),
    apps,
    files: serializedFiles
  }, null, 2);
}

/**
 * Import and merge apps and files backup structure into IndexedDB
 */
export async function importAllData(jsonData: string): Promise<{ appsCount: number; filesCount: number }> {
  let backup: any;
  try {
    backup = JSON.parse(jsonData);
  } catch (parseErr: any) {
    throw new Error('Yüklenen veri geçerli bir JSON metni değil: ' + parseErr.message);
  }
  
  if (!backup) {
    throw new Error('Yüklenen veri boş veya geçersiz.');
  }

  let appsList: any[] = [];
  let filesList: any[] = [];

  // Determine schema format automatically
  if (Array.isArray(backup)) {
    // Direct array of applications
    appsList = backup;
  } else if (typeof backup === 'object') {
    if (Array.isArray(backup.apps)) {
      appsList = backup.apps;
    } else if (backup.id && backup.name) {
      // Single app object
      appsList = [backup];
    }

    if (Array.isArray(backup.files)) {
      filesList = backup.files;
    }
  } else {
    throw new Error('Geçersiz yedekleme veya güncelleme formatı.');
  }

  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['apps', 'files'], 'readwrite');
    const appsStore = transaction.objectStore('apps');
    const filesStore = transaction.objectStore('files');

    transaction.oncomplete = () => {
      resolve({
        appsCount: appsList.length,
        filesCount: filesList.length
      });
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    // Store App Metadata records
    for (const app of appsList) {
      if (app && app.id && app.name) {
        appsStore.put(app);
      }
    }

    // Convert and Store File Records
    for (const file of filesList) {
      if (file && file.id && file.content) {
        try {
          const blobContent = dataURLtoBlob(file.content);
          const record: WebAppFile = {
            id: file.id,
            appId: file.appId,
            path: file.path,
            mimeType: file.mimeType,
            content: blobContent
          };
          filesStore.put(record);
        } catch (err) {
          console.error('Dosya geri yükleme hatası:', file.path, err);
        }
      }
    }
  });
}
