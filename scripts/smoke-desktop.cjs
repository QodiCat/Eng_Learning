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
  let captured = false;
  await onShortcut(async () => { captured = true; throw new Error('Direct popup must not capture'); }, 'popup');
  assert.equal(captured, false);
  assert.equal(popup.isVisible(), true, 'Popup mode opens input immediately');
  assert.equal(main.isVisible(), false);
  assert.equal(await popup.webContents.executeJavaScript("document.activeElement.id"), 'query');
  popup.close();
  // Exercise the actual shortcut flow with a deterministic selection. Input rejection
  // must show inside the small window, without ever contacting a live AI service.
  await onShortcut(async () => {
    assert.equal(popup.isVisible(), false, 'Capture must happen before popup takes focus');
    return { text: 'two words' };
  }, 'selection');
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
  for (const [text, expected] of [['apple', '苹果'], ['翻译', 'translate / translation']]) {
    const before = await popup.webContents.executeJavaScript('window.wordbridge.state()');
    const key = text === 'apple' ? 'en:apple' : 'zh:翻译';
    const count = before.words.find(word => word.key === key)?.count || 0;
    let requests = 0;
    await onShortcut(async () => {
      assert.equal(popup.isVisible(), false);
      return { text };
    }, undefined, async (_url, options) => {
      requests++;
      const body = JSON.parse(options.body);
      if (text === '翻译') assert.deepEqual(JSON.parse(body.messages[1].content), { sourceLanguage: 'zh', targetLanguage: 'en', text });
      else assert.equal(body.messages[1].content, text);
      return new Response(JSON.stringify({ choices: [{ message: { content: expected } }] }));
    });
    assert.equal(requests, 1, 'Shortcut must translate automatically without a button click');
    const displayed = await popup.webContents.executeJavaScript("document.getElementById('result-text').textContent");
    assert.equal(displayed, expected);
    const after = await popup.webContents.executeJavaScript('window.wordbridge.state()');
    assert.equal(after.words.find(word => word.key === key).count, count + 1);
    popup.close();
  }
  const beforeFailure = await popup.webContents.executeJavaScript('window.wordbridge.state()');
  await onShortcut(async () => ({ text: '翻译' }), undefined, async () => new Response(JSON.stringify({ choices: [{ message: { content: '请提供需要翻译的文本。' } }] })));
  const afterFailure = await popup.webContents.executeJavaScript('window.wordbridge.state()');
  assert.deepEqual(afterFailure.words, beforeFailure.words, 'Missing English translation must not update learning records');
  popup.close();
  assert.deepEqual(errors, []);
  console.log('Desktop smoke passed: tray, background lifetime, shortcut popup, IPC restrictions, close and reopen.');
}

module.exports = { runDesktopSmoke };
