const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let currentMode = 'studio'; // 'pet' or 'studio'
let tray = null;
let multiMonitorEnabled = false;

function switchModeToStudio() {
  if (!mainWindow) return;
  if (app.dock) app.dock.show();
  currentMode = 'studio';
  mainWindow.setFocusable(true);
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.setAlwaysOnTop(false);
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(false);
  }
  mainWindow.setSize(1040, 720);
  mainWindow.center();
  mainWindow.show();
  mainWindow.restore();
  mainWindow.focus();
  mainWindow.webContents.send('app-mode-changed', 'studio');
}

function switchModeToPet() {
  if (!mainWindow) return;
  if (app.dock) app.dock.hide();
  currentMode = 'pet';
  applyPetWindowBounds();
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  // Prevent stealing focus from other applications
  mainWindow.setFocusable(false);
  mainWindow.showInactive();
  mainWindow.webContents.send('app-mode-changed', 'pet');
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  if (!fs.existsSync(iconPath)) {
    try {
      require('../scripts/generate-icon.js');
    } catch (e) {
      console.error('Failed to generate tray icon script:', e);
    }
  }

  let icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 18, height: 18 });
  }

  tray = new Tray(icon);
  tray.setToolTip('Pixel Pet Studio');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '✏️ Open Pixel Pet Studio',
      click: () => switchModeToStudio()
    },
    {
      label: '🐾 Float as Desktop Pet',
      click: () => switchModeToPet()
    },
    { type: 'separator' },
    {
      label: '🔒 Toggle Gaming Lock (Ctrl+Shift+L)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-pet-lock');
        }
      }
    },
    {
      label: '🚶 Toggle Dynamic Movement (Ctrl+Shift+W)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-pet-walking');
        }
      }
    },
    {
      label: '👁️ Toggle Status Bar (Ctrl+Shift+H)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-status-widget');
        }
      }
    },
    { type: 'separator' },
    {
      label: '❌ Quit Pet',
      click: () => {
        app.quit();
        setTimeout(() => app.exit(0), 200);
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (currentMode === 'pet') {
      switchModeToStudio();
    } else {
      switchModeToPet();
    }
  });

  tray.on('double-click', () => {
    switchModeToStudio();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    transparent: true,
    frame: false,
    hasShadow: false, // Prevents OS window drop-shadow on desktop wallpaper
    alwaysOnTop: false,
    skipTaskbar: process.platform === 'win32', // Windows hides taskbar; macOS uses app.dock show/hide
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer LOG ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.center();
    mainWindow.show();
  });

  // Try loading local dist first if it exists, otherwise dev server
  const distPath = path.join(__dirname, '../dist/index.html');
  const fs = require('fs');
  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow.loadFile(distPath);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getDisplaysInfoPayload() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const minX = multiMonitorEnabled ? Math.min(...displays.map(d => d.bounds.x)) : 0;
  const minY = multiMonitorEnabled ? Math.min(...displays.map(d => d.bounds.y)) : 0;

  const mappedDisplays = (multiMonitorEnabled ? displays : [primaryDisplay]).map((d, index) => {
    const area = d.workArea || d.bounds;
    return {
      id: d.id,
      index: index + 1,
      localBounds: {
        x: area.x - minX,
        y: area.y - minY,
        width: area.width,
        height: area.height
      },
      bounds: d.bounds,
      workArea: d.workArea,
      isPrimary: d.id === primaryDisplay.id
    };
  });

  return {
    multiMonitor: multiMonitorEnabled,
    minX,
    minY,
    displays: mappedDisplays
  };
}

function applyPetWindowBounds() {
  if (!mainWindow || currentMode !== 'pet') return;

  if (multiMonitorEnabled) {
    const displays = screen.getAllDisplays();
    const minX = Math.min(...displays.map(d => d.bounds.x));
    const minY = Math.min(...displays.map(d => d.bounds.y));
    const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
    const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));
    mainWindow.setBounds({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    });
  } else {
    const primaryDisplay = screen.getPrimaryDisplay();
    // Use full screen bounds so overlay covers entire display including taskbar area
    const { x, y, width, height } = primaryDisplay.bounds;
    mainWindow.setBounds({
      x,
      y,
      width,
      height
    });
  }

  // Use 'screen-saver' level so pet floats ON TOP of taskbar, dock, and system windows
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.setFocusable(false);

  // Send monitor layout to renderer
  mainWindow.webContents.send('displays-info', getDisplaysInfoPayload());
}

ipcMain.handle('prepare-screen-pick', () => true);
ipcMain.handle('finish-screen-pick', () => true);

const { execFile } = require('child_process');
ipcMain.handle('pick-screen-color', async () => {
  if (process.platform !== 'win32') {
    // Non-Windows platforms (macOS/Linux): let renderer use Chromium EyeDropper
    return null;
  }

  return new Promise((resolve) => {
    let pickerPath = path.join(__dirname, '../tools/screen-picker.exe');
    if (!fs.existsSync(pickerPath)) {
      pickerPath = path.join(process.resourcesPath, 'tools/screen-picker.exe');
    }
    if (!fs.existsSync(pickerPath)) {
      pickerPath = path.join(process.resourcesPath, 'app.asar.unpacked/tools/screen-picker.exe');
    }
    if (!fs.existsSync(pickerPath)) {
      pickerPath = path.join(app.getAppPath(), 'tools/screen-picker.exe');
    }

    if (!fs.existsSync(pickerPath)) {
      console.warn('screen-picker.exe not found, falling back');
      return resolve(null);
    }

    execFile(pickerPath, [], { windowsHide: false }, (error, stdout) => {
      if (error) {
        return resolve(null);
      }
      const hex = (stdout || '').trim();
      if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
        resolve(hex);
      } else {
        resolve(null);
      }
    });
  });
});

ipcMain.on('set-window-mode', (event, mode) => {
  if (!mainWindow) return;
  if (mode === 'studio') {
    switchModeToStudio();
  } else if (mode === 'pet') {
    switchModeToPet();
  }
});

ipcMain.on('set-window-focusable', (event, focusable) => {
  if (!mainWindow || currentMode !== 'pet') return;
  mainWindow.setFocusable(focusable);
  if (focusable) {
    mainWindow.focus();
  } else {
    mainWindow.blur();
  }
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  if (!mainWindow || currentMode !== 'pet') return;
  mainWindow.setIgnoreMouseEvents(ignore, options || { forward: true });
});

ipcMain.on('set-multimonitor', (event, enabled) => {
  multiMonitorEnabled = !!enabled;
  if (currentMode === 'pet') {
    applyPetWindowBounds();
  }
});

ipcMain.handle('get-displays-info', () => {
  return getDisplaysInfoPayload();
});

ipcMain.handle('get-displays', () => {
  return screen.getAllDisplays().map((d, index) => ({
    id: d.id,
    index: index + 1,
    bounds: d.bounds,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }));
});

ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.on('minimize-app', () => {
  if (mainWindow) mainWindow.minimize();
});

// Auto-Updater Integration
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater-status', {
      status: 'available',
      version: info.version
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('updater-status', {
      status: 'not-available',
      version: info.version
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('updater-status', {
      status: 'downloading',
      percent: Math.floor(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater-status', {
      status: 'downloaded',
      version: info.version
    });
  });

  autoUpdater.on('error', (err) => {
    console.warn('AutoUpdater warning:', err.message);
    mainWindow?.webContents.send('updater-status', {
      status: 'error',
      message: err.message
    });
  });
}

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.on('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(err => {
      console.warn('Check for updates error:', err);
    });
  } else {
    mainWindow?.webContents.send('updater-status', {
      status: 'dev',
      message: 'Running in development mode (updates active in packaged builds)'
    });
  }
});

ipcMain.on('restart-and-install-update', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdater();

  // Check for updates on startup if packaged
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => console.warn('Initial update check error:', err));
    }, 4000);
  }

  // Register Global Shortcuts
  // 1. Status Bar Toggle (Ctrl+Shift+H / Ctrl+H)
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-status-widget');
    }
  });

  globalShortcut.register('CommandOrControl+H', () => {
    if (mainWindow && currentMode === 'pet') {
      mainWindow.webContents.send('toggle-status-widget');
    }
  });

  // 2. Gaming Lock Mode (Ctrl+Shift+L / Ctrl+L) - 100% click passthrough & mouse protection
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-pet-lock');
    }
  });

  globalShortcut.register('CommandOrControl+L', () => {
    if (mainWindow && currentMode === 'pet') {
      mainWindow.webContents.send('toggle-pet-lock');
    }
  });

  // 3. Dynamic Movement / Walking Toggle (Ctrl+Shift+W / Ctrl+W)
  globalShortcut.register('CommandOrControl+Shift+W', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-pet-walking');
    }
  });

  globalShortcut.register('CommandOrControl+W', () => {
    if (mainWindow && currentMode === 'pet') {
      mainWindow.webContents.send('toggle-pet-walking');
    }
  });

  // macOS Application Menu
  if (process.platform === 'darwin') {
    const template = [
      {
        label: 'Pixel Pet Studio',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: 'Open Studio',
            accelerator: 'CmdOrCtrl+O',
            click: () => switchModeToStudio()
          },
          {
            label: 'Float Desktop Pet',
            accelerator: 'CmdOrCtrl+P',
            click: () => switchModeToPet()
          },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        ]
      }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      switchModeToStudio();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
