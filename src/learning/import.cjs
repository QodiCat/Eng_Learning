const { classifyInput } = require('../translation/input.cjs');

function parseLibrary(contents, extension, config) {
  let words;
  const clean = contents.replace(/^\uFEFF/, '');
  if (extension === '.json') {
    try { words = JSON.parse(clean); } catch { throw new Error('词库 JSON 格式无效。'); }
    if (!Array.isArray(words) || !words.every(word => typeof word === 'string')) throw new Error('JSON 词库必须是字符串数组，例如 ["apple", "book"]。');
  } else if (extension === '.txt') {
    words = clean.split(/\r?\n/).map(word => word.trim()).filter(Boolean);
  } else throw new Error('仅支持 UTF-8 TXT（每行一个单词）或 JSON 字符串数组。');
  if (!words.length) throw new Error('词库为空。');
  const keys = words.map((word, index) => {
    try {
      const input = classifyInput(word, config);
      if (input.language !== 'en') throw new Error('词库仅接受英文单词。');
      return input.key;
    } catch { throw new Error(`词库第 ${index + 1} 项不是有效英文单词；本次未导入任何内容。`); }
  });
  return [...new Set(keys)];
}
module.exports = { parseLibrary };
