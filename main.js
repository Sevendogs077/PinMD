const { app, BrowserWindow, globalShortcut, screen, ipcMain, dialog, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tray = null;
const configPath = path.join(app.getPath('userData'), 'window-state.json');

// --- 状态管理 ---
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveState() {
  if (!win) return;
  try {
    const bounds = win.getBounds();
    fs.writeFileSync(configPath, JSON.stringify(bounds));
  } catch (e) {
    console.error('保存状态失败:', e);
  }
}

// --- 窗口创建 ---
function createWindow() {
  const state = loadState();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const defaultBounds = {
    width: 300,  
    height: 400, 
    x: width - 300 - 15,
    y: height - 400 - 15
  };

  const bounds = state || defaultBounds;

  win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    skipTaskbar: true, // 任务栏不显示
    resizable: true,
    type: 'toolbar',   // 工具栏行为
    alwaysOnTop: true, // 置顶
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.loadFile('index.html');

  // --- 托盘图标 ---
  const iconPath = path.join(__dirname, 'icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => toggleWindow() },
    { label: '退出', click: () => { saveState(); app.exit(); }}
  ]);
  
  tray.setToolTip('PinMD');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleWindow());

  // --- 幽灵模式快捷键 (Alt+Shift+Z) ---
  let isGhost = false;
  globalShortcut.register('Alt+Shift+Z', () => {
    isGhost = !isGhost;
    // 开启/关闭鼠标穿透
    win.setIgnoreMouseEvents(isGhost, { forward: true });
    win.webContents.send('toggle-ghost', isGhost);
  });

  // --- 事件监听 ---
  // 仅在关闭时保存状态，避免拖动时的性能损耗
  win.on('close', saveState);
}

function toggleWindow() {
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.restore();
  }
}

// --- IPC 通信 ---
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('open-external-file', async (event, filePath) => {
  if (filePath) {
    shell.openPath(filePath);
  }
});

// --- 生命周期 ---
app.disableHardwareAcceleration(); // 解决透明窗口黑屏/闪烁问题
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});