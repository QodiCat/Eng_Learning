const api = window.wordbridge;
const $ = id => document.getElementById(id);
let busy = false;
function notice(message, error = false) {
  $('notice').textContent = message;
  $('notice').hidden = !message;
  $('notice').classList.toggle('error', error);
}
function setBusy(value) {
  busy = value;
  $('translate-button').disabled = value;
  $('translate-button').textContent = value ? '翻译中…' : '翻译';
  $('cancel-button').hidden = !value;
}
async function refresh() {
  const state = await api.state();
  $('query').maxLength = state.config.maxInputLength;
  $('shortcut').textContent = state.config.shortcut.replace('CommandOrControl', 'Ctrl');
  setBusy(state.busy);
  if (state.shortcutIssue || state.config.issue) notice(state.shortcutIssue || state.config.issue, true);
}
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
$('open-main').addEventListener('click', () => api.openMain().catch(error => notice(error.message, true)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') api.hidePopup().catch(error => notice(error.message, true));
});
api.onEvent(event => {
  if (event.type === 'focus-query') { $('query').focus(); $('query').select(); }
  if (event.type === 'selection') { $('query').value = event.text; notice(''); }
  if (event.type === 'working') {
    setBusy(true);
    notice('');
    $('result-word').textContent = event.text;
    $('result-meta').textContent = '正在等待翻译结果…';
    $('result-sources').textContent = '';
    $('result-text').textContent = '';
  }
  if (event.type === 'result') {
    const result = event.result;
    $('result-word').textContent = result.text;
    $('result-meta').textContent = `此前查询 ${result.previousCount} 次 · 累计 ${result.count} 次`;
    $('result-sources').textContent = result.sources.length ? result.sources.join(' · ') : '未匹配词库';
    $('result-text').textContent = result.translation;
  }
  if (event.type === 'idle') {
    setBusy(false);
    if ($('result-meta').textContent === '正在等待翻译结果…') $('result-meta').textContent = '未完成翻译，请查看提示后重试。';
  }
  if (event.type === 'error' || event.type === 'notice') notice(event.message, event.type === 'error');
});
window.addEventListener('focus', () => {
  refresh().catch(error => notice(error.message, true));
  $('query').focus();
});
refresh().catch(error => notice(error.message, true));
