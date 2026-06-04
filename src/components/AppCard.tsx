/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, Edit3, Trash2, Heart, Calendar, HardDrive } from 'lucide-react';
import { WebApp } from '../types';

interface AppCardProps {
  app: WebApp;
  onOpen: (app: WebApp) => any;
  onEdit: (app: WebApp) => any;
  onDelete: (id: string) => any;
  onToggleFavorite: (app: WebApp) => any;
  showAdminActions?: boolean;
  key?: any;
}

export default function AppCard({
  app,
  onOpen,
  onEdit,
  onDelete,
  onToggleFavorite,
  showAdminActions = false,
}: AppCardProps) {
  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Category Color badges
  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'Verimlilik':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Geliştirici Araçları':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'İçerik Üretici Araçları':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Video Araçları':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Ses Araçları':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
      case 'Yapay Zeka Araçları':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Oyunlar':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const isEmoji = (str: string) => {
    return /\p{Emoji}/u.test(str) && str.length <= 4;
  };

  return (
    <div 
      id={`app-card-${app.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 hover:bg-slate-900 hover:shadow-xl hover:shadow-blue-500/5"
    >
      {/* Background radial glow */}
      <div className="absolute -right-20 -top-20 -z-10 h-40 w-40 rounded-full bg-blue-500/2 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

      <div>
        {/* Header: Icon & Favorite Toggle */}
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 text-2xl border border-slate-700">
            {isEmoji(app.icon) ? (
              app.icon
            ) : (
              <span className="font-bold text-blue-400 text-lg uppercase">{app.name.slice(0, 2)}</span>
            )}
          </div>
          <button
            id={`fav-toggle-${app.id}`}
            onClick={() => onToggleFavorite(app)}
            className={`rounded-xl p-2 transition-all duration-200 hover:bg-slate-800/80 ${
              app.isFavorite
                ? 'text-rose-500 bg-rose-500/5 border border-rose-500/20'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            title={app.isFavorite ? 'Favorilerden Kaldır' : 'Favorilere Ekle'}
          >
            <Heart className="h-5 w-5" fill={app.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Info */}
        <h3 className="mt-4 font-display text-lg font-semibold text-slate-100 tracking-tight line-clamp-1">
          {app.name}
        </h3>

        {/* Category badge */}
        <div className="mt-2">
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getCategoryStyles(app.category)}`}>
            {app.category}
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-400 line-clamp-2 min-h-[2.5rem]">
          {app.description || 'Açıklama belirtilmemiş.'}
        </p>
      </div>

      {/* Footer statistics & Action buttons */}
      <div className="mt-6 border-t border-slate-800/80 pt-4">
        {/* Metas */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-4 font-mono">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-slate-600" />
            {formatDate(app.uploadedAt)}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="h-3.5 w-3.5 text-slate-600" />
            {formatSize(app.sizeBytes)}
          </span>
        </div>

        {/* Actions Row */}
        <div className="flex gap-2">
          <button
            id={`open-btn-${app.id}`}
            onClick={() => onOpen(app)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/15 active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-current" />
            Aç
          </button>
          
          {showAdminActions && (
            <>
              <button
                id={`edit-btn-${app.id}`}
                onClick={() => onEdit(app)}
                className="rounded-xl border border-slate-800 bg-slate-800/40 p-2.5 text-slate-400 transition-all duration-200 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200"
                title="Uygulamayı Düzenle"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              
              <button
                id={`delete-btn-${app.id}`}
                onClick={() => onDelete(app.id)}
                className="rounded-xl border border-red-950 bg-red-950/20 p-2.5 text-red-400 transition-all duration-200 hover:bg-red-950/40 hover:text-red-300"
                title="Sil"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
