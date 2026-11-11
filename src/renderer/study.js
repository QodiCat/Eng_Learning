let studySession;
let studySaving = false;

function showStudyCard() {
  const word = studySession.words[studySession.index];
  $('study-progress').textContent = `${studySession.index + 1} / ${studySession.words.length}`;
  $('study-word').textContent = word.text;
  $('study-count').textContent = `已学习 ${word.studyCount} 次`;
  $('study-meaning').textContent = word.translation;
  $('study-meaning').hidden = true;
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
  $('study-reveal').hidden = true;
  $('study-next').disabled = false;
  $('study-next').focus();
});
$('study-next').addEventListener('click', async () => {
  if (studySaving || !studySession || $('study-meaning').hidden) return;
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
$('study-dialog').addEventListener('cancel', event => { if (studySaving) event.preventDefault(); });
$('study-dialog').addEventListener('close', () => { studySession = null; });
