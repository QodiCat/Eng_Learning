const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readConfig, publicConfig } = require('./config.cjs');
const { classifyInput } = require('./translation/input.cjs');
const { translate, DEFAULT_PROMPT } = require('./translation/client.cjs');
const { LearningStore } = require('./learning/store.cjs');
const { parseLibrary } = require('./learning/import.cjs');
const { captureSelection } = require('./windows/capture.cjs');

const smoke = process.argv.includes('--smoke-test');
if (smoke) app.disableHardwareAcceleration();
const root = app.isPackaged ? path.dirname(app.getPath('exe')) : path.join(__dirname, '..');
const html = path.join(__dirname, 'renderer', 'index.html');
let window, config, store, activeRequest, captureBusy = false, shortcutIssue = '';
const indexUrl = pathToFileURL(html).href;

function send(type, payload) { if (window && !window.isDestroyed()) window.webContents.send('app:event', { type, ...payload }); }
function snapshot() {
  return { ...store.snapshot(), config: publicConfig(config), shortcutIssue, dataFile: store.file, busy: Boolean(activeRequest) || captureBusy };
}

async function runTranslation(raw) {
  if (activeRequest) throw new Error('已有翻译请求进行中，请等待完成或先取消。');
  const input = classifyInput(raw, config);
  const request = new AbortController();
  activeRequest = request;
  send('working', { text: input.text });
  try {
    const translation = await translate(input, store.data.prompt, config, { signal: request.signal });
    request.signal.throwIfAborted();
    const result = store.record(input, translation);
    send('result', { result });
    return result;
  } finally {
    if (activeRequest === request) activeRequest = null;
    send('idle', {});
  }
}

async function onShortcut() {
  if (captureBusy || activeRequest) { send('notice', { message: '已有取词或翻译任务，请稍候或取消。' }); return; }
  captureBusy = true;
  try {
    const selection = await captureSelection(config);
    window.show();
    window.focus();
    send('selection', { text: selection.text });
    if (selection.warning) send('notice', { message: selection.warning });
    await runTranslation(selection.text);
  } catch (error) {
    window.show();
    send('error', { message: error.message });
  } finally { captureBusy = false; send('idle', {}); }
}

function bindShortcut(next) {
  if (smoke) return;
  if (next === config?.shortcut && globalShortcut.isRegistered(next)) return;
  if (!next) throw new Error('TRANSLATE_SHORTCUT 不能为空。');
  let registered = false;
  try { registered = globalShortcut.register(next, onShortcut); } catch { /* Report invalid accelerator below. */ }
  if (!registered) throw new Error('快捷键无效或已被其他程序占用，请修改 .env 中的 TRANSLATE_SHORTCUT。');
  if (config?.shortcut && config.shortcut !== next) globalShortcut.unregister(config.shortcut);
}

function handle(channel, callback) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame?.url !== indexUrl) return { ok: false, error: '不允许的调用来源。' };
    try { return { ok: true, data: await callback(...args) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}

function registerHandlers() {
  handle('state', snapshot);
  handle('translate', text => {
    if (captureBusy) throw new Error('正在从其他应用取词，请稍候。');
    return runTranslation(text);
  });
  handle('cancel', () => { activeRequest?.abort(); });
  handle('prompt:save', prompt => { store.savePrompt(prompt); return snapshot(); });
  handle('prompt:reset', () => { store.savePrompt(DEFAULT_PROMPT); return snapshot(); });
  handle('review', (key, day, reviewed) => { store.review(key, day, reviewed); return snapshot(); });
  handle('config:reload', () => {
    if (activeRequest || captureBusy) throw new Error('请等待当前任务结束再重新加载配置。');
    const next = readConfig(root);
    if (next.dataDirectory !== config.dataDirectory) throw new Error('修改 DATA_DIRECTORY 后请重新启动应用。');
    bindShortcut(next.shortcut);
    config = next;
    shortcutIssue = '';
    return snapshot();
  });
  handle('library:import', async name => {
    if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new Error('请先填写词库名称（最多 100 字符）。');
    const result = await dialog.showOpenDialog(window, { title: '导入英文词库', properties: ['openFile'], filters: [{ name: 'UTF-8 词库', extensions: ['txt', 'json'] }] });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if (fs.statSync(file).size > config.maxImportBytes) throw new Error('词库文件超过 MAX_IMPORT_BYTES 配置的大小限制。');
    const contents = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
    store.importLibrary(name, parseLibrary(contents, path.extname(file).toLowerCase(), config));
    return snapshot();
  });
}

async function start() {
  config = readConfig(root);
  store = new LearningStore(smoke ? path.join(root, 'artifacts', 'smoke-data') : config.dataDirectory || app.getPath('userData'));
  window = new BrowserWindow({
    title: '拾词 · WordBridge', width: 1120, height: 800, minWidth: 840, minHeight: 620,
    show: false, backgroundColor: '#f5f6f2', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !smoke },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  registerHandlers();
  try { bindShortcut(config.shortcut); } catch (error) { shortcutIssue = error.message; }
  await window.loadFile(html);
  if (smoke) {
    const { runSmoke } = require('../scripts/smoke.cjs');
    await runSmoke(window, root);
    app.quit();
  } else window.show();
}

app.setName('WordBridge');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(error => {
    if (smoke) { console.error(error.stack); app.exit(1); }
    else { dialog.showErrorBox('拾词启动失败', error.message); app.quit(); }
  });
}
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { activeRequest?.abort(); globalShortcut.unregisterAll(); });
