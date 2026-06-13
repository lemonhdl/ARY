import { createServerApp } from './server.js';
import { createOrganizerServer } from './organizer-server.js';
import { join } from 'node:path';
import { organizerDir, publicStoreDir, readJson, writeJson } from './storage.js';

const port = 4310;
const organizerPort = 4311;
const evaluatorServicePath = join(organizerDir, 'evaluator_service.json');
const raceSourcePath = join(organizerDir, 'race_source.json');
const disclosuresPath = join(publicStoreDir, 'public_disclosures.json');
const originalEvaluatorService = await readJson(evaluatorServicePath);
const originalRaceSource = await readJson(raceSourcePath);
const originalDisclosures = await readJson(disclosuresPath);
await writeJson(evaluatorServicePath, { ...originalEvaluatorService, enabled: true });
await writeJson(raceSourcePath, originalRaceSource.map((source) => ({ ...source, lifecycleStatus: 'open', disclosureStatus: 'published' })));
await writeJson(disclosuresPath, originalDisclosures.map((race) => ({ ...race, status: 'open', sourceStateLabel: 'Organizer 数据可用', reviewStateLabel: '可提交方案并等待评测。', entryLabel: '进入 Race' })));
const app = createServerApp(port, organizerPort);
const organizer = createOrganizerServer(organizerPort);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(text, value, message) {
  assert(text.includes(value), message);
}

function assertNotIncludes(text, value, message) {
  assert(!text.includes(value), message);
}

function bubbleVisibleAtSecond(item, second, cycleSeconds) {
  if (item.duration >= cycleSeconds) return true;
  if (item.start + item.duration <= cycleSeconds) return second >= item.start && second < item.start + item.duration;
  return second >= item.start || second < (item.start + item.duration) % cycleSeconds;
}

function circularSecondDistance(a, b, cycleSeconds) {
  const direct = Math.abs(a - b);
  return Math.min(direct, cycleSeconds - direct);
}

function bubbleEndSecond(item, cycleSeconds) {
  return (item.start + item.duration) % cycleSeconds;
}

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function rectCenterDistance(a, b) {
  return Math.hypot(a.x + a.width / 2 - (b.x + b.width / 2), a.y + a.height / 2 - (b.y + b.height / 2));
}

function assertSvgMessageBubblesInViewBox(html) {
  assertIncludes(html, 'message-bubble-anchor', 'jumbotron should render dynamic ambience bubble anchors');
  assertIncludes(html, 'animation-duration:var(--bubble-cycle)', 'jumbotron should use adaptive bubble cycle duration');
  const matches = [...html.matchAll(/<g class="message-bubble-anchor ([^"]+)" style="[^"]*" data-start-second="([\d.-]+)" data-duration-second="([\d.-]+)" data-cycle-second="([\d.-]+)" data-average-visible="([\d.-]+)" data-placement="([^"]+)" data-slot-index="([\d.-]+)" data-priority="([\d.-]+)"><line class="message-bubble-line" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"\/><g class="message-bubble" transform="translate\(([\d.-]+) ([\d.-]+)\)"><rect width="([\d.-]+)" height="([\d.-]+)"/g)];
  if (!matches.length) {
    assertIncludes(html, '底部消息条', 'jumbotron should fall back to ticker when no bubbles are safe');
    return;
  }
  const timing = [];
  const rects = [];
  const cycles = new Set();
  const averages = new Set();
  for (const match of matches) {
    const [, liveClass, startValue, durationValue, cycleValue, averageValue, placement, , priorityValue, x1Value, y1Value, x2Value, y2Value, xValue, yValue, widthValue, heightValue] = match;
    const start = Number(startValue);
    const duration = Number(durationValue);
    const cycle = Number(cycleValue);
    const average = Number(averageValue);
    const priority = Number(priorityValue);
    const x1 = Number(x1Value);
    const y1 = Number(y1Value);
    const x2 = Number(x2Value);
    const y2 = Number(y2Value);
    const x = Number(xValue);
    const y = Number(yValue);
    const width = Number(widthValue);
    const height = Number(heightValue);
    assert(['right', 'left', 'bottom', 'top'].includes(placement), 'message bubble should expose adaptive placement');
    assert([6, 8, 10, 12].includes(duration), 'message bubble should use importance-based duration');
    assert([34, 42, 48, 60, 72, 84, 96, 108, 120].includes(cycle), 'message bubble cycle should use an adaptive cycle bucket');
    assertIncludes(html, `@keyframes jumbotronBubbleCycle${duration}In${cycle}`, 'jumbotron should include adaptive duration/cycle keyframes');
    assert(liveClass.includes(`bubble-live-${duration}-cycle-${cycle}`), 'message bubble animation class should match duration and cycle');
    assert(start >= 0 && start < cycle, 'message bubble start should be inside adaptive cycle');
    assert(priority >= 0 && priority <= 4, 'message bubble priority should be encoded');
    assert(x >= 0 && x + width <= 1200, 'message bubble should stay inside horizontal track viewBox');
    assert(y >= 0 && y + height <= 620, 'message bubble should stay inside vertical track viewBox');
    assert(Math.hypot(x2 - x1, y2 - y1) <= 360, 'message bubble anchor should stay near its related team marker');
    assert(x2 >= x - 1 && x2 <= x + width + 1 && y2 >= y - 1 && y2 <= y + height + 1, 'message bubble anchor should land on the bubble edge');
    timing.push({ start, duration });
    rects.push({ x, y, width, height });
    cycles.add(cycle);
    averages.add(average);
  }
  assert(cycles.size === 1, 'message bubbles should share one adaptive cycle');
  assert(averages.size === 1, 'message bubbles should share one average visibility value');
  const cycle = [...cycles][0];
  const average = [...averages][0];
  assert(timing.length < 3 ? average <= 1.8 : average >= 1.2 && average <= 1.8, 'message bubbles should average around 1.5 visible bubbles');
  const events = timing.flatMap((item) => [item.start, bubbleEndSecond(item, cycle)]);
  assert(events.every((event, index) => events.slice(index + 1).every((other) => circularSecondDistance(event, other, cycle) >= 1)), 'message bubble start and end events should be staggered');
  for (let second = 0; second < cycle; second += 1) {
    const visible = timing.map((item, index) => ({ item, rect: rects[index] })).filter(({ item }) => bubbleVisibleAtSecond(item, second, cycle));
    assert(visible.length <= 3, 'message bubbles should not exceed three visible bubbles per second');
    assert(visible.every((current, index) => visible.slice(index + 1).every((other) => !intersects(current.rect, other.rect) && rectCenterDistance(current.rect, other.rect) >= 220)), 'simultaneous message bubbles should stay spatially separated');
  }
}

function assertSvgHorseLabelsAvoidBboxes(html) {
  assertIncludes(html, 'horse-label-group', 'jumbotron should render adaptive horse label groups');
  assertIncludes(html, 'data-label-placement=', 'horse labels should expose adaptive placement');
  assertIncludes(html, 'data-label-ring=', 'horse labels should expose candidate ring');
  assert(!html.includes('<rect class="horse-label-bg"'), 'horse label bbox should stay logical and not render visible background boxes');
  assertIncludes(html, 'horse-label-line', 'horse labels should render leader lines');
  assertIncludes(html, 'GreenRoute · 47%', 'horse label should keep full display name and progress');
  const matches = [...html.matchAll(/<g class="horse-label-group" data-entry-id="([^"]+)" data-label-placement="([^"]+)" data-label-ring="([^"]+)" data-label-x="([\d.-]+)" data-label-y="([\d.-]+)" data-label-width="([\d.-]+)" data-label-height="([\d.-]+)" data-horse-x="([\d.-]+)" data-horse-y="([\d.-]+)" data-label-penalty="([\d.-]+)"><line class="horse-label-line" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"\/><text class="horse-label" x="([\d.-]+)" y="([\d.-]+)">([^<]+)<\/text><\/g>/g)];
  assert(matches.length >= 8, 'jumbotron should expose adaptive bboxes for multi-horse labels');
  const labels = matches.map((match) => {
    const [, entryId, placement, ring, xValue, yValue, widthValue, heightValue, horseXValue, horseYValue, penaltyValue, x1Value, y1Value, x2Value, y2Value, textXValue, textYValue, text] = match;
    const rect = { x: Number(xValue), y: Number(yValue), width: Number(widthValue), height: Number(heightValue) };
    assert(['NE', 'E', 'SE', 'N', 'S', 'NW', 'W', 'SW'].includes(placement), 'horse label should use deterministic compass placement');
    assert(['inner', 'outer'].includes(ring), 'horse label should use inner or outer candidate ring');
    assert(Number.isFinite(Number(penaltyValue)), 'horse label should expose candidate penalty');
    assert(Number.isFinite(Number(textXValue)) && Number.isFinite(Number(textYValue)), 'horse label should expose finite text position');
    assert(x1Value === horseXValue && y1Value === horseYValue, 'horse label leader line should start at related horse marker');
    assert(Number(x2Value) >= rect.x - 1 && Number(x2Value) <= rect.x + rect.width + 1 && Number(y2Value) >= rect.y - 1 && Number(y2Value) <= rect.y + rect.height + 1, 'horse label leader line should land on label edge');
    assert(Math.hypot(Number(x2Value) - Number(horseXValue), Number(y2Value) - Number(horseYValue)) <= 220, 'horse label should stay near its related marker');
    assert(rect.x >= 0 && rect.x + rect.width <= 1200, 'horse label should stay inside horizontal track viewBox');
    assert(rect.y >= 0 && rect.y + rect.height <= 620, 'horse label should stay inside vertical track viewBox');
    assert(text.includes(' · ') && text.includes('%'), 'horse label should keep full name and progress format');
    return { entryId, rect, marker: { x: Number(horseXValue) - 22, y: Number(horseYValue) - 22, width: 44, height: 44 } };
  });
  const labelOverlaps = labels.reduce((count, current, index) => count + labels.slice(index + 1).filter((other) => intersects(current.rect, other.rect)).length, 0);
  assert(labelOverlaps === 0, 'horse labels should avoid label-label bbox overlap');
  const bubbleMatches = [...html.matchAll(/<g class="message-bubble" transform="translate\(([\d.-]+) ([\d.-]+)\)"><rect width="([\d.-]+)" height="([\d.-]+)"/g)];
  const bubbleRects = bubbleMatches.map((match) => ({ x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]) }));
  const bubbleOverlaps = labels.reduce((count, label) => count + bubbleRects.filter((rect) => intersects(label.rect, rect)).length, 0);
  assert(bubbleOverlaps === 0, 'horse labels should avoid riding message bubble bboxes');
}

function assertJumbotronSpriteFacing(html) {
  assertIncludes(html, 'horse-rider-facing', 'jumbotron should wrap rider sprites in a facing-only group');
  assertIncludes(html, 'data-facing="left"', 'jumbotron should flip left-facing rider sprites from track tangent');
  assertIncludes(html, 'data-facing="right"', 'jumbotron should keep right-facing rider sprites from track tangent');
  assertIncludes(html, 'transform="scale(-1 1)"', 'left-facing rider sprites should use horizontal flip only');
  assertIncludes(html, 'transform="scale(1 1)"', 'right-facing rider sprites should use horizontal scale only');
  assert(!/<g class="horse [^"]*"[^>]*transform="translate\([^)]+\) rotate\(/.test(html), 'horse groups should translate only and never continuously rotate sprites');
  assert(!/<text class="debug-label" transform="rotate\(/.test(html), 'rank text should remain upright without inverse rotation');
  assert(!/<g class="horse-status-pill" transform="rotate\(/.test(html), 'status pills should remain upright without inverse rotation');
  const groups = [...html.matchAll(/<g class="horse-rider-facing" data-facing="(left|right)" transform="(scale\(-?1 1\))">/g)];
  assert(groups.length >= 8, 'multi-horse preview should expose facing metadata for rider sprites');
  assert(groups.every(([, facing, transform]) => (facing === 'left' && transform === 'scale(-1 1)') || (facing === 'right' && transform === 'scale(1 1)')), 'rider sprite facing metadata should match horizontal flip transform');
}

function assertBubblePlanTiming(plan, rules) {
  const bubbles = plan.bubbles.map((item) => ({ start: item.startSecond, duration: item.durationSecond }));
  const cycle = rules.cycleSeconds;
  const average = rules.averageVisibleCount;
  assert([34, 42, 48, 60, 72, 84, 96, 108, 120].includes(cycle), 'bubble API should expose adaptive cycle bucket');
  assert(bubbles.length < 3 ? average <= 1.8 : average >= 1.2 && average <= 1.8, 'bubble API should keep average visibility around 1.5');
  const events = bubbles.flatMap((item) => [item.start, bubbleEndSecond(item, cycle)]);
  assert(events.every((event, index) => events.slice(index + 1).every((other) => circularSecondDistance(event, other, cycle) >= 1)), 'bubble API should stagger start and end events');
  for (let second = 0; second < cycle; second += 1) {
    assert(bubbles.filter((item) => bubbleVisibleAtSecond(item, second, cycle)).length <= 3, 'bubble API should cap visible bubbles');
  }
}

function assertJumbotronBubbleApi(data) {
  assert(data.version, 'bubble API should expose version');
  assert(Array.isArray(data.queue), 'bubble API should expose queue');
  assert(data.plan && Array.isArray(data.plan.bubbles), 'bubble API should expose plan bubbles');
  assert(data.rules && Number.isFinite(data.rules.cycleSeconds), 'bubble API should expose rules');
  assertIncludes(data.bubbleLayerHtml, 'id="jumbotron-bubble-layer"', 'bubble API should return replaceable bubble layer');
  assertIncludes(data.bubbleLayerHtml, 'message-bubble-anchor', 'bubble API should return bubble anchors');
  assert(data.queue.every((item) => !Object.hasOwn(item, 'summary') && !Object.hasOwn(item, 'message')), 'bubble queue should not expose content payload fields');
  assert(data.queue.every((item) => Object.hasOwn(item, 'queueId') && Object.hasOwn(item, 'entryId') && Object.hasOwn(item, 'priority') && Object.hasOwn(item, 'durationSecond') && Object.hasOwn(item, 'sizeHint')), 'bubble queue should expose algorithm fields');
  assertBubblePlanTiming(data.plan, data.rules);
}

function assertJumbotronDataEvidence(data, expected) {
  assert(data.profileAlias === expected.alias, `${expected.alias} evidence should echo profile alias`);
  assert(data.dataProfileId === expected.dataProfileId, `${expected.alias} evidence should echo canonical profile id`);
  assert(data.entryCount === expected.entryCount, `${expected.alias} evidence should expose entry count`);
  assert(data.messageCount === expected.messageCount, `${expected.alias} evidence should expose message count`);
  assert(data.attentionItemCount === expected.attentionItemCount, `${expected.alias} evidence should expose attention item count`);
  assert(data.validatorStatus === expected.validatorStatus, `${expected.alias} evidence should expose validator status`);
  assert(data.motionStateCoverage.complete === expected.motionComplete, `${expected.alias} evidence should expose motion coverage completeness`);
  assert(data.messageTypeCoverage.complete === expected.messageComplete, `${expected.alias} evidence should expose message coverage completeness`);
  assert(data.publicHiddenFields.rawValuesExcludedFromEvidence === true, `${expected.alias} evidence should hide raw URL values`);
  assert(data.publicHiddenFields.fields.some((item) => item.field === 'remoteCockpitUrl' && item.count === expected.entryCount), `${expected.alias} evidence should count hidden remoteCockpitUrl fields`);
  assert(data.publicHiddenFields.fields.some((item) => item.field === 'targetUrl' && item.count >= expected.messageCount), `${expected.alias} evidence should count hidden targetUrl fields`);
  assert(data.profileUsageGuard.smoke8VisualLowLoadOnly === (expected.alias === 'smoke-8'), `${expected.alias} evidence should guard smoke-8 usage`);
  assert(data.profileUsageGuard.coverage9EnumCoverageOnly === (expected.alias === 'coverage-9'), `${expected.alias} evidence should guard coverage-9 usage`);
  assert(data.lastMessageMapping.aggregate.entryCount === expected.entryCount, `${expected.alias} mapping should count entries`);
  assert(data.lastMessageMapping.aggregate.resolvedCount === expected.entryCount, `${expected.alias} mapping should resolve existing latestMessageId values`);
  assert(data.lastMessageMapping.aggregate.fallbackCount === 0, `${expected.alias} mapping should not need fallback for current entries`);
  assert(data.lastMessageMapping.aggregate.unresolvedCount === 0, `${expected.alias} mapping should not leave unresolved entries`);
  assert(data.lastMessageMapping.aggregate.syntheticMissingIdFallsBack === true, `${expected.alias} mapping should prove synthetic fallback`);
  assert(data.lastMessageMapping.entryMappings.every((entry) => entry.latestMessageId && entry.lastMessageResolved && entry.fallbackUsed === false && entry.lastMessage?.summaryPresent === true && entry.targetUrlHidden === true), `${expected.alias} mapping should expose per-entry resolved evidence`);
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function request(path, options = {}) {
  return fetch(`http://127.0.0.1:${port}${path}`, { redirect: 'manual', ...options });
}

async function login(username, password) {
  const response = await request('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password })
  });
  return {
    response,
    cookie: response.headers.get('set-cookie')?.split(';')[0] || '',
    location: response.headers.get('location') || ''
  };
}

async function text(path, cookie) {
  const response = await request(path, { headers: cookie ? { cookie } : {} });
  return { response, body: await response.text() };
}

async function postText(path, fields, cookie) {
  const response = await request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
    body: new URLSearchParams(fields)
  });
  return { response, body: await response.text() };
}

async function binary(path, cookie) {
  const response = await request(path, { headers: cookie ? { cookie } : {} });
  return { response, body: Buffer.from(await response.arrayBuffer()) };
}

async function json(path, cookie) {
  const response = await request(path, { headers: cookie ? { cookie } : {} });
  return { response, body: await response.json() };
}

async function submitTeam(cookie, answer = '满分答案：Race 数据留在 Organizer 侧，通过公开披露完成发现、参与和展示。', ridingRecord = '计划：证明数据主权；观察：公开摘要可见；干预：删除内部说明；验收：检查数据缺失；复盘：整理提交版本。') {
  const response = await request('/team/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ answer, ridingRecord })
  });
  return {
    response,
    body: await response.text(),
    submitCookie: response.headers.get('set-cookie')?.split(';')[0] || ''
  };
}

async function setEvaluator(cookie, enabled) {
  return request('/organizer/evaluator', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ enabled: enabled ? 'on' : 'off' })
  });
}

async function setRaceStatus(cookie, status) {
  return request('/organizer/race', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ status })
  });
}

function assertLoginPageFocused(body) {
  const forbidden = ['组织方', '队伍', '提交', '评价', '回放', '过程记录', '榜单', '数据主权', '权限', '接口'];
  for (const value of forbidden) assertNotIncludes(body, value, `login page must not explain ${value}`);
}

function assertNoLeaks(body, pageName) {
  const forbidden = [
    'race_source.json',
    'leaderboard_projection.json',
    'evaluation_policy.json',
    'data_boundary_policy.json',
    'submissions.json',
    'riding_records.json',
    'replay_events.json',
    'rider_sessions.json',
    '/media/lemonhdl',
    '完整本地历史',
    '完整协作原文',
    '内部评分口径',
    '未公开样例',
    '评审记录',
    'organizer-private',
    'ary-protected-store',
    'dcr.devcompass.dev/cockpit',
    'PoC',
    'mock',
    'Demo',
    'API',
    'URL',
    '服务端',
    '.claude',
    '投影',
    '这组卡片看什么',
    'From Coder to Rider',
    '能力卡片',
    'image prompt',
    '七维',
    '最佳',
    '奖'
  ];
  for (const value of forbidden) assertNotIncludes(body, value, `${pageName} must not expose ${value}`);
}

function assertResultDimensions(body, pageName) {
  for (const value of ['产品定义', '去中心化架构', '技术验证', '智能体骑行', '展示体验', '创世骑手']) {
    assertIncludes(body, value, `${pageName} should show ${value}`);
  }
}

try {
  const loginPage = await text('/login');
  assert(loginPage.response.status === 200, 'login page should load');
  assertIncludes(loginPage.body, '登录', 'login page should focus sign in');
  assertLoginPageFocused(loginPage.body);

  const demoPage = await text('/demo');
  assert(demoPage.response.status === 200, 'recording entry should load');
  assertIncludes(demoPage.body, '/login?view=organizer', 'entry should link organizer login');
  assertIncludes(demoPage.body, '/login?view=team', 'entry should link team login');

  const jumbotronRuntimeAssets = [
    ['/assets/jumbotron/background1.png', 'image/png'],
    ['/assets/jumbotron/rider3_run.png', 'image/png'],
    ['/assets/jumbotron/rider3_walk.png', 'image/png'],
    ['/assets/jumbotron/rider3_stay.png', 'image/png'],
    ['/assets/jumbotron/rider3_run.gif', 'image/gif'],
    ['/assets/jumbotron/rider3_walk.gif', 'image/gif'],
    ['/assets/jumbotron/rider3_stay.gif', 'image/gif'],
    ['/assets/jumbotron/jumbotron-state-badges.png', 'image/png'],
    ['/assets/jumbotron/state-badge-idle.png', 'image/png'],
    ['/assets/jumbotron/state-badge-running.png', 'image/png'],
    ['/assets/jumbotron/state-badge-sprinting.png', 'image/png'],
    ['/assets/jumbotron/state-badge-slowed.png', 'image/png'],
    ['/assets/jumbotron/state-badge-blocked.png', 'image/png'],
    ['/assets/jumbotron/state-badge-pit_stop.png', 'image/png'],
    ['/assets/jumbotron/state-badge-takeover.png', 'image/png'],
    ['/assets/jumbotron/state-badge-finished.png', 'image/png'],
    ['/assets/jumbotron/state-badge-stale.png', 'image/png']
  ];
  for (const [assetPath, contentType] of jumbotronRuntimeAssets) {
    const asset = await request(assetPath);
    assert(asset.status === 200, `${assetPath} should be served from the Jumbotron runtime asset allowlist`);
    assert(asset.headers.get('content-type') === contentType, `${assetPath} should be served as ${contentType}`);
  }
  const blockedAsset = await request('/assets/jumbotron/label.png');
  assert(blockedAsset.status === 404, 'non-runtime collaborator assets should not be served by the Jumbotron allowlist');

  const yard = await text('/yard');
  assert(yard.response.status === 200, 'public yard should load');
  assertIncludes(yard.body, 'Public Yard', 'yard should show public race discovery');
  assertIncludes(yard.body, 'ARY GRS 001：Product Definition Race', 'yard should show disclosed race');
  assertIncludes(yard.body, 'Organizer 数据可用', 'yard should show public source state');
  assertNoLeaks(yard.body, 'public yard');

  const jumbotron = await text('/jumbotron');
  assert(jumbotron.response.status === 200, 'jumbotron should load');
  assertIncludes(jumbotron.body, '赛事大屏', 'jumbotron should show public race live view');
  assertIncludes(jumbotron.body, '实时赛道', 'jumbotron should show main track');
  assertIncludes(jumbotron.body, '/assets/jumbotron/background1.png', 'jumbotron should render collaborator track background asset');
  assertIncludes(jumbotron.body, 'track-background-image', 'jumbotron should keep track background as its own SVG layer');
  assertIncludes(jumbotron.body, 'horse-rider-sprite', 'jumbotron should render collaborator rider sprites');
  assertNotIncludes(jumbotron.body, '<circle class="horse-body"', 'jumbotron should not render fallback circle when rider sprites exist');
  assertNotIncludes(jumbotron.body, '<path class="horse-arrow"', 'jumbotron should not render fallback flag when rider sprites exist');
  assertIncludes(jumbotron.body, '/assets/jumbotron/rider3_run.gif', 'jumbotron should map running and sprinting entries to animated run sprite');
  assertIncludes(jumbotron.body, '/assets/jumbotron/rider3_walk.gif', 'jumbotron should map blocked/takeover/pit_stop entries to animated walk sprite');
  assertIncludes(jumbotron.body, '/assets/jumbotron/rider3_stay.gif', 'jumbotron should map idle/slowed/finished/stale entries to animated stay sprite');
  assertIncludes(jumbotron.body, 'horse-status-badge', 'jumbotron should render no-text state badge image assets');
  assertIncludes(jumbotron.body, '/assets/jumbotron/state-badge-', 'jumbotron should use per-motion-state badge assets');
  assertIncludes(jumbotron.body, 'AI Sudoku', 'jumbotron should show curated mock-data leader');
  assertIncludes(jumbotron.body, 'DevCompass Racing', 'jumbotron should show curated mock-data entry');
  assertIncludes(jumbotron.body, 'GreenRoute', 'jumbotron should show curated mock-data tail entry');
  assertIncludes(jumbotron.body, '冲线完成', 'jumbotron should show enriched finished state');
  assertIncludes(jumbotron.body, '违规提示', 'jumbotron should show enriched violation message');
  assertIncludes(jumbotron.body, 'GreenRoute · 47%', 'jumbotron should show entry progress percentage');
  assertIncludes(jumbotron.body, '小地图', 'jumbotron should show mini map');
  assertIncludes(jumbotron.body, '远端弯道', 'jumbotron should show Chinese checkpoint labels');
  assertNotIncludes(jumbotron.body, 'Far Turn', 'public jumbotron should not expose unclear English checkpoints');
  assertNotIncludes(jumbotron.body, 'Back Straight', 'public jumbotron should not expose unclear English checkpoints');
  assertNotIncludes(jumbotron.body, 'Home Straight', 'public jumbotron should not expose unclear English checkpoints');
  assertNotIncludes(jumbotron.body, 'Remote Racing Cockpit', 'public jumbotron should not foreground internal cockpit wording');
  assertIncludes(jumbotron.body, 'horse-state-sprinting', 'jumbotron should derive motion-state visual classes');
  assertIncludes(jumbotron.body, 'horse-rank-leader', 'jumbotron should highlight the leading entry');
  assertIncludes(jumbotron.body, 'horse-status-pill', 'jumbotron should show short motion status pills on track');
  assertIncludes(jumbotron.body, 'track-alert-ring', 'jumbotron should highlight high risk entries on track');
  assertIncludes(jumbotron.body, 'gap-pill', 'jumbotron should show TOP3 progress gap labels');
  assertIncludes(jumbotron.body, '最近消息：', 'focus detail should prioritize latest message');
  assertIncludes(jumbotron.body, 'jumbotronLowPulse', 'jumbotron should include low-frequency live atmosphere animation');
  assertIncludes(jumbotron.body, '队伍图例', 'jumbotron should show team legend');
  assertIncludes(jumbotron.body, '协作入口', 'jumbotron should show ticker action');
  assertIncludes(jumbotron.body, '系统时间', 'jumbotron should show system time');
  assertNotIncludes(jumbotron.body, 'HorsePose', 'public jumbotron should hide runtime debug output');
  assertNotIncludes(jumbotron.body, 'Track Profile 校准器 Preview', 'public jumbotron should hide calibrator by default');
  assertNotIncludes(jumbotron.body, '调试模式', 'public jumbotron should hide debug mode by default');
  assertNotIncludes(jumbotron.body, 'Track Profile 校验', 'public jumbotron should hide validation by default');
  assertIncludes(jumbotron.body, 'jumbotron-drawer', 'jumbotron should use collapsible drawer cards for auxiliary panels');
  assertIncludes(jumbotron.body, 'jumbotron-drawer-icon', 'jumbotron drawers should show a visible expand indicator');
  assertIncludes(jumbotron.body, 'font-size:34px', 'jumbotron drawer indicator should be large enough to notice');
  assertIncludes(jumbotron.body, 'overflow-anchor:none', 'jumbotron drawers should keep hover title positions stable while expanding');
  assertIncludes(jumbotron.body, 'liveAside.scrollTop += currentTop - active.top', 'jumbotron drawers should anchor hovered titles during expansion');
  assertIncludes(jumbotron.body, 'padding-bottom .26s ease', 'jumbotron drawers should expand downward without moving the body upward first');
  assertNotIncludes(jumbotron.body, 'transform:translateY(-4px)', 'jumbotron drawer body should not shift upward during hover expansion');
  assertIncludes(jumbotron.body, 'jumbotron-profile-drawer', 'jumbotron should expose collapsible data profile selector');
  assertIncludes(jumbotron.body, '数据档位', 'jumbotron data profile selector should be Chinese');
  assertIncludes(jumbotron.body, '完整数据档位', 'jumbotron should show full profile in Chinese');
  assertIncludes(jumbotron.body, '档位编号：curated-full-12', 'jumbotron should show full canonical profile id in Chinese');
  assertIncludes(jumbotron.body, '轻量演示档位', 'jumbotron should show smoke profile in Chinese');
  assertIncludes(jumbotron.body, '覆盖验证档位', 'jumbotron should show coverage profile in Chinese');
  assertNotIncludes(jumbotron.body, 'Data Profile', 'public jumbotron should not expose English data profile heading');
  assertNotIncludes(jumbotron.body, 'dataProfileId=', 'public jumbotron should not expose English data profile label');
  assertIncludes(jumbotron.body, '/jumbotron?profile=smoke-8', 'jumbotron should link smoke-8 profile');
  assertIncludes(jumbotron.body, '/jumbotron?profile=coverage-9', 'jumbotron should link coverage-9 profile');
  assertIncludes(jumbotron.body, '/api/jumbotron-bubbles?profile=full', 'jumbotron should poll bubble queue API for selected profile');
  assertIncludes(jumbotron.body, '现场播报', 'jumbotron should show ticker');
  assertIncludes(jumbotron.body, '风险 / 阻塞 / 违规', 'jumbotron should show attention categories');
  assertIncludes(jumbotron.body, '悬停提示', 'jumbotron should expose hover tooltip structure');
  assertIncludes(jumbotron.body, '焦点详情', 'jumbotron should expose focus details panel');
  assertIncludes(jumbotron.body, '悬停预览，点击固定', 'jumbotron should explain focus interaction');
  assertIncludes(jumbotron.body, '队伍 · #', 'jumbotron should expose pinned entry focus detail content');
  assertIncludes(jumbotron.body, 'data-focus-kind="entry"', 'jumbotron should support entry focus details');
  assertIncludes(jumbotron.body, 'data-focus-kind="message"', 'jumbotron should support message focus details');
  assertIncludes(jumbotron.body, 'id="jumbotron-bubble-layer"', 'jumbotron should expose replaceable bubble layer');
  assertIncludes(jumbotron.body, '/api/jumbotron-bubbles', 'jumbotron should poll bubble queue API');
  assertIncludes(jumbotron.body, 'setInterval(syncBubbleLayer, 2500)', 'jumbotron should sync bubble layer without page refresh');
  assertSvgMessageBubblesInViewBox(jumbotron.body);
  assertSvgHorseLabelsAvoidBboxes(jumbotron.body);
  assertJumbotronSpriteFacing(jumbotron.body);
  const bubbleApi = await json('/api/jumbotron-bubbles');
  assert(bubbleApi.response.status === 200, 'bubble API should load');
  assert(bubbleApi.body.dataProfileId === 'curated-full-12', 'bubble API should default to full profile');
  assertJumbotronBubbleApi(bubbleApi.body);
  assertNoLeaks(JSON.stringify(bubbleApi.body), 'jumbotron bubble API');
  const smokeBubbleApi = await json('/api/jumbotron-bubbles?profile=smoke-8');
  assert(smokeBubbleApi.response.status === 200, 'smoke-8 bubble API should load');
  assert(smokeBubbleApi.body.dataProfileId === 'smoke-8-visual-low-load', 'smoke-8 bubble API should use selected profile');
  const evidenceExpectations = [
    { alias: 'full', dataProfileId: 'curated-full-12', entryCount: 12, messageCount: 13, attentionItemCount: 13, validatorStatus: 'pass', motionComplete: true, messageComplete: true },
    { alias: 'smoke-8', dataProfileId: 'smoke-8-visual-low-load', entryCount: 8, messageCount: 9, attentionItemCount: 9, validatorStatus: 'pass_with_expected_warnings', motionComplete: false, messageComplete: false },
    { alias: 'coverage-9', dataProfileId: 'coverage-9-enum-complete', entryCount: 9, messageCount: 10, attentionItemCount: 11, validatorStatus: 'pass', motionComplete: true, messageComplete: true }
  ];
  for (const expectation of evidenceExpectations) {
    const evidence = await json(`/api/jumbotron-data-evidence?profile=${expectation.alias}`);
    assert(evidence.response.status === 200, `${expectation.alias} data evidence endpoint should load`);
    assertJumbotronDataEvidence(evidence.body, expectation);
    assertNoLeaks(JSON.stringify(evidence.body), `${expectation.alias} jumbotron data evidence API`);
  }
  const invalidProfilePage = await text('/jumbotron?profile=missing-profile');
  assert(invalidProfilePage.response.status === 200, 'invalid profile page should return explicit HTML error');
  assertIncludes(invalidProfilePage.body, 'Jumbotron data profile 不存在', 'invalid profile page should not silently fall back');
  assertIncludes(invalidProfilePage.body, 'full (curated-full-12)', 'invalid profile page should list allowed profiles');
  const invalidEvidence = await json('/api/jumbotron-data-evidence?profile=missing-profile');
  assert(invalidEvidence.response.status === 400, 'invalid profile evidence API should reject request');
  assert(invalidEvidence.body.error === 'invalid_jumbotron_data_profile', 'invalid profile evidence API should return explicit error');
  assert(invalidEvidence.body.allowedProfiles.some((profile) => profile.alias === 'coverage-9'), 'invalid profile evidence API should list allowed profiles');
  assertIncludes(jumbotron.body, '/jumbotron/calibrator', 'jumbotron should link calibrator without showing tools by default');
  assertNoLeaks(jumbotron.body, 'jumbotron');

  const jumbotronDebug = await text('/jumbotron?debug=1');
  assert(jumbotronDebug.response.status === 200, 'jumbotron debug should load');
  assertIncludes(jumbotronDebug.body, 'data evidence debug panel', 'debug jumbotron should show data evidence panel');
  assertIncludes(jumbotronDebug.body, 'dataProfileId', 'debug jumbotron should show data profile id field');
  assertIncludes(jumbotronDebug.body, 'curated-full-12', 'debug jumbotron should show canonical full profile id');
  assertIncludes(jumbotronDebug.body, 'entryCount / messageCount / attentionItemCount', 'debug jumbotron should show counts');
  assertIncludes(jumbotronDebug.body, 'motionStateCoverage', 'debug jumbotron should show motion coverage');
  assertIncludes(jumbotronDebug.body, 'messageTypeCoverage', 'debug jumbotron should show message coverage');
  assertIncludes(jumbotronDebug.body, 'publicHiddenFields', 'debug jumbotron should show public-hidden fields');
  assertIncludes(jumbotronDebug.body, 'validatorStatus', 'debug jumbotron should show validator status');
  assertIncludes(jumbotronDebug.body, 'lastMessage mapping evidence', 'debug jumbotron should show lastMessage mapping table');
  assertIncludes(jumbotronDebug.body, 'lastMessageResolved', 'debug jumbotron should show lastMessage resolved status');
  assertIncludes(jumbotronDebug.body, 'fallbackUsed', 'debug jumbotron should show lastMessage fallback status');
  assertIncludes(jumbotronDebug.body, 'lastMessage.type', 'debug jumbotron should show lastMessage type');
  assertIncludes(jumbotronDebug.body, 'lastMessage.displayMode', 'debug jumbotron should show lastMessage display mode');
  assertIncludes(jumbotronDebug.body, 'targetUrlHidden', 'debug jumbotron should hide targetUrl as boolean evidence');
  assertIncludes(jumbotronDebug.body, 'HorsePose', 'debug jumbotron should show runtime output');
  assertIncludes(jumbotronDebug.body, 'Track Profile 校准器 Preview', 'debug jumbotron should show calibrator preview');
  assertIncludes(jumbotronDebug.body, '调试模式', 'debug jumbotron should show debug mode');
  assertIncludes(jumbotronDebug.body, 'Track Profile 校验', 'debug jumbotron should show profile validation');
  assertIncludes(jumbotronDebug.body, '运行时校验', 'debug jumbotron should show runtime validation');
  assertIncludes(jumbotronDebug.body, '数据契约校验', 'debug jumbotron should validate adapter contract');
  assertIncludes(jumbotronDebug.body, 'Profile 版本匹配', 'debug jumbotron should validate profile version');
  assertIncludes(jumbotronDebug.body, '泳道偏移不重复', 'debug jumbotron should validate unique lane offsets');
  assertIncludes(jumbotronDebug.body, '泳道偏移重复检测', 'debug jumbotron should validate duplicate lane offsets');
  assertIncludes(jumbotronDebug.body, '背景文件真实存在', 'debug jumbotron should validate background file existence');
  assertIncludes(jumbotronDebug.body, '弯道转角自然', 'debug jumbotron should validate turn angle');
  assertIncludes(jumbotronDebug.body, '曲率 warning', 'debug jumbotron should validate curvature warning');
  assertIncludes(jumbotronDebug.body, 'obstacleCount', 'debug jumbotron should validate obstacle count contract');
  assertIncludes(jumbotronDebug.body, 'violationCount', 'debug jumbotron should validate violation count contract');
  assertIncludes(jumbotronDebug.body, 'caProvider', 'debug jumbotron should validate caProvider contract');
  assertIncludes(jumbotronDebug.body, 'updatedAt', 'debug jumbotron should validate updatedAt contract');
  assertIncludes(jumbotronDebug.body, '状态机覆盖', 'debug jumbotron should show all runtime motion states');
  assertIncludes(jumbotronDebug.body, 'blocked / pit_stop / takeover / finished / stale', 'debug jumbotron should show blocked pit_stop takeover finished stale states');
  assertIncludes(jumbotronDebug.body, 'sampleInterpolatedPose', 'debug jumbotron should show s-axis interpolation evidence');
  assertIncludes(jumbotronDebug.body, '自适应循环平均约 1.5 条可见气泡', 'debug jumbotron should show adaptive average bubble rule');
  assertIncludes(jumbotronDebug.body, '气泡冒出 / 消失事件错峰', 'debug jumbotron should show staggered bubble events');
  assertIncludes(jumbotronDebug.body, '无合适位置 fallback ticker', 'debug jumbotron should show ticker fallback rule');
  assertIncludes(jumbotronDebug.body, '至少 8 匹马多马预览', 'debug jumbotron should validate multi-horse preview');
  assertIncludes(jumbotronDebug.body, '多马预览相互距离', 'debug jumbotron should validate multi-horse distance');
  assertIncludes(jumbotronDebug.body, '多马预览严重重叠检测', 'debug jumbotron should validate severe overlap');
  assertIncludes(jumbotronDebug.body, '气泡顶部遮挡检测', 'debug jumbotron should validate bubble top-overlap');
  assertIncludes(jumbotronDebug.body, '气泡矩形顶部遮挡检测', 'debug jumbotron should validate bubble rectangle overlap');
  assertIncludes(jumbotronDebug.body, '马匹标签 bbox 自适应避让', 'debug jumbotron should validate horse label adaptive layout');
  assertIncludes(jumbotronDebug.body, '马匹标签 viewBox 边界', 'debug jumbotron should validate horse label viewBox bounds');
  assertIncludes(jumbotronDebug.body, '马匹标签互不重叠', 'debug jumbotron should validate horse label separation');
  assertIncludes(jumbotronDebug.body, '背景文件真实存在', 'debug jumbotron should validate real background file existence');
  assertIncludes(jumbotronDebug.body, '背景资产 allowlist', 'debug jumbotron should validate background allowlist');
  assertIncludes(jumbotronDebug.body, '待人工复核', 'debug jumbotron should keep pending manual checks pending');
  assertIncludes(jumbotronDebug.body, '! 弯道自然人工确认', 'pending manual curve confirmation should not pass');
  assertNoLeaks(jumbotronDebug.body, 'jumbotron debug');

  const jumbotronSmoke = await text('/jumbotron?profile=smoke-8');
  assert(jumbotronSmoke.response.status === 200, 'smoke-8 jumbotron should load');
  assertIncludes(jumbotronSmoke.body, '档位编号：smoke-8-visual-low-load', 'smoke-8 jumbotron should show canonical profile id in Chinese');
  assertIncludes(jumbotronSmoke.body, '/api/jumbotron-bubbles?profile=smoke-8', 'smoke-8 jumbotron should poll matching bubble profile');
  assertNotIncludes(jumbotronSmoke.body, 'HorsePose', 'smoke-8 public jumbotron should hide runtime debug output');
  assertNoLeaks(jumbotronSmoke.body, 'smoke-8 jumbotron');

  const jumbotronCoverageDebug = await text('/jumbotron?debug=1&profile=coverage-9');
  assert(jumbotronCoverageDebug.response.status === 200, 'coverage-9 debug jumbotron should load');
  assertIncludes(jumbotronCoverageDebug.body, 'coverage-9-enum-complete', 'coverage-9 debug jumbotron should show canonical profile id');
  assertIncludes(jumbotronCoverageDebug.body, 'motionStateCoverage', 'coverage-9 debug jumbotron should show motion coverage');
  assertIncludes(jumbotronCoverageDebug.body, 'complete=true', 'coverage-9 debug jumbotron should show complete coverage evidence');
  assertIncludes(jumbotronCoverageDebug.body, 'resolvedCount=9/9', 'coverage-9 debug jumbotron should show lastMessage resolved aggregate');
  assertNoLeaks(jumbotronCoverageDebug.body, 'coverage-9 jumbotron debug');

  const calibrator = await text('/jumbotron/calibrator');
  assert(calibrator.response.status === 200, 'calibrator should load');
  assertIncludes(calibrator.body, 'Track Profile Calibrator MVP', 'calibrator should expose MVP entry');
  assertIncludes(calibrator.body, '设计 / 资产生产工具', 'calibrator should present itself as design asset tool');
  assertIncludes(calibrator.body, 'Top Toolbar', 'calibrator should expose top toolbar');
  assertIncludes(calibrator.body, 'Main Canvas', 'calibrator should expose main canvas');
  assertIncludes(calibrator.body, 'Right Inspector', 'calibrator should expose right inspector');
  assertIncludes(calibrator.body, 'Bottom Preview Bar', 'calibrator should expose bottom preview bar');
  assertIncludes(calibrator.body, 'Import Background', 'calibrator should expose background import');
  assertIncludes(calibrator.body, '/assets/jumbotron/background1.png', 'calibrator should expose extracted track background option');
  assertIncludes(calibrator.body, '/assets/jumbotron/example.png', 'calibrator should expose extracted example background option');
  assertIncludes(calibrator.body, 'Import Candidate Profile', 'calibrator should expose candidate profile import');
  assertIncludes(calibrator.body, 'Validate', 'calibrator should expose validate action');
  assertIncludes(calibrator.body, 'Preview', 'calibrator should expose preview action');
  assertIncludes(calibrator.body, 'Export', 'calibrator should expose export action');
  assertIncludes(calibrator.body, 'Export frozen track.profile.json candidate', 'calibrator should export frozen candidate');
  assertIncludes(calibrator.body, 'data-asset-review-status="pending"', 'calibrator should default asset review to pending');
  assertIncludes(calibrator.body, 'pending human review', 'calibrator should show pending human review by default');
  assertIncludes(calibrator.body, 'candidate preview', 'calibrator should distinguish candidate preview from formal asset');
  assertNotIncludes(calibrator.body, 'data-asset-review-status="confirmed"', 'calibrator default pending state should not be marked confirmed');
  assertNotIncludes(calibrator.body, 'confirmed by human review</strong>', 'calibrator default pending state should not claim human confirmation');
  assertIncludes(calibrator.body, '正式资产 confirmed', 'calibrator should not claim formal asset confirmation');
  assertIncludes(calibrator.body, 'Background Layer', 'calibrator should expose background layer');
  assertIncludes(calibrator.body, 'Centerline Layer', 'calibrator should expose centerline layer');
  assertIncludes(calibrator.body, 'Control Points Layer', 'calibrator should expose control points layer');
  assertIncludes(calibrator.body, 'id="calibrator-canvas"', 'calibrator should expose interactive canvas');
  assertIncludes(calibrator.body, 'data-control-point', 'calibrator should render draggable control point handles');
  assertIncludes(calibrator.body, 'Undo / 回退', 'calibrator should expose undo action');
  assertIncludes(calibrator.body, 'Redo / 重做', 'calibrator should expose redo action');
  assertIncludes(calibrator.body, 'data-context-menu', 'calibrator should expose right-click context menu');
  assertIncludes(calibrator.body, 'data-context-action="insert-nearest-segment"', 'calibrator should expose nearest-segment insert action');
  assertIncludes(calibrator.body, 'data-background-image', 'calibrator should render real background image layer');
  assertIncludes(calibrator.body, 'data-start-handle', 'calibrator should expose draggable start handle');
  assertIncludes(calibrator.body, 'data-finish-handle', 'calibrator should expose draggable finish handle');
  assertIncludes(calibrator.body, 'data-checkpoints-layer', 'calibrator should expose editable checkpoint layer');
  assertIncludes(calibrator.body, 'data-zone-layer', 'calibrator should expose editable zone layer');
  assertIncludes(calibrator.body, 'data-zone-type="messageZones"', 'calibrator should expose message zone editing layer');
  assertIncludes(calibrator.body, 'data-zone-type="noBubbleZones"', 'calibrator should expose no bubble zone editing layer');
  assertIncludes(calibrator.body, 'data-zone-type="riskZones"', 'calibrator should expose risk zone editing layer');
  assertIncludes(calibrator.body, 'Lane Count', 'calibrator should expose lane count control');
  assertIncludes(calibrator.body, 'Lane Spacing', 'calibrator should expose lane spacing control');
  assertIncludes(calibrator.body, 'Advanced JSON mode', 'calibrator should keep JSON editing as advanced mode');
  assertIncludes(calibrator.body, '画布操作已开启', 'calibrator should explain canvas point editing');
  assertIncludes(calibrator.body, '拖拽 centerline points：已支持画布直接移动', 'calibrator should mark centerline dragging as implemented');
  assertIncludes(calibrator.body, 'Lane Preview Layer', 'calibrator should expose lane preview layer');
  assertIncludes(calibrator.body, 'Checkpoint Layer', 'calibrator should expose checkpoint layer');
  assertIncludes(calibrator.body, 'Horse Preview Layer', 'calibrator should expose horse preview layer');
  assertIncludes(calibrator.body, 'Message Bubble Preview Layer', 'calibrator should expose message bubble preview layer');
  assertIncludes(calibrator.body, 'Track Info', 'calibrator should expose track info inspector');
  assertIncludes(calibrator.body, 'Geometry', 'calibrator should expose geometry inspector');
  assertIncludes(calibrator.body, '终点线', 'calibrator should expose finish line inspector');
  assertIncludes(calibrator.body, 'Direction', 'calibrator should expose direction inspector');
  assertIncludes(calibrator.body, 'Lanes', 'calibrator should expose lanes inspector');
  assertIncludes(calibrator.body, 'Checkpoints', 'calibrator should expose checkpoints inspector');
  assertIncludes(calibrator.body, 'Message Bubble', 'calibrator should expose message bubble inspector');
  assertIncludes(calibrator.body, 'Validation Results', 'calibrator should expose validation results inspector');
  assertIncludes(calibrator.body, 'Progress Scrubber', 'calibrator should expose scrubber');
  assertIncludes(calibrator.body, 'Horse Count', 'calibrator should expose horse count');
  assertIncludes(calibrator.body, 'Speed', 'calibrator should expose preview speed');
  assertIncludes(calibrator.body, 'Play / Pause', 'calibrator should expose play pause control');
  assertIncludes(calibrator.body, 'Scenario Presets', 'calibrator should expose scenario presets');
  assertIncludes(calibrator.body, '添加 centerline point', 'calibrator should expose add point action');
  assertIncludes(calibrator.body, '删除点位', 'calibrator should expose delete point action');
  assertIncludes(calibrator.body, 'Reverse Direction / 反转路径方向', 'calibrator should expose reverse direction action');
  assertIncludes(calibrator.body, '平滑路径预览', 'calibrator should expose smoothing preview');
  assertIncludes(calibrator.body, 'createJumbotronRuntime / sampleHorsePose', 'calibrator should state runtime reuse');
  assertIncludes(calibrator.body, 'schemaVersion', 'calibrator export should include schemaVersion');
  assertIncludes(calibrator.body, 'trackId', 'calibrator export should include trackId');
  assertIncludes(calibrator.body, 'viewBox', 'calibrator export should include viewBox');
  assertIncludes(calibrator.body, 'centerline', 'calibrator export should include centerline');
  assertIncludes(calibrator.body, 'messageZones', 'calibrator export should include messageZones');
  assertIncludes(calibrator.body, 'noBubbleZones', 'calibrator export should include noBubbleZones');
  assertIncludes(calibrator.body, 'riskZones', 'calibrator export should include riskZones');
  assertIncludes(calibrator.body, 'scrubber 单马', 'calibrator should preview scrubber horse');
  assertIncludes(calibrator.body, '多马预览', 'calibrator should preview multiple horses');
  assertIncludes(calibrator.body, 'message zone 画布编辑 · implemented', 'calibrator should implement message zone canvas editing');
  assertIncludes(calibrator.body, 'no bubble zone 编辑 · implemented', 'calibrator should implement no bubble zone canvas editing');
  assertIncludes(calibrator.body, 'risk zone 画布编辑 · implemented', 'calibrator should implement risk zone canvas editing');
  assertIncludes(calibrator.body, '拖拽状态变化证据 · implemented', 'calibrator should expose drag state proof as implemented');
  assertIncludes(calibrator.body, 'AI 候选点导入 · pending', 'calibrator should list AI candidate P1 pending');
  assertIncludes(calibrator.body, '自动检测尖角 · pending', 'calibrator should list corner detection P1 pending');
  assertIncludes(calibrator.body, 'lane 快捷调整 · implemented', 'calibrator should implement lane quick adjustment');
  assertIncludes(calibrator.body, '导出 debug-preview.png · implemented', 'calibrator should list debug preview export P1 implemented');
  assertIncludes(calibrator.body, 'Week2-Jumbotron/review-ledger/screenshots/2026-06-13-jumbotron-debug-preview-export/debug-preview.png', 'calibrator should expose debug preview PNG evidence path');
  assertIncludes(calibrator.body, 'JSON diff preview · implemented', 'calibrator should implement JSON diff preview');
  assertIncludes(calibrator.body, 'Imported profile → Exported frozen candidate', 'calibrator should show JSON diff preview table');
  assertIncludes(calibrator.body, '暂无字段差异', 'calibrator should show empty diff state');
  assertIncludes(calibrator.body, '校准证明', 'calibrator should expose proof mode panel');
  assertIncludes(calibrator.body, '打开演示模式', 'calibrator should expose recording walkthrough proof panel');
  assertIncludes(calibrator.body, 'progress → centerline distance → point/rotation → laneOffset → displayAdjustment', 'calibrator should explain Jumbotron runtime mapping chain');
  assertIncludes(calibrator.body, 'Use in Jumbotron', 'calibrator should show use-in-jumbotron evidence');
  assertIncludes(calibrator.body, 'P1 Debug Preview HTML/SVG', 'calibrator should expose debug preview HTML SVG evidence');
  assertIncludes(calibrator.body, 'Capture debug preview PNG', 'calibrator should expose debug preview PNG capture entry');
  assertIncludes(calibrator.body, 'debug-preview.png</span><strong>implemented</strong>', 'calibrator should mark png export implemented');
  assertNotIncludes(calibrator.body, 'debug-preview.png 导出仍 pending', 'calibrator should not keep png export pending');
  assertIncludes(calibrator.body, 'data-drag-proof', 'calibrator should expose live drag proof panel');
  assertIncludes(calibrator.body, 'data-drag-proof-layer', 'calibrator should expose drag proof SVG layer');
  assertIncludes(calibrator.body, 'centerline point 坐标变化证据', 'calibrator should describe centerline drag coordinate proof');
  assertIncludes(calibrator.body, 'zone 坐标变化证据', 'calibrator should describe zone drag coordinate proof');
  assertIncludes(calibrator.body, "lastDragProof = buildDragProof('dragging')", 'calibrator should update proof while pointer drag changes coordinates');
  assertIncludes(calibrator.body, "lastDragProof = buildDragProof('completed')", 'calibrator should retain proof after drag completes');
  assertIncludes(calibrator.body, 'dragProof.layer.innerHTML', 'calibrator should render before/current drag evidence in SVG');
  assertNoLeaks(calibrator.body, 'track calibrator');
  const debugPreviewPng = await binary('/jumbotron/debug-preview.png');
  assert(debugPreviewPng.response.status === 200, 'debug preview png should load');
  assert(debugPreviewPng.response.headers.get('content-type') === 'image/png', 'debug preview route should return PNG content type');
  assert(debugPreviewPng.body.length > 40000, 'debug preview png should not be a blank tiny file');
  assert(debugPreviewPng.body.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'debug preview png should have PNG signature');

  const calibratorDemo = await text('/jumbotron/calibrator?demo=1');
  assert(calibratorDemo.response.status === 200, 'calibrator demo proof mode should load');
  assertIncludes(calibratorDemo.body, '推荐录制路径', 'calibrator demo should show recording guide');
  assertIncludes(calibratorDemo.body, '打开 /jumbotron，展示 Race Live View', 'calibrator demo should include step 1');
  assertIncludes(calibratorDemo.body, '多个 Racing Entry、TOP3、KPI、message bubble/ticker、risk/violation', 'calibrator demo should include race live view evidence step');
  assertIncludes(calibratorDemo.body, '底图、centerline、lane offsets、checkpoints', 'calibrator demo should include track asset proof step');
  assertIncludes(calibratorDemo.body, '单马 / 多马 preview', 'calibrator demo should include preview step');
  assertIncludes(calibratorDemo.body, 'Export frozen track.profile.json candidate', 'calibrator demo should include export candidate step');
  assertIncludes(calibratorDemo.body, '明确数据来源和可运行范围', 'calibrator demo should separate sample data, runnable implementation, and pending work');
  assertIncludes(calibratorDemo.body, 'messageZones overlay', 'calibrator demo should show zone debug preview evidence');
  assertNoLeaks(calibratorDemo.body, 'track calibrator demo');

  const addPoint = await postText('/jumbotron/calibrator', { centerlineAction: 'add', addPointX: '610', addPointY: '315', previewProgress: '37', horseCount: '5', scenarioPreset: 'spread' });
  assertIncludes(addPoint.body, 'P9', 'add point should add a visible control point before closing duplicate');
  assertIncludes(addPoint.body, 'Scrubber 37%', 'scrubber should move the preview horse');
  assertIncludes(addPoint.body, 'scrubber 单马 + 5 匹多马预览', 'horse count should control multi-horse preview');
  assertIncludes(addPoint.body, 'spread', 'scenario preset should stay selected after POST');
  assertIncludes(addPoint.body, '<td>centerline.points</td>', 'add point should produce JSON diff for centerline points');
  assertNoLeaks(addPoint.body, 'track calibrator add point');
  const deletePoint = await postText('/jumbotron/calibrator', { deletePointIndex: '1' });
  assertNotIncludes(deletePoint.body, '>P8<', 'delete point should reduce visible control point count');
  assertNoLeaks(deletePoint.body, 'track calibrator delete point');
  const reverseDirection = await postText('/jumbotron/calibrator', { reverseDirection: '1', direction: 'clockwise' });
  assertIncludes(reverseDirection.body, '<option value="counterclockwise" selected>counterclockwise</option>', 'reverse direction should toggle direction semantics');
  assertNoLeaks(reverseDirection.body, 'track calibrator reverse direction');
  const insertPoint = await postText('/jumbotron/calibrator', { centerlineAction: 'insert', insertPointIndex: '1', insertPointX: '455', insertPointY: '222' });
  assertIncludes(insertPoint.body, '455', 'nearest-segment insert should keep inserted x coordinate');
  assertIncludes(insertPoint.body, '222', 'nearest-segment insert should keep inserted y coordinate');
  assertIncludes(insertPoint.body, '<td>centerline.points</td>', 'nearest-segment insert should produce JSON diff');
  assertNoLeaks(insertPoint.body, 'track calibrator insert point');
  const startFinishEdit = await postText('/jumbotron/calibrator', { startS: '0.12', finishS: '0.88' });
  assertIncludes(startFinishEdit.body, '0.12', 'start handle edit should update startS in export');
  assertIncludes(startFinishEdit.body, '0.88', 'finish handle edit should update finishS in export');
  assertIncludes(startFinishEdit.body, '<td>startFinish.startS</td>', 'start handle edit should produce JSON diff');
  assertNoLeaks(startFinishEdit.body, 'track calibrator start finish edit');
  const checkpointEdit = await postText('/jumbotron/calibrator', { checkpoints: JSON.stringify([{ checkpointId: 'cp-test', label: 'CP Test', s: 0.42 }]) });
  assertIncludes(checkpointEdit.body, 'CP Test', 'checkpoint canvas edit should render checkpoint label');
  assertIncludes(checkpointEdit.body, 'cp-test', 'checkpoint canvas edit should persist checkpoint id');
  assertNoLeaks(checkpointEdit.body, 'track calibrator checkpoint edit');
  const lanesEdit = await postText('/jumbotron/calibrator', { lanes: JSON.stringify([{ laneId: 'lane-0', offset: -21 }, { laneId: 'lane-1', offset: 0 }, { laneId: 'lane-2', offset: 21 }]) });
  assertIncludes(lanesEdit.body, 'lane-2', 'lane quick controls should persist generated lane ids');
  assertIncludes(lanesEdit.body, '<td>lanes</td>', 'lane quick controls should produce JSON diff');
  assertNoLeaks(lanesEdit.body, 'track calibrator lanes edit');
  const zonesEdit = await postText('/jumbotron/calibrator', {
    messageZones: JSON.stringify([{ zoneId: 'message-test', label: 'Message Test', x: 720, y: 120, width: 160, height: 90 }]),
    noBubbleZones: JSON.stringify([{ zoneId: 'no-bubble-test', label: 'No Bubble Test', x: 80, y: 80, width: 180, height: 120 }]),
    riskZones: JSON.stringify([{ zoneId: 'risk-test', label: 'Risk Test', x: 840, y: 420, width: 160, height: 120 }])
  });
  assertIncludes(zonesEdit.body, 'message-test', 'message zone canvas edit should persist zone id');
  assertIncludes(zonesEdit.body, 'no-bubble-test', 'no bubble zone canvas edit should persist zone id');
  assertIncludes(zonesEdit.body, 'risk-test', 'risk zone canvas edit should persist zone id');
  assertNoLeaks(zonesEdit.body, 'track calibrator zones edit');

  const rejectedAsset = await postText('/jumbotron/calibrator', { assetReviewStatus: 'rejected' });
  assertIncludes(rejectedAsset.body, 'data-asset-review-status="rejected"', 'rejected asset review state should render rejected status');
  assertIncludes(rejectedAsset.body, 'rejected by human review', 'rejected asset review state should show human rejection');
  assertIncludes(rejectedAsset.body, 'rejected candidate 不得进入正式大屏资产流程', 'rejected candidate should not pass into formal jumbotron assets');
  assertNotIncludes(rejectedAsset.body, 'data-asset-review-status="confirmed"', 'rejected asset review state should not be marked confirmed');
  assertNotIncludes(rejectedAsset.body, 'confirmed by human review</strong>', 'rejected asset review state should not claim human confirmation');
  assertNoLeaks(rejectedAsset.body, 'track calibrator rejected asset');
  const confirmedAsset = await postText('/jumbotron/calibrator', { assetReviewStatus: 'confirmed' });
  assertIncludes(confirmedAsset.body, 'data-asset-review-status="confirmed"', 'confirmed asset review state should render confirmed status');
  assertIncludes(confirmedAsset.body, 'confirmed by human review', 'confirmed asset review state should show human confirmation');
  assertIncludes(confirmedAsset.body, '人工确认：已由人工复核通过', 'confirmed asset review state should keep explicit human boundary');
  assertIncludes(confirmedAsset.body, 'confirmed asset 进入正式大屏资产流程', 'confirmed asset review state should distinguish formal use from candidate preview');
  assertNoLeaks(confirmedAsset.body, 'track calibrator confirmed asset');

  const invalidDirection = await postText('/jumbotron/calibrator', { direction: 'sideways' });
  assertIncludes(invalidDirection.body, '! 赛道方向', 'invalid direction should fail validation');
  assertNoLeaks(invalidDirection.body, 'track calibrator invalid direction');
  const duplicateLane = await postText('/jumbotron/calibrator', { lanes: JSON.stringify([{ laneId: 'lane-a', offset: 0 }, { laneId: 'lane-b', offset: 0 }]) });
  assertIncludes(duplicateLane.body, '! 泳道偏移重复检测', 'duplicate lane offset should fail validation');
  assertIncludes(duplicateLane.body, '! 多马预览数量', 'too few lanes should fail multi-horse validation');
  assertNoLeaks(duplicateLane.body, 'track calibrator duplicate lane');
  const badCheckpoint = await postText('/jumbotron/calibrator', { checkpoints: JSON.stringify([{ checkpointId: 'bad-cp', label: 'Bad', s: 1.4 }]) });
  assertIncludes(badCheckpoint.body, '! checkpoints.s 范围', 'out-of-range checkpoint should fail validation');
  assertNoLeaks(badCheckpoint.body, 'track calibrator bad checkpoint');
  const badJson = await postText('/jumbotron/calibrator', { profileJson: '{bad json' });
  assertIncludes(badJson.body, '导入解析失败', 'bad JSON should show parse failure');
  assertNoLeaks(badJson.body, 'track calibrator bad JSON');
  const badBackground = await postText('/jumbotron/calibrator', { profileJson: JSON.stringify({ background: { src: '/assets/missing-track.webp' } }) });
  assertIncludes(badBackground.body, '! 背景文件真实存在', 'missing background file should fail validation');
  assertNoLeaks(badBackground.body, 'track calibrator bad background');
  const sharpTurn = await postText('/jumbotron/calibrator', { centerlinePoints: JSON.stringify([{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 120, y: 110 }, { x: 100, y: 100 }]) });
  assertIncludes(sharpTurn.body, '! 弯道转角自然', 'sharp turn should fail warning validation');
  assertNoLeaks(sharpTurn.body, 'track calibrator sharp turn');
  const shortPath = await postText('/jumbotron/calibrator', { centerlinePoints: JSON.stringify([{ x: 100, y: 100 }, { x: 101, y: 100 }, { x: 102, y: 100 }, { x: 100, y: 100 }]) });
  assertIncludes(shortPath.body, '! 路径长度', 'short path should fail minimum path length validation');
  assertIncludes(shortPath.body, '! 路径长度最小阈值', 'short path should fail explicit minimum threshold validation');
  assertNoLeaks(shortPath.body, 'track calibrator short path');

  const race = await text('/race/grs-001');
  assert(race.response.status === 200, 'race detail should load');
  assertIncludes(race.body, 'Public Disclosure', 'race detail should show disclosure');
  assertIncludes(race.body, '提交要求', 'race detail should show public requirements');
  assertIncludes(race.body, '参与路径', 'race detail should show participation path');
  assertNotIncludes(race.body, '完整 Race brief', 'race detail should not show private brief');
  assertNoLeaks(race.body, 'race detail');

  const organizerLogin = await login('Organizer_001', '********');
  assert(organizerLogin.location === '/organizer?view=organizer', 'organizer should enter console');
  const organizerPage = await text('/organizer', organizerLogin.cookie);
  assertIncludes(organizerPage.body, 'Race 源数据由 Organizer 持有', 'organizer page should show source ownership');
  assertIncludes(organizerPage.body, '完整 Race brief', 'organizer page may show private source brief');
  assertIncludes(organizerPage.body, '数据可用性实验', 'organizer page should expose data availability experiment');
  assertIncludes(organizerPage.body, '本地数据服务', 'organizer page should name local data service');
  assertIncludes(organizerPage.body, '切断服务', 'organizer page should expose service cut action');
  assertResultDimensions(organizerPage.body, 'organizer page');
  const organizerRaceDetail = await text('/race/grs-001', organizerLogin.cookie);
  assertIncludes(organizerRaceDetail.body, '管理 Race', 'organizer race detail should link race management');
  assertNotIncludes(organizerRaceDetail.body, '登录后参与', 'organizer race detail should not ask to log in');
  const organizerRace = await text('/organizer/race', organizerLogin.cookie);
  assertIncludes(organizerRace.body, '创建与披露', 'organizer race should expose lifecycle');
  assertIncludes(organizerRace.body, '内部评分口径', 'organizer race should show retained private material');
  assertIncludes(organizerRace.body, '披露并开放', 'organizer race should publish disclosure');

  await setRaceStatus(organizerLogin.cookie, 'expired');
  const expiredRace = await text('/race/grs-001');
  assertIncludes(expiredRace.body, '待更新', 'expired race should ask for update');
  assertNotIncludes(expiredRace.body, '提交方案</a>', 'expired race should not expose submit action');
  assertNoLeaks(expiredRace.body, 'expired race');

  await setRaceStatus(organizerLogin.cookie, 'offline');
  const offlineYard = await text('/yard');
  assertIncludes(offlineYard.body, '已下线', 'offline race should be visible as offline');
  assertNotIncludes(offlineYard.body, '>提交</a>', 'offline race should not allow submission');
  assertNoLeaks(offlineYard.body, 'offline yard');

  await setRaceStatus(organizerLogin.cookie, 'draft');
  const draftYard = await text('/yard');
  assertIncludes(draftYard.body, '暂无公开 Race', 'draft race should disappear from public yard');

  await setRaceStatus(organizerLogin.cookie, 'open');
  const reopenedRace = await text('/race/grs-001');
  assertIncludes(reopenedRace.body, '提交方案', 'open race should allow team submission after publish');

  const teamLogin = await login('team_001', '******');
  assert(teamLogin.location === '/team?view=team', 'team should enter workspace');
  const sharedCookie = `${organizerLogin.cookie}; ${teamLogin.cookie}`;
  const sameBrowserOrganizer = await text('/organizer?view=organizer', sharedCookie);
  assertIncludes(sameBrowserOrganizer.body, 'Organizer Console', 'same browser should keep organizer view');
  const sameBrowserTeam = await text('/team?view=team', sharedCookie);
  assertIncludes(sameBrowserTeam.body, 'Rider Workspace', 'same browser should keep team view');
  const teamPage = await text('/team', teamLogin.cookie);
  assertIncludes(teamPage.body, 'Rider Workspace', 'team page should show rider workspace');
  assertIncludes(teamPage.body, '待提交', 'team should start pending');
  assertNoLeaks(teamPage.body, 'team workspace');

  const lockedRecords = await text('/team/records', teamLogin.cookie);
  assertIncludes(lockedRecords.body, '尚未提交', 'records should be locked before submission');
  assertNotIncludes(lockedRecords.body, 'Team 001：证明记录', 'locked records should not show private evidence');
  assertNotIncludes(lockedRecords.body, '创世骑手', 'locked records should not show result dimensions');

  await setEvaluator(organizerLogin.cookie, false);
  const disconnectedOrganizer = await text('/organizer', organizerLogin.cookie);
  assertIncludes(disconnectedOrganizer.body, '本地数据服务已切断', 'organizer page should show local service disconnected');
  assertIncludes(disconnectedOrganizer.body, '恢复服务', 'organizer page should expose service restore action');
  const missingSubmit = await submitTeam(teamLogin.cookie);
  assertIncludes(missingSubmit.body, '数据缺失，暂无法评分', 'missing organizer data should block scoring');
  assert(!missingSubmit.submitCookie, 'missing evaluation must not unlock records');
  const stillLocked = await text('/team/records', teamLogin.cookie);
  assertIncludes(stillLocked.body, '尚未提交', 'records should remain locked when evaluation is missing');

  await setEvaluator(organizerLogin.cookie, true);
  const passedSubmit = await submitTeam(teamLogin.cookie);
  assertIncludes(passedSubmit.body, '评测完成', 'available organizer data should complete evaluation');
  assert(passedSubmit.submitCookie, 'successful evaluation should set submit cookie');
  const unlockedCookie = `${teamLogin.cookie}; ${passedSubmit.submitCookie}`;
  const records = await text('/team/records', unlockedCookie);
  assertIncludes(records.body, 'Riding Evidence', 'records should show riding evidence');
  assertIncludes(records.body, 'Riding Plan', 'records should include plan event');
  assertIncludes(records.body, 'Observation', 'records should include observation event');
  assertIncludes(records.body, 'Agent Action', 'records should include agent action event');
  assertIncludes(records.body, 'Rider Steering', 'records should include rider steering event');
  assertIncludes(records.body, 'Validation', 'records should include validation event');
  assertIncludes(records.body, 'Review', 'records should include review event');
  assertIncludes(records.body, '计划', 'records should show plan summary');
  assertIncludes(records.body, '观察', 'records should show observation summary');
  assertIncludes(records.body, '干预', 'records should show steering summary');
  assertIncludes(records.body, '验收', 'records should show validation summary');
  assertIncludes(records.body, '复盘', 'records should show review summary');
  assertIncludes(records.body, '本地素材保留：是；提交内容：整理后的回放记录', 'records should state evidence boundary');
  assertIncludes(records.body, '评测结果维度', 'records should show evaluation result dimensions');
  assertResultDimensions(records.body, 'team records');
  assertNoLeaks(records.body, 'team records');

  const replay = await text('/team/replay', unlockedCookie);
  assertIncludes(replay.body, '过程回放', 'replay should show event replay');
  assertIncludes(replay.body, 'Rider + Agent', 'replay should show human-agent split');
  assertIncludes(replay.body, 'actor：rider', 'replay should show rider actor');
  assertIncludes(replay.body, 'actor：agent', 'replay should show agent actor');
  assertNoLeaks(replay.body, 'team replay');

  const team2Login = await login('team_002', '**********');
  const team2Record = await json('/api/team-records/record-team-001-grs001', team2Login.cookie);
  assert(team2Record.response.status === 404, 'team_002 should not read team_001 record');
  const team1Record = await json('/api/team-records/record-team-001-grs001', teamLogin.cookie);
  assert(team1Record.response.status === 200, 'team_001 should read own record');
  assert(team1Record.body.teamId === 'team_001', 'team_001 API should return own record');

  const organizerHistoryApi = await json('/api/team-history', organizerLogin.cookie);
  assert(organizerHistoryApi.response.status === 403, 'organizer should not use team history API');
  const teamHistoryApi = await json('/api/team-history', teamLogin.cookie);
  assert(teamHistoryApi.response.status === 200, 'team should read own history API');
  assert(teamHistoryApi.body.every((item) => item.teamId === 'team_001'), 'team history API should filter by team');

  const leaderboard = await text('/leaderboard');
  assertIncludes(leaderboard.body, '公开结果', 'leaderboard should show public results');
  assertIncludes(leaderboard.body, '公开评语', 'leaderboard should show public comment column');
  assertIncludes(leaderboard.body, '六维结果画像', 'leaderboard should show public result radar');
  assertResultDimensions(leaderboard.body, 'leaderboard');
  assertNotIncludes(leaderboard.body, 'Team 001：证明记录', 'leaderboard should not show record detail');
  assertNotIncludes(leaderboard.body, 'Riding Plan', 'leaderboard should not show replay events');
  assertNoLeaks(leaderboard.body, 'leaderboard');

  console.log('VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds');
} finally {
  await writeJson(evaluatorServicePath, originalEvaluatorService);
  await writeJson(raceSourcePath, originalRaceSource);
  await writeJson(disclosuresPath, originalDisclosures);
  await closeServer(app);
  await closeServer(organizer);
}
