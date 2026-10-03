const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { classifyInput } = require('../src/translation/input.cjs');
const { parseLibrary } = require('../src/learning/import.cjs');
const { LearningStore, dayKey } = require('../src/learning/store.cjs');
const { readConfig, endpoint, publicConfig } = require('../src/config.cjs');
const settings = { maxInputLength: 200, allowChineseSentences: false };

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbridge-test-'));
  t.after(() => {
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(directory));
    assert.ok(relative.startsWith('wordbridge-test-') && !relative.includes(path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test('input normalization keeps a single-word boundary and separates language keys', () => {
  assert.equal(classifyInput(' “Apple,” ', settings).key, 'en:apple');
  assert.equal(classifyInput('well-known', settings).key, 'en:well-known');
  assert.equal(classifyInput('数据库', settings).key, 'zh:数据库');
  assert.equal(classifyInput('学习英语', settings).language, 'zh');
  for (const input of ['', 'take off', 'I like apples.', 'hello 世界', '今天很好。']) assert.throws(() => classifyInput(input, settings));
  assert.equal(classifyInput('今天很好。', { ...settings, allowChineseSentences: true }).language, 'zh');
  assert.throws(() => classifyInput('x'.repeat(201), settings));
});

test('word counts survive restart, duplicate daily entries collapse, review is per day', t => {
  const directory = temporary(t);
  let store = new LearningStore(directory);
  const input = classifyInput('Apple', settings);
  const firstDay = new Date(2026, 9, 1, 12);
  const secondDay = new Date(2026, 9, 2, 12);
  const first = store.record(input, '苹果', firstDay);
  assert.equal(first.previousCount, 0);
  store.record(classifyInput('apple', settings), '苹果', firstDay);
  store.review(input.key, dayKey(firstDay), true);
  store.record(input, '苹果；苹果树', secondDay);
  store = new LearningStore(directory);
  const word = store.snapshot().words[0];
  assert.equal(word.count, 3);
  assert.equal(word.days.length, 2);
  assert.deepEqual(word.reviewedDays, [dayKey(firstDay)]);
  store.review(input.key, dayKey(firstDay), false);
  assert.deepEqual(store.snapshot().words[0].reviewedDays, []);
  assert.throws(() => store.review(input.key, '2020-01-01', true));
  assert.equal(store.snapshot().words[0].count, 3);
});

test('library import deduplicates case and allows multiple sources without invented tags', t => {
  const store = new LearningStore(temporary(t));
  const keys = parseLibrary('\uFEFFApple\napple\nbook\n', '.txt', settings);
  assert.deepEqual(keys, ['en:apple', 'en:book']);
  store.importLibrary('四级', keys);
  store.importLibrary('雅思', parseLibrary('["apple"]', '.json', settings));
  assert.deepEqual(store.sources('en:apple'), ['四级', '雅思']);
  assert.deepEqual(store.sources('en:unknown'), []);
  assert.throws(() => store.importLibrary('四级', ['en:other']));
  assert.equal(store.snapshot().libraries.length, 2);
  for (const content of ['apple\ntwo words', 'apple\n苹果']) assert.throws(() => parseLibrary(content, '.txt', settings));
  assert.throws(() => parseLibrary('["apple", 2]', '.json', settings));
});

test('corrupt data is surfaced and never silently replaced', t => {
  const directory = temporary(t);
  const file = path.join(directory, 'learning.json');
  fs.writeFileSync(file, '{broken');
  assert.throws(() => new LearningStore(directory), /原文件未覆盖/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});

test('failed persistence does not change in-memory counts', t => {
  const directory = temporary(t);
  const store = new LearningStore(directory);
  fs.mkdirSync(store.file);
  assert.throws(() => store.record(classifyInput('apple', settings), '苹果'), /未生效/);
  assert.equal(store.snapshot().words.length, 0);
});

test('local config overrides defaults, environment overrides local, secrets are not exposed', t => {
  const directory = temporary(t);
  fs.writeFileSync(path.join(directory, '.env'), 'AI_BASE_URL=https://provider.example/v1\nAI_MODEL=test-model\nAI_API_KEY=test-only-secret\nAI_TIMEOUT_MS=2000\n');
  const config = readConfig(directory, { AI_TIMEOUT_MS: '3000' });
  assert.equal(config.timeoutMs, 3000);
  assert.equal(endpoint(config).href, 'https://provider.example/v1/chat/completions');
  assert.equal(JSON.stringify(publicConfig(config)).includes('test-only-secret'), false);
  assert.throws(() => endpoint({ ...config, baseUrl: 'https://provider.example/v1/chat/completions' }));
  assert.throws(() => endpoint({ ...config, baseUrl: 'https://user:password@provider.example' }));
  assert.throws(() => readConfig(directory, { AI_TIMEOUT_MS: 'garbage' }));
  assert.throws(() => readConfig(directory, { ALLOW_CHINESE_SENTENCES: 'maybe' }));
});
