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

  const yard = await text('/yard');
  assert(yard.response.status === 200, 'public yard should load');
  assertIncludes(yard.body, 'Public Yard', 'yard should show public race discovery');
  assertIncludes(yard.body, 'ARY GRS 001：Product Definition Race', 'yard should show disclosed race');
  assertIncludes(yard.body, 'Organizer 数据可用', 'yard should show public source state');
  assertNoLeaks(yard.body, 'public yard');

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
