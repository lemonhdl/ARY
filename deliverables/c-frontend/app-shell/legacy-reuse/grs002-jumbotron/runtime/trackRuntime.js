export function createTrackRuntime(trackProfile) {
  validateTrackProfile(trackProfile);

  const segments = buildSegments(trackProfile.centerlinePath);
  const pathLength = segments.reduce((sum, segment) => sum + segment.length, 0);

  return {
    trackProfile,
    pathLength,
    sampleHorsePose(entry) {
      const normalizedProgress = clamp(entry.roundProgress / 100, 0, 1);
      const sample = samplePath(segments, pathLength, normalizedProgress);
      const laneOffset = resolveLaneOffset(trackProfile, entry.laneOffsetIndex);
      const x = sample.point.x + sample.normal.x * laneOffset;
      const y = sample.point.y + sample.normal.y * laneOffset;

      return {
        entryId: entry.entryId,
        x,
        y,
        rotation: sample.rotation,
        s: normalizedProgress,
        laneId: entry.laneId,
        state: entry.motionState,
        zIndex: Math.round(1000 + normalizedProgress * 100 + entry.laneOffsetIndex)
      };
    },
    getCheckpoints() {
      return trackProfile.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        pose: samplePath(segments, pathLength, checkpoint.s)
      }));
    },
    getDebugSamplePoints(count = 24) {
      return Array.from({ length: count }, (_, index) => samplePath(segments, pathLength, index / (count - 1)).point);
    },
    validateEntries(entries) {
      return entries.flatMap((entry) => validateRuntimeEntry(entry, trackProfile));
    }
  };
}

export function validateTrackProfile(trackProfile) {
  const errors = [];

  if (!trackProfile.schemaVersion) errors.push('TrackProfile 缺少 schemaVersion。');
  if (!trackProfile.trackId) errors.push('TrackProfile 缺少 trackId。');
  if (!trackProfile.viewBox) errors.push('TrackProfile 缺少 viewBox。');
  if (!Array.isArray(trackProfile.centerlinePath) || trackProfile.centerlinePath.length < 2) {
    errors.push('centerlinePath 至少需要两个点。');
  }
  if (!Array.isArray(trackProfile.laneOffsets) || trackProfile.laneOffsets.length === 0) {
    errors.push('laneOffsets 至少需要一条 lane。');
  }

  if (errors.length) {
    throw new Error(errors.join(' '));
  }
}

function buildSegments(points) {
  return points.slice(0, -1).map((point, index) => {
    const nextPoint = points[index + 1];
    const dx = nextPoint.x - point.x;
    const dy = nextPoint.y - point.y;
    const length = Math.hypot(dx, dy);
    const tangent = length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
    const normal = { x: -tangent.y, y: tangent.x };

    return { start: point, end: nextPoint, length, tangent, normal };
  });
}

function samplePath(segments, pathLength, s) {
  const targetDistance = clamp(s, 0, 1) * pathLength;
  let traversed = 0;

  for (const segment of segments) {
    if (traversed + segment.length >= targetDistance) {
      const localDistance = targetDistance - traversed;
      const localT = segment.length === 0 ? 0 : localDistance / segment.length;
      return {
        point: {
          x: lerp(segment.start.x, segment.end.x, localT),
          y: lerp(segment.start.y, segment.end.y, localT)
        },
        tangent: segment.tangent,
        normal: segment.normal,
        rotation: Math.atan2(segment.tangent.y, segment.tangent.x) * 180 / Math.PI
      };
    }
    traversed += segment.length;
  }

  const lastSegment = segments[segments.length - 1];
  return {
    point: lastSegment.end,
    tangent: lastSegment.tangent,
    normal: lastSegment.normal,
    rotation: Math.atan2(lastSegment.tangent.y, lastSegment.tangent.x) * 180 / Math.PI
  };
}

function resolveLaneOffset(trackProfile, laneOffsetIndex) {
  const offsets = trackProfile.laneOffsets;
  return offsets[laneOffsetIndex % offsets.length];
}

function validateRuntimeEntry(entry, trackProfile) {
  const warnings = [];

  if (!Number.isFinite(entry.roundProgress) || entry.roundProgress < 0 || entry.roundProgress > 100) {
    warnings.push(`${entry.displayName} 的 roundProgress 越界或缺失。`);
  }
  if (!trackProfile.laneOffsets[entry.laneOffsetIndex]) {
    warnings.push(`${entry.displayName} 的 laneOffsetIndex 不存在。`);
  }
  if (entry.progressMapping !== 'roundProgress') {
    warnings.push(`${entry.displayName} 正在临时使用 overallProgress 映射赛道位置。`);
  }
  if (entry.motionState === 'stale') {
    warnings.push(`${entry.displayName} 已进入 stale 状态。`);
  }

  return warnings;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
