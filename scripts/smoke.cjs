const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function runSmoke(window, root, desktop, onShortcut) {
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
  const state = await window.webContents.executeJavaScript('window.wordbridge.state()');
  assert.ok(state.today);
  assert.equal('apiKey' in state.config, false);
  const { globalShortcut } = require('electron');
  const { saveShortcutConfig } = require('../src/config-save.cjs');
  const { readConfig } = require('../src/config.cjs');
  const shortcutDirectory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'wordbridge-shortcut-'));
  let active;
  try {
    for (const candidate of ['Ctrl+Alt+Shift+F9', 'Ctrl+Alt+Shift+F10']) {
      if (globalShortcut.register(candidate, () => {})) { active = candidate; break; }
    }
    assert.ok(active, 'No test shortcut available');
    saveShortcutConfig(shortcutDirectory, active, globalShortcut, () => {}, active, {});
    assert.equal(readConfig(shortcutDirectory, {}).shortcut, active);
    assert.ok(globalShortcut.isRegistered(active));
    assert.throws(() => saveShortcutConfig(shortcutDirectory, 'DefinitelyInvalidKey', globalShortcut, () => {}, active, {}));
    assert.ok(globalShortcut.isRegistered(active));
  } finally {
    if (active) globalShortcut.unregister(active);
    fs.rmSync(shortcutDirectory, { recursive: true });
  }
  const result = await window.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-page="settings"]').click();
    const settingsVisible = !document.getElementById('page-settings').hidden;
    if (!document.getElementById('shortcut-input') || !document.getElementById('save-shortcut')) throw new Error('缺少快捷键设置');
    let emptyShortcutRejected = false;
    try { await window.wordbridge.saveShortcut(''); } catch { emptyShortcutRejected = true; }
    if (!emptyShortcutRejected) throw new Error('空快捷键必须拒绝');
    if (document.getElementById('service-key').type !== 'password') throw new Error('密钥输入必须隐藏');
    if (!document.getElementById('save-service')) throw new Error('缺少服务保存按钮');
    let invalidConfigRejected = false;
    try { await window.wordbridge.saveConfig({ baseUrl: 'invalid', model: 'test', apiKey: '', requireKey: false, clearKey: false }); }
    catch { invalidConfigRejected = true; }
    if (!invalidConfigRejected) throw new Error('无效服务配置必须拒绝');
    document.querySelector('[data-page="translate"]').click();
    await window.wordbridge.saveMode('learning');
    let rejected = false;
    try { await window.wordbridge.translate('two words'); } catch { rejected = true; }
    return { settingsVisible, rejected, nodeExposed: typeof require !== 'undefined', overflow: document.documentElement.scrollWidth > innerWidth };
  })()`);
  assert.deepEqual(result, { settingsVisible: true, rejected: true, nodeExposed: false, overflow: false });
  const directory = path.join(root, 'artifacts');
  fs.mkdirSync(directory, { recursive: true });
  const screenshot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
  fs.writeFileSync(path.join(directory, 'desktop-smoke.png'), screenshot.toPNG());
  const { runDesktopSmoke } = require('./smoke-desktop.cjs');
  await runDesktopSmoke(desktop, onShortcut, directory);
  await require('./smoke-modes.cjs').runModesSmoke(desktop, onShortcut, directory);
  assert.deepEqual(errors, []);
  console.log('Electron smoke passed: IPC, navigation, input rejection, renderer isolation, layout, screenshot.');
}
module.exports = { runSmoke };
