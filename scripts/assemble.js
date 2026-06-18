const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimeDir = path.join(rootDir, 'runtime-data');
const authorityMockPath = path.join(runtimeDir, 'authority-mock.json');
const assembledViewPath = path.join(runtimeDir, 'assembled-view.json');
const compatibilityReportPath = path.join(runtimeDir, 'compatibility-report.json');
const groups = ['a-rider', 'b-admin', 'c-frontend', 'd-data'];

fs.mkdirSync(runtimeDir, { recursive: true });

if (!fs.existsSync(authorityMockPath)) {
  console.error('Missing runtime-data/authority-mock.json. Run npm run setup first.');
  process.exit(1);
}

const authorityMock = JSON.parse(fs.readFileSync(authorityMockPath, 'utf8'));
const manifests = [];
const warnings = [];

for (const group of groups) {
  const manifestPath = path.join(rootDir, 'deliverables', group, 'handoff.manifest.json');
  if (!fs.existsSync(manifestPath)) {
    warnings.push(`Missing manifest for ${group}: ${manifestPath}`);
    continue;
  }

  try {
    manifests.push(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  } catch (error) {
    warnings.push(`Invalid manifest JSON for ${group}: ${error.message}`);
  }
}

const assembledView = {
  generatedAt: new Date().toISOString(),
  source: 'scripts/assemble.js',
  races: authorityMock.races || [],
  liveProjections: authorityMock.liveProjections || [],
  works: authorityMock.works || [],
  awards: authorityMock.awards || [],
  reviews: authorityMock.reviews || [],
  profiles: authorityMock.profiles || [],
  dashboard: authorityMock.dashboard || {},
  manifests
};

const compatibilityReport = {
  generatedAt: assembledView.generatedAt,
  ok: warnings.length === 0,
  warnings,
  manifestCount: manifests.length,
  runtimeFiles: { authorityMockPath, assembledViewPath }
};

fs.writeFileSync(assembledViewPath, JSON.stringify(assembledView, null, 2));
fs.writeFileSync(compatibilityReportPath, JSON.stringify(compatibilityReport, null, 2));
console.log(JSON.stringify({ assembledViewPath, compatibilityReportPath, warnings }, null, 2));