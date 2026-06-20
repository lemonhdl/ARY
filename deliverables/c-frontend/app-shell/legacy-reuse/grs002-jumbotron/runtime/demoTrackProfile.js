export const demoTrackProfile = {
  schemaVersion: '0.1.0',
  trackId: 'week2-demo-oval',
  backgroundAsset: null,
  viewBox: { x: 0, y: 0, width: 1200, height: 620 },
  designSize: { width: 1200, height: 620, aspectRatio: '16:9' },
  centerlinePath: [
    { x: 165, y: 310 },
    { x: 230, y: 160 },
    { x: 500, y: 95 },
    { x: 840, y: 120 },
    { x: 1035, y: 250 },
    { x: 1000, y: 450 },
    { x: 690, y: 525 },
    { x: 335, y: 485 },
    { x: 165, y: 310 }
  ],
  startLine: { s: 0 },
  finishLine: { s: 1 },
  checkpoints: [
    { checkpointId: 'cp-25', label: '25%', s: 0.25 },
    { checkpointId: 'cp-50', label: '50%', s: 0.5 },
    { checkpointId: 'cp-75', label: '75%', s: 0.75 }
  ],
  laneOffsets: [-42, -18, 18, 42],
  safeZones: [
    { zoneId: 'top-safe', x: 260, y: 130, width: 680, height: 130 },
    { zoneId: 'bottom-safe', x: 300, y: 370, width: 620, height: 145 }
  ],
  messageZones: [
    { zoneId: 'main-track', offsetX: 28, offsetY: -64 }
  ]
};
