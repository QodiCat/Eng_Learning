function classifyInput(raw, config) {
  if (typeof raw !== 'string') throw new Error('请输入文字。');
  const text = raw.normalize('NFKC').trim();
  if (!text) throw new Error('未获取到选中文字，请先选中文字再按快捷键。');
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

module.exports = { classifyInput };
