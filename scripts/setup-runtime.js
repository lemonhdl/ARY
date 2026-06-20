const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimeDir = path.join(rootDir, 'runtime-data');
const sourceMockPath = fs.existsSync(path.join(rootDir, 'deliverables', 'd-data', 'authority-mock.json'))
  ? path.join(rootDir, 'deliverables', 'd-data', 'authority-mock.json')
  : path.join(rootDir, 'design-prototype', 'data', 'sample-races.json');
const authorityMockPath = path.join(runtimeDir, 'authority-mock.json');
const assembledViewPath = path.join(runtimeDir, 'assembled-view.json');
const compatibilityReportPath = path.join(runtimeDir, 'compatibility-report.json');

fs.mkdirSync(runtimeDir, { recursive: true });
fs.mkdirSync(path.join(runtimeDir, 'app-state'), { recursive: true });

if (!fs.existsSync(authorityMockPath)) {
  fs.writeFileSync(authorityMockPath, fs.readFileSync(sourceMockPath, 'utf8'));
  console.log(`Created runtime-data/authority-mock.json from ${path.relative(rootDir, sourceMockPath).replace(/\\/g, '/')}`);
}

if (!fs.existsSync(assembledViewPath)) {
  fs.writeFileSync(assembledViewPath, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'setup-runtime', races: [], dashboard: {}, manifests: [] }, null, 2));
}

if (!fs.existsSync(compatibilityReportPath)) {
  fs.writeFileSync(compatibilityReportPath, JSON.stringify({ generatedAt: new Date().toISOString(), ok: true, errors: [], warnings: ['Initial compatibility report placeholder created by setup-runtime'] }, null, 2));
}

console.log('Runtime setup complete');