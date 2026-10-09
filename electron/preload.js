const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setWindowMode: (mode) => ipcRenderer.send('set-window-mode', mode),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  setMultiMonitor: (enabled) => ipcRenderer.send('set-multimonitor', enabled),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getDisplaysInfo: () => ipcRenderer.invoke('get-displays-info'),
  onDisplaysInfo: (cb) => ipcRenderer.on('displays-info', (e, data) => cb(data)),
  onToggleStatusWidget: (cb) => ipcRenderer.on('toggle-status-widget', () => cb()),
  onTogglePetLock: (cb) => ipcRenderer.on('toggle-pet-lock', () => cb()),
  onTogglePetWalking: (cb) => ipcRenderer.on('toggle-pet-walking', () => cb()),
  onAppModeChanged: (cb) => ipcRenderer.on('app-mode-changed', (e, mode) => cb(mode)),
  setFocusable: (focusable) => ipcRenderer.send('set-window-focusable', focusable),
  closeApp: () => ipcRenderer.send('close-app'),
  minimizeApp: () => ipcRenderer.send('minimize-app'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  restartAndInstallUpdate: () => ipcRenderer.send('restart-and-install-update'),
  onUpdaterStatus: (cb) => ipcRenderer.on('updater-status', (e, data) => cb(data)),
  prepareScreenPick: () => ipcRenderer.invoke('prepare-screen-pick'),
  finishScreenPick: () => ipcRenderer.invoke('finish-screen-pick'),
  pickScreenColor: () => ipcRenderer.invoke('pick-screen-color')
});
