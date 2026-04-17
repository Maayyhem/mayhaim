// Electron preload — runs in an isolated world, before the page scripts.
// Rewrites all /api/* fetches to the Vercel backend so the local app
// (file://) can still talk to the serverless functions, and handles
// the Discord OAuth token handoff from the popup window.

const { ipcRenderer } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const API_BASE = 'https://mayhaim.vercel.app';

// ───── App metadata (exposed on window) ─────
// Since contextIsolation is false, we can write directly on window before the
// page scripts run. ui.js + About modal consume these values.
try {
  const pkg = require('./package.json');
  window.MAYHAIM_VERSION = pkg.version || '0.0.0';
  window.MAYHAIM_IS_ELECTRON = true;
} catch { /* graceful fallback */ }

// ───── Auto-updater bridge ─────
// Exposes a tiny API the About modal uses to let the user manually trigger
// `autoUpdater.checkForUpdates()` and subscribe to its lifecycle events.
// Only active in packaged builds (main-side is guarded by app.isPackaged).
window.MAYHAIM_UPDATER = {
  check: () => ipcRenderer.invoke('updater:check'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
  onEvent: (handler) => {
    const wrapped = (_e, data) => handler(data);
    ipcRenderer.on('updater-event', wrapped);
    return () => ipcRenderer.removeListener('updater-event', wrapped);
  },
};

try {
  const clPath = path.join(__dirname, 'CHANGELOG.md');
  if (fs.existsSync(clPath)) {
    window.MAYHAIM_CHANGELOG = fs.readFileSync(clPath, 'utf8');
  }
} catch { /* optional */ }

// ───── fetch override ─────
// Transparent rewrite: any URL starting with "/api" gets prefixed by API_BASE.
// We keep the original fetch reference so relative URLs to local assets
// (file://) still work normally.
const _origFetch = window.fetch.bind(window);
window.fetch = function (input, init) {
  try {
    if (typeof input === 'string' && input.startsWith('/api')) {
      return _origFetch(API_BASE + input, init);
    }
    if (input && typeof input === 'object' && input.url && input.url.startsWith('/api')) {
      // Request object — reconstruct with new URL
      return _origFetch(new Request(API_BASE + input.url, input), init);
    }
    // Absolute or relative non-/api paths: pass through
    if (typeof input === 'string' && input.startsWith('file:///api')) {
      // Some code paths resolve "/api/..." against the current document URL.
      return _origFetch(input.replace(/^file:\/\//, API_BASE), init);
    }
  } catch {}
  return _origFetch(input, init);
};

// ───── Discord OAuth handoff ─────
// electron-main sends us { token, error } when the popup finishes.
// We drop the token into localStorage and replay the query-string the
// frontend already knows how to parse (see coaching.js:4753+).
ipcRenderer.on('discord-auth-result', (_, { token, error }) => {
  if (token) {
    try { localStorage.setItem('ch_token', token); } catch {}
    // Trigger the existing client-side handler
    const url = new URL(location.href);
    url.searchParams.delete('discord_error');
    url.searchParams.set('discord_token', token);
    location.replace(url.toString());
  } else if (error) {
    const url = new URL(location.href);
    url.searchParams.delete('discord_token');
    url.searchParams.set('discord_error', error);
    location.replace(url.toString());
  }
});

// ───── DOM tweaks for Electron ─────
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('is-electron');

  // Rewrite Discord login anchor so the click opens via window.open
  // (which goes through setWindowOpenHandler in main → popup window).
  // The anchor's href is "/api/login?action=discord" — we intercept clicks,
  // prevent default, and delegate to window.open with the full URL.
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href^="/api/login?action=discord"]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    const fullUrl = API_BASE + href;
    // Open via window.open → triggers main process setWindowOpenHandler
    window.open(fullUrl, 'discord-oauth', 'width=520,height=780');
  }, true);
});
