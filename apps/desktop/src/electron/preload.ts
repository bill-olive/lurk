// =============================================================================
// Preload — Exposes safe IPC bridge to the dashboard UI
// =============================================================================

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lurk', {
  getStats: () => ipcRenderer.invoke('get-stats'),
  getArtifacts: (limit?: number) => ipcRenderer.invoke('get-artifacts', limit),
  getHealth: () => ipcRenderer.invoke('get-health'),
  openWeb: () => ipcRenderer.invoke('open-web'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  getWatchedDirs: () => ipcRenderer.invoke('get-watched-dirs'),
  addWatchedDir: () => ipcRenderer.invoke('add-watched-dir'),
  removeWatchedDir: (dir: string) => ipcRenderer.invoke('remove-watched-dir', dir),
  getInsights: (limit?: number) => ipcRenderer.invoke('get-insights', limit),
  openTutorials: () => ipcRenderer.invoke('open-tutorials'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getSetupStatus: () => ipcRenderer.invoke('get-setup-status'),
  onSetupStatus: (callback: (status: unknown) => void) =>
    ipcRenderer.on('setup-status', (_event, status) => callback(status)),
  quit: () => ipcRenderer.invoke('quit-app'),
});
