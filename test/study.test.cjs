const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { LearningStore } = require('../src/learning/store.cjs');

test('study persists independently; retries and failed writes do not add counts', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbridge-study-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new LearningStore(directory);
  store.record({ key: 'en:apple', text: 'apple', language: 'en' }, '苹果');
  assert.equal(store.snapshot().words[0].studyCount, 0);
  const id = randomUUID();
  store.study('en:apple', id);
  store.study('en:apple', id);
  assert.equal(store.snapshot().words[0].studyCount, 1);
  store.study('en:apple', randomUUID());
  const restored = new LearningStore(directory).snapshot().words[0];
  assert.equal(restored.studyCount, 2);
  assert.equal(restored.count, 1);
  assert.deepEqual(restored.reviewedDays, []);
  assert.throws(() => store.study('missing', randomUUID()));
  assert.throws(() => store.study('en:apple', 'invalid'));
  store.file = directory;
  assert.throws(() => store.study('en:apple', randomUUID()));
  assert.equal(store.snapshot().words[0].studyCount, 2);
});
