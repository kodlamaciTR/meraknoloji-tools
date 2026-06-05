/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { X, Upload, FolderOpen, FileCode, CheckCircle, AlertTriangle } from 'lucide-react';
import { WebApp, CATEGORIES, Category } from '../types';
import { getMimeType } from '../utils/db';

const isHtmlFile = (path: string): boolean => {
  if (!path) return false;
  const cleaned = path.trim().toLowerCase();
  
  // Extract filename at the end of path
  const parts = cleaned.split('/');
  const fileName = parts[parts.length - 1];
  
  // Check if filename ends with .html or .htm or has fallback parameters
  return fileName.endsWith('.html') || 
         fileName.endsWith('.htm') || 
         /\.html?(?:\?|#|$)/i.test(fileName);
};

interface UploadModalProps {
  onClose: () => void;
  onUpload: (
    appData: Omit<WebApp, 'id' | 'uploadedAt' | 'isFavorite' | 'lastOpenedAt' | 'sizeBytes'>,
    files: { path: string; content: Blob; mimeType: string }[]
  ) => void;
}

const QUICK_EMOJIS = ['📅', '🛠️', '🎨', '🎬', '🎵', '🤖', '🎮', '📁', '🚀', '⚙️', '📈', '🧩', '🩺', '🛒'];

export default function UploadModal({ onClose, onUpload }: UploadModalProps) {
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [appCategory, setAppCategory] = useState<Category>('Verimlilik');
  const [appIcon, setAppIcon] = useState('📁');
  const [customEmoji, setCustomEmoji] = useState('');
  
  const [filesToUpload, setFilesToUpload] = useState<{ path: string; file: File }[]>([]);
  const [entryPoint, setEntryPoint] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadType, setUploadType] = useState<'files' | 'folder'>('files');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Recursive file-system entry traversal helper for directory drops
  const getFilesFromDataTransfer = async (items: DataTransferItemList): Promise<{ path: string; file: File }[]> => {
    const list: { path: string; file: File }[] = [];

    const traverse = async (entry: any, path: string = '') => {
      if (entry.isFile) {
        try {
          const file = await new Promise<File>((resolve, reject) => {
            entry.file(resolve, reject);
          });
          list.push({
            path: path + file.name,
            file: file
          });
        } catch (e) {
          console.error('[SW Tracker] Entry read error:', e);
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readEntries = async (): Promise<any[]> => {
          return new Promise((resolve) => {
            reader.readEntries(resolve, () => resolve([]));
          });
        };

        let chunk = await readEntries();
        const allEntries = [...chunk];
        // Read full directory content in chunks (since browser readers might cap results at 100/call)
        while (chunk.length > 0) {
          chunk = await readEntries();
          allEntries.push(...chunk);
        }

        for (const child of allEntries) {
          await traverse(child, path + entry.name + '/');
        }
      }
    };

    const promises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          promises.push(traverse(entry));
        }
      }
    }

    await Promise.all(promises);
    return list;
  };

  // Centralized, unified parsing for both folder inputs, single-file lists, and folder drag-and-drop tethers
  const processParsedFiles = (parsedEntries: { path: string; file: File }[]) => {
    const parsed = parsedEntries
      .map((entry) => {
        let path = entry.path.trim();
        // Normalize backslashes to forward slashes for cross-platform compatibility
        // also remove any leading/trailing slashes to ensure splitting behaves perfectly
        path = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
        
        // Strip top level directory if uploading as folder structure (path contains at least one slash)
        const parts = path.split('/');
        if (parts.length > 1) {
          path = parts.slice(1).join('/').trim();
        }

        return { path, file: entry.file };
      })
      .filter((item) => item.path !== '' && item.file.size > 0); // Filter out empty directory representations

    if (parsed.length === 0) {
      setErrorMsg('Geçerli hiçbir dosya algılanamadı.');
      return;
    }

    // Merge or set files (overwriting for fresh uploads)
    setFilesToUpload(parsed);

    // Auto guess app name based on first file name or folder upload name
    if (!appName && parsedEntries.length > 0) {
      const firstEntry = parsedEntries[0];
      const firstParts = firstEntry.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').split('/');
      if (firstParts.length > 1 && firstParts[0]) {
        setAppName(cleanName(firstParts[0]));
      } else {
        const firstHtml = parsed.find(p => isHtmlFile(p.path));
        if (firstHtml) {
          setAppName(cleanName(firstHtml.path.replace(/\.[^/.]+$/, "")));
        } else {
          setAppName(cleanName(firstEntry.file.name.replace(/\.[^/.]+$/, "")));
        }
      }
    }

    // Auto detect entryPoint (index.html, Index.htm, or any html file) using prioritized rule
    const findPriorityEntryPoint = () => {
      const lowerPaths = parsed.map(p => ({ original: p.path, lower: p.path.toLowerCase() }));
      
      // 1. Exact index.html / index.htm or ending with /index.html or /index.htm
      const exactIndex = lowerPaths.find(p => p.lower === 'index.html' || p.lower === 'index.htm' || p.lower.endsWith('/index.html') || p.lower.endsWith('/index.htm'));
      if (exactIndex) return exactIndex.original;

      // 2. Contains "index" and ends with/includes .html/.htm
      const containsIndex = lowerPaths.find(p => isHtmlFile(p.original) && p.lower.includes('index'));
      if (containsIndex) return containsIndex.original;

      // 3. Contains "main" and ends with/includes .html/.htm
      const containsMain = lowerPaths.find(p => isHtmlFile(p.original) && p.lower.includes('main'));
      if (containsMain) return containsMain.original;

      // 4. Contains "app" and ends with/includes .html/.htm
      const containsApp = lowerPaths.find(p => isHtmlFile(p.original) && p.lower.includes('app'));
      if (containsApp) return containsApp.original;

      // 5. Any HTML file
      const anyHtml = lowerPaths.find(p => isHtmlFile(p.original));
      if (anyHtml) return anyHtml.original;

      // 6. Fallback to first file
      return parsed.length > 0 ? parsed[0].path : '';
    };

    setEntryPoint(findPriorityEntryPoint());

    // Auto-categorize based on folder/file names
    const pathSample = parsedEntries[0].path.toLowerCase();
    if (pathSample.includes('game') || pathSample.includes('oyun') || pathSample.includes('play') || pathSample.includes('retro')) {
      setAppCategory('Oyunlar');
      setAppIcon('🎮');
    } else if (pathSample.includes('ai') || pathSample.includes('gemini') || pathSample.includes('artificial')) {
      setAppCategory('Yapay Zeka Araçları');
      setAppIcon('🤖');
    } else if (pathSample.includes('dev') || pathSample.includes('code') || pathSample.includes('tool')) {
      setAppCategory('Geliştirici Araçları');
      setAppIcon('🛠️');
    }
  };

  // Handle files parsing from input select elements
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg('');

    const fileList = Array.from(files);
    const parsedEntries = fileList.map((f) => {
      const relPath = f.webkitRelativePath 
        ? f.webkitRelativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim() 
        : '';
      return {
        path: relPath || f.name,
        file: f
      };
    });

    processParsedFiles(parsedEntries);
  };

  React.useEffect(() => {
    const fileCount = filesToUpload.length;
    const htmlFileExists = filesToUpload.some(f => isHtmlFile(f.path));
    const entryPointSelected = entryPoint || '(Henüz Seçilmedi/Geçersiz)';
    const buttonState = fileCount > 0 ? 'ENABLED (En az 1 dosya yüklendi)' : 'DISABLED (Yüklenmiş dosya yok)';

    console.log('[DEBUG] --- GİRİŞ NOKTASI VE DOSYA KONTROLÜ ---');
    console.log(`[DEBUG] fileCount: ${fileCount}`);
    console.log(`[DEBUG] htmlFileExists: ${htmlFileExists}`);
    console.log(`[DEBUG] entryPointSelected: ${entryPointSelected}`);
    console.log(`[DEBUG] buttonState: ${buttonState}`);
    console.log('----------------------------------------------');
  }, [filesToUpload, entryPoint]);

  // Synchronize entryPoint if filesToUpload change to make sure it always references a valid HTML or fallback file
  React.useEffect(() => {
    if (filesToUpload.length > 0) {
      const exists = filesToUpload.some(f => f.path === entryPoint);
      if (!exists) {
        const lowerPaths = filesToUpload.map(p => ({ original: p.path, lower: p.path.toLowerCase() }));
        const exactIndex = lowerPaths.find(p => p.lower === 'index.html' || p.lower === 'index.htm' || p.lower.endsWith('/index.html') || p.lower.endsWith('/index.htm'));
        if (exactIndex) {
          setEntryPoint(exactIndex.original);
        } else {
          const anyHtml = lowerPaths.find(p => isHtmlFile(p.original));
          if (anyHtml) {
            setEntryPoint(anyHtml.original);
          } else {
            setEntryPoint(filesToUpload[0].path);
          }
        }
      }
    } else {
      setEntryPoint('');
    }
  }, [filesToUpload]);

  const fItemWithWebkitPath = (list: File[]) => {
    return list.some(item => item.webkitRelativePath && item.webkitRelativePath.includes('/'));
  };

  const cleanName = (fileName: string) => {
    return fileName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setErrorMsg('');

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      try {
        const files = await getFilesFromDataTransfer(e.dataTransfer.items);
        if (files.length > 0) {
          processParsedFiles(files);
        } else {
          setErrorMsg('Sürüklenen klasör veya dosyalardan veri okunamadı.');
        }
      } catch (err: any) {
        console.error('[Drop Parse Error]', err);
        setErrorMsg('Klasör yapısı taranırken bir hata oluştu veya okuma engellendi.');
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const triggerFileSelect = () => {
    if (uploadType === 'files' && fileInputRef.current) {
      fileInputRef.current.click();
    } else if (uploadType === 'folder' && folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleCustomEmojiChange = (val: string) => {
    setCustomEmoji(val);
    if (val.trim()) {
      setAppIcon(val.trim());
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!appName.trim()) {
      setErrorMsg('Lütfen geçerli bir Uygulama Adı yazın.');
      return;
    }

    if (filesToUpload.length === 0) {
      setErrorMsg('Lütfen yüklemek için en az bir dosya seçin.');
      return;
    }

    const hasHtml = filesToUpload.some(f => isHtmlFile(f.path));
    let finalFiles = [...filesToUpload];

    // Fallback: Eğer hiç HTML dosyası algılanmadıysa, sistemin kilitlenmesini engellemek için arka planda otomatik index.html oluştur
    if (!hasHtml) {
      console.log('[DEBUG] Hiçbir HTML dosyası algılanamadı. Otomatik index.html oluşturuluyor.');
      const jsFile = filesToUpload.find(f => f.path.toLowerCase().endsWith('.js'));
      const cssFile = filesToUpload.find(f => f.path.toLowerCase().endsWith('.css'));
      
      const virtualHtmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${appName.trim()}</title>
    ${cssFile ? `<link rel="stylesheet" href="${cssFile.path}">` : ''}
    <style>
        body {
            background-color: #0f172a;
            color: #f8fafc;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }
        .container {
            text-align: center;
            background-color: #1e293b;
            padding: 2.5rem;
            border-radius: 1rem;
            border: 1px solid #334155;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }
        h1 { margin: 0 0 1rem; color: #3b82f6; font-size: 1.8rem; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }
        .file-list {
            text-align: left;
            background-color: #0f172a;
            padding: 1rem;
            border-radius: 0.5rem;
            font-family: monospace;
            font-size: 0.8rem;
            border: 1px solid #334155;
            max-height: 151px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${appName.trim()}</h1>
        <p>Uygulama başarıyla başlatıldı! Yüklediğiniz dosyalar IndexedDB üzerinden simüle edilerek çalıştırılıyor.</p>
        <div class="file-list">
            <strong>Yüklenmiş Olan Dosyalar:</strong><br/>
            ${filesToUpload.map(f => `• ${f.path}`).join('<br/>')}
        </div>
    </div>
    ${jsFile ? `<script src="${jsFile.path}"></script>` : ''}
</body>
</html>`;

      const blob = new Blob([virtualHtmlContent], { type: 'text/html' });
      const virtualFile = new File([blob], 'index.html', { type: 'text/html' });
      
      finalFiles.push({
        path: 'index.html',
        file: virtualFile
      });
    }

    // Find and guarantee a valid entry point
    let finalEntryPoint = entryPoint;
    const entryExists = finalFiles.some(f => f.path === finalEntryPoint);
    if (!hasHtml) {
      finalEntryPoint = 'index.html';
    } else if (!finalEntryPoint || !entryExists) {
      const firstHtml = finalFiles.find(f => isHtmlFile(f.path));
      if (firstHtml) {
        finalEntryPoint = firstHtml.path;
      } else {
        finalEntryPoint = finalFiles[0].path;
      }
    }

    // Map files to binary Blobs
    try {
      const filesWithBlobs = finalFiles.map((item) => {
        return {
          path: item.path,
          content: item.file as Blob,
          mimeType: getMimeType(item.path),
        };
      });

      // Submit up
      onUpload(
        {
          name: appName.trim(),
          description: appDescription.trim(),
          category: appCategory,
          icon: appIcon,
          entryPoint: finalEntryPoint,
        },
        filesWithBlobs
      );
    } catch (err: any) {
      setErrorMsg(`Yükleme sırasında bir hata oluştu: ${err.message}`);
    }
  };

  const calculateTotalSize = () => {
    const totalBytes = filesToUpload.reduce((sum, item) => sum + item.file.size, 0);
    if (totalBytes === 0) return '0 KB';
    return (totalBytes / 1024).toFixed(1) + ' KB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div 
        id="upload-modal-container"
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl transition-all md:p-8 flex flex-col max-h-[90vh]"
      >
        {/* Head */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-100">Yeni Uygulama Yükle</h2>
              <p className="text-xs text-slate-400">Html, Css, JS ve görsel varlıklarınızı doğrudan tarayıcınıza yükleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleUploadSubmit} className="mt-6 flex flex-col gap-6 overflow-y-auto pr-2 flex-grow">
          {errorMsg && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Upload Type Selector */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1 border border-slate-800/60">
            <button
              type="button"
              onClick={() => {
                setUploadType('files');
                setFilesToUpload([]);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                uploadType === 'files'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="h-4 w-4" />
              Dosya(lar) Yükle
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadType('folder');
                setFilesToUpload([]);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                uploadType === 'folder'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              Klasör Yükle
            </button>
          </div>

          {/* Drag & Drop Area */}
          <div
            id="drag-drop-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragOver
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-slate-800 hover:border-slate-700 hover:bg-slate-950/20'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFilesSelected(e.target.files)}
              multiple
              className="hidden"
            />
            {/* Folder selection requires specific webkit directory configs */}
            <input
              type="file"
              ref={folderInputRef}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
              {...{ webkitdirectory: "", directory: "", multiple: true } as any}
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 group-hover:text-blue-400">
              {uploadType === 'files' ? <FileCode className="h-6 w-6 text-blue-500" /> : <FolderOpen className="h-6 w-6 text-blue-500" />}
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-200">
              {uploadType === 'files'
                ? 'Dosya seçmek için tıklayın veya sürükleyip bırakın'
                : 'Klasör seçmek için tıklayın veya klasörü buraya bırakın'}
            </p>
            <p className="mt-1 text-xs text-slate-500 font-mono">
              Desteklenen: .html, .css, .js, .json, resimler (.png, .jpg, .svg, vb.)
            </p>

            {filesToUpload.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 font-mono">
                <CheckCircle className="h-4 w-4" />
                {filesToUpload.length} dosya algılandı ({calculateTotalSize()})
              </div>
            )}
          </div>

          {/* If files uploaded, show metadata details & customization */}
          {filesToUpload.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Left Col: Details */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Uygulama Adı</label>
                  <input
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 placeholder-slate-700 focus:border-blue-500 focus:outline-none transition-all"
                    placeholder="Örn: Klasik Yılan Oyunu"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Kategori</label>
                  <select
                    value={appCategory}
                    onChange={(e) => setAppCategory(e.target.value as Category)}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-200 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Açıklama</label>
                  <textarea
                    value={appDescription}
                    onChange={(e) => setAppDescription(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 placeholder-slate-700 focus:border-blue-500 focus:outline-none transition-all resize-none"
                    placeholder="Uygulama hakkında kısa bilgi ekleyin..."
                  />
                </div>
              </div>

              {/* Right Col: Icon Selection & Initialization properties */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono mb-2">Platform Simgesi</label>
                  <div className="flex items-center gap-3">
                    {/* Visual Output */}
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-950 border border-slate-800 text-3xl">
                      {appIcon}
                    </div>

                    {/* Inputs */}
                    <div className="flex-1">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="Özel emoji yapıştırın"
                        value={customEmoji}
                        onChange={(e) => handleCustomEmojiChange(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 font-mono mt-1 block">Çift tıklayarak özel emoji kullanabilirsiniz veya aşağıdan seçin.</span>
                    </div>
                  </div>

                  {/* Quick selectors */}
                  <div className="mt-3 flex flex-wrap gap-2 max-h-[5.5rem] overflow-y-auto border border-slate-800/40 p-2.5 rounded-xl bg-slate-950/40">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => {
                          setAppIcon(emoji);
                          setCustomEmoji('');
                        }}
                        className={`hover:scale-125 transition-transform text-xl p-1 rounded-md ${
                          appIcon === emoji ? 'bg-blue-600/20 scale-110 border border-blue-500/30' : ''
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Başlangıç Dosyası (Giriş Noktası)</label>
                  <select
                    value={entryPoint}
                    onChange={(e) => setEntryPoint(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-mono text-slate-300 focus:border-blue-500 focus:outline-none transition-all"
                  >
                    {filesToUpload.map((f) => {
                      const isHtml = isHtmlFile(f.path);
                      return (
                        <option key={f.path} value={f.path}>
                          {f.path}{isHtml ? ' (HTML)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    Iframe ilk açıldığında yüklenecek ana HTML dosyası.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Row */}
          <div className="mt-auto border-t border-slate-800/80 pt-6 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={filesToUpload.length === 0}
              className={`rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all ${
                filesToUpload.length === 0
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-600/15'
              }`}
            >
              Uygulamayı Kaydet ve Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
