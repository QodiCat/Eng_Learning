const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateMnemonic } = require('../src/learning/mnemonic.cjs');
const { LearningStore } = require('../src/learning/store.cjs');

test('mnemonic treats words as data and persists without adding query or study counts', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbridge-memory-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new LearningStore(directory);
  store.record({ text: 'apple', key: 'en:apple', language: 'en' }, '苹果');
  const word = store.snapshot().words[0];
  const config = { baseUrl: 'https://translation.example/v1', model: 'test', requireKey: false, timeoutMs: 1000, maxResponseBytes: 4096 };
  const content = await generateMnemonic(word, config, { fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(body.messages[1].content), { word: 'apple', meaning: '苹果' });
    assert.match(body.messages[0].content, /不强行编造/);
    assert.match(body.messages[0].content, /不是标准发音/);
    return new Response(JSON.stringify({ choices: [{ message: { content: '画面联想：一颗红苹果。' } }] }));
  } });
  store.saveMnemonic(word.key, content);
  assert.throws(() => store.saveMnemonic(word.key, ''));
  assert.throws(() => store.saveMnemonic('missing', content));
  const saved = new LearningStore(directory).snapshot().words[0];
  assert.equal(saved.mnemonic, content);
  assert.equal(saved.count, word.count);
  assert.equal(saved.studyCount, 0);
  await assert.rejects(generateMnemonic(word, config, { fetchImpl: async () => new Response('', { status: 503 }) }), /HTTP 503/);
  assert.equal(store.snapshot().words[0].mnemonic, content);
});
