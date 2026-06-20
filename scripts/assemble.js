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

function safeLoadJson(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) { /* skip unreadable files */ }
  return null;
}

// Ingest B-admin sample data
const bAdminDir = path.join(rootDir, 'deliverables', 'b-admin');
const bDashboard = safeLoadJson(path.join(bAdminDir, 'dashboard-overview.sample.json'));
const bProjections = safeLoadJson(path.join(bAdminDir, 'projection-status.sample.json'));
const bPublished = safeLoadJson(path.join(bAdminDir, 'published-artifacts.sample.json'));
const bAuditLogs = safeLoadJson(path.join(bAdminDir, 'audit-log.sample.json'));
const bUserRoles = safeLoadJson(path.join(bAdminDir, 'user-roles.sample.json'));
const bProfileCompletion = safeLoadJson(path.join(bAdminDir, 'profile-completion.sample.json'));
const bSystemConfig = safeLoadJson(path.join(bAdminDir, 'system-config.sample.json'));

const dashboard = {
  ...(authorityMock.dashboard || {}),
  ...((bDashboard && bDashboard.overview) ? bDashboard.overview : {}),
  totalUsers: (bUserRoles && bUserRoles.roleStatistics) ? bUserRoles.roleStatistics.totalUsers : (authorityMock.dashboard && authorityMock.dashboard.totalUsers) || 0,
  activeRaces: (bDashboard && bDashboard.overview) ? bDashboard.overview.activeRaces : (authorityMock.dashboard && authorityMock.dashboard.activeRaces) || 0,
  raceStatusDistribution: (bDashboard && bDashboard.raceStatusDistribution) ? bDashboard.raceStatusDistribution : {},
  caHealth: (bDashboard && bDashboard.caHealth) ? bDashboard.caHealth : {},
  performance: (bDashboard && bDashboard.performance) ? bDashboard.performance : {},
  topRaces: (bDashboard && bDashboard.topRaces) ? bDashboard.topRaces : []
};

const assembledView = {
  generatedAt: new Date().toISOString(),
  source: 'scripts/assemble.js',
  races: authorityMock.races || [],
  liveProjections: authorityMock.liveProjections || [],
  works: authorityMock.works || [],
  awards: authorityMock.awards || [],
  reviews: authorityMock.reviews || [],
  profiles: authorityMock.profiles || [],
  dashboard,
  projectionStatuses: (bProjections && bProjections.projections) ? bProjections.projections : [],
  publishedArtifacts: (bPublished && bPublished.artifacts) ? bPublished.artifacts : [],
  auditLogs: (bAuditLogs && bAuditLogs.logs) ? bAuditLogs.logs : [],
  systemConfigs: (bSystemConfig && bSystemConfig.configs) ? bSystemConfig.configs : [],
  userRoles: (bUserRoles && bUserRoles.users) ? bUserRoles.users : [],
  profileCompletion: (bProfileCompletion && bProfileCompletion.users) ? bProfileCompletion.users : [],
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