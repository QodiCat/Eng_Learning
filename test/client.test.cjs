const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { translate } = require('../src/translation/client.cjs');
const config = { baseUrl: 'https://provider.example/v1', model: 'test-model', apiKey: 'test-only-secret', requireKey: true, timeoutMs: 1000, maxResponseBytes: 1024 };
const input = { text: 'apple', language: 'en', key: 'en:apple' };

test('compatible service receives the exact model, prompt and user input through HTTP', async t => {
  let received;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received = { url: req.url, authorization: req.headers.authorization, body: JSON.parse(body) };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: '苹果' }, finish_reason: 'stop' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const local = { ...config, baseUrl: `http://127.0.0.1:${server.address().port}/v1` };
  assert.equal(await translate(input, 'custom prompt', local), '苹果');
  assert.equal(received.url, '/v1/chat/completions');
  assert.equal(received.authorization, 'Bearer test-only-secret');
  assert.deepEqual(received.body, { model: 'test-model', stream: false, messages: [{ role: 'system', content: 'custom prompt' }, { role: 'user', content: 'apple' }] });
});

test('configuration errors prevent sending any request', async () => {
  let called = false;
  await assert.rejects(translate(input, 'prompt', { ...config, apiKey: '' }, { fetchImpl: () => { called = true; } }), /翻译设置.*API 密钥/);
  assert.equal(called, false);
});

test('Chinese words request English translation through the same HTTP client', async t => {
  const { classifyInput } = require('../src/translation/input.cjs');
  let received;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: 'apple' } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const chinese = classifyInput('苹果', { maxInputLength: 200, allowChineseSentences: false });
  const translated = await translate(chinese, 'Keep examples concise.', { ...config, baseUrl: `http://127.0.0.1:${server.address().port}/v1` });
  assert.equal(translated, 'apple');
  assert.deepEqual(JSON.parse(received.messages[1].content), { sourceLanguage: 'zh', targetLanguage: 'en', text: '苹果' });
  assert.match(received.messages[0].content, /中文词语.*英文/);
  assert.ok(received.messages[0].content.startsWith('Keep examples concise.'));
});

test('raw authorization matches services that require an unprefixed credential', async () => {
  let authorization;
  const result = await translate(input, 'prompt', { ...config, authScheme: 'raw' }, {
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return new Response(JSON.stringify({ choices: [{ message: { content: '苹果' } }] }));
    },
  });
  assert.equal(authorization, config.apiKey);
  assert.equal(result, '苹果');
});

test('Chinese command-like words stay data and Chinese-only replies fail explicitly', async () => {
  let body;
  const chinese = { text: '翻译', language: 'zh', key: 'zh:翻译' };
  const fetchImpl = async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '请提供需要翻译的文本。' } }] }));
  };
  await assert.rejects(translate(chinese, 'Only explain Chinese meanings.', config, { fetchImpl }), /没有返回英文译文/);
  assert.equal(JSON.parse(body.messages[1].content).text, '翻译');
  assert.match(body.messages[0].content, /首行直接给出对应英文/);
});

test('HTTP errors are explicit without echoing response secrets', async () => {
  await assert.rejects(translate(input, 'prompt', config, { fetchImpl: async () => new Response('test-only-secret', { status: 401 }) }), error => error.message.includes('401') && !error.message.includes('test-only-secret'));
});

test('connection errors show safe causes without exposing raw error details', async () => {
  for (const code of ['UND_ERR_CONNECT_TIMEOUT', 'ENOTFOUND', 'ECONNREFUSED', 'CERT_HAS_EXPIRED']) {
    const error = new TypeError('fetch failed', { cause: Object.assign(new Error(config.apiKey), { code }) });
    await assert.rejects(translate(input, 'prompt', config, { fetchImpl: async () => { throw error; } }),
      failure => failure.message.includes(code) && !failure.message.includes(config.apiKey));
  }
  const programmingError = new TypeError('unexpected implementation error');
  await assert.rejects(translate(input, 'prompt', config, { fetchImpl: async () => { throw programmingError; } }),
    error => error === programmingError);
});

test('invalid, empty, truncated and oversized responses never look successful', async () => {
  for (const body of ['invalid', '{}', '{"choices":[{"message":{"content":""}}]}', JSON.stringify({ choices: [{ message: { content: 'partial' }, finish_reason: 'length' }] }), 'x'.repeat(2048)]) {
    await assert.rejects(translate(input, 'prompt', config, { fetchImpl: async () => new Response(body) }));
  }
});

test('cancellation and timeout surface distinct recoverable errors', async () => {
  const waitingFetch = (_url, options) => new Promise((_resolve, reject) => {
    if (options.signal.aborted) reject(options.signal.reason);
    else options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  });
  const controller = new AbortController();
  const pending = translate(input, 'prompt', config, { signal: controller.signal, fetchImpl: waitingFetch });
  controller.abort();
  await assert.rejects(pending, /已取消/);
  const keepAlive = setTimeout(() => {}, 500);
  try { await assert.rejects(translate(input, 'prompt', { ...config, timeoutMs: 10 }, { fetchImpl: waitingFetch }), /超时/); }
  finally { clearTimeout(keepAlive); }
});
