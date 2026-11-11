// Rebuild import files from the pinned upstream Git tree downloaded locally.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseLibrary } = require('../src/learning/import.cjs');
const { readConfig } = require('../src/config.cjs');
const directory = path.join(__dirname, '..', 'resources', 'vocabulary');
const tree = JSON.parse(fs.readFileSync(path.join(directory, 'source', 'tree.json'), 'utf8'));
if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete upstream tree');
const config = readConfig(path.join(__dirname, '..'));
const report = { commit: tree.sha, lists: [] };
for (const category of ['CET4', 'CET6', 'IELTS', 'TOEFL']) {
  const prefix = `${category}/images/`;
  const entries = tree.tree.filter(item => item.type === 'blob' && item.path.startsWith(prefix) && item.path.endsWith('.png'));
  if (!entries.length) throw new Error(`Missing ${category}`);
  const words = new Set();
  const rejected = [];
  for (const item of entries) {
    const word = item.path.slice(prefix.length, -4);
    try { words.add(parseLibrary(word, '.txt', config)[0].slice(3)); }
    catch (error) { rejected.push({ word, reason: error.message }); }
  }
  const text = [...words].sort().join('\n') + '\n';
  const parsed = parseLibrary(text, '.txt', config);
  if (parsed.length !== words.size || Buffer.byteLength(text) > config.maxImportBytes) throw new Error(`Invalid ${category} output`);
  fs.writeFileSync(path.join(directory, `${category}.txt`), text);
  report.lists.push({ category, sourceEntries: entries.length, imported: words.size, duplicates: entries.length - rejected.length - words.size, rejected, sha256: crypto.createHash('sha256').update(text).digest('hex') });
}
fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.lists.map(item => `${item.category}: ${item.imported} words, ${item.rejected.length} excluded`).join('\n'));
