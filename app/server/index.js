const http = require('node:http');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const rootDir = path.resolve(__dirname, '..', '..');
const webDir = path.join(rootDir, 'app', 'web');
const runtimeDir = path.join(rootDir, 'runtime-data');
const cFrontendPrototypeDir = path.join(rootDir, 'deliverables', 'c-frontend', 'app-shell', 'prototype');
const bAdminDir = path.join(rootDir, 'deliverables', 'b-admin');
const userRolesSamplePath = path.join(bAdminDir, 'user-roles.sample.json');
const auditLogSamplePath = path.join(bAdminDir, 'audit-log.sample.json');
const systemConfigSamplePath = path.join(bAdminDir, 'system-config.sample.json');
const projectionStatusSamplePath = path.join(bAdminDir, 'projection-status.sample.json');
const publishedArtifactsSamplePath = path.join(bAdminDir, 'published-artifacts.sample.json');
const caStatusSamplePath = path.join(bAdminDir, 'ca-status.sample.json');
const assembleScriptPath = path.join(rootDir, 'scripts', 'assemble.js');
const port = Number(process.env.PORT || 3000);
const cFrontendRouteFallbacks = new Set(['race', 'works', 'results', 'review', 'riders', 'cooperation', 'live', 'screen']);
const roleOrder = ['admin', 'organizer', 'judge', 'rider'];

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') {
        sendJson(res, 404, { error: 'Not found', filePath });
        return;
      }

      sendJson(res, 500, { error: 'Failed to read file', message: error.message });
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function serveRuntimeJson(res, fileName) {
  sendFile(res, path.join(runtimeDir, fileName));
}

function readRuntimeJson(fileName) {
  const filePath = path.join(runtimeDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
}

function parseRequestJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function normalizeRoles(roles) {
  const uniqueRoles = Array.from(new Set(Array.isArray(roles) ? roles.filter(Boolean) : []));
  return uniqueRoles.sort((left, right) => roleOrder.indexOf(left) - roleOrder.indexOf(right));
}

function hasRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

function resolveActingAdmin(actorUserId) {
  const userRolesData = readJson(userRolesSamplePath);
  const users = Array.isArray(userRolesData.users) ? userRolesData.users : [];
  const actingAdmin = users.find((candidate) => candidate.userId === actorUserId);

  if (!actingAdmin || !hasRole(actingAdmin, 'admin')) {
    return { users, actingAdmin: null };
  }

  return { users, actingAdmin };
}

function updateRoleStatistics(existingStatistics, previousRoles, nextRoles) {
  const statistics = {
    totalUsers: Number(existingStatistics?.totalUsers || 0),
    adminCount: Number(existingStatistics?.adminCount || 0),
    organizerCount: Number(existingStatistics?.organizerCount || 0),
    judgeCount: Number(existingStatistics?.judgeCount || 0),
    riderCount: Number(existingStatistics?.riderCount || 0),
    noRoleCount: Number(existingStatistics?.noRoleCount || 0),
    multiRoleCount: Number(existingStatistics?.multiRoleCount || 0)
  };

  for (const role of roleOrder) {
    if (previousRoles.includes(role) && !nextRoles.includes(role)) {
      statistics[`${role}Count`] = Math.max(0, statistics[`${role}Count`] - 1);
    }
    if (!previousRoles.includes(role) && nextRoles.includes(role)) {
      statistics[`${role}Count`] += 1;
    }
  }

  if (!previousRoles.length && nextRoles.length) statistics.noRoleCount = Math.max(0, statistics.noRoleCount - 1);
  if (previousRoles.length && !nextRoles.length) statistics.noRoleCount += 1;
  if (previousRoles.length <= 1 && nextRoles.length > 1) statistics.multiRoleCount += 1;
  if (previousRoles.length > 1 && nextRoles.length <= 1) statistics.multiRoleCount = Math.max(0, statistics.multiRoleCount - 1);

  return statistics;
}

function rebuildRuntimeData() {
  childProcess.execFileSync(process.execPath, [assembleScriptPath], {
    cwd: rootDir,
    stdio: 'pipe'
  });
}

function nextAuditLogId(logs) {
  const maxNumericSuffix = logs.reduce((currentMax, log) => {
    const match = String(log.logId || '').match(/log_(\d+)/);
    if (!match) return currentMax;
    return Math.max(currentMax, Number(match[1]));
  }, 0);
  return `log_${String(maxNumericSuffix + 1).padStart(3, '0')}`;
}

function appendAuditLogEntry(logs, req, entry) {
  const auditLogEntry = {
    ...entry,
    logId: nextAuditLogId(logs),
    ip: req.socket.remoteAddress || '--',
    userAgent: req.headers['user-agent'] || '--'
  };
  logs.unshift(auditLogEntry);
  return auditLogEntry;
}

async function handleUserRoleUpdate(req, res) {
  try {
    const body = await parseRequestJson(req);
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const roles = normalizeRoles(body.roles);

    if (!userId) {
      sendJson(res, 400, { error: 'Missing userId' });
      return;
    }

    if (!reason) {
      sendJson(res, 400, { error: 'Missing reason' });
      return;
    }

    const userRolesData = readJson(userRolesSamplePath);
    const users = Array.isArray(userRolesData.users) ? userRolesData.users : [];
    const user = users.find((candidate) => candidate.userId === userId);
    const actorUserId = typeof body.actorUserId === 'string' ? body.actorUserId.trim() : '';
    const actingAdmin = users.find((candidate) => candidate.userId === actorUserId);

    if (!user) {
      sendJson(res, 404, { error: 'User not found', userId });
      return;
    }

    if (!actingAdmin || !hasRole(actingAdmin, 'admin')) {
      sendJson(res, 403, { error: 'Acting admin is missing or unauthorized', actorUserId });
      return;
    }

    const previousRoles = normalizeRoles(user.roles);
    user.roles = roles;
    userRolesData.users = users;
    userRolesData.roleStatistics = updateRoleStatistics(userRolesData.roleStatistics, previousRoles, roles);

    const auditLogData = readJson(auditLogSamplePath);
    const logs = Array.isArray(auditLogData.logs) ? auditLogData.logs : [];
    const timestamp = new Date().toISOString();
    const auditLogEntry = appendAuditLogEntry(logs, req, {
      timestamp,
      actorUserId: actingAdmin.userId,
      actorGithubAccount: actingAdmin.githubAccount,
      actionType: 'role_change',
      targetResourceType: 'User',
      targetResourceId: userId,
      detail: {
        targetGithubAccount: user.githubAccount,
        previousRoles,
        newRoles: roles,
        reason
      },
      result: 'success'
    });

    auditLogData.logs = logs;

    writeJson(userRolesSamplePath, userRolesData);
    writeJson(auditLogSamplePath, auditLogData);
    rebuildRuntimeData();

    sendJson(res, 200, {
      ok: true,
      user,
      auditLog: auditLogEntry
    });
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to persist role change', message: error.message });
  }
}

async function handleSystemConfigUpdate(req, res) {
  try {
    const body = await parseRequestJson(req);
    const configKey = typeof body.configKey === 'string' ? body.configKey.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const actorUserId = typeof body.actorUserId === 'string' ? body.actorUserId.trim() : '';

    if (!configKey) {
      sendJson(res, 400, { error: 'Missing configKey' });
      return;
    }

    if (!reason) {
      sendJson(res, 400, { error: 'Missing reason' });
      return;
    }

    const { actingAdmin } = resolveActingAdmin(actorUserId);
    if (!actingAdmin || !hasRole(actingAdmin, 'admin')) {
      sendJson(res, 403, { error: 'Acting admin is missing or unauthorized', actorUserId });
      return;
    }

    const systemConfigData = readJson(systemConfigSamplePath);
    const configs = Array.isArray(systemConfigData.configs) ? systemConfigData.configs : [];
    const config = configs.find((candidate) => candidate.configKey === configKey);

    if (!config) {
      sendJson(res, 404, { error: 'Config not found', configKey });
      return;
    }

    const previousValue = config.configValue;
    const nextValue = body.configValue;
    config.configValue = nextValue;
    config.updatedAt = new Date().toISOString();
    config.updatedBy = actingAdmin.githubAccount;

    const auditLogData = readJson(auditLogSamplePath);
    const logs = Array.isArray(auditLogData.logs) ? auditLogData.logs : [];
    const auditLogEntry = appendAuditLogEntry(logs, req, {
      timestamp: config.updatedAt,
      actorUserId: actingAdmin.userId,
      actorGithubAccount: actingAdmin.githubAccount,
      actionType: 'config_update',
      targetResourceType: 'Config',
      targetResourceId: configKey,
      detail: {
        configKey,
        previousValue,
        newValue: nextValue,
        reason
      },
      result: 'success'
    });

    auditLogData.logs = logs;
    writeJson(systemConfigSamplePath, systemConfigData);
    writeJson(auditLogSamplePath, auditLogData);
    rebuildRuntimeData();

    sendJson(res, 200, {
      ok: true,
      config,
      auditLog: auditLogEntry
    });
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to persist config change', message: error.message });
  }
}

async function handleProjectionRebuild(req, res) {
  try {
    const body = await parseRequestJson(req);
    const actorUserId = typeof body.actorUserId === 'string' ? body.actorUserId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const raceId = typeof body.raceId === 'string' ? body.raceId.trim() : '';
    const projectionType = typeof body.projectionType === 'string' ? body.projectionType.trim() : '';
    const scope = typeof body.scope === 'string' ? body.scope.trim() : '';

    if (!reason) {
      sendJson(res, 400, { error: 'Missing reason' });
      return;
    }

    const { actingAdmin } = resolveActingAdmin(actorUserId);
    if (!actingAdmin) {
      sendJson(res, 403, { error: 'Acting admin is missing or unauthorized', actorUserId });
      return;
    }

    const projectionData = readJson(projectionStatusSamplePath);
    const projections = Array.isArray(projectionData.projections) ? projectionData.projections : [];
    let targets = [];

    if (raceId && projectionType) {
      targets = projections.filter((candidate) => candidate.raceId === raceId && candidate.projectionType === projectionType);
    } else if (raceId) {
      targets = projections.filter((candidate) => candidate.raceId === raceId);
    } else if (scope === 'failed' || scope === 'stale') {
      targets = projections.filter((candidate) => candidate.health === scope);
    } else if (scope === 'all') {
      targets = projections.slice();
    }

    if (!targets.length) {
      sendJson(res, 404, { error: 'No projections matched rebuild request', raceId, projectionType, scope });
      return;
    }

    const timestamp = new Date().toISOString();
    for (const projection of targets) {
      projection.health = 'healthy';
      projection.lastRebuiltAt = timestamp;
      projection.failureReason = null;
      projection.rebuildCount = Number(projection.rebuildCount || 0) + 1;
    }

    const auditLogData = readJson(auditLogSamplePath);
    const logs = Array.isArray(auditLogData.logs) ? auditLogData.logs : [];
    const projectionTypes = Array.from(new Set(targets.map((candidate) => candidate.projectionType)));
    const targetResourceId = raceId
      ? `${raceId}:${projectionType || projectionTypes.join(',')}`
      : `batch:${scope || 'custom'}`;
    const auditLogEntry = appendAuditLogEntry(logs, req, {
      timestamp,
      actorUserId: actingAdmin.userId,
      actorGithubAccount: actingAdmin.githubAccount,
      actionType: 'projection_rebuild',
      targetResourceType: 'Projection',
      targetResourceId,
      detail: {
        raceId: raceId || null,
        scope: raceId ? null : scope,
        projectionTypes,
        reason,
        result: 'success',
        rebuildDurationMs: 1200 + (targets.length * 180)
      },
      result: 'success'
    });

    auditLogData.logs = logs;
    writeJson(projectionStatusSamplePath, projectionData);
    writeJson(auditLogSamplePath, auditLogData);
    rebuildRuntimeData();

    sendJson(res, 200, {
      ok: true,
      projections: targets,
      auditLog: auditLogEntry
    });
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to rebuild projections', message: error.message });
  }
}

async function handleReportRegenerate(req, res) {
  try {
    const body = await parseRequestJson(req);
    const actorUserId = typeof body.actorUserId === 'string' ? body.actorUserId.trim() : '';
    const artifactId = typeof body.artifactId === 'string' ? body.artifactId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!artifactId) {
      sendJson(res, 400, { error: 'Missing artifactId' });
      return;
    }

    if (!reason) {
      sendJson(res, 400, { error: 'Missing reason' });
      return;
    }

    const { actingAdmin } = resolveActingAdmin(actorUserId);
    if (!actingAdmin) {
      sendJson(res, 403, { error: 'Acting admin is missing or unauthorized', actorUserId });
      return;
    }

    const artifactData = readJson(publishedArtifactsSamplePath);
    const artifacts = Array.isArray(artifactData.artifacts) ? artifactData.artifacts : [];
    const artifact = artifacts.find((candidate) => candidate.artifactType === 'report' && candidate.artifactId === artifactId);

    if (!artifact) {
      sendJson(res, 404, { error: 'Report not found', artifactId });
      return;
    }

    const timestamp = new Date().toISOString();
    artifact.lastModifiedAt = timestamp;
    if (Object.prototype.hasOwnProperty.call(artifact, 'failureReason')) {
      artifact.failureReason = null;
    }

    const auditLogData = readJson(auditLogSamplePath);
    const logs = Array.isArray(auditLogData.logs) ? auditLogData.logs : [];
    const auditLogEntry = appendAuditLogEntry(logs, req, {
      timestamp,
      actorUserId: actingAdmin.userId,
      actorGithubAccount: actingAdmin.githubAccount,
      actionType: 'report_regenerate',
      targetResourceType: 'Report',
      targetResourceId: artifactId,
      detail: {
        raceId: artifact.raceId,
        reportType: artifact.reportType || null,
        subjectRegistrationId: artifact.subjectRegistrationId || null,
        reason,
        result: 'success'
      },
      result: 'success'
    });

    auditLogData.logs = logs;
    writeJson(publishedArtifactsSamplePath, artifactData);
    writeJson(auditLogSamplePath, auditLogData);
    rebuildRuntimeData();

    sendJson(res, 200, {
      ok: true,
      report: artifact,
      auditLog: auditLogEntry
    });
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to regenerate report', message: error.message });
  }
}

async function handleArtifactVisibilityUpdate(req, res) {
  try {
    const body = await parseRequestJson(req);
    const actorUserId = typeof body.actorUserId === 'string' ? body.actorUserId.trim() : '';
    const artifactId = typeof body.artifactId === 'string' ? body.artifactId.trim() : '';
    const visibility = typeof body.visibility === 'string' ? body.visibility.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!artifactId) {
      sendJson(res, 400, { error: 'Missing artifactId' });
      return;
    }

    if (!visibility) {
      sendJson(res, 400, { error: 'Missing visibility' });
      return;
    }

    if (!reason) {
      sendJson(res, 400, { error: 'Missing reason' });
      return;
    }

    const { actingAdmin } = resolveActingAdmin(actorUserId);
    if (!actingAdmin) {
      sendJson(res, 403, { error: 'Acting admin is missing or unauthorized', actorUserId });
      return;
    }

    const artifactData = readJson(publishedArtifactsSamplePath);
    const artifacts = Array.isArray(artifactData.artifacts) ? artifactData.artifacts : [];
    const artifact = artifacts.find((candidate) => candidate.artifactId === artifactId && (candidate.artifactType === 'work' || candidate.artifactType === 'rider_profile'));

    if (!artifact) {
      sendJson(res, 404, { error: 'Artifact not found', artifactId });
      return;
    }

    const allowedVisibilities = artifact.artifactType === 'work'
      ? new Set(['private', 'review', 'public', 'hidden'])
      : new Set(['public', 'hidden']);

    if (!allowedVisibilities.has(visibility)) {
      sendJson(res, 400, { error: 'Unsupported visibility transition', artifactType: artifact.artifactType, visibility });
      return;
    }

    const previousVisibility = artifact.visibility;
    if (previousVisibility === visibility) {
      sendJson(res, 400, { error: 'Visibility is unchanged', artifactId, visibility });
      return;
    }

    const timestamp = new Date().toISOString();
    artifact.visibility = visibility;
    artifact.isPubliclyVisible = visibility === 'public';
    artifact.lastModifiedAt = timestamp;
    if (visibility === 'hidden') {
      artifact.hideReason = reason;
    } else if (Object.prototype.hasOwnProperty.call(artifact, 'hideReason')) {
      delete artifact.hideReason;
    }

    const auditLogData = readJson(auditLogSamplePath);
    const logs = Array.isArray(auditLogData.logs) ? auditLogData.logs : [];
    const auditLogEntry = appendAuditLogEntry(logs, req, {
      timestamp,
      actorUserId: actingAdmin.userId,
      actorGithubAccount: actingAdmin.githubAccount,
      actionType: artifact.artifactType === 'work' ? 'work_visibility_change' : 'profile_visibility_change',
      targetResourceType: artifact.artifactType === 'work' ? 'Work' : 'RiderProfile',
      targetResourceId: artifactId,
      detail: {
        previousVisibility,
        newVisibility: visibility,
        reason
      },
      result: 'success'
    });

    auditLogData.logs = logs;
    writeJson(publishedArtifactsSamplePath, artifactData);
    writeJson(auditLogSamplePath, auditLogData);
    rebuildRuntimeData();

    sendJson(res, 200, {
      ok: true,
      artifact,
      auditLog: auditLogEntry
    });
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to update artifact visibility', message: error.message });
  }
}

async function handleCaAnomalyFlagUpdate(req, res) {
  try {
    const body = await parseRequestJson(req);
    const actorUserId = typeof body.actorUserId === 'string' ? body.actorUserId.trim() : '';
    const connectionId = typeof body.connectionId === 'string' ? body.connectionId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!connectionId) {
      sendJson(res, 400, { error: 'Missing connectionId' });
      return;
    }

    if (!reason) {
      sendJson(res, 400, { error: 'Missing reason' });
      return;
    }

    const { actingAdmin } = resolveActingAdmin(actorUserId);
    if (!actingAdmin) {
      sendJson(res, 403, { error: 'Acting admin is missing or unauthorized', actorUserId });
      return;
    }

    const caStatusData = readJson(caStatusSamplePath);
    const races = Array.isArray(caStatusData.races) ? caStatusData.races : [];
    let matchedRace = null;
    let connection = null;

    for (const race of races) {
      const candidate = Array.isArray(race.connections)
        ? race.connections.find((entry) => entry.caConnectionId === connectionId)
        : null;
      if (candidate) {
        matchedRace = race;
        connection = candidate;
        break;
      }
    }

    if (!connection || !matchedRace) {
      sendJson(res, 404, { error: 'CA connection not found', connectionId });
      return;
    }

    const previousFlaggedAnomaly = Boolean(connection.flaggedAnomaly);
    const previousAnomalyNote = connection.anomalyNote || null;
    connection.flaggedAnomaly = !previousFlaggedAnomaly;

    if (connection.flaggedAnomaly) {
      connection.anomalyNote = reason;
    } else {
      delete connection.anomalyNote;
    }

    const timestamp = new Date().toISOString();
    const auditLogData = readJson(auditLogSamplePath);
    const logs = Array.isArray(auditLogData.logs) ? auditLogData.logs : [];
    const auditLogEntry = appendAuditLogEntry(logs, req, {
      timestamp,
      actorUserId: actingAdmin.userId,
      actorGithubAccount: actingAdmin.githubAccount,
      actionType: 'ca_anomaly_flag_change',
      targetResourceType: 'CAConnection',
      targetResourceId: connectionId,
      detail: {
        raceId: matchedRace.raceId,
        riderId: connection.riderId,
        previousFlaggedAnomaly,
        newFlaggedAnomaly: Boolean(connection.flaggedAnomaly),
        previousAnomalyNote,
        newAnomalyNote: connection.anomalyNote || null,
        reason
      },
      result: 'success'
    });

    auditLogData.logs = logs;
    writeJson(caStatusSamplePath, caStatusData);
    writeJson(auditLogSamplePath, auditLogData);
    rebuildRuntimeData();

    sendJson(res, 200, {
      ok: true,
      connection,
      auditLog: auditLogEntry
    });
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to update CA anomaly flag', message: error.message });
  }
}

async function handleReportReviewed(req, res) {
  try {
    const body = await parseRequestJson(req);
    const actorUserId = typeof body.actorUserId === 'string' ? body.actorUserId.trim() : '';
    const artifactId = typeof body.artifactId === 'string' ? body.artifactId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!artifactId) {
      sendJson(res, 400, { error: 'Missing artifactId' });
      return;
    }

    if (!reason) {
      sendJson(res, 400, { error: 'Missing reason' });
      return;
    }

    const { actingAdmin } = resolveActingAdmin(actorUserId);
    if (!actingAdmin) {
      sendJson(res, 403, { error: 'Acting admin is missing or unauthorized', actorUserId });
      return;
    }

    const artifactData = readJson(publishedArtifactsSamplePath);
    const artifacts = Array.isArray(artifactData.artifacts) ? artifactData.artifacts : [];
    const artifact = artifacts.find((candidate) => candidate.artifactType === 'report' && candidate.artifactId === artifactId);

    if (!artifact) {
      sendJson(res, 404, { error: 'Report not found', artifactId });
      return;
    }

    const previousReviewStatus = artifact.reviewStatus || 'pending';
    if (artifact.publicationStatus === 'published') {
      sendJson(res, 400, { error: 'Published reports do not need review marking', artifactId });
      return;
    }

    if (previousReviewStatus === 'reviewed') {
      sendJson(res, 400, { error: 'Report is already reviewed', artifactId });
      return;
    }

    const timestamp = new Date().toISOString();
    artifact.reviewStatus = 'reviewed';
    artifact.reviewedAt = timestamp;
    artifact.reviewedBy = actingAdmin.githubAccount;
    artifact.lastModifiedAt = timestamp;
    artifact.statusNote = `已审核，待发布。${reason}`;

    const auditLogData = readJson(auditLogSamplePath);
    const logs = Array.isArray(auditLogData.logs) ? auditLogData.logs : [];
    const auditLogEntry = appendAuditLogEntry(logs, req, {
      timestamp,
      actorUserId: actingAdmin.userId,
      actorGithubAccount: actingAdmin.githubAccount,
      actionType: 'report_reviewed',
      targetResourceType: 'Report',
      targetResourceId: artifactId,
      detail: {
        raceId: artifact.raceId,
        reportType: artifact.reportType || null,
        subjectRegistrationId: artifact.subjectRegistrationId || null,
        previousReviewStatus,
        newReviewStatus: artifact.reviewStatus,
        reason
      },
      result: 'success'
    });

    auditLogData.logs = logs;
    writeJson(publishedArtifactsSamplePath, artifactData);
    writeJson(auditLogSamplePath, auditLogData);
    rebuildRuntimeData();

    sendJson(res, 200, {
      ok: true,
      report: artifact,
      auditLog: auditLogEntry
    });
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to mark report reviewed', message: error.message });
  }
}

function serveAssembledViewSlice(res, sliceName, selector) {
  try {
    const assembledView = readRuntimeJson('assembled-view.json');
    const payload = selector(assembledView);
    if (payload === undefined) {
      sendJson(res, 404, { error: 'Slice not found', sliceName });
      return;
    }
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to read assembled view slice', sliceName, message: error.message });
  }
}

function serveStaticDir(res, pathname, staticDir, prefix) {
  const relativePath = pathname.slice(prefix.length) || '/index.html';
  const normalized = relativePath === '/' ? '/index.html' : relativePath;
  const filePath = path.join(staticDir, path.normalize(normalized));

  if (!filePath.startsWith(staticDir)) {
    sendJson(res, 400, { error: 'Invalid path' });
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isDirectory()) {
      sendFile(res, path.join(filePath, 'index.html'));
      return;
    }

    sendFile(res, filePath);
  });
}

function serveWebAsset(res, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(webDir, path.normalize(normalized));

  if (!filePath.startsWith(webDir)) {
    sendJson(res, 400, { error: 'Invalid path' });
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isDirectory()) {
      sendFile(res, path.join(filePath, 'index.html'));
      return;
    }

    if (error && error.code === 'ENOENT') {
      const segments = normalized.split('/').filter(Boolean);
      const routeRoot = segments[0];
      if (routeRoot && cFrontendRouteFallbacks.has(routeRoot) && segments.length > 1) {
        sendFile(res, path.join(webDir, routeRoot, 'index.html'));
        return;
      }
    }

    sendFile(res, filePath);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';

  if (req.method === 'POST' && pathname === '/api/admin/user-roles') {
    handleUserRoleUpdate(req, res);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/system-config') {
    handleSystemConfigUpdate(req, res);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/projection-rebuild') {
    handleProjectionRebuild(req, res);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/report-regenerate') {
    handleReportRegenerate(req, res);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/artifact-visibility') {
    handleArtifactVisibilityUpdate(req, res);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/ca-anomaly-flag') {
    handleCaAnomalyFlagUpdate(req, res);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/admin/report-reviewed') {
    handleReportReviewed(req, res);
    return;
  }

  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, port, runtimeDir });
    return;
  }

  if (pathname === '/api/runtime/authority-mock') {
    serveRuntimeJson(res, 'authority-mock.json');
    return;
  }

  if (pathname === '/api/runtime/assembled-view') {
    serveRuntimeJson(res, 'assembled-view.json');
    return;
  }

  if (pathname === '/api/runtime/compatibility-report') {
    serveRuntimeJson(res, 'compatibility-report.json');
    return;
  }

  if (pathname === '/api/runtime/a-rider') {
    serveAssembledViewSlice(res, 'aRider', (assembledView) => assembledView.aRider);
    return;
  }

  if (pathname === '/api/runtime/a-rider/riding-events') {
    serveAssembledViewSlice(res, 'aRider.samples.ridingEvents', (assembledView) => assembledView.aRider?.samples?.ridingEvents);
    return;
  }

  if (pathname === '/api/runtime/a-rider/ca-status') {
    serveAssembledViewSlice(res, 'aRider.samples.caStatuses', (assembledView) => assembledView.aRider?.samples?.caStatuses);
    return;
  }

  if (pathname === '/api/runtime/a-rider/session-snapshot') {
    serveAssembledViewSlice(res, 'aRider.samples.sessionSnapshot', (assembledView) => assembledView.aRider?.samples?.sessionSnapshot);
    return;
  }

  if (pathname === '/api/runtime/a-rider/signature-samples') {
    serveAssembledViewSlice(res, 'aRider.samples.signatureSamples', (assembledView) => assembledView.aRider?.samples?.signatureSamples);
    return;
  }

  if (pathname === '/api/runtime/a-rider/contracts') {
    serveAssembledViewSlice(res, 'aRider.contracts', (assembledView) => assembledView.aRider?.contracts);
    return;
  }

  if (pathname === '/api/runtime/a-rider/docs') {
    serveAssembledViewSlice(res, 'aRider.docs', (assembledView) => assembledView.aRider?.docs);
    return;
  }

  if (pathname === '/api/runtime/a-rider/source-bundles') {
    serveAssembledViewSlice(res, 'aRider.summary.sourceBundles', (assembledView) => assembledView.aRider?.summary?.sourceBundles);
    return;
  }

  if (pathname === '/c-frontend-prototype' || pathname.startsWith('/c-frontend-prototype/')) {
    serveStaticDir(res, pathname, cFrontendPrototypeDir, '/c-frontend-prototype');
    return;
  }

  serveWebAsset(res, pathname);
});

server.listen(port, () => {
  console.log(`ARY single-machine web app listening on http://127.0.0.1:${port}`);
});