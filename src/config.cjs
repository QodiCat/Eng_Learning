const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

function readConfig(directory, environment = process.env) {
  const example = parseEnv(fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8'));
  const file = path.join(directory, '.env');
  const local = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  const values = { ...example, ...local };
  for (const key of Object.keys(example)) {
    if (environment[key] !== undefined) values[key] = environment[key];
  }
  const number = (name, minimum, maximum) => {
    const result = Number(values[name]);
    if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
      throw new Error(`${name} 必须为 ${minimum}–${maximum} 之间的整数。`);
    }
    return result;
  };
  const boolean = name => {
    if (!['true', 'false'].includes(values[name])) throw new Error(`${name} 必须是 true 或 false。`);
    return values[name] === 'true';
  };
  if (values.DATA_DIRECTORY && !path.isAbsolute(values.DATA_DIRECTORY)) {
    throw new Error('DATA_DIRECTORY 必须为绝对路径。');
  }
  return {
    file, baseUrl: values.AI_BASE_URL.trim(), model: values.AI_MODEL.trim(),
    apiKey: values.AI_API_KEY.trim(), requireKey: boolean('AI_REQUIRE_KEY'),
    timeoutMs: number('AI_TIMEOUT_MS', 100, 300000),
    maxResponseBytes: number('AI_MAX_RESPONSE_BYTES', 1024, 10485760),
    shortcut: values.TRANSLATE_SHORTCUT.trim(),
    captureTimeoutMs: number('CAPTURE_TIMEOUT_MS', 100, 10000),
    captureProcessTimeoutMs: number('CAPTURE_PROCESS_TIMEOUT_MS', 12000, 60000),
    maxInputLength: number('MAX_INPUT_LENGTH', 1, 10000),
    maxImportBytes: number('MAX_IMPORT_BYTES', 1, 52428800),
    allowChineseSentences: boolean('ALLOW_CHINESE_SENTENCES'),
    dataDirectory: values.DATA_DIRECTORY,
  };
}

function endpoint(config) {
  if (!config.baseUrl) throw new Error('请在 .env 中填写 AI_BASE_URL。');
  let url;
  try { url = new URL(config.baseUrl); } catch { throw new Error('AI_BASE_URL 不是有效地址。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('AI_BASE_URL 必须是无账号、查询参数或片段的 HTTP(S) 地址。');
  }
  if (/\/chat\/completions\/?$/.test(url.pathname)) throw new Error('AI_BASE_URL 只填写 API 前缀，不包含 /chat/completions。');
  if (!config.model) throw new Error('请在 .env 中填写 AI_MODEL。');
  if (config.requireKey && !config.apiKey) throw new Error('请在本地 .env 中填写 AI_API_KEY。');
  url.pathname = `${url.pathname.replace(/\/$/, '')}/chat/completions`;
  return url;
}

function publicConfig(config) {
  let issue = '';
  try { endpoint(config); } catch (error) { issue = error.message; }
  return {
    file: config.file, model: config.model, shortcut: config.shortcut,
    configured: !issue, issue, keyConfigured: Boolean(config.apiKey),
    maxInputLength: config.maxInputLength,
  };
}

module.exports = { readConfig, endpoint, publicConfig };
