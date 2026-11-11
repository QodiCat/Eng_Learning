let studySession;
let studySaving = false;
let mnemonicSaving = false;

function showStudyCard() {
  const word = studySession.words[studySession.index];
  $('study-progress').textContent = `${studySession.index + 1} / ${studySession.words.length}`;
  $('study-word').textContent = word.text;
  $('study-count').textContent = `已学习 ${word.studyCount} 次`;
  $('study-meaning').textContent = word.translation;
  $('study-meaning').hidden = true;
  $('study-memory').hidden = true;
  const saved = state.words.find(item => item.key === word.key)?.mnemonic;
  $('study-mnemonic-text').textContent = saved || '';
  $('study-mnemonic-text').hidden = !saved;
  $('study-mnemonic').textContent = saved ? '重新生成助记' : '生成助记';
  $('study-reveal').hidden = false;
  $('study-next').disabled = true;
  $('study-next').textContent = studySession.index === studySession.words.length - 1 ? '完成' : '下一词';
  $('study-error').textContent = '';
  studySession.id = crypto.randomUUID();
  $('study-reveal').focus();
}

$('start-study').addEventListener('click', () => {
  const day = $('learning-day').value;
  const words = state.words.filter(word => !day || word.days.includes(day));
  if (!words.length) return;
  studySession = { words, index: 0 };
  $('study-dialog').showModal();
  showStudyCard();
});
$('study-reveal').addEventListener('click', () => {
  $('study-meaning').hidden = false;
  $('study-memory').hidden = false;
  $('study-reveal').hidden = true;
  $('study-next').disabled = false;
  $('study-next').focus();
});
$('study-next').addEventListener('click', async () => {
  if (studySaving || mnemonicSaving || !studySession || $('study-meaning').hidden) return;
  studySaving = true;
  $('study-next').disabled = true;
  $('study-exit').disabled = true;
  try {
    update(await api.study(studySession.words[studySession.index].key, studySession.id));
    studySession.index += 1;
    if (studySession.index === studySession.words.length) {
      const count = studySession.words.length;
      $('study-dialog').close();
      notice(`本轮完成 ${count} 个词，每词学习次数已增加 1 次。`);
    } else showStudyCard();
  } catch (error) {
    $('study-error').textContent = error.message;
    $('study-next').disabled = false;
  } finally {
    studySaving = false;
    $('study-exit').disabled = false;
  }
});
$('study-exit').addEventListener('click', () => $('study-dialog').close());
$('study-dialog').addEventListener('cancel', event => { if (studySaving || mnemonicSaving) event.preventDefault(); });
$('study-dialog').addEventListener('close', () => { studySession = null; });

$('study-mnemonic').addEventListener('click', async () => {
  if (!studySession || mnemonicSaving || studySaving) return;
  mnemonicSaving = true;
  for (const id of ['study-next', 'study-exit', 'study-mnemonic']) $(id).disabled = true;
  $('study-mnemonic').textContent = '正在生成…';
  $('study-mnemonic-cancel').hidden = false;
  $('study-error').textContent = '';
  try {
    const key = studySession.words[studySession.index].key;
    const next = await api.mnemonic(key);
    update(next);
    const word = next.words.find(item => item.key === key);
    $('study-mnemonic-text').textContent = word.mnemonic;
    $('study-mnemonic-text').hidden = false;
  } catch (error) { $('study-error').textContent = error.message; }
  finally {
    mnemonicSaving = false;
    for (const id of ['study-next', 'study-exit', 'study-mnemonic']) $(id).disabled = false;
    $('study-mnemonic-cancel').hidden = true;
    $('study-mnemonic').textContent = $('study-mnemonic-text').textContent ? '重新生成助记' : '生成助记';
  }
});
$('study-mnemonic-cancel').addEventListener('click', () => api.cancel().catch(error => { $('study-error').textContent = error.message; }));
