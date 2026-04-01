// =============================================================================
// Lurk Desktop — Electron Main Process
//
// Menu bar tray app (like Zoom/Claude). Runs the daemon in-process and shows
// a dashboard window anchored to the tray icon.
// =============================================================================

import { app, BrowserWindow, Tray, nativeImage, screen, ipcMain, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import { existsSync } from 'fs';
import { LurkDaemon } from '../daemon';

// ---- Global Error Handlers (prevent EMFILE and other errors from crashing) --

process.on('uncaughtException', (err) => {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'EMFILE' || code === 'ENFILE') {
    console.warn('[Lurk] Too many open files — continuing gracefully');
  } else {
    console.error('[Lurk] Uncaught exception:', err);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[Lurk] Unhandled rejection:', reason);
});

// ---- Constants -------------------------------------------------------------

const WINDOW_WIDTH = 420;
const WINDOW_HEIGHT = 580;
const TRAY_ICON_SIZE = 18;
const PORT = 3847;

// ---- State -----------------------------------------------------------------

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let daemon: LurkDaemon | null = null;

// ---- App Configuration -----------------------------------------------------

// Hide from dock — this is a menu bar app
app.dock?.hide();

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    showWindow();
  }
});

// ---- Tray Icon Paths -------------------------------------------------------

function getTrayIconPath(): string {
  // In production, resources are in app.asar/../resources
  const prodPath = join(process.resourcesPath, 'trayTemplate.png');
  const devPath = join(__dirname, '..', '..', 'resources', 'trayTemplate.png');

  if (existsSync(prodPath)) return prodPath;
  if (existsSync(devPath)) return devPath;

  // Fallback: create a simple icon programmatically
  return '';
}

// ---- Create Tray -----------------------------------------------------------

function createTray(): void {
  const iconPath = getTrayIconPath();
  let icon: Electron.NativeImage;

  if (iconPath) {
    icon = nativeImage.createFromPath(iconPath);
    icon = icon.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });
  } else {
    // Fallback: 18x18 dark circle as tray icon
    icon = nativeImage.createFromBuffer(createFallbackIcon());
    icon = icon.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });
  }

  // macOS template images automatically adapt to light/dark menu bar
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('Lurk — Knowledge Platform');

  tray.on('click', (_event, bounds) => {
    toggleWindow(bounds);
  });

  tray.on('right-click', (_event, bounds) => {
    toggleWindow(bounds);
  });
}

// ---- Create Window ---------------------------------------------------------

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#FEFBF6', // ivory
    vibrancy: 'menu',
    visualEffectState: 'active',
    roundedCorners: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
  });

  // Load the dashboard UI
  const uiPath = join(__dirname, '..', '..', 'ui', 'index.html');
  mainWindow.loadFile(uiPath);

  // Hide on blur (click away closes the dropdown)
  mainWindow.on('blur', () => {
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---- Window Positioning (anchored to tray icon) ----------------------------

function toggleWindow(trayBounds: Electron.Rectangle): void {
  if (mainWindow?.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow(trayBounds);
  }
}

function showWindow(trayBounds?: Electron.Rectangle): void {
  if (!mainWindow) createWindow();
  if (!mainWindow) return;

  if (trayBounds) {
    const display = screen.getDisplayNearestPoint({
      x: trayBounds.x,
      y: trayBounds.y,
    });

    // Position below the tray icon, centered horizontally
    const x = Math.round(trayBounds.x + trayBounds.width / 2 - WINDOW_WIDTH / 2);
    const y = Math.round(trayBounds.y + trayBounds.height + 4);

    // Clamp to screen bounds
    const clampedX = Math.max(
      display.workArea.x,
      Math.min(x, display.workArea.x + display.workArea.width - WINDOW_WIDTH)
    );

    mainWindow.setPosition(clampedX, y, false);
  }

  mainWindow.show();
  mainWindow.focus();
}

// ---- IPC Handlers (bridge between UI and daemon) ---------------------------

function setupIPC(): void {
  ipcMain.handle('get-stats', async () => {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/stats`);
      return await res.json();
    } catch {
      return { artifacts: 0, sync: { pending: 0, synced: 0, failed: 0 }, recentChanges: [] };
    }
  });

  ipcMain.handle('get-artifacts', async (_event, limit = 20) => {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/artifacts?limit=${limit}`);
      return await res.json();
    } catch {
      return { artifacts: [], total: 0 };
    }
  });

  ipcMain.handle('get-health', async () => {
    try {
      const res = await fetch(`http://localhost:${PORT}/health`);
      return await res.json();
    } catch {
      return { status: 'error' };
    }
  });

  ipcMain.handle('open-web', () => {
    shell.openExternal('https://lurk-web.vercel.app');
  });

  ipcMain.handle('open-settings', () => {
    shell.openExternal('https://lurk-web.vercel.app/settings');
  });

  ipcMain.handle('open-tutorials', () => {
    shell.openExternal('https://lurk-web.vercel.app/tutorials');
  });

  ipcMain.handle('get-watched-dirs', () => {
    return daemon?.getWatchedDirs() ?? [];
  });

  ipcMain.handle('add-watched-dir', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Choose a folder to watch',
      buttonLabel: 'Watch This Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const dir = result.filePaths[0];
    return daemon?.addWatchDir(dir) ?? [];
  });

  ipcMain.handle('remove-watched-dir', (_event, dir: string) => {
    return daemon?.removeWatchDir(dir) ?? [];
  });

  ipcMain.handle('quit-app', () => {
    app.quit();
  });

  ipcMain.handle('check-for-updates', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });
}

// ---- Fallback tray icon (PNG buffer for a simple circle) -------------------

function createFallbackIcon(): Buffer {
  // 36x36 PNG with a filled circle (pre-computed minimal valid PNG)
  // This is used only when no icon file is found
  const size = 36;
  const header = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  ]);

  // For a proper fallback we'd generate a real PNG, but nativeImage handles
  // empty gracefully. Return a 1x1 black pixel PNG as minimal fallback.
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAAXNSR0IArs4c6QAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAEqADAAQAAAABAAAAEgAAAABMFHZcAAAAT0lEQVQ4Ee2SQQoAIAwD2///aD3ookVBD4L0kIQMbQJAjHF77zPzjbJ+V9MBFAB2BuSUi8xMKEk0M8FIamxmpOg50Tv+R/+IorxjBMD+ABdvD3YSCZ3BAAAAAElFTkSuQmCC',
    'base64'
  );
}

// ---- App Lifecycle ---------------------------------------------------------

app.whenReady().then(async () => {
  // 1. Start the daemon (runs Express server + watcher + ledger)
  daemon = new LurkDaemon();
  await daemon.start();

  // 2. Create tray icon
  createTray();

  // 3. Create (hidden) window
  createWindow();

  // 4. Wire up IPC
  setupIPC();

  // 5. Auto-updater (silent check, notify user if update available)
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.log('[AutoUpdater] No update server configured:', err?.message ?? err);
  });

  console.log('[Lurk Desktop] Menu bar app ready');
});

app.on('window-all-closed', () => {
  // Don't quit when window closes — we're a tray app
});

app.on('before-quit', async () => {
  if (daemon) {
    await daemon.shutdown();
  }
});
