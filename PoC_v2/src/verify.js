import { createServerApp } from './server.js';
import { createOrganizerServer } from './organizer-server.js';

const port = 4310;
const organizerPort = 4311;
const app = createServerApp(port, organizerPort);
let organizer;

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

async function submitTeam(cookie, answer = '满分答案') {
  const response = await request('/team/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ answer })
  });
  return {
    response,
    body: await response.text(),
    submitCookie: response.headers.get('set-cookie')?.split(';')[0] || ''
  };
}

function assertLoginPageFocused(body) {
  const forbidden = [
    '身份',
    '权限',
    '组织方',
    '队伍',
    '提交',
    '评价',
    '回放',
    '过程记录',
    '榜单',
    '数据',
    '赛事管理',
    '工作区',
    '公开结果'
  ];
  for (const value of forbidden) assertNotIncludes(body, value, `login page must not explain ${value}`);
}

function assertNoInternalLeaks(body, pageName) {
  const forbidden = [
    'evaluation_policy.json',
    'data_boundary_policy.json',
    'submissions.json',
    'riding_records.json',
    'replay_events.json',
    '/media/lemonhdl',
    '完整 Riding Record 原文',
    '组织方评审备注',
    '评审细则',
    '评价细则',
    'ary-protected-store',
    'organizer-private',
    'PoC',
    'mock',
    'Mock',
    'Demo',
    '可用账号',
    '固定账号',
    '不接数据库',
    '密码按',
    '角色分流',
    '授权投影',
    'submissionId',
    '服务端',
    'URL',
    'API'
  ];
  for (const value of forbidden) assertNotIncludes(body, value, `${pageName} must not expose ${value}`);
}

try {
  const loginPage = await text('/login');
  assert(loginPage.response.status === 200, 'login page should load');
  assertIncludes(loginPage.body, '登录 ARY', 'login page should show product login title');
  assertIncludes(loginPage.body, '账号登录', 'login page should show login form');
  assertNoInternalLeaks(loginPage.body, 'login page');
  assertLoginPageFocused(loginPage.body);

  const badLogin = await login('team_001', 'wrong');
  assert(badLogin.response.status === 401, 'wrong password should be rejected');

  const organizerLogin = await login('Organizer_001', '********');
  assert(organizerLogin.response.status === 302, 'organizer login should redirect');
  assert(organizerLogin.location === '/organizer', 'organizer should enter organizer dashboard');
  assert(organizerLogin.cookie.startsWith('ary_v2_session='), 'organizer login should set session');

  const team001 = await login('team_001', '******');
  assert(team001.response.status === 302, 'team_001 login should redirect');
  assert(team001.location === '/team', 'team_001 should enter team dashboard');

  const team002 = await login('team_002', '**********');
  assert(team002.response.status === 302, 'team_002 login should redirect');
  assert(team002.location === '/team', 'team_002 should enter team dashboard');

  const organizerPage = await text('/organizer', organizerLogin.cookie);
  assert(organizerPage.response.status === 200, 'organizer dashboard should load');
  assertIncludes(organizerPage.body, '组织方控制台', 'organizer page should show dashboard');
  assertIncludes(organizerPage.body, 'team_001', 'organizer can see team_001 summary');
  assertIncludes(organizerPage.body, 'team_002', 'organizer can see team_002 summary');
  assertIncludes(organizerPage.body, '多维评价', 'organizer should see evaluation dimensions');
  assertNoInternalLeaks(organizerPage.body, 'organizer page');

  const organizerAsTeam = await text('/team', organizerLogin.cookie);
  assert(organizerAsTeam.response.status === 403, 'organizer cannot access team page as a team');

  const team001OrganizerPage = await text('/organizer', team001.cookie);
  assert(team001OrganizerPage.response.status === 403, 'team_001 cannot access organizer page');

  const team001Page = await text('/team', team001.cookie);
  assert(team001Page.response.status === 200, 'team_001 dashboard should load');
  assertIncludes(team001Page.body, 'Team 001 的参赛空间', 'team_001 should see own workspace');
  assertIncludes(team001Page.body, '还没有提交', 'team_001 should start locked before submission');
  assertNotIncludes(team001Page.body, 'Team 001：需求边界与 Steering 纠偏', 'team_001 dashboard must not show record before submission');
  assertNoInternalLeaks(team001Page.body, 'team_001 page');

  const lockedRecords = await text('/team/records', team001.cookie);
  assert(lockedRecords.response.status === 200, 'locked team records should load');
  assertIncludes(lockedRecords.body, '请先提交参赛内容', 'team records should be locked before submission');
  assertNotIncludes(lockedRecords.body, 'Team 001：需求边界与 Steering 纠偏', 'locked records must not show record');
  assertNoInternalLeaks(lockedRecords.body, 'locked records page');

  const lockedReplay = await text('/team/replay', team001.cookie);
  assert(lockedReplay.response.status === 200, 'locked replay should load');
  assertIncludes(lockedReplay.body, '请先提交参赛内容', 'team replay should be locked before submission');
  assertNotIncludes(lockedReplay.body, '固定任务边界', 'locked replay must not show events');
  assertNoInternalLeaks(lockedReplay.body, 'locked replay page');

  const missingSubmit = await submitTeam(team001.cookie, '满分答案');
  assert(missingSubmit.response.status === 200, 'submission should render result page');
  assertIncludes(missingSubmit.body, '暂时无法完成评测', 'submission should show missing result before organizer starts');
  assert(missingSubmit.submitCookie === '', 'missing result should not unlock records');
  assertNoInternalLeaks(missingSubmit.body, 'missing submission page');

  organizer = createOrganizerServer(organizerPort);
  const evaluatedSubmit = await submitTeam(team001.cookie, '满分答案');
  assert(evaluatedSubmit.response.status === 200, 'evaluated submission should render result page');
  assertIncludes(evaluatedSubmit.body, '本次提交已通过评测', 'submission should show evaluated result when organizer starts');
  assert(evaluatedSubmit.submitCookie === 'ary_v2_submitted_team_001=done', 'evaluated submission should unlock team_001 records');
  assertNoInternalLeaks(evaluatedSubmit.body, 'evaluated submission page');

  const team001UnlockedCookie = `${team001.cookie}; ${evaluatedSubmit.submitCookie}`;
  const team001Records = await text('/team/records', team001UnlockedCookie);
  assert(team001Records.response.status === 200, 'unlocked team records should load');
  assertIncludes(team001Records.body, 'Team 001：需求边界与 Steering 纠偏', 'team_001 should see own record after submission');
  assertNotIncludes(team001Records.body, 'Team 002：验证证据与回放组织', 'team_001 records must not show team_002 record');
  assertNoInternalLeaks(team001Records.body, 'team_001 records page');

  const team001Detail = await text('/team/records/record-team-001', team001UnlockedCookie);
  assert(team001Detail.response.status === 200, 'team_001 detail should load after submission');
  assertIncludes(team001Detail.body, '过程摘要', 'record detail should show process summary');
  assertIncludes(team001Detail.body, '固定任务边界', 'record detail should show own event');
  assertNotIncludes(team001Detail.body, '建立验证目标', 'record detail must not show team_002 event');
  assertNoInternalLeaks(team001Detail.body, 'team_001 detail page');

  const team001Replay = await text('/team/replay', team001UnlockedCookie);
  assertIncludes(team001Replay.body, '固定任务边界', 'team_001 replay should include own event after submission');
  assertIncludes(team001Replay.body, '用户 Steering', 'team_001 replay should include steering event');
  assertNotIncludes(team001Replay.body, '建立验证目标', 'team_001 replay must not include team_002 event');
  assertNoInternalLeaks(team001Replay.body, 'team_001 replay page');

  const team002Page = await text('/team', team002.cookie);
  assert(team002Page.response.status === 200, 'team_002 dashboard should load');
  assertIncludes(team002Page.body, 'Team 002 的参赛空间', 'team_002 should see own workspace');
  assertIncludes(team002Page.body, '还没有提交', 'team_002 should remain locked before own submission');
  assertNotIncludes(team002Page.body, 'Team 001：需求边界与 Steering 纠偏', 'team_002 must not see team_001 record');
  assertNoInternalLeaks(team002Page.body, 'team_002 page');

  const team002LockedReplay = await text('/team/replay', team002.cookie);
  assertIncludes(team002LockedReplay.body, '请先提交参赛内容', 'team_002 replay should remain locked before own submission');
  assertNotIncludes(team002LockedReplay.body, '固定任务边界', 'team_002 replay must not inherit team_001 unlock');

  const team001OwnApi = await json('/api/submissions/sub-team-001-r1', team001.cookie);
  assert(team001OwnApi.response.status === 200, 'team_001 can fetch own submission');
  assert(team001OwnApi.body.teamId === 'team_001', 'team_001 own API should return team_001 data');

  const team001OtherApi = await json('/api/submissions/sub-team-002-r1', team001.cookie);
  assert(team001OtherApi.response.status === 403, 'team_001 cannot fetch team_002 submission by id');

  const team002OtherApi = await json('/api/submissions/sub-team-001-r1', team002.cookie);
  assert(team002OtherApi.response.status === 403, 'team_002 cannot fetch team_001 submission by id');

  const organizerSubmissionApi = await json('/api/submissions/sub-team-002-r1', organizerLogin.cookie);
  assert(organizerSubmissionApi.response.status === 200, 'organizer can fetch team submission summary');
  assert(organizerSubmissionApi.body.teamId === 'team_002', 'organizer API should return requested team summary');

  const leaderboard = await text('/leaderboard', team001.cookie);
  assert(leaderboard.response.status === 200, 'leaderboard should load for team');
  assertIncludes(leaderboard.body, '赛事榜单', 'leaderboard should show race leaderboard');
  assertIncludes(leaderboard.body, 'excellent', 'leaderboard can show public score band value');
  assertNotIncludes(leaderboard.body, '提交原文', 'leaderboard must not expose submission body');
  assertNoInternalLeaks(leaderboard.body, 'leaderboard page');

  assertNotIncludes(leaderboard.body, '访问说明', 'navigation must not include access explanation page');

  const removedAccessPage = await text('/security-evidence', team001.cookie);
  assert(removedAccessPage.response.status === 404, 'access explanation page should not exist as product page');

  const anonymousApi = await json('/api/my-submissions');
  assert(anonymousApi.response.status === 401, 'anonymous API access should be rejected');

  console.log('VERIFY_PASS ARY PoC_v2 role boundary holds');
} finally {
  if (organizer) await closeServer(organizer);
  await closeServer(app);
}
