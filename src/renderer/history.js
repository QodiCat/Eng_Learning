/* global renderer API is passed in to keep this view independent of startup. */
function renderHistory(state, api, refresh, notice) {
  const list = document.getElementById('history-list');
  list.replaceChildren();
  if (!state.translations.length) list.textContent = '还没有翻译记录。切换到翻译模式后查询即可保存。';
  for (const record of state.translations) {
    const card = document.createElement('article');
    card.className = 'card';
    const time = document.createElement('p');
    time.textContent = new Date(record.lastAt).toLocaleString();
    const selected = document.createElement('p');
    selected.textContent = '点击英文单词，或拖选连续的英文词组';
    const add = document.createElement('button');
    add.className = 'primary';
    add.textContent = '加入我的学习词库';
    add.disabled = true;
    let word = '';
    const buttons = [];
    function choose(text) {
      word = text.replaceAll('’', "'").replace(/\s+/g, ' ').trim();
      const valid = /^[A-Za-z]+(?:[-'][A-Za-z]+)*(?: [A-Za-z]+(?:[-'][A-Za-z]+)*)*$/.test(word);
      const exists = state.personalKeys.includes(`en:${word.toLowerCase()}`);
      selected.textContent = valid ? `已选择：${word}${exists ? ' · 已在词库中' : ''}` : '请选择连续完整的英文单词或词组，不包含标点';
      add.disabled = !valid || exists;
    }
    card.append(time);
    for (const text of [record.text, record.translation]) {
      const paragraph = document.createElement('div');
      paragraph.className = 'history-text';
      const selectPhrase = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        for (const item of buttons) item.setAttribute('aria-pressed', 'false');
        if (!paragraph.contains(selection.anchorNode) || !paragraph.contains(selection.focusNode)) {
          word = '';
          add.disabled = true;
          selected.textContent = '请在同一段原文或译文中选择词组';
          return;
        }
        choose(selection.toString());
      };
      paragraph.addEventListener('mouseup', selectPhrase);
      paragraph.addEventListener('keyup', selectPhrase);
      for (const part of text.split(/([A-Za-z]+(?:[-'’][A-Za-z]+)*)/g)) {
        if (!/^[A-Za-z]+(?:[-'’][A-Za-z]+)*$/.test(part)) { paragraph.append(document.createTextNode(part)); continue; }
        const button = document.createElement('button');
        button.className = 'history-token';
        button.textContent = part;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          if (!window.getSelection().isCollapsed) return;
          for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
          choose(part);
        });
        buttons.push(button);
        paragraph.append(button);
      }
      card.append(paragraph);
    }
    add.addEventListener('click', async () => {
      const chosen = word;
      add.disabled = true;
      try {
        await api.addHistoryWord(record.id, chosen);
        await refresh();
        notice(`已将 ${chosen} 加入我的学习词库和学习记录。`);
      } catch (error) { notice(error.message, true); add.disabled = false; }
    });
    card.append(selected, add);
    list.append(card);
  }
}
