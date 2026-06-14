import { createServerApp } from './server.js';
import { createOrganizerServer } from './organizer-server.js';
import { join } from 'node:path';
import { organizerDir, publicStoreDir, readJson, writeJson } from './storage.js';

const port = Number(process.env.ARY_GRS001_PORT || 4310);
const organizerPort = Number(process.env.ARY_GRS001_ORGANIZER_PORT || 4311);
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

function htmlAttr(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]+)"`));
  return match?.[1] || '';
}

function svgViewBoxBounds(html, fallback = { x: 0, y: 0, width: 1200, height: 620 }) {
  const match = html.match(/<svg[^>]*class="track-svg"[^>]*viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/) || html.match(/<svg[^>]*viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"[^>]*class="track-svg"/);
  if (!match) return fallback;
  const x = Number(match[1]);
  const y = Number(match[2]);
  const width = Number(match[3]);
  const height = Number(match[4]);
  return Number.isFinite(width) && Number.isFinite(height) ? { x, y, width, height } : fallback;
}

function assertReplayEventBubblesSpatiallySeparated(html, label) {
  const tags = [...html.matchAll(/<g class="message-bubble-anchor jumbotron-replay-event-bubble"[^>]*>/g)].map((match) => match[0]);
  assert(tags.length > 0, `${label} should render replay event bubbles`);
  assert(tags.length <= 3, `${label} should respect the visible replay bubble cap`);
  const entryIds = new Set();
  const rects = tags.map((tag) => {
    const entryId = htmlAttr(tag, 'data-entry-id');
    const placement = htmlAttr(tag, 'data-placement');
    const rect = {
      x: Number(htmlAttr(tag, 'data-replay-bubble-x')),
      y: Number(htmlAttr(tag, 'data-replay-bubble-y')),
      width: Number(htmlAttr(tag, 'data-replay-bubble-width')),
      height: Number(htmlAttr(tag, 'data-replay-bubble-height'))
    };
    assert(entryId && !entryIds.has(entryId), `${label} should render at most one replay bubble per entry`);
    entryIds.add(entryId);
    assert(['right', 'left', 'bottom', 'top'].includes(placement), `${label} should expose adaptive placement`);
    assert(Object.values(rect).every(Number.isFinite), `${label} should expose numeric replay bubble geometry`);
    return rect;
  });
  assert(rects.every((rect, index) => rects.slice(index + 1).every((other) => !intersects(rect, other) && rectCenterDistance(rect, other) >= 220)), `${label} replay event bubbles should stay spatially separated`);
}

function assertSvgMessageBubblesInViewBox(html) {
  assertIncludes(html, 'animation-duration:var(--bubble-cycle)', 'jumbotron should use adaptive bubble cycle duration');
  const viewBox = svgViewBoxBounds(html);
  const matches = [...html.matchAll(/<g class="message-bubble-anchor ([^"]+)" style="[^"]*" data-start-second="([\d.-]+)" data-duration-second="([\d.-]+)" data-cycle-second="([\d.-]+)" data-average-visible="([\d.-]+)" data-placement="([^"]+)" data-slot-index="([\d.-]+)" data-priority="([\d.-]+)"><line class="message-bubble-line" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"\/><g class="message-bubble" transform="translate\(([\d.-]+) ([\d.-]+)\)"><rect width="([\d.-]+)" height="([\d.-]+)"[^>]*>/g)];
  if (!matches.length) {
    assertIncludes(html, 'id="jumbotron-bubble-layer"', 'jumbotron should expose the replaceable bubble layer when no bubbles are safe');
    assertIncludes(html, '现场播报', 'jumbotron should fall back to ticker when no bubbles are safe');
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
    assert(x >= viewBox.x && x + width <= viewBox.x + viewBox.width, 'message bubble should stay inside horizontal track viewBox');
    assert(y >= viewBox.y && y + height <= viewBox.y + viewBox.height, 'message bubble should stay inside vertical track viewBox');
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
  const viewBox = svgViewBoxBounds(html);
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
    assert(rect.x >= viewBox.x && rect.x + rect.width <= viewBox.x + viewBox.width, 'horse label should stay inside horizontal track viewBox');
    assert(rect.y >= viewBox.y && rect.y + rect.height <= viewBox.y + viewBox.height, 'horse label should stay inside vertical track viewBox');
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
  assertIncludes(html, 'horse-rider-tint-filter-defs', 'jumbotron should define alpha-based rider tint filters');
  assertIncludes(html, 'data-rider-tint-palette-count="12"', 'jumbotron should expose at least twelve stable rider tint colors');
  assertIncludes(html, 'horse-rider-group-mask', 'jumbotron should overlay provider tint masks on rider sprite pixels');
  assertIncludes(html, 'horse-rider-alpha-tint', 'jumbotron should tint the raster sprite alpha instead of drawing a geometric badge');
  assertIncludes(html, 'data-mask-mode="source-alpha"', 'jumbotron should mark tint masks as source-alpha based');
  assertIncludes(html, 'SourceAlpha', 'jumbotron tint filters should use the sprite alpha channel');
  assertIncludes(html, 'feFlood', 'jumbotron tint filters should generate color overlays');
  assertIncludes(html, 'feComposite', 'jumbotron tint filters should clip overlays to non-transparent sprite pixels');
  assertIncludes(html, 'data-entry-provider-group="claude"', 'jumbotron should expose Claude provider group tint metadata');
  assertIncludes(html, 'data-entry-provider-group="codex"', 'jumbotron should expose Codex provider group tint metadata');
  assertIncludes(html, 'filter="url(#horse-rider-tint-', 'jumbotron should apply a tint filter to rider masks');
  assertNotIncludes(html, '<ellipse class="horse-rider-group-mask', 'jumbotron should not use circular rider tint masks');
  assert(!/<g class="horse [^"]*"[^>]*transform="translate\([^)]+\) rotate\(/.test(html), 'horse groups should translate only and never continuously rotate sprites');
  assert(!/<text class="debug-label" transform="rotate\(/.test(html), 'rank text should remain upright without inverse rotation');
  assert(!/<g class="horse-status-pill" transform="rotate\(/.test(html), 'status pills should remain upright without inverse rotation');
  const groups = [...html.matchAll(/<g class="horse-rider-facing" data-facing="(left|right)" transform="(scale\(-?1 1\))">/g)];
  assert(groups.length >= 8, 'multi-horse preview should expose facing metadata for rider sprites');
  assert(groups.every(([, facing, transform]) => (facing === 'left' && transform === 'scale(-1 1)') || (facing === 'right' && transform === 'scale(1 1)')), 'rider sprite facing metadata should match horizontal flip transform');
  const filters = [...html.matchAll(/<filter id="horse-rider-tint-(\d+)"/g)].map((match) => Number(match[1]));
  assert(new Set(filters).size >= 12, 'jumbotron should define twelve distinct rider tint filters');
  const floodOpacities = [...html.matchAll(/flood-opacity="([\d.]+)"/g)].map((match) => Number(match[1]));
  assert(floodOpacities.length >= 12, 'jumbotron should define opacity for each rider tint filter');
  assert(floodOpacities.every((opacity) => opacity > 0 && opacity <= 0.22), 'jumbotron rider tint opacity should stay subtle');
  const masks = [...html.matchAll(/<image class="horse-rider-group-mask horse-rider-alpha-tint horse-rider-tint-(\d+)" data-entry-color-index="(\d+)" data-entry-tint="([^"]+)" data-entry-provider-group="(claude|codex|other)" data-mask-mode="source-alpha"[^>]+filter="url\(#horse-rider-tint-\d+\)"/g)];
  assert(masks.length >= 8, 'multi-horse preview should tint every rider sprite with provider group masks');
  assert(masks.every(([, classIndex, dataIndex]) => classIndex === dataIndex), 'rider tint class and metadata should match');
  assert(new Set(masks.map((match) => match[2])).size >= 8, 'full jumbotron should use varied rider tint colors across entries');
}

function assertSecondTrackPerspectiveRiderScale(html) {
  assertIncludes(html, 'horse-rider-perspective-scale', 'second track should scale rider sprites by perspective');
  assertIncludes(html, 'data-perspective-track="real-explicit-closed-course"', 'second track perspective scale should be scoped to the confirmed second track');
  assertIncludes(html, 'data-perspective-min-scale="0.6"', 'second track perspective scale should expose 0.6x minimum');
  assertIncludes(html, 'data-perspective-max-scale="1.1"', 'second track perspective scale should expose 1.1x maximum');
  assertIncludes(html, 'data-base-sprite-width="151.2"', 'second track perspective scale should use the current rider sprite width as 1x');
  assertIncludes(html, 'data-base-sprite-height="156.8"', 'second track perspective scale should use the current rider sprite height as 1x');
  const scales = [...html.matchAll(/data-perspective-scale="([\d.]+)" data-perspective-y="([\d.]+)"[^>]+transform="scale\(([\d.]+)\)"/g)]
    .map((match) => ({ scale: Number(match[1]), y: Number(match[2]), transformScale: Number(match[3]) }));
  assert(scales.length >= 8, 'second track should scale every visible rider sprite by y perspective');
  assert(scales.every((item) => item.scale === item.transformScale), 'second track perspective scale metadata should match SVG transform');
  assert(scales.every((item) => item.scale >= 0.6 && item.scale <= 1.1), 'second track perspective scale should stay within 0.6x to 1.1x');
  const sorted = [...scales].sort((a, b) => a.y - b.y);
  assert(sorted[0].scale <= sorted[sorted.length - 1].scale, 'second track rider sprites should be larger when y is larger');
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
  if (data.plan.bubbles.length) {
    assertIncludes(data.bubbleLayerHtml, 'message-bubble-anchor', 'bubble API should return bubble anchors when bubbles are safe');
  } else {
    assert(data.rules.tickerFallback === true, 'bubble API should fall back to ticker when no bubbles are safe');
  }
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
  assertIncludes(yard.body, '进入 Jumbotron', 'yard race card should link to the Jumbotron view');
  assertIncludes(yard.body, 'href="/jumbotron"', 'yard Jumbotron button should point to the Jumbotron page');
  assertIncludes(yard.body, 'Organizer 数据可用', 'yard should show public source state');
  assertNoLeaks(yard.body, 'public yard');

  const jumbotron = await text('/jumbotron');
  assert(jumbotron.response.status === 200, 'jumbotron should load');
  assertIncludes(jumbotron.body, '<div class="jumbotron-brandline"><span class="jumbotron-live">LIVE</span><strong>DevCompass Racing</strong></div>', 'jumbotron header should not repeat identical brand and title');
  assertNotIncludes(jumbotron.body, '<strong>DevCompass Racing</strong><span>DevCompass Racing</span>', 'jumbotron header should delete duplicated subtitle text');
  assertNotIncludes(jumbotron.body, '最终主视觉', 'public jumbotron should not show internal final-frame status copy');
  assertIncludes(jumbotron.body, 'data-local-clock', 'jumbotron header should render a local clock target');
  assertIncludes(jumbotron.body, 'updateLocalClock', 'jumbotron should update the local clock in the browser');
  assertIncludes(jumbotron.body, 'window.setInterval(updateLocalClock,1000)', 'jumbotron local clock should refresh every second');
  assertIncludes(jumbotron.body, '赛事大屏', 'jumbotron should show public race live view');
  assertIncludes(jumbotron.body, '实时赛道', 'jumbotron should show main track');
  assertIncludes(jumbotron.body, '/jumbotron/candidate-assets/real-explicit-closed-course/background.webp', 'default jumbotron should render the confirmed second-track background asset');
  assertIncludes(jumbotron.body, '✓ Real Explicit Closed Course', 'default jumbotron should use the confirmed second track');
  assertNotIncludes(jumbotron.body, '当前赛道已确认。', 'public jumbotron main view should not expose asset review confirmation copy');
  assertNotIncludes(jumbotron.body, 'GRS 技术回环赛道', 'jumbotron should not show the removed technical loop track option');
  assertNotIncludes(jumbotron.body, 'track=grs-technical-loop', 'jumbotron should not link to the removed technical loop track');
  assertIncludes(jumbotron.body, '赛道选择', 'jumbotron should expose concise track switching boundary');
  assertIncludes(jumbotron.body, 'Real Explicit Closed Course', 'jumbotron should list the human-confirmed second track as a formal switch option');
  assertIncludes(jumbotron.body, 'track-background-image', 'jumbotron should keep track background as its own SVG layer');
  assertIncludes(jumbotron.body, 'horse-rider-sprite', 'jumbotron should render collaborator rider sprites');
  assertNotIncludes(jumbotron.body, '<circle class="horse-body"', 'jumbotron should not render fallback circle when rider sprites exist');
  assertNotIncludes(jumbotron.body, '<path class="horse-arrow"', 'jumbotron should not render fallback flag when rider sprites exist');
  assertIncludes(jumbotron.body, '/assets/jumbotron/rider3_run.gif', 'jumbotron should map running and sprinting entries to animated run sprite');
  assertIncludes(jumbotron.body, '/assets/jumbotron/rider3_walk.gif', 'jumbotron should map blocked/takeover/pit_stop entries to animated walk sprite');
  assertIncludes(jumbotron.body, '/assets/jumbotron/rider3_stay.gif', 'jumbotron should map idle/slowed/finished/stale entries to animated stay sprite');
  assertIncludes(jumbotron.body, 'horse-status-badge', 'jumbotron should render no-text state badge image assets');
  assertIncludes(jumbotron.body, '/assets/jumbotron/state-badge-', 'jumbotron should use per-motion-state badge assets');
  assertIncludes(jumbotron.body, 'AI Sudoku', 'jumbotron should show latest timeline leader');
  assertIncludes(jumbotron.body, 'DevCompass Racing', 'jumbotron should show latest timeline finished runner-up');
  assertIncludes(jumbotron.body, 'Travel AIAR', 'jumbotron should show latest timeline finished third place');
  assertIncludes(jumbotron.body, '最终状态 · 冲线段', 'jumbotron should render the final state from the latest timeline');
  assertIncludes(jumbotron.body, '异常情况', 'jumbotron should show enriched exception message');
  assertIncludes(jumbotron.body, 'GreenRoute · 47%', 'jumbotron should show entry progress percentage');
  assertIncludes(jumbotron.body, '小地图', 'jumbotron should show mini map');
  assertIncludes(jumbotron.body, '右侧折返弯', 'jumbotron should show Chinese checkpoint labels');
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
  assertIncludes(jumbotron.body, 'class="jumbotron-focus-source focus-trigger legend-entry"', 'team legend entries should be hoverable focus sources');
  assertIncludes(jumbotron.body, 'data-legend-entry-id=', 'team legend entries should expose stable entry ids');
  assertIncludes(jumbotron.body, '.legend-entry .html-tooltip{left:calc(100% + 10px)', 'team legend tooltip should open next to the hovered legend entry');
  assertIncludes(jumbotron.body, '.jumbotron-focus-source.legend-entry:hover .html-tooltip', 'team legend tooltip hover rule should override generic tooltip placement');
  assertNotIncludes(jumbotron.body, '队伍现场', 'public jumbotron should not show empty team scene action');
  assertNotIncludes(jumbotron.body, '展示边界', 'public jumbotron should not show internal boundary explanation');
  assertNotIncludes(jumbotron.body, '只展示摘要', 'public jumbotron should not explain display boundary in the main view');
  assertNotIncludes(jumbotron.body, '不展开原始记录', 'public jumbotron should not expose internal content-exclusion copy');
  assertNotIncludes(jumbotron.body, '终端输出', 'public jumbotron should not mention terminal-output exclusions');
  assertNotIncludes(jumbotron.body, '长文本评论', 'public jumbotron should not mention internal review artifacts');
  assertNotIncludes(jumbotron.body, '代码差异', 'public jumbotron should not mention code diff exclusions');
  assertNotIncludes(jumbotron.body, '公开现场摘要', 'public jumbotron should not show empty remote-cockpit drawer');
  assertNotIncludes(jumbotron.body, '协作入口', 'public jumbotron should not use unclear collaboration entry wording');
  assertIncludes(jumbotron.body, 'jumbotron-status-lines', 'jumbotron race status should use separate short lines');
  assertIncludes(jumbotron.body, '<strong style="display:block;margin-bottom:5px;color:#344054">主题</strong>', 'jumbotron race status should label theme without colon punctuation');
  assertNotIncludes(jumbotron.body, '主题：', 'jumbotron race status should avoid colon punctuation');
  assertNotIncludes(jumbotron.body, '主办方：', 'jumbotron race status should avoid colon punctuation for organizer');
  assertNotIncludes(jumbotron.body, '阶段：', 'jumbotron race status should avoid colon punctuation for phase');
  assertNotIncludes(jumbotron.body, '；下一步', 'jumbotron race status should avoid semicolon-separated long lines');
  assertNotIncludes(jumbotron.body, '系统时间', 'public jumbotron should not show static footer system-time filler');
  assertNotIncludes(jumbotron.body, 'HorsePose', 'public jumbotron should hide runtime debug output');
  assertNotIncludes(jumbotron.body, '赛道校准器入口', 'public jumbotron should not use verbose calibrator-entry copy');
  assertIncludes(jumbotron.body, '/jumbotron?debug=1', 'public jumbotron should link the debug review view');
  assertIncludes(jumbotron.body, '/jumbotron/calibrator', 'public jumbotron should link the track calibrator');
  assertIncludes(jumbotron.body, '调试审阅', 'public jumbotron should expose a concise debug review action');
  assertIncludes(jumbotron.body, '赛道校准器', 'public jumbotron should expose a concise calibrator action');
  assertNotIncludes(jumbotron.body, '调试模式', 'public jumbotron should hide debug mode by default');
  assertNotIncludes(jumbotron.body, '几何 / 运行时 / 待刷新', 'public jumbotron should hide validation by default');
  assertIncludes(jumbotron.body, 'jumbotron-drawer', 'jumbotron should use collapsible drawer cards for auxiliary panels');
  assertIncludes(jumbotron.body, 'jumbotron-drawer-icon', 'jumbotron drawers should show a visible expand indicator');
  assertIncludes(jumbotron.body, 'font-size:34px', 'jumbotron drawer indicator should be large enough to notice');
  assertIncludes(jumbotron.body, 'overflow-anchor:none', 'jumbotron drawers should keep hover title positions stable while expanding');
  assertIncludes(jumbotron.body, 'liveAside.scrollTop += currentTop - active.top', 'jumbotron drawers should anchor hovered titles during expansion');
  assertIncludes(jumbotron.body, 'padding-bottom .26s ease', 'jumbotron drawers should expand downward without moving the body upward first');
  assertNotIncludes(jumbotron.body, 'transform:translateY(-4px)', 'jumbotron drawer body should not shift upward during hover expansion');
  assertIncludes(jumbotron.body, 'jumbotron-mini-map-drawer', 'mini map drawer should have a dedicated overlay class');
  assertIncludes(jumbotron.body, '.jumbotron-live-layout>aside{grid-column:1;grid-row:1;overflow:visible}', 'live sidebar should allow mini map overlay without clipping');
  assertIncludes(jumbotron.body, '.jumbotron-mini-map-drawer .jumbotron-drawer-body{position:absolute', 'mini map drawer body should overlay instead of increasing sidebar height');
  assertIncludes(jumbotron.body, 'box-shadow:0 18px 34px rgba(16,24,40,.18);overflow:visible', 'mini map drawer overlay should not clip nearby legend tooltips');
  assertIncludes(jumbotron.body, 'top:100%;z-index:8', 'mini map drawer overlay should open below the header without changing total height');
  assertIncludes(jumbotron.body, 'jumbotron-profile-drawer', 'jumbotron should expose collapsible data profile selector');
  assertIncludes(jumbotron.body, 'jumbotron-profile-drawer:hover .jumbotron-drawer-body', 'profile drawer should have its own expanded height');
  assertIncludes(jumbotron.body, 'max-height:760px', 'profile drawer should fully show data and track options when expanded');
  assertIncludes(jumbotron.body, '数据视图', 'jumbotron data profile selector should be Chinese');
  assertIncludes(jumbotron.body, '选择展示范围', 'jumbotron should label profile selector in Chinese');
  assertIncludes(jumbotron.body, '完整赛况', 'jumbotron should show full profile in Chinese');
  assertIncludes(jumbotron.body, '全部公开队伍、消息和异常情况', 'jumbotron should show full profile purpose in Chinese');
  assertIncludes(jumbotron.body, '轻量视图', 'jumbotron should show smoke profile in Chinese');
  assertIncludes(jumbotron.body, '覆盖视图', 'jumbotron should show coverage profile in Chinese');
  assertNotIncludes(jumbotron.body, '档位编号：curated-full-12', 'public jumbotron should not expose internal profile IDs');
  assertNotIncludes(jumbotron.body, 'Data Profile', 'public jumbotron should not expose English data profile heading');
  assertNotIncludes(jumbotron.body, 'dataProfileId=', 'public jumbotron should not expose English data profile label');
  assertIncludes(jumbotron.body, '/jumbotron?profile=smoke-8', 'jumbotron should link smoke-8 profile');
  assertIncludes(jumbotron.body, '/jumbotron?profile=coverage-9', 'jumbotron should link coverage-9 profile');
  assertIncludes(jumbotron.body, '/api/jumbotron-bubbles?profile=full&track=real-explicit-closed-course', 'jumbotron should poll bubble queue API for the default second track');
  assertIncludes(jumbotron.body, 'id="jumbotron-main-track-card"', 'jumbotron should keep replay inside the main track card');
  assertIncludes(jumbotron.body, 'id="jumbotron-main-track-frame"', 'jumbotron should expose the replaceable main track frame');
  assert(jumbotron.body.indexOf('id="jumbotron-main-track-frame"') < jumbotron.body.indexOf('data-main-replay-controls'), 'jumbotron replay toolbar should sit below the main visual frame');
  assertIncludes(jumbotron.body, 'aspect-ratio:1672 / 941', 'jumbotron should size the default second track by its own viewBox ratio');
  assertNotIncludes(jumbotron.body, 'height:calc(51.7vw - 116px)', 'jumbotron should not keep the old fixed-height live layout');
  assertIncludes(jumbotron.body, 'data-replay-status hidden', 'jumbotron replay status should be hidden by default');
  assertIncludes(jumbotron.body, '.pill[hidden]{display:none}', 'hidden replay status pill should not leave an empty visible box');
  assertIncludes(jumbotron.body, 'data-main-track-mode="final"', 'jumbotron should default to final main visual');
  assertIncludes(jumbotron.body, 'id="jumbotron-replay-entry-layer"', 'jumbotron should keep a stable replay entry layer to avoid flicker');
  assertIncludes(jumbotron.body, 'id="jumbotron-replay-event-layer"', 'jumbotron should keep a stable replay event layer to avoid flicker');
  assertIncludes(jumbotron.body, 'applyReplayFrameHtml(data.frameHtml)', 'jumbotron replay should patch dynamic SVG layers instead of remounting the whole track every frame');
  assertNotIncludes(jumbotron.body, 'stage.innerHTML = data.frameHtml', 'jumbotron replay should not remount the whole SVG for every playback frame');
  assertIncludes(jumbotron.body, 'data-replay-action="start"', 'jumbotron should expose start replay control');
  assertIncludes(jumbotron.body, 'data-replay-action="stop"', 'jumbotron should expose stop replay control');
  assertIncludes(jumbotron.body, 'data-playback-frame-count="145"', 'jumbotron replay should expose interpolated playback frame count');
  assertIncludes(jumbotron.body, 'data-key-frame-count="13"', 'jumbotron replay should preserve imported key frame count');
  assertIncludes(jumbotron.body, 'data-event-hold-frames="10"', 'jumbotron replay controls should expose event bubble hold frames');
  assertIncludes(jumbotron.body, 'data-final-hold-frames="12"', 'jumbotron replay controls should expose final frame hold frames');
  assertIncludes(jumbotron.body, 'const frameCache = new Map()', 'jumbotron replay should cache fetched frames for fixed-speed playback');
  assertIncludes(jumbotron.body, 'prefetchFrame(requestedIndex + 1)', 'jumbotron replay should prefetch the next frame instead of waiting inside the timer loop');
  assertNotIncludes(jumbotron.body, 'const ok = await loadFrame(frameIndex)', 'jumbotron replay should not serialize the frame timer behind each API response');
  assertIncludes(jumbotron.body, 'timer = window.setTimeout(tick, frameDelayMs)', 'jumbotron replay should keep a fixed frame timer');
  assertIncludes(jumbotron.body, 'data-main-replay-controls', 'jumbotron should expose recent replay controls');
  assertIncludes(jumbotron.body, 'data-geometry-toggle', 'jumbotron should expose a geometry-line visibility toggle');
  assertIncludes(jumbotron.body, 'jumbotron-geometry-hidden .track-band', 'jumbotron should hide the packaged geometry track with the geometry toggle');
  assertIncludes(jumbotron.body, 'jumbotron-geometry-hidden .track-centerline', 'jumbotron should hide centerline geometry through a stable class');
  assertIncludes(jumbotron.body, "root.classList.toggle('jumbotron-geometry-hidden')", 'jumbotron geometry toggle should apply to live and replay SVG frames');
  assertIncludes(jumbotron.body, '/api/jumbotron-replay?profile=full&track=real-explicit-closed-course', 'jumbotron should poll replay API for the default second track');
  assertNotIncludes(jumbotron.body, 'id="jumbotron-replay"', 'jumbotron should not render a separate replay panel');
  assertNotIncludes(jumbotron.body, '随时间变化的数据回放', 'jumbotron should not expose a separate replay view');
  assertIncludes(jumbotron.body, 'data-topbar', 'jumbotron shell should expose a collapsible global topbar');
  assertIncludes(jumbotron.body, 'data-topbar-toggle', 'jumbotron shell should render a topbar collapse toggle');
  assertIncludes(jumbotron.body, '收起顶栏', 'topbar toggle should start with collapse copy');
  assertIncludes(jumbotron.body, "topbar.classList.toggle('is-collapsed'", 'topbar toggle should collapse the global navigation in place');
  assertIncludes(jumbotron.body, '.topbar.is-collapsed .brand,.topbar.is-collapsed .nav,.topbar.is-collapsed .identity{display:none}', 'collapsed topbar should hide brand, nav and identity controls');
  assertIncludes(jumbotron.body, "button.textContent=collapsed?'展开顶栏':'收起顶栏'", 'topbar toggle should switch copy after collapse');
  assertIncludes(jumbotron.body, '现场播报', 'jumbotron should show ticker');
  assertIncludes(jumbotron.body, '异常情况', 'jumbotron should show attention section');
  assertIncludes(jumbotron.body, 'attention-item', 'jumbotron should render attention cards');
  assertIncludes(jumbotron.body, '详情摘要', 'jumbotron should expose hover tooltip structure');
  assertIncludes(jumbotron.body, '焦点详情', 'jumbotron should expose focus details panel');
  assertNotIncludes(jumbotron.body, '悬停预览，点击固定', 'public jumbotron should not explain interaction mechanics');
  assertIncludes(jumbotron.body, '队伍 · #', 'jumbotron should expose pinned entry focus detail content');
  assertIncludes(jumbotron.body, 'data-focus-kind="entry"', 'jumbotron should support entry focus details');
  assertIncludes(jumbotron.body, 'data-focus-kind="message"', 'jumbotron should support message focus details');
  assertIncludes(jumbotron.body, 'id="jumbotron-bubble-layer"', 'jumbotron should expose replaceable bubble layer');
  assertIncludes(jumbotron.body, '/api/jumbotron-bubbles', 'jumbotron should poll bubble queue API');
  assertIncludes(jumbotron.body, 'setInterval(syncBubbleLayer, 2500)', 'jumbotron should sync bubble layer without page refresh');
  assertSvgMessageBubblesInViewBox(jumbotron.body);
  assertSvgHorseLabelsAvoidBboxes(jumbotron.body);
  assertJumbotronSpriteFacing(jumbotron.body);
  assertSecondTrackPerspectiveRiderScale(jumbotron.body);
  const bubbleApi = await json('/api/jumbotron-bubbles');
  assert(bubbleApi.response.status === 200, 'bubble API should load');
  assert(bubbleApi.body.dataProfileId === 'curated-full-12', 'bubble API should default to full profile');
  assertJumbotronBubbleApi(bubbleApi.body);
  assertNoLeaks(JSON.stringify(bubbleApi.body), 'jumbotron bubble API');
  const interpolatedReplayApi = await json('/api/jumbotron-replay?frame=1');
  assert(interpolatedReplayApi.response.status === 200, 'replay API should load an interpolated playback frame');
  assert(interpolatedReplayApi.body.frameCount === 145, 'replay API should expose interpolated playback frame count');
  assert(interpolatedReplayApi.body.playbackFrameCount === 145, 'replay API should expose playback frame count explicitly');
  assert(interpolatedReplayApi.body.keyFrameCount === 13, 'replay API should preserve imported key frame count');
  assert(interpolatedReplayApi.body.interpolationSteps === 12, 'replay API should expose interpolation density');
  assert(interpolatedReplayApi.body.eventHoldFrames === 10, 'replay API should expose event bubble hold frames');
  assert(interpolatedReplayApi.body.finalHoldFrames === 12, 'replay API should expose final replay hold frames');
  assert(interpolatedReplayApi.body.frameDelayMs === 90, 'replay API should expose replay frame delay');
  assert(interpolatedReplayApi.body.frameIndex === 1, 'replay API should clamp and return requested playback index');
  assert(interpolatedReplayApi.body.isInterpolated === true, 'replay API should mark non-key playback frames as interpolated');
  assert(interpolatedReplayApi.body.sourceFrameIndex === 0, 'interpolated replay frame should identify source key frame');
  assert(interpolatedReplayApi.body.nextFrameIndex === 1, 'interpolated replay frame should identify next key frame');
  assert(interpolatedReplayApi.body.interpolationT > 0 && interpolatedReplayApi.body.interpolationT < 1, 'interpolated replay frame should expose interpolation ratio');
  assert(interpolatedReplayApi.body.avgRoundProgress > 13.4, 'interpolated replay frame should advance beyond the first key frame');
  assertIncludes(interpolatedReplayApi.body.frameHtml, '<svg class="track-svg"', 'replay API should return main-track-only frame HTML');
  assertIncludes(interpolatedReplayApi.body.frameHtml, 'horse-rider-tint-filter-defs', 'replay API frame should define alpha-based rider tint filters');
  assertIncludes(interpolatedReplayApi.body.frameHtml, 'data-rider-tint-palette-count="12"', 'replay API frame should keep twelve rider tint colors');
  assertIncludes(interpolatedReplayApi.body.frameHtml, 'data-mask-mode="source-alpha"', 'replay API frame should tint rider sprite alpha only');
  assertIncludes(interpolatedReplayApi.body.frameHtml, 'filter="url(#horse-rider-tint-', 'replay API frame should apply rider tint filters');
  assertSecondTrackPerspectiveRiderScale(interpolatedReplayApi.body.frameHtml);
  assertNotIncludes(interpolatedReplayApi.body.frameHtml, '<ellipse class="horse-rider-group-mask', 'replay API frame should not use circular rider tint masks');
  assertNotIncludes(interpolatedReplayApi.body.frameHtml, 'debug-grid', 'main replay frame should not inject debug grid into the track card');
  assertIncludes(interpolatedReplayApi.body.panelFrameHtml, '平滑插值', 'replay API should render interpolated panel frame copy');
  assertNoLeaks(JSON.stringify(interpolatedReplayApi.body), 'jumbotron interpolated replay API');
  const overtakeReplayApi = await json('/api/jumbotron-replay?frame=48');
  assert(overtakeReplayApi.response.status === 200, 'replay API should load an overtake key frame');
  assertIncludes(overtakeReplayApi.body.frameHtml, 'data-replay-event-kind="overtake"', 'replay API should render overtake event bubbles');
  assertIncludes(overtakeReplayApi.body.frameHtml, '超越', 'replay event bubbles should label overtake moments');
  assertReplayEventBubblesSpatiallySeparated(overtakeReplayApi.body.frameHtml, 'overtake replay frame');
  const heldOvertakeReplayApi = await json('/api/jumbotron-replay?frame=58');
  assert(heldOvertakeReplayApi.response.status === 200, 'replay API should load an event hold playback frame');
  assertIncludes(heldOvertakeReplayApi.body.frameHtml, 'data-replay-event-kind="overtake"', 'replay event bubbles should remain visible for several frames after the key event');
  assertReplayEventBubblesSpatiallySeparated(heldOvertakeReplayApi.body.frameHtml, 'held overtake replay frame');
  const heldRaceStartReplayApi = await json('/api/jumbotron-replay?frame=10');
  assert(heldRaceStartReplayApi.response.status === 200, 'replay API should load the last held start event frame');
  assertIncludes(heldRaceStartReplayApi.body.frameHtml, 'data-replay-event-kind="race_start"', 'replay event bubbles should stay visible through the hold window');
  assertReplayEventBubblesSpatiallySeparated(heldRaceStartReplayApi.body.frameHtml, 'held race start replay frame');
  const expiredRaceStartReplayApi = await json('/api/jumbotron-replay?frame=11');
  assert(expiredRaceStartReplayApi.response.status === 200, 'replay API should load the first frame after event hold expires');
  assertNotIncludes(expiredRaceStartReplayApi.body.frameHtml, 'data-replay-event-kind="race_start"', 'replay event bubbles should disappear after the hold window');
  assertIncludes(overtakeReplayApi.body.panelFrameHtml, 'TOP3', 'replay API should keep full panel frame separately');
  const replayApi = await json('/api/jumbotron-replay?frame=144');
  assert(replayApi.response.status === 200, 'replay API should load final playback frame');
  assert(replayApi.body.frameCount === 145, 'replay API should expose interpolated playback frame count on final frame');
  assert(replayApi.body.keyFrameCount === 13, 'replay API should keep final frame tied to 13 key frames');
  assert(replayApi.body.frameIndex === 144, 'replay API should clamp and return requested final playback index');
  assert(replayApi.body.isInterpolated === false, 'final replay frame should be a key frame');
  assert(replayApi.body.avgRoundProgress === 78.1, 'replay API should normalize final fractional average progress into percent');
  assertIncludes(replayApi.body.frameHtml, 'data-replay-event-kind="finish"', 'replay API should render finish event bubbles');
  assertIncludes(replayApi.body.frameHtml, '冲线', 'replay event bubbles should label finish moments');
  assertReplayEventBubblesSpatiallySeparated(replayApi.body.frameHtml, 'finish replay frame');
  assertIncludes(replayApi.body.frameHtml, '完成', 'replay API should render finished state in final frame');
  assertIncludes(replayApi.body.frameHtml, '#1 AI Sudoku · 100%', 'replay API should normalize fractional entry progress into percent');
  assertIncludes(replayApi.body.frameHtml, 'DevCompass Racing', 'replay API should preserve entry display names');
  assertNoLeaks(JSON.stringify(replayApi.body), 'jumbotron replay API');
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
  assertIncludes(jumbotron.body, '/jumbotron/calibrator', 'public jumbotron should link calibrator from the tools drawer');
  assertNoLeaks(jumbotron.body, 'jumbotron');

  const jumbotronDebug = await text('/jumbotron?debug=1');
  assert(jumbotronDebug.response.status === 200, 'jumbotron debug should load');
  assertIncludes(jumbotronDebug.body, 'data evidence debug panel', 'debug jumbotron should show data evidence panel');
  assertIncludes(jumbotronDebug.body, '/jumbotron/calibrator', 'debug jumbotron should link calibrator for review tools');
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
  assertIncludes(jumbotronDebug.body, '赛道校准器入口', 'debug jumbotron should show current calibrator entry');
  assertIncludes(jumbotronDebug.body, '/jumbotron/calibrator?candidate=real-explicit-closed-course', 'debug jumbotron should link the second-track calibrator directly');
  assertIncludes(jumbotronDebug.body, '打开第二赛道校准器', 'debug jumbotron should expose second-track calibrator action');
  assertNotIncludes(jumbotronDebug.body, 'AI 候选导入和第二赛道仍是后续项', 'debug jumbotron should not show stale calibrator status');
  assertIncludes(jumbotronDebug.body, '调试模式', 'debug jumbotron should show debug mode');
  assertIncludes(jumbotronDebug.body, '几何 / 运行时 / 待刷新', 'debug jumbotron should show profile validation');
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
  assertNotIncludes(jumbotronDebug.body, '待人工复核', 'debug jumbotron should not keep confirmed second-track manual checks pending');
  assertIncludes(jumbotronDebug.body, '✓ 弯道自然人工确认', 'confirmed second-track curve confirmation should pass');
  assertNoLeaks(jumbotronDebug.body, 'jumbotron debug');

  const jumbotronSmoke = await text('/jumbotron?profile=smoke-8');
  assert(jumbotronSmoke.response.status === 200, 'smoke-8 jumbotron should load');
  assertIncludes(jumbotronSmoke.body, '轻量视图', 'smoke-8 jumbotron should show public profile name in Chinese');
  assertNotIncludes(jumbotronSmoke.body, '档位编号：smoke-8-visual-low-load', 'smoke-8 public jumbotron should not show canonical profile id');
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
  assertIncludes(calibrator.body, '赛道校准器', 'calibrator should expose MVP entry');
  assertIncludes(calibrator.body, '设计资产工具', 'calibrator should present itself as design asset tool');
  assertIncludes(calibrator.body, '顶部工具栏', 'calibrator should expose top toolbar');
  assertIncludes(calibrator.body, '主画布', 'calibrator should expose main canvas');
  assertIncludes(calibrator.body, '右侧面板', 'calibrator should expose right inspector');
  assertIncludes(calibrator.body, '底部预览栏', 'calibrator should expose bottom preview bar');
  assertIncludes(calibrator.body, '导入底图', 'calibrator should expose background import');
  assertIncludes(calibrator.body, '/assets/jumbotron/background1.png', 'calibrator should expose extracted track background option');
  assertIncludes(calibrator.body, '/assets/jumbotron/example.png', 'calibrator should expose extracted example background option');
  assertIncludes(calibrator.body, '导入候选配置', 'calibrator should expose candidate profile import');
  assertIncludes(calibrator.body, '第二赛道候选入口', 'calibrator should expose a visible second-track candidate picker');
  assertIncludes(calibrator.body, '在校准器中选择第二赛道', 'calibrator should label the second-track picker clearly');
  assertIncludes(calibrator.body, '候选赛道选择', 'calibrator should expose candidate track selection control');
  assertIncludes(calibrator.body, '/jumbotron/calibrator?candidate=real-explicit-closed-course', 'calibrator should link directly to the second-track candidate view');
  assertIncludes(calibrator.body, '校验', 'calibrator should expose validate action');
  assertIncludes(calibrator.body, '预览', 'calibrator should expose preview action');
  assertIncludes(calibrator.body, '导出', 'calibrator should expose export action');
  assertIncludes(calibrator.body, '导出冻结候选配置', 'calibrator should export frozen candidate');
  assertIncludes(calibrator.body, 'data-asset-review-status="confirmed"', 'calibrator should default asset review to confirmed after user review');
  assertIncludes(calibrator.body, '人工确认：已由人工复核通过', 'calibrator should show user-confirmed human review by default');
  assertIncludes(calibrator.body, '用户人工确认通过', 'calibrator should show the user-confirmed second-track state');
  assertNotIncludes(calibrator.body, 'data-asset-review-status="pending"', 'calibrator default state should not regress to pending after user review');
  assertIncludes(calibrator.body, '人工复核确认</strong>', 'calibrator default state should claim human confirmation after user review');
  assertIncludes(calibrator.body, '正式资产 confirmed', 'calibrator should not claim formal asset confirmation');
  assertIncludes(calibrator.body, '底图层', 'calibrator should expose background layer');
  assertIncludes(calibrator.body, '中心线层', 'calibrator should expose centerline layer');
  assertIncludes(calibrator.body, '控制点层', 'calibrator should expose control points layer');
  assertIncludes(calibrator.body, 'id="calibrator-canvas"', 'calibrator should expose interactive canvas');
  assertIncludes(calibrator.body, 'data-control-point', 'calibrator should render draggable control point handles');
  assertIncludes(calibrator.body, '撤销', 'calibrator should expose undo action');
  assertIncludes(calibrator.body, '重做', 'calibrator should expose redo action');
  assertIncludes(calibrator.body, 'data-context-menu', 'calibrator should expose right-click context menu');
  assertIncludes(calibrator.body, 'data-context-action="insert-nearest-segment"', 'calibrator should expose nearest-segment insert action');
  assertIncludes(calibrator.body, 'name="centerlinePointsJson"', 'calibrator should keep legacy hidden centerline field compatible');
  assertIncludes(calibrator.body, 'name="lanesJson"', 'calibrator should keep legacy hidden lanes field compatible');
  assertIncludes(calibrator.body, 'name="checkpointsJson"', 'calibrator should keep legacy hidden checkpoints field compatible');
  assertIncludes(calibrator.body, 'name="startSHidden"', 'calibrator should keep legacy hidden startS field compatible');
  assertIncludes(calibrator.body, 'name="finishSHidden"', 'calibrator should keep legacy hidden finishS field compatible');
  assertIncludes(calibrator.body, 'data-closing-segment', 'calibrator should expose closing segment guide layer');
  assertIncludes(calibrator.body, 'track-closing-segment', 'calibrator should style closing segment guide layer');
  assertIncludes(calibrator.body, 'Shift+点击路径添加检查点', 'calibrator should document shift-click checkpoint shortcut');
  assertIncludes(calibrator.body, 'data-background-image', 'calibrator should render real background image layer');
  assertIncludes(calibrator.body, 'data-start-handle', 'calibrator should expose draggable start handle');
  assertIncludes(calibrator.body, 'data-finish-handle', 'calibrator should expose draggable finish handle');
  assertIncludes(calibrator.body, 'data-checkpoints-layer', 'calibrator should expose editable checkpoint layer');
  assertIncludes(calibrator.body, 'data-zone-layer', 'calibrator should expose editable zone layer');
  assertIncludes(calibrator.body, 'data-zone-type="messageZones"', 'calibrator should expose message zone editing layer');
  assertIncludes(calibrator.body, 'data-zone-type="noBubbleZones"', 'calibrator should expose no bubble zone editing layer');
  assertIncludes(calibrator.body, 'data-zone-type="riskZones"', 'calibrator should expose risk zone editing layer');
  assertIncludes(calibrator.body, '泳道数量', 'calibrator should expose lane count control');
  assertIncludes(calibrator.body, '泳道间距', 'calibrator should expose lane spacing control');
  assertIncludes(calibrator.body, '高级 JSON', 'calibrator should keep JSON editing as advanced mode');
  assertIncludes(calibrator.body, '画布操作已开启', 'calibrator should explain canvas point editing');
  assertIncludes(calibrator.body, 'data-control-points-layer', 'calibrator should expose draggable centerline control layer');
  assertIncludes(calibrator.body, 'data-lane-summary', 'calibrator should expose lane preview summary');
  assertIncludes(calibrator.body, 'data-checkpoint-summary', 'calibrator should expose checkpoint summary');
  assertIncludes(calibrator.body, '马匹预览层', 'calibrator should expose horse preview summary');
  assertIncludes(calibrator.body, '消息气泡预览层', 'calibrator should expose message bubble preview summary');
  assertIncludes(calibrator.body, '赛道信息', 'calibrator should expose track info inspector');
  assertIncludes(calibrator.body, '几何', 'calibrator should expose geometry inspector');
  assertIncludes(calibrator.body, '终点线', 'calibrator should expose finish line inspector');
  assertIncludes(calibrator.body, '方向', 'calibrator should expose direction inspector');
  assertIncludes(calibrator.body, '泳道', 'calibrator should expose lanes inspector');
  assertIncludes(calibrator.body, '检查点', 'calibrator should expose checkpoints inspector');
  assertIncludes(calibrator.body, '消息气泡', 'calibrator should expose message bubble inspector');
  assertIncludes(calibrator.body, '校验结果', 'calibrator should expose validation results inspector');
  assertIncludes(calibrator.body, '进度滑杆', 'calibrator should expose scrubber');
  assertIncludes(calibrator.body, '马匹数量', 'calibrator should expose horse count');
  assertIncludes(calibrator.body, '速度', 'calibrator should expose preview speed');
  assertIncludes(calibrator.body, '播放状态', 'calibrator should expose play pause control');
  assertIncludes(calibrator.body, '场景预设', 'calibrator should expose scenario presets');
  assertIncludes(calibrator.body, 'id="calibrator-add-point-button"', 'calibrator should expose add point action');
  assertIncludes(calibrator.body, '删除点位', 'calibrator should expose delete point action');
  assertIncludes(calibrator.body, 'id="calibrator-reverse-button"', 'calibrator should expose reverse direction action');
  assertIncludes(calibrator.body, '平滑路径预览', 'calibrator should expose smoothing preview');
  assertIncludes(calibrator.body, '大屏运行时采样', 'calibrator should state runtime reuse');
  assertIncludes(calibrator.body, 'schemaVersion', 'calibrator export should include schemaVersion');
  assertIncludes(calibrator.body, 'trackId', 'calibrator export should include trackId');
  assertIncludes(calibrator.body, 'viewBox', 'calibrator export should include viewBox');
  assertIncludes(calibrator.body, 'centerline', 'calibrator export should include centerline');
  assertIncludes(calibrator.body, 'messageZones', 'calibrator export should include messageZones');
  assertIncludes(calibrator.body, 'noBubbleZones', 'calibrator export should include noBubbleZones');
  assertIncludes(calibrator.body, 'riskZones', 'calibrator export should include riskZones');
  assertIncludes(calibrator.body, '进度滑杆单马', 'calibrator should preview scrubber horse');
  assertIncludes(calibrator.body, '多马预览', 'calibrator should preview multiple horses');
  assertIncludes(calibrator.body, '消息区 画布编辑 · implemented', 'calibrator should implement message zone canvas editing');
  assertIncludes(calibrator.body, '禁气泡区 编辑 · implemented', 'calibrator should implement no bubble zone canvas editing');
  assertIncludes(calibrator.body, '风险区 画布编辑 · implemented', 'calibrator should implement risk zone canvas editing');
  assertIncludes(calibrator.body, '拖拽状态变化证据 · implemented', 'calibrator should expose drag state proof as implemented');
  assertIncludes(calibrator.body, 'AI 候选点导入 · implemented', 'calibrator should implement AI candidate import');
  assertIncludes(calibrator.body, '自动检测尖角 · implemented', 'calibrator should implement corner detection and draft fix');
  assertIncludes(calibrator.body, 'AI 候选点导入：real-explicit-closed-course', 'calibrator should expose grandstand candidate import action');
  assertIncludes(calibrator.body, 'real-explicit-closed-course candidate asset evidence', 'calibrator should show candidate evidence summary');
  assertIncludes(calibrator.body, 'validation=pass', 'calibrator should show candidate validation pass summary');
  assertIncludes(calibrator.body, 'containsPlaceholderAssets=false', 'calibrator should show candidate placeholder-free summary');
  assertIncludes(calibrator.body, 'centerline=40 点', 'calibrator should show candidate centerline count');
  assertIncludes(calibrator.body, 'lanes=12', 'calibrator should show candidate lane count');
  assertIncludes(calibrator.body, 'checkpoints=4', 'calibrator should show candidate checkpoint count');
  assertIncludes(calibrator.body, '自动修复候选草稿', 'calibrator should expose auto-fix draft evidence panel');
  assertIncludes(calibrator.body, '候选已提升=true', 'calibrator should promote the user-confirmed second track into confirmed flow');
  assertIncludes(calibrator.body, 'lane 快捷调整 · implemented', 'calibrator should implement lane quick adjustment');
  assertIncludes(calibrator.body, '导出 debug-preview.png · implemented', 'calibrator should list debug preview export P1 implemented');
  assertIncludes(calibrator.body, 'Week2-Jumbotron/review-ledger/screenshots/2026-06-13-jumbotron-debug-preview-export/debug-preview.png', 'calibrator should expose debug preview PNG evidence path');
  assertIncludes(calibrator.body, 'JSON 差异预览 · implemented', 'calibrator should implement JSON diff preview');
  assertIncludes(calibrator.body, '导入配置到导出候选的差异', 'calibrator should show JSON diff preview table');
  assertIncludes(calibrator.body, '暂无字段差异', 'calibrator should show empty diff state');
  assertIncludes(calibrator.body, '校准证明', 'calibrator should expose proof mode panel');
  assertIncludes(calibrator.body, '打开演示模式', 'calibrator should expose recording walkthrough proof panel');
  assertIncludes(calibrator.body, '预览复用大屏运行时', 'calibrator should state runtime reuse in short proof panel');
  assertIncludes(calibrator.body, '进入大屏', 'calibrator should show use-in-jumbotron evidence');
  const secondTrackCalibrator = await text('/jumbotron/calibrator?candidate=real-explicit-closed-course');
  assert(secondTrackCalibrator.response.status === 200, 'second-track calibrator direct URL should load');
  assertIncludes(secondTrackCalibrator.body, 'real-explicit-closed-course', 'second-track calibrator should load the requested candidate id');
  assertIncludes(secondTrackCalibrator.body, '/jumbotron/candidate-assets/real-explicit-closed-course/background.webp', 'second-track calibrator should use controlled candidate background route');
  assertIncludes(secondTrackCalibrator.body, 'viewBox="0 0 1672 941"', 'second-track calibrator should use candidate viewBox');
  assertIncludes(secondTrackCalibrator.body, 'centerline=40 点', 'second-track calibrator should show human-traced centerline count');
  assertIncludes(secondTrackCalibrator.body, '用户人工确认通过', 'second-track calibrator should show the user-confirmed boundary');
  assertIncludes(secondTrackCalibrator.body, 'data-trace-panel', 'second-track calibrator should include trace mode on candidate direct view');
  assertIncludes(secondTrackCalibrator.body, '按住鼠标沿底图道路拖动即可连续采样', 'second-track calibrator should allow tracing on the 1672x941 candidate canvas');
  assertNoLeaks(secondTrackCalibrator.body, 'second-track calibrator direct view');
  const keypointEditor = await text('/jumbotron/calibrator/keypoints?candidate=real-explicit-closed-course');
  assert(keypointEditor.response.status === 200, 'second-track keypoint editor should load');
  assertIncludes(keypointEditor.body, '第二赛道关键点编辑', 'keypoint editor should expose a dedicated safe editor');
  assertIncludes(keypointEditor.body, '不会修改几何轨迹', 'keypoint editor should state geometry is read-only');
  assertIncludes(keypointEditor.body, 'viewBox="0 0 1672 941"', 'keypoint editor should use the second-track canvas size');
  assertIncludes(keypointEditor.body, '/jumbotron/candidate-assets/real-explicit-closed-course/background.webp', 'keypoint editor should use the controlled candidate background');
  assertIncludes(keypointEditor.body, 'data-keypoint-handles', 'keypoint editor should render draggable keypoint handles');
  assertIncludes(keypointEditor.body, 'keypoint-json', 'keypoint editor should expose copyable JSON output');
  assertIncludes(keypointEditor.body, '只更新路径进度，不修改中心线', 'keypoint editor should keep edits scoped to path progress');
  assertNoLeaks(keypointEditor.body, 'second-track keypoint editor');
  assertIncludes(calibrator.body, 'P1 调试预览', 'calibrator should expose debug preview evidence');
  assertIncludes(calibrator.body, '导出调试预览 PNG', 'calibrator should expose debug preview PNG capture entry');
  assertIncludes(calibrator.body, 'debug-preview.png</span><strong>已完成</strong>', 'calibrator should mark png export implemented');
  assertNotIncludes(calibrator.body, 'debug-preview.png 导出仍 pending', 'calibrator should not keep png export pending');
  assertIncludes(calibrator.body, 'data-trace-panel', 'calibrator should expose integrated trace centerline panel');
  assertIncludes(calibrator.body, 'value="trace"', 'calibrator should expose trace centerline mode');
  assertIncludes(calibrator.body, 'value="keypoints"', 'calibrator should expose safe keypoint mode');
  assertIncludes(calibrator.body, '关键点安全模式只修改起终点和检查点的 s，不修改中心线几何', 'calibrator should explain safe keypoint editing boundary');
  assertIncludes(calibrator.body, 'data-keypoint-handle', 'calibrator should render keypoint handles for safe keypoint mode');
  assertIncludes(calibrator.body, '按住鼠标沿底图道路拖动即可连续采样', 'calibrator should describe mouse trace sampling');
  assertIncludes(calibrator.body, 'calibrator-trace-output', 'calibrator should expose trace point JSON output');
  assertIncludes(calibrator.body, 'data-trace-guide', 'calibrator should render local trace guide layer');
  assertIncludes(calibrator.body, '验证通过不等于正式资产确认', 'calibrator should keep candidate confirmation boundary for trace mode');
  assertIncludes(calibrator.body, 'data-calibrator-undo', 'calibrator should expose undo button for canvas edits');
  assertIncludes(calibrator.body, 'data-calibrator-redo', 'calibrator should expose redo button for canvas edits');
  assertIncludes(calibrator.body, 'const history =', 'calibrator should keep local edit history for undo redo');
  assertIncludes(calibrator.body, '已撤销上一步画布编辑', 'calibrator should wire undo status copy');
  assertIncludes(calibrator.body, 'beginTrace', 'calibrator should wire mouse trace mode in the main canvas');
  assertIncludes(calibrator.body, 'addCheckpointAt', 'calibrator should wire Shift click checkpoint creation');
  assertIncludes(calibrator.body, 'data-drag-proof', 'calibrator should expose live drag proof panel');
  assertIncludes(calibrator.body, 'data-drag-proof-layer', 'calibrator should expose drag proof SVG layer');
  assertIncludes(calibrator.body, 'data-drag-proof-current', 'calibrator should expose current drag coordinate proof');
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
  const candidatePreview = await binary('/jumbotron/candidate-assets/real-explicit-closed-course/preview.png');
  assert(candidatePreview.response.status === 200, 'active candidate preview should load through controlled route');
  assert(candidatePreview.response.headers.get('content-type') === 'image/png', 'active candidate preview should use PNG content type');
  assert(candidatePreview.body.length > 100000, 'active candidate preview should be non-empty candidate asset');
  const candidateBackground = await binary('/jumbotron/candidate-assets/real-explicit-closed-course/background.webp');
  assert(candidateBackground.response.status === 200, 'active candidate background should load through controlled route');
  assert(candidateBackground.response.headers.get('content-type') === 'image/webp', 'active candidate background should use WEBP content type');
  assert(candidateBackground.body.length > 100000, 'active candidate background should be non-empty candidate asset');
  const blockedCandidateAsset = await request('/jumbotron/candidate-assets/real-explicit-closed-course/notes.md');
  assert(blockedCandidateAsset.status === 404, 'candidate asset route should reject unknown files');
  const candidateJumbotron = await text('/jumbotron?track=real-explicit-closed-course');
  assert(candidateJumbotron.response.status === 200, 'candidate track jumbotron should load after explicit switch');
  assertIncludes(candidateJumbotron.body, '实时赛道', 'candidate jumbotron should render race live track');
  assertIncludes(candidateJumbotron.body, '/jumbotron/candidate-assets/real-explicit-closed-course/background.webp', 'candidate jumbotron should render candidate background only after explicit track switch');
  assertIncludes(candidateJumbotron.body, '✓ Real Explicit Closed Course', 'confirmed second-track jumbotron should show active confirmed track');
  assertNotIncludes(candidateJumbotron.body, '当前赛道已确认。', 'confirmed second-track jumbotron should not expose asset review confirmation copy');
  assertSecondTrackPerspectiveRiderScale(candidateJumbotron.body);
  assertIncludes(candidateJumbotron.body, '/api/jumbotron-replay?profile=full&track=real-explicit-closed-course', 'confirmed second-track jumbotron should poll replay API with the selected track');
  assertNotIncludes(candidateJumbotron.body, 'candidate track gate：未进入正式大屏资产流程', 'explicit candidate switch should not render the old gate');
  assertNotIncludes(candidateJumbotron.body, '候选预览：尚未确认', 'confirmed second-track jumbotron should not show pending candidate copy');
  assertNoLeaks(candidateJumbotron.body, 'jumbotron candidate main view');
  const candidateReplayApi = await json('/api/jumbotron-replay?track=real-explicit-closed-course&frame=1');
  assert(candidateReplayApi.response.status === 200, 'candidate replay API should load for explicit second track');
  assert(candidateReplayApi.body.trackId === 'real-explicit-closed-course', 'candidate replay API should return selected second track id');
  assertSecondTrackPerspectiveRiderScale(candidateReplayApi.body.frameHtml);
  assertNoLeaks(JSON.stringify(candidateReplayApi.body), 'jumbotron candidate replay API');
  const candidateBubbleApi = await json('/api/jumbotron-bubbles?track=real-explicit-closed-course');
  assert(candidateBubbleApi.response.status === 200, 'candidate bubble API should load for explicit candidate main view');
  assert(candidateBubbleApi.body.trackId === 'real-explicit-closed-course', 'candidate bubble API should return selected candidate track id');
  assertNoLeaks(JSON.stringify(candidateBubbleApi.body), 'jumbotron candidate bubble API');

  const calibratorDemo = await text('/jumbotron/calibrator?demo=1');
  assert(calibratorDemo.response.status === 200, 'calibrator demo proof mode should load');
  assertIncludes(calibratorDemo.body, '推荐录制路径', 'calibrator demo should show recording guide');
  assertIncludes(calibratorDemo.body, '打开 /jumbotron，展示 赛事大屏', 'calibrator demo should include step 1');
  assertIncludes(calibratorDemo.body, '多个 参赛条目、TOP3、KPI、消息气泡和滚动条、风险和违规', 'calibrator demo should include race live view evidence step');
  assertIncludes(calibratorDemo.body, '底图、centerline、泳道偏移s、checkpoints', 'calibrator demo should include track asset proof step');
  assertIncludes(calibratorDemo.body, '单马和多马 preview', 'calibrator demo should include preview step');
  assertIncludes(calibratorDemo.body, '导出冻结候选配置', 'calibrator demo should include export candidate step');
  assertIncludes(calibratorDemo.body, '明确数据来源和可运行范围', 'calibrator demo should separate sample data, runnable implementation, and pending work');
  assertIncludes(calibratorDemo.body, 'P1 调试预览', 'calibrator demo should show zone debug preview evidence');
  assertNoLeaks(calibratorDemo.body, 'track calibrator demo');

  const addPoint = await postText('/jumbotron/calibrator', { centerlineAction: 'add', addPointX: '610', addPointY: '315', previewProgress: '37', horseCount: '5', scenarioPreset: 'spread' });
  assertIncludes(addPoint.body, 'P9', 'add point should add a visible control point before closing duplicate');
  assertIncludes(addPoint.body, 'Scrubber 37%', 'scrubber should move the preview horse');
  assertIncludes(addPoint.body, '5 匹多马预览', 'horse count should control multi-horse preview');
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
  const legacyHiddenEdit = await postText('/jumbotron/calibrator', {
    centerlinePointsJson: JSON.stringify([{ x: 120, y: 120 }, { x: 420, y: 150 }, { x: 460, y: 360 }, { x: 120, y: 120 }]),
    lanesJson: JSON.stringify([{ laneId: 'legacy-lane-0', offset: -12 }, { laneId: 'legacy-lane-1', offset: 12 }]),
    checkpointsJson: JSON.stringify([{ checkpointId: 'legacy-cp', label: 'Legacy CP', s: 0.33 }]),
    startSHidden: '0.23',
    finishSHidden: '0.77'
  });
  assertIncludes(legacyHiddenEdit.body, 'legacy-lane-1', 'legacy hidden lanes field should update export');
  assertIncludes(legacyHiddenEdit.body, 'Legacy CP', 'legacy hidden checkpoints field should update checkpoint layer');
  assertIncludes(legacyHiddenEdit.body, 'legacy-cp', 'legacy hidden checkpoints field should persist checkpoint id');
  assertIncludes(legacyHiddenEdit.body, '0.23', 'legacy hidden startS should update export');
  assertIncludes(legacyHiddenEdit.body, '0.77', 'legacy hidden finishS should update export');
  assertIncludes(legacyHiddenEdit.body, '<td>centerline.points</td>', 'legacy hidden centerline field should produce JSON diff');
  assertNoLeaks(legacyHiddenEdit.body, 'track calibrator legacy hidden edit');
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
  assertIncludes(rejectedAsset.body, '人工复核驳回', 'rejected asset review state should show human rejection');
  assertIncludes(rejectedAsset.body, '已驳回候选不得进入正式大屏资产流程', 'rejected candidate should not pass into formal jumbotron assets');
  assertNotIncludes(rejectedAsset.body, 'data-asset-review-status="confirmed"', 'rejected asset review state should not be marked confirmed');
  assertNotIncludes(rejectedAsset.body, '人工复核确认</strong>', 'rejected asset review state should not claim human confirmation');
  assertNoLeaks(rejectedAsset.body, 'track calibrator rejected asset');
  const confirmedAsset = await postText('/jumbotron/calibrator', { assetReviewStatus: 'confirmed' });
  assertIncludes(confirmedAsset.body, 'data-asset-review-status="confirmed"', 'confirmed asset review state should render confirmed status');
  assertIncludes(confirmedAsset.body, '人工复核确认', 'confirmed asset review state should show human confirmation');
  assertIncludes(confirmedAsset.body, '人工确认：已由人工复核通过', 'confirmed asset review state should keep explicit human boundary');
  assertIncludes(confirmedAsset.body, '正式资产 进入正式大屏资产流程', 'confirmed asset review state should distinguish formal use from candidate preview');
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
  const activeCandidateImport = await postText('/jumbotron/calibrator', { candidateImport: 'active-second-track-ai' });
  assertIncludes(activeCandidateImport.body, 'real-explicit-closed-course', 'AI candidate import should load grandstand track id');
  assertIncludes(activeCandidateImport.body, 'real-explicit-closed-course', 'AI candidate import should load current approved candidate name');
  assertIncludes(activeCandidateImport.body, '40 点', 'AI candidate import should preserve the current closed candidate centerline for runtime');
  assertIncludes(activeCandidateImport.body, '12 条泳道', 'AI candidate import should load 12 lanes');
  assertIncludes(activeCandidateImport.body, 'checkpoints=4', 'AI candidate import should load 4 checkpoints');
  assertIncludes(activeCandidateImport.body, '/jumbotron/candidate-assets/real-explicit-closed-course/background.webp', 'AI candidate import should use controlled candidate background route');
  assertIncludes(activeCandidateImport.body, 'data-asset-review-status="confirmed"', 'AI candidate import should reflect persisted user human review');
  assertNotIncludes(activeCandidateImport.body, 'data-asset-review-status="pending"', 'AI candidate import should not regress persisted human review to pending');
  assertIncludes(activeCandidateImport.body, '导入配置到导出候选的差异', 'AI candidate import should still expose diff review boundary');
  assertNoLeaks(activeCandidateImport.body, 'track calibrator active candidate import');
  const sharpTurn = await postText('/jumbotron/calibrator', { centerlinePoints: JSON.stringify([{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 120, y: 110 }, { x: 100, y: 100 }]) });
  assertIncludes(sharpTurn.body, '! 弯道转角自然', 'sharp turn should fail warning validation');
  assertNoLeaks(sharpTurn.body, 'track calibrator sharp turn');
  const autoFixedSharpTurn = await postText('/jumbotron/calibrator', { autoFixSharpTurns: '1', centerlinePoints: JSON.stringify([{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 120, y: 110 }, { x: 100, y: 100 }]) });
  assertIncludes(autoFixedSharpTurn.body, '自动修复候选草稿', 'auto-fix should generate candidate draft evidence');
  assertIncludes(autoFixedSharpTurn.body, 'fix count=1', 'auto-fix should report at least one deterministic fix');
  assertIncludes(autoFixedSharpTurn.body, 'smooth-sharp-turn', 'auto-fix should list smoothing action');
  assertIncludes(autoFixedSharpTurn.body, 'remainingSharpTurnCount=', 'auto-fix should report remaining sharp turns');
  assertIncludes(autoFixedSharpTurn.body, '<td>centerline.points</td>', 'auto-fix should produce JSON diff for centerline points');
  assertNoLeaks(autoFixedSharpTurn.body, 'track calibrator auto-fixed sharp turn');
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
