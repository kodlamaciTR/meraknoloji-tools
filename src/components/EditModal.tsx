/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Edit3, Save, AlertTriangle } from 'lucide-react';
import { WebApp, CATEGORIES, Category, AppBadge } from '../types';

interface EditModalProps {
  app: WebApp;
  onClose: () => void;
  onSave: (updatedApp: WebApp) => void;
}

const QUICK_EMOJIS = ['📅', '🛠️', '🎨', '🎬', '🎵', '🤖', '🎮', '📁', '🚀', '⚙️', '📈', '🧩', '🩺', '🛒'];
const BADGE_OPTIONS: { id: AppBadge; label: string }[] = [
  { id: 'ai', label: 'AI Destekli' },
  { id: 'api', label: 'API Gerekli' },
  { id: 'beta', label: 'Beta' },
  { id: 'new', label: 'Yeni' },
  { id: 'popular', label: 'Popüler' },
];

export default function EditModal({ app, onClose, onSave }: EditModalProps) {
  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description);
  const [category, setCategory] = useState<Category>(app.category as Category);
  const [icon, setIcon] = useState(app.icon);
  const [badges, setBadges] = useState<AppBadge[]>(app.badges || []);
  const [customEmoji, setCustomEmoji] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCustomEmojiChange = (val: string) => {
    import('../utils/security').then(({ isMaliciousInput, logSecurityIncident }) => {
      if (isMaliciousInput(val)) {
        logSecurityIncident('XSS', val);
        setErrorMsg("Güvenlik Hatası: Zararlı giriş tespit edildi ve engellendi!");
        return;
      }
      setErrorMsg("");
      setCustomEmoji(val);
      if (val.trim()) {
        setIcon(val.trim());
      }
    });
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Lütfen geçerli bir Uygulama Adı girin.');
      return;
    }

    onSave({
      ...app,
      name: name.trim(),
      description: description.trim(),
      category: category,
      icon: icon,
      badges: badges,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div 
        id="edit-modal-container"
        className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl transition-all md:p-8 my-auto max-h-[90vh] overflow-y-auto"
      >
        {/* Head */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-100">Uygulama Bilgilerini Düzenle</h2>
              <p className="text-xs text-slate-400">"{app.name}" uygulamasına ait detayları güncelleyin</p>
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
        <form onSubmit={handleSaveSubmit} className="mt-6 flex flex-col gap-5">
          {errorMsg && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Uygulama Adı</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                import('../utils/security').then(({ isMaliciousInput, logSecurityIncident }) => {
                  if (isMaliciousInput(e.target.value)) {
                    logSecurityIncident('XSS', e.target.value);
                    setErrorMsg("Güvenlik Hatası: Zararlı giriş tespit edildi ve engellendi!");
                    return;
                  }
                  setErrorMsg("");
                  setName(e.target.value);
                });
              }}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 placeholder-slate-700 focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
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
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Rozetler (Opsiyonel)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {BADGE_OPTIONS.map((badge) => (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => {
                    setBadges(prev => 
                      prev.includes(badge.id) ? prev.filter(x => x !== badge.id) : [...prev, badge.id]
                    )
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    badges.includes(badge.id) 
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400' 
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {badge.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => {
                import('../utils/security').then(({ isMaliciousInput, logSecurityIncident }) => {
                  if (isMaliciousInput(e.target.value)) {
                    logSecurityIncident('XSS', e.target.value);
                    setErrorMsg("Güvenlik Hatası: Zararlı giriş tespit edildi ve engellendi!");
                    return;
                  }
                  setErrorMsg("");
                  setDescription(e.target.value);
                });
              }}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-200 placeholder-slate-700 focus:border-blue-500 focus:outline-none transition-all resize-none"
              placeholder="Uygulama hakkında kısa bilgi girin..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono mb-2">Simge Seçiçi</label>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 border border-slate-800 text-2xl">
                {icon}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Seçtiğiniz özel emoji"
                  value={customEmoji}
                  onChange={(e) => handleCustomEmojiChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quick selector items */}
            <div className="mt-3 flex flex-wrap gap-1.5 border border-slate-800/40 p-2 rounded-xl bg-slate-950/40 max-h-[5rem] overflow-y-auto">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => {
                    setIcon(emoji);
                    setCustomEmoji('');
                  }}
                  className={`hover:scale-125 transition-transform text-lg p-1 rounded ${
                    icon === emoji ? 'bg-orange-500/10 scale-110 border border-orange-500/30' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Save Row */}
          <div className="mt-4 border-t border-slate-800/80 pt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              İptal
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-blue-550 hover:shadow-blue-600/15"
            >
              <Save className="h-4 w-4" />
              Değişiklikleri Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
