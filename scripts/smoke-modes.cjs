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
  const libraries = await main.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-page="learning"]').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const state = await window.wordbridge.state();
    const count = document.querySelectorAll('#word-list .word-row').length;
    const date = document.getElementById('learning-day');
    const defaultAll = date.value === '';
    date.value = '1900-01-01';
    date.dispatchEvent(new Event('change'));
    const filteredEmpty = document.querySelectorAll('#word-list .word-row').length === 0;
    document.getElementById('all-learning').click();
    const restored = document.querySelectorAll('#word-list .word-row').length === state.words.length;
    document.querySelector('[data-page="libraries"]').click();
    return {
      learningName: document.querySelector('[data-page="learning"]').textContent.includes('学习词库'),
      officialName: document.querySelector('[data-page="libraries"]').textContent.includes('官方词库'),
      defaultAll, allCount: count === state.words.length, filteredEmpty, restored,
      noPersonalList: document.getElementById('personal-list') === null,
    };
  })()`);
  assert.deepEqual(libraries, { learningName: true, officialName: true, defaultAll: true, allCount: true, filteredEmpty: true, restored: true, noPersonalList: true });
  const study = await main.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-page="learning"]').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const before = await window.wordbridge.state();
    if (!before.words.length) throw new Error('Study smoke requires learned words');
    document.getElementById('start-study').click();
    const dialog = document.getElementById('study-dialog');
    const hidden = document.getElementById('study-meaning').hidden;
    const blocked = document.getElementById('study-next').disabled;
    document.getElementById('study-exit').click();
    const unchanged = (await window.wordbridge.state()).words[0].studyCount === before.words[0].studyCount;
    document.getElementById('start-study').click();
    document.getElementById('study-reveal').click();
    document.getElementById('study-next').click();
    for (let i = 0; i < 100 && document.getElementById('study-exit').disabled; i++) await new Promise(resolve => setTimeout(resolve, 20));
    const after = await window.wordbridge.state();
    const totals = () => ['learning-total', 'learning-learned', 'learning-pending'].map(id => Number(document.getElementById(id).textContent));
    const learned = after.words.filter(word => word.studyCount > 0).length;
    const expected = [after.words.length, learned, after.words.length - learned];
    if (JSON.stringify(totals()) !== JSON.stringify(expected)) throw new Error('Learning totals mismatch after study');
    const counted = after.words.find(word => word.key === before.words[0].key).studyCount === before.words[0].studyCount + 1;
    if (dialog.open) document.getElementById('study-exit').click();
    const day = document.getElementById('learning-day');
    day.value = '1900-01-01';
    day.dispatchEvent(new Event('change'));
    if (JSON.stringify(totals()) !== JSON.stringify(expected)) throw new Error('Date filter changed global totals');
    document.getElementById('all-learning').click();
    return { hidden, blocked, unchanged, counted, closed: !dialog.open };
  })()`);
  assert.deepEqual(study, { hidden: true, blocked: true, unchanged: true, counted: true, closed: true });
  await main.webContents.executeJavaScript("window.wordbridge.saveMode('learning')");
  popup.close();
  console.log('Modes smoke passed: shared mode, sentence shortcut, separate history, selectable words.');
}

module.exports = { runModesSmoke };
