const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const groups = ['a-rider', 'b-admin', 'c-frontend', 'd-data'];

const results = groups.map((group) => {
  const manifestPath = path.join(rootDir, 'deliverables', group, 'handoff.manifest.json');
  return { group, manifestPath, exists: fs.existsSync(manifestPath) };
});

const missing = results.filter((item) => !item.exists);
console.log(JSON.stringify({ ok: missing.length === 0, results }, null, 2));
if (missing.length > 0) {
  process.exitCode = 1;
}