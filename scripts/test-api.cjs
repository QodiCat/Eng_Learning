const path = require('node:path');
const { readConfig, endpoint } = require('../src/config.cjs');
const { translate, DEFAULT_PROMPT } = require('../src/translation/client.cjs');

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('用法：npm.cmd run test:api -- [测试单词]');
    console.log('读取项目根目录 .env（进程环境变量优先），发送一次真实请求，不写入学习记录。');
    return;
  }
  const config = readConfig(path.join(__dirname, '..'));
  endpoint(config);
  const text = args.join(' ').trim() || 'apple';
  console.log(`正在测试配置的模型（超时 ${config.timeoutMs} ms）…`);
  const started = performance.now();
  const result = await translate({ text }, DEFAULT_PROMPT, config);
  // Even a misbehaving service must not echo the configured credential.
  const safeResult = config.apiKey ? result.split(config.apiKey).join('[REDACTED]') : result;
  console.log(`API 调用成功，耗时 ${Math.round(performance.now() - started)} ms。`);
  console.log(safeResult);
}

main().catch(error => {
  console.error(`API 测试失败：${error.message}`);
  process.exitCode = 1;
});

