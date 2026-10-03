const api = window.wordbridge;
const $ = id => document.getElementById(id);
let state;
let busy = false;

function notice(message, error = false) {
  $('notice').textContent = message;
  $('notice').classList.toggle('error', error);
  $('notice').hidden = !message;
}
function navigate(page) {
  document.querySelectorAll('.page').forEach(element => { element.hidden = element.id !== `page-${page}`; });
  document.querySelectorAll('[data-page]').forEach(button => {
    button.classList.toggle('active', button.dataset.page === page);
    if (button.dataset.page === page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (page === 'learning') refresh().catch(error => notice(error.message, true));
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function sourceTags(sources) {
  const tags = element('div', undefined, 'tags');
  for (const source of sources.length ? sources : ['未匹配词库']) tags.append(element('span', source, 'tag'));
  return tags;
}
function setBusy(value) {
  busy = value;
  $('translate-button').disabled = busy;
  $('cancel-button').hidden = !busy;
  $('translate-button').textContent = busy ? '翻译中…' : '翻译 ↗';
}
function showResult(result) {
  $('result-empty').hidden = true;
  $('result-content').hidden = false;
  $('result-word').textContent = result.text;
  $('result-language').textContent = result.language === 'en' ? 'EN → 中' : '中 → EN';
  $('result-meta').textContent = `此前查询 ${result.previousCount} 次 · 含本次共 ${result.count} 次`;
  $('result-text').textContent = result.translation;
  $('result-sources').replaceChildren(sourceTags(result.sources));
}
function renderLearning() {
  if (!state) return;
  const day = $('learning-day').value || state.today;
  const words = state.words.filter(word => word.days.includes(day));
  $('learning-summary').textContent = `${words.length} 个词 · ${words.filter(word => word.reviewedDays.includes(day)).length} 个已复习`;
  $('word-list').replaceChildren();
  if (!words.length) {
    const empty = element('div', undefined, 'card empty');
    empty.append(element('h3', '这一天还没有学习记录'), element('p', '成功翻译的词会自动出现在这里。'));
    $('word-list').append(empty);
  }
  for (const word of words) {
    const row = element('article', undefined, 'card word-row');
    const header = element('header');
    const title = element('div');
    title.append(element('h2', word.text), element('span', `累计查询 ${word.count} 次`, 'muted'));
    const reviewed = word.reviewedDays.includes(day);
    const button = element('button', reviewed ? '已复习 ✓ · 撤销' : '标记已复习', reviewed ? 'secondary' : 'primary');
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { update(await api.review(word.key, day, !reviewed)); }
      catch (error) { notice(error.message, true); button.disabled = false; }
    });
    header.append(title, button);
    const details = element('details');
    details.append(element('summary', '回忆一下，再查看释义'), element('div', word.translation, 'translation-text'));
    row.append(header, sourceTags(word.sources), details);
    $('word-list').append(row);
  }
}
function update(next) {
  state = next;
  $('today-label').textContent = state.today.replaceAll('-', ' / ');
  $('shortcut').textContent = state.config.shortcut.replace('CommandOrControl', 'Ctrl').replaceAll('+', ' + ');
  $('config-banner').hidden = state.config.configured;
  $('config-issue').textContent = state.config.issue;
  $('query').maxLength = state.config.maxInputLength;
  $('env-path').textContent = state.config.file;
  $('data-path').textContent = state.dataFile;
  $('service-status').textContent = state.config.configured ? '已配置 · 未验证连接' : '尚未配置';
  $('service-details').textContent = `模型：${state.config.model || '未填写'} · 密钥：${state.config.keyConfigured ? '已填写' : '未填写'}${state.config.issue ? ` · ${state.config.issue}` : ''}`;
  if (!$('prompt').dataset.dirty) $('prompt').value = state.prompt;
  if (!$('learning-day').value) $('learning-day').value = state.today;
  const today = state.words.filter(word => word.days.includes(state.today));
  $('today-count').textContent = today.length;
  $('review-count').textContent = today.filter(word => word.reviewedDays.includes(state.today)).length;
  $('library-list').replaceChildren();
  if (!state.libraries.length) $('library-list').append(element('div', '还没有词库。导入之后，查词就能看到来源。', 'empty'));
  for (const library of state.libraries) {
    const card = element('div', undefined, 'card library-item');
    card.append(element('h2', library.name), element('span', `${library.count} 个单词`, 'pill'));
    $('library-list').append(card);
  }
  renderLearning();
  if (state.shortcutIssue) notice(state.shortcutIssue, true);
}
async function refresh() { update(await api.state()); }

document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.page)));
document.querySelectorAll('[data-open-settings]').forEach(button => button.addEventListener('click', () => navigate('settings')));
$('open-learning').addEventListener('click', () => navigate('learning'));
$('learning-day').addEventListener('change', renderLearning);
$('refresh-learning').addEventListener('click', () => refresh().catch(error => notice(error.message, true)));
$('translate-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  notice('');
  setBusy(true);
  try { await api.translate($('query').value); }
  catch (error) { notice(error.message, true); }
  finally { setBusy(false); }
});
$('cancel-button').addEventListener('click', () => api.cancel().catch(error => notice(error.message, true)));
$('reload-config').addEventListener('click', async () => {
  try { update(await api.reload()); notice(state.config.issue || '配置已重新加载。'); }
  catch (error) { notice(error.message, true); }
});
$('prompt').addEventListener('input', () => { $('prompt').dataset.dirty = 'true'; });
$('prompt-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const next = await api.savePrompt($('prompt').value);
    delete $('prompt').dataset.dirty;
    update(next); notice('提示词已保存，下次翻译生效。');
  } catch (error) { notice(error.message, true); }
});
$('reset-prompt').addEventListener('click', async () => {
  try { const next = await api.resetPrompt(); delete $('prompt').dataset.dirty; update(next); notice('已恢复默认提示词。'); }
  catch (error) { notice(error.message, true); }
});
$('library-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const next = await api.importLibrary($('library-name').value);
    if (next) { update(next); $('library-name').value = ''; notice('词库导入成功。'); }
  } catch (error) { notice(error.message, true); }
  finally { button.disabled = false; }
});
api.onEvent(event => {
  if (event.type === 'selection') { navigate('translate'); $('query').value = event.text; notice(''); }
  if (event.type === 'working') {
    setBusy(true); $('result-content').hidden = true; $('result-empty').hidden = false;
    $('result-empty').replaceChildren(element('span', 'Aa', 'empty-symbol'), element('h3', '正在翻译…'), element('p', '正在等待你的 AI 服务返回结果。'));
  }
  if (event.type === 'result') { showResult(event.result); refresh().catch(error => notice(error.message, true)); }
  if (event.type === 'idle') {
    setBusy(false);
    if (!$('result-empty').hidden) $('result-empty').replaceChildren(element('span', 'Aa', 'empty-symbol'), element('h3', '尚无翻译结果'), element('p', '请检查配置或输入后重试。'));
  }
  if (event.type === 'error' || event.type === 'notice') notice(event.message, event.type === 'error');
});
window.addEventListener('focus', () => { if (state) refresh().catch(error => notice(error.message, true)); });
refresh().catch(error => notice(`启动失败：${error.message}`, true));
