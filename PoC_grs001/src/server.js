import { createServer } from 'node:http';
import { join } from 'node:path';
import { jsonResponse, organizerDir, protectedStoreDir, publicStoreDir, readBody, readJson, writeJson } from './storage.js';

const credentials = [
  { username: 'Organizer_001', password: '********', role: 'organizer', displayName: 'Organizer 001' },
  { username: 'team_001', password: '******', role: 'team', teamId: 'team_001', displayName: 'Team 001' },
  { username: 'team_002', password: '**********', role: 'team', teamId: 'team_002', displayName: 'Team 002' }
];

const disclosuresPath = join(publicStoreDir, 'public_disclosures.json');
const teamsPath = join(publicStoreDir, 'teams.json');
const leaderboardPath = join(publicStoreDir, 'leaderboard_projection.json');
const submissionsPath = join(protectedStoreDir, 'submissions.json');
const recordsPath = join(protectedStoreDir, 'riding_records.json');
const eventsPath = join(protectedStoreDir, 'replay_events.json');
const sessionsPath = join(protectedStoreDir, 'rider_sessions.json');
const raceSourcePath = join(organizerDir, 'race_source.json');
const evaluatorServicePath = join(organizerDir, 'evaluator_service.json');

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function encodeSession(user) {
  return Buffer.from(JSON.stringify({ username: user.username, role: user.role, teamId: user.teamId || null }), 'utf8').toString('base64url');
}

function decodeSession(cookieHeader) {
  const cookie = String(cookieHeader || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('ary_grs001_session='));
  if (!cookie) return null;
  try {
    const raw = Buffer.from(cookie.slice('ary_grs001_session='.length), 'base64url').toString('utf8');
    const value = JSON.parse(raw);
    const user = credentials.find((item) => item.username === value.username && item.role === value.role && (item.teamId || null) === (value.teamId || null));
    if (!user) return null;
    return { username: user.username, role: user.role, teamId: user.teamId, displayName: user.displayName };
  } catch {
    return null;
  }
}

function encodeTeamSubmission(teamId) {
  return Buffer.from(JSON.stringify({ teamId, status: 'done' }), 'utf8').toString('base64url');
}

function submissionCookieName(teamId) {
  return `ary_grs001_submitted_${teamId}`;
}

function hasTeamSubmission(req, session) {
  if (!isTeam(session)) return false;
  const cookie = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${submissionCookieName(session.teamId)}=`));
  if (!cookie) return false;
  try {
    const raw = Buffer.from(cookie.split('=').slice(1).join('='), 'base64url').toString('utf8');
    const value = JSON.parse(raw);
    return value.teamId === session.teamId && value.status === 'done';
  } catch {
    return false;
  }
}

function isOrganizer(session) {
  return session?.role === 'organizer';
}

function isTeam(session) {
  return session?.role === 'team' && session.teamId;
}

function teamOnly(items, session) {
  return items.filter((item) => item.teamId === session.teamId);
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { location, ...headers });
  res.end();
}

function requireLogin(res, session) {
  if (session) return false;
  redirect(res, '/login');
  return true;
}

function requireOrganizer(res, session) {
  if (isOrganizer(session)) return false;
  res.writeHead(403, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page('无权限', '', session, `<section class="notice danger"><strong>无权限</strong><p>当前身份不能进入此页面。</p></section>`));
  return true;
}

function requireTeam(res, session) {
  if (isTeam(session)) return false;
  res.writeHead(403, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page('无权限', '', session, `<section class="notice danger"><strong>无权限</strong><p>当前身份不能提交队伍内容。</p></section>`));
  return true;
}

function navFor(active, session) {
  const publicItems = [['/yard', 'Race'], ['/leaderboard', '榜单']];
  const roleItems = isOrganizer(session)
    ? [['/organizer', 'Organizer'], ['/organizer/race', '源数据']]
    : isTeam(session)
      ? [['/team', '工作台'], ['/team/submit', '提交'], ['/team/records', '过程证据']]
      : [];
  const items = [...publicItems, ...roleItems];
  return `<nav class="nav">${items.map(([href, label]) => `<a class="${active === href ? 'active' : ''}" href="${href}">${escapeHtml(label)}</a>`).join('')}</nav>`;
}

function page(title, active, session, content) {
  const nav = active === '/login' ? '' : navFor(active, session);
  const identity = session ? `<div class="identity"><span>${escapeHtml(session.displayName)}</span><a href="/logout">退出</a></div>` : active === '/login' ? '' : `<div class="identity"><a href="/login">登录</a></div>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{--ink:#172033;--muted:#667085;--line:#d9dee8;--bg:#f4f6fb;--panel:#fff;--accent:#1f49d8;--dark:#121826;--green:#15734f;--green-bg:#e7f5ee;--amber:#9a6500;--amber-bg:#fff5d8;--red:#b42318;--red-bg:#fff1f0;--purple:#5b3fb5;--purple-bg:#f0ecff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{min-height:100vh}.topbar{position:sticky;top:0;z-index:2;background:#101828;color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}.topbar-inner{max-width:1180px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{display:flex;align-items:center;gap:10px}.mark{width:32px;height:32px;border-radius:8px;background:#e11d48;box-shadow:inset 0 -10px 0 rgba(0,0,0,.18)}.brand strong{display:block;font-size:15px}.brand span{display:block;color:#cbd5e1;font-size:12px}.nav{display:flex;gap:4px;flex-wrap:wrap}.nav a,.identity a,.identity span{border-radius:8px;padding:8px 10px;text-decoration:none;font-weight:800}.nav a{color:#cbd5e1}.nav a.active,.nav a:hover{background:#fff;color:#101828}.identity{display:flex;align-items:center;gap:8px}.identity span,.identity a{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.18)}.workspace{max-width:1180px;margin:0 auto;padding:26px 22px}.hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr);gap:14px;margin-bottom:14px}.panel,.card,.notice{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}.panel{box-shadow:0 18px 40px rgba(16,24,40,.07)}.panel h1{font-size:34px;line-height:1.08;margin:8px 0}.panel p,.card p,.notice p{color:var(--muted);line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.stack{display:grid;gap:12px}.eyebrow{letter-spacing:.08em;text-transform:uppercase;font-size:11px;font-weight:900;color:#667085}.pill{display:inline-flex;border-radius:7px;padding:4px 8px;font-size:12px;font-weight:900;background:#eef2ff;color:#243b83}.pill.green{background:var(--green-bg);color:var(--green)}.pill.amber{background:var(--amber-bg);color:var(--amber)}.pill.red{background:var(--red-bg);color:var(--red)}.pill.purple{background:var(--purple-bg);color:var(--purple)}.button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent);border-radius:9px;padding:10px 13px;background:var(--accent);color:#fff;font-weight:900;text-decoration:none;cursor:pointer}.button.secondary{background:#fff;color:#1d2939;border-color:var(--line)}.cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.metric-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}.metric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}.metric strong{display:block;font-size:24px;margin:6px 0 2px}.action-list{display:grid;gap:10px}.action-item{display:flex;justify-content:space-between;gap:16px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px;text-decoration:none;color:var(--ink)}.action-item:hover{box-shadow:0 10px 24px rgba(16,24,40,.06)}.action-item strong{display:block;margin-bottom:4px}.action-item em{display:block;color:var(--muted);font-style:normal;line-height:1.45}.arrow{font-size:22px;font-weight:900;color:#98a2b3}.notice.ok{background:var(--green-bg);border-color:#b7ebd0}.notice.warn{background:var(--amber-bg);border-color:#f6dfa0}.notice.danger{background:var(--red-bg);border-color:#ffd0d0}form{display:grid;gap:12px}label{display:grid;gap:6px;font-weight:800;color:#344054}input,textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:11px;font:inherit;background:#fff}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}th,td{padding:11px 12px;border-bottom:1px solid #edf0f5;text-align:left;vertical-align:top}th{background:#f8fafc;color:#344054;font-size:12px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}.timeline{display:grid;gap:10px}.event{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px}.event-no{width:34px;height:34px;border-radius:50%;background:#101828;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}details{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}summary{cursor:pointer;list-style:none;padding:14px 16px;font-weight:900}summary::-webkit-details-marker{display:none}.details-body{border-top:1px solid var(--line);padding:14px 16px;background:#fbfcff}.muted{color:var(--muted)}@media(max-width:820px){.topbar-inner{align-items:flex-start;flex-direction:column}.hero{grid-template-columns:1fr}.event{grid-template-columns:1fr}}
</style>
</head>
<body><main class="shell"><header class="topbar"><div class="topbar-inner"><div class="brand"><div class="mark"></div><div><strong>ARY GRS 001</strong><span>Public Yard / Private Race Source</span></div></div>${nav}${identity}</div></header><section class="workspace">${content}</section></main></body></html>`;
}

function listItems(items = []) {
  if (!items.length) return '<p class="muted">暂无。</p>';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function metricStrip(items) {
  return `<section class="metric-strip">${items.map((item) => `<div class="metric"><span class="pill ${item.tone || ''}">${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><p class="muted">${escapeHtml(item.caption)}</p></div>`).join('')}</section>`;
}

function actionList(items) {
  return `<div class="action-list">${items.map((item) => `<a class="action-item" href="${escapeHtml(item.href)}"><div><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.body)}</em></div><div class="arrow">›</div></a>`).join('')}</div>`;
}

function disclosure(title, summary, content, open = false) {
  return `<details${open ? ' open' : ''}><summary>${escapeHtml(title)}<div class="muted" style="font-weight:650;margin-top:4px">${escapeHtml(summary)}</div></summary><div class="details-body">${content}</div></details>`;
}

async function readDisclosures() {
  return readJson(disclosuresPath);
}

async function primaryDisclosure() {
  return (await readDisclosures())[0];
}

async function readRaceSources() {
  return readJson(raceSourcePath);
}

async function readEvaluatorService() {
  return readJson(evaluatorServicePath);
}

async function writeEvaluatorService(enabled) {
  const current = await readEvaluatorService();
  await writeJson(evaluatorServicePath, { ...current, enabled });
}

async function requestOrganizerEvaluation(organizerPort, session, answer, ridingRecord) {
  const service = await readEvaluatorService();
  if (!service.enabled) {
    return {
      status: 'missing',
      teamId: session.teamId,
      resultText: '数据缺失，暂无法评分。',
      score: null,
      resultSummary: '等待 Organizer 数据恢复后再评分。'
    };
  }
  try {
    const response = await fetch(`http://127.0.0.1:${organizerPort}/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId: session.teamId, answer, ridingRecord })
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
  } catch {
    return {
      status: 'missing',
      teamId: session.teamId,
      resultText: '数据缺失，暂无法评分。',
      score: null,
      resultSummary: '等待 Organizer 数据恢复后再评分。'
    };
  }
}

function renderLogin(error = '') {
  return page('登录', '/login', null, `<section class="hero"><div class="panel"><div class="eyebrow">Sign in</div><h1>登录 ARY</h1><p>请输入账号和密码。</p></div><aside class="card"><span class="pill amber">GRS 001</span><h2>Product Definition Race</h2><p>进入后查看本轮 Race。</p></aside></section><form class="card" method="post" action="/login">${error ? `<div class="notice danger"><strong>登录失败</strong><p>${escapeHtml(error)}</p></div>` : ''}<label>账号<input name="username" autocomplete="off" placeholder="请输入账号"></label><label>密码<input name="password" type="password" autocomplete="off" placeholder="请输入密码"></label><button class="button" type="submit">进入</button></form>`);
}

async function renderYard(session) {
  const disclosures = await readDisclosures();
  return page('Race', '/yard', session, `<section class="hero"><div class="panel"><div class="eyebrow">Public Yard</div><h1>看见可以参加的 Race</h1><p>这里展示 Organizer 主动披露的公开摘要、参与入口和当前状态。</p>${metricStrip([{ label: 'Visible Races', value: disclosures.length, caption: '当前公开 Race', tone: 'green' }, { label: 'Source', value: 'Organizer', caption: '评测依赖 Organizer 数据', tone: 'purple' }, { label: 'Status', value: disclosures[0]?.status === 'open' ? '开放' : '暂停', caption: disclosures[0]?.reviewStateLabel || '等待更新', tone: disclosures[0]?.status === 'open' ? 'green' : 'amber' }])}</div><aside class="card"><span class="pill purple">GRS 001</span><h2>本轮要证明什么</h2><p>ARY 可以展示公开摘要和组织入口，但评分必须依赖 Organizer 数据。</p></aside></section><section class="grid">${disclosures.map((race) => `<article class="card"><span class="pill ${race.status === 'open' ? 'green' : 'amber'}">${escapeHtml(race.status === 'open' ? '开放' : '暂停')}</span><h2>${escapeHtml(race.title)}</h2><p>${escapeHtml(race.publicGoal)}</p><p class="muted">${escapeHtml(race.sourceStateLabel)} · ${escapeHtml(race.disclosedAt)}</p><div class="cta-row"><a class="button" href="/race/${escapeHtml(race.raceId)}">查看 Race</a>${isTeam(session) ? `<a class="button secondary" href="/team/submit">提交</a>` : ''}</div></article>`).join('')}</section>`);
}

async function renderRaceDetail(session, raceId) {
  const race = (await readDisclosures()).find((item) => item.raceId === raceId);
  if (!race) return page('未找到', '/yard', session, '<section class="notice danger"><strong>未找到 Race</strong></section>');
  return page(race.title, '/yard', session, `<section class="hero"><div class="panel"><div class="eyebrow">Public Disclosure</div><h1>${escapeHtml(race.title)}</h1><p>${escapeHtml(race.publicSummary)}</p>${metricStrip([{ label: '披露版本', value: race.disclosureVersion, caption: race.disclosedAt, tone: 'purple' }, { label: '入口', value: race.status === 'open' ? '开放' : '暂停', caption: race.entryLabel, tone: race.status === 'open' ? 'green' : 'amber' }, { label: '评测', value: '依赖 Organizer', caption: race.reviewStateLabel, tone: 'amber' }])}<div class="cta-row">${isTeam(session) ? '<a class="button" href="/team/submit">提交方案</a>' : '<a class="button" href="/login">登录后参与</a>'}<a class="button secondary" href="/leaderboard">查看公开结果</a></div></div><aside class="card"><span class="pill green">公开摘要</span><h2>本页可见内容</h2><p>这里展示公开目标、公开要求和参与状态。</p></aside></section><section class="card"><h2>提交要求</h2>${listItems(race.publicRequirements)}</section>`);
}

async function renderOrganizerConsole(session) {
  const sources = await readRaceSources();
  const service = await readEvaluatorService();
  return page('Organizer', '/organizer', session, `<section class="hero"><div class="panel"><div class="eyebrow">Organizer Console</div><h1>Race 源数据由 Organizer 持有</h1><p>这里查看源数据状态、公开披露版本和评测可用性。</p>${metricStrip([{ label: 'Race Source', value: sources.length, caption: 'Organizer 持有', tone: 'purple' }, { label: 'Disclosure', value: sources[0]?.disclosureVersion || '-', caption: sources[0]?.disclosureStatus === 'published' ? '已披露' : '未披露', tone: 'green' }, { label: 'Evaluation', value: service.enabled ? '可用' : '不可用', caption: service.enabled ? '可以评分' : '数据缺失，暂无法评分', tone: service.enabled ? 'green' : 'red' }])}</div><aside class="card"><span class="pill amber">数据可用性实验</span><h2>切换评测状态</h2><form method="post" action="/organizer/evaluator"><label><input type="checkbox" name="enabled" ${service.enabled ? 'checked' : ''}> 允许评测</label><button class="button" type="submit">更新状态</button></form></aside></section><section class="grid">${sources.map((source) => `<article class="card"><span class="pill purple">${escapeHtml(source.sourceStatus === 'available' ? '源数据可用' : '源数据不可用')}</span><h2>${escapeHtml(source.title)}</h2><p>${escapeHtml(source.privateBrief)}</p><p class="muted">公开披露：${escapeHtml(source.publicFields.join('、'))}</p><div class="cta-row"><a class="button secondary" href="/organizer/race">查看披露控制</a></div></article>`).join('')}</section>`);
}

async function renderOrganizerRace(session) {
  const sources = await readRaceSources();
  return page('源数据', '/organizer/race', session, `<section class="panel"><div class="eyebrow">Private Race Source</div><h1>选择哪些内容公开</h1><p>完整 Race 材料留在 Organizer 侧，ARY 页面只展示公开摘要和参与状态。</p></section><section class="stack" style="margin-top:14px">${sources.map((source) => `<article class="card"><span class="pill purple">${escapeHtml(source.title)}</span><h2>已公开字段</h2>${listItems(source.publicFields)}${disclosure('Organizer 侧保留内容', '这些内容不进入 Rider 或公开页面。', listItems(source.privateMaterials), false)}</article>`).join('')}</section>`);
}

async function renderTeamDashboard(req, session) {
  const race = await primaryDisclosure();
  const submitted = hasTeamSubmission(req, session);
  return page('工作台', '/team', session, `<section class="hero"><div class="panel"><div class="eyebrow">Rider Workspace</div><h1>完成本轮 Race 提交</h1><p>${escapeHtml(race.publicGoal)}</p>${metricStrip([{ label: 'Race', value: race.status === 'open' ? '开放' : '暂停', caption: race.title, tone: 'green' }, { label: 'Submit', value: submitted ? '已提交' : '待提交', caption: submitted ? '可以查看过程证据' : '先提交方案与回放记录', tone: submitted ? 'green' : 'amber' }, { label: 'Review', value: '依赖 Organizer', caption: race.reviewStateLabel, tone: 'purple' }])}</div><aside class="card"><span class="pill amber">下一步</span><h2>${submitted ? '查看过程证据' : '提交方案'}</h2>${actionList([{ title: submitted ? '进入过程证据' : '提交本队内容', body: submitted ? '查看整理后的 Riding Record。' : '提交方案摘要和整理后的回放记录。', href: submitted ? '/team/records' : '/team/submit' }, { title: '查看 Race', body: '确认公开目标和提交要求。', href: `/race/${race.raceId}` }])}</aside></section>`);
}

async function renderSubmit(req, session, result = null) {
  const race = await primaryDisclosure();
  const submitted = hasTeamSubmission(req, session);
  const resultPanel = result ? `<section class="notice ${result.status === 'available' ? 'ok' : 'warn'}"><strong>${escapeHtml(result.resultText)}</strong><p>${escapeHtml(result.resultSummary || '')}</p></section>` : submitted ? '<section class="notice ok"><strong>已提交</strong><p>可以查看本队整理后的过程证据。</p></section>' : '';
  return page('提交', '/team/submit', session, `<section class="hero"><div class="panel"><div class="eyebrow">Submission</div><h1>提交方案摘要和回放记录</h1><p>提交后，评分是否完成取决于 Organizer 数据是否可用。</p>${metricStrip([{ label: 'Race', value: race.title, caption: race.disclosedAt, tone: 'purple' }, { label: 'Review', value: 'Organizer', caption: '评测依赖外部数据状态', tone: 'amber' }])}</div><aside class="card"><span class="pill green">Riding Record</span><h2>提交什么</h2><p>提交目标、关键决策、Agent 行动、Rider 干预和验证摘要。</p></aside></section>${resultPanel}<form class="card" method="post" action="/team/submit"><label>方案摘要<textarea name="answer" rows="5" placeholder="说明你的产品定义、系统方案和关键验证。">满分答案：Race 数据留在 Organizer 侧，ARY 通过公开披露完成发现、参与和展示。</textarea></label><label>回放记录摘要<textarea name="ridingRecord" rows="5" placeholder="说明计划、Agent 行动、Rider 干预、验证和复盘。">Riding Plan：先证明数据主权；Agent Action：搭建公开披露与提交状态；Rider Steering：删除内部说明；Validation：检查数据缺失时不能评分；Review：整理作业提交版本。</textarea></label><button class="button" type="submit">提交</button></form>`);
}

async function renderRecords(req, session) {
  if (!hasTeamSubmission(req, session)) {
    return page('过程证据', '/team/records', session, `<section class="notice warn"><strong>尚未提交</strong><p>提交方案和回放记录后，再查看本队过程证据。</p><div class="cta-row"><a class="button" href="/team/submit">去提交</a></div></section>`);
  }
  const records = teamOnly(await readJson(recordsPath), session);
  const events = await readJson(eventsPath);
  return page('过程证据', '/team/records', session, `<section class="panel"><div class="eyebrow">Riding Evidence</div><h1>本队整理后的回放记录</h1><p>这里展示计划、Agent 行动、Rider 干预、验证和复盘摘要。</p></section><section class="stack" style="margin-top:14px">${records.map((record) => `<article class="card"><span class="pill green">${escapeHtml(record.title)}</span><h2>${escapeHtml(record.summary)}</h2><p class="muted">维度：${escapeHtml(record.dimensions.join('、'))}</p><p class="muted">本地素材保留：${record.sourceRetainedLocally ? '是' : '否'}；提交内容：整理后的回放记录。</p>${renderRecordEvents(events.filter((event) => event.recordId === record.recordId))}</article>`).join('')}</section>`);
}

function renderRecordEvents(events) {
  return `<div class="timeline" style="margin-top:12px">${events.map((event) => `<article class="event"><div class="event-no">${escapeHtml(event.eventNo)}</div><div class="card"><span class="pill ${event.type === 'validation' ? 'green' : event.type === 'steering' ? 'amber' : event.type === 'agent-action' ? 'purple' : ''}">${escapeHtml(event.phase)}</span><h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(event.content)}</p><p class="muted">产物变化：${escapeHtml(event.artifactChange || '')}</p><p class="muted">验证：${escapeHtml(event.validation || '')}</p><p class="muted">Rider 意图：${escapeHtml(event.riderIntent || '')}</p></div></article>`).join('')}</div>`;
}

async function renderLeaderboard(session) {
  const leaderboard = await readJson(leaderboardPath);
  const teams = await readJson(teamsPath);
  const byTeam = new Map(teams.map((team) => [team.teamId, team]));
  return page('榜单', '/leaderboard', session, `<section class="panel"><div class="eyebrow">Public Results</div><h1>公开结果</h1><p>这里只展示公开排名、等级和评语。</p></section><section class="card" style="margin-top:14px"><table><thead><tr><th>排名</th><th>队伍</th><th>等级</th><th>公开评语</th></tr></thead><tbody>${leaderboard.map((row) => `<tr><td>${escapeHtml(row.rank)}</td><td>${escapeHtml(byTeam.get(row.teamId)?.teamName || row.teamId)}</td><td>${escapeHtml(row.scoreBand)}</td><td>${escapeHtml(row.publicComment)}</td></tr>`).join('')}</tbody></table></section>`);
}

async function apiTeamHistory(req, res, session) {
  if (!session) return jsonResponse(res, 401, { error: '未登录' });
  if (!isTeam(session)) return jsonResponse(res, 403, { error: '无权限' });
  return jsonResponse(res, 200, teamOnly(await readJson(sessionsPath), session));
}

async function apiTeamRecord(req, res, session, recordId) {
  if (!session) return jsonResponse(res, 401, { error: '未登录' });
  if (!isTeam(session)) return jsonResponse(res, 403, { error: '无权限' });
  const record = (await readJson(recordsPath)).find((item) => item.recordId === recordId && item.teamId === session.teamId);
  if (!record) return jsonResponse(res, 404, { error: '未找到' });
  return jsonResponse(res, 200, record);
}

export function createServerApp(port = 4400, organizerPort = 4401) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const session = decodeSession(req.headers.cookie);

      if (req.method === 'GET' && url.pathname === '/') return redirect(res, '/yard');
      if (req.method === 'GET' && url.pathname === '/login') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderLogin());
      }
      if (req.method === 'POST' && url.pathname === '/login') {
        const body = await readBody(req);
        const user = credentials.find((item) => item.username === body.username && item.password === body.password);
        if (!user) {
          res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' });
          return res.end(renderLogin('账号或密码不正确。'));
        }
        return redirect(res, user.role === 'organizer' ? '/organizer' : '/team', { 'set-cookie': `ary_grs001_session=${encodeSession(user)}; Path=/; HttpOnly; SameSite=Lax` });
      }
      if (req.method === 'GET' && url.pathname === '/logout') {
        return redirect(res, '/login', { 'set-cookie': 'ary_grs001_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' });
      }

      if (req.method === 'GET' && url.pathname === '/yard') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderYard(session));
      }
      if (req.method === 'GET' && url.pathname.startsWith('/race/')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderRaceDetail(session, url.pathname.split('/').at(-1)));
      }
      if (req.method === 'GET' && url.pathname === '/leaderboard') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderLeaderboard(session));
      }

      if (req.method === 'GET' && url.pathname === '/organizer') {
        if (requireLogin(res, session) || requireOrganizer(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderOrganizerConsole(session));
      }
      if (req.method === 'GET' && url.pathname === '/organizer/race') {
        if (requireLogin(res, session) || requireOrganizer(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderOrganizerRace(session));
      }
      if (req.method === 'POST' && url.pathname === '/organizer/evaluator') {
        if (requireLogin(res, session) || requireOrganizer(res, session)) return;
        const body = await readBody(req);
        await writeEvaluatorService(body.enabled === 'on');
        return redirect(res, '/organizer');
      }

      if (req.method === 'GET' && url.pathname === '/team') {
        if (requireLogin(res, session) || requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamDashboard(req, session));
      }
      if (req.method === 'GET' && url.pathname === '/team/submit') {
        if (requireLogin(res, session) || requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderSubmit(req, session));
      }
      if (req.method === 'POST' && url.pathname === '/team/submit') {
        if (requireLogin(res, session) || requireTeam(res, session)) return;
        const body = await readBody(req);
        const result = await requestOrganizerEvaluation(organizerPort, session, body.answer, body.ridingRecord);
        const headers = { 'content-type': 'text/html; charset=utf-8' };
        if (result.status === 'available') headers['set-cookie'] = `${submissionCookieName(session.teamId)}=${encodeTeamSubmission(session.teamId)}; Path=/; HttpOnly; SameSite=Lax`;
        res.writeHead(200, headers);
        return res.end(await renderSubmit(req, session, result));
      }
      if ((req.method === 'GET' && url.pathname === '/team/records') || (req.method === 'GET' && url.pathname === '/team/replay')) {
        if (requireLogin(res, session) || requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderRecords(req, session));
      }

      if (req.method === 'GET' && url.pathname === '/api/team-history') return apiTeamHistory(req, res, session);
      if (req.method === 'GET' && url.pathname.startsWith('/api/team-records/')) return apiTeamRecord(req, res, session, url.pathname.split('/').at(-1));

      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page('未找到', '', session, '<section class="notice danger"><strong>未找到页面</strong></section>'));
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page('错误', '', null, `<section class="notice danger"><strong>运行错误</strong><p>${escapeHtml(error.message)}</p></section>`));
    }
  });
  server.listen(port);
  return server;
}
