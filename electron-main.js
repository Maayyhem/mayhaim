// Electron main process for MayhAim
// Loads the site locally and routes /api/* calls to Vercel.
// Handles Discord OAuth via a dedicated popup window that captures
// the returned discord_token/discord_error query params.

const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');

const API_BASE = 'https://mayhaim.vercel.app';
const DISCORD_OAUTH_PREFIX = API_BASE + '/api/login?action=discord';

let mainWindow = null;

// Single instance — prevents duplicate windows if user launches again
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: 'MayhAim',
    backgroundColor: '#0a0a0f',
    autoHideMenuBar: true,
    show: false, // show when ready-to-show to avoid white flash
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      // contextIsolation must be false so the preload can override the
      // page's window.fetch (to redirect /api/* → Vercel). nodeIntegration
      // stays false so the page itself can't require Node modules.
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false, // keep game loop running when minimized
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Allow pointer lock without user prompt (required for FPS aim mode)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'pointerLock') return callback(true);
    callback(true);
  });

  // F11 → toggle fullscreen
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
    // Ctrl+Shift+I → devtools (dev convenience)
    if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Child window handler: Discord OAuth popup + external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(DISCORD_OAUTH_PREFIX)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 780,
          parent: mainWindow,
          modal: false,
          title: 'Connexion Discord — MayhAim',
          backgroundColor: '#0a0a0f',
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
          },
        },
      };
    }
    // Everything else (discord.gg invite, external refs) → default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // When the Discord popup opens, watch its navigation for the final
  // redirect back to mayhaim.vercel.app?discord_token=... or ?discord_error=...
  mainWindow.webContents.on('did-create-window', (child) => {
    const catchToken = (targetUrl) => {
      try {
        const u = new URL(targetUrl);
        if (!u.origin.includes('mayhaim.vercel.app')) return false;
        const token = u.searchParams.get('discord_token');
        const error = u.searchParams.get('discord_error');
        if (token || error) {
          mainWindow.webContents.send('discord-auth-result', { token, error });
          child.close();
          return true;
        }
      } catch {}
      return false;
    };
    child.webContents.on('will-redirect', (_, url) => { catchToken(url); });
    child.webContents.on('did-navigate', (_, url) => { catchToken(url); });
  });

  mainWindow.loadFile('index.html');
}

// Remove default app menu (File/Edit/View/...) for a clean game-app look
Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  // CSP: allow loading from local files + calls to Vercel API + Discord CDN
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: details.responseHeaders });
  });
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
