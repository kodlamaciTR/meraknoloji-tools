/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Search, 
  Plus, 
  Heart, 
  Gamepad2, 
  Settings as SettingsIcon, 
  X, 
  Zap, 
  Sun, 
  Moon, 
  Monitor, 
  Clock, 
  Play, 
  SlidersHorizontal, 
  AlertCircle, 
  Sparkles,
  Info,
  ChevronRight,
  RefreshCw,
  Cpu,
  Download,
  Upload,
  Database,
  Lock,
  Unlock
} from 'lucide-react';

import { WebApp, AppSettings, Category, CATEGORIES } from './types';
import { getAllApps, saveApp, deleteApp, updateAppMetadata, exportAllData, importAllData } from './utils/db';

import AppCard from './components/AppCard';
import UploadModal from './components/UploadModal';
import EditModal from './components/EditModal';
import AppRunner from './components/AppRunner';

export default function App() {
  // Service Worker & DB states
  const [apps, setApps] = useState<WebApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Runner State
  const [activeApp, setActiveApp] = useState<WebApp | null>(null);

  // Modals Visibility
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<WebApp | null>(null);

  // Active View Tab config: 'all' | 'games' | 'favorites' | 'settings'
  const [activeTab, setActiveTab] = useState<'all' | 'games' | 'favorites' | 'settings'>('all');

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'Tümü'>('Tümü');

  // Recent Searches Saved in LocalStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('webapp_platform_searches');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Settings Configuration State
  const [savedSettings, setSavedSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem('webapp_platform_settings');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      theme: 'system',
      geminiApiKey: ''
    };
  });

  // Gemini Connection Tester State
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Backup, Restore States
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Secure Panel Toggle states (hidden from general users)
  // 1. Is the admin mode ARMED? (clicks on lock status button, turns indicator green/red)
  const [isAdminArmed, setIsAdminArmed] = useState(() => {
    return localStorage.getItem('webapp_platform_admin_unlocked') === 'true';
  });
  // 2. Are the panels VISUALLY REVEALED? (toggled via Ctrl + Alt + N only if armed)
  const [isAdminRevealed, setIsAdminRevealed] = useState(false);
  const [buttonPressState, setButtonPressState] = useState<'serbest' | 'basıldı'>('serbest');
  const [showComboToast, setShowComboToast] = useState(false);
  const [adminCountdown, setAdminCountdown] = useState<number | null>(null);

  // SANAL ÇELİK KASA PIN PAD YAPILANDIRMASI
  const [pinInput, setPinInput] = useState('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'error' | 'success'>('idle');
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Retro çelik kasa tuş tıklama sesleri harmonik sentezleyici
  const playKeySound = (type: 'number' | 'clear' | 'success' | 'error') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'number') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'clear') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'success') {
        // Çift tonlu elektronik çınlama melodisi
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12); // G5
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.24); // C6
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else if (type === 'error') {
        // Hatalı şifre uyarısı bas kalın sesi
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) {
      console.debug('Web audio context not ready yet');
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinStatus === 'success') return;
    setPinStatus('idle');
    playKeySound('number');
    setPinInput((prev) => {
      if (prev.length >= 4) return prev;
      const newVal = prev + digit;
      if (newVal.length === 4) {
        if (newVal === '2016') {
          setPinStatus('success');
          playKeySound('success');
          // Kasa açılma hissi için gecikmeyle görünür yapalım
          setTimeout(() => {
            setIsAdminRevealed(true);
            setPinInput('');
            setPinStatus('idle');
          }, 1400);
        } else {
          setPinStatus('error');
          playKeySound('error');
          setTimeout(() => {
            setPinInput('');
            setPinStatus('idle');
          }, 1400);
        }
      }
      return newVal;
    });
  };

  const handlePinClear = () => {
    playKeySound('clear');
    setPinInput('');
    setPinStatus('idle');
  };

  // Fiziksel klavyeden 0-9 basıldığında otomatik PIN pad algılama hook'u
  useEffect(() => {
    if (!isAdminArmed || isAdminRevealed) return;
    const handleKeyboardInput = (e: KeyboardEvent) => {
      // Form alanları içindeyse tetiklenmesin
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }
      const isDigit = /^[0-9]$/.test(e.key);
      if (isDigit) {
        e.preventDefault();
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handlePinClear();
      }
    };
    window.addEventListener('keydown', handleKeyboardInput, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyboardInput, { capture: true });
    };
  }, [isAdminArmed, isAdminRevealed, pinStatus]);

  // Countdown timer logic for administrative arming sequence
  useEffect(() => {
    if (adminCountdown === null) return;

    if (adminCountdown === 0) {
      setIsAdminArmed(true);
      localStorage.setItem('webapp_platform_admin_unlocked', 'true');
      setAdminCountdown(null);
      
      // Focus page
      window.focus();
      document.body.focus();
      
      setShowComboToast(true);
      const timer = setTimeout(() => setShowComboToast(false), 6000);
      return () => clearTimeout(timer);
    }

    const interval = setTimeout(() => {
      setAdminCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(interval);
  }, [adminCountdown]);

  // Shortcut to toggle admin mode visual visibility (Ctrl + Alt + N) only when armed
  useEffect(() => {
    const handleToggleEvent = (e: KeyboardEvent) => {
      // Support standard N key, character code, keydown, Turkish layouts, and alternate combinations
      const isNKey = 
        e.key?.toLowerCase() === 'n' || 
        e.code?.toLowerCase() === 'keyn' || 
        e.keyCode === 78 || 
        e.which === 78 ||
        e.key === 'n' || 
        e.key === 'N' ||
        e.key === 'ı' || // Some Turkish layout configurations map Alt+N or Ctrl+Alt+N to 'ı' or 'I'
        e.key === 'I' ||
        e.key === 'ñ';
      
      const hasAltGr = e.getModifierState && e.getModifierState('AltGraph');
      const hasModifiers = (e.ctrlKey && e.altKey) || e.metaKey || hasAltGr || (e.ctrlKey && e.shiftKey) || (e.altKey && e.shiftKey);
      
      if (hasModifiers && isNKey) {
        if (!isAdminArmed) {
          // If not armed, we do nothing
          return;
        }

        e.preventDefault();
        setButtonPressState('basıldı');
        
        // Toggle the visual panels safely (only lock/hide from keyboard shortcut is allowed, unlocking requires PIN pad '2016' entry)
        if (isAdminRevealed) {
          setIsAdminRevealed(false);
          // Auto reset press animation feedback after 0.4 seconds
          setTimeout(() => {
            setButtonPressState('serbest');
          }, 400);
        } else {
          // Play mistake noise and notify that pin keyboard must be utilized
          playKeySound('error');
          setTimeout(() => {
            setButtonPressState('serbest');
          }, 400);
        }
      }
    };

    const handleReleaseEvent = (e: KeyboardEvent) => {
      const isNKey = 
        e.key?.toLowerCase() === 'n' || 
        e.code?.toLowerCase() === 'keyn' || 
        e.keyCode === 78 || 
        e.which === 78;
      if (isNKey || !e.ctrlKey || !e.altKey) {
        setButtonPressState('serbest');
      }
    };

    // Listen to BOTH window and document to capture events when focus is anywhere inside the app page
    window.addEventListener('keydown', handleToggleEvent, { capture: true });
    window.addEventListener('keyup', handleReleaseEvent, { capture: true });
    document.addEventListener('keydown', handleToggleEvent, { capture: true });
    document.addEventListener('keyup', handleReleaseEvent, { capture: true });
    
    return () => {
      window.removeEventListener('keydown', handleToggleEvent, { capture: true });
      window.removeEventListener('keyup', handleReleaseEvent, { capture: true });
      document.removeEventListener('keydown', handleToggleEvent, { capture: true });
      document.removeEventListener('keyup', handleReleaseEvent, { capture: true });
    };
  }, [isAdminArmed]);

  // 1. Register Service Worker on Mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register with root scope so that the service worker can control the main document.
      // This is vital to guarantee that clients.claim() works and intercepts iframe fetches immediately!
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Virtual App Service Worker başarıyla yüklendi. Scope:', reg.scope);
          
          // If this is the first registration and there is no active controller yet,
          // listen for when the service worker takes control and reload so it takes effect immediately.
          if (!navigator.serviceWorker.controller) {
            const onControllerChange = () => {
              console.log('[SW] Sayfa artık Service Worker tarafından kontrol ediliyor. Yeniden yükleniyor...');
              navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
              window.location.reload();
            };
            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
          }
        })
        .catch((err) => {
          console.error('Service Worker yükleme hatası:', err);
        });
    }
    // Load apps
    loadApplications();
  }, []);

  // 2. Load apps list from database
  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const list = await getAllApps();
      setApps(list);
    } catch (err) {
      console.error('Uygulamalar yüklenirken hata:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Theme Synchronization effect
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      const themePreference = savedSettings.theme;
      
      let isDark = false;
      if (themePreference === 'dark') {
        isDark = true;
      } else if (themePreference === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      
      if (isDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    applyTheme();

    // Listen for system changes if system theme is selected
    if (savedSettings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [savedSettings.theme]);

  // Handle saving App settings
  const handleSaveSettings = (updated: Partial<AppSettings>) => {
    const newSettings = { ...savedSettings, ...updated };
    setSavedSettings(newSettings);
    localStorage.setItem('webapp_platform_settings', JSON.stringify(newSettings));
  };

  // Launch Virtual Web App (updates recents list in DB)
  const handleOpenApp = async (app: WebApp) => {
    try {
      const updatedApp: WebApp = {
        ...app,
        lastOpenedAt: Date.now()
      };
      await updateAppMetadata(updatedApp);
      await loadApplications();
      
      // Save query if user was searching
      if (searchQuery.trim()) {
        const query = searchQuery.trim();
        const filtered = recentSearches.filter(s => s.toLowerCase() !== query.toLowerCase());
        const updatedSearches = [query, ...filtered].slice(0, 5);
        setRecentSearches(updatedSearches);
        localStorage.setItem('webapp_platform_searches', JSON.stringify(updatedSearches));
      }

      // Launch overlay
      setActiveApp(updatedApp);
    } catch (err) {
      console.error('Uygulama açılırken hata:', err);
    }
  };

  // Delete Web App
  const handleDeleteApp = async (id: string) => {
    // SECURITY GUARD: Direct protection of database writes
    if (!isAdminArmed || !isAdminRevealed) {
      alert("Güvenlik Hatası: Yetkisiz erişim! Uygulama silmek için lütfen önce Ayarlar sayfasından Güvenli Sanal Kasa Şifresini girerek kilidi açın.");
      return;
    }

    const target = apps.find(a => a.id === id);
    if (!target) return;

    if (confirm(`"${target.name}" uygulamasını ve bu uygulamaya ait tüm dosyaları kalıcı olarak silmek istediğinizden emin misiniz?`)) {
      try {
        await deleteApp(id);
        await loadApplications();
      } catch (err: any) {
        alert('Silme işlemi başarısız: ' + err.message);
      }
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async (app: WebApp) => {
    const updated: WebApp = {
      ...app,
      isFavorite: !app.isFavorite
    };
    try {
      await updateAppMetadata(updated);
      await loadApplications();
    } catch (err) {
      console.error('Favori değiştirme hatası:', err);
    }
  };

  // Trigger Save on upload
  const handleUploadApp = async (
    meta: Omit<WebApp, 'id' | 'uploadedAt' | 'isFavorite' | 'lastOpenedAt' | 'sizeBytes'>,
    files: { path: string; content: Blob; mimeType: string }[]
  ) => {
    // SECURITY GUARD: Direct protection of database writes
    if (!isAdminArmed || !isAdminRevealed) {
      alert("Güvenlik Hatası: Yetkisiz erişim! Yeni uygulama yüklemek için lütfen önce Ayarlar sayfasından Güvenli Sanal Kasa Şifresini girerek kilidi açın.");
      return;
    }

    const id = 'app-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
    const sizeBytes = files.reduce((acc, f) => acc + f.content.size, 0);

    const newApp: WebApp = {
      ...meta,
      id,
      uploadedAt: Date.now(),
      isFavorite: false,
      lastOpenedAt: null,
      sizeBytes
    };

    try {
      await saveApp(newApp, files);
      setIsUploadOpen(false);
      await loadApplications();
    } catch (err: any) {
      alert('Hata: Uygulama veritabanına kaydedilemedi. Detay: ' + err.message);
    }
  };

  // Trigger save on edit
  const handleSaveEditApp = async (updated: WebApp) => {
    // SECURITY GUARD: Direct protection of database writes
    if (!isAdminArmed || !isAdminRevealed) {
      alert("Güvenlik Hatası: Yetkisiz erişim! Uygulamaları düzenlemek için lütfen önce Ayarlar sayfasından Güvenli Sanal Kasa Şifresini girerek kilidi açın.");
      return;
    }

    try {
      await updateAppMetadata(updated);
      setIsEditOpen(false);
      setEditingApp(null);
      await loadApplications();
    } catch (err: any) {
      alert('Güncelleme sırasında hata oluştu: ' + err.message);
    }
  };

  // Gemini API Sandbox Key verification tester
  const handleTestGeminiKey = () => {
    setIsTestingGemini(true);
    setGeminiTestResult(null);

    setTimeout(() => {
      setIsTestingGemini(false);
      const key = savedSettings.geminiApiKey.trim();
      
      if (!key) {
        setGeminiTestResult({
          success: false,
          message: 'Bağlantı Başarısız: Gemini API anahtarı boş olamaz.'
        });
      } else if (!key.startsWith('AIzaSy') && key.length < 20) {
        setGeminiTestResult({
          success: false,
          message: 'Bağlantı Başarısız: API anahtarı "AIzaSy" ile başlamalı veya en az 20 karakter uzunluğunda olmalıdır.'
        });
      } else if (key.length < 20) {
        setGeminiTestResult({
          success: false,
          message: 'Bağlantı Başarısız: API anahtarı çok kısa görünüyor.'
        });
      } else {
        const isAlternativeFormat = !key.startsWith('AIzaSy');
        setGeminiTestResult({
          success: true,
          message: isAlternativeFormat
            ? 'Sanal Bağlantı Başarılı! Alternatif anahtar formatı başarıyla algılandı ve kabul edildi.'
            : 'Sanal Bağlantı Başarılı! Gemini API anahtar formatı doğrulandı ve entegrasyon altyapısı hazır hale getirildi.'
        });
      }
    }, 1200);
  };

  // Export local backup as JSON
  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const jsonStr = await exportAllData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `web-platform-yedek-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Yedek alma sırasında hata oluştu: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Import local backup from file
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const result = await importAllData(content);
          alert(`Yedekleme başarıyla geri yüklendi! ${result.appsCount} uygulama ve ${result.filesCount} sanal dosya sisteme entegre edildi.`);
          await loadApplications();
        } catch (err: any) {
          alert('Geri yükleme başarısız. Yedek dosyası geçersiz veya bozuk: ' + err.message);
        } finally {
          setIsImporting(false);
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      alert('Dosya okuma başarısız: ' + err.message);
      setIsImporting(false);
    }
  };



  // Clear query logs
  const handleClearSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('webapp_platform_searches');
  };

  // RECENT APPS SORT: Filter out if lastOpenedAt exists, sorted descending
  const recentlyOpened = apps
    .filter((a) => a.lastOpenedAt !== null)
    .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0))
    .slice(0, 4);

  // SEARCH AND CATEGORY FILTERING LOGIC
  const filteredApps = apps.filter((app) => {
    // 1. Filter by Search tab
    if (activeTab === 'games' && app.category !== 'Oyunlar') return false;
    if (activeTab === 'favorites' && !app.isFavorite) return false;

    // 2. Filter by Category Pills
    if (selectedCategory !== 'Tümü' && app.category !== selectedCategory) return false;

    // 3. Filter by Input Search query string
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = app.name.toLowerCase().includes(q);
      const matchDesc = app.description.toLowerCase().includes(q);
      const matchCat = app.category.toLowerCase().includes(q);
      return matchName || matchDesc || matchCat;
    }

    return true;
  });

  return (
    <div className="min-h-screen px-4 pb-16 transition-colors duration-200 bg-zinc-50 dark:bg-slate-950 text-zinc-900 dark:text-zinc-100 font-sans md:px-8">
      
      {/* Maximum width constraint container */}
      <div className="mx-auto max-w-7xl">
        
        {/* Navigation / Header menu */}
        <header className="flex flex-col gap-4 py-8 border-b border-zinc-200 dark:border-slate-800/80 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              <Layers className="h-5.5 w-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-black tracking-tight text-zinc-900 dark:text-white">MN Tools</h1>
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(true)}
                  className="inline-flex items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-black text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                  title="Sürüm Bilgisi ve Yenilikler"
                >
                  v3
                </button>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex items-center flex-wrap gap-1.5">
                Çok Amaçlı Sanal Web Uygulamaları ve Portalı
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase font-mono tracking-wider border border-indigo-500/15 animate-pulse">
                  <span className="h-1 w-1 rounded-full bg-indigo-500"></span>
                  Bulut Yedekleme Hazır
                </span>
              </p>
            </div>
          </div>

          {/* Nav Tab Items */}
          <nav className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-zinc-200/50 dark:bg-slate-900/60 p-1 border border-zinc-300/30 dark:border-slate-800/40">
            <button
              onClick={() => { setActiveTab('all'); setSelectedCategory('Tümü'); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Layers className="h-4 w-4" />
              Tüm Uygulamalar
            </button>
            
            {/* Blinking Update Badge right next to it */}
            <button
              type="button"
              onClick={() => setShowUpdateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 animate-pulse hover:bg-emerald-500/25 cursor-pointer active:scale-95 transition-all"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              YENİLİK VAR!
            </button>
            
            <button
              onClick={() => { setActiveTab('games'); setSelectedCategory('Tümü'); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'games'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Gamepad2 className="h-4 w-4" />
              Oyunlar
            </button>
            
            <button
              onClick={() => { setActiveTab('favorites'); setSelectedCategory('Tümü'); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'favorites'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Heart className="h-4 w-4" />
              Favoriler
            </button>

            <button
              onClick={() => { setActiveTab('settings'); setSelectedCategory('Tümü'); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-slate-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <SettingsIcon className="h-4 w-4" />
              Ayarlar
            </button>
          </nav>
        </header>

        {/* Dynamic Inner layouts depending on tab */}
        {activeTab === 'settings' ? (
          
          /* ================= SETTINGS PANE ================= */
          <div id="settings-view" className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <h2 className="font-display text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Platform Ayarları</h2>
              <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-1">Platform görünümünüzü ve Gelecekteki Yapay Zeka (Gemini API) bağlantılarınızı buradan ayarlayın.</p>
            </div>

            <div className="md:col-span-2 flex flex-col gap-6">
              {/* Theme Settings Card */}
              <div className="rounded-2xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 shadow-sm">
                <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
                  <SlidersHorizontal className="h-5 w-5 text-blue-500" />
                  Tema Tercihleri
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Platformun görünüm temasını zevkinize göre özelleştirin.</p>
                
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as const).map((t) => {
                    const label = t === 'light' ? 'Açık Tema' : t === 'dark' ? 'Koyu Tema' : 'Sistem Teması';
                    const IconComp = t === 'light' ? Sun : t === 'dark' ? Moon : Monitor;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleSaveSettings({ theme: t })}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer ${
                          savedSettings.theme === t
                            ? 'bg-blue-600/5 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'bg-zinc-50 dark:bg-slate-900/40 border-zinc-200 dark:border-slate-800/80 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <IconComp className="h-5.5 w-5.5 mb-2" />
                        <span className="text-xs">{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Advanced Lock Toggle Footer */}
                <div className="border-t border-zinc-200 dark:border-slate-800/80 mt-5 pt-4 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Status Indicator Light */}
                      <span className="flex h-5 w-5 items-center justify-center select-none">
                        <span className={`relative flex h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                          adminCountdown !== null
                            ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                            : isAdminArmed 
                              ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' 
                              : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'
                        }`}>
                          {(isAdminArmed || adminCountdown !== null) && (
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                              adminCountdown !== null ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}></span>
                          )}
                        </span>
                      </span>
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 font-mono">
                        {adminCountdown !== null ? (
                          <>Güvenlik Eşleştirmesi: <span className="text-amber-500 font-bold">{adminCountdown} sn kaldı</span></>
                        ) : (
                          <>Yönetici Erişimi: {isAdminArmed ? 'AÇIK (Yeşil)' : 'KİLİTLİ (Kırmızı)'}</>
                        )}
                      </span>
                      {isAdminArmed && showComboToast && (
                        <span className="text-[11px] font-bold text-amber-500 dark:text-amber-400 animate-pulse font-mono ml-1.5 select-none shrink-0 font-bold uppercase">
                          ← KOMBİNASYONU GİRİNİZ!
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Tactile Key Press Indicator */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isAdminArmed) {
                            setIsAdminRevealed((prev) => !prev);
                            setButtonPressState('basıldı');
                            setTimeout(() => setButtonPressState('serbest'), 350);
                          }
                        }}
                        disabled={!isAdminArmed}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded-lg transition-all select-none ${
                          !isAdminArmed 
                            ? 'bg-zinc-100 dark:bg-slate-950 border border-zinc-200 dark:border-slate-800 text-zinc-450 cursor-not-allowed opacity-50'
                            : buttonPressState === 'basıldı'
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-500 scale-95 font-bold cursor-pointer'
                              : 'bg-zinc-200/60 dark:bg-slate-900 border border-zinc-300 dark:border-slate-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-slate-800 cursor-pointer font-bold hover:scale-105 active:scale-95'
                        }`}
                        title={isAdminArmed ? "Gizli yönetici görünümünü aç/kapat (Kısayol: Ctrl + Alt + N)" : "Yönetici ayarları kilitli"}
                      >
                        Tuş: {buttonPressState === 'basıldı' ? 'BASILDI ⬤' : 'SERBEST ◯'}
                      </button>

                      {adminCountdown !== null ? (
                        <button
                          type="button"
                          onClick={() => setAdminCountdown(null)}
                          className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-950 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-450 transition-all active:scale-95 cursor-pointer shadow-sm select-none"
                        >
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-500" />
                          <span>İptal Et</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onMouseDown={() => setButtonPressState('basıldı')}
                          onMouseUp={() => setButtonPressState('serbest')}
                          onMouseLeave={() => setButtonPressState('serbest')}
                          onTouchStart={() => setButtonPressState('basıldı')}
                          onTouchEnd={() => setButtonPressState('serbest')}
                          onClick={() => {
                            if (isAdminArmed) {
                              setIsAdminArmed(false);
                              setIsAdminRevealed(false);
                              setShowComboToast(false);
                              localStorage.setItem('webapp_platform_admin_unlocked', 'false');
                            } else {
                              setAdminCountdown(5);
                            }
                          }}
                          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-slate-950 hover:bg-zinc-100 dark:hover:bg-slate-900 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:text-slate-300 transition-all active:scale-95 cursor-pointer shadow-sm select-none"
                          title="Yönetici Ayarları Güvenlik Kilidi"
                        >
                          {isAdminArmed ? (
                            <>
                              <Unlock className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Erişimi Kilitle</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5 text-rose-500" />
                              <span>Erişimi Aç</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Modern Progress Loading loader */}
                  {adminCountdown !== null && (
                    <div className="w-full bg-zinc-100 dark:bg-slate-950 rounded-full h-1 mt-1 overflow-hidden border border-zinc-200/50 dark:border-slate-900/80 animate-fade-in">
                      <div 
                        className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_8px_#f59e0b]" 
                        style={{ width: `${((5 - adminCountdown) / 5) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {isAdminArmed && isAdminRevealed ? (
                <>
                  {/* AI Gemini Integration Sandbox */}
                  <div className="rounded-2xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 shadow-sm animate-fade-in">
                    <div className="flex items-center gap-2 justify-between mb-2">
                      <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500 fill-amber-500/10" />
                        Yapay Zeka Ayarları (Gemini API)
                      </h3>
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 dark:text-amber-400 font-mono px-2 py-0.5 rounded-md border border-amber-500/20">Altyapı Sandbox</span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Gelecekte platformunuza yüklenecek olan yapay zeka entegrasyonları için Gemini API altyapısını kurun.</p>
                    
                    {/* Form Inputs */}
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider font-mono">Gemini API Anahtarı</label>
                        <input
                          type="password"
                          value={savedSettings.geminiApiKey}
                          onChange={(e) => handleSaveSettings({ geminiApiKey: e.target.value })}
                          placeholder="AIzaSy..."
                          className="mt-1.5 w-full rounded-xl border border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-slate-950 px-4 py-2.5 text-sm py-2.5 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition-all font-mono"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isTestingGemini}
                          onClick={handleTestGeminiKey}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-slate-950 px-4 py-2.5 text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-slate-900 focus:outline-none focus:ring-1 active:scale-98 cursor-pointer"
                        >
                          {isTestingGemini ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              Bağlantı Test Ediliyor...
                            </>
                          ) : (
                            <>
                              <Cpu className="h-3.5 w-3.5 text-blue-500" />
                              Bağlantıyı Test Et
                            </>
                          )}
                        </button>
                      </div>

                      {geminiTestResult && (
                        <div className={`flex items-start gap-2.5 rounded-xl border p-4 text-xs font-mono leading-relaxed ${
                          geminiTestResult.success 
                            ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-red-500/5 border-red-500/10 text-red-600 dark:text-red-400'
                        }`}>
                          <Info className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{geminiTestResult.message}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Data Backup Interface */}
                  <div className="rounded-2xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 shadow-sm animate-fade-in max-w-2xl mx-auto w-full">
                    <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2 mb-2 justify-center">
                      <Database className="h-5 w-5 text-indigo-500" />
                      Veri Yedekleme ve Geri Yükleme
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 text-center">
                      Platformdaki tüm yüklü uygulama kartlarını ve sanal dosyaları tek tıklamayla JSON yedek dosyası olarak bilgisayarınıza yedekleyin veya geri yükleyin.
                    </p>

                    <div className="rounded-xl border border-zinc-150 dark:border-slate-800/60 bg-zinc-50/50 dark:bg-slate-950/40 p-5 flex flex-col items-center">
                      <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                          type="button"
                          disabled={isExporting}
                          onClick={handleExportBackup}
                          className="flex-1 max-w-xs flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-550 disabled:bg-zinc-300 text-white px-5 py-3 text-xs font-bold transition-all cursor-pointer font-mono active:scale-98"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {isExporting ? 'Yedek Alınıyor...' : 'Platformu Yedekle (.json)'}
                        </button>

                        <label className="flex-1 max-w-xs flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-zinc-100 dark:hover:bg-slate-900 text-zinc-700 dark:text-slate-300 px-5 py-3 text-xs font-bold transition-all cursor-pointer font-mono text-center active:scale-98">
                          <Upload className="h-3.5 w-3.5 text-slate-400" />
                          <span>{isImporting ? 'Yükleniyor...' : 'Yedekten Geri Yükle...'}</span>
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImportBackup}
                            disabled={isImporting}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-zinc-200 dark:border-slate-800 bg-zinc-50/50 dark:bg-slate-950/40 p-6 md:p-8 flex flex-col items-center justify-center select-none shadow-inner max-w-md mx-auto w-full">
                  {!isAdminArmed ? (
                    <div className="text-center py-6">
                      <Lock className="h-9 w-9 text-zinc-350 dark:text-zinc-655 mx-auto mb-3" />
                      <h4 className="text-xs font-black uppercase font-mono text-zinc-500 dark:text-zinc-400 tracking-widest">
                        Gelişmiş Yönetici Modu Kilitli
                      </h4>
                      <p className="text-[11px] text-zinc-450 dark:text-zinc-500 leading-relaxed max-w-sm mx-auto mt-2 font-mono">
                        Yapay Zeka yapılandırması ve Yedekleme işlemlerine erişmek için yukarıdaki kilit tuşunu <span className="text-rose-500 font-bold">(Erişimi Aç)</span> tıklayarak yeşil / aktif hale getirmelisiniz.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center animate-fade-in">
                      {/* Safe Icon Header with glowing light */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="relative">
                          <Lock className="h-5 w-5 text-amber-500 animate-pulse" />
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]"></span>
                        </div>
                        <span className="text-xs font-black tracking-widest font-mono text-zinc-600 dark:text-zinc-300 uppercase">
                          GÜVENLİ SANAL KASA GİRİŞİ
                        </span>
                      </div>

                      {/* LED Display Screen */}
                      <div className={`w-full rounded-xl border p-3.5 mb-5 font-mono text-center tracking-widest transition-all duration-300 shadow-sm ${
                        pinStatus === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.15)] animate-pulse'
                          : pinStatus === 'error'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                            : 'bg-zinc-950 border-zinc-800 text-amber-500 shadow-inner'
                      }`}>
                        <div className="text-[10px] uppercase font-bold tracking-normal text-zinc-500 mb-1">
                          {pinStatus === 'success' 
                            ? '✓ ERİŞİM ONAYLANDI' 
                            : pinStatus === 'error' 
                              ? '✗ HATALI ŞİFRE' 
                              : 'KASA ŞİFRESİNİ GİRİNİZ'}
                        </div>
                        <div className="text-2xl font-black flex items-center justify-center gap-1 mt-1 text-center font-mono">
                          {pinStatus === 'success' ? (
                            <span className="text-base font-bold uppercase tracking-wider text-emerald-400 animate-pulse">KASA AÇILIYOR...</span>
                          ) : pinStatus === 'error' ? (
                            <span className="text-base font-bold uppercase tracking-wider text-rose-400">ERİŞİM REDDEDİLDİ</span>
                          ) : (
                            <div className="flex items-center gap-2.5 justify-center py-1">
                              {[0, 1, 2, 3].map((index) => (
                                <span 
                                  key={index} 
                                  className={`inline-block w-3 h-3 rounded-full transition-all duration-150 ${
                                    pinInput.length > index 
                                      ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24] scale-110' 
                                      : 'bg-zinc-800'
                                  }`} 
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Numeric Keypad Grid 3x4 */}
                      <div className="grid grid-cols-3 gap-2.5 w-full max-w-[270px]">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                          <button
                            key={digit}
                            type="button"
                            onClick={() => handlePinDigit(digit)}
                            className="h-12 flex items-center justify-center text-sm font-bold font-mono rounded-xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 hover:bg-zinc-100 dark:hover:bg-slate-800 active:bg-zinc-200 dark:active:bg-slate-700 text-zinc-800 dark:text-zinc-200 cursor-pointer shadow-sm active:scale-95 transition-all select-none"
                          >
                            {digit}
                          </button>
                        ))}
                        
                        {/* Clear Key 'C' */}
                        <button
                          type="button"
                          onClick={handlePinClear}
                          className="h-12 flex items-center justify-center text-xs font-black font-mono rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 active:scale-95 text-rose-500 cursor-pointer shadow-sm transition-all select-none"
                          title="Temizle"
                        >
                          C
                        </button>

                        {/* Zero Key '0' */}
                        <button
                          type="button"
                          onClick={() => handlePinDigit('0')}
                          className="h-12 flex items-center justify-center text-sm font-bold font-mono rounded-xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 hover:bg-zinc-100 dark:hover:bg-slate-800 active:bg-zinc-200 dark:active:bg-slate-700 text-zinc-800 dark:text-zinc-200 cursor-pointer shadow-sm active:scale-95 transition-all select-none"
                        >
                          0
                        </button>

                        {/* Safe Unlocking Button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (pinInput.length > 0) {
                              if (pinInput === '2016') {
                                setPinStatus('success');
                                playKeySound('success');
                                setTimeout(() => {
                                  setIsAdminRevealed(true);
                                  setPinInput('');
                                  setPinStatus('idle');
                                }, 1400);
                              } else {
                                setPinStatus('error');
                                playKeySound('error');
                                setTimeout(() => {
                                  setPinInput('');
                                  setPinStatus('idle');
                                }, 1400);
                              }
                            } else {
                              playKeySound('error');
                            }
                          }}
                          className="h-12 flex items-center justify-center text-xs font-black font-mono rounded-xl bg-emerald-500/15 border border-emerald-500/25 hover:bg-emerald-500/25 active:scale-95 text-emerald-500 cursor-pointer shadow-sm transition-all select-none"
                          title="Giriş Yap"
                        >
                          ✔
                        </button>
                      </div>

                      {/* Footer micro label */}
                      <p className="mt-5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono text-center leading-relaxed max-w-[260px]">
                        Klavyenizdeki sayısal tuşlarla veya ekrandaki butonlara basarak şifreyi girip kasayı açabilirsiniz.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        ) : (

          /* ================= DASHBOARD MAIN VIEW ================= */
          <div className="mt-8 flex flex-col gap-8">
            
            {/* 1. Large search controls and Quick additions hub */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Search Block */}
              <div className={`${isAdminArmed && isAdminRevealed ? "lg:col-span-4" : "lg:col-span-5"} relative`}>
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
                  <Search className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Yüklediğiniz uygulama ve oyunlarda anlık arama yapın..."
                  className="w-full rounded-2xl border border-zinc-200 dark:border-slate-850/80 bg-white dark:bg-slate-900/40 py-3.5 pl-12 pr-4 text-sm font-medium text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Upload addition launcher element */}
              {isAdminArmed && isAdminRevealed && (
                <button
                  id="header-upload-btn"
                  onClick={() => setIsUploadOpen(true)}
                  className="lg:col-span-1 flex items-center justify-center gap-2.5 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white hover:bg-blue-550 hover:shadow-lg hover:shadow-blue-600/15 transition-all shadow active:scale-[0.98] cursor-pointer animate-fade-in"
                >
                  <Plus className="h-4.5 w-4.5" />
                  Uygulama Ekle
                </button>
              )}
            </div>

            {/* 2. Recent Searches (Arama Geçmişi Badges) */}
            {recentSearches.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="text-zinc-400 dark:text-zinc-550 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Son Aramalar:
                </span>
                {recentSearches.map((s, idx) => (
                  <button
                    key={`${s}-${idx}`}
                    onClick={() => setSearchQuery(s)}
                    className="rounded-lg bg-zinc-200/60 dark:bg-slate-900/60 border border-zinc-300/20 dark:border-slate-800/80 px-2.5 py-1 text-zinc-650 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 transition-all"
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClearSearches}
                  className="text-red-500 dark:text-red-400 hover:underline px-1 py-0.5 rounded text-[10px] font-bold uppercase"
                >
                  Temizle
                </button>
              </div>
            )}

            {/* 3. Recently Openedapps section (Son Kullanılanlar) */}
            {recentlyOpened.length > 0 && !searchQuery.trim() && selectedCategory === 'Tümü' && (
              <div id="recents-row" className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Son Kullanılanlar
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {recentlyOpened.map((app) => (
                    <div
                      key={`recent-${app.id}`}
                      onClick={() => handleOpenApp(app)}
                      className="group flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-slate-805/40 bg-white dark:bg-slate-900/30 p-3.5 cursor-pointer hover:border-blue-500/35 hover:bg-blue-600/[0.01] hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-slate-950 text-2xl border border-zinc-200 dark:border-slate-800">
                        {app.icon}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-display font-bold text-xs text-zinc-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {app.name}
                        </h4>
                        <span className="text-[9px] text-zinc-400 font-mono capitalize block">
                          {app.category}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-400 ml-auto group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Display of Categories Pills (Only if Apps Exist) */}
            {apps.length > 0 && activeTab === 'all' && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-205 dark:border-slate-800/50 pb-4">
                <button
                  onClick={() => setSelectedCategory('Tümü')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                    selectedCategory === 'Tümü'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-200/55 dark:bg-slate-900/40 text-zinc-650 dark:text-zinc-400 border border-zinc-205 dark:border-slate-800/50 hover:bg-zinc-200 dark:hover:bg-slate-850'
                  }`}
                >
                  Tüm Kategoriler
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold tracking-wide border transition-all ${
                      selectedCategory === cat
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-zinc-200/55 dark:bg-slate-900/40 text-zinc-650 dark:text-zinc-400 border-zinc-205 dark:border-slate-800/50 hover:bg-zinc-200 dark:hover:bg-slate-850'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* 5. Main Grid List & Beautiful Empty state handling */}
            {filteredApps.length > 0 ? (
              <div id="applications-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredApps.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    onOpen={handleOpenApp}
                    onEdit={(a) => {
                      setEditingApp(a);
                      setIsEditOpen(true);
                    }}
                    onDelete={handleDeleteApp}
                    onToggleFavorite={handleToggleFavorite}
                    showAdminActions={isAdminArmed && isAdminRevealed}
                  />
                ))}
              </div>
            ) : (
              /* PRECISE VISUAL EMPTY STATE (Turkish) */
              <div 
                id="empty-platform-container"
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-slate-800/80 p-12 text-center bg-white dark:bg-slate-900/10 min-h-[40vh]"
              >
                {apps.length === 0 ? (
                  // Initial Platform Empty state
                  isAdminArmed && isAdminRevealed ? (
                    <>
                      <div 
                        onClick={() => setIsUploadOpen(true)}
                        className="group flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-500/25 cursor-pointer shadow-xl shadow-blue-500/5 transition-all duration-300 transform hover:scale-105 hover:rotate-90 animate-bounce"
                      >
                        <Plus className="h-8 w-8" />
                      </div>
                      <h3 className="mt-6 font-display text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                        Platformunuz Tamamen Boş
                      </h3>
                      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                        Platform ilk açıldığında tamamen boş gelecek şekilde tasarlanmıştır. Çevrimdışı çalışabilen kendi web uygulamalarınızı veya oyunlarınızı (.html, .css, .js) hemen yükleyin!
                      </p>
                      <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => setIsUploadOpen(true)}
                          className="flex items-center gap-2 rounded-xl bg-blue-600 border border-transparent hover:bg-blue-550 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/10 transition-all cursor-pointer"
                        >
                          <Plus className="h-4.5 w-4.5" />
                          İlk Uygulamayı Ekle
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div 
                        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-200/30 dark:bg-slate-800/20 text-zinc-400 dark:text-zinc-500 border border-zinc-350/10 dark:border-slate-800/40 shadow-inner"
                      >
                        <Lock className="h-8 w-8" />
                      </div>
                      <h3 className="mt-6 font-display text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                        Platform Henüz Boş
                      </h3>
                      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                        Sistem yöneticisi henüz herhangi bir application veya oyun eklememiştir ya da düzenleme modu kilitlidir.
                      </p>
                      <p className="mt-1 max-w-md text-xs text-zinc-400 dark:text-zinc-500 leading-normal font-mono">
                        Yönetici iseniz, lütfen <strong>Ayarlar &rarr; Güvenli Sanal Kasa</strong> ekranından 4 haneli şifrenizi girerek yetki kilidini kaldırın.
                      </p>
                    </>
                  )
                ) : (
                  // Filtering / Seach state with nothing matching
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-200/60 dark:bg-slate-900/80 text-zinc-400 dark:text-zinc-550 border border-zinc-300/20 dark:border-slate-800/80">
                      <AlertCircle className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 font-display text-base font-bold text-zinc-900 dark:text-white">Uygulama Bulunamadı</h3>
                    <p className="mt-1 text-xs text-zinc-550 dark:text-zinc-400 font-medium">
                      Arama koşullarınızı eşleşen hiçbir kayıt bulunamadı. Lütfen filtrelerinizi düzenleyin.
                    </p>
                    {(selectedCategory !== 'Tümü' || searchQuery) && (
                      <button
                        onClick={() => {
                          setSelectedCategory('Tümü');
                          setSearchQuery('');
                        }}
                        className="mt-4 text-xs font-semibold text-blue-550 dark:text-blue-400 hover:underline"
                      >
                        Tüm aramayı sıfırla
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Custom Information Footnote banner */}
            {apps.length > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-blue-500/10 bg-blue-500/[0.02] p-5 text-xs text-blue-700 dark:text-blue-300 font-mono max-w-4xl mr-auto">
                <Sparkles className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide">Yüklenen Uygulamalar Nasıl Çalışır?</h5>
                  <p className="mt-1 leading-relaxed">
                    Yüklenen tüm HTML, Javascript, CSS ve binary resim dosyaları tamamen izole bir şekilde IndexedDB veritabanınızda şifrelenmeden tutulur. 'Aç' düğmesine bastığınızda, arka planda çalışan sanal servis tarayıcı katmanımız (Service Worker), iframe gelen istekleri yakalayarak uygulamayı tamamen istemci taraflı web sunucusuymuş gibi açar ve yürütür.
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ================= MODAL OVERLAYS AND MOUNTS ================= */}
        {isUploadOpen && (
          <UploadModal
            onClose={() => setIsUploadOpen(false)}
            onUpload={handleUploadApp}
          />
        )}

        {isEditOpen && editingApp && (
          <EditModal
            app={editingApp}
            onClose={() => {
              setIsEditOpen(false);
              setEditingApp(null);
            }}
            onSave={handleSaveEditApp}
          />
        )}

        {activeApp && (
          <AppRunner
            app={activeApp}
            onClose={() => setActiveApp(null)}
          />
        )}

        {showUpdateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 md:p-8">
              {/* Header decor banner line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500"></div>
              
              <div className="flex items-center justify-between mb-4 mt-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-zinc-900 dark:text-white leading-tight">Yenilikler Var!</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono font-medium uppercase tracking-wider">Sürüm 3.0 Güncelleme Notları</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 my-6 text-sm text-zinc-650 dark:text-zinc-350 leading-relaxed font-sans">
                <div className="flex gap-3 items-start">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-500 font-mono text-[10px] font-bold mt-0.5 select-none shrink-0 border border-emerald-500/20">1</span>
                  <div>
                    <strong className="text-zinc-800 dark:text-zinc-100 block text-xs">🔊 İnteraktif Gerçekçi Ses Efektleri</strong>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5 leading-normal">
                      Kasa tuşuna bastığınızda, hata yaptığınızda ya da şifreyi doğru girdiğinizde çalışan özel retro ses sinyalleri (synthesizer) sisteme entegre edildi.
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/10 text-emerald-500 font-mono text-[10px] font-bold mt-0.5 select-none shrink-0 border border-emerald-500/20">2</span>
                  <div>
                    <strong className="text-zinc-800 dark:text-zinc-100 block text-xs">🚀 JSON Eşitleme ve v3 Stabilizasyonu</strong>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5 leading-normal">
                      Altyapıda senkronizasyon kontrolleri güçlendirildi ve MN Tools v3 sürüm yükseltme hazırlıkları tamamlandı.
                    </span>
                  </div>
                </div>

                {/* Gelecekteki Beklenen Özellikler Bölümü */}
                <div className="pt-3.5 border-t border-zinc-155 dark:border-slate-800/80 mt-3">
                  <h4 className="font-display font-extrabold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-2.5 uppercase tracking-wider font-mono">
                    <span>🔮 Gelecekteki Beklenen Özellikler</span>
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] text-indigo-500 mt-1">●</span>
                      <span className="text-[11px] text-zinc-550 dark:text-zinc-400 leading-normal">
                        <strong>Yapay Zeka Entegrasyonları:</strong> Dahili Gemini API asistanı ve akıllı kod/içerik üretim oyun araçları.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] text-indigo-500 mt-1">●</span>
                      <span className="text-[11px] text-zinc-550 dark:text-zinc-400 leading-normal">
                        <strong>Şifreli Bulut Eşitleme:</strong> Uygulamaların ve dosyaların farklı tarayıcı/cihazlarda tek tıklamayla eşitlenmesi.
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] text-indigo-500 mt-1">●</span>
                      <span className="text-[11px] text-zinc-550 dark:text-zinc-400 leading-normal">
                        <strong>PWA Desteği:</strong> İnternet gerektirmeden çevrimdışı masaüstü kısa yolu oluşturma ve arka plan güncellemeleri.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="w-full flex items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-xs font-bold transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-98 cursor-pointer select-none"
                >
                  Harika, anladım!
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
