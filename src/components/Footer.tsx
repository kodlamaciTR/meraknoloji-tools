import React from 'react';
import packageJson from '../../package.json';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const version = packageJson.version || "3.0.0";

  return (
    <footer className="w-full py-8 mt-12 border-t border-zinc-200/60 dark:border-slate-800/60 text-center">
      <div className="flex flex-col items-center justify-center space-y-2">
        <a 
          href="#about" 
          className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          Powered by Meraknoloji
        </a>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-500 font-medium">
          <p>MN Nexus Ecosystem</p>
          <p className="mt-1">Version: {version}</p>
          <p className="mt-1">&copy; {currentYear} Meraknoloji</p>
        </div>
      </div>
    </footer>
  );
}
