function classifyInput(raw, config, mode = 'learning') {
  if (!['learning', 'translation'].includes(mode)) throw new Error('无效模式。');
  if (typeof raw !== 'string') throw new Error('请输入文字。');
  const text = mode === 'translation' ? raw.trim() : raw.normalize('NFKC').trim();
  if (!text) throw new Error('未获取到选中文字，请先选中文字再按快捷键。');
  if (mode === 'translation') {
    if (text.length > config.maxTranslationInputLength) throw new Error('文本超过 MAX_TRANSLATION_INPUT_LENGTH 字符上限。');
    if (!/[A-Za-z\p{Script=Han}]/u.test(text)) throw new Error('请输入中文或英文文本。');
    return { text, language: /\p{Script=Han}/u.test(text) ? 'zh' : 'en', mode };
  }
  if (text.length > config.maxInputLength) throw new Error(`文字不能超过 ${config.maxInputLength} 个字符。`);
  const english = text.replace(/^["'“”‘’(\[]+|["'“”‘’)\],.!?;:]+$/g, '');
  if (/^[A-Za-z]+(?:[-'’][A-Za-z]+)*$/.test(english)) {
    return { text: english, key: `en:${english.toLowerCase().replaceAll('’', "'")}`, language: 'en' };
  }
  if (/\p{Script=Han}/u.test(text) && /^[\p{Script=Han}\p{P}\p{Z}\s]+$/u.test(text)) {
    if (!config.allowChineseSentences && /[。！？!?；;\r\n]/u.test(text)) {
      throw new Error('当前版本暂不支持中文整句；输入范围仍待确认。');
    }
    return { text, key: `zh:${text}`, language: 'zh' };
  }
  throw new Error('英文暂只支持单个单词；不支持英文词组、句子或中英混合输入。');
}

function selectedEnglish(raw, texts, config) {
  const normalize = text => text.replaceAll('’', "'").replace(/\s+/g, ' ').trim();
  if (typeof raw !== 'string') throw new Error('请选择英文单词或词组。');
  const text = normalize(raw);
  if (!text || text.length > config.maxInputLength) throw new Error(`请选择不超过 ${config.maxInputLength} 个字符的英文单词或词组。`);
  if (!/^[A-Za-z]+(?:[-'][A-Za-z]+)*(?: [A-Za-z]+(?:[-'][A-Za-z]+)*)*$/.test(text)) throw new Error('请选择连续完整的英文单词或词组，不包含标点。');
  const keyText = text.toLowerCase();
  const belongs = texts.some(source => {
    const runs = source.match(/[A-Za-z]+(?:[-'’][A-Za-z]+)*(?:\s+[A-Za-z]+(?:[-'’][A-Za-z]+)*)*/g) || [];
    return runs.some(run => (` ${normalize(run).toLowerCase()} `).includes(` ${keyText} `));
  });
  if (!belongs) throw new Error('请选择这条翻译记录中连续完整的英文单词或词组。');
  return { text, key: `en:${keyText}`, language: 'en' };
}

module.exports = { classifyInput, selectedEnglish };
