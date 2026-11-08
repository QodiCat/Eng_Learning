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
    selected.textContent = '点击句子中的英文单词';
    const add = document.createElement('button');
    add.className = 'primary';
    add.textContent = '加入我的学习词库';
    add.disabled = true;
    let word = '';
    const buttons = [];
    card.append(time);
    for (const text of [record.text, record.translation]) {
      const paragraph = document.createElement('div');
      paragraph.className = 'history-text';
      for (const part of text.split(/([A-Za-z]+(?:[-'’][A-Za-z]+)*)/g)) {
        if (!/^[A-Za-z]+(?:[-'’][A-Za-z]+)*$/.test(part)) { paragraph.append(document.createTextNode(part)); continue; }
        const button = document.createElement('button');
        button.className = 'history-token';
        button.textContent = part;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          word = part;
          for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
          const exists = state.personalKeys.includes(`en:${part.toLowerCase().replaceAll('’', "'")}`);
          selected.textContent = `已选择：${part}${exists ? ' · 已在词库中' : ''}`;
          add.disabled = exists;
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
