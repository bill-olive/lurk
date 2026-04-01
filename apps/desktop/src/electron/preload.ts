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
  openTutorials: () => ipcRenderer.invoke('open-tutorials'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  quit: () => ipcRenderer.invoke('quit-app'),
});
