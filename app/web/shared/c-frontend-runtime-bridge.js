(function () {
  const prototypeSamplePath = '/c-frontend-prototype/data/sample-races.js';
  const runtimeApiPath = '/api/runtime/assembled-view';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  function formatTime(value) {
    if (!value) return '--:--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function titleCaseCaType(value) {
    if (!value) return 'ARY CA';
    return String(value)
      .split(/[_-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function normalizeConnectionStatus(status) {
    if (status === 'connected') return 'handshaken';
    return status || 'not_configured';
  }

  function deriveConnectionHealth(connection) {
    const normalizedStatus = normalizeConnectionStatus(connection.ingestionStatus);
    if (normalizedStatus === 'failed' || connection.failureReason) return 'failed';
    if (connection.flaggedAnomaly) return 'no_recent_signal';
    if (normalizedStatus === 'handshaken') return 'watch';
    if (normalizedStatus === 'registered') return 'watch';
    return 'ok';
  }

  function createRaceGroups(races, reviews, awards) {
    const publishedReviewRaceIds = new Set((reviews || []).filter((item) => item.published || item.status === 'published').map((item) => item.raceId));
    const publishedAwardRaceIds = new Set((awards || []).map((item) => item.raceId));
    const completedRaceIds = races
      .filter((race) => race.status === 'completed' && publishedReviewRaceIds.has(race.id) && publishedAwardRaceIds.has(race.id))
      .map((race) => race.id);

    return {
      featuredRaceId: races.find((race) => race.featured)?.id || races.find((race) => race.status === 'running')?.id || races[0]?.id || null,
      liveRaceIds: races.filter((race) => race.status === 'running').map((race) => race.id),
      registrationRaceIds: races.filter((race) => race.status === 'registration').map((race) => race.id),
      judgingRaceIds: races.filter((race) => race.status === 'judging').map((race) => race.id),
      completedRaceIds,
      upcomingRaceIds: races.filter((race) => race.status === 'upcoming').map((race) => race.id),
    };
  }

  function buildPublicEvidenceSummaries(runtime, profilesByRiderId) {
    const publicWorks = (runtime.works || []).filter((work) => work.visibility === 'public' && work.published);
    const awardsByWorkId = new Map((runtime.awards || []).map((award) => [award.workId, award]));
    const reviewsByRaceId = new Map((runtime.reviews || []).map((review) => [review.raceId, review]));

    const generated = [];

    publicWorks.forEach((work) => {
      const profile = profilesByRiderId.get(work.riderId);
      generated.push({
        id: `pev-work-${work.id}`,
        raceId: work.raceId,
        workId: work.id,
        riderId: work.riderId,
        sourceType: 'work_summary',
        visibility: 'public',
        summary: work.summary || '公开作品摘要已发布。',
        skillTags: profile?.skillTags?.slice(0, 3) || [],
        sourceRefLabel: 'published work summary',
      });

      const award = awardsByWorkId.get(work.id);
      if (award) {
        generated.push({
          id: `pev-award-${award.id}`,
          raceId: work.raceId,
          workId: work.id,
          riderId: work.riderId,
          sourceType: 'judging_record_summary',
          visibility: 'public',
          summary: award.reason || `${award.name} 已发布。`,
          skillTags: profile?.skillTags?.slice(0, 3) || [],
          sourceRefLabel: 'published judge comment',
        });
      }

      const review = reviewsByRaceId.get(work.raceId);
      if (review?.published && review.summary) {
        generated.push({
          id: `pev-review-${work.id}`,
          raceId: work.raceId,
          workId: work.id,
          riderId: work.riderId,
          sourceType: 'review_summary',
          visibility: 'public',
          summary: review.summary,
          skillTags: profile?.skillTags?.slice(0, 3) || [],
          sourceRefLabel: 'published review summary',
        });
      }
    });

    return generated;
  }

  function buildCaConnections(runtime, fallbackConnections) {
    const runtimeConnections = [];
    const coveredRaceIds = new Set();

    (runtime.caStatuses || []).forEach((raceStatus) => {
      coveredRaceIds.add(raceStatus.raceId);
      (raceStatus.connections || []).forEach((connection) => {
        const normalizedStatus = normalizeConnectionStatus(connection.ingestionStatus);
        const note = connection.anomalyNote || connection.failureReason || null;
        runtimeConnections.push({
          raceProjectId: `${raceStatus.raceId}:${connection.riderId}`,
          raceId: raceStatus.raceId,
          riderId: connection.riderId,
          registrationStatus: 'approved',
          aggregateIngestionStatus: normalizedStatus,
          connectionHealth: deriveConnectionHealth(connection),
          evidenceCompleteness: connection.flaggedAnomaly ? 'needs_review' : 'good',
          canSubmitWork: true,
          connections: [
            {
              name: `${titleCaseCaType(connection.caType)} Connector`,
              caType: connection.caType,
              status: normalizedStatus,
              lastSignal: formatTime(connection.lastSyncedAt),
              sessions: connection.sessionCount || 0,
              note,
            },
          ],
        });
      });
    });

    return runtimeConnections.concat((fallbackConnections || []).filter((item) => !coveredRaceIds.has(item.raceId)));
  }

  function buildRiders(runtime, fallbackRiders, caConnections, profilesByRiderId) {
    const ridersById = new Map((fallbackRiders || []).map((rider) => [rider.id, { ...rider }]));
    const projectionByRaceId = new Map((runtime.liveProjections || []).map((projection) => [projection.raceId, projection]));

    caConnections.forEach((connection, index) => {
      const profile = profilesByRiderId.get(connection.riderId);
      const projection = projectionByRaceId.get(connection.raceId);
      const projectionEntry = projection?.processLeaderboard?.find((item) => item.riderId === connection.riderId || item.name === profile?.displayName || item.name === connection.connections[0]?.name);
      const existing = ridersById.get(connection.riderId) || {};
      ridersById.set(connection.riderId, {
        ...existing,
        id: connection.riderId,
        name: profile?.displayName || existing.name || connection.riderId,
        raceId: connection.raceId,
        progress: Math.round(projectionEntry?.score || parseInt(profile?.stats?.completion || '68', 10)),
        cost: existing.cost || 24 + index * 7,
        risk: connection.connectionHealth === 'failed' ? 'danger' : connection.connectionHealth === 'no_recent_signal' ? 'warning' : 'watch',
      });
    });

    (runtime.profiles || []).forEach((profile) => {
      if (ridersById.has(profile.riderId)) return;
      ridersById.set(profile.riderId, {
        id: profile.riderId,
        name: profile.displayName,
        raceId: profile.featuredRaceIds?.[0] || null,
        progress: parseInt(profile.stats?.completion || '72', 10),
        cost: 36,
        risk: 'watch',
      });
    });

    return Array.from(ridersById.values());
  }

  function buildReviewReadiness(caConnections, fallbackItems) {
    const generated = caConnections
      .filter((item) => item.connectionHealth !== 'ok')
      .map((item) => ({
        raceId: item.raceId,
        riderId: item.riderId,
        label: item.connectionHealth === 'failed' ? 'CA 连接失败' : '连接异常',
        severity: item.connectionHealth === 'failed' ? 'warning' : 'danger',
        blocking: false,
        text: item.connections[0]?.note || '接入存在风险，但不自动阻断参赛或作品提交。',
      }));

    const seen = new Set(generated.map((item) => `${item.raceId}:${item.riderId}:${item.label}`));
    (fallbackItems || []).forEach((item) => {
      const key = `${item.raceId}:${item.riderId}:${item.label}`;
      if (!seen.has(key)) generated.push(item);
    });
    return generated;
  }

  function buildOpsStatus(runtime, fallbackOpsStatus) {
    const dashboard = runtime.dashboard || {};
    const performance = dashboard.performance || {};
    const projectionFailed = (runtime.projectionStatuses || []).some((item) => item.health === 'failed');
    return [
      { label: 'Public Site', value: `${performance.publicPageMs || 0}ms`, status: 'healthy', detail: '公开页面首屏响应' },
      { label: 'Live Hall', value: `${performance.liveHallRefreshMs || 0}ms`, status: projectionFailed ? 'warning' : 'healthy', detail: 'Live 投影刷新时延' },
      { label: 'Screen Display', value: `${performance.screenPageMs || 0}ms`, status: 'healthy', detail: '大屏输出首屏耗时' },
      { label: 'User.roles', value: `${dashboard.pendingJudgements || 0} pending`, status: 'watch', detail: '待处理权限与评审事项' },
      { label: 'CA 实时接入', value: `${dashboard.caHealth?.active || 0}/${dashboard.caHealth?.configured || 0}`, status: dashboard.caFailed ? 'warning' : 'healthy', detail: '当前已激活 CA 连接' },
      { label: 'Report 发布', value: `${dashboard.totalAwards || 0} awards`, status: 'watch', detail: '最终公开资产以已发布结果与复盘为准' },
    ].concat((fallbackOpsStatus || []).filter((item) => item.label === 'GitHub 登录').slice(0, 1));
  }

  function mergeRuntimeIntoSample(baseSample, runtime) {
    const publishedResultRaceIds = new Set((runtime.results || []).filter((item) => item.published || item.publicationStatus === 'published').map((item) => item.raceId));
    const publishedReviewRaceIds = new Set((runtime.reviews || []).filter((item) => item.published || item.status === 'published').map((item) => item.raceId));

    const races = (runtime.races || []).map((race) => ({
      ...race,
      status: race.status === 'archived' && (publishedResultRaceIds.has(race.id) || publishedReviewRaceIds.has(race.id)) ? 'completed' : race.status,
    }));
    const raceGroups = createRaceGroups(races, runtime.reviews || [], runtime.awards || []);
    const profiles = (runtime.profiles || []).filter((profile) => profile.isPublic !== false);
    const profilesByRiderId = new Map(profiles.map((profile) => [profile.riderId, profile]));
    const caConnections = buildCaConnections(runtime, baseSample.caConnections);
    const publicEvidenceSummaries = buildPublicEvidenceSummaries(runtime, profilesByRiderId);
    const riders = buildRiders(runtime, baseSample.riders, caConnections, profilesByRiderId);

    return {
      ...baseSample,
      metadata: {
        ...(baseSample.metadata || {}),
        source: 'runtime-assembled-view',
        generatedAt: runtime.generatedAt,
      },
      raceGroups,
      races,
      works: runtime.works || [],
      results: runtime.results || [],
      awards: runtime.awards || [],
      reviews: runtime.reviews || [],
      profiles,
      liveProjections: runtime.liveProjections || [],
      publicEvidenceSummaries,
      caConnections,
      reviewReadiness: buildReviewReadiness(caConnections, baseSample.reviewReadiness),
      riders,
      opsStatus: buildOpsStatus(runtime, baseSample.opsStatus),
    };
  }

  async function prepareRuntimeSample() {
    let baseSample = {
      metadata: { name: 'ARY runtime bridge fallback' },
      series: { title: 'Agent Racing Yard', subtitle: 'Runtime fallback' },
      raceGroups: {},
      races: [],
      works: [],
      results: [],
      awards: [],
      reviews: [],
      profiles: [],
      riders: [],
      liveProjections: [],
      publicEvidenceSummaries: [],
      caConnections: [],
      reviewReadiness: [],
      judgeRubric: [],
      opsStatus: [],
      screenFallbacks: [],
      consoleTasks: [],
    };

    try {
      await loadScript(prototypeSamplePath);
      if (window.ARY_SAMPLE_DATA) {
        baseSample = window.ARY_SAMPLE_DATA;
      }
    } catch (error) {
      console.error(error);
    }

    try {
      const response = await fetch(runtimeApiPath);
      if (!response.ok) throw new Error(`Failed to fetch ${runtimeApiPath}: ${response.status}`);
      const runtime = await response.json();
      window.ARY_RUNTIME_VIEW = runtime;
      window.ARY_ASSEMBLED_VIEW = runtime;
      window.ARY_SAMPLE_DATA = mergeRuntimeIntoSample(baseSample, runtime);
      return window.ARY_SAMPLE_DATA;
    } catch (error) {
      console.error(error);
      window.ARY_SAMPLE_DATA = baseSample;
      return baseSample;
    }
  }

  window.ARY_RUNTIME_READY = prepareRuntimeSample();
})();