const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function runSmoke(window, root) {
  const errors = [];
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
  const state = await window.webContents.executeJavaScript('window.wordbridge.state()');
  assert.ok(state.today);
  assert.equal('apiKey' in state.config, false);
  const result = await window.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-page="settings"]').click();
    const settingsVisible = !document.getElementById('page-settings').hidden;
    document.querySelector('[data-page="translate"]').click();
    let rejected = false;
    try { await window.wordbridge.translate('two words'); } catch { rejected = true; }
    return { settingsVisible, rejected, nodeExposed: typeof require !== 'undefined', overflow: document.documentElement.scrollWidth > innerWidth };
  })()`);
  assert.deepEqual(result, { settingsVisible: true, rejected: true, nodeExposed: false, overflow: false });
  const directory = path.join(root, 'artifacts');
  fs.mkdirSync(directory, { recursive: true });
  const screenshot = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
  fs.writeFileSync(path.join(directory, 'desktop-smoke.png'), screenshot.toPNG());
  assert.deepEqual(errors, []);
  console.log('Electron smoke passed: IPC, navigation, input rejection, renderer isolation, layout, screenshot.');
}
module.exports = { runSmoke };
