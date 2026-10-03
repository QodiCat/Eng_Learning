const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DEFAULT_PROMPT } = require('../translation/client.cjs');

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

class LearningStore {
  constructor(directory) {
    this.file = path.join(directory, 'learning.json');
    fs.mkdirSync(directory, { recursive: true });
    this.data = { version: 1, prompt: DEFAULT_PROMPT, words: [], libraries: [] };
    if (fs.existsSync(this.file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.validate(this.data);
      } catch {
        throw new Error(`学习数据无法读取或格式不兼容；原文件未覆盖：${this.file}`);
      }
    }
  }

  validate(data) {
    if (data.version !== 1 || typeof data.prompt !== 'string' || !Array.isArray(data.words) || !Array.isArray(data.libraries)) throw new Error('Invalid data');
    for (const word of data.words) {
      if (typeof word.key !== 'string' || typeof word.text !== 'string' || typeof word.translation !== 'string' ||
          !Number.isSafeInteger(word.count) || word.count < 1 || !Array.isArray(word.days) ||
          !word.days.every(day => /^\d{4}-\d{2}-\d{2}$/.test(day)) || !Array.isArray(word.reviewedDays) ||
          !word.reviewedDays.every(day => word.days.includes(day)) || !Number.isFinite(Date.parse(word.lastAt))) throw new Error('Invalid word');
    }
    if (new Set(data.words.map(word => word.key)).size !== data.words.length) throw new Error('Duplicate words');
    for (const library of data.libraries) {
      if (typeof library.name !== 'string' || !Array.isArray(library.keys) || !library.keys.every(key => typeof key === 'string')) throw new Error('Invalid library');
    }
  }

  commit(change) {
    const next = structuredClone(this.data);
    const result = change(next);
    this.validate(next);
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(next, null, 2), { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, this.file);
    } catch {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      throw new Error('无法保存学习数据；本次修改未生效，请检查目录权限与磁盘空间。');
    }
    this.data = next;
    return result;
  }

  record(input, translation, now = new Date()) {
    return this.commit(data => {
      let word = data.words.find(item => item.key === input.key);
      const previousCount = word?.count || 0;
      if (!word) {
        word = { key: input.key, text: input.text, language: input.language, count: 0, days: [], reviewedDays: [] };
        data.words.push(word);
      }
      word.count += 1;
      word.translation = translation;
      word.lastAt = now.toISOString();
      if (!word.days.includes(dayKey(now))) word.days.push(dayKey(now));
      return { ...structuredClone(word), previousCount, sources: this.sources(input.key) };
    });
  }

  sources(key) { return this.data.libraries.filter(library => library.keys.includes(key)).map(library => library.name); }
  snapshot() {
    return {
      today: dayKey(), prompt: this.data.prompt,
      words: this.data.words.map(word => ({ ...structuredClone(word), sources: this.sources(word.key) })).sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
      libraries: this.data.libraries.map(library => ({ name: library.name, count: library.keys.length })),
    };
  }
  savePrompt(prompt) {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 10000) throw new Error('提示词不能为空，且不能超过 10000 字符。');
    this.commit(data => { data.prompt = prompt.trim(); });
  }
  review(key, day, reviewed) {
    if (typeof reviewed !== 'boolean') throw new Error('复习状态无效。');
    this.commit(data => {
      const word = data.words.find(item => item.key === key);
      if (!word || !word.days.includes(day)) throw new Error('该日期没有此单词的学习记录。');
      word.reviewedDays = word.reviewedDays.filter(item => item !== day);
      if (reviewed) word.reviewedDays.push(day);
    });
  }
  importLibrary(name, keys) {
    if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new Error('词库名须为 1–100 字符。');
    if (this.data.libraries.some(library => library.name.toLowerCase() === name.trim().toLowerCase())) throw new Error('已存在同名词库，请修改名称后导入。');
    this.commit(data => { data.libraries.push({ name: name.trim(), keys: [...new Set(keys)] }); });
  }
}

module.exports = { LearningStore, dayKey };
