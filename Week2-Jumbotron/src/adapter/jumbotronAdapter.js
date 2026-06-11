const staleThresholdMs = 1000 * 60 * 5;

export function adaptRaceSnapshot(raceSnapshot, options = {}) {
  const now = options.now ?? Date.now();
  const entries = raceSnapshot.entries.map((entry, index) => ({
    entryId: entry.entryId,
    displayName: entry.displayName,
    riderName: entry.riderName,
    projectName: entry.projectName,
    rank: entry.rank,
    rankDelta: entry.rankDelta,
    score: entry.score,
    overallProgress: entry.overallProgress,
    roundProgress: chooseRoundProgress(entry),
    phaseProgress: entry.phaseProgress,
    laneId: `lane-${index % 4}`,
    laneOffsetIndex: index % 4,
    tokenCost: entry.tokenCost,
    primaryCA: entry.primaryCA,
    codexUsage: entry.codexUsage,
    claudeUsage: entry.claudeUsage,
    riskLevel: entry.riskLevel,
    motionState: normalizeMotionState(entry.motionState, entry, now),
    latestMessage: entry.latestMessage,
    remoteCockpitUrl: entry.remoteCockpitUrl,
    updatedAt: entry.updatedAt ?? now,
    progressMapping: entry.roundProgress == null ? 'temporary_overallProgress' : 'roundProgress'
  }));

  return {
    competition: raceSnapshot.competition,
    kpi: raceSnapshot.kpi,
    racingEntries: entries,
    ridingMessages: raceSnapshot.messages.map((message) => ({
      messageId: message.messageId,
      entryId: message.entryId,
      source: message.source,
      type: message.type,
      severity: message.severity,
      summary: message.summary,
      createdAt: message.createdAt,
      displayMode: message.displayMode,
      targetUrl: message.targetUrl
    })),
    attentionItems: raceSnapshot.attentionItems.map((item) => ({
      itemId: item.itemId,
      entryId: item.entryId,
      category: item.category,
      severity: item.severity,
      summary: item.summary,
      status: item.status,
      createdAt: item.createdAt,
      targetUrl: item.targetUrl
    }))
  };
}

function chooseRoundProgress(entry) {
  if (Number.isFinite(entry.roundProgress)) {
    return clamp(entry.roundProgress, 0, 100);
  }

  return clamp(entry.overallProgress ?? 0, 0, 100);
}

function normalizeMotionState(state, entry, now) {
  if (entry.updatedAt && now - entry.updatedAt > staleThresholdMs) {
    return 'stale';
  }

  const allowedStates = new Set(['idle', 'running', 'sprinting', 'slowed', 'blocked', 'pit_stop', 'takeover', 'finished', 'stale']);
  return allowedStates.has(state) ? state : 'running';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
