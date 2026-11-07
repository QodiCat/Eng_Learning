const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function runDesktopSmoke(desktop, onShortcut, directory) {
  const { main, popup, tray, menu } = desktop;
  const errors = [];
  popup.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
  assert.equal(tray.isDestroyed(), false);
  assert.equal(menu.items.at(-1).label, '退出拾词');
  desktop.showMain();
  main.close();
  assert.equal(main.isDestroyed(), false, 'Closing main must keep background windows alive');
  assert.equal(main.isVisible(), false);
  // Exercise the actual shortcut flow with a deterministic selection. Input rejection
  // must show inside the small window, without ever contacting a live AI service.
  await onShortcut(async () => {
    assert.equal(popup.isVisible(), false, 'Capture must happen before popup takes focus');
    return { text: 'two words' };
  });
  assert.equal(main.isVisible(), false, 'Shortcut must not restore the main window');
  assert.equal(popup.isVisible(), true);
  const bounds = popup.getBounds();
  assert.ok(bounds.width < main.getBounds().width);
  const result = await popup.webContents.executeJavaScript(`(async () => {
    let settingsDenied = false;
    try { await window.wordbridge.savePrompt('must not be saved'); } catch { settingsDenied = true; }
    const state = await window.wordbridge.state();
    return {
      text: document.getElementById('query').value,
      hasError: !document.getElementById('notice').hidden && document.getElementById('notice').classList.contains('error'),
      busy: state.busy,
      settingsDenied,
      secretExposed: 'apiKey' in state.config,
      nodeExposed: typeof require !== 'undefined',
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  })()`);
  assert.deepEqual(result, { text: 'two words', hasError: true, busy: false, settingsDenied: true, secretExposed: false, nodeExposed: false, overflow: false });
  const image = await popup.webContents.capturePage();
  fs.writeFileSync(path.join(directory, 'popup-smoke.png'), image.toPNG());
  desktop.send('working', { text: 'apple' });
  desktop.send('result', { result: { text: 'apple', previousCount: 1, count: 2, sources: ['Smoke library'], translation: '<b>苹果</b>' } });
  desktop.send('idle', {});
  const rendered = await popup.webContents.executeJavaScript(`({
    text: document.getElementById('result-text').textContent,
    htmlChild: Boolean(document.getElementById('result-text').querySelector('b')),
    count: document.getElementById('result-meta').textContent,
    source: document.getElementById('result-sources').textContent,
    enabled: !document.getElementById('translate-button').disabled,
  })`);
  assert.deepEqual(rendered, { text: '<b>苹果</b>', htmlChild: false, count: '此前查询 1 次 · 累计 2 次', source: 'Smoke library', enabled: true });
  popup.close();
  assert.equal(popup.isDestroyed(), false);
  assert.equal(popup.isVisible(), false);
  menu.items[1].click();
  assert.equal(popup.isVisible(), true, 'Tray must reopen popup');
  await popup.webContents.executeJavaScript('window.wordbridge.openMain()');
  assert.equal(main.isVisible(), true);
  assert.equal(popup.isVisible(), false);
  main.close();
  menu.items[0].click();
  assert.equal(main.isVisible(), true, 'Tray must reopen main');
  desktop.showPopup();
  await popup.webContents.executeJavaScript('window.wordbridge.hidePopup()');
  assert.equal(popup.isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('Desktop smoke passed: tray, background lifetime, shortcut popup, IPC restrictions, close and reopen.');
}

module.exports = { runDesktopSmoke };
