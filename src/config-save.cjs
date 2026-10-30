const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { readConfig, endpoint } = require('./config.cjs');

function quote(value) {
  if (/[\r\n\0]/.test(value)) throw new Error('配置内容不能包含换行或空字符。');
  const delimiter = ['"', "'", '`'].find(mark => !value.includes(mark));
  if (!delimiter) throw new Error('配置内容不能同时包含三种引号。');
  return `${delimiter}${value}${delimiter}`;
}

function saveServiceConfig(directory, input, environment = process.env) {
  if (!input || typeof input !== 'object' ||
      ['baseUrl', 'model', 'apiKey'].some(key => typeof input[key] !== 'string') ||
      typeof input.requireKey !== 'boolean' || typeof input.clearKey !== 'boolean') {
    throw new Error('服务配置格式无效。');
  }
  const file = path.join(directory, '.env');
  const local = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  const changes = {
    AI_BASE_URL: input.baseUrl.trim(), AI_MODEL: input.model.trim(),
    AI_REQUIRE_KEY: String(input.requireKey),
    AI_API_KEY: input.clearKey ? '' : input.apiKey.trim() || local.AI_API_KEY || '',
  };
  for (const key of Object.keys(changes)) {
    if (environment[key] !== undefined) throw new Error(`${key} 被进程环境变量覆盖，请移除该环境变量后重启再保存。`);
  }
  const next = readConfig(directory, { ...environment, ...changes });
  endpoint(next);
  writeChanges(file, local, changes);
  return next;
}

function writeChanges(file, local, changes) {
  const content = Object.entries({ ...local, ...changes }).map(([key, value]) => `${key}=${quote(value)}`).join('\n') + '\n';
  const temporary = `${file}.${process.pid}.tmp`;
  let written = false;
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600 });
    written = true;
    fs.renameSync(temporary, file);
  } catch {
    throw new Error('配置保存失败，请检查本地配置目录的写入权限。原配置未生效变更。');
  } finally {
    if (written && fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function saveShortcutConfig(directory, value, shortcuts, callback, current, environment = process.env) {
  if (typeof value !== 'string' || !value.trim() || /[\r\n\0]/.test(value)) throw new Error('请填写有效的快捷键，例如 Ctrl+Alt+E。');
  if (environment.TRANSLATE_SHORTCUT !== undefined) throw new Error('快捷键被进程环境变量覆盖，请移除 TRANSLATE_SHORTCUT 后重启。');
  const shortcut = value.trim();
  const file = path.join(directory, '.env');
  const local = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  const next = readConfig(directory, { ...environment, TRANSLATE_SHORTCUT: shortcut });
  const alreadyRegistered = shortcuts.isRegistered(shortcut);
  if (!alreadyRegistered) {
    let registered = false;
    try { registered = shortcuts.register(shortcut, callback); } catch { /* Invalid accelerator is reported below. */ }
    if (!registered) throw new Error('快捷键无效或已被其他程序占用，请换一个组合。');
  }
  try { writeChanges(file, local, { TRANSLATE_SHORTCUT: shortcut }); }
  catch (error) {
    if (!alreadyRegistered) shortcuts.unregister(shortcut);
    throw error;
  }
  if (current && current !== shortcut) shortcuts.unregister(current);
  return next;
}

module.exports = { saveServiceConfig, saveShortcutConfig };
