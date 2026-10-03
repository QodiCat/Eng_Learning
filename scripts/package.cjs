const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const { packager } = await import('@electron/packager');
  const target = path.resolve(__dirname, '..', 'dist', 'WordBridge-win32-x64');
  const outputRoot = path.resolve(__dirname, '..', 'dist');
  if (path.dirname(target) !== outputRoot) throw new Error('Invalid build output directory');
  const configPath = path.join(target, '.env');
  const existingConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath) : null;
  const directories = await packager({
    dir: path.join(__dirname, '..'), name: 'WordBridge', platform: 'win32', arch: 'x64',
    out: path.join(__dirname, '..', 'dist'), overwrite: true, asar: false,
    ignore: [/^\/\.(?:git|agents|product)(?:\/|$)/, /^\/\.env(?:\.|$)(?!example$)/, /^\/(?:artifacts|test|dist)(?:\/|$)/, /^\/AGENTS\.md$/],
    prune: true,
  });
  for (const directory of directories) {
    fs.copyFileSync(path.join(__dirname, '..', '.env.example'), path.join(directory, '.env.example'));
    if (existingConfig) fs.writeFileSync(path.join(directory, '.env'), existingConfig);
    else fs.copyFileSync(path.join(__dirname, '..', '.env.example'), path.join(directory, '.env'));
    console.log(`Windows portable app: ${directory}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
