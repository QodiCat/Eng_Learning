const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// A code-drawn W keeps the tray asset local and independent of packaged paths.
function trayIcon() {
  const size = 32;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ink = y >= 8 && y <= 24 && [8 + (y - 8) / 4, 16 - (y - 8) / 4, 16 + (y - 8) / 4, 24 - (y - 8) / 4].some(line => Math.abs(x - line) < 1.5);
      const offset = (y * size + x) * 4;
      pixels.set(ink ? [245, 250, 248, 255] : [78, 100, 32, 255], offset);
    }
  }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size, scaleFactor: 1 });
}

function createDesktop({ smoke }) {
  const renderer = path.join(__dirname, '..', 'renderer');
  const preload = path.join(__dirname, '..', 'preload.cjs');
  const urls = new Map();
  let quitting = false;
  let tray;
  function create(file, options) {
    const window = new BrowserWindow({
      show: false, backgroundColor: '#f5f6f2', autoHideMenuBar: true, ...options,
      webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !smoke },
    });
    urls.set(window, pathToFileURL(path.join(renderer, file)).href);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    window.on('close', event => {
      if (!quitting) { event.preventDefault(); window.hide(); }
    });
    window.on('session-end', () => app.quit());
    return window;
  }
  const main = create('index.html', { title: '拾词 · WordBridge', width: 1120, height: 800, minWidth: 840, minHeight: 620 });
  const popup = create('popup.html', { title: '拾词 · 快捷翻译', width: 440, height: 520, minWidth: 360, minHeight: 360, alwaysOnTop: true, skipTaskbar: true, maximizable: false, fullscreenable: false });
  function show(window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
  const showMain = () => show(main);
  const showPopup = () => {
    show(popup);
    popup.webContents.send('app:event', { type: 'focus-query' });
  };
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => tray?.destroy());
  // Create a tray before enabling close-to-hide, so background mode is reachable.
  tray = new Tray(trayIcon());
  tray.setToolTip('拾词 WordBridge · 后台运行');
  const menu = Menu.buildFromTemplate([
    { label: '打开主窗口', click: showMain },
    { label: '快捷翻译', click: showPopup },
    { type: 'separator' },
    { label: '退出拾词', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', showMain);
  return {
    main, popup, tray, menu, showMain, showPopup,
    load: () => Promise.all([main.loadFile(path.join(renderer, 'index.html')), popup.loadFile(path.join(renderer, 'popup.html'))]),
    accepts(event, channel) {
      for (const [window, url] of urls) {
        if (!window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === url) {
          return window === main || ['state', 'translate', 'cancel', 'desktop:main', 'desktop:hide'].includes(channel);
        }
      }
      return false;
    },
    send(type, payload) {
      for (const window of urls.keys()) {
        if (!window.isDestroyed()) window.webContents.send('app:event', { type, ...payload });
      }
    },
  };
}

module.exports = { createDesktop };
