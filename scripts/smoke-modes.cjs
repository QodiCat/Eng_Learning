const assert = require('node:assert/strict');

async function runModesSmoke(desktop, onShortcut) {
  const { main, popup } = desktop;
  await popup.webContents.executeJavaScript("window.wordbridge.saveMode('translation')");
  assert.equal(await main.webContents.executeJavaScript("document.getElementById('mode').value"), 'translation');
  const before = await main.webContents.executeJavaScript('window.wordbridge.state()');
  const text = 'A sentence with apples.\nAnother paragraph.';
  await onShortcut(async () => ({ text }), 'selection', async (_url, options) => {
    assert.equal(JSON.parse(JSON.parse(options.body).messages[1].content).text, text);
    return new Response(JSON.stringify({ choices: [{ message: { content: '一句包含苹果的话。\n另一段。' } }] }));
  });
  const after = await main.webContents.executeJavaScript('window.wordbridge.state()');
  assert.deepEqual(after.words, before.words);
  assert.equal(after.translations.length, before.translations.length + 1);
  assert.equal(after.translations[0].text, text);
  assert.match(await popup.webContents.executeJavaScript("document.getElementById('result-meta').textContent"), /翻译记录/);
  const ui = await main.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-page="history"]').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const card = document.getElementById('history-list').firstElementChild;
    const token = [...card.querySelectorAll('.history-token')].find(button => button.textContent === 'apples');
    token.click();
    return { selected: token.getAttribute('aria-pressed'), enabled: !card.querySelector('.primary').disabled, visible: !document.getElementById('page-history').hidden };
  })()`);
  assert.deepEqual(ui, { selected: 'true', enabled: true, visible: true });
  await popup.webContents.executeJavaScript("window.wordbridge.saveMode('learning')");
  popup.close();
  console.log('Modes smoke passed: shared mode, sentence shortcut, separate history, selectable words.');
}

module.exports = { runModesSmoke };
