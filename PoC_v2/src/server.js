import { createServer } from 'node:http';
import { join } from 'node:path';
import { jsonResponse, organizerDir, protectedStoreDir, publicStoreDir, readBody, readJson, writeJson } from './storage.js';

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
const riderSessionsPath = join(protectedStoreDir, 'rider_sessions.json');
const evaluationPolicyPath = join(organizerDir, 'evaluation_policy.json');
const evaluatorServicePath = join(organizerDir, 'evaluator_service.json');

async function readEvaluatorService() {
  return readJson(evaluatorServicePath);
}

async function writeEvaluatorService(enabled) {
  const current = await readEvaluatorService();
  await writeJson(evaluatorServicePath, { ...current, enabled });
}

function encodeTeamSubmission(teamId) {
  return Buffer.from(JSON.stringify({ teamId, status: 'done' }), 'utf8').toString('base64url');
}

function sessionSubmitCookie(teamId) {
  return `ary_v2_submitted_${teamId}=${encodeTeamSubmission(teamId)}`;
}

function hasTeamSubmission(req, session) {
  if (!isTeam(session)) return false;
  const cookie = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`ary_v2_submitted_${session.teamId}=`));
  if (!cookie) return false;
  try {
    const raw = Buffer.from(cookie.split('=').slice(1).join('='), 'base64url').toString('utf8');
    const value = JSON.parse(raw);
    return value.teamId === session.teamId && value.status === 'done';
  } catch {
    return false;
  }
}

async function requestOrganizerEvaluation(organizerPort, session, answer) {
  const service = await readEvaluatorService();
  if (!service.enabled) {
    return {
      status: 'missing',
      teamId: session.teamId,
      resultText: '暂时无法完成评测。',
      score: null,
      resultSummary: '组织方评测服务当前未开启。'
    };
  }
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
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function toneClass(value) {
  return ['green', 'amber', 'red', 'purple', 'gray'].includes(value) ? value : 'gray';
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
  const chrome = session
    ? `<aside class="sidebar"><div class="brand"><div class="mark"></div><div><strong>ARY GRS 001</strong><span>Agent Riding Record Challenge</span></div></div>${nav}</aside><section class="workspace"><header class="pagebar"><div><div class="eyebrow">${escapeHtml(title)}</div><h1>${escapeHtml(title)}</h1></div>${identity}</header>${content}</section>`
    : `<section class="auth-shell"><div class="auth-brand"><div class="mark"></div><div><strong>ARY GRS 001</strong><span>Agent Racing Yard</span></div></div>${content}</section>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{--ink:#172033;--muted:#667085;--line:#d9dee8;--bg:#f2f4f7;--panel:#fff;--sidebar:#121826;--sidebar-ink:#e8edf7;--accent:#2347d6;--green:#15734f;--green-bg:#e7f5ee;--amber:#9a6500;--amber-bg:#fff5d8;--red:#b42318;--red-bg:#fff1f0;--purple:#5b3fb5;--purple-bg:#f0ecff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{min-height:100vh}.sidebar{position:fixed;inset:0 auto 0 0;width:250px;background:var(--sidebar);color:var(--sidebar-ink);padding:22px 18px;display:flex;flex-direction:column;gap:22px}.workspace{margin-left:250px;min-height:100vh;padding:26px 32px}.auth-shell{max-width:920px;margin:0 auto;min-height:100vh;padding:42px 24px;display:grid;align-content:center}.auth-brand,.brand{display:flex;align-items:center;gap:12px}.brand strong,.auth-brand strong{display:block;font-size:15px}.brand span,.auth-brand span{display:block;color:#98a2b3;font-size:12px;margin-top:2px}.mark{width:34px;height:34px;border-radius:7px;background:#e11d48;box-shadow:inset 0 -10px 0 rgba(0,0,0,.16)}.nav{display:flex;flex-direction:column;gap:4px}.nav a{color:#cbd5e1;text-decoration:none;border-radius:8px;padding:10px 12px;font-weight:750}.nav a:hover{background:rgba(255,255,255,.08)}.nav a.active{background:#fff;color:#121826}.pagebar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.pagebar h1{margin:3px 0 0;font-size:24px;line-height:1.15}.identity{display:flex;align-items:center;gap:8px;font-weight:750}.identity span,.identity a{background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px 11px;color:#344054;text-decoration:none}.hero{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,.55fr);gap:14px;margin-bottom:14px}.hero-main,.hero-side,.card{background:var(--panel);border:1px solid var(--line);border-radius:10px}.hero-main{padding:20px}.hero-main h1{font-size:28px;line-height:1.15;margin:6px 0 8px}.hero-main p{color:var(--muted);max-width:760px}.hero-side,.card{padding:16px}.hero-side h2,.card h2{font-size:16px;margin:6px 0 8px}.eyebrow{letter-spacing:.08em;text-transform:uppercase;font-size:11px;font-weight:850;color:#667085}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.muted{color:var(--muted);line-height:1.55}.button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent);border-radius:8px;padding:10px 13px;background:var(--accent);color:white;font-weight:800;text-decoration:none;cursor:pointer}.button.secondary{background:#fff;color:#1d2939;border-color:var(--line)}.cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.pill{display:inline-flex;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:850;background:#eef2ff;color:#243b83}.pill.green{background:var(--green-bg);color:var(--green)}.pill.amber{background:var(--amber-bg);color:var(--amber)}.pill.red{background:var(--red-bg);color:var(--red)}.pill.purple{background:var(--purple-bg);color:var(--purple)}.pill.gray{background:#f2f4f7;color:#475467}form{display:grid;gap:12px}label{display:grid;gap:6px;font-weight:750;color:#344054}input,textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:11px;font:inherit;background:#fff}table{width:100%;border-collapse:collapse;background:white;border:1px solid var(--line);border-radius:10px;overflow:hidden}th,td{padding:11px 12px;border-bottom:1px solid #edf0f5;text-align:left;vertical-align:top}th{background:#f8fafc;color:#344054;font-size:12px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}.timeline{display:grid;gap:10px}.event{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;align-items:start}.event-no{width:34px;height:34px;border-radius:50%;background:#121826;color:white;display:flex;align-items:center;justify-content:center;font-weight:850;font-size:13px}.notice{padding:14px;border-radius:10px;background:#fff7db;color:#8a5b12;border:1px solid #f6dfa0}.danger{background:#fff0f0;color:#9b1c1c;border-color:#ffd0d0}.ok{background:#eafaf2;color:#0f6e4c;border-color:#b7ebd0}.dashboard{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:14px;margin-bottom:14px}.priority-panel,.section-shell,.nested-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px}.priority-panel{box-shadow:0 18px 40px rgba(16,24,40,.08)}.priority-panel h1{font-size:30px;line-height:1.12;margin:8px 0}.priority-panel p{max-width:760px}.side-stack,.detail-stack{display:grid;gap:12px}.metric-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}.metric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}.metric strong{display:block;font-size:24px;margin:6px 0 2px}.action-list{display:grid;gap:10px}.action-item{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px;text-decoration:none;color:var(--ink)}.action-item:hover{border-color:#b8c2d6;box-shadow:0 10px 24px rgba(16,24,40,.06)}.action-item.primary{background:#16213a;color:#fff;border-color:#16213a}.action-item span{font-size:12px;font-weight:850;color:#667085}.action-item.primary span{color:#cbd5e1}.action-item strong{display:block;font-size:16px;margin:2px 0}.action-item em{display:block;color:var(--muted);font-style:normal;line-height:1.45}.action-item.primary em{color:#d0d5dd}.action-arrow{font-size:22px;font-weight:900;color:#98a2b3}.action-item.primary .action-arrow{color:#fff}.detail-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}.detail-heading h2{margin:0;font-size:18px}.detail-heading p{margin:0}.disclosure{background:#fff;border:1px solid var(--line);border-radius:12px;margin-top:12px;overflow:hidden}.disclosure summary{cursor:pointer;list-style:none;padding:15px 16px;font-weight:850;display:flex;align-items:center;justify-content:space-between;gap:14px}.disclosure summary::-webkit-details-marker{display:none}.disclosure summary small{display:block;color:var(--muted);font-weight:650;line-height:1.4}.disclosure-body{border-top:1px solid var(--line);padding:14px 16px;background:#fbfcff}.compact-note{padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid var(--line);color:var(--muted);line-height:1.55}.radar-panel{display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);gap:16px;align-items:center;margin-top:12px}.radar-svg{width:100%;height:auto;display:block}.radar-legend{display:grid;gap:8px}.radar-legend li{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:#fff;color:#344054}.radar-score{font-weight:850;color:#172033}@media(max-width:900px){.sidebar{position:static;width:auto}.workspace{margin-left:0;padding:16px}.hero,.dashboard{grid-template-columns:1fr}.pagebar{align-items:flex-start;flex-direction:column}.auth-shell{align-content:start}.event{grid-template-columns:1fr}.action-item{align-items:flex-start}.detail-heading{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body><main class="shell">${chrome}</main></body></html>`;
}

function navFor(active, session) {
  const items = isOrganizer(session)
    ? [['/organizer', '总览'], ['/organizer/race', 'Race 管理'], ['/organizer/evaluation', '评价'], ['/leaderboard', '公开榜单']]
    : [['/team', '驾驶舱'], ['/team/race', 'Race 指南'], ['/team/evaluation', '自查'], ['/team/history', '历史'], ['/team/submit', '提交'], ['/team/records', 'Records'], ['/team/replay', '回放'], ['/leaderboard', '公开榜单']];
  return `<nav class="nav">${items.map(([href, label]) => `<a class="${active === href ? 'active' : ''}" href="${href}">${label}</a>`).join('')}</nav>`;
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { location, ...headers });
  res.end();
}

function renderLogin(error = '') {
  return page('登录', '/login', null, `<section class="hero"><div class="hero-main"><div class="eyebrow">Sign in</div><h1>登录 ARY</h1><p>请输入账号和密码。</p></div><aside class="hero-side"><h2>GRS 001</h2><p class="muted">Agent Riding Record Challenge</p></aside></section><form class="card" method="post" action="/login"><span class="pill amber">登录</span><h2>账号登录</h2>${error ? `<div class="notice danger">${escapeHtml(error)}</div>` : ''}<label>账号<input name="username" autocomplete="off" placeholder="请输入账号"></label><label>密码<input name="password" type="password" autocomplete="off" placeholder="请输入密码"></label><button class="button" type="submit">进入</button></form>`);
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

function listItems(items = []) {
  if (!items.length) return '<p class="muted">暂无。</p>';
  return `<ul class="muted">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderEvidenceList(items = []) {
  if (!items.length) return '';
  return `<ul class="muted">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderFixEvidence(event) {
  if (!event.failureEvidence && !event.fixAction && !event.revalidation) return '';
  return `<div class="notice"><strong>失败到修复</strong>${event.failureEvidence ? `<p>失败现象：${escapeHtml(event.failureEvidence)}</p>` : ''}${event.fixAction ? `<p>修复动作：${escapeHtml(event.fixAction)}</p>` : ''}${event.revalidation ? `<p>复验结果：${escapeHtml(event.revalidation)}</p>` : ''}</div>`;
}

function renderBuildTimeline(steps = []) {
  if (!steps.length) return '<p class="muted">暂无构建过程。</p>';
  return `<div class="timeline">${steps.map((step) => `<article class="event"><div class="event-no">${escapeHtml(step.step)}</div><div class="card"><span class="pill purple">${escapeHtml(step.phase)}</span><h2>${escapeHtml(step.outcome)}</h2><p class="muted"><strong>Rider 动作：</strong>${escapeHtml(step.riderMove)}</p><p class="muted"><strong>Agent 工作：</strong>${escapeHtml(step.agentWork)}</p><p class="muted"><strong>产物变化：</strong>${escapeHtml(step.artifactChange)}</p><p class="muted"><strong>验证：</strong>${escapeHtml(step.validation)}</p></div></article>`).join('')}</div>`;
}

function renderEventRows(events) {
  return events.map((event) => `<tr><td>${escapeHtml(event.eventNo)}</td><td>${escapeHtml(event.phase || '')}</td><td>${escapeHtml(event.actor || '')}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(event.title)}</td><td>${escapeHtml(event.changedArea || '')}</td><td>${escapeHtml(event.visibleChange || event.artifactChange || event.content)}</td><td>${escapeHtml(event.validation || '')}</td><td>${escapeHtml(event.riderIntent || '')}</td></tr>`).join('');
}

function groupByPhase(events) {
  const groups = [];
  const byPhase = new Map();
  for (const event of events) {
    const phase = event.phase || event.type;
    if (!byPhase.has(phase)) {
      const group = { phase, events: [] };
      byPhase.set(phase, group);
      groups.push(group);
    }
    byPhase.get(phase).events.push(event);
  }
  return groups;
}

function renderGroupedReplay(events) {
  return groupByPhase(events).map((group) => `<section class="card"><div class="eyebrow">Phase</div><h2>${escapeHtml(group.phase)}</h2><p class="muted">事件数：${group.events.length}</p><div class="timeline">${group.events.map((event) => `<article class="event"><div class="event-no">${escapeHtml(event.eventNo)}</div><div class="card"><span class="pill ${event.type === 'steering' ? 'amber' : event.type === 'agent' || event.type === 'build' ? 'purple' : event.type === 'validation' ? 'green' : event.type === 'fix' ? 'red' : ''}">${escapeHtml(event.type)}</span><h2>${escapeHtml(event.title)}</h2><p class="muted">${escapeHtml(event.content)}</p><p class="muted"><strong>改动范围：</strong>${escapeHtml(event.changedArea || '')}</p><p class="muted"><strong>产物变化：</strong>${escapeHtml(event.artifactChange || '')}</p><p class="muted"><strong>可见变化：</strong>${escapeHtml(event.visibleChange || '')}</p><p class="muted"><strong>操作证据：</strong></p>${renderEvidenceList(event.operationEvidence)}${renderFixEvidence(event)}<p class="muted"><strong>验证：</strong>${escapeHtml(event.validation || '')}</p><p class="muted">Rider 意图：${escapeHtml(event.riderIntent || '')}</p></div></article>`).join('')}</div></section>`).join('');
}

function renderMainlineCards(items) {
  return `<section class="grid" style="margin-top:12px">${items.map((item) => `<div class="card"><span class="pill ${item.tone || 'gray'}">${escapeHtml(item.label)}</span><h2>${escapeHtml(item.title)}</h2><p class="muted">${escapeHtml(item.body)}</p>${item.href ? `<div class="cta-row"><a class="button secondary" href="${escapeHtml(item.href)}">${escapeHtml(item.action || '查看')}</a></div>` : ''}</div>`).join('')}</section>`;
}

function renderMetricStrip(items = []) {
  return `<section class="metric-strip">${items.map((item) => `<div class="metric"><span class="pill ${toneClass(item.tone)}">${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><p class="muted">${escapeHtml(item.caption)}</p></div>`).join('')}</section>`;
}

function renderActionList(items = []) {
  return `<div class="action-list">${items.map((item) => `<a class="action-item ${item.primary ? 'primary' : ''}" href="${escapeHtml(item.href)}"><div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.body)}</em></div><div class="action-arrow">›</div></a>`).join('')}</div>`;
}

function renderDisclosure(title, summary, content, open = false) {
  return `<details class="disclosure"${open ? ' open' : ''}><summary><span>${escapeHtml(title)}<small>${escapeHtml(summary)}</small></span><span class="action-arrow">⌄</span></summary><div class="disclosure-body">${content}</div></details>`;
}

function renderNestedEntrypoints(items = []) {
  return `<section class="section-shell"><div class="detail-heading"><div><div class="eyebrow">Next steps</div><h2>继续处理</h2></div><p class="muted">选择一个入口查看具体任务。</p></div>${renderActionList(items)}</section>`;
}

function describeEvent(event, fallback = '') {
  if (!event) return fallback;
  return `事件 ${event.eventNo}：${event.title}`;
}

function renderRaceOperatingLoop(context = {}) {
  const items = [
    ['创建', context.create || '组织方创建 Race，并设定项目目标。', 'green'],
    ['披露', context.disclose || '只披露队伍需要看到的任务、结果和回放记录。', 'amber'],
    ['组织', context.organize || '组织队伍、提交、历史、Records 和回放。', 'purple'],
    ['运行', context.run || '队伍在 Race 中提交、评测、解锁和复盘。', 'gray'],
    ['评审', context.review || '组织方按多维评价检查过程证据。', 'red'],
    ['展示', context.showcase || '公开榜单只展示可公开的结果摘要。', 'green']
  ];
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">Agent Racing Yard</div><h2>训练场与竞技场闭环</h2><div class="grid">${items.map(([label, body, tone]) => `<div class="card"><span class="pill ${tone}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function renderGrsDogfoodLoop(context = {}) {
  const items = context.items || [
    ['定义', context.define || '把 ARY 的关键问题写成 Race 目标。', 'green'],
    ['设计', context.design || '把角色、页面、评价和回放设计成可执行流程。', 'purple'],
    ['构建', context.build || 'Rider 在 Race 中构建 Yard，并留下过程证据。', 'amber'],
    ['验证', context.validate || '用提交、评测、Records 和 Replay 验证 Yard 是否成立。', 'gray']
  ];
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">Build the Yard By Racing in the Yard</div><h2>GRS 是什么？</h2><p class="muted">ARY Genesis Race Series / 创世骑行系列赛，是 Agent Racing Yard 用自己的 Race 流程建设并验证自己的 self-dogfood 系列赛事。每一场 Race 都围绕 ARY 的一个关键问题展开。</p><div class="grid">${items.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function renderOrganizerCustody(policy = {}) {
  return `<section class="grid" style="margin-top:12px"><div class="card"><span class="pill gray">赛事资料归属</span><h2>Organizer 持有原始赛事资料</h2>${listItems(policy.retainedData)}</div><div class="card"><span class="pill purple">队伍可见</span><h2>按队伍披露</h2>${listItems(policy.disclosedToTeams)}</div><div class="card"><span class="pill green">公开展示</span><h2>只展示公开摘要</h2>${listItems(policy.disclosedToPublicLeaderboard)}</div></section>`;
}

function renderPublicDisclosureSource(context = {}) {
  const items = context.items || [
    ['Organizer 侧存留', context.retained || 'Race 原始资料由 Organizer 持有。', 'gray'],
    ['公开侧最小承载', context.minimal || '公开侧只承载披露摘要，不承载完整 Race 数据。', 'purple'],
    ['仍可组织', context.operable || 'ARY 仍然完成创建、披露、组织与展示。', 'amber'],
    ['主动披露', context.publicSummary || '展示内容来自 Organizer 主动披露的公开摘要。', 'green']
  ];
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">ARY GRS 001：Product Definition</div><h2>数据安全的 Race</h2><p class="muted">Race 原始资料留在 Organizer 侧；公开侧只承载披露摘要，仍然完成赛事创建、披露、组织与展示。</p><div class="grid">${items.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function renderTeamCustodyNote() {
  return `<section class="card" style="margin-top:12px"><span class="pill gray">资料边界</span><h2>只展示本队可见摘要</h2><p class="muted">原始赛事资料和完整本地历史不默认进入 ARY 展示；本队页面只展示提交摘要、评价结果、回放记录和回放事件。</p></section>`;
}

function renderGrowthPath(context = {}) {
  const items = [
    ['Learn', '学习与成长', context.learn || '从本队历史中复盘目标、边界、Steering 和验证。', 'green'],
    ['Build', '完成真实项目', context.build || '把 Agent 工作、产物变化和验收结果串成软件搭建过程。', 'purple'],
    ['Show', '展示作品能力', context.show || '提交后通过 Records 和 Replay 展示可评审证据。', 'amber'],
    ['Grow', '下一次成长', context.grow || '用公开评语和复盘结果沉淀下一轮 Race 的能力方向。', 'gray']
  ];
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">Learn. Build. Show. Grow.</div><h2>一次 Race 后的成长路径</h2><div class="grid">${items.map(([label, title, body, tone]) => `<div class="card"><span class="pill ${tone}">${escapeHtml(label)}</span><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function guidanceItemsFromSession(item = {}) {
  if (item.guidanceEvidence?.length) return item.guidanceEvidence;
  const steps = item.buildTimeline || [];
  const goalStep = steps[0];
  const steeringStep = steps.find((step) => step.riderMove && step.phase !== goalStep?.phase) || goalStep;
  const actionStep = steps.find((step) => step.agentWork) || goalStep;
  const validationStep = steps.find((step) => step.validation) || steps.at(-1);
  const finalStep = steps.at(-1);
  return [
    { label: '可指导', title: '向 Agent 描述目标', body: goalStep ? `${goalStep.phase}：${goalStep.riderMove}` : item.objectiveSummary || '目标先被写成可执行的任务边界。', tone: 'green' },
    { label: '可指导', title: '让 Agent 拆解任务', body: `${steps.length} 个搭建节点把任务拆成 Rider 动作、Agent 工作和验收结果。`, tone: 'green' },
    { label: '可指导', title: '检查执行方向', body: steeringStep ? `${steeringStep.phase}：${steeringStep.riderMove}` : 'Rider 在关键节点检查方向并纠偏。', tone: 'amber' },
    { label: '可理解', title: '判断技术方案', body: actionStep ? `${actionStep.phase}：${actionStep.agentWork}` : '技术方案通过 Agent 工作和产物变化呈现。', tone: 'purple' },
    { label: '可理解', title: '理解架构与关键技术点', body: validationStep ? `${validationStep.phase}：${validationStep.validation}` : item.validationSummary || '通过验证摘要理解关键技术点是否成立。', tone: 'purple' },
    { label: '可执行', title: '推进可执行计划', body: finalStep ? `${finalStep.phase}：${finalStep.outcome}` : item.acceptanceSummary || '计划最终收束到可验收结果。', tone: 'gray' }
  ];
}

function guidanceItemsFromEvents(events = []) {
  const goalEvent = events.find((event) => event.type === 'prompt');
  const steeringEvent = events.find((event) => event.type === 'steering');
  const actionEvent = events.find((event) => event.type === 'build' || event.type === 'fix');
  const validationEvent = events.find((event) => event.validation);
  return [
    { label: '可指导', title: '向 Agent 描述目标', body: describeEvent(goalEvent, '目标来自本队历史。'), tone: 'green' },
    { label: '可指导', title: '让 Agent 拆解任务', body: `${groupByPhase(events).length} 个阶段把任务拆成 ${events.length} 个回放事件。`, tone: 'green' },
    { label: '可指导', title: '检查执行方向', body: steeringEvent ? `${describeEvent(steeringEvent)}｜${steeringEvent.phase}` : 'Rider 在关键节点检查执行方向。', tone: 'amber' },
    { label: '可理解', title: '判断技术方案', body: actionEvent ? `${describeEvent(actionEvent)}｜${actionEvent.changedArea || actionEvent.artifactChange || ''}` : '技术方案通过产物变化和修复动作呈现。', tone: 'purple' },
    { label: '可理解', title: '理解架构与关键技术点', body: validationEvent ? `${describeEvent(validationEvent)}｜${validationEvent.validation}` : '验证事件说明关键技术点是否成立。', tone: 'purple' },
    { label: '可执行', title: '推进可执行计划', body: `回放保留 ${events.length} 个事件，覆盖 ${groupByPhase(events).map((group) => group.phase).slice(0, 3).join('、')} 等阶段。`, tone: 'gray' }
  ];
}

function renderGuidanceEvidence(context = {}) {
  const items = (context.items?.length ? context.items : guidanceItemsFromSession(context.session || {})).filter((item) => item?.label && item?.title && item?.body);
  const features = context.features || [
    ['可指导', '被带着，不迷路', 'green'],
    ['可理解', '学原理，懂技术', 'purple'],
    ['可执行', '形成可行动计划', 'amber']
  ];
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">DevCompass Racing</div><h2>${escapeHtml(context.heading || '你不是一个人在 Hackathon')}</h2><p class="muted">${escapeHtml(context.subtitle || '路线、方法、反馈、协同、工具体系与计划都落在本队过程证据中。')}</p><div class="grid">${items.map((item) => `<div class="card"><span class="pill ${toneClass(item.tone)}">${escapeHtml(item.label)}</span><h2>${escapeHtml(item.title)}</h2><p class="muted">${escapeHtml(item.body)}</p></div>`).join('')}</div><div class="grid" style="margin-top:12px">${features.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function reviewReplayItemsFromSession(item = {}) {
  const steps = item.buildTimeline || [];
  const plan = steps[0];
  const execution = steps.find((step) => step.agentWork) || plan;
  const check = steps.find((step) => step.validation) || steps.at(-1);
  const review = steps.find((step) => step.riderMove && step.validation) || check;
  const improve = steps.at(-1);
  return [
    ['计划', '计划是否清楚', plan ? `${plan.phase}：${plan.riderMove}` : item.objectiveSummary || '计划来自本队目标摘要。', 'green'],
    ['执行', '架构是否合理', execution ? `${execution.phase}：${execution.artifactChange}` : '执行过程通过产物变化呈现。', 'purple'],
    ['检查', '技术选择是否有效', check ? `${check.phase}：${check.validation}` : item.validationSummary || '检查结果来自验证摘要。', 'amber'],
    ['复盘', 'Agent 使用是否可控', review ? `${review.phase}：${review.riderMove}` : '复盘关注 Rider 如何保持 Agent 可控。', 'red'],
    ['提升', '过程是否能被回看和改进', improve ? `${improve.phase}：${improve.outcome}` : item.acceptanceSummary || '复盘结果沉淀为下一次改进方向。', 'gray']
  ];
}

function reviewReplayItemsFromEvents(events = []) {
  const goalEvent = events.find((event) => event.type === 'prompt');
  const buildEvent = events.find((event) => event.type === 'build' || event.type === 'fix');
  const validationEvent = events.find((event) => event.validation);
  const steeringEvent = events.find((event) => event.type === 'steering');
  const improveEvent = [...events].reverse().find((event) => event.riderIntent || event.revalidation || event.validation);
  return [
    ['计划', '计划是否清楚', describeEvent(goalEvent, '计划来自本队目标事件。'), 'green'],
    ['执行', '架构是否合理', buildEvent ? `${describeEvent(buildEvent)}｜${buildEvent.artifactChange || buildEvent.changedArea || ''}` : '执行过程通过产物变化呈现。', 'purple'],
    ['检查', '技术选择是否有效', validationEvent ? `${describeEvent(validationEvent)}｜${validationEvent.validation}` : '检查结果来自验证事件。', 'amber'],
    ['复盘', 'Agent 使用是否可控', steeringEvent ? `${describeEvent(steeringEvent)}｜${steeringEvent.riderIntent || steeringEvent.phase}` : '复盘关注 Rider 如何保持 Agent 可控。', 'red'],
    ['提升', '过程是否能被回看和改进', improveEvent ? `${describeEvent(improveEvent)}｜${improveEvent.revalidation || improveEvent.riderIntent || improveEvent.validation}` : '复盘结果沉淀为下一次改进方向。', 'gray']
  ];
}

function renderReviewReplay(context = {}) {
  const items = context.items?.length ? context.items : reviewReplayItemsFromSession(context.session || {});
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">Review & Replay</div><h2>${escapeHtml(context.heading || '做完不是结束，复盘才是成长开始')}</h2><p class="muted">${escapeHtml(context.subtitle || '一次 Race 的价值不只在最后作品，也在于能从骑行过程学到下一次如何做得更好。')}</p><div class="grid">${items.map(([label, title, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function agentRidingSkillItemsFromSession(item = {}) {
  const steps = item.buildTimeline || [];
  if (!steps.length && !item.objectiveSummary) return [];
  const goalStep = steps[0];
  const technicalStep = steps.find((step) => step.agentWork) || goalStep;
  const architectureStep = steps.find((step) => step.artifactChange) || technicalStep;
  const observeStep = steps.find((step) => step.validation) || steps.at(-1);
  const interventionStep = steps.find((step, index) => index > 0 && step.riderMove) || steps.find((step) => step.riderMove);
  return [
    ['目标设定', goalStep ? `${goalStep.phase}：${goalStep.riderMove || item.objectiveSummary}` : item.objectiveSummary || '先把 Race 目标写成可执行边界。', 'green'],
    ['技术判断', technicalStep ? `${technicalStep.phase}：${technicalStep.agentWork || technicalStep.outcome}` : item.validationSummary || '技术判断通过 Agent 工作和验证摘要呈现。', 'purple'],
    ['任务拆解', `${steps.length} 个搭建节点把目标拆成 Rider 动作、Agent 工作和验收结果。`, 'amber'],
    ['架构理解', architectureStep ? `${architectureStep.phase}：${architectureStep.artifactChange || architectureStep.outcome}` : item.acceptanceSummary || '架构理解来自产物变化和验收摘要。', 'gray'],
    ['过程观察', observeStep ? `${observeStep.phase}：${observeStep.validation || observeStep.outcome}` : item.validationSummary || '过程观察通过验证节点沉淀。', 'red'],
    ['方向干预', interventionStep ? `${interventionStep.phase}：${interventionStep.riderMove}` : 'Rider 在关键节点判断方向并干预。', 'green']
  ];
}

function agentRidingSkillItemsFromEvents(events = []) {
  if (!events.length) return [];
  const phases = groupByPhase(events);
  const goalEvent = events.find((event) => event.type === 'prompt');
  const technicalEvent = events.find((event) => event.type === 'build' || event.type === 'fix');
  const architectureEvent = events.find((event) => event.changedArea || event.artifactChange);
  const observeEvent = events.find((event) => event.operationEvidence || event.validation);
  const steeringEvent = events.find((event) => event.type === 'steering');
  return [
    ['目标设定', describeEvent(goalEvent, '目标设定来自本队历史起点。'), 'green'],
    ['技术判断', technicalEvent ? `${describeEvent(technicalEvent)}｜${technicalEvent.changedArea || technicalEvent.artifactChange || ''}` : '技术判断来自构建与修复事件。', 'purple'],
    ['任务拆解', `${phases.length} 个阶段把 Race 拆成 ${events.length} 个回放事件。`, 'amber'],
    ['架构理解', architectureEvent ? `${describeEvent(architectureEvent)}｜${architectureEvent.changedArea || architectureEvent.artifactChange}` : '架构理解来自产物变化。', 'gray'],
    ['过程观察', observeEvent ? `${describeEvent(observeEvent)}｜${observeEvent.operationEvidence || observeEvent.validation}` : '过程观察来自操作证据和验证节点。', 'red'],
    ['方向干预', steeringEvent ? `${describeEvent(steeringEvent)}｜${steeringEvent.riderIntent || steeringEvent.content}` : '方向干预来自 Rider 的 Steering 事件。', 'green']
  ];
}

function renderAgentRidingSkillTraining(context = {}) {
  const items = context.items?.length ? context.items : (context.events?.length ? agentRidingSkillItemsFromEvents(context.events) : agentRidingSkillItemsFromSession(context.session || {}));
  if (!items.length) return `<section class="card" style="margin-top:12px"><div class="eyebrow">Learning by Racing</div><h2>这场 Race 你们要练什么？</h2><p class="muted">暂无可复盘训练证据。</p></section>`;
  if (context.compact) {
    const labels = items.map(([label]) => label).join('、');
    return `<section class="card" style="margin-top:12px"><div class="eyebrow">Learning by Racing</div><h2>这场 Race 你们要练什么？</h2><p class="muted">Build up your Agent Riding Skill。当前训练项：${escapeHtml(labels)}。</p><div class="grid"><div class="card"><span class="pill green">边做边学</span><p class="muted">直接进入 Race，在真实任务中学习，在协同中获得指导，在复盘中提升能力。</p></div><div class="card"><span class="pill amber">边协同边成长</span><p class="muted">进入历史详情、Record 或 Replay 查看每个训练项对应的过程证据。</p></div></div></section>`;
  }
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">Learning by Racing</div><h2>这场 Race 你们要练什么？</h2><p class="muted">Build up your Agent Riding Skill。直接进入 Race，在真实任务中学习，在协同中获得指导，在复盘中提升能力。</p><div class="grid">${items.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div><p class="muted" style="margin-top:12px">不是先听完所有知识再做项目，而是在 Race 中边做边学、边协同边成长。</p></section>`;
}

function countBuildSteps(sessions) {
  return sessions.reduce((sum, item) => sum + (item.buildTimeline?.length || 0), 0);
}

function countRecordEvents(events, records) {
  const recordIds = new Set(records.map((record) => record.recordId));
  return events.filter((event) => recordIds.has(event.recordId)).length;
}

function filterTeamEvents(events, records, sessions) {
  const recordSessionPairs = new Set(sessions.map((item) => `${item.recordId}::${item.sessionId}`));
  const fallbackRecordIds = new Set(records.map((item) => item.recordId));
  return events.filter((event) => recordSessionPairs.has(`${event.recordId}::${event.sourceSessionId}`) || (!event.sourceSessionId && fallbackRecordIds.has(event.recordId)));
}

function renderLearningOutcome(context = {}) {
  return `<section class="grid" style="margin-top:12px"><div class="card"><span class="pill green">本轮学到什么</span><h2>${escapeHtml(context.learnTitle || '把目标、架构、技术选择和验证连成证据链')}</h2><p class="muted">${escapeHtml(context.learn || '复盘不只看完成结果，而是看计划、执行、检查和 Rider 干预怎样影响作品。')}</p></div><div class="card"><span class="pill amber">下轮怎么改</span><h2>${escapeHtml(context.nextTitle || '把复盘结论带入下一次 Race')}</h2><p class="muted">${escapeHtml(context.next || '下一轮优先提前写清计划、保留关键验证，并在偏航时更早介入。')}</p></div></section>`;
}

function capabilityTags(record = {}, events = []) {
  const tags = [...(record.dimensions || [])];
  if (events.some((event) => event.type === 'prompt')) tags.push('需求理解', 'Prompt 工程');
  if (events.some((event) => event.type === 'steering')) tags.push('Agent 设计', 'Agent 使用可控');
  if (events.some((event) => event.type === 'build')) tags.push('架构实现');
  if (events.some((event) => event.type === 'fix')) tags.push('失败修复');
  if (events.some((event) => event.validation)) tags.push('验证证据');
  return [...new Set(tags)].slice(0, 10);
}

function renderCapabilityPortfolio(context = {}) {
  const records = context.records || [];
  const events = context.events || [];
  const leaderboard = context.leaderboard || [];
  const firstRecord = context.record || records[0] || {};
  const tags = context.tags || capabilityTags(firstRecord, events);
  const publicComment = context.publicComment || leaderboard.find((item) => item.teamId === firstRecord.teamId)?.publicComment || '公开评语用于说明可公开能力摘要。';
  const outputItems = [
    ['Race 完赛状态', context.certificate || '提交通过后形成本轮 Race 完成状态，公开展示仍以授权摘要为准。', 'green'],
    ['项目作品', firstRecord.title || context.project || '项目作品来自本队 Record 摘要。', 'purple'],
    ['Riding Replay 过程记录', context.replaySummary || `${events.length} 个过程证据支撑可展示能力。`, 'amber']
  ];
  const featureItems = [
    ['可见', '公开展示页只呈现可公开摘要。', 'green'],
    ['可证', '过程证据来自 Record 与 Replay。', 'purple'],
    ['可评', `评审反馈：${publicComment}`, 'amber'],
    ['可推荐', context.recommendation || '可被人工考虑推荐，不做自动机会匹配承诺。', 'gray']
  ];
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">DevCompass Racing for Agentic Development</div><h2>${escapeHtml(context.heading || '可展示的智能体开发能力档案')}</h2><p class="muted">${escapeHtml(context.subtitle || '留下的不是一句用过 AI 写代码，而是可见、可证、可评、可推荐的过程证据。')}</p><div class="grid">${outputItems.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div><section class="card" style="margin-top:12px"><h2>能力标签</h2><p class="muted">${tags.map((tag) => `<span class="pill gray" style="margin:0 6px 6px 0">${escapeHtml(tag)}</span>`).join('')}</p></section><div class="grid" style="margin-top:12px">${featureItems.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function renderRacingIdentity(context = {}) {
  const items = [
    ['身份感', context.identity || 'Rider 不是只提交答案，而是在 Race 中形成 Agentic Engineer 身份。', 'green'],
    ['未来感', context.future || '过程记录支持接管、协同和下一轮复盘。', 'purple'],
    ['竞技感', context.racing || '用目标、Steering、验证和 Replay 构成可复盘赛道。', 'amber']
  ];
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">Ride Agents. Build the Future.</div><h2>${escapeHtml(context.heading || '像赛马一样驾驭 Coding Agent')}</h2><p class="muted">${escapeHtml(context.subtitle || 'AI 时代的开发者竞技场，智能体工程师的训练营。')}</p><div class="grid">${items.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function renderRacingStatus(context = {}) {
  const items = context.items || [
    ['历史整理', context.history || '本队历史已整理为回放记录。', 'green'],
    ['提交评测', context.submit || '提交后进入评测与解锁流程。', 'amber'],
    ['Records 解锁', context.records || '提交通过后开放 Records 与 Replay。', 'purple'],
    ['公开展示', context.publicShowcase || '公开页只展示等级、作品和公开评语。', 'gray']
  ];
  return `<section class="card" style="margin-top:12px"><h2>赛道状态</h2><div class="grid">${items.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function renderGenesisRidersLaunch(context = {}) {
  const items = context.items || [
    ['报名进入', context.signup || context.classroom || '课堂首发约 100 名学生，从这里进入本轮 GRS。', 'green'],
    ['组队骑行', context.riders || '学生以队伍身份成为第一批 ARY GRS 学生骑手。', 'purple'],
    ['提交复盘', context.action || '整理历史、提交评测，再进入 Records 与 Replay。', 'amber'],
    ['公开展示', context.publicShowcase || '公开页只展示作品、能力标签和公开评语。', 'gray']
  ];
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">Be the first riders.</div><h2>你们不是观众，是 Genesis Riders</h2><p class="muted">本次课堂首发，约 100 名学生将成为第一批 ARY GRS 的学生骑手。</p><div class="grid">${items.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

function renderRaceFlowBrief(context = {}) {
  const items = context.items || [
    ['Race Brief', context.brief || '理解本次挑战和要求，把 Race 目标写成可执行边界。', 'green', context.briefOutput || '产出：挑战边界与验收要求。'],
    ['Team Build', context.teamBuild || '完成组队，明确 1 coach + 4 到 5 riders 的协作关系。', 'purple', context.teamOutput || '产出：队伍角色与协作关系。'],
    ['工具准备', context.tools || '完成 Claude、DevCompass Racing 等工具准备，进入 ARY 执行空间。', 'amber', context.toolsOutput || '产出：可参赛工作环境。'],
    ['Riding Plan', context.plan || '制定骑行计划，完成方案与技术验证。', 'gray', context.planOutput || '产出：方案、任务拆解与验证路径。'],
    ['Co-Riding', context.coRiding || '与 Agent 协同推进任务，沉淀 Rider 动作和 Agent 工作。', 'green', context.coRidingOutput || '产出：协同过程与产物变化。'],
    ['Checkpoint', context.checkpoint || '中途检查方向、接受指导并完成纠偏。', 'red', context.checkpointOutput || '产出：方向检查与改进项。'],
    ['Submission', context.submission || '提交作品、文档与过程记录。', 'purple', context.submissionOutput || '产出：进入评测的交付材料。'],
    ['Review & Replay', context.review || '评审、复盘、展示与改进。', 'amber', context.reviewOutput || '产出：复盘发现与下一轮行动。']
  ];
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">DevCompass Racing for Agentic Development</div><h2>Race Flow：从组队到复盘</h2><p class="muted">你们不是只提交最后答案。你们要展示自己如何骑行智能体完成任务，完成方案与技术验证。</p><div class="grid">${items.map(([label, body, tone, output]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p>${output ? `<p class="muted">${escapeHtml(output)}</p>` : ''}</div>`).join('')}</div></section>`;
}

function renderRaceDeliverables(context = {}) {
  const items = context.items || [
    ['产品定义', context.productDefinition || '说明你理解的 ARY / GRS 001 方案。', 'green', context.productEvidence || '证据：Race 目标、问题定义与验收要求。'],
    ['系统设计', context.systemDesign || '说明 Organizer、ARY、DCR 与公开摘要之间的关系。', 'purple', context.systemEvidence || '证据：角色关系、资料归属与展示范围。'],
    ['技术验证', context.technicalValidation || '证明数据留在 Organizer 侧时，ARY 仍能创建、披露、组织、展示 Race。', 'amber', context.technicalEvidence || '证据：提交、评测、Records 与 Replay 闭环。'],
    ['方案展示', context.showcase || '让别人看懂你的方案如何工作。', 'gray', context.showcaseEvidence || '证据：队伍页面、组织方控制台和公开摘要。'],
    ['Riding Record', context.ridingRecord || '整理智能体协作过程记录。', 'green', context.ridingEvidence || '证据：目标、Steering、验证和回放事件。']
  ];
  const statusNote = context.statusNote || '先看过程摘要，再看最后作品；交付物用于说明目标、设计、验证、展示和 Riding Record 是否连成一次完整骑行。';
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">Race Deliverables</div><h2>你们需要交付什么？</h2><p class="muted">提交时要能说明目标、系统设计、技术验证、方案展示和 Riding Record 分别对应哪些证据。</p><p class="muted">${escapeHtml(statusNote)}</p><div class="grid">${items.map(([label, body, tone, evidence]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p><p class="muted">${escapeHtml(evidence)}</p></div>`).join('')}</div></section>`;
}

function radarPoint(index, total, radius, center = 140) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)];
}

function renderRadarChart(items = []) {
  const total = items.length || 1;
  const center = 140;
  const rings = [36, 60, 84, 108];
  const axis = items.map((item, index) => {
    const [x, y] = radarPoint(index, total, 108, center);
    const [lx, ly] = radarPoint(index, total, 126, center);
    return `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#d9dee8"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="800" fill="#344054">${escapeHtml(item.short || item.label)}</text>`;
  }).join('');
  const polygons = rings.map((radius) => `<polygon points="${items.map((_, index) => radarPoint(index, total, radius, center).map((value) => value.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#edf0f5"/>`).join('');
  const scorePoints = items.map((item, index) => radarPoint(index, total, 108 * Math.max(0, Math.min(5, Number(item.score || 0))) / 5, center).map((value) => value.toFixed(1)).join(',')).join(' ');
  const dots = items.map((item, index) => {
    const [x, y] = radarPoint(index, total, 108 * Math.max(0, Math.min(5, Number(item.score || 0))) / 5, center);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#2347d6"><title>${escapeHtml(item.label)}：${escapeHtml(item.score)}/5</title></circle>`;
  }).join('');
  return `<div class="radar-panel"><svg class="radar-svg" viewBox="0 0 280 280" role="img" aria-label="优秀作品七维评价雷达图"><rect width="280" height="280" rx="18" fill="#fff"/>${polygons}${axis}<polygon points="${scorePoints}" fill="rgba(35,71,214,.18)" stroke="#2347d6" stroke-width="2"/>${dots}</svg><ul class="radar-legend muted">${items.map((item) => `<li><span>${escapeHtml(item.label)}</span><span class="radar-score">${escapeHtml(item.score)}/5</span></li>`).join('')}</ul></div>`;
}

function renderExcellentWorkEvaluation(context = {}) {
  const items = context.items || [
    ['问题定义', context.problem || '问题定义是否清楚。', 'green', context.problemEvidence || '证据：目标、边界和验收要求。'],
    ['产品逻辑', context.productLogic || '产品逻辑是否成立。', 'purple', context.productEvidence || '证据：Race Flow、交付物和用户路径。'],
    ['数据主权', context.dataSovereignty || '去中心化数据主权是否被真正理解。', 'amber', context.dataEvidence || '证据：Organizer 侧存留、队伍可见范围和公开摘要。'],
    ['关键假设验证', context.validation || '关键假设是否完成技术验证。', 'gray', context.validationEvidence || '证据：提交、评测、Records 与 Replay 闭环。'],
    ['架构边界', context.architecture || '架构边界是否清晰。', 'red', context.architectureEvidence || '证据：角色边界、资料边界和展示范围。'],
    ['展示可理解', context.showcase || '展示是否让别人看得懂。', 'green', context.showcaseEvidence || '证据：队伍页面、组织方控制台和公开展示摘要。'],
    ['协作可复盘', context.collaboration || '与 Agent 的协作过程是否可追踪、可解释、可复盘。', 'purple', context.collaborationEvidence || '证据：Rider 动作、Steering、验证和回放事件。']
  ];
  const judgingNote = context.judgingNote || '每一维都先看对应证据，再判断是否清楚、成立、可验证和可复盘。';
  const radarItems = items.map(([label], index) => ({ label, short: label.slice(0, 4), score: context.scores?.[label] ?? [4, 4, 3, 4, 3, 4, 5][index] ?? 3 }));
  const evidenceGrid = `<div class="grid">${items.map(([label, body, tone, evidence]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p><p class="muted">${escapeHtml(evidence)}</p></div>`).join('')}</div>`;
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">优秀作品评价</div><h2>我们如何看待优秀作品？</h2><p class="muted">从 7 个维度综合评估，寻找真正具备价值、可落地、可演进的智能体作品。我们不只看你做出了什么，也看你如何骑行智能体把它做出来。</p><p class="muted">${escapeHtml(judgingNote)}</p>${renderRadarChart(radarItems)}${renderDisclosure('查看七维证据', '展开后查看每一维对应的判断依据。', evidenceGrid)}</section>`;
}

function renderReadyToRide(context = {}) {
  const items = context.items || [
    ['确认身份', context.identity || '从软件工程师进入智能体工程师训练场。', 'green'],
    ['开始本轮 Race', context.start || '第一场 Race 从课堂开始，进入队伍空间完成真实任务。', 'purple'],
    ['完成骑行闭环', context.loop || '按 Race Flow 整理过程、提交材料并进入复盘。', 'amber'],
    ['沉淀下一步', context.next || '用 Records、Replay 和公开摘要沉淀下一轮成长方向。', 'gray']
  ];
  const actionNote = context.actionNote || '现在可以开始本轮 Race：先确认身份，再进入任务、提交材料、复盘改进。';
  return `<section class="card" style="margin-top:12px"><div class="eyebrow">Ready to Ride?</div><h2>Ride Agents. Build the Future.</h2><p class="muted">ARY GRS 的第一场 Race 从这间课堂开始。你们将是第一批 Genesis Riders，完成从软件工程师到智能体工程师的第一次骑行闭环。</p><p class="muted">${escapeHtml(actionNote)}</p><div class="grid">${items.map(([label, body, tone]) => `<div class="card"><span class="pill ${toneClass(tone)}">${escapeHtml(label)}</span><p class="muted">${escapeHtml(body)}</p></div>`).join('')}</div></section>`;
}

async function renderTeamHistory(session) {
  const sessions = teamOnly(await readJson(riderSessionsPath), session);
  const records = teamOnly(await readJson(recordsPath), session);
  const recordTitles = new Map(records.map((record) => [record.recordId, record.title]));
  const rows = sessions.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.sourceTool)}</td><td>${escapeHtml(item.workspaceLabel)}</td><td><span class="pill green">${escapeHtml(item.status)}</span></td><td>${escapeHtml(recordTitles.get(item.recordId) || '待整理')}</td><td><a class="button secondary" href="/team/history/${encodeURIComponent(item.sessionId)}">查看</a></td></tr>`).join('');
  return page('历史', '/team/history', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Rider History</div><h1>${escapeHtml(session.displayName)} 的历史素材</h1><p>本队从本地素材中整理出的回放记录。</p></div><aside class="hero-side"><h2>整理进度</h2><p class="muted">回放记录：${sessions.length}</p><p class="muted">完整历史保留在 Rider 本地。</p></aside></section><section class="card"><h2>Session 列表</h2><table><thead><tr><th>标题</th><th>来源</th><th>工作区</th><th>状态</th><th>关联 Record</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

async function renderTeamSessionDetail(session, sessionId) {
  const sessions = teamOnly(await readJson(riderSessionsPath), session);
  const records = teamOnly(await readJson(recordsPath), session);
  const events = await readJson(eventsPath);
  const item = sessions.find((sessionItem) => sessionItem.sessionId === sessionId);
  if (!item) return page('未找到', '/team/history', session, '<div class="notice danger">未找到可查看的历史记录。</div>');
  const record = records.find((recordItem) => recordItem.recordId === item.recordId);
  const eventRows = renderEventRows(events.filter((event) => event.sourceSessionId === item.sessionId && event.recordId === item.recordId));
  const sessionEvents = events.filter((event) => event.sourceSessionId === item.sessionId && event.recordId === item.recordId);
  const fixCount = sessionEvents.filter((event) => event.type === 'fix').length;
  const validationCount = sessionEvents.filter((event) => event.type === 'validation' || event.validation).length;
  return page(item.title, '/team/history', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Session Review</div><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.objectiveSummary)}</p><div class="cta-row"><a class="button secondary" href="/team/history">返回历史</a>${record ? `<a class="button secondary" href="/team/records/${encodeURIComponent(record.recordId)}">查看 Record</a>` : ''}</div></div><aside class="hero-side"><h2>整理状态</h2><p class="muted">来源：${escapeHtml(item.sourceTool)}</p><p class="muted">事件数：${sessionEvents.length}</p><p class="muted">修复节点：${fixCount}</p><p class="muted">验证节点：${validationCount}</p><p class="muted">完整历史保留在 Rider 本地。</p></aside></section><section class="grid"><div class="card"><span class="pill green">目标</span><h2>本轮目标</h2><p class="muted">${escapeHtml(item.objectiveSummary)}</p></div><div class="card"><span class="pill amber">Rider 约束</span><h2>约束</h2>${listItems(item.constraints)}</div><div class="card"><span class="pill gray">不做事项</span><h2>边界</h2>${listItems(item.nonGoals)}</div><div class="card"><span class="pill purple">验证</span><h2>验收摘要</h2><p class="muted">${escapeHtml(item.acceptanceSummary)}</p><p class="muted">${escapeHtml(item.validationSummary)}</p></div></section><section class="card" style="margin-top:16px"><h2>软件搭建过程</h2>${renderBuildTimeline(item.buildTimeline)}</section><section class="card" style="margin-top:16px"><h2>关键 Steering 与验证证据</h2><table><thead><tr><th>#</th><th>阶段</th><th>角色</th><th>类型</th><th>节点</th><th>改动范围</th><th>可见变化</th><th>验证</th><th>Rider 意图</th></tr></thead><tbody>${eventRows}</tbody></table></section>`);
}

async function renderTeamDashboard(session, unlocked = false) {
  const races = await readJson(racesPath);
  const submissions = teamOnly(await readJson(submissionsPath), session);
  const records = teamOnly(await readJson(recordsPath), session);
  const riderSessions = teamOnly(await readJson(riderSessionsPath), session);
  const events = await readJson(eventsPath);
  const race = races[0];
  const buildCount = countBuildSteps(riderSessions);
  const openedRecordCount = unlocked ? records.length : 0;
  const openedEventCount = unlocked ? countRecordEvents(events, records) : 0;
  const statusText = unlocked ? '已提交，Records 和回放已开放。' : '还没有提交，Records 和回放暂不开放。';
  const primaryActions = unlocked
    ? [
      { label: '下一步', title: '查看本队回放', body: '从阶段、Steering、修复和验证回看本轮过程。', href: '/team/replay', primary: true },
      { label: '作品资产', title: '进入 Records', body: '查看本队已开放的 Riding Records。', href: '/team/records' },
      { label: '公开展示', title: '查看公开榜单', body: '只看公开摘要和公开评语。', href: '/leaderboard' }
    ]
    : [
      { label: '下一步', title: '提交参赛内容', body: '完成提交后再开放 Records 和回放。', href: '/team/submit', primary: true },
      { label: '准备', title: '查看历史素材', body: '先核对目标、Steering 和验证摘要。', href: '/team/history' },
      { label: '指南', title: '打开 Race 指南', body: '查看流程、交付物和开始动作。', href: '/team/race' }
    ];
  const metrics = renderMetricStrip([
    { label: '状态', value: unlocked ? '已开放' : '待提交', caption: statusText, tone: unlocked ? 'green' : 'amber' },
    { label: 'History', value: riderSessions.length, caption: `${buildCount} 个搭建节点已整理`, tone: 'purple' },
    { label: 'Records', value: openedRecordCount, caption: unlocked ? '本队 Records 可查看' : '提交后开放', tone: 'gray' },
    { label: 'Replay', value: openedEventCount, caption: unlocked ? '回放事件已开放' : '提交后开放', tone: 'gray' }
  ]);
  const nested = renderNestedEntrypoints([
    { label: 'Race', title: 'Race 指南', body: '确认流程、交付物和开始动作。', href: '/team/race' },
    { label: 'Self check', title: '提交前自查', body: '检查评价维度、训练项和复盘路径。', href: '/team/evaluation' },
    { label: 'History', title: '历史素材', body: '查看本队整理出的过程素材。', href: '/team/history' },
    { label: unlocked ? 'Replay' : 'Submit', title: unlocked ? '进入回放' : '提交参赛内容', body: unlocked ? '复盘本轮过程。' : '完成本轮提交。', href: unlocked ? '/team/replay' : '/team/submit' }
  ]);
  const reminder = renderDisclosure('资料范围提醒', '完整历史保留在 Rider 本地。', '<p class="muted">ARY 接收整理后的回放记录；公开榜单只展示队伍、等级、项目作品和公开评语。</p>');
  return page('队伍驾驶舱', '/team', session, `<section class="dashboard"><div class="priority-panel"><div class="eyebrow">Team cockpit</div><h1>${escapeHtml(session.displayName)} 的驾驶舱</h1><p class="muted">${escapeHtml(race.summary)}</p>${metrics}${renderActionList(primaryActions)}</div><aside class="side-stack"><div class="nested-panel"><span class="pill ${unlocked ? 'green' : 'amber'}">当前状态</span><h2>${unlocked ? '可以复盘' : '准备提交'}</h2><p class="muted">${statusText}</p></div><div class="nested-panel"><span class="pill purple">本队素材</span><h2>${buildCount} 个搭建节点</h2><p class="muted">目标、Steering、Agent 工作和验证摘要已整理到历史页。</p></div><div class="nested-panel"><span class="pill gray">公开展示</span><h2>只看公开摘要</h2><p class="muted">公开榜单只展示队伍、等级、项目作品和公开评语。</p></div></aside></section>${nested}${reminder}`);
}

async function renderTeamRaceGuide(session, unlocked = false) {
  const races = await readJson(racesPath);
  const submissions = teamOnly(await readJson(submissionsPath), session);
  const records = teamOnly(await readJson(recordsPath), session);
  const riderSessions = teamOnly(await readJson(riderSessionsPath), session);
  const events = await readJson(eventsPath);
  const race = races[0];
  const firstSession = riderSessions[0];
  const firstRecord = records[0];
  const eventCount = countRecordEvents(events, records);
  const raceFlow = renderRaceFlowBrief({
    brief: `${race.title}：${race.summary}`,
    teamBuild: `${session.displayName} 已进入队伍空间，按队伍协同完成本轮 Race。`,
    tools: `${riderSessions.length} 条 DevCompass Racing 历史记录已整理为本队素材。`,
    plan: firstSession?.objectiveSummary || '先把目标、边界和验收条件写成骑行计划。',
    coRiding: `${countBuildSteps(riderSessions)} 个搭建节点记录 Rider 动作、Agent 工作和产物变化。`,
    checkpoint: firstSession?.validationSummary || '用验证节点检查方向并完成纠偏。',
    submission: unlocked ? `${submissions.length} 次提交已完成，作品与过程记录进入评测。` : '下一步提交作品、文档与过程记录。',
    review: unlocked ? `${records.length} 份 Records 与 ${eventCount} 个回放事件已开放。` : '提交通过后进入 Review & Replay。'
  });
  const deliverables = renderRaceDeliverables({
    statusNote: unlocked ? '提交后先看过程摘要，再进入 Records 与 Replay 核对交付质量。' : '提交前先看过程摘要，再提交作品、文档与过程记录。',
    productDefinition: firstSession?.objectiveSummary || race.summary,
    productEvidence: `证据：${race.title} 的目标、边界与验收要求。`,
    systemDesign: '说明 Organizer、ARY、DCR 与公开摘要之间的关系。',
    systemEvidence: '证据：本队可见范围、公开摘要和原始资料归属。',
    technicalValidation: unlocked ? '本队已通过提交评测，Records 与 Replay 已开放。' : '提交后验证创建、披露、组织、展示闭环。',
    technicalEvidence: unlocked ? `证据：${submissions.length} 次提交、${records.length} 份 Records、${eventCount} 个回放事件。` : '证据：提交后生成评测结果、Records 与 Replay。',
    showcase: '通过队伍驾驶舱、Records 和 Replay 说明方案如何工作。',
    showcaseEvidence: unlocked ? '证据：本队可进入 Records 与 Replay 查看完整过程。' : '证据：提交前先检查历史、计划和验证摘要。',
    ridingRecord: unlocked && firstRecord ? firstRecord.title : '整理本队智能体协作过程记录。',
    ridingEvidence: unlocked ? `${countBuildSteps(riderSessions)} 个搭建节点和 ${eventCount} 个回放事件支撑评估。` : `${countBuildSteps(riderSessions)} 个搭建节点支撑提交前检查，提交后生成回放事件。`
  });
  const readyToRide = renderReadyToRide({
    actionNote: unlocked ? '现在可以开始本轮复盘：进入 Records 与 Replay，把公开评语转成下一次行动。' : '现在可以开始本轮 Race：整理历史、检查交付物并提交参赛内容。',
    identity: `${session.displayName} 以 Genesis Riders 身份进入本轮 Race。`,
    start: `${race.title} 已在队伍空间打开。`,
    loop: unlocked ? '本队已完成提交，下一步进入 Records 与 Replay。' : '下一步整理历史、检查交付物并提交参赛内容。',
    next: unlocked ? '用回放和公开评语沉淀下一轮成长方向。' : '提交通过后再沉淀 Records、Replay 和公开摘要。'
  });
  const genesisLaunch = renderGenesisRidersLaunch({
    signup: '课堂首发队伍从这里进入真实 Race，而不是旁观赛事说明。',
    riders: `${session.displayName} 已进入 Genesis Riders 队伍空间。`,
    action: unlocked ? '下一步进入 Records 与 Replay，复盘本队 Riding 过程。' : '下一步整理历史并提交参赛内容，完成第一次 Riding 闭环。',
    publicShowcase: '公开展示只呈现公开摘要，不展示完整过程。'
  });
  const nextHref = unlocked ? '/team/replay' : '/team/submit';
  return page('Race 指南', '/team/race', session, `<section class="priority-panel" style="margin-bottom:14px"><div class="eyebrow">Race guide</div><h1>本轮 Race 怎么参加</h1><p class="muted">按顺序完成历史整理、交付物检查和参赛提交。</p>${renderMetricStrip([{ label: 'History', value: riderSessions.length, caption: '已整理历史', tone: 'purple' }, { label: 'Build', value: countBuildSteps(riderSessions), caption: '搭建节点', tone: 'green' }, { label: 'Status', value: unlocked ? '已提交' : '待提交', caption: unlocked ? '进入复盘' : '准备提交', tone: unlocked ? 'green' : 'amber' }])}${renderActionList([{ label: '下一步', title: unlocked ? '查看回放' : '提交参赛内容', body: unlocked ? '用回放完成复盘。' : '提交后开放 Records 与回放。', href: nextHref, primary: true }, { label: '历史', title: '查看本队素材', body: '确认目标、搭建过程、纠偏和验证。', href: '/team/history' }, { label: '自查', title: '进入提交前自查', body: '按评价维度检查作品和过程。', href: '/team/evaluation' }, { label: '驾驶舱', title: '返回队伍驾驶舱', body: '回到状态与下一步入口。', href: '/team' }])}</section><section class="section-shell"><div class="detail-heading"><div><div class="eyebrow">Race details</div><h2>参赛检查清单</h2></div><p class="muted">先完成最关键的检查项，再进入提交。</p></div>${renderDisclosure('Race Flow：从组队到复盘', '理解每个阶段和对应产出。', raceFlow)}${renderDisclosure('Race Deliverables', '检查产品定义、系统设计、技术验证、方案展示和 Riding Record。', deliverables)}${renderDisclosure('Ready to Ride?', '确认身份、开始 Race、完成闭环并沉淀下一步。', readyToRide)}${renderDisclosure('课堂首发与 Genesis Riders', '查看本轮 Race 的公开展示身份。', genesisLaunch)}</section>`);
}

async function renderTeamEvaluation(session, unlocked = false) {
  const races = await readJson(racesPath);
  const submissions = teamOnly(await readJson(submissionsPath), session);
  const records = teamOnly(await readJson(recordsPath), session);
  const riderSessions = teamOnly(await readJson(riderSessionsPath), session);
  const events = await readJson(eventsPath);
  const race = races[0];
  const firstSession = riderSessions[0];
  const eventCount = countRecordEvents(events, records);
  const excellentWork = renderExcellentWorkEvaluation({
    judgingNote: unlocked ? '提交后按 Records、Replay 和公开摘要逐项判断。' : '提交前先按历史、计划和验证摘要逐项判断。',
    problem: firstSession?.objectiveSummary || '问题定义来自本队 Race 目标。',
    problemEvidence: firstSession?.constraints?.[0] || '证据：目标、边界和验收要求。',
    productLogic: '产品逻辑通过 Race Flow 和交付物检查串联。',
    productEvidence: unlocked ? '证据：提交后 Records 与 Replay 已接上复盘路径。' : '证据：提交前先检查历史、计划和验证摘要。',
    dataSovereignty: '数据主权通过 Organizer 侧存留和公开摘要区分体现。',
    dataEvidence: '证据：本队只看到本队材料，公开页只展示公开摘要。',
    validation: unlocked ? '关键假设已通过提交评测和回放闭环验证。' : '关键假设将在提交后进入技术验证。',
    validationEvidence: unlocked ? `证据：${submissions.length} 次提交、${records.length} 份 Records。` : '证据：提交后生成评测结果、Records 与 Replay。',
    architecture: '架构边界体现在队伍、组织方和公开展示的访问范围。',
    architectureEvidence: '证据：队伍隔离、资料归属和公开展示范围。',
    showcase: '展示可理解性来自队伍驾驶舱、Records 和 Replay。',
    showcaseEvidence: '证据：从目标到过程摘要再到复盘入口。',
    collaboration: '协作过程需要可追踪、可解释、可复盘。',
    collaborationEvidence: unlocked ? `证据：${eventCount} 个回放事件。` : `${countBuildSteps(riderSessions)} 个搭建节点已整理。`
  });
  const guidanceEvidence = renderGuidanceEvidence({ session: firstSession, subtitle: '检查目标、拆解、技术判断和执行方向是否都有证据。' });
  const reviewReplay = renderReviewReplay({ session: firstSession, subtitle: unlocked ? '提交后可以进入 Records 和 Replay 做完整复盘。' : '提交前先在历史中检查计划、执行和验证。' });
  const skillTraining = renderAgentRidingSkillTraining({ session: firstSession, compact: true });
  return page('提交前自查', '/team/evaluation', session, `<section class="dashboard"><div class="priority-panel"><div class="eyebrow">Self check</div><h1>提交前自查</h1><p class="muted">按评价维度检查作品、过程证据和下一步行动。</p>${renderMetricStrip([{ label: 'Build', value: countBuildSteps(riderSessions), caption: '搭建节点', tone: 'green' }, { label: 'Replay', value: unlocked ? eventCount : 0, caption: unlocked ? '已开放事件' : '提交后开放', tone: 'purple' }, { label: 'Status', value: unlocked ? '复盘' : '自查', caption: unlocked ? '进入 Records 与回放' : '先补齐过程摘要', tone: unlocked ? 'green' : 'amber' }])}${renderActionList([{ label: '下一步', title: unlocked ? '查看 Records' : '去提交', body: unlocked ? '查看本队作品资产。' : '自查完成后提交参赛内容。', href: unlocked ? '/team/records' : '/team/submit', primary: true }, { label: 'Race', title: '返回 Race 指南', body: '查看流程和交付物。', href: '/team/race' }, { label: '驾驶舱', title: '返回驾驶舱', body: '回到状态和下一步入口。', href: '/team' }])}</div><aside class="side-stack"><div class="nested-panel"><span class="pill purple">当前重点</span><h2>先补齐过程摘要</h2><p class="muted">确认目标、计划、纠偏、验证和公开摘要都能说清楚。</p><a class="button secondary" href="/team/history">查看历史</a></div><div class="nested-panel"><span class="pill amber">复盘证据</span><h2>${unlocked ? `${eventCount} 个事件已开放` : '提交后开放'}</h2><p class="muted">${unlocked ? '用 Replay 回看本轮 Steering、修复和验证。' : '提交通过后再查看 Records 与 Replay。'}</p><a class="button secondary" href="${unlocked ? '/team/replay' : '/team/submit'}">${unlocked ? '查看回放' : '去提交'}</a></div></aside></section><section class="section-shell"><div class="detail-heading"><div><div class="eyebrow">Evaluation details</div><h2>自查项</h2></div><p class="muted">逐项确认是否具备可评审证据。</p></div>${renderDisclosure('优秀作品七维评价', '按 7 个维度逐项判断。', excellentWork, true)}${renderDisclosure('Agent Riding Skill 训练证据', '查看目标设定、技术判断、任务拆解、架构理解、过程观察和方向干预。', skillTraining)}${renderDisclosure('指导证据', '查看目标、拆解、技术判断和执行方向。', guidanceEvidence)}${renderDisclosure('Review & Replay 复盘路径', '从计划、执行、检查、复盘到提升。', reviewReplay)}</section>`);
}

async function renderTeamSubmit(session, result = null) {
  const resultBlock = !result
    ? `<div class="card"><span class="pill gray">等待提交</span><h2>还没有评测结果</h2><p class="muted">提交后，系统会返回本次评测状态。</p></div>`
    : result.status === 'available'
      ? `<div class="card"><span class="pill green">评测完成</span><h2>${escapeHtml(result.resultText)}</h2><p class="muted">${escapeHtml(result.resultSummary)}</p><p class="muted">分数：${escapeHtml(result.score)}</p></div>`
      : `<div class="card"><span class="pill red">暂时不可用</span><h2>${escapeHtml(result.resultText)}</h2><p class="muted">${escapeHtml(result.resultSummary)}</p></div>`;
  return page('提交', '/team/submit', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Submit</div><h1>提交本队参赛内容</h1><p>提交完成后，本队 Records 和 Replay 会开放。</p></div><aside class="hero-side"><h2>状态</h2><p class="muted">等待提交</p></aside></section><section class="grid"><form class="card" method="post" action="/team/submit"><span class="pill amber">Submission</span><h2>本队提交</h2><textarea name="answer" rows="4">满分答案</textarea><button class="button" type="submit">提交并评测</button></form>${resultBlock}</section>`);
}

function lockedTeamContent(session) {
  return page('提交后查看', '/team/submit', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Submit Required</div><h1>请先提交参赛内容</h1><p>Records、详情和回放会在本队提交后开放。</p><div class="cta-row"><a class="button secondary" href="/team/submit">去提交</a></div></div><aside class="hero-side"><h2>当前状态</h2><p class="muted">还没有提交记录。</p></aside></section>`);
}

async function renderTeamRecords(session, unlocked = false) {
  if (!unlocked) return lockedTeamContent(session);
  const records = teamOnly(await readJson(recordsPath), session);
  const cards = records.map((record) => `<article class="card"><span class="pill purple">Riding Record</span><h2>${escapeHtml(record.title)}</h2><p class="muted">${escapeHtml(record.summary)}</p><p class="muted">来自本队历史整理。</p><div class="cta-row"><a class="button" href="/team/records/${encodeURIComponent(record.recordId)}">查看详情</a><a class="button secondary" href="/team/replay">查看回放</a></div></article>`).join('');
  return page('Records', '/team/records', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Records</div><h1>${escapeHtml(session.displayName)} 的 Riding Records</h1><p>这里展示本队可查看的过程记录。</p></div><aside class="hero-side"><h2>记录数量</h2><p class="muted">${records.length}</p><p class="muted">详情页查看评价关注点和过程摘要。</p></aside></section><section class="grid" style="margin-top:12px">${cards}</section>`);
}

async function renderTeamRecordDetail(session, recordId, unlocked = false) {
  if (!unlocked) return lockedTeamContent(session);
  const records = teamOnly(await readJson(recordsPath), session);
  const riderSessions = teamOnly(await readJson(riderSessionsPath), session);
  const events = await readJson(eventsPath);
  const record = records.find((item) => item.recordId === recordId);
  if (!record) return page('未找到', '/team/records', session, '<div class="notice danger">未找到可查看的 Record。</div>');
  const recordEvents = filterTeamEvents(events, records, riderSessions).filter((event) => event.recordId === record.recordId);
  const sourceSession = riderSessions.find((item) => item.recordId === record.recordId);
  const rows = renderEventRows(recordEvents);
  return page(record.title, '/team/records', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Record Detail</div><h1>${escapeHtml(record.title)}</h1><p>${escapeHtml(record.summary)}</p><div class="cta-row"><a class="button secondary" href="/team/replay">查看回放</a><a class="button secondary" href="/team/records">返回 Records</a></div></div><aside class="hero-side"><h2>评价关注点</h2><p class="muted">${record.dimensions.map(escapeHtml).join('、')}</p></aside></section><section class="card" style="margin-top:12px"><h2>过程摘要</h2><table><thead><tr><th>#</th><th>阶段</th><th>角色</th><th>类型</th><th>节点</th><th>改动范围</th><th>可见变化</th><th>验证</th><th>Rider 意图</th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

async function renderTeamSubmissions(session) {
  const submissions = teamOnly(await readJson(submissionsPath), session);
  const rows = submissions.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.score)}</td><td>${escapeHtml(item.publicSummary)}</td></tr>`).join('');
  return page('我的提交', '/team/submissions', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">My Submissions</div><h1>${escapeHtml(session.displayName)} 的提交</h1><p>这里展示本队提交、评价状态和结果摘要。</p></div><aside class="hero-side"><h2>访问范围</h2><p class="muted">其他队伍的提交不会出现在这里。</p></aside></section><section class="card"><table><thead><tr><th>提交</th><th>状态</th><th>分数</th><th>摘要</th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

async function renderTeamReplay(session, unlocked = false) {
  if (!unlocked) return lockedTeamContent(session);
  const records = teamOnly(await readJson(recordsPath), session);
  const riderSessions = teamOnly(await readJson(riderSessionsPath), session);
  const allEvents = await readJson(eventsPath);
  const events = filterTeamEvents(allEvents, records, riderSessions);
  const groupedReplay = renderGroupedReplay(events);
  return page('我的回放', '/team/replay', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Replay</div><h1>${escapeHtml(session.displayName)} 的 Riding 回放</h1><p>按阶段复盘本队目标、Rider Steering、Agent 改动、失败修复和验证证据。</p></div><aside class="hero-side"><h2>回放内容</h2><p class="muted">事件数：${events.length}</p><p class="muted">阶段数：${groupByPhase(events).length}</p><p class="muted">完整历史保留在 Rider 本地。</p></aside></section><section class="timeline" style="margin-top:12px">${groupedReplay}</section>`);
}

async function renderOrganizerDashboard(session) {
  const races = await readJson(racesPath);
  const teams = await readJson(teamsPath);
  const submissions = await readJson(submissionsPath);
  const records = await readJson(recordsPath);
  const riderSessions = await readJson(riderSessionsPath);
  const events = await readJson(eventsPath);
  const evaluatorService = await readEvaluatorService();
  const evaluatorAction = evaluatorService.enabled ? 'off' : 'on';
  const evaluatorControl = `<div class="nested-panel"><span class="pill ${evaluatorService.enabled ? 'green' : 'red'}">评测服务</span><h2>${evaluatorService.enabled ? '已开启' : '已关闭'}</h2><p class="muted">数据存储位置: ${escapeHtml(evaluatorService.storageLocation)}</p><form method="post" action="/organizer/evaluator"><input type="hidden" name="enabled" value="${escapeHtml(evaluatorAction)}"><button class="button secondary" type="submit">${evaluatorService.enabled ? '关闭评测服务' : '开启评测服务'}</button></form></div>`;
  const rows = submissions.map((item) => `<tr><td>${escapeHtml(item.teamId)}</td><td>${escapeHtml(item.title)}</td><td><span class="pill green">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.score)}</td><td>${escapeHtml(item.publicSummary)}</td></tr>`).join('');
  const metrics = renderMetricStrip([
    { label: 'Teams', value: teams.length, caption: '参赛队伍', tone: 'purple' },
    { label: 'Submissions', value: submissions.length, caption: '已进入评测流程', tone: 'green' },
    { label: 'Records', value: records.length, caption: '已整理作品资产', tone: 'amber' },
    { label: 'Replay', value: events.length, caption: '回放事件由详情页承载', tone: 'gray' }
  ]);
  const actions = renderActionList([
    { label: '下一步', title: '查看 Race 管理', body: '进入流程、交付物和资料范围管理页。', href: '/organizer/race', primary: true },
    { label: '评价', title: '进入评价工作台', body: '查看评价维度、作品检查和过程复盘入口。', href: '/organizer/evaluation' },
    { label: '公开', title: '查看公开榜单', body: '确认公开摘要的展示效果。', href: '/leaderboard' }
  ]);
  const nested = renderNestedEntrypoints([
    { label: 'Race', title: 'Race 管理', body: '检查赛事流程、交付物和资料范围。', href: '/organizer/race' },
    { label: 'Evaluation', title: '评价工作台', body: '检查评价维度与复盘证据。', href: '/organizer/evaluation' },
    { label: 'Public', title: '公开榜单', body: '检查公开摘要与公开评语。', href: '/leaderboard' }
  ]);
  return page('组织方总览', '/organizer', session, `<section class="dashboard"><div class="priority-panel"><div class="eyebrow">Organizer overview</div><h1>${escapeHtml(races[0].title)}</h1><p class="muted">赛事进展、队伍提交和公开展示入口集中在这里。</p>${metrics}${actions}</div><aside class="side-stack"><div class="nested-panel"><span class="pill green">当前赛事</span><h2>${escapeHtml(races[0].status)}</h2><p class="muted">当前组织 ${teams.length} 支队伍，已有 ${submissions.length} 次提交。</p></div>${evaluatorControl}<div class="nested-panel"><span class="pill purple">待查看</span><h2>队伍提交</h2><p class="muted">先看队伍与状态，再进入评价工作台查看细节。</p></div><div class="nested-panel"><span class="pill gray">公开展示</span><h2>榜单摘要</h2><p class="muted">公开页只展示等级、项目作品、能力标签和公开评语。</p></div></aside></section>${nested}<section class="section-shell"><div class="detail-heading"><div><div class="eyebrow">Submissions</div><h2>队伍提交</h2></div><p class="muted">只保留组织方当前要处理的队伍状态。</p></div><table><thead><tr><th>队伍</th><th>提交</th><th>状态</th><th>分数</th><th>摘要</th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

async function renderOrganizerRaceGuide(session) {
  const races = await readJson(racesPath);
  const teams = await readJson(teamsPath);
  const submissions = await readJson(submissionsPath);
  const records = await readJson(recordsPath);
  const riderSessions = await readJson(riderSessionsPath);
  const events = await readJson(eventsPath);
  const custodyPolicy = await readJson(join(organizerDir, 'data_boundary_policy.json'));
  const raceFlow = renderRaceFlowBrief({
    brief: `${races[0].title} 当前状态：${races[0].status}。`,
    teamBuild: `当前组织 ${teams.length} 支队伍进入 Race。`,
    tools: `${riderSessions.length} 条 Rider 历史用于检查工具准备和素材整理。`,
    plan: `${countBuildSteps(riderSessions)} 个搭建节点用于观察计划是否可执行。`,
    coRiding: `${events.length} 个回放事件呈现 Rider 与 Agent 协同。`,
    checkpoint: '组织方在目标、Steering、验证和公开范围上做中途检查。',
    submission: `${submissions.length} 次提交进入作品、文档与过程记录评测。`,
    review: `${records.length} 份 Records 支持 Review & Replay。`
  });
  const deliverables = renderRaceDeliverables({
    statusNote: '组织方先看过程摘要，再评估交付质量、公开范围和复盘价值。',
    productDefinition: `${races[0].title} 的产品定义来自 Race 目标与关键问题。`,
    productEvidence: `证据：${races.length} 场 Race、${teams.length} 支队伍和公开规则。`,
    systemDesign: '说明 Organizer、ARY、DCR 与公开摘要之间的关系。',
    systemEvidence: `证据：${custodyPolicy.disclosedToTeams.length} 类队伍可见摘要和 ${custodyPolicy.disclosedToPublicLeaderboard.length} 类公开摘要。`,
    technicalValidation: '证明 Race 数据留在 Organizer 侧时，ARY 仍能创建、披露、组织、展示 Race。',
    technicalEvidence: `证据：${submissions.length} 次提交、${records.length} 份 Records、${events.length} 个回放事件。`,
    showcase: '通过组织方总览、队伍空间和公开摘要说明方案如何工作。',
    showcaseEvidence: '证据：总览看组织状态，队伍空间看本队过程，公开页看公开结果。',
    ridingRecord: 'Riding Record 用于评估智能体协作过程。',
    ridingEvidence: `证据：${riderSessions.length} 条历史、${countBuildSteps(riderSessions)} 个搭建节点和 ${events.length} 个回放事件。`
  });
  const grsDogfood = renderGrsDogfoodLoop({
    define: `${races[0].title} 围绕 ARY 的关键问题展开。`,
    design: '组织方把角色、队伍空间、评价维度和公开范围设计成 Race 流程。',
    build: `${teams.length} 支队伍、${countBuildSteps(riderSessions)} 个搭建节点共同构成 Yard 的建设过程。`,
    validate: `${submissions.length} 次提交、${records.length} 份 Records 和 ${events.length} 个回放事件用于验证 Yard。`
  });
  const genesisLaunch = renderGenesisRidersLaunch({
    signup: `课堂首发预计约 100 名学生，当前组织 ${teams.length} 支队伍。`,
    riders: '组织方把学生骑手按队伍组织进入 GRS。',
    action: `${submissions.length} 次提交进入评测流程。`,
    publicShowcase: '公开展示范围由组织方控制，只发布公开结果。'
  });
  const disclosureSource = renderPublicDisclosureSource({
    retained: `Organizer 持有 ${custodyPolicy.retainedData.length} 类原始赛事资料。`,
    minimal: '公开侧只承载 Race 状态、队伍空间、提交摘要和公开展示摘要。',
    operable: '创建、披露、组织、展示都已经落在当前总览与队伍页面。',
    publicSummary: `公开展示来自 ${custodyPolicy.disclosedToPublicLeaderboard.length} 类主动披露摘要。`
  });
  const operatingLoop = renderRaceOperatingLoop({
    create: `组织方创建 ${races[0].title}，设定 Race 目标与参赛队伍。`,
    disclose: '组织方决定向队伍披露任务、结果摘要和回放记录。',
    organize: `当前组织 ${teams.length} 支队伍、${submissions.length} 次提交和 ${records.length} 份 Records。`,
    run: '组织方评测服务可用时，队伍提交后才解锁 Records 与 Replay。',
    review: '多维评价检查目标、Steering、验证、回放和公开展示范围。',
    showcase: '公开榜单只发布等级、排名和公开评语。'
  });
  const custody = renderOrganizerCustody(custodyPolicy);
  const readyToRide = renderReadyToRide({
    actionNote: '现在可以开始组织本轮 Race：确认队伍、追踪提交、评审过程并准备复盘。',
    identity: `${teams.length} 支队伍以 Genesis Riders 身份进入课堂首赛。`,
    start: `${races[0].title} 从课堂开始，当前状态为 ${races[0].status}。`,
    loop: `${submissions.length} 次提交、${records.length} 份 Records 和 ${events.length} 个回放事件构成骑行闭环。`,
    next: '组织方继续用评价、复盘和公开摘要沉淀下一轮 Race。'
  });
  return page('Race 管理', '/organizer/race', session, `<section class="dashboard"><div class="priority-panel"><div class="eyebrow">Race management</div><h1>Race 管理</h1><p class="muted">检查流程、交付物、公开范围和组织闭环。</p>${renderMetricStrip([{ label: 'Teams', value: teams.length, caption: '进入 Race', tone: 'purple' }, { label: 'Submissions', value: submissions.length, caption: '进入评测', tone: 'green' }, { label: 'Records', value: records.length, caption: '可复盘作品', tone: 'amber' }])}${renderActionList([{ label: '下一步', title: '进入评价工作台', body: '查看评价维度和过程复盘证据。', href: '/organizer/evaluation', primary: true }, { label: '总览', title: '返回组织方总览', body: '回到赛事状态与队伍提交。', href: '/organizer' }, { label: '公开', title: '查看公开榜单', body: '检查公开摘要展示。', href: '/leaderboard' }])}</div><aside class="side-stack"><div class="nested-panel"><span class="pill green">Race Flow</span><h2>${teams.length} 支队伍进入 Race</h2><p class="muted">当前已有 ${submissions.length} 次提交进入评测。</p><a class="button secondary" href="/organizer/evaluation">查看评价</a></div><div class="nested-panel"><span class="pill amber">资料范围</span><h2>公开摘要最小化</h2><p class="muted">公开展示只发布等级、作品资产、能力标签和公开评语。</p><a class="button secondary" href="/leaderboard">查看榜单</a></div></aside></section><section class="section-shell"><div class="detail-heading"><div><div class="eyebrow">Race details</div><h2>组织检查项</h2></div><p class="muted">确认每个阶段都有可评审产出。</p></div>${renderDisclosure('Race Flow：从组队到复盘', '查看本轮组织流程和阶段产出。', raceFlow)}${renderDisclosure('Race Deliverables', '查看交付物检查口径。', deliverables)}${renderDisclosure('数据安全的 Race', '查看 Organizer 侧存留和公开摘要范围。', `${disclosureSource}${custody}`)}${renderDisclosure('训练场与竞技场闭环', '查看创建、披露、组织、运行、评审、展示。', operatingLoop)}${renderDisclosure('GRS 创世骑行系列赛', '查看课堂首发、Genesis Riders 和 Yard 建设闭环。', `${genesisLaunch}${grsDogfood}${readyToRide}`)}</section>`);
}

async function renderOrganizerEvaluation(session) {
  const races = await readJson(racesPath);
  const teams = await readJson(teamsPath);
  const submissions = await readJson(submissionsPath);
  const records = await readJson(recordsPath);
  const riderSessions = await readJson(riderSessionsPath);
  const events = await readJson(eventsPath);
  const policy = await readJson(evaluationPolicyPath);
  const custodyPolicy = await readJson(join(organizerDir, 'data_boundary_policy.json'));
  const dimensions = policy.map((item) => `<tr><td>${escapeHtml(item.dimension)}</td><td>${escapeHtml(item.question)}</td></tr>`).join('');
  const excellentWork = renderExcellentWorkEvaluation({
    judgingNote: '组织方按目标、交付、资料范围、验证闭环和回放证据逐项判断。',
    problem: '问题定义是否清楚，由 Race 目标、队伍提交和评价维度共同检查。',
    problemEvidence: `证据：${races.length} 场 Race 与 ${submissions.length} 次提交。`,
    productLogic: '产品逻辑是否成立，由创建、披露、组织、展示闭环检查。',
    productEvidence: '证据：组织方总览、队伍空间和公开摘要形成完整路径。',
    dataSovereignty: '去中心化数据主权是否被真正理解。',
    dataEvidence: `证据：${custodyPolicy.retainedData.length} 类原始资料由 Organizer 持有，公开侧只承载摘要。`,
    validation: '关键假设是否完成技术验证。',
    validationEvidence: `证据：${submissions.length} 次提交、${records.length} 份 Records、${events.length} 个回放事件。`,
    architecture: '架构边界是否清晰。',
    architectureEvidence: `证据：${custodyPolicy.disclosedToTeams.length} 类队伍可见摘要和 ${custodyPolicy.disclosedToPublicLeaderboard.length} 类公开摘要。`,
    showcase: '展示是否让别人看得懂。',
    showcaseEvidence: '证据：总览、队伍页面和公开页分别承担组织、复盘与展示。',
    collaboration: '与 Agent 的协作过程是否可追踪、可解释、可复盘。',
    collaborationEvidence: `证据：${riderSessions.length} 条历史、${countBuildSteps(riderSessions)} 个搭建节点和 ${events.length} 个回放事件。`
  });
  const rows = submissions.map((item) => `<tr><td>${escapeHtml(item.teamId)}</td><td>${escapeHtml(item.title)}</td><td><span class="pill green">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.score)}</td><td>${escapeHtml(item.publicSummary)}</td></tr>`).join('');
  return page('评价工作台', '/organizer/evaluation', session, `<section class="dashboard"><div class="priority-panel"><div class="eyebrow">Evaluation workspace</div><h1>评价工作台</h1><p class="muted">先看队伍提交，再按评价维度检查过程证据。</p>${renderMetricStrip([{ label: 'Dimensions', value: policy.length, caption: '评价维度', tone: 'purple' }, { label: 'Submissions', value: submissions.length, caption: '待查看提交', tone: 'green' }, { label: 'Evidence', value: events.length, caption: '回放事件', tone: 'amber' }])}${renderActionList([{ label: '下一步', title: '查看队伍提交', body: '先处理提交表中的队伍状态。', href: '#submissions', primary: true }, { label: 'Race', title: '返回 Race 管理', body: '查看流程和交付物。', href: '/organizer/race' }, { label: '总览', title: '返回组织方总览', body: '回到赛事状态。', href: '/organizer' }])}</div><aside class="side-stack"><div class="nested-panel"><span class="pill purple">多维评价</span><h2>${policy.length} 个检查问题</h2><p class="muted">用评价问题核对队伍目标、交付和复盘证据。</p></div><div class="nested-panel"><span class="pill amber">过程证据</span><h2>${events.length} 个回放事件</h2><p class="muted">从 Records 和 Replay 中查看队伍过程。</p></div></aside></section><section class="section-shell" id="submissions"><div class="detail-heading"><div><div class="eyebrow">Submissions</div><h2>队伍提交</h2></div><p class="muted">评价前先看队伍提交状态。</p></div><table><thead><tr><th>队伍</th><th>提交</th><th>状态</th><th>分数</th><th>摘要</th></tr></thead><tbody>${rows}</tbody></table></section><section class="section-shell" style="margin-top:12px"><div class="detail-heading"><div><div class="eyebrow">Evaluation details</div><h2>评价细节</h2></div><p class="muted">查看维度和七维评价。</p></div>${renderDisclosure('多维评价', '查看评价维度和对应问题。', `<table><thead><tr><th>维度</th><th>问题</th></tr></thead><tbody>${dimensions}</tbody></table>`)}${renderDisclosure('优秀作品七维评价', '按 7 个维度综合评估。', excellentWork)}</section>`);
}

async function renderLeaderboard(session) {
  const leaderboard = await readJson(leaderboardPath);
  const records = await readJson(recordsPath);
  const sessions = await readJson(riderSessionsPath);
  const events = await readJson(eventsPath);
  const custodyPolicy = await readJson(join(organizerDir, 'data_boundary_policy.json'));
  const rows = leaderboard.map((item) => {
    const record = records.find((recordItem) => recordItem.teamId === item.teamId) || {};
    const teamSessions = sessions.filter((sessionItem) => sessionItem.teamId === item.teamId);
    const teamEvents = filterTeamEvents(events, [record].filter((recordItem) => recordItem.recordId), teamSessions);
    const tags = capabilityTags(record, teamEvents).slice(0, 4).join('、');
    return `<tr><td>${escapeHtml(item.rank)}</td><td>${escapeHtml(item.teamId)}</td><td>${escapeHtml(item.scoreBand)}</td><td>${escapeHtml(record.title || '项目作品')}</td><td>${escapeHtml(tags)}</td><td>${escapeHtml(item.publicComment)}</td></tr>`;
  }).join('');
  return page('公开榜单', '/leaderboard', session, `<section class="hero"><div class="hero-main"><div class="eyebrow">Leaderboard</div><h1>赛事榜单</h1><p>榜单展示队伍名次、评价等级、项目作品、能力标签和公开评语。</p></div><aside class="hero-side"><h2>展示范围</h2><p class="muted">这里不展示队伍的详细过程记录。</p><p class="muted">公开内容来自 Organizer 主动披露的 ${custodyPolicy.disclosedToPublicLeaderboard.length} 类公开摘要。</p></aside></section><section class="card" style="margin-top:12px"><h2>公开展示页</h2><table><thead><tr><th>排名</th><th>队伍</th><th>等级</th><th>项目作品</th><th>能力标签</th><th>公开评语</th></tr></thead><tbody>${rows}</tbody></table></section>`);
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

async function handleApiTeamReplay(res, req, session) {
  if (!isTeam(session)) return jsonResponse(res, 403, { error: '只有队伍可以查看本队回放' });
  if (!hasTeamSubmission(req, session)) return jsonResponse(res, 403, { error: '请先提交参赛内容' });
  const records = teamOnly(await readJson(recordsPath), session);
  const riderSessions = teamOnly(await readJson(riderSessionsPath), session);
  const events = filterTeamEvents(await readJson(eventsPath), records, riderSessions);
  return jsonResponse(res, 200, events);
}

async function handleApiTeamHistory(res, session) {
  if (!isTeam(session)) return jsonResponse(res, 403, { error: '只有队伍可以查看本队历史' });
  return jsonResponse(res, 200, teamOnly(await readJson(riderSessionsPath), session));
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
      if (req.method === 'GET' && url.pathname === '/logout') {
        const cookies = ['ary_v2_session=; Path=/; Max-Age=0; SameSite=Lax'];
        if (isTeam(session)) cookies.push(`ary_v2_submitted_${session.teamId}=; Path=/; Max-Age=0; SameSite=Lax`);
        return redirect(res, '/login', { 'set-cookie': cookies });
      }

      if (url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/me') return handleApiMe(res, session);
        if (!session) return jsonResponse(res, 401, { error: '未登录' });
        if (url.pathname === '/api/my-submissions') return handleApiMySubmissions(res, session);
        if (url.pathname.startsWith('/api/submissions/')) return handleApiSubmission(res, session, decodeURIComponent(url.pathname.split('/')[3] || ''));
        if (url.pathname === '/api/team-replay') return handleApiTeamReplay(res, req, session);
        if (url.pathname === '/api/team-history') return handleApiTeamHistory(res, session);
        return jsonResponse(res, 404, { error: '未找到接口' });
      }

      if (requireLogin(res, session)) return;

      if (req.method === 'GET' && url.pathname === '/organizer') {
        if (requireOrganizer(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderOrganizerDashboard(session));
      }
      if (req.method === 'POST' && url.pathname === '/organizer/evaluator') {
        if (requireOrganizer(res, session)) return;
        const body = await readBody(req);
        await writeEvaluatorService(body.enabled === 'on');
        return redirect(res, '/organizer');
      }
      if (req.method === 'GET' && url.pathname === '/organizer/race') {
        if (requireOrganizer(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderOrganizerRaceGuide(session));
      }
      if (req.method === 'GET' && url.pathname === '/organizer/evaluation') {
        if (requireOrganizer(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderOrganizerEvaluation(session));
      }
      if (req.method === 'GET' && url.pathname === '/team') {
        if (requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamDashboard(session, hasTeamSubmission(req, session)));
      }
      if (req.method === 'GET' && url.pathname === '/team/race') {
        if (requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamRaceGuide(session, hasTeamSubmission(req, session)));
      }
      if (req.method === 'GET' && url.pathname === '/team/evaluation') {
        if (requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamEvaluation(session, hasTeamSubmission(req, session)));
      }
      if (req.method === 'GET' && url.pathname === '/team/history') {
        if (requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamHistory(session));
      }
      if (req.method === 'GET' && url.pathname.startsWith('/team/history/')) {
        if (requireTeam(res, session)) return;
        const sessionId = decodeURIComponent(url.pathname.split('/')[3] || '');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderTeamSessionDetail(session, sessionId));
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
