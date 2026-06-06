import { createServerApp } from './server.js';
import { createOrganizerServer } from './organizer-server.js';
import { join } from 'node:path';
import { organizerDir, readJson, writeJson } from './storage.js';

const port = 4310;
const organizerPort = 4311;
const evaluatorServicePath = join(organizerDir, 'evaluator_service.json');
const originalEvaluatorService = await readJson(evaluatorServicePath);
await writeJson(evaluatorServicePath, { ...originalEvaluatorService, enabled: true });
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

async function setEvaluator(cookie, enabled) {
  return request('/organizer/evaluator', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ enabled: enabled ? 'on' : 'off' })
  });
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
    'leaderboard_projection.json',
    'evaluation_policy.json',
    'data_boundary_policy.json',
    'submissions.json',
    'riding_records.json',
    'replay_events.json',
    'rider_sessions.json',
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
    'API',
    '.claude',
    '投影',
    '首页显示原则',
    '默认折叠',
    '减少首屏视觉压力',
    '不压到',
    '不压在',
    '说明墙',
    '手动展开详情',
    '手动展开自查项',
    '不要压住主行动',
    '只保留下一步',
    '驾驶舱只显示下一步',
    '细节进入子页面',
    '放在独立页面',
    '只在本页展开',
    'From Coder to Rider',
    '这组卡片看什么',
    '这里不是在解释平台设计',
    '不只统计产出数量',
    '把目标讲清楚',
    '让 Agent 正确行动',
    '观察、判断、干预与验收',
    '把过程复盘成能力',
    'Rider 能力指标',
    '从 Coder 产出指标转向 Rider',
    '能力卡片'
  ];
  for (const value of forbidden) assertNotIncludes(body, value, `${pageName} must not expose ${value}`);
}

function assertGuidanceEvidence(body, pageName) {
  const expected = [
    'DevCompass Racing',
    '你不是一个人在 Hackathon',
    '向 Agent 描述目标',
    '让 Agent 拆解任务',
    '检查执行方向',
    '判断技术方案',
    '理解架构与关键技术点',
    '推进可执行计划',
    '被带着，不迷路',
    '学原理，懂技术',
    '形成可行动计划'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show guidance evidence: ${value}`);
}

function assertReviewReplay(body, pageName) {
  const expected = [
    'Review & Replay',
    '做完不是结束，复盘才是成长开始',
    '计划',
    '执行',
    '检查',
    '复盘',
    '提升',
    '计划是否清楚',
    '架构是否合理',
    '技术选择是否有效',
    'Agent 使用是否可控',
    '过程是否能被回看和改进'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show Review & Replay: ${value}`);
}

function assertAgentRidingSkillTraining(body, pageName) {
  const expected = [
    'Learning by Racing',
    '这场 Race 你们要练什么？',
    'Build up your Agent Riding Skill',
    '目标设定',
    '技术判断',
    '任务拆解',
    '架构理解',
    '过程观察',
    '方向干预',
    '边做边学',
    '边协同边成长'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show Agent Riding Skill training: ${value}`);
}

function assertCapabilityPortfolio(body, pageName) {
  const expected = [
    'DevCompass Racing for Agentic Development',
    '可展示的智能体开发能力档案',
    'Race 完赛状态',
    '项目作品',
    'Riding Replay 过程记录',
    '能力标签',
    '评审反馈',
    '可见',
    '可证',
    '可评',
    '可推荐',
    '可被人工考虑推荐'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show capability portfolio: ${value}`);
}

function assertRacingIdentity(body, pageName) {
  const expected = [
    'Ride Agents. Build the Future.',
    '像赛马一样驾驭 Coding Agent',
    'AI 时代的开发者竞技场',
    '智能体工程师的训练营',
    '身份感',
    '未来感',
    '竞技感'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show racing identity: ${value}`);
}

function assertRacingStatus(body, pageName) {
  const expected = [
    '赛道状态',
    '历史整理',
    '提交评测',
    'Records 解锁',
    '公开展示'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show racing status: ${value}`);
}

function assertGrsDogfoodLoop(body, pageName) {
  const expected = [
    'Build the Yard By Racing in the Yard',
    'GRS 是什么？',
    'ARY Genesis Race Series',
    '创世骑行系列赛',
    'self-dogfood',
    '定义',
    '设计',
    '构建',
    '验证',
    'ARY 的关键问题'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show GRS dogfood loop: ${value}`);
}

function assertGenesisRidersLaunch(body, pageName) {
  const expected = [
    '课堂首发',
    '你们不是观众，是 Genesis Riders',
    'Be the first riders.',
    '约 100 名学生',
    '第一批 ARY GRS 的学生骑手',
    '报名进入',
    '组队骑行',
    '提交复盘',
    '公开展示'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show Genesis Riders launch: ${value}`);
}

function assertPublicDisclosureSource(body, pageName) {
  const expected = [
    'ARY GRS 001：Product Definition',
    '数据安全的 Race',
    'Organizer 侧存留',
    '公开侧最小承载',
    '仍可组织',
    '主动披露',
    '公开侧只承载披露摘要',
    '创建、披露、组织与展示',
    '公开摘要'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show public disclosure source: ${value}`);
}

function assertRaceFlowBrief(body, pageName) {
  const expected = [
    'Race Flow：从组队到复盘',
    '你们不是只提交最后答案',
    '如何骑行智能体完成任务',
    'Race Brief',
    'Team Build',
    '工具准备',
    'Riding Plan',
    'Co-Riding',
    'Checkpoint',
    'Submission',
    'Review &amp; Replay',
    '方案与技术验证',
    '产出：挑战边界与验收要求。',
    '产出：方向检查与改进项。',
    '产出：进入评测的交付材料。',
    '产出：复盘发现与下一轮行动。',
    'DevCompass Racing for Agentic Development'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show Race Flow brief: ${value}`);
}

function assertRaceDeliverables(body, pageName) {
  const expected = [
    'Race Deliverables',
    '你们需要交付什么？',
    '提交时要能说明目标、系统设计、技术验证、方案展示和 Riding Record 分别对应哪些证据',
    '分别对应哪些证据',
    '先看过程摘要',
    '产品定义',
    '系统设计',
    '技术验证',
    '方案展示',
    'Riding Record',
    '公开摘要',
    '回放事件'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show Race deliverables: ${value}`);
}

function assertExcellentWorkEvaluation(body, pageName) {
  const expected = [
    '优秀作品评价',
    '我们如何看待优秀作品？',
    '7 个维度综合评估',
    '价值、可落地、可演进',
    '不只看你做出了什么',
    '如何骑行智能体把它做出来',
    '逐项判断',
    '问题定义',
    '产品逻辑',
    '数据主权',
    '关键假设验证',
    '架构边界',
    '展示可理解',
    '协作可复盘',
    '可追踪、可解释、可复盘'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show excellent work evaluation: ${value}`);
}

function assertReadyToRide(body, pageName) {
  const expected = [
    'Ready to Ride?',
    'Ride Agents. Build the Future.',
    '第一场 Race 从这间课堂开始',
    '第一批 Genesis Riders',
    '软件工程师到智能体工程师',
    '现在可以开始',
    '确认身份',
    '开始本轮 Race',
    '完成骑行闭环',
    '沉淀下一步'
  ];
  for (const value of expected) assertIncludes(body, value, `${pageName} should show Ready to Ride: ${value}`);
}

try {
  const loginPage = await text('/login');
  assert(loginPage.response.status === 200, 'login page should load');
  assertIncludes(loginPage.body, '登录 ARY', 'login page should show product login title');
  assertIncludes(loginPage.body, '账号登录', 'login page should show login form');
  assertNoInternalLeaks(loginPage.body, 'login page');
  assertNotIncludes(loginPage.body, 'Genesis Riders', 'login page must not show launch narrative');
  assertNotIncludes(loginPage.body, 'Ready to Ride?', 'login page must not show race action narrative');
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
  assert(organizerPage.response.status === 200, 'organizer overview should load');
  assertIncludes(organizerPage.body, '组织方总览', 'organizer page should show overview title');
  assertIncludes(organizerPage.body, 'Organizer overview', 'organizer page should show overview chrome');
  assertIncludes(organizerPage.body, '查看 Race 管理', 'organizer page should provide race management entry');
  assertIncludes(organizerPage.body, '进入评价工作台', 'organizer page should provide evaluation entry');
  assertIncludes(organizerPage.body, '队伍提交', 'organizer page should keep submission table visible');
  assertIncludes(organizerPage.body, 'team_001', 'organizer can see team_001 summary');
  assertIncludes(organizerPage.body, 'team_002', 'organizer can see team_002 summary');
  assertIncludes(organizerPage.body, '当前组织 2 支队伍', 'organizer page should bind overview to team count');
  assertIncludes(organizerPage.body, '评测服务', 'organizer page should show evaluator service control');
  assertIncludes(organizerPage.body, '已开启', 'organizer page should show evaluator service is enabled by default');
  assertIncludes(organizerPage.body, '关闭评测服务', 'organizer page should provide evaluator off action');
  assertIncludes(organizerPage.body, '数据存储位置: 组织者本地', 'organizer page should show local organizer storage location');
  assertNotIncludes(organizerPage.body, 'Race Flow：从组队到复盘', 'organizer overview should move race flow to nested page');
  assertNotIncludes(organizerPage.body, '优秀作品评价', 'organizer overview should move evaluation rubric to nested page');
  assertNotIncludes(organizerPage.body, 'Build the Yard By Racing in the Yard', 'organizer overview should move GRS method to nested page');
  assertNoInternalLeaks(organizerPage.body, 'organizer page');

  const organizerRace = await text('/organizer/race', organizerLogin.cookie);
  assert(organizerRace.response.status === 200, 'organizer race management page should load');
  assertIncludes(organizerRace.body, 'Race 管理', 'organizer race page should show title');
  assertIncludes(organizerRace.body, '2 支队伍进入 Race', 'organizer race page should bind Race Flow to team count');
  assertIncludes(organizerRace.body, '2 次提交进入作品、文档与过程记录评测', 'organizer race page should bind Race Flow to submissions');
  assertIncludes(organizerRace.body, 'Organizer 持有 5 类原始赛事资料', 'organizer race page should bind retained source count');
  assertIncludes(organizerRace.body, '公开展示来自 4 类主动披露摘要', 'organizer race page should bind public disclosure count');
  assertGenesisRidersLaunch(organizerRace.body, 'organizer race page');
  assertGrsDogfoodLoop(organizerRace.body, 'organizer race page');
  assertPublicDisclosureSource(organizerRace.body, 'organizer race page');
  assertRaceFlowBrief(organizerRace.body, 'organizer race page');
  assertRaceDeliverables(organizerRace.body, 'organizer race page');
  assertReadyToRide(organizerRace.body, 'organizer race page');
  assertIncludes(organizerRace.body, '训练场与竞技场闭环', 'organizer race page should show ARY operating loop');
  assertIncludes(organizerRace.body, '创建', 'organizer race page should show create capability');
  assertIncludes(organizerRace.body, '披露', 'organizer race page should show disclose capability');
  assertIncludes(organizerRace.body, '组织', 'organizer race page should show organize capability');
  assertIncludes(organizerRace.body, '运行', 'organizer race page should show run capability');
  assertIncludes(organizerRace.body, '评审', 'organizer race page should show review capability');
  assertIncludes(organizerRace.body, '展示', 'organizer race page should show showcase capability');
  assertIncludes(organizerRace.body, 'Organizer 持有原始赛事资料', 'organizer race page should show organizer data custody');
  assertIncludes(organizerRace.body, '未公开过程材料', 'organizer race page should render custody policy retained data');
  assertIncludes(organizerRace.body, '本队回放记录', 'organizer race page should render custody policy team disclosure');
  assertIncludes(organizerRace.body, '公开排名', 'organizer race page should render public disclosure policy');
  assertNoInternalLeaks(organizerRace.body, 'organizer race page');

  const organizerEvaluation = await text('/organizer/evaluation', organizerLogin.cookie);
  assert(organizerEvaluation.response.status === 200, 'organizer evaluation page should load');
  assertIncludes(organizerEvaluation.body, '评价工作台', 'organizer evaluation page should show title');
  assertIncludes(organizerEvaluation.body, '多维评价', 'organizer evaluation page should see evaluation dimensions');
  assertNotIncludes(organizerEvaluation.body, '四段主线', 'organizer evaluation page should not repeat mainline cards');
  assertExcellentWorkEvaluation(organizerEvaluation.body, 'organizer evaluation page');
  assertNoInternalLeaks(organizerEvaluation.body, 'organizer evaluation page');

  const organizerAsTeam = await text('/team', organizerLogin.cookie);
  assert(organizerAsTeam.response.status === 403, 'organizer cannot access team page as a team');

  const team001OrganizerPage = await text('/organizer', team001.cookie);
  assert(team001OrganizerPage.response.status === 403, 'team_001 cannot access organizer page');

  const team001History = await text('/team/history', team001.cookie);
  assert(team001History.response.status === 200, 'team_001 history should load before submission');
  assertIncludes(team001History.body, 'Team 001 的历史素材', 'team_001 should see own history workspace');
  assertIncludes(team001History.body, '从项目讨论到需求边界', 'team_001 should see scope history record');
  assertIncludes(team001History.body, '从需求边界到页面收敛', 'team_001 should keep original DevCompass record');
  assertIncludes(team001History.body, '从资料范围到可运行验证', 'team_001 should see validation history record');
  assertIncludes(team001History.body, '从 PPT 页面到 Race 体验', 'team_001 should see PPT race history record');
  assertIncludes(team001History.body, '从信息过载到驾驶舱分层', 'team_001 should see IA history record');
  assertNotIncludes(team001History.body, '从验证证据到回放组织', 'team_001 history must not show team_002 session');
  assertIncludes(team001History.body, '完整历史保留在 Rider 本地', 'history should explain local retention in product wording');
  assertNoInternalLeaks(team001History.body, 'team_001 history page');

  const team001HistoryDetail = await text('/team/history/session-team-001-devcompass-001', team001.cookie);
  assert(team001HistoryDetail.response.status === 200, 'team_001 history detail should load');
  assertIncludes(team001HistoryDetail.body, '本轮目标', 'history detail should show objective');
  assertIncludes(team001HistoryDetail.body, 'Rider 意图', 'history detail should show rider intent');
  assertIncludes(team001HistoryDetail.body, '软件搭建过程', 'history detail should show build timeline');
  assertIncludes(team001HistoryDetail.body, '产物变化', 'history detail should show artifact changes');
  assertIncludes(team001HistoryDetail.body, '第一版资料范围实验', 'history detail should show v1 data range experiment');
  assertIncludes(team001HistoryDetail.body, '转向 Riding Record', 'history detail should show v1 transition to Riding Record');
  assertIncludes(team001HistoryDetail.body, '第一版回放搭建', 'history detail should show v1 replay construction');
  assertIncludes(team001HistoryDetail.body, '第一版页面收敛', 'history detail should show v1 page cleanup');
  assertIncludes(team001HistoryDetail.body, '提交后解锁', 'history detail should show v1 submit unlock');
  assertIncludes(team001HistoryDetail.body, '继承边界', 'history detail should show v2 inherited flow boundary');
  assertIncludes(team001HistoryDetail.body, '评测依赖', 'history detail should show organizer evaluation dependency');
  assertIncludes(team001HistoryDetail.body, '队伍隔离', 'history detail should show team isolation construction');
  assertIncludes(team001HistoryDetail.body, '访问说明页删除', 'history detail should show removed explanation page');
  assertIncludes(team001HistoryDetail.body, '修复节点', 'history detail should show fix count');
  assertNotIncludes(team001HistoryDetail.body, '这场 Race 你们要练什么？', 'history detail should not repeat self-check training section');
  assertNotIncludes(team001HistoryDetail.body, 'Review &amp; Replay', 'history detail should not repeat replay path section');
  assertNotIncludes(team001HistoryDetail.body, '你不是一个人在 Hackathon', 'history detail should not repeat guidance evidence section');
  assertNotIncludes(team001HistoryDetail.body, 'Learn. Build. Show. Grow.', 'history detail should not repeat growth path');
  assertNotIncludes(team001HistoryDetail.body, '让回放能解释为什么这些验证动作重要', 'team_001 detail must not show team_002 steering intent');
  assertNoInternalLeaks(team001HistoryDetail.body, 'team_001 history detail page');

  const team001OtherHistoryDetail = await text('/team/history/session-team-002-devcompass-001', team001.cookie);
  assert(team001OtherHistoryDetail.response.status === 200, 'other history detail request should render not found');
  assertIncludes(team001OtherHistoryDetail.body, '未找到可查看的历史记录', 'team_001 cannot open team_002 history detail');
  assertNotIncludes(team001OtherHistoryDetail.body, '从验证证据到回放组织', 'not found page must not leak team_002 history');
  assertNoInternalLeaks(team001OtherHistoryDetail.body, 'team_001 other history detail page');

  const team001HistoryApi = await json('/api/team-history', team001.cookie);
  assert(team001HistoryApi.response.status === 200, 'team_001 can fetch own history records');
  assert(team001HistoryApi.body.length === 5, 'team_001 history API should return five records');
  assert(team001HistoryApi.body.every((item) => item.teamId === 'team_001'), 'team_001 history API should only return team_001 data');
  assert(team001HistoryApi.body.every((item) => item.containsFullSession === false), 'history API should not contain full session');
  assert(team001HistoryApi.body.every((item) => item.sourceRetainedLocally === true), 'history API should mark local retention');
  assert(team001HistoryApi.body.some((item) => item.title === '从项目讨论到需求边界'), 'history API should include scope history');
  assert(team001HistoryApi.body.some((item) => item.title === '从需求边界到页面收敛'), 'history API should keep original history');
  assert(team001HistoryApi.body.some((item) => item.title === '从资料范围到可运行验证'), 'history API should include validation history');
  assert(team001HistoryApi.body.some((item) => item.title === '从 PPT 页面到 Race 体验'), 'history API should include PPT race history');
  assert(team001HistoryApi.body.some((item) => item.title === '从信息过载到驾驶舱分层'), 'history API should include IA history');
  assert(team001HistoryApi.body.every((item) => Array.isArray(item.buildTimeline) && item.buildTimeline.length >= 4), 'history API should expose selected build timeline evidence');
  const originalHistory = team001HistoryApi.body.find((item) => item.sessionId === 'session-team-001-devcompass-001');
  assert(originalHistory && originalHistory.buildTimeline.length >= 16, 'history API should keep concrete original build timeline steps');
  assertIncludes(originalHistory.buildTimeline[0].phase, '第一版资料范围实验', 'history API should preserve v1 starting phase');
  const team001RecordIds = new Set(team001HistoryApi.body.map((item) => item.recordId));
  const team001SessionIds = new Set(team001HistoryApi.body.map((item) => item.sessionId));

  const organizerHistoryApi = await json('/api/team-history', organizerLogin.cookie);
  assert(organizerHistoryApi.response.status === 403, 'organizer cannot fetch team history API');

  const team001Page = await text('/team', team001.cookie);
  assert(team001Page.response.status === 200, 'team_001 cockpit should load');
  assertIncludes(team001Page.body, 'Team 001 的驾驶舱', 'team_001 should see own cockpit');
  assertIncludes(team001Page.body, '还没有提交', 'team_001 should start locked before submission');
  assertIncludes(team001Page.body, '提交参赛内容', 'team_001 cockpit should show primary next action');
  assertIncludes(team001Page.body, 'Race 指南', 'team_001 cockpit should link to race guide');
  assertIncludes(team001Page.body, '提交前自查', 'team_001 cockpit should link to self check');
  assertIncludes(team001Page.body, '查看历史素材', 'team_001 cockpit should link to history');
  assertIncludes(team001Page.body, '继续处理', 'team_001 cockpit should show next step entrypoints');
  assertIncludes(team001Page.body, '资料范围提醒', 'team_001 cockpit should explain visible scope');
  assertNotIncludes(team001Page.body, '优秀作品评价', 'team_001 cockpit should move rubric to nested page');
  assertNotIncludes(team001Page.body, 'Race Flow：从组队到复盘', 'team_001 cockpit should move race flow to nested page');
  assertNotIncludes(team001Page.body, 'Team 001：需求边界与 Steering 纠偏', 'team_001 cockpit must not show record before submission');
  assertNoInternalLeaks(team001Page.body, 'team_001 page');

  const team001Race = await text('/team/race', team001.cookie);
  assert(team001Race.response.status === 200, 'team_001 race guide should load');
  assertIncludes(team001Race.body, '本轮 Race 怎么参加', 'team_001 race guide should show race guide title');
  assertGenesisRidersLaunch(team001Race.body, 'team_001 race guide');
  assertRaceFlowBrief(team001Race.body, 'team_001 race guide');
  assertRaceDeliverables(team001Race.body, 'team_001 race guide');
  assertReadyToRide(team001Race.body, 'team_001 race guide');
  assertIncludes(team001Race.body, '5 条 DevCompass Racing 历史记录已整理为本队素材', 'team_001 race guide should bind Race Flow to history records');
  assertIncludes(team001Race.body, '下一步提交作品、文档与过程记录', 'team_001 race guide should show next Race Flow submission action');
  assertNoInternalLeaks(team001Race.body, 'team_001 race guide');

  const team001Evaluation = await text('/team/evaluation', team001.cookie);
  assert(team001Evaluation.response.status === 200, 'team_001 self check should load');
  assertIncludes(team001Evaluation.body, '提交前自查', 'team_001 self check should show title');
  assertIncludes(team001Evaluation.body, '当前重点', 'team_001 self check should keep current focus visible');
  assertIncludes(team001Evaluation.body, '先补齐过程摘要', 'team_001 self check should keep process summary focus');
  assertNotIncludes(team001Evaluation.body, '四段主线', 'team_001 self check should not repeat mainline cards');
  assertNotIncludes(team001Evaluation.body, 'Learn. Build. Show. Grow.', 'team_001 self check should not repeat growth path');
  assertNotIncludes(team001Evaluation.body, 'Ride Agents. Build the Future.', 'team_001 self check should not repeat racing identity');
  assertNotIncludes(team001Evaluation.body, '赛道状态', 'team_001 self check should not repeat racing status');
  assertExcellentWorkEvaluation(team001Evaluation.body, 'team_001 self check');
  assertAgentRidingSkillTraining(team001Evaluation.body, 'team_001 self check');
  assertGuidanceEvidence(team001Evaluation.body, 'team_001 self check');
  assertReviewReplay(team001Evaluation.body, 'team_001 self check');
  assertNoInternalLeaks(team001Evaluation.body, 'team_001 self check');

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

  const lockedReplayApi = await json('/api/team-replay', team001.cookie);
  assert(lockedReplayApi.response.status === 403, 'team replay API should be locked before submission');

  const evaluatorOff = await setEvaluator(organizerLogin.cookie, false);
  assert(evaluatorOff.status === 302, 'organizer can turn evaluator service off');
  const organizerPageOff = await text('/organizer', organizerLogin.cookie);
  assertIncludes(organizerPageOff.body, '已关闭', 'organizer page should show evaluator service off state');
  assertIncludes(organizerPageOff.body, '开启评测服务', 'organizer page should provide evaluator on action');
  const disabledSubmit = await submitTeam(team001.cookie, '满分答案');
  assert(disabledSubmit.response.status === 200, 'disabled evaluator submission should render result page');
  assertIncludes(disabledSubmit.body, '组织方评测服务当前未开启', 'disabled evaluator should block evaluation clearly');
  assert(disabledSubmit.submitCookie === '', 'disabled evaluator should not unlock records');
  assertNoInternalLeaks(disabledSubmit.body, 'disabled evaluator submission page');
  const evaluatorOn = await setEvaluator(organizerLogin.cookie, true);
  assert(evaluatorOn.status === 302, 'organizer can turn evaluator service on');
  const organizerPageOn = await text('/organizer', organizerLogin.cookie);
  assertIncludes(organizerPageOn.body, '已开启', 'organizer page should show evaluator service on state again');

  const forgedUnlocked = await text('/team/records', `${team001.cookie}; ary_v2_submitted_team_001=done`);
  assertIncludes(forgedUnlocked.body, '请先提交参赛内容', 'forged submitted cookie should not unlock records');
  const forgedReplayApi = await json('/api/team-replay', `${team001.cookie}; ary_v2_submitted_team_001=done`);
  assert(forgedReplayApi.response.status === 403, 'forged submitted cookie should not unlock replay API');

  const missingSubmit = await submitTeam(team001.cookie, '满分答案');
  assert(missingSubmit.response.status === 200, 'submission should render result page');
  assertIncludes(missingSubmit.body, '暂时无法完成评测', 'submission should show missing result before organizer starts');
  assert(missingSubmit.submitCookie === '', 'missing result should not unlock records');
  assertNoInternalLeaks(missingSubmit.body, 'missing submission page');

  organizer = createOrganizerServer(organizerPort);
  const evaluatedSubmit = await submitTeam(team001.cookie, '满分答案');
  assert(evaluatedSubmit.response.status === 200, 'evaluated submission should render result page');
  assertIncludes(evaluatedSubmit.body, '本次提交已通过评测', 'submission should show evaluated result when organizer starts');
  assert(evaluatedSubmit.submitCookie.startsWith('ary_v2_submitted_team_001='), 'evaluated submission should unlock team_001 records');
  assertNoInternalLeaks(evaluatedSubmit.body, 'evaluated submission page');

  const team001UnlockedCookie = `${team001.cookie}; ${evaluatedSubmit.submitCookie}`;
  const team001Records = await text('/team/records', team001UnlockedCookie);
  assert(team001Records.response.status === 200, 'unlocked team records should load');
  assertIncludes(team001Records.body, 'Team 001：项目讨论与需求边界', 'team_001 should see scope record after submission');
  assertIncludes(team001Records.body, 'Team 001：需求边界与 Steering 纠偏', 'team_001 should keep original record after submission');
  assertIncludes(team001Records.body, 'Team 001：资料范围与可运行验证', 'team_001 should see validation record after submission');
  assertIncludes(team001Records.body, 'Team 001：Race 体验补全', 'team_001 should see race experience record after submission');
  assertIncludes(team001Records.body, 'Team 001：驾驶舱分层与评价图形化', 'team_001 should see IA record after submission');
  assertIncludes(team001Records.body, '记录数量', 'team_001 records should show record count');
  assertIncludes(team001Records.body, '详情页查看评价关注点和过程摘要', 'team_001 records should send detail work to record pages');
  assertNotIncludes(team001Records.body, 'Learn. Build. Show. Grow.', 'team_001 records should not repeat growth path');
  assertNotIncludes(team001Records.body, '你不是一个人在 Hackathon', 'team_001 records should not repeat guidance evidence');
  assertNotIncludes(team001Records.body, '可展示的智能体开发能力档案', 'team_001 records should not repeat capability portfolio');
  assertNotIncludes(team001Records.body, '四段主线', 'team_001 records should not repeat mainline cards');
  assertNotIncludes(team001Records.body, 'Team 002：验证证据与回放组织', 'team_001 records must not show team_002 record');
  assertNoInternalLeaks(team001Records.body, 'team_001 records page');

  const team001Detail = await text('/team/records/record-team-001', team001UnlockedCookie);
  assert(team001Detail.response.status === 200, 'team_001 detail should load after submission');
  assertIncludes(team001Detail.body, '过程摘要', 'record detail should show process summary');
  assertIncludes(team001Detail.body, '先用双进程证明平台不能提前拿到结果', 'record detail should show v1 two-process experiment');
  assertIncludes(team001Detail.body, '第一版不能像普通编程题平台', 'record detail should show v1 OJ correction');
  assertIncludes(team001Detail.body, 'v2 不能丢掉 v1 的提交闭环', 'record detail should show inherited flow correction');
  assertIncludes(team001Detail.body, '评测服务不可用时不能假装完成', 'record detail should show organizer dependency event');
  assertIncludes(team001Detail.body, '允许 UI 重构，但不能把评审需要看的评价结构删掉', 'record detail should show concrete rider correction');
  assertIncludes(team001Detail.body, '评价关注点', 'record detail should show evaluation focus');
  assertNotIncludes(team001Detail.body, '这场 Race 你们要练什么？', 'record detail should not repeat self-check training section');
  assertNotIncludes(team001Detail.body, '你不是一个人在 Hackathon', 'record detail should not repeat guidance evidence section');
  assertNotIncludes(team001Detail.body, 'Review &amp; Replay', 'record detail should not repeat replay path section');
  assertNotIncludes(team001Detail.body, '可展示的智能体开发能力档案', 'record detail should not repeat capability portfolio');
  assertIncludes(team001Detail.body, '目标与边界', 'record detail should show target boundary focus');
  assertIncludes(team001Detail.body, 'Steering', 'record detail should show steering focus');
  assertIncludes(team001Detail.body, '内容范围', 'record detail should show content scope focus');
  assertNotIncludes(team001Detail.body, '建立验证目标', 'record detail must not show team_002 event');
  assertNoInternalLeaks(team001Detail.body, 'team_001 detail page');

  const team001DataProofDetail = await text('/team/records/record-team-001-data-proof', team001UnlockedCookie);
  assert(team001DataProofDetail.response.status === 200, 'team_001 data proof detail should load after submission');
  assertIncludes(team001DataProofDetail.body, 'Team 001：资料范围与可运行验证', 'data proof detail should show record title');
  assertIncludes(team001DataProofDetail.body, '完整提交内容移出公开展示', 'data proof detail should show public content fix');
  assertIncludes(team001DataProofDetail.body, '自动验收守住资料范围', 'data proof detail should show validation evidence');
  assertIncludes(team001DataProofDetail.body, 'Rider 意图', 'data proof detail should show rider intent');
  assertNoInternalLeaks(team001DataProofDetail.body, 'team_001 data proof detail page');

  const team001IaDetail = await text('/team/records/record-team-001-ia-ux', team001UnlockedCookie);
  assert(team001IaDetail.response.status === 200, 'team_001 IA detail should load after submission');
  assertIncludes(team001IaDetail.body, 'Team 001：驾驶舱分层与评价图形化', 'IA detail should show record title');
  assertIncludes(team001IaDetail.body, '页面转向任务导向', 'IA detail should show information architecture steering');
  assertIncludes(team001IaDetail.body, '驾驶舱和总览分出子页面', 'IA detail should show nested page implementation');
  assertIncludes(team001IaDetail.body, '七维评价改成雷达图', 'IA detail should show radar optimization');
  assertIncludes(team001IaDetail.body, '删除内部化说明区', 'IA detail should show self-check explanation removal');
  assertNoInternalLeaks(team001IaDetail.body, 'team_001 IA detail page');

  const team001Replay = await text('/team/replay', team001UnlockedCookie);
  const team001ReplayApi = await json('/api/team-replay', team001UnlockedCookie);
  assert(team001ReplayApi.response.status === 200, 'team replay API should open after submission');
  assert(team001ReplayApi.body.length >= 31, 'team replay API should return team_001 replay events after submission');
  assert(team001ReplayApi.body.every((event) => team001RecordIds.has(event.recordId)), 'team replay API should only return team_001 record events');
  assert(team001ReplayApi.body.every((event) => team001SessionIds.has(event.sourceSessionId)), 'team replay API should only return team_001 session events');
  assert(team001ReplayApi.body.some((event) => event.recordId === 'record-team-001-scope'), 'team replay API should include scope events');
  assert(team001ReplayApi.body.some((event) => event.recordId === 'record-team-001-data-proof'), 'team replay API should include data proof events');
  assert(team001ReplayApi.body.some((event) => event.recordId === 'record-team-001-race-experience'), 'team replay API should include race experience events');
  assert(team001ReplayApi.body.some((event) => event.recordId === 'record-team-001-ia-ux'), 'team replay API should include IA events');
  assertIncludes(team001Replay.body, '先用双进程证明平台不能提前拿到结果', 'team_001 replay should include v1 two-process experiment');
  assertIncludes(team001Replay.body, '完整题解不能进入公开展示区', 'team_001 replay should include v1 public content fix');
  assertIncludes(team001Replay.body, '第一版不能像普通编程题平台', 'team_001 replay should include v1 OJ correction');
  assertIncludes(team001Replay.body, '项目资料进入本地工作区', 'team_001 replay should include scope material event');
  assertIncludes(team001Replay.body, '完整提交内容移出公开展示', 'team_001 replay should include data proof fix event');
  assertIncludes(team001Replay.body, 'PPT 内容逐页进入现有平台', 'team_001 replay should include PPT race event');
  assertIncludes(team001Replay.body, '页面转向任务导向', 'team_001 replay should include IA steering event');
  assertIncludes(team001Replay.body, '七维评价改成雷达图', 'team_001 replay should include radar event');
  assertIncludes(team001Replay.body, '删除内部化说明区', 'team_001 replay should include self-check explanation removal event');
  assertIncludes(team001Replay.body, '第一版 Records 和 Replay 也不能提前展示', 'team_001 replay should include v1 unlock steering');
  assertIncludes(team001Replay.body, 'v2 不能丢掉 v1 的提交闭环', 'team_001 replay should include inherited flow steering');
  assertIncludes(team001Replay.body, '评测服务不可用时不能假装完成', 'team_001 replay should include evaluation dependency');
  assertIncludes(team001Replay.body, '不要把权限模型做成产品页面', 'team_001 replay should include removed explanation page');
  assertIncludes(team001Replay.body, '操作证据', 'team_001 replay should show operation evidence');
  assertIncludes(team001Replay.body, '失败到修复', 'team_001 replay should show failure-to-fix evidence');
  assertIncludes(team001Replay.body, '产物变化', 'team_001 replay should show artifact changes');
  assertIncludes(team001Replay.body, '验证：', 'team_001 replay should show validation evidence');
  assertIncludes(team001Replay.body, 'Rider 意图', 'team_001 replay should show rider intent');
  assertNotIncludes(team001Replay.body, '这场 Race 你们要练什么？', 'team_001 replay should not repeat self-check training section');
  assertNotIncludes(team001Replay.body, '你不是一个人在 Hackathon', 'team_001 replay should not repeat guidance evidence section');
  assertNotIncludes(team001Replay.body, '做完不是结束，复盘才是成长开始', 'team_001 replay should not repeat replay path cards');
  assertNotIncludes(team001Replay.body, 'Ride Agents. Build the Future.', 'team_001 replay should not repeat racing identity');
  assertNotIncludes(team001Replay.body, '赛道状态', 'team_001 replay should not repeat racing status');
  assertNotIncludes(team001Replay.body, '可展示的智能体开发能力档案', 'team_001 replay should not repeat capability portfolio');
  assertNotIncludes(team001Replay.body, '建立验证目标', 'team_001 replay must not include team_002 event');
  assertNoInternalLeaks(team001Replay.body, 'team_001 replay page');

  const team002History = await text('/team/history', team002.cookie);
  assert(team002History.response.status === 200, 'team_002 history should load');
  assertIncludes(team002History.body, '从验证证据到回放组织', 'team_002 should see own DevCompass record');
  assertNotIncludes(team002History.body, '从需求边界到页面收敛', 'team_002 history must not show team_001 session');
  assertNoInternalLeaks(team002History.body, 'team_002 history page');

  const team002HistoryApi = await json('/api/team-history', team002.cookie);
  assert(team002HistoryApi.response.status === 200, 'team_002 can fetch own history records');
  assert(team002HistoryApi.body.length === 1, 'team_002 history API should return one record');
  assert(team002HistoryApi.body[0].teamId === 'team_002', 'team_002 history API should return team_002 data');

  const team002Page = await text('/team', team002.cookie);
  assert(team002Page.response.status === 200, 'team_002 dashboard should load');
  assertIncludes(team002Page.body, 'Team 002 的驾驶舱', 'team_002 should see own cockpit');
  assertIncludes(team002Page.body, '还没有提交', 'team_002 should remain locked before own submission');
  assertNotIncludes(team002Page.body, 'Team 001：需求边界与 Steering 纠偏', 'team_002 must not see team_001 record');
  assertNoInternalLeaks(team002Page.body, 'team_002 page');

  const team002LockedReplay = await text('/team/replay', team002.cookie);
  assertIncludes(team002LockedReplay.body, '请先提交参赛内容', 'team_002 replay should remain locked before own submission');
  assertNotIncludes(team002LockedReplay.body, 'v2 不能丢掉 v1 的提交闭环', 'team_002 replay must not inherit team_001 unlock');

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
  assertIncludes(leaderboard.body, '公开内容来自 Organizer 主动披露的 4 类公开摘要', 'leaderboard should show public summary scope');
  assertIncludes(leaderboard.body, '公开展示页', 'leaderboard should act as public showcase page');
  assertIncludes(leaderboard.body, '项目作品', 'leaderboard should show project work');
  assertIncludes(leaderboard.body, '能力标签', 'leaderboard should show capability tags');
  assertIncludes(leaderboard.body, '公开评语', 'leaderboard should show public comment');
  assertNotIncludes(leaderboard.body, '2 支队伍进入 Genesis Riders 公开展示', 'leaderboard should not repeat Genesis Riders launch section');
  assertNotIncludes(leaderboard.body, '不展示队伍完整过程记录', 'leaderboard should keep scope wording concise');
  assertNotIncludes(leaderboard.body, '原始赛事资料不进入公开榜单', 'leaderboard should not repeat disclosure cards');
  assertNotIncludes(leaderboard.body, 'Learn. Build. Show. Grow.', 'leaderboard should not repeat public growth path');
  assertNotIncludes(leaderboard.body, '下一次 Race 的训练方向', 'leaderboard should not repeat growth copy');
  assertNotIncludes(leaderboard.body, 'Ride Agents. Build the Future.', 'leaderboard should not repeat racing identity');
  assertNotIncludes(leaderboard.body, '赛道状态', 'leaderboard should not repeat racing status');
  assertNotIncludes(leaderboard.body, '可展示的智能体开发能力档案', 'leaderboard should not repeat capability portfolio');
  assertNotIncludes(leaderboard.body, '企业实习机会匹配只作为后续方向', 'leaderboard should not show portfolio recommendation copy');
  assertNotIncludes(leaderboard.body, '过程记录数量只在队伍解锁后查看', 'leaderboard should not show detailed process count copy');
  assertNotIncludes(leaderboard.body, '17 个过程证据', 'leaderboard must not expose full replay event count');
  assertNotIncludes(leaderboard.body, '未公开过程材料', 'leaderboard must not expose retained process material label');
  assertNotIncludes(leaderboard.body, '未公开评价材料', 'leaderboard must not expose retained evaluation material label');
  assertNotIncludes(leaderboard.body, '未公开项目材料', 'leaderboard must not expose retained project material label');
  assertNotIncludes(leaderboard.body, '队伍提交原始内容', 'leaderboard must not expose retained submission material label');
  assertNotIncludes(leaderboard.body, '组织方内部记录', 'leaderboard must not expose organizer internal record label');
  assertNotIncludes(leaderboard.body, '这场 Race 你们要练什么？', 'leaderboard must not show private training detail');
  assertNotIncludes(leaderboard.body, '目标设定', 'leaderboard must not show private training goal detail');
  assertNotIncludes(leaderboard.body, '方向干预', 'leaderboard must not show private training intervention detail');
  assertNotIncludes(leaderboard.body, 'Race Deliverables', 'leaderboard must not show internal deliverables checklist');
  assertNotIncludes(leaderboard.body, '你们需要交付什么？', 'leaderboard must not show team deliverables checklist');
  assertNotIncludes(leaderboard.body, '技术验证', 'leaderboard must not show deliverable technical validation detail');
  assertNotIncludes(leaderboard.body, '系统设计', 'leaderboard must not show deliverable system design detail');
  assertNotIncludes(leaderboard.body, '优秀作品评价', 'leaderboard must not show internal excellent work rubric');
  assertNotIncludes(leaderboard.body, '我们如何看待优秀作品？', 'leaderboard must not show internal evaluation rubric');
  assertNotIncludes(leaderboard.body, '关键假设验证', 'leaderboard must not show internal hypothesis validation detail');
  assertNotIncludes(leaderboard.body, '架构边界', 'leaderboard must not show internal architecture boundary rubric');
  assertNotIncludes(leaderboard.body, 'Ready to Ride?', 'leaderboard must not show internal race action entry');
  assertNotIncludes(leaderboard.body, '完成骑行闭环', 'leaderboard must not show internal ready-to-ride flow');
  assertNotIncludes(leaderboard.body, '提交原文', 'leaderboard must not expose submission body');
  assertNoInternalLeaks(leaderboard.body, 'leaderboard page');

  assertNotIncludes(leaderboard.body, '访问说明', 'navigation must not include access explanation page');

  const removedAccessPage = await text('/security-evidence', team001.cookie);
  assert(removedAccessPage.response.status === 404, 'access explanation page should not exist as product page');

  const anonymousApi = await json('/api/my-submissions');
  assert(anonymousApi.response.status === 401, 'anonymous API access should be rejected');

  console.log('VERIFY_PASS ARY PoC_v2 role boundary holds');
} finally {
  await writeJson(evaluatorServicePath, originalEvaluatorService);
  if (organizer) await closeServer(organizer);
  await closeServer(app);
}
