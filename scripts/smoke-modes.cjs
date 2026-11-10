const assert = require('node:assert/strict');

async function runModesSmoke(desktop, onShortcut, directory) {
  const { main, popup } = desktop;
  await main.webContents.executeJavaScript("window.wordbridge.saveMode('translation')");
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
  const compact = await popup.webContents.executeJavaScript(`({
    noMode: document.getElementById('mode') === null,
    noRepeatedSource: document.getElementById('result-word') === null,
    metaHidden: document.getElementById('result-meta').hidden,
    meta: document.getElementById('result-meta').textContent,
    sources: document.getElementById('result-sources').textContent,
    translation: document.getElementById('result-text').textContent,
  })`);
  assert.deepEqual(compact, { noMode: true, noRepeatedSource: true, metaHidden: true, meta: '', sources: '', translation: '一句包含苹果的话。\n另一段。' });
  const image = await popup.webContents.capturePage();
  require('node:fs').writeFileSync(require('node:path').join(directory, 'popup-translation-smoke.png'), image.toPNG());
  const ui = await main.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-page="history"]').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const card = document.getElementById('history-list').firstElementChild;
    const token = [...card.querySelectorAll('.history-token')].find(button => button.textContent === 'apples');
    token.click();
    const singleSelected = token.getAttribute('aria-pressed');
    const paragraph = card.querySelector('.history-text');
    const tokens = paragraph.querySelectorAll('.history-token');
    const range = document.createRange();
    range.setStart(tokens[1].firstChild, 0);
    range.setEnd(tokens[3].firstChild, tokens[3].textContent.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    paragraph.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    token.click();
    const phrase = [...card.querySelectorAll('p')].at(-1).textContent;
    selection.removeAllRanges();
    return { selected: singleSelected, phrase, enabled: !card.querySelector('.primary').disabled, visible: !document.getElementById('page-history').hidden };
  })()`);
  assert.deepEqual(ui, { selected: 'true', phrase: '已选择：sentence with apples', enabled: true, visible: true });
  await main.webContents.executeJavaScript("window.wordbridge.saveMode('learning')");
  popup.close();
  console.log('Modes smoke passed: shared mode, sentence shortcut, separate history, selectable words.');
}

module.exports = { runModesSmoke };
