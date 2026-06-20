const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimeDir = path.join(rootDir, 'runtime-data');
const dDataAuthorityMockPath = path.join(rootDir, 'deliverables', 'd-data', 'authority-mock.json');
const authorityMockPath = path.join(runtimeDir, 'authority-mock.json');
const assembledViewPath = path.join(runtimeDir, 'assembled-view.json');
const compatibilityReportPath = path.join(runtimeDir, 'compatibility-report.json');
const groups = ['a-rider', 'b-admin', 'c-frontend', 'd-data'];

fs.mkdirSync(runtimeDir, { recursive: true });

const effectiveAuthorityMockPath = fs.existsSync(dDataAuthorityMockPath) ? dDataAuthorityMockPath : authorityMockPath;

if (!fs.existsSync(effectiveAuthorityMockPath)) {
  console.error('Missing authority mock. Run npm run setup first or provide deliverables/d-data/authority-mock.json.');
  process.exit(1);
}

const authorityMock = JSON.parse(fs.readFileSync(effectiveAuthorityMockPath, 'utf8'));

// Keep runtime-data aligned with the effective source consumed by the app API.
fs.writeFileSync(authorityMockPath, JSON.stringify(authorityMock, null, 2));
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

function normalizeCaStatusValue(status) {
  if (status === 'connected') return 'handshaken';
  return status || 'not_configured';
}

function buildCaStatuses(authorityMockData, bAdminCaStatusData) {
  const authorityCaStatuses = Array.isArray(authorityMockData.caStatuses) ? authorityMockData.caStatuses : [];
  const bAdminRaces = (bAdminCaStatusData && Array.isArray(bAdminCaStatusData.races)) ? bAdminCaStatusData.races : [];

  if (!authorityCaStatuses.length) {
    return bAdminRaces.map((race) => ({
      ...race,
      aggregateStatus: normalizeCaStatusValue(race.aggregateStatus),
      connections: Array.isArray(race.connections)
        ? race.connections.map((connection) => ({
          ...connection,
          ingestionStatus: normalizeCaStatusValue(connection.ingestionStatus)
        }))
        : []
    }));
  }

  const raceTitleById = new Map((authorityMockData.races || []).map((race) => [race.id, race.title]));
  const bAdminRaceById = new Map(bAdminRaces.map((race) => [race.raceId, race]));
  const groupedConnections = new Map();

  for (const connection of authorityCaStatuses) {
    const raceId = connection.raceId;
    if (!groupedConnections.has(raceId)) groupedConnections.set(raceId, []);

    const bAdminRace = bAdminRaceById.get(raceId);
    const bAdminConnection = bAdminRace && Array.isArray(bAdminRace.connections)
      ? bAdminRace.connections.find((candidate) => candidate.riderId === connection.riderId)
      : null;

    const ingestionStatus = normalizeCaStatusValue(connection.health || (bAdminConnection && bAdminConnection.ingestionStatus));
    const riskNote = connection.riskNote || (bAdminConnection && bAdminConnection.anomalyNote) || null;

    groupedConnections.get(raceId).push({
      caConnectionId: (bAdminConnection && bAdminConnection.caConnectionId) || `${raceId}:${connection.riderId}`,
      riderId: connection.riderId,
      riderName: connection.riderName,
      caType: (bAdminConnection && bAdminConnection.caType) || connection.provider || '--',
      ingestionStatus,
      registeredAt: (bAdminConnection && bAdminConnection.registeredAt) || null,
      lastSyncedAt: connection.lastSignalAt || (bAdminConnection && bAdminConnection.lastSyncedAt) || null,
      sessionCount: (bAdminConnection && bAdminConnection.sessionCount) || null,
      failureReason: ingestionStatus === 'failed' ? (riskNote || (bAdminConnection && bAdminConnection.failureReason) || null) : null,
      flaggedAnomaly: Boolean((bAdminConnection && bAdminConnection.flaggedAnomaly) || (riskNote && ingestionStatus !== 'failed' && ingestionStatus !== 'not_configured')),
      anomalyNote: riskNote
    });
  }

  return Array.from(groupedConnections.entries()).map(([raceId, connections]) => {
    const bAdminRace = bAdminRaceById.get(raceId);
    const configuredCount = connections.filter((connection) => !['not_configured', 'disabled'].includes(connection.ingestionStatus)).length;
    const activeCount = connections.filter((connection) => connection.ingestionStatus === 'active').length;
    const failedCount = connections.filter((connection) => connection.ingestionStatus === 'failed').length;
    const notConfiguredCount = connections.filter((connection) => connection.ingestionStatus === 'not_configured').length;
    const aggregateStatus = bAdminRace
      ? normalizeCaStatusValue(bAdminRace.aggregateStatus)
      : (failedCount > 0 && activeCount === 0 ? 'degraded' : activeCount > 0 ? 'active' : 'failed');

    return {
      raceId,
      raceTitle: (bAdminRace && bAdminRace.raceTitle) || raceTitleById.get(raceId) || raceId,
      aggregateStatus,
      totalRegistrations: (bAdminRace && bAdminRace.totalRegistrations) || connections.length,
      totalRaceProjects: (bAdminRace && bAdminRace.totalRaceProjects) || connections.length,
      configuredCount,
      activeCount,
      failedCount,
      notConfiguredCount,
      connections
    };
  });
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
const bCaStatus = safeLoadJson(path.join(bAdminDir, 'ca-status.sample.json'));
const caStatuses = buildCaStatuses(authorityMock, bCaStatus);

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
  authorityMockSource: path.relative(rootDir, effectiveAuthorityMockPath).replace(/\\/g, '/'),
  races: authorityMock.races || [],
  liveProjections: authorityMock.liveProjections || [],
  works: authorityMock.works || [],
  results: authorityMock.results || [],
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
  caStatuses,
  manifests
};

const compatibilityReport = {
  generatedAt: assembledView.generatedAt,
  ok: warnings.length === 0,
  warnings,
  manifestCount: manifests.length,
  runtimeFiles: { authorityMockPath, assembledViewPath },
  authorityMockSource: path.relative(rootDir, effectiveAuthorityMockPath).replace(/\\/g, '/')
};

fs.writeFileSync(assembledViewPath, JSON.stringify(assembledView, null, 2));
fs.writeFileSync(compatibilityReportPath, JSON.stringify(compatibilityReport, null, 2));
console.log(JSON.stringify({ assembledViewPath, compatibilityReportPath, warnings }, null, 2));