const path = require('node:path');
const fs = require('node:fs');
const { parseEnv } = require('node:util');

(async () => {
  const { packager } = await import('@electron/packager');
  const envPath = path.join(__dirname, '..', '.env');
  const local = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
  const electronZipDir = process.env.ELECTRON_ZIP_DIRECTORY ?? local.ELECTRON_ZIP_DIRECTORY;
  const target = path.resolve(__dirname, '..', 'dist', 'WordBridge-win32-x64');
  const outputRoot = path.resolve(__dirname, '..', 'dist');
  if (path.dirname(target) !== outputRoot) throw new Error('Invalid build output directory');
  const configPath = path.join(target, '.env');
  const existingConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath) : null;
  fs.mkdirSync(outputRoot, { recursive: true });
  const staging = fs.mkdtempSync(path.join(outputRoot, '.package-'));
  if (path.dirname(path.resolve(staging)) !== outputRoot) throw new Error('Invalid staging directory');
  try {
  const directories = await packager({
    dir: path.join(__dirname, '..'), name: 'WordBridge', platform: 'win32', arch: 'x64',
    out: staging, overwrite: true, asar: false,
    ...(electronZipDir ? { electronZipDir } : {}),
    ignore: [/^\/\.(?:git|agents|product)(?:\/|$)/, /^\/\.env(?:\.|$)(?!example$)/, /^\/(?:artifacts|test|dist)(?:\/|$)/, /^\/AGENTS\.md$/, /^\/test\.py$/],
    prune: true,
  });
  for (const directory of directories) {
    // Keep the destination directory itself: Windows may hold an Explorer/CWD
    // handle to it even after the old app exits. Never remove the local config.
    fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(target)) {
      if (name === '.env') continue;
      const entry = path.resolve(target, name);
      if (path.dirname(entry) !== target) throw new Error('Invalid package entry');
      fs.rmSync(entry, { recursive: true, force: true });
    }
    fs.cpSync(directory, target, { recursive: true });
    fs.copyFileSync(path.join(__dirname, '..', '.env.example'), path.join(target, '.env.example'));
    if (existingConfig) fs.writeFileSync(configPath, existingConfig);
    else fs.copyFileSync(path.join(target, '.env.example'), configPath);
    console.log(`Windows portable app: ${target}`);
  }
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
