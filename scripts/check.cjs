const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
let failed = false;
function check(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) check(file);
    else if (/\.(cjs|js)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) { console.error(result.stderr || result.error?.message); failed = true; }
      if (fs.readFileSync(file, 'utf8').split('\n').length > 500) { console.error(`${file}: exceeds 500 lines`); failed = true; }
    }
  }
}
for (const directory of ['src', 'scripts', 'test']) check(directory);
if (failed) process.exitCode = 1;
else console.log('JavaScript syntax and source line limits passed.');
