import { createAryServer } from './ary-server.js';
import { createOrganizerServer } from './organizer-server.js';

const aryPort = 4200;
const organizerPort = 4201;
const ary = createAryServer(aryPort, organizerPort);
let organizer;

async function request(path, options) {
  return fetch(`http://127.0.0.1:${aryPort}${path}`, options);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNotIncludes(text, value, message) {
  assert(!text.includes(value), message);
}

function assertPublicProjectionOnly(value) {
  const text = JSON.stringify(value);
  assertNotIncludes(text, 'privateDefinition', 'public data must not contain privateDefinition');
  assertNotIncludes(text, 'privateReviewFocus', 'public data must not contain privateReviewFocus');
  assertNotIncludes(text, 'fullChallengeBrief', 'public data must not contain fullChallengeBrief');
}

function assertUserFacingPage(text, pageName) {
  const forbidden = [
    'Organizer',
    '公开投影',
    '公开存储',
    '公开保存',
    '私有筛选标准',
    '完整 Race',
    '完整 session',
    '完整协作原文',
    '内部服务',
    '服务请求',
    '文件信息',
    '版本指纹',
    '数据处理器',
    '终端',
    '在线',
    '关闭',
    'Record ID',
    'dataVersionHash',
    'record-session-01-public',
    'record-session-02-public',
    'coding-agent-sessions',
    'privateDefinition',
    'privateReviewFocus',
    'fullChallengeBrief',
    'private_race.json',
    'agent_session_sources.json',
    'private_review_notes.json'
  ];
  for (const value of forbidden) assertNotIncludes(text, value, `${pageName} must not expose ${value}`);
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

async function submitAnswer(answer) {
  const response = await request('/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ answer })
  });
  return response.json();
}

async function requestWithCookie(path, cookie) {
  return request(path, { headers: { cookie } });
}

try {
  const initialEvidence = await request('/evidence');
  const initialEvidenceText = await initialEvidence.text();
  assert(initialEvidence.ok, 'evidence page should load before submission');
  assert(initialEvidenceText.includes('还没有评测结果'), 'evidence page should not show result before submission');
  assert(initialEvidenceText.includes('提交一个答案触发评测'), 'evidence page should include submission form');
  assertNotIncludes(initialEvidenceText, '这个小组的解答测评结果为:满分!', 'page must not show result before submission');
  assertUserFacingPage(initialEvidenceText, 'initial submission page');

  const home = await request('/');
  const homeText = await home.text();
  assert(home.ok, 'home page should load');
  assert(homeText.includes('Riding Record'), 'home page should show Riding Record');
  assert(homeText.includes('当前赛事'), 'home page should show race overview');
  assertUserFacingPage(homeText, 'home page');

  let submissionResult = await submitAnswer('满分答案');
  assert(submissionResult.status === 'missing', 'submission should be missing before Organizer process starts');
  assert(submissionResult.answer === '满分答案', 'submission should carry participant answer');
  assert(submissionResult.proof.includes('未在线'), 'missing submission should explain Organizer absence');

  organizer = createOrganizerServer(organizerPort);
  submissionResult = await submitAnswer('满分答案');
  assert(submissionResult.status === 'available', 'submission should be evaluated after Organizer process starts');
  assert(submissionResult.answer === '满分答案', 'available result should carry participant answer');
  assert(submissionResult.resultText === '这个小组的解答测评结果为:满分!', 'Organizer should return mock evaluation result');

  await closeServer(organizer);
  organizer = null;
  submissionResult = await submitAnswer('满分答案');
  assert(submissionResult.status === 'missing', 'submission should be missing again after Organizer process stops');

  const formSubmission = await request('/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ answer: '满分答案' })
  });
  const formSubmissionText = await formSubmission.text();
  assert(formSubmission.ok, 'form submission should render page');
  assert(formSubmissionText.includes('数据缺失'), 'form submission should show missing state when Organizer is stopped');
  assert(formSubmissionText.includes('满分答案'), 'form submission should show submitted answer');
  assertUserFacingPage(formSubmissionText, 'form submission page');

  const submissionCookie = formSubmission.headers.get('set-cookie')?.split(';')[0] || '';
  assert(submissionCookie === 'ary_submission=done', 'form submission should unlock record pages');

  const lockedRecords = await request('/records');
  const lockedRecordsText = await lockedRecords.text();
  assert(lockedRecords.ok, 'locked records page should load');
  assert(lockedRecordsText.includes('请先提交答案'), 'records page should be locked before submission');
  assertNotIncludes(lockedRecordsText, 'Session 01：从概念澄清到 GRS 001 收敛', 'locked records page must not show records before submission');
  assertUserFacingPage(lockedRecordsText, 'locked records page');

  const lockedDetail = await request('/records/record-session-02');
  const lockedDetailText = await lockedDetail.text();
  assert(lockedDetail.ok, 'locked detail page should load');
  assert(lockedDetailText.includes('请先提交答案'), 'detail page should be locked before submission');
  assertNotIncludes(lockedDetailText, 'Prompt 摘要展示', 'locked detail page must not show detail before submission');
  assertUserFacingPage(lockedDetailText, 'locked detail page');

  const lockedReplay = await request('/replay/record-session-02');
  const lockedReplayText = await lockedReplay.text();
  assert(lockedReplay.ok, 'locked replay page should load');
  assert(lockedReplayText.includes('请先提交答案'), 'replay page should be locked before submission');
  assertNotIncludes(lockedReplayText, 'Race 目标下达', 'locked replay page must not show replay before submission');
  assertUserFacingPage(lockedReplayText, 'locked replay page');

  const records = await requestWithCookie('/records', submissionCookie);
  const recordsText = await records.text();
  assert(records.ok, 'records page should load');
  assert(recordsText.includes('Session 01：从概念澄清到 GRS 001 收敛'), 'records page should include session 01 title');
  assert(recordsText.includes('Session 02：自主推进数据安全 PoC'), 'records page should include session 02 title');
  assert(recordsText.includes('Claude Code'), 'records page should include agent name');
  assert(recordsText.includes('Riding Record'), 'records page should include readable record label');
  assertUserFacingPage(recordsText, 'records page');

  const detail = await requestWithCookie('/records/record-session-02', submissionCookie);
  const detailText = await detail.text();
  assert(detail.ok, 'record detail page should load');
  assert(detailText.includes('Prompt'), 'detail page should include Prompt');
  assert(detailText.includes('Agent Output'), 'detail page should include Agent Output');
  assert(detailText.includes('Steering'), 'detail page should include Steering');
  assert(detailText.includes('自主推进'), 'detail page should include autonomous progress');
  assert(detailText.includes('数据安全'), 'detail page should include data security');
  assertUserFacingPage(detailText, 'detail page');

  const replay = await requestWithCookie('/replay/record-session-02', submissionCookie);
  const replayText = await replay.text();
  assert(replay.ok, 'replay page should load');
  assert(replayText.includes('Race 目标下达'), 'replay page should include race goal event');
  assert(replayText.includes('Agent 拆解任务'), 'replay page should include agent planning event');
  assert(replayText.includes('用户 Steering'), 'replay page should include user steering event');
  assertUserFacingPage(replayText, 'replay page');

  const evidence = await request('/api/evidence');
  const proof = await evidence.json();
  assert(proof.organizerExperiment === null, 'evidence API should not run evaluation without submission');
  assert(proof.organizerFiles.includes('private_race.json'), 'Organizer should own private_race.json');
  assert(proof.organizerFiles.includes('agent_session_sources.json'), 'Organizer should own agent_session_sources.json');
  assert(proof.organizerFiles.includes('private_review_notes.json'), 'Organizer should own private_review_notes.json');
  assert(proof.aryFiles.includes('riding_records.json'), 'ARY should store riding_records.json');
  assert(proof.aryFiles.includes('riding_record_steps.json'), 'ARY should store riding_record_steps.json');
  assert(proof.aryFiles.includes('record_replay_events.json'), 'ARY should store record_replay_events.json');
  assert(!proof.aryFiles.includes('agent_session_sources.json'), 'ARY store must not contain agent_session_sources.json');
  assert(!proof.aryFiles.includes('private_review_notes.json'), 'ARY store must not contain private_review_notes.json');
  assert(proof.dataBoundary.organizerRetainsFullSources === true, 'Organizer should retain full sources');
  assert(proof.dataBoundary.aryStoresProjectionOnly === true, 'ARY should store projection only');
  assert(proof.dataBoundary.aryDoesNotStoreFullPrivateRace === true, 'ARY should not store full private race');
  assertPublicProjectionOnly(proof.publicRecords);
  assertPublicProjectionOnly(proof.publicSteps);
  assertPublicProjectionOnly(proof.replayEvents);

  assertNotIncludes(initialEvidenceText, '/media/lemonhdl/Shared/Software_Engineering/ARY/coding-agent-sessions/session-01-claude-code.md', 'evidence page must not expose full session 01 path');
  assertNotIncludes(initialEvidenceText, '/media/lemonhdl/Shared/Software_Engineering/ARY/coding-agent-sessions/session-02-claude-code.md', 'evidence page must not expose full session 02 path');
  assertNotIncludes(initialEvidenceText, 'privateReviewFocus', 'evidence page must not expose private review notes body');
  assertNotIncludes(initialEvidenceText, '提交题解', 'new PoC should not present as coding challenge submission');
  assertNotIncludes(initialEvidenceText, '排行榜', 'new PoC should not present as leaderboard site');

  console.log('VERIFY_PASS ARY PoC participant submission experiment holds');
} finally {
  await closeServer(organizer);
  await closeServer(ary);
}
