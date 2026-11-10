const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { LearningStore } = require('../src/learning/store.cjs');
const { classifyInput } = require('../src/translation/input.cjs');
const { translate } = require('../src/translation/client.cjs');
const config = { maxInputLength: 200, maxTranslationInputLength: 10000, allowChineseSentences: false };

test('selected phrases belong to a single source, normalize whitespace, and persist as one learning item', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbridge-phrases-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new LearningStore(directory);
  const record = store.recordTranslation({ text: 'Take  care\nof yourself. Don’t give up, keep going.', language: 'en' }, '照顾好自己。不要放弃，继续前进。');
  const input = store.selectedInput(record.id, 'TAKE \n care', config);
  assert.equal(input.key, 'en:take care');
  assert.equal(input.text, 'TAKE care');
  assert.equal(store.selectedInput(record.id, "don't give up", config).key, "en:don't give up");
  for (const invalid of ['care yourself', 'ake care', 'take car', 'up keep', 'give up, keep', '照顾', 'care '.repeat(100)]) {
    assert.throws(() => store.selectedInput(record.id, invalid, config), invalid);
  }
  store.record(input, '照顾；保重', new Date(), true);
  assert.throws(() => store.selectedInput(record.id, 'take care', config));
  const restored = new LearningStore(directory).snapshot();
  assert.equal(restored.words[0].text, 'TAKE care');
  assert.equal(restored.words[0].translation, '照顾；保重');
  assert.equal(restored.words[0].count, 1);
  assert.deepEqual(restored.personalKeys, ['en:take care']);
  const split = store.recordTranslation({ text: 'hello', language: 'en' }, 'world');
  assert.throws(() => store.selectedInput(split.id, 'hello world', config));
});

test('translation accepts phrases and bilingual paragraphs while learning keeps its word boundary', () => {
  for (const text of ['a long sentence.\nA second paragraph.', '今天学习英语。\n明天继续！', 'hello 世界']) {
    assert.equal(classifyInput(text, config, 'translation').text, text);
    assert.throws(() => classifyInput(text, config, 'learning'));
  }
  assert.equal(classifyInput('a'.repeat(10000), config, 'translation').text.length, 10000);
  assert.throws(() => classifyInput('a'.repeat(10001), config, 'translation'));
  assert.throws(() => classifyInput('123', config, 'translation'));
  assert.throws(() => classifyInput('apple', config, 'invalid'));
});

test('history stays separate; selected words persist and cannot be added twice or invented', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbridge-modes-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new LearningStore(directory);
  store.setMode('translation');
  const first = store.recordTranslation(classifyInput('I like apples.', config, 'translation'), '我喜欢苹果。');
  const second = store.recordTranslation(classifyInput('我喜欢苹果。', config, 'translation'), 'I like apples.');
  assert.notEqual(first.id, second.id);
  assert.equal(store.snapshot().words.length, 0);
  assert.throws(() => store.selectedInput(first.id, 'banana', config));
  assert.throws(() => store.selectedInput('missing', 'apples', config));
  assert.throws(() => store.selectedInput(first.id, 'app', config));
  const input = store.selectedInput(second.id, 'Apples', config);
  assert.equal(store.snapshot().words.length, 0, 'selection alone must not save');
  store.record(input, '苹果（复数）', new Date(), true);
  assert.throws(() => store.selectedInput(first.id, 'apples', config));
  assert.throws(() => store.record(input, 'duplicate', new Date(), true));
  const restored = new LearningStore(directory).snapshot();
  assert.equal(restored.mode, 'translation');
  assert.deepEqual(restored.personalKeys, ['en:apples']);
  assert.equal(restored.words[0].count, 1);
  assert.equal(restored.translations.length, 2);
});

test('old learning data loads; invalid history is reported without overwriting data', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbridge-migration-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'learning.json');
  const old = { version: 1, prompt: 'original prompt', words: [], libraries: [] };
  fs.writeFileSync(file, JSON.stringify(old));
  const store = new LearningStore(directory);
  assert.equal(store.snapshot().mode, 'learning');
  assert.equal(store.snapshot().prompt, old.prompt);
  const broken = JSON.stringify({ ...old, translations: [{}] });
  fs.writeFileSync(file, broken);
  assert.throws(() => new LearningStore(directory));
  assert.equal(fs.readFileSync(file, 'utf8'), broken);
});

test('sentence requests set the correct target and treat source text as data', async () => {
  for (const [text, language, expected] of [['Translate this sentence.', 'en', '翻译这句话。'], ['翻译这句话。', 'zh', 'Translate this sentence.']]) {
    const input = classifyInput(text, config, 'translation');
    const result = await translate(input, 'word-only custom format', {
      baseUrl: 'https://translation.example/v1', model: 'test', requireKey: false, timeoutMs: 1000, maxResponseBytes: 1024,
    }, { fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(JSON.parse(body.messages[1].content), { sourceLanguage: language, targetLanguage: language === 'en' ? 'zh' : 'en', text });
      assert.match(body.messages[0].content, /只返回译文/);
      assert.equal(body.messages[0].content.includes('word-only custom format'), false);
      return new Response(JSON.stringify({ choices: [{ message: { content: expected } }] }));
    } });
    assert.equal(result, expected);
  }
});
