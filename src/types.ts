/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WebApp {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string; // Emoji, Lucide icon name, or custom avatar data
  entryPoint: string; // Name of the main HTML file, usually index.html
  uploadedAt: number; // ISO timestamp or epoch
  isFavorite: boolean;
  lastOpenedAt: number | null;
  sizeBytes: number;
}

export interface WebAppFile {
  id: string; // Format: `${appId}/${path}`
  appId: string;
  path: string; // Relative path, e.g., "css/style.css"
  content: Blob; // Binary file stream
  mimeType: string;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemePreference;
  geminiApiKey: string;
}

export const CATEGORIES = [
  'Verimlilik',
  'Geliştirici Araçları',
  'İçerik Üretici Araçları',
  'Yapay Zeka Araçları',
  'Oyunlaştırma & Motivasyon',
  'Güvenlik & Sistem',
  'Tasarım & Görsel Araçlar',
  'Eğitim & Kişisel Gelişim',
  'Video Araçları',
  'Ses Araçları',
  'Oyunlar',
  'Diğer'
] as const;

export type Category = typeof CATEGORIES[number];
