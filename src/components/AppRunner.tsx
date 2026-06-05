/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, RotateCw, Maximize2, Minimize2, Cpu } from 'lucide-react';
import { WebApp } from '../types';

interface AppRunnerProps {
  app: WebApp;
  onClose: () => void;
}

export default function AppRunner({ app, onClose }: AppRunnerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [runToken, setRunToken] = useState(() => Date.now().toString());
  const [isSwControlled, setIsSwControlled] = useState(true);

  // Check Service Worker status on mount of runner
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (!navigator.serviceWorker.controller) {
        setIsSwControlled(false);
        // Try to force trigger controlling
        navigator.serviceWorker.ready.then(() => {
          // If a service worker is ready but not controlling, it might just need a small push or reload
          console.warn('[Runner Warning] Service Worker is ready but not controlling client page yet.');
        });
      }
    }
  }, []);

  // Reload iframe with a fresh cache-buster token
  const handleReload = () => {
    setIsLoading(true);
    setRunToken(Date.now().toString());
  };

  // Safe fullscreen request
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => {
          console.error(`Fullscreen Error: ${err.message}`);
        });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Sync fullscreen change with ESC key
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Determine virtual app URI with dynamic cachebuster token
  const appUri = `/virtual-app/${app.id}/${app.entryPoint}?t=${runToken}`;

  return (
    <div 
      ref={containerRef}
      id="app-runner-container"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100"
    >
      {/* Control Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 md:px-6">
        {/* Left Side Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 px-4 py-2 text-sm font-semibold transition-all active:scale-95"
            title="Sistem Platformuna Geri Dön"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Platforma Dön</span>
          </button>
          
          <div className="h-5 w-px bg-slate-800" />

          {/* Running App Icon details */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-lg">
              {app.icon}
            </div>
            <div>
              <h3 className="font-display font-bold text-sm tracking-tight text-slate-100 leading-tight">
                {app.name}
              </h3>
              <p className="hidden xs:block text-[10px] text-slate-500 font-mono">{app.category}</p>
            </div>
          </div>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2">
          {/* Active status pulse badge */}
          <div className="mr-2 flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Aktif
          </div>

          <button
            onClick={handleReload}
            className="rounded-xl border border-slate-800 bg-slate-800/40 p-2 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100 transition-all"
            title="Uygulamayı Yeniden Yükle"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleToggleFullscreen}
            className="rounded-xl border border-slate-800 bg-slate-800/40 p-2 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100 transition-all"
            title={isFullscreen ? 'Küçült' : 'Tam Ekran yap'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Service Worker Connection Warning */}
      {!isSwControlled && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 px-4 py-2.5 text-xs flex flex-col sm:flex-row gap-2 sm:items-center justify-between font-mono animate-pulse">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Sanal sunucu bağlantısı kuruluyor veya gecikiyor. Uygulama verileri yüklenmeyebilir.</span>
          </span>
          <button 
            onClick={() => window.location.reload()}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-lg transition-all active:scale-95 text-center shrink-0 cursor-pointer"
          >
            Bağlantıyı Onar (Sayfayı Yenile)
          </button>
        </div>
      )}

      {/* Frame Wrapper */}
      <div className="relative flex-grow bg-slate-950 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 gap-3 z-10 transition-opacity">
            <Cpu className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-xs font-mono text-slate-400">Uygulama yükleniyor...</p>
          </div>
        )}

        {/* Sandbox IFrame */}
        <iframe
          ref={iframeRef}
          src={appUri}
          onLoad={() => setIsLoading(false)}
          className="w-full h-full border-none bg-white"
          title={`Uygulama - ${app.name}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        />
      </div>
    </div>
  );
}
