import { createServer } from 'node:http';
import { join } from 'node:path';
import { jsonResponse, organizerDir, protectedStoreDir, publicStoreDir, readBody, readJson } from './storage.js';

const credentials = [
  { username: 'Organizer_001', password: '********', role: 'organizer', displayName: '组织方 001' },
  { username: 'team_001', password: '******', role: 'team', teamId: 'team_001', displayName: 'Team 001' },
  { username: 'team_002', password: '**********', role: 'team', teamId: 'team_002', displayName: 'Team 002' }
];

const racesPath = join(publicStoreDir, 'races.json');
const teamsPath = join(publicStoreDir, 'teams.json');
const leaderboardPath = join(publicStoreDir, 'leaderboard_projection.json');
const submissionsPath = join(protectedStoreDir, 'submissions.json');
const recordsPath = join(protectedStoreDir, 'riding_records.json');
const eventsPath = join(protectedStoreDir, 'replay_events.json');
const evaluationPolicyPath = join(organizerDir, 'evaluation_policy.json');

function sessionSubmitCookie(teamId) {
  return `ary_v2_submitted_${teamId}=done`;
}

function hasTeamSubmission(req, session) {
  if (!isTeam(session)) return false;
  return String(req.headers.cookie || '').split(';').map((part) => part.trim()).includes(sessionSubmitCookie(session.teamId));
}

async function requestOrganizerEvaluation(organizerPort, session, answer) {
  try {
    const response = await fetch(`http://127.0.0.1:${organizerPort}/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId: session.teamId, answer })
    });
    if (!response.ok) throw new Error(`Organizer returned ${response.status}`);
    return response.json();
  } catch {
    return {
      status: 'missing',
      teamId: session.teamId,
      resultText: '暂时无法完成评测。',
      score: null,
      resultSummary: '当前评测能力不可用，请稍后重试。'
    };
  }
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function encodeSession(user) {
  return Buffer.from(JSON.stringify({ username: user.username, role: user.role, teamId: user.teamId || null }), 'utf8').toString('base64url');
}

function decodeSession(cookieHeader) {
  const cookie = String(cookieHeader || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('ary_v2_session='));
  if (!cookie) return null;
  try {
    const raw = Buffer.from(cookie.slice('ary_v2_session='.length), 'base64url').toString('utf8');
    const session = JSON.parse(raw);
    const user = credentials.find((item) => item.username === session.username && item.role === session.role && (item.teamId || null) === (session.teamId || null));
    if (!user) return null;
    return { username: user.username, role: user.role, teamId: user.teamId, displayName: user.displayName };
  } catch {
    return null;
  }
}

function isOrganizer(session) {
  return session?.role === 'organizer';
}

function isTeam(session) {
  return session?.role === 'team' && session.teamId;
}

function page(title, active, session, content) {
  const nav = session ? navFor(active, session) : '';
  const identity = session ? `<div class="identity"><span>${escapeHtml(session.displayName)}</span><a href="/logout">退出</a></div>` : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{--ink:#111827;--muted:#64748b;--line:#e2e8f0;--bg:#f7f9fd;--card:#fff;--navy:#111b3d;--blue:#315cff;--green:#0f8f61;--green-bg:#eafaf2;--amber:#b7791f;--amber-bg:#fff7db;--red:#c53030;--red-bg:#fff0f0;--purple:#6d28d9;--purple-bg:#f4efff;--shadow:0 18px 45px rgba(15,23,42,.10)}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#e8efff,transparent 34rem),var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1180px;margin:0 auto;padding:26px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.brand{display:flex;align-items:center;gap:10px;font-weight:900}.mark{width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,var(--blue),#00b894);box-shadow:var(--shadow)}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a,.identity a{color:#334155;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:999px;padding:9px 14px;font-weight:800}.nav a.active{background:var(--navy);color:#fff;border-color:var(--navy)}.identity{display:flex;align-items:center;gap:8px;font-weight:900}.identity span{background:#eef2ff;color:#273b91;border-radius:999px;padding:9px 14px}.hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:22px;margin-bottom:18px}.hero-main,.hero-side,.card{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:26px;box-shadow:var(--shadow)}.hero-main{padding:34px;background:linear-gradient(135deg,#111b3d,#315cff);color:white}.hero-main p{color:#dbe6ff}.hero h1{font-size:40px;line-height:1.08;margin:10px 0}.hero-side,.card{padding:20px}.eyebrow{letter-spacing:.12em;text-transform:uppercase;font-size:12px;font-weight:900;color:#bcd0ff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.muted{color:var(--muted);line-height:1.7}.button{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:14px;padding:12px 16px;background:var(--blue);color:white;font-weight:900;text-decoration:none;cursor:pointer}.button.secondary{background:#fff;color:var(--navy);border:1px solid var(--line)}.cta-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.pill{display:inline-flex;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;background:#edf2ff;color:#2446d8}.pill.green{background:var(--green-bg);color:var(--green)}.pill.amber{background:var(--amber-bg);color:var(--amber)}.pill.red{background:var(--red-bg);color:var(--red)}.pill.purple{background:var(--purple-bg);color:var(--purple)}.pill.gray{background:#f1f5f9;color:#475569}form{display:grid;gap:12px}input,textarea{width:100%;border:1px solid var(--line);border-radius:14px;padding:12px;font:inherit}table{width:100%;border-collapse:collapse;background:white;border-radius:18px;overflow:hidden;border:1px solid var(--line)}th,td{padding:13px;border-bottom:1px solid #eef2f7;text-align:left;vertical-align:top}th{background:#f1f5ff;color:#243b83}tr:last-child td{border-bottom:0}.timeline{display:grid;gap:12px}.event{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px}.event-no{width:50px;height:50px;border-radius:16px;background:var(--navy);color:white;display:flex;align-items:center;justify-content:center;font-weight:900}.notice{padding:18px;border-radius:20px;background:#fff7db;color:#8a5b12;border:1px solid #f6dfa0}.danger{background:#fff0f0;color:#9b1c1c;border-color:#ffd0d0}.ok{background:#eafaf2;color:#0f6e4c;border-color:#b7ebd0}@media(max-width:860px){.hero{grid-template-columns:1fr}.topbar{align-items:flex-start;flex-direction:column}.hero h1{font-size:30px}.shell{padding:16px}.event{grid-template-columns:1fr}}
</style>
</head>
<body><main class="shell"><header class="topbar"><div class="brand"><div class="mark"></div><div>ARY<br><span class="muted">Agent Racing Yard</span></div></div><div>${nav}${identity}</div></header>${content}</main></body></html>`;
}

function navFor(active, session) {
  const items = isOrganizer(session)
    ? [['/organizer', '组织方'], ['/leaderboard', '公开榜单']]
    : [['/team', '队伍首页'], ['/team/submit', '提交'], ['/team/records', 'Records'], ['/team/replay', '回放'], ['/leaderboard', '公开榜单']];
  return `<nav class="nav">${items.map(([href, label]) => `<a class="${active === href ? 'active' : ''}" href="${href}">${label}</a>`).join('')}</nav>`;
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { location, ...headers });
  res.end();
}

function renderLogin(error = '') {
  return page('登录', '/login', null, `<section class="hero"><div class="hero-main"><div class="eyebrow">Login</div><h1>登录 ARY</h1><p>请输入账号和密码进入工作台。</p></div><aside class="hero-side"><h2>欢迎使用 ARY</h2><p class="muted">登录后继续处理赛事相关工作。</p></aside></section><section class="grid"><form class="card" method="post" action="/login"><span class="pill amber">登录</span><h2>账号登录</h2>${error ? `<div class="notice danger">${escapeHtml(error)}</div>` : ''}<label>账号<input name="username" autocomplete="off" placeholder="请输入账号"></label><label>密码<input name="password" type="password" autocomplete="off" placeholder="请输入密码"></label><button class="button" type="submit">进入</button></form></section>`);
}

function requireLogin(res, session) {
  if (session) return false;
  redirect(res, '/login');
  return true;
}

function requireOrganizer(res, session) {
  if (isOrganizer(session)) return false;
  res.writeHead(403, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page('无权限', '', session, `<div class="notice danger"><strong>无权限</strong><br>当前身份不能访问组织方页面。</div>`));
  return true;
}

function requireTeam(res, session) {
  if (isTeam(session)) return false;
  res.writeHead(403, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page('无权限', '', session, `<div class="notice danger"><strong>无权限</strong><br>组织方不能以队伍身份提交或查看队伍私有页面。</div>`));
  return true;
}

function teamOnly(items, session) {
  return items.filter((item) => item.teamId === session.teamId);
}

async function renderTeamDashboard(session, unlocked = false) {
  const races = await readJson(racesPath);
  const submissions = teamOnly(await readJson(submissionsPath), session);
  const records = teamOnly(await readJson(recordsPath), session);
  const race = races[0];
  const action = unlocked
    ? `<div class="cta-row"><a class="button secondary" href="/team/records">查看 Records</a><a class="button secondary" href="/team/replay">查看回放</a></div>`
    : `<div class="cta-row"><a class="button secondary" href="/team/submit">提交参赛内容</a></div>`;
  const statusText = unlocked ? '已提交，Records 和回放已开放。' : '还没有提交，Records 和回放暂不开放。';
  return page('队伍首页', '/team', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Team Workspace</div><h1>${escapeHtml(session.displayName)} 的参赛空间</h1><p>${escapeHtml(race.summary)}</p>${action}</div><aside class="hero-side"><h2>本队状态</h2><p class="muted">${statusText}</p><p class="muted">提交数：${unlocked ? submissions.length : 0}</p><p class="muted">Riding Record：${unlocked ? records.length : 0}</p></aside></section><section class="grid"><div class="card"><span class="pill green">本队内容</span><h2>提交后查看过程记录</h2><p class="muted">提交完成后，本队可以查看自己的提交、评价和回放。</p></div><div class="card"><span class="pill amber">访问范围</span><h2>只看本队内容</h2><p class="muted">其他队伍的提交和回放不会出现在这里。</p></div></section>`);
}

async function renderTeamSubmit(session, result = null) {
  const resultBlock = !result
    ? `<div class="card"><span class="pill gray">等待提交</span><h2>还没有评测结果</h2><p class="muted">提交后，系统会返回本次评测状态。</p></div>`
    : result.status === 'available'
      ? `<div class="card"><span class="pill green">评测完成</span><h2>${escapeHtml(result.resultText)}</h2><p class="muted">${escapeHtml(result.resultSummary)}</p><p class="muted">分数：${escapeHtml(result.score)}</p></div>`
      : `<div class="card"><span class="pill red">暂时不可用</span><h2>${escapeHtml(result.resultText)}</h2><p class="muted">${escapeHtml(result.resultSummary)}</p></div>`;
  return page('提交', '/team/submit', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Submit</div><h1>提交本队参赛内容</h1><p>提交后，系统会尝试完成评测。评测完成后，本队 Records 和回放会开放。</p></div><aside class="hero-side"><h2>提交说明</h2><p class="muted">这里提交的是本队内容。其他队伍不可见。</p></aside></section><section class="grid"><form class="card" method="post" action="/team/submit"><span class="pill amber">提交</span><h2>本队提交</h2><textarea name="answer" rows="4">满分答案</textarea><button class="button" type="submit">提交并评测</button></form>${resultBlock}</section>`);
}

function lockedTeamContent(session) {
  return page('提交后查看', '/team/submit', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Submit Required</div><h1>请先提交参赛内容</h1><p>Records、详情和回放会在本队提交后开放。</p><div class="cta-row"><a class="button secondary" href="/team/submit">去提交</a></div></div><aside class="hero-side"><h2>当前状态</h2><p class="muted">还没有提交记录。</p></aside></section>`);
}

async function renderTeamRecords(session, unlocked = false) {
  if (!unlocked) return lockedTeamContent(session);
  const records = teamOnly(await readJson(recordsPath), session);
  const cards = records.map((record) => `<article class="card"><span class="pill purple">Riding Record</span><h2>${escapeHtml(record.title)}</h2><p class="muted">${escapeHtml(record.summary)}</p><div class="cta-row"><a class="button" href="/team/records/${encodeURIComponent(record.recordId)}">查看详情</a><a class="button secondary" href="/team/replay">查看回放</a></div></article>`).join('');
  return page('Records', '/team/records', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Records</div><h1>${escapeHtml(session.displayName)} 的 Riding Records</h1><p>这里展示本队可查看的过程记录。</p></div><aside class="hero-side"><h2>记录数量</h2><p class="muted">${records.length}</p></aside></section><section class="grid">${cards}</section>`);
}

async function renderTeamRecordDetail(session, recordId, unlocked = false) {
  if (!unlocked) return lockedTeamContent(session);
  const records = teamOnly(await readJson(recordsPath), session);
  const events = await readJson(eventsPath);
  const record = records.find((item) => item.recordId === recordId);
  if (!record) return page('未找到', '/team/records', session, '<div class="notice danger">未找到可查看的 Record。</div>');
  const rows = events.filter((event) => event.recordId === record.recordId).map((event) => `<tr><td>${escapeHtml(event.eventNo)}</td><td>${escapeHtml(event.title)}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(event.content)}</td></tr>`).join('');
  return page(record.title, '/team/records', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Record Detail</div><h1>${escapeHtml(record.title)}</h1><p>${escapeHtml(record.summary)}</p><div class="cta-row"><a class="button secondary" href="/team/replay">查看回放</a><a class="button secondary" href="/team/records">返回 Records</a></div></div><aside class="hero-side"><h2>评价关注点</h2><p class="muted">${record.dimensions.map(escapeHtml).join('、')}</p></aside></section><section class="card"><h2>过程摘要</h2><table><thead><tr><th>#</th><th>阶段</th><th>类型</th><th>摘要</th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

async function renderTeamSubmissions(session) {
  const submissions = teamOnly(await readJson(submissionsPath), session);
  const rows = submissions.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.score)}</td><td>${escapeHtml(item.publicSummary)}</td></tr>`).join('');
  return page('我的提交', '/team/submissions', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">My Submissions</div><h1>${escapeHtml(session.displayName)} 的提交</h1><p>这里展示本队提交、评价状态和结果摘要。</p></div><aside class="hero-side"><h2>访问范围</h2><p class="muted">其他队伍的提交不会出现在这里。</p></aside></section><section class="card"><table><thead><tr><th>提交</th><th>状态</th><th>分数</th><th>摘要</th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

async function renderTeamReplay(session, unlocked = false) {
  if (!unlocked) return lockedTeamContent(session);
  const records = teamOnly(await readJson(recordsPath), session);
  const allEvents = await readJson(eventsPath);
  const recordIds = new Set(records.map((item) => item.recordId));
  const events = allEvents.filter((event) => recordIds.has(event.recordId));
  const eventCards = events.map((event) => `<article class="card event"><div class="event-no">${event.eventNo}</div><div><span class="pill ${event.type === 'steering' ? 'amber' : event.type === 'agent' ? 'purple' : event.type === 'validation' ? 'green' : ''}">${escapeHtml(event.type)}</span><h2>${escapeHtml(event.title)}</h2><p class="muted">${escapeHtml(event.content)}</p></div></article>`).join('');
  return page('我的回放', '/team/replay', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Replay</div><h1>${escapeHtml(session.displayName)} 的 Riding 回放</h1><p>这里只展示本队 Riding Record 的公开事件流。</p></div><aside class="hero-side"><h2>回放范围</h2><p class="muted">事件数：${events.length}</p><p class="muted">其他队伍的事件不会出现在这里。</p></aside></section><section class="timeline">${eventCards}</section>`);
}

async function renderOrganizerDashboard(session) {
  const races = await readJson(racesPath);
  const teams = await readJson(teamsPath);
  const submissions = await readJson(submissionsPath);
  const records = await readJson(recordsPath);
  const policy = await readJson(evaluationPolicyPath);
  const rows = submissions.map((item) => `<tr><td>${escapeHtml(item.teamId)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.score)}</td><td>${escapeHtml(item.publicSummary)}</td></tr>`).join('');
  const dimensions = policy.map((item) => `<li><strong>${escapeHtml(item.dimension)}</strong>：${escapeHtml(item.question)}</li>`).join('');
  return page('组织方控制台', '/organizer', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Organizer Dashboard</div><h1>${escapeHtml(races[0].title)}</h1><p>组织方可以查看队伍提交摘要、评价状态和评价维度，用于管理赛事进展。</p></div><aside class="hero-side"><h2>赛事概览</h2><p class="muted">队伍数：${teams.length}</p><p class="muted">提交数：${submissions.length}</p><p class="muted">Riding Record：${records.length}</p></aside></section><section class="grid"><div class="card"><span class="pill green">赛事管理</span><h2>查看队伍进展</h2><ul class="muted"><li>查看队伍提交摘要</li><li>检查评价状态</li><li>查看榜单展示内容</li><li>维护赛事访问范围</li></ul></div><div class="card"><span class="pill amber">角色边界</span><h2>组织方不作为队伍参赛</h2><p class="muted">组织方页面用于赛事管理和评审，不提供队伍参赛入口。</p></div><div class="card"><span class="pill purple">多维评价</span><h2>评价维度</h2><ul class="muted">${dimensions}</ul></div></section><section class="card" style="margin-top:16px"><h2>队伍提交汇总</h2><table><thead><tr><th>队伍</th><th>提交</th><th>状态</th><th>分数</th><th>摘要</th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

async function renderLeaderboard(session) {
  const leaderboard = await readJson(leaderboardPath);
  const rows = leaderboard.map((item) => `<tr><td>${escapeHtml(item.rank)}</td><td>${escapeHtml(item.teamId)}</td><td>${escapeHtml(item.scoreBand)}</td><td>${escapeHtml(item.publicComment)}</td></tr>`).join('');
  return page('公开榜单', '/leaderboard', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Leaderboard</div><h1>赛事榜单</h1><p>榜单展示队伍名次、评价等级和公开评语。</p></div><aside class="hero-side"><h2>展示范围</h2><p class="muted">这里不展示队伍的详细过程记录。</p></aside></section><section class="card"><table><thead><tr><th>排名</th><th>队伍</th><th>等级</th><th>公开评语</th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

function login(body) {
  return credentials.find((user) => user.username === String(body.username || '') && user.password === String(body.password || '')) || null;
}

async function handleApiMe(res, session) {
  if (!session) return jsonResponse(res, 401, { error: '未登录' });
  return jsonResponse(res, 200, session);
}

async function handleApiMySubmissions(res, session) {
  if (!isTeam(session)) return jsonResponse(res, 403, { error: '只有队伍可以查看本队提交' });
  return jsonResponse(res, 200, teamOnly(await readJson(submissionsPath), session));
}

async function handleApiSubmission(res, session, submissionId) {
  const submissions = await readJson(submissionsPath);
  const item = submissions.find((submission) => submission.submissionId === submissionId);
  if (!item) return jsonResponse(res, 404, { error: '未找到提交' });
  if (isOrganizer(session)) return jsonResponse(res, 200, item);
  if (isTeam(session) && item.teamId === session.teamId) return jsonResponse(res, 200, item);
  return jsonResponse(res, 403, { error: '不能访问其他队伍提交' });
}

async function handleApiTeamReplay(res, session) {
  if (!isTeam(session)) return jsonResponse(res, 403, { error: '只有队伍可以查看本队回放' });
  const records = teamOnly(await readJson(recordsPath), session);
  const recordIds = new Set(records.map((item) => item.recordId));
  const events = (await readJson(eventsPath)).filter((event) => recordIds.has(event.recordId));
  return jsonResponse(res, 200, events);
}

export function createServerApp(port = 4300, organizerPort = 4401) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const session = decodeSession(req.headers.cookie);

      if (req.method === 'GET' && url.pathname === '/') return redirect(res, session ? (isOrganizer(session) ? '/organizer' : '/team') : '/login');
      if (req.method === 'GET' && url.pathname === '/login') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderLogin());
      }
      if (req.method === 'POST' && url.pathname === '/login') {
        const body = await readBody(req);
        const user = login(body);
        if (!user) {
          res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' });
          return res.end(renderLogin('账号或密码不匹配'));
        }
        const sessionCookie = `ary_v2_session=${encodeSession(user)}; Path=/; SameSite=Lax`;
        return redirect(res, user.role === 'organizer' ? '/organizer' : '/team', { 'set-cookie': sessionCookie });
      }
      if (req.method === 'GET' && url.pathname === '/logout') return redirect(res, '/login', { 'set-cookie': 'ary_v2_session=; Path=/; Max-Age=0; SameSite=Lax' });

      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/me') return handleApiMe(res, session);
        if (!session) return jsonResponse(res, 401, { error: '未登录' });
        if (url.pathname === '/api/my-submissions') return handleApiMySubmissions(res, session);
        if (url.pathname.startsWith('/api/submissions/')) return handleApiSubmission(res, session, decodeURIComponent(url.pathname.split('/')[3] || ''));
        if (url.pathname === '/api/team-replay') return handleApiTeamReplay(res, session);
        return jsonResponse(res, 404, { error: '未找到接口' });
      }

      if (requireLogin(res, session)) return;

      if (req.method === 'GET' && url.pathname === '/organizer') {
        if (requireOrganizer(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderOrganizerDashboard(session));
      }
      if (req.method === 'GET' && url.pathname === '/team') {
        if (requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamDashboard(session, hasTeamSubmission(req, session)));
      }
      if (req.method === 'GET' && url.pathname === '/team/submit') {
        if (requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamSubmit(session));
      }
      if (req.method === 'POST' && url.pathname === '/team/submit') {
        if (requireTeam(res, session)) return;
        const body = await readBody(req);
        const answer = String(body.answer || '').trim();
        const result = await requestOrganizerEvaluation(organizerPort, session, answer || '满分答案');
        const headers = { 'content-type': 'text/html; charset=utf-8' };
        if (result.status === 'available') headers['set-cookie'] = `${sessionSubmitCookie(session.teamId)}; Path=/; SameSite=Lax`;
        res.writeHead(200, headers);
        return res.end(await renderTeamSubmit(session, result));
      }
      if (req.method === 'GET' && url.pathname === '/team/records') {
        if (requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamRecords(session, hasTeamSubmission(req, session)));
      }
      if (req.method === 'GET' && url.pathname.startsWith('/team/records/')) {
        if (requireTeam(res, session)) return;
        const recordId = decodeURIComponent(url.pathname.split('/')[3] || '');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamRecordDetail(session, recordId, hasTeamSubmission(req, session)));
      }
      if (req.method === 'GET' && url.pathname === '/team/submissions') {
        if (requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamSubmissions(session));
      }
      if (req.method === 'GET' && url.pathname === '/team/replay') {
        if (requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamReplay(session, hasTeamSubmission(req, session)));
      }
      if (req.method === 'GET' && url.pathname === '/leaderboard') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderLeaderboard(session));
      }

      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page('未找到', '', session, '<div class="notice danger">未找到页面。</div>'));
    } catch (error) {
      jsonResponse(res, 500, { error: error.message });
    }
  });

  server.listen(port);
  return server;
}
