// Electron main process for MayhAim
// Loads the site locally and routes /api/* calls to Vercel.
// Handles Discord OAuth via a dedicated popup window that captures
// the returned discord_token/discord_error query params.

const { app, BrowserWindow, Menu, shell, session, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

const API_BASE = 'https://mayhaim.vercel.app';
const DISCORD_OAUTH_PREFIX = API_BASE + '/api/login?action=discord';

let mainWindow = null;
let splashWindow = null;

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

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 340,
    frame: false,
    resizable: false,
    movable: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    alwaysOnTop: true,
    center: true,
    skipTaskbar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'build', 'splash.html'));
  splashWindow.on('closed', () => { splashWindow = null; });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: 'MayhAim',
    icon: path.join(__dirname, 'build', 'icon.ico'),
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
    // Small delay so the splash isn't too flashy on fast machines
    const minSplashMs = 900;
    const startedAt = global.__mayhaim_start || Date.now();
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, minSplashMs - elapsed);
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      mainWindow.show();
      mainWindow.focus();
    }, wait);
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
    // Ctrl+Shift+I → devtools (dev convenience only — disabled in packaged builds
    // so end-users can't accidentally pop open devtools and expose internals).
    if (!app.isPackaged && input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') {
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
  global.__mayhaim_start = Date.now();
  // CSP: allow loading from local files + calls to Vercel API + Discord CDN
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: details.responseHeaders });
  });

  // Splash first (shows immediately), then main in background
  createSplashWindow();
  createMainWindow();

  // ── Auto-updater (GitHub Releases) ──
  // Only runs in packaged builds — skipped during `npm run electron` dev.
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // Forward lifecycle events to the renderer so the About modal can show
    // progress / status when the user presses "Check for updates" manually.
    const emit = (event, payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-event', { event, payload });
      }
    };

    autoUpdater.on('checking-for-update', () => emit('checking'));
    autoUpdater.on('update-not-available', (info) => emit('not-available', { version: info && info.version }));
    autoUpdater.on('download-progress', (p) => emit('progress', { percent: p.percent, bytesPerSecond: p.bytesPerSecond, transferred: p.transferred, total: p.total }));

    autoUpdater.on('update-available', (info) => {
      console.log('[updater] Update available:', info.version);
      emit('available', { version: info.version });
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(
          `window.showToast && window.showToast('Mise à jour v${info.version} en téléchargement…', {type:'info',icon:'⬇',duration:4000})`
        );
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] Update downloaded:', info.version);
      emit('downloaded', { version: info.version });
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Mise à jour prête',
        message: `MayhAim v${info.version} est prête. Redémarrer maintenant pour l'installer ?`,
        buttons: ['Redémarrer', 'Plus tard'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });

    autoUpdater.on('error', (err) => {
      console.error('[updater] Error:', err.message);
      emit('error', { message: err && err.message });
    });

    // Renderer-triggered manual check (from the About modal).
    // Returns the result of checkForUpdates() so the caller can surface a
    // "no update available" message even if the event fires synchronously.
    ipcMain.handle('updater:check', async () => {
      try {
        const r = await autoUpdater.checkForUpdates();
        return {
          ok: true,
          currentVersion: app.getVersion(),
          latestVersion: r && r.updateInfo && r.updateInfo.version,
        };
      } catch (err) {
        return { ok: false, error: err && err.message };
      }
    });
    ipcMain.handle('updater:quit-and-install', () => {
      autoUpdater.quitAndInstall();
    });

    // Check 3s after launch (let the window settle first)
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
