import './style.css';
import { adaptRaceSnapshot } from './adapter/jumbotronAdapter.js';
import { mockRaceSnapshot } from './data/mockRaceSnapshot.js';
import { demoTrackProfile } from './assets/trackProfile.js';
import { createTrackRuntime } from './runtime/trackRuntime.js';

const runtimeInput = adaptRaceSnapshot(mockRaceSnapshot);
const trackRuntime = createTrackRuntime(demoTrackProfile);
const horsePoses = runtimeInput.racingEntries.map((entry) => ({
  entry,
  pose: trackRuntime.sampleHorsePose(entry)
}));
const runtimeWarnings = trackRuntime.validateEntries(runtimeInput.racingEntries);

renderApp({ runtimeInput, trackProfile: demoTrackProfile, trackRuntime, horsePoses, runtimeWarnings });

function renderApp(model) {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <main class="jumbotron-shell">
      ${renderHeader(model.runtimeInput)}
      ${renderKpiStrip(model.runtimeInput.kpi)}
      <section class="live-layout">
        ${renderTrackStage(model)}
        ${renderSidePanel(model)}
      </section>
      ${renderBottomTicker(model.runtimeInput)}
      ${renderImplementationBoundary(model)}
      ${renderCalibratorPreview(model)}
      ${renderDebugPanel(model)}
    </main>
  `;
}

function renderHeader({ competition }) {
  return `
    <header class="race-header">
      <div>
        <p class="eyebrow">${competition.liveStatus} · ${competition.currentRound}</p>
        <h1>${competition.title}</h1>
        <p>${competition.subtitle}</p>
      </div>
      <div class="phase-card">
        <span>${competition.currentPhase}</span>
        <strong>${competition.elapsedTime}</strong>
        <small>Next: ${competition.nextPhase}</small>
      </div>
    </header>
  `;
}

function renderKpiStrip(kpi) {
  const cards = [
    ['Total Progress', `${kpi.completionRate}%`],
    ['Active Riders', `${kpi.activeRiders}/${kpi.onlineRiders}`],
    ['Tokens', formatNumber(kpi.totalTokens)],
    ['Codex / Claude', `${kpi.codexShare}% / ${kpi.claudeShare}%`],
    ['Risk / Obstacle', `${kpi.riskCount} / ${kpi.obstacleCount}`]
  ];

  return `
    <section class="kpi-strip" aria-label="Competition KPI">
      ${cards.map(([label, value]) => `
        <article class="kpi-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `).join('')}
    </section>
  `;
}

function renderTrackStage({ trackProfile, trackRuntime, horsePoses, runtimeInput }) {
  const viewBox = trackProfile.viewBox;
  const centerline = pointsToPolyline(trackProfile.centerlinePath);
  const samples = pointsToPolyline(trackRuntime.getDebugSamplePoints(28));
  const checkpoints = trackRuntime.getCheckpoints();
  const bubbleMessages = pickBubbleMessages(runtimeInput.ridingMessages, horsePoses);

  return `
    <section class="track-stage" aria-label="Race Live View Main Track Area">
      <div class="track-title-row">
        <div>
          <p class="eyebrow">Race Live View</p>
          <h2>Track Stage</h2>
        </div>
        <a href="#remote-cockpit" class="remote-link">Remote Racing Cockpit</a>
      </div>
      <svg class="track-svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" role="img" aria-label="Race track runtime preview">
        <rect class="track-background" x="20" y="20" width="1160" height="580" rx="42"></rect>
        <path class="track-band" d="${pointsToPath(trackProfile.centerlinePath)}"></path>
        <polyline class="debug-centerline" points="${centerline}"></polyline>
        <polyline class="debug-samples" points="${samples}"></polyline>
        ${checkpoints.map((checkpoint) => `
          <g class="checkpoint" transform="translate(${checkpoint.pose.point.x} ${checkpoint.pose.point.y})">
            <circle r="10"></circle>
            <text x="14" y="5">${checkpoint.label}</text>
          </g>
        `).join('')}
        ${horsePoses.map(({ entry, pose }) => `
          <g class="horse horse-${entry.riskLevel}" transform="translate(${pose.x} ${pose.y}) rotate(${pose.rotation})" style="--z:${pose.zIndex}">
            <circle class="horse-body" r="18"></circle>
            <path class="horse-arrow" d="M-7,-9 L18,0 L-7,9 Z"></path>
            <text class="horse-rank" transform="rotate(${-pose.rotation})" text-anchor="middle" y="5">${entry.rank}</text>
          </g>
          <text class="horse-label" x="${pose.x + 24}" y="${pose.y - 22}">${entry.displayName}</text>
        `).join('')}
        ${bubbleMessages.map(({ message, pose }) => `
          <g class="message-bubble" transform="translate(${pose.x + 34} ${pose.y - 72})">
            <rect width="230" height="54" rx="14"></rect>
            <text x="14" y="22">${escapeText(message.type)}</text>
            <text x="14" y="42">${escapeText(message.summary).slice(0, 28)}</text>
          </g>
        `).join('')}
      </svg>
    </section>
  `;
}

function renderSidePanel({ runtimeInput, horsePoses }) {
  const topEntries = [...runtimeInput.racingEntries].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const highlighted = runtimeInput.attentionItems.map((item) => {
    const entry = runtimeInput.racingEntries.find((candidate) => candidate.entryId === item.entryId);
    return { item, entry };
  });

  return `
    <aside class="side-panel">
      <section class="panel-card">
        <p class="eyebrow">Side / Floating Ranking</p>
        <h2>TOP3</h2>
        <ol class="ranking-list">
          ${topEntries.map((entry) => `
            <li>
              <strong>#${entry.rank} ${entry.displayName}</strong>
              <span>${entry.roundProgress}% · ${entry.motionState}</span>
            </li>
          `).join('')}
        </ol>
      </section>
      <section class="panel-card attention-card">
        <p class="eyebrow">Risk / Obstacle / Violation</p>
        <h2>Attention</h2>
        ${highlighted.map(({ item, entry }) => `
          <article>
            <span class="severity ${item.severity}">${item.category}</span>
            <strong>${entry?.displayName ?? item.entryId}</strong>
            <p>${item.summary}</p>
          </article>
        `).join('')}
      </section>
      <section class="panel-card contract-card">
        <p class="eyebrow">Runtime Contract</p>
        <h2>HorsePose</h2>
        <p>${horsePoses.length} entries sampled from <code>roundProgress</code>, lane offsets and TrackProfile geometry.</p>
      </section>
    </aside>
  `;
}

function renderBottomTicker(runtimeInput) {
  const tickerItems = [
    ...runtimeInput.ridingMessages.map((message) => `${message.createdAt} · ${message.type} · ${message.summary}`),
    ...runtimeInput.attentionItems.map((item) => `${item.category.toUpperCase()} · ${item.summary}`)
  ];

  return `
    <section class="bottom-ticker" aria-label="Bottom Ticker">
      <strong>Riding Message Ticker</strong>
      <div>${tickerItems.map((item) => `<span>${item}</span>`).join('')}</div>
    </section>
  `;
}

function renderImplementationBoundary({ trackProfile, runtimeInput }) {
  const rows = [
    ['数据接入口', 'src/data/mockRaceSnapshot.js', '数据同学替换 RaceSnapshot 内容，Adapter 保持契约。'],
    ['资产接入口', 'src/assets/trackProfile.js', '资产同学替换 track.profile.json 字段和 backgroundAsset。'],
    ['Adapter', 'src/adapter/jumbotronAdapter.js', '只负责 RaceSnapshot 到 runtime 输入快照。'],
    ['track-runtime', 'src/runtime/trackRuntime.js', 'Jumbotron 与 Calibrator Preview 共享。']
  ];

  return `
    <section class="boundary-panel" aria-label="Framework implementation boundary">
      <div>
        <p class="eyebrow">Framework Role</p>
        <h2>框架实现边界</h2>
        <p>本实现只负责可插数据、可插资产、可运行预览的主框架；mock 内容和最终赛道资产留给对应分工继续替换。</p>
      </div>
      <div class="boundary-grid">
        ${rows.map(([label, path, note]) => `
          <article>
            <strong>${label}</strong>
            <code>${path}</code>
            <span>${note}</span>
          </article>
        `).join('')}
      </div>
      <div class="source-chain">
        <span>DCR RaceSnapshot → Jumbotron Adapter → ${runtimeInput.racingEntries.length} RacingEntrySnapshot → track-runtime</span>
        <span>Track Profile <code>${trackProfile.trackId}</code> → track-runtime → Race Live View / Calibrator Preview</span>
      </div>
    </section>
  `;
}

function renderCalibratorPreview({ trackProfile, trackRuntime }) {
  const previewEntries = [0, 25, 50, 75, 100].map((progress, index) => ({
    entryId: `preview-${progress}`,
    displayName: `${progress}%`,
    roundProgress: progress,
    laneId: 'preview-lane',
    laneOffsetIndex: index % trackProfile.laneOffsets.length,
    motionState: progress === 100 ? 'finished' : 'running',
    progressMapping: 'roundProgress'
  }));
  const previewPoses = previewEntries.map((entry) => ({ entry, pose: trackRuntime.sampleHorsePose(entry) }));
  const centerline = pointsToPolyline(trackProfile.centerlinePath);

  return `
    <section class="calibrator-preview" aria-label="Track Profile Calibrator Preview">
      <div>
        <p class="eyebrow">Track Profile Calibrator Preview</p>
        <h2>同一套 track-runtime 的设计时预览</h2>
        <p>这里不是另写预览逻辑，而是用同一个 <code>sampleHorsePose</code> 检查单马 0 到 100、多 lane offset 和 checkpoint 语义。</p>
      </div>
      <svg class="preview-svg" viewBox="${trackProfile.viewBox.x} ${trackProfile.viewBox.y} ${trackProfile.viewBox.width} ${trackProfile.viewBox.height}" role="img" aria-label="Calibrator runtime preview">
        <rect class="preview-background" x="40" y="40" width="1120" height="540" rx="36"></rect>
        <polyline class="debug-centerline" points="${centerline}"></polyline>
        ${previewPoses.map(({ entry, pose }) => `
          <g class="preview-marker" transform="translate(${pose.x} ${pose.y})">
            <circle r="16"></circle>
            <text x="22" y="6">${entry.displayName}</text>
          </g>
        `).join('')}
      </svg>
    </section>
  `;
}

function renderDebugPanel({ trackProfile, trackRuntime, runtimeWarnings }) {
  const checks = [
    ['Track Profile schema', trackProfile.schemaVersion ? 'ok' : 'missing'],
    ['centerline sampled points', `${trackRuntime.getDebugSamplePoints(28).length}`],
    ['lane offsets', `${trackProfile.laneOffsets.length}`],
    ['checkpoints', `${trackProfile.checkpoints.length}`],
    ['runtime warnings', `${runtimeWarnings.length}`]
  ];

  return `
    <section class="debug-panel" aria-label="Debug Mode">
      <div>
        <p class="eyebrow">Debug Mode</p>
        <h2>Geometry / Runtime / Stale Checks</h2>
      </div>
      <div class="debug-grid">
        ${checks.map(([label, value]) => `
          <article>
            <span>${label}</span>
            <strong>${value}</strong>
          </article>
        `).join('')}
      </div>
      <ul class="warning-list">
        ${(runtimeWarnings.length ? runtimeWarnings : ['当前 demo runtime validation 未发现阻塞 warning。']).map((warning) => `<li>${warning}</li>`).join('')}
      </ul>
    </section>
  `;
}

function pickBubbleMessages(messages, horsePoses) {
  const priority = new Map([
    ['risk_alert', 3],
    ['milestone', 2],
    ['obstacle', 2],
    ['progress_update', 1]
  ]);

  return [...messages]
    .sort((a, b) => (priority.get(b.type) ?? 0) - (priority.get(a.type) ?? 0))
    .slice(0, 3)
    .map((message) => ({
      message,
      pose: horsePoses.find(({ entry }) => entry.entryId === message.entryId)?.pose ?? { x: 0, y: 0 }
    }));
}

function pointsToPolyline(points) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function pointsToPath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function escapeText(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[char]);
}
