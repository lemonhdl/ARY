import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { jsonResponse, organizerDir, protectedStoreDir, publicStoreDir, readBody, readJson, rootDir, writeJson } from './storage.js';

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

const raceStates = {
  draft: { label: '未披露', tone: 'purple', publicLabel: '准备中', body: '等待 Organizer 披露公开信息。' },
  open: { label: '开放', tone: 'green', publicLabel: '可以参与', body: '可提交方案并等待评测。' },
  paused: { label: '暂停', tone: 'amber', publicLabel: '暂缓评测', body: 'Race 保持可见，评测暂不可用。' },
  expired: { label: '待更新', tone: 'amber', publicLabel: '等待更新', body: '公开信息需要 Organizer 刷新后继续。' },
  offline: { label: '已下线', tone: 'red', publicLabel: '不可参与', body: 'Race 已下线，保留公开结果。' }
};

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function encodeSession(user) {
  return Buffer.from(JSON.stringify({ username: user.username, role: user.role, teamId: user.teamId || null }), 'utf8').toString('base64url');
}

function sessionCookieName(role) {
  return role === 'organizer' ? 'ary_grs001_organizer_session' : role === 'team' ? 'ary_grs001_team_session' : 'ary_grs001_session';
}

function readCookie(cookieHeader, name) {
  return String(cookieHeader || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
}

function decodeCookie(cookie) {
  if (!cookie) return null;
  try {
    const raw = Buffer.from(cookie.split('=').slice(1).join('='), 'base64url').toString('utf8');
    const value = JSON.parse(raw);
    const user = credentials.find((item) => item.username === value.username && item.role === value.role && (item.teamId || null) === (value.teamId || null));
    if (!user) return null;
    return { username: user.username, role: user.role, teamId: user.teamId, displayName: user.displayName };
  } catch {
    return null;
  }
}

function roleForPath(pathname) {
  if (pathname.startsWith('/organizer')) return 'organizer';
  if (pathname.startsWith('/team') || pathname.startsWith('/api/team')) return 'team';
  return '';
}

function decodeSession(cookieHeader, view = '', pathname = '') {
  const role = view || roleForPath(pathname);
  const preferred = role === 'organizer' || role === 'team' ? decodeCookie(readCookie(cookieHeader, sessionCookieName(role))) : null;
  if (preferred) return preferred;
  return decodeCookie(readCookie(cookieHeader, 'ary_grs001_session'))
    || decodeCookie(readCookie(cookieHeader, 'ary_grs001_organizer_session'))
    || decodeCookie(readCookie(cookieHeader, 'ary_grs001_team_session'));
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

function targetWithView(path, role) {
  return role ? `${path}?view=${role}` : path;
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

function withSessionView(href, session) {
  if (!session?.role || href.startsWith('/api/')) return href;
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}view=${session.role}`;
}

function navFor(active, session) {
  const publicItems = [['/yard', 'Race'], ['/leaderboard', '榜单']];
  const roleItems = isOrganizer(session)
    ? [['/organizer', 'Organizer'], ['/organizer/race', 'Race 管理']]
    : isTeam(session)
      ? [['/team', '工作台'], ['/team/submit', '提交'], ['/team/records', '过程证据'], ['/team/replay', '回放']]
      : [];
  const items = [...publicItems, ...roleItems];
  return `<nav class="nav">${items.map(([href, label]) => `<a class="${active === href ? 'active' : ''}" href="${escapeHtml(withSessionView(href, session))}">${escapeHtml(label)}</a>`).join('')}</nav>`;
}

function page(title, active, session, content) {
  const nav = active === '/login' ? '' : navFor(active, session);
  const identity = session ? `<div class="identity"><span>${escapeHtml(session.displayName)}</span><a href="${escapeHtml(withSessionView('/logout', session))}">退出</a></div>` : active === '/login' ? '' : `<div class="identity"><a href="/login">登录</a></div>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{--ink:#172033;--muted:#667085;--line:#d9dee8;--bg:#f4f6fb;--panel:#fff;--accent:#1f49d8;--dark:#121826;--green:#15734f;--green-bg:#e7f5ee;--amber:#9a6500;--amber-bg:#fff5d8;--red:#b42318;--red-bg:#fff1f0;--purple:#5b3fb5;--purple-bg:#f0ecff;--blue-bg:#edf4ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#e9efff 0,#f4f6fb 36%,#eef2f7 100%);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{min-height:100vh}.topbar{position:sticky;top:0;z-index:2;background:#101828;color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}.topbar-inner{max-width:1180px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{display:flex;align-items:center;gap:10px}.mark{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#e11d48,#f97316);box-shadow:inset 0 -10px 0 rgba(0,0,0,.18)}.brand strong{display:block;font-size:15px}.brand span{display:block;color:#cbd5e1;font-size:12px}.nav{display:flex;gap:4px;flex-wrap:wrap}.nav a,.identity a,.identity span{border-radius:8px;padding:8px 10px;text-decoration:none;font-weight:800}.nav a{color:#cbd5e1}.nav a.active,.nav a:hover{background:#fff;color:#101828}.identity{display:flex;align-items:center;gap:8px}.identity span,.identity a{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.18)}.workspace{max-width:1180px;margin:0 auto;padding:26px 22px}.hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr);gap:14px;margin-bottom:14px}.panel,.card,.notice{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:14px;padding:18px}.panel{box-shadow:0 18px 40px rgba(16,24,40,.07);position:relative;overflow:hidden}.hero-art:after{content:"";position:absolute;right:-70px;top:-70px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,#bfd2ff 0,#e8efff 42%,transparent 70%);opacity:.9}.public-hero{background:linear-gradient(90deg,rgba(255,255,255,.86) 0%,rgba(255,255,255,.62) 52%,rgba(255,255,255,.34) 100%),url('/assets/public-yard-hero.webp') center/cover}.public-hero:after{right:-30px;top:-40px;background:radial-gradient(circle,rgba(249,115,22,.24) 0,rgba(191,210,255,.18) 48%,transparent 72%)}.organizer-hero{background:linear-gradient(90deg,rgba(255,255,255,.96),rgba(255,255,255,.88)),url('/assets/organizer-source-visual.webp') center/cover}.organizer-hero:after{right:-40px;top:-50px;background:radial-gradient(circle,rgba(20,184,166,.22) 0,rgba(91,63,181,.18) 50%,transparent 74%)}.hero-art>*{position:relative;z-index:1}.visual-card{position:relative;overflow:hidden;min-height:190px}.organizer-card{background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,255,255,.8)),url('/assets/organizer-source-visual.webp') center/cover}.visual-card:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(31,73,216,.12),rgba(225,29,72,.08)),repeating-linear-gradient(135deg,transparent 0 18px,rgba(31,73,216,.06) 18px 19px);pointer-events:none}.organizer-card:before{background:linear-gradient(135deg,rgba(16,24,40,.1),rgba(20,184,166,.12)),radial-gradient(circle at 80% 20%,rgba(249,115,22,.16),transparent 42%)}.visual-card>*{position:relative;z-index:1}.service-hero{grid-template-columns:minmax(0,1fr) minmax(420px,.82fr)}.service-card{min-height:300px;padding:30px}.service-card h2{font-size:34px;line-height:1.08;margin:22px 0 18px}.service-card>p{font-size:19px;line-height:1.7}.service-card .signal{margin:22px 0}.service-card .signal-row{padding:22px;border-radius:18px;gap:16px}.service-card .signal-row strong{font-size:21px}.service-card .signal-row p{font-size:18px;line-height:1.65;margin:12px 0 0}.service-card .signal-dot{width:13px;height:20px;border-radius:999px;margin-top:4px}.service-card .button{width:100%;padding:17px 18px;border-radius:14px;font-size:18px}.panel h1{font-size:34px;line-height:1.08;margin:8px 0}.panel p,.card p,.notice p{color:var(--muted);line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.stack{display:grid;gap:12px}.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.eyebrow{letter-spacing:.08em;text-transform:uppercase;font-size:11px;font-weight:900;color:#667085}.pill{display:inline-flex;border-radius:7px;padding:4px 8px;font-size:12px;font-weight:900;background:#eef2ff;color:#243b83}.pill.green{background:var(--green-bg);color:var(--green)}.pill.amber{background:var(--amber-bg);color:var(--amber)}.pill.red{background:var(--red-bg);color:var(--red)}.pill.purple{background:var(--purple-bg);color:var(--purple)}.button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent);border-radius:9px;padding:10px 13px;background:var(--accent);color:#fff;font-weight:900;text-decoration:none;cursor:pointer}.button.secondary{background:#fff;color:#1d2939;border-color:var(--line)}.button.danger{background:#b42318;border-color:#b42318}.button.disabled{background:#eef2f7;color:#667085;border-color:#d0d5dd;cursor:not-allowed}.cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.metric-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}.metric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}.metric strong{display:block;font-size:24px;margin:6px 0 2px}.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:12px}.flow-step{border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px}.flow-step strong{display:block;margin-top:4px}.signal{display:grid;gap:10px}.signal-row{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}.signal-dot{width:11px;height:11px;border-radius:50%;background:#98a2b3;margin-top:7px}.signal-dot.green{background:#17b26a}.signal-dot.amber{background:#f79009}.signal-dot.red{background:#f04438}.action-list{display:grid;gap:10px}.action-item{display:flex;justify-content:space-between;gap:16px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px;text-decoration:none;color:var(--ink)}.action-item:hover{box-shadow:0 10px 24px rgba(16,24,40,.06)}.action-item strong{display:block;margin-bottom:4px}.action-item em{display:block;color:var(--muted);font-style:normal;line-height:1.45}.arrow{font-size:22px;font-weight:900;color:#98a2b3}.notice.ok{background:var(--green-bg);border-color:#b7ebd0}.notice.warn{background:var(--amber-bg);border-color:#f6dfa0}.notice.danger{background:var(--red-bg);border-color:#ffd0d0}form{display:grid;gap:12px}label{display:grid;gap:6px;font-weight:800;color:#344054}input,textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:11px;font:inherit;background:#fff}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}th,td{padding:11px 12px;border-bottom:1px solid #edf0f5;text-align:left;vertical-align:top}th{background:#f8fafc;color:#344054;font-size:12px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}.radar-panel{display:grid;grid-template-columns:minmax(260px,330px) minmax(0,1fr);gap:16px;align-items:center;margin-top:14px}.radar-svg{width:100%;max-width:330px}.radar-legend{display:grid;gap:8px;list-style:none;margin:0;padding:0}.radar-legend li{display:flex;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:9px 11px}.radar-score{font-weight:900;color:var(--accent)}.result-radar{margin-top:14px}.timeline{display:grid;gap:10px}.event{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px}.event-no{width:34px;height:34px;border-radius:50%;background:#101828;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}details{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}summary{cursor:pointer;list-style:none;padding:14px 16px;font-weight:900}summary::-webkit-details-marker{display:none}.details-body{border-top:1px solid var(--line);padding:14px 16px;background:#fbfcff}.muted{color:var(--muted)}@media(max-width:820px){.topbar-inner{align-items:flex-start;flex-direction:column}.hero,.split,.radar-panel,.service-hero{grid-template-columns:1fr}.event{grid-template-columns:1fr}}
</style>
</head>
<body><main class="shell"><header class="topbar"><div class="topbar-inner"><div class="brand"><div class="mark"></div><div><strong>GRS 001</strong><span>Race Source Proof</span></div></div>${nav}${identity}</div></header><section class="workspace">${content}</section></main></body></html>`;
}

function listItems(items = []) {
  if (!items.length) return '<p class="muted">暂无。</p>';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function metricStrip(items) {
  return `<section class="metric-strip">${items.map((item) => `<div class="metric"><span class="pill ${item.tone || ''}">${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><p class="muted">${escapeHtml(item.caption)}</p></div>`).join('')}</section>`;
}

function actionList(items) {
  return `<div class="action-list">${items.map((item) => `<a class="action-item" href="${escapeHtml(withSessionView(item.href, item.session))}"><div><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.body)}</em></div><div class="arrow">›</div></a>`).join('')}</div>`;
}

function disclosure(title, summary, content, open = false) {
  return `<details${open ? ' open' : ''}><summary>${escapeHtml(title)}<div class="muted" style="font-weight:650;margin-top:4px">${escapeHtml(summary)}</div></summary><div class="details-body">${content}</div></details>`;
}

function flowSteps(steps) {
  return `<div class="flow">${steps.map((step) => `<div class="flow-step"><span class="pill ${step.tone || ''}">${escapeHtml(step.kicker)}</span><strong>${escapeHtml(step.title)}</strong><p class="muted">${escapeHtml(step.body)}</p></div>`).join('')}</div>`;
}

function radarPoint(index, total, radius, center = 140) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)];
}

function clampScore(score) {
  return Math.max(0, Math.min(5, Number(score || 0)));
}

function formatScore(score) {
  const value = clampScore(score);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function fallbackResultDimensions(teamId) {
  const scores = teamId === 'team_001' ? [5, 5, 5, 5, 4.5, 5] : [4, 4, 4.5, 4, 4.5, 4];
  return ['产品定义', '去中心化架构', '技术验证', '智能体骑行', '展示体验', '创世骑手'].map((label, index) => ({ label, score: scores[index] }));
}

function resultDimensionsFor(teamId, leaderboard = []) {
  const row = leaderboard.find((item) => item.teamId === teamId);
  return row?.resultDimensions?.length ? row.resultDimensions : fallbackResultDimensions(teamId);
}

function renderRadarChart(items = [], ariaLabel = '六维结果雷达图') {
  if (!items.length) return '<p class="muted">暂无结果维度。</p>';
  const total = items.length;
  const center = 140;
  const outerRadius = 108;
  const rings = [36, 60, 84, 108];
  const polygons = rings.map((radius) => `<polygon points="${items.map((_, index) => radarPoint(index, total, radius, center).map((value) => value.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#edf0f5"/>`).join('');
  const axis = items.map((item, index) => {
    const [x, y] = radarPoint(index, total, outerRadius, center);
    const [lx, ly] = radarPoint(index, total, 126, center);
    return `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#d9dee8"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="800" fill="#344054">${escapeHtml(item.short || item.label)}</text>`;
  }).join('');
  const scorePoints = items.map((item, index) => radarPoint(index, total, outerRadius * clampScore(item.score) / 5, center).map((value) => value.toFixed(1)).join(',')).join(' ');
  const dots = items.map((item, index) => {
    const [x, y] = radarPoint(index, total, outerRadius * clampScore(item.score) / 5, center);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#2347d6"><title>${escapeHtml(item.label)}：${escapeHtml(formatScore(item.score))}/5</title></circle>`;
  }).join('');
  return `<div class="radar-panel"><svg class="radar-svg" viewBox="0 0 280 280" role="img" aria-label="${escapeHtml(ariaLabel)}"><rect width="280" height="280" rx="18" fill="#fff"/>${polygons}${axis}<polygon points="${scorePoints}" fill="rgba(35,71,214,.18)" stroke="#2347d6" stroke-width="2"/>${dots}</svg><ul class="radar-legend muted">${items.map((item) => `<li><span>${escapeHtml(item.label)}</span><span class="radar-score">${escapeHtml(formatScore(item.score))}/5</span></li>`).join('')}</ul></div>`;
}

function renderResultRadar(title, dimensions, caption = '六个公开维度用于查看评测后的结果。') {
  return `<section class="result-radar"><div class="eyebrow">Result Profile</div><h3>${escapeHtml(title)}</h3><p class="muted">${escapeHtml(caption)}</p>${renderRadarChart(dimensions, `${title} 雷达图`)}</section>`;
}

function renderResultCards(leaderboard, teams, title, caption) {
  const byTeam = new Map(teams.map((team) => [team.teamId, team]));
  return `<section class="stack" style="margin-top:14px"><div class="panel hero-art"><div class="eyebrow">Result Profile</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(caption)}</p></div>${leaderboard.map((row) => {
    const teamName = byTeam.get(row.teamId)?.teamName || row.teamId;
    return `<article class="card"><span class="pill green">排名 ${escapeHtml(row.rank)}</span><h2>${escapeHtml(teamName)}</h2>${metricStrip([{ label: '等级', value: row.scoreBand, caption: '公开结果', tone: row.rank === 1 ? 'green' : 'amber' }])}<p class="muted">公开评语：${escapeHtml(row.publicComment)}</p>${renderRadarChart(resultDimensionsFor(row.teamId, leaderboard), `${teamName} 六维结果雷达图`)}</article>`;
  }).join('')}</section>`;
}

function stateFor(status) {
  return raceStates[status] || raceStates.paused;
}

function canSubmitRace(race) {
  return race?.status === 'open';
}

function dateLabel(value) {
  if (!value) return '未记录';
  return String(value).replace('T', ' ').slice(0, 16);
}

function publicRaceCount(disclosures) {
  return disclosures.filter((race) => race.status !== 'draft').length;
}

function visibleDisclosures(disclosures) {
  return disclosures.filter((race) => race.status !== 'draft');
}

function reviewLabel(race, service) {
  if (!race) return { value: '等待', caption: '暂无公开 Race', tone: 'amber' };
  if (race.status !== 'open') {
    const state = stateFor(race.status);
    return { value: state.label, caption: state.body, tone: state.tone };
  }
  return service.enabled
    ? { value: '可评分', caption: 'Organizer 数据可用', tone: 'green' }
    : { value: '暂停', caption: '数据缺失，暂无法评分', tone: 'red' };
}

function nextVersion(version) {
  const match = String(version || 'v0').match(/v(\d+)/);
  return `v${match ? Number(match[1]) + 1 : 1}`;
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

async function updateRaceLifecycle(status) {
  const nextStatus = raceStates[status] ? status : 'open';
  const sources = await readRaceSources();
  const disclosures = await readDisclosures();
  const now = new Date().toISOString();
  const updatedSources = sources.map((source) => ({
    ...source,
    lifecycleStatus: nextStatus,
    disclosureStatus: nextStatus === 'draft' ? 'draft' : nextStatus === 'offline' ? 'offline' : nextStatus === 'expired' ? 'expired' : 'published',
    disclosureVersion: nextStatus === 'open' ? nextVersion(source.disclosureVersion) : source.disclosureVersion,
    updatedAt: now,
    disclosedAt: nextStatus === 'open' ? now : source.disclosedAt
  }));
  const bySource = new Map(updatedSources.map((source) => [source.raceId, source]));
  const updatedDisclosures = disclosures.map((race) => {
    const source = bySource.get(race.raceId);
    if (!source) return race;
    const state = stateFor(nextStatus);
    return {
      ...race,
      status: nextStatus,
      disclosureVersion: source.disclosureVersion,
      disclosedAt: dateLabel(nextStatus === 'open' ? now : source.disclosedAt || source.updatedAt),
      sourceStateLabel: nextStatus === 'offline' ? 'Race 已下线' : nextStatus === 'expired' ? '公开信息待更新' : source.sourceStatus === 'available' ? 'Organizer 数据可用' : 'Organizer 数据不可用',
      reviewStateLabel: state.body,
      entryLabel: canSubmitRace({ status: nextStatus }) ? '进入 Race' : state.publicLabel
    };
  });
  await writeJson(raceSourcePath, updatedSources);
  await writeJson(disclosuresPath, updatedDisclosures);
}

async function requestOrganizerEvaluation(organizerPort, session, answer, ridingRecord) {
  const race = await primaryDisclosure();
  if (!canSubmitRace(race)) {
    const state = stateFor(race?.status || 'paused');
    return {
      status: 'missing',
      teamId: session.teamId,
      resultText: 'Race 暂未开放。',
      score: null,
      resultSummary: state.body
    };
  }
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

function renderLogin(error = '', view = '') {
  const suffix = view ? `?view=${encodeURIComponent(view)}` : '';
  return page('登录', '/login', null, `<section class="hero"><div class="panel hero-art"><div class="eyebrow">Sign in</div><h1>登录</h1><p>请输入账号和密码。</p></div><aside class="card visual-card"><span class="pill amber">GRS 001</span><h2>Product Definition Race</h2></aside></section><form class="card" method="post" action="/login${suffix}">${error ? `<div class="notice danger"><strong>登录失败</strong><p>${escapeHtml(error)}</p></div>` : ''}<label>账号<input name="username" autocomplete="off" placeholder="请输入账号"></label><label>密码<input name="password" type="password" autocomplete="off" placeholder="请输入密码"></label><button class="button" type="submit">进入</button></form>`);
}

function renderDemo(session) {
  return page('录制入口', '', session, `<section class="hero"><div class="panel hero-art"><div class="eyebrow">Recording</div><h1>录制入口</h1><p>同一浏览器可同时保持 Organizer 和 Team 登录状态。</p></div><aside class="card visual-card"><span class="pill green">双身份</span><h2>并排录制</h2><p>分别打开两个入口，即可展示创建、披露、提交和评测。</p></aside></section><section class="grid"><article class="card"><span class="pill purple">Organizer</span><h2>组织方窗口</h2><p>打开后登录 Organizer。</p><div class="cta-row"><a class="button" href="/login?view=organizer">登录 Organizer</a><a class="button secondary" href="/organizer?view=organizer">进入 Organizer</a></div></article><article class="card"><span class="pill amber">Team</span><h2>队伍窗口</h2><p>打开后登录 Team。</p><div class="cta-row"><a class="button" href="/login?view=team">登录 Team</a><a class="button secondary" href="/team?view=team">进入 Team</a></div></article></section>`);
}

async function renderYard(session) {
  const disclosures = await readDisclosures();
  const service = await readEvaluatorService();
  const visible = visibleDisclosures(disclosures);
  const current = visible[0];
  const review = reviewLabel(current, service);
  return page('Race', '/yard', session, `<section class="hero"><div class="panel hero-art public-hero"><div class="eyebrow">Public Yard</div><h1>可参加的 Race</h1>${metricStrip([{ label: 'Race', value: publicRaceCount(disclosures), caption: current ? '公开中' : '等待披露', tone: current ? 'green' : 'amber' }, { label: 'Status', value: current ? stateFor(current.status).label : '未开放', caption: current ? stateFor(current.status).body : '等待 Organizer 披露', tone: current ? stateFor(current.status).tone : 'amber' }, { label: 'Review', value: review.value, caption: review.caption, tone: review.tone }])}</div><aside class="card visual-card"><span class="pill purple">GRS 001</span><h2>证明目标</h2><p>只公开 Race 摘要；Organizer 本地数据服务不可用时评测服务暂停。</p></aside></section>${visible.length ? `<section class="grid">${visible.map((race) => {
    const state = stateFor(race.status);
    return `<article class="card"><span class="pill ${state.tone}">${escapeHtml(state.label)}</span><h2>${escapeHtml(race.title)}</h2><p>${escapeHtml(race.publicGoal)}</p><p class="muted">${escapeHtml(race.sourceStateLabel)}</p><div class="cta-row"><a class="button" href="${escapeHtml(withSessionView(`/race/${race.raceId}`, session))}">查看 Race</a>${isTeam(session) && canSubmitRace(race) ? `<a class="button secondary" href="${escapeHtml(withSessionView('/team/submit', session))}">提交</a>` : ''}</div></article>`;
  }).join('')}</section>` : '<section class="notice warn"><strong>暂无公开 Race</strong><p>等待 Organizer 披露后，Race 会出现在这里。</p></section>'}`);
}

async function renderRaceDetail(session, raceId) {
  const service = await readEvaluatorService();
  const race = (await readDisclosures()).find((item) => item.raceId === raceId);
  if (!race || race.status === 'draft') return page('未找到', '/yard', session, '<section class="notice danger"><strong>未找到 Race</strong></section>');
  const state = stateFor(race.status);
  const review = reviewLabel(race, service);
  const submitAction = isOrganizer(session)
    ? `<a class="button" href="${escapeHtml(withSessionView('/organizer/race', session))}">管理 Race</a>`
    : isTeam(session)
      ? canSubmitRace(race) ? `<a class="button" href="${escapeHtml(withSessionView('/team/submit', session))}">提交方案</a>` : `<span class="button disabled">${escapeHtml(state.publicLabel)}</span>`
      : '<a class="button" href="/login">登录后参与</a>';
  return page(race.title, '/yard', session, `<section class="hero"><div class="panel hero-art public-hero"><div class="eyebrow">Public Disclosure</div><h1>${escapeHtml(race.title)}</h1><p>${escapeHtml(race.publicSummary)}</p>${metricStrip([{ label: '版本', value: race.disclosureVersion, caption: race.disclosedAt, tone: 'purple' }, { label: '状态', value: state.label, caption: state.body, tone: state.tone }, { label: '评测', value: review.value, caption: review.caption, tone: review.tone }])}<div class="cta-row">${submitAction}<a class="button secondary" href="${escapeHtml(withSessionView('/leaderboard', session))}">公开结果</a></div></div><aside class="card visual-card"><span class="pill green">公开摘要</span><h2>看得见的 Race</h2><p>这里展示 Organizer 已披露的内容。</p></aside></section><section class="split"><article class="card"><h2>提交要求</h2>${listItems(race.publicRequirements)}</article><article class="card"><h2>参与路径</h2>${flowSteps([{ kicker: '1', title: '发现 Race', body: '在 Public Yard 查看公开摘要。', tone: 'purple' }, { kicker: '2', title: '提交方案', body: canSubmitRace(race) ? '队伍提交摘要和回放记录。' : state.body, tone: canSubmitRace(race) ? 'green' : state.tone }, { kicker: '3', title: '查看结果', body: '公开榜单展示结果画像。', tone: 'amber' }])}</article></section>`);
}

async function renderOrganizerConsole(session) {
  const sources = await readRaceSources();
  const service = await readEvaluatorService();
  const source = sources[0];
  const state = stateFor(source?.lifecycleStatus || 'draft');
  const leaderboard = await readJson(leaderboardPath);
  const teams = await readJson(teamsPath);
  const serviceState = service.enabled
    ? { label: '本地数据服务已连接', tone: 'green', body: 'Team 提交会请求 Organizer 当前数据完成评测。', action: '切断服务', next: 'off' }
    : { label: '本地数据服务已切断', tone: 'red', body: 'Team 提交会显示数据缺失，过程证据不会解锁。', action: '恢复服务', next: 'on' };
  return page('Organizer', '/organizer', session, `<section class="hero service-hero"><div class="panel hero-art organizer-hero"><div class="eyebrow">Organizer Console</div><h1>Race 源数据由 Organizer 持有</h1>${metricStrip([{ label: 'Created', value: sources.length, caption: source ? dateLabel(source.createdAt) : '尚未创建', tone: 'purple' }, { label: 'Disclosure', value: state.label, caption: source?.disclosureVersion || '尚未披露', tone: state.tone }, { label: 'Local Data', value: service.enabled ? '连接中' : '已切断', caption: service.enabled ? '可以评分' : '数据缺失，暂无法评分', tone: service.enabled ? 'green' : 'red' }])}</div><aside class="card visual-card organizer-card service-card"><span class="pill ${serviceState.tone}">数据可用性实验</span><h2>本地数据服务</h2><p>${escapeHtml(serviceState.body)}</p><div class="signal"><div class="signal-row"><span class="signal-dot ${serviceState.tone}"></span><div><strong>${escapeHtml(serviceState.label)}</strong><p class="muted">切断后，ARY 只保留公开摘要，不能替 Organizer 完成评分。</p></div></div></div><form method="post" action="/organizer/evaluator?view=organizer"><button class="button ${service.enabled ? 'danger' : ''}" name="enabled" value="${serviceState.next}" type="submit">${escapeHtml(serviceState.action)}</button></form></aside></section><section class="split"><article class="card"><h2>赛事流程</h2>${flowSteps([{ kicker: '1', title: '创建', body: source ? 'Race 已在 Organizer 侧创建。' : '等待创建。', tone: source ? 'green' : 'amber' }, { kicker: '2', title: '披露', body: state.body, tone: state.tone }, { kicker: '3', title: '组织', body: service.enabled ? '可接收提交并评测。' : '本地数据服务切断，提交会显示数据缺失。', tone: service.enabled ? 'green' : 'red' }, { kicker: '4', title: '展示', body: '公开结果进入榜单。', tone: 'purple' }])}</article><article class="card"><h2>${escapeHtml(source?.title || 'Race')}</h2><p>${escapeHtml(source?.privateBrief || '')}</p><p class="muted">公开字段：${escapeHtml((source?.publicFields || []).join('、'))}</p><div class="cta-row"><a class="button secondary" href="/organizer/race?view=organizer">管理 Race</a></div></article></section>${renderResultCards(leaderboard, teams, '队伍评测结果', 'Organizer 可查看队伍结果画像，过程细节仍只在队伍工作台内。')}`);
}

async function renderOrganizerRace(session) {
  const sources = await readRaceSources();
  return page('Race 管理', '/organizer/race', session, `<section class="panel hero-art organizer-hero"><div class="eyebrow">Organizer Race</div><h1>创建与披露</h1><p>完整 Race 材料留在 Organizer 侧，只披露参与所需摘要。</p></section><section class="stack" style="margin-top:14px">${sources.map((source) => {
    const state = stateFor(source.lifecycleStatus || 'draft');
    return `<article class="card"><span class="pill ${state.tone}">${escapeHtml(state.label)}</span><h2>${escapeHtml(source.title)}</h2>${metricStrip([{ label: '创建', value: dateLabel(source.createdAt), caption: 'Organizer 侧', tone: 'purple' }, { label: '版本', value: source.disclosureVersion, caption: dateLabel(source.updatedAt), tone: 'green' }, { label: '状态', value: state.publicLabel, caption: state.body, tone: state.tone }])}<div class="split"><div><h3>公开字段</h3>${listItems(source.publicFields)}</div><div><h3>评测需要</h3>${listItems(source.evaluationRequires)}</div></div>${disclosure('Organizer 侧保留内容', '不进入 Rider 或公开页面。', listItems(source.privateMaterials), false)}<form method="post" action="/organizer/race?view=organizer" style="margin-top:12px"><div class="cta-row"><button class="button secondary" name="status" value="draft" type="submit">保存草案</button><button class="button" name="status" value="open" type="submit">披露并开放</button><button class="button secondary" name="status" value="paused" type="submit">暂停评测</button><button class="button secondary" name="status" value="expired" type="submit">标记待更新</button><button class="button danger" name="status" value="offline" type="submit">下线 Race</button></div></form></article>`;
  }).join('')}</section>`);
}

async function renderTeamDashboard(req, session) {
  const race = await primaryDisclosure();
  const service = await readEvaluatorService();
  const submitted = hasTeamSubmission(req, session);
  const state = stateFor(race?.status || 'draft');
  const review = reviewLabel(race, service);
  const actions = canSubmitRace(race)
    ? [{ title: submitted ? '进入过程证据' : '提交本队内容', body: submitted ? '查看回放记录。' : '提交摘要和回放记录。', href: submitted ? '/team/records' : '/team/submit', session }, { title: '查看 Race', body: '确认要求和公开状态。', href: `/race/${race.raceId}`, session }]
    : [{ title: '查看 Race', body: state.body, href: `/race/${race?.raceId || 'grs-001'}`, session }, { title: '公开结果', body: '查看已公开成果。', href: '/leaderboard', session }];
  return page('工作台', '/team', session, `<section class="hero"><div class="panel hero-art"><div class="eyebrow">Rider Workspace</div><h1>${canSubmitRace(race) ? '完成提交' : '等待 Race 开放'}</h1><p>${escapeHtml(race?.publicGoal || '等待 Organizer 披露。')}</p>${metricStrip([{ label: 'Race', value: state.label, caption: race?.title || '等待披露', tone: state.tone }, { label: 'Submit', value: submitted ? '已提交' : '待提交', caption: submitted ? '可查看过程证据' : canSubmitRace(race) ? '提交方案与回放记录' : state.body, tone: submitted ? 'green' : state.tone }, { label: 'Review', value: review.value, caption: review.caption, tone: review.tone }])}</div><aside class="card visual-card"><span class="pill amber">下一步</span><h2>${submitted ? '查看过程证据' : canSubmitRace(race) ? '提交方案' : state.publicLabel}</h2>${actionList(actions)}</aside></section>`);
}

function ridingTemplate() {
  return `计划：围绕 Race 数据留在 Organizer 侧建立证明链。
观察：公开页只展示摘要，评测依赖 Organizer 当前数据状态。
干预：删除内部说明，保留用户能感知的状态和提交路径。
验收：检查数据缺失、数据恢复、组间隔离和公开结果。
复盘：本次提交只交整理后的回放记录，本地素材原文不默认上传。`;
}

async function renderSubmit(req, session, result = null) {
  const race = await primaryDisclosure();
  const service = await readEvaluatorService();
  const submitted = hasTeamSubmission(req, session);
  const state = stateFor(race?.status || 'draft');
  const review = reviewLabel(race, service);
  const resultPanel = result ? `<section class="notice ${result.status === 'available' ? 'ok' : 'warn'}"><strong>${escapeHtml(result.resultText)}</strong><p>${escapeHtml(result.resultSummary || '')}</p></section>` : submitted ? '<section class="notice ok"><strong>已提交</strong><p>可查看过程证据。</p></section>' : '';
  const form = canSubmitRace(race) ? `<form class="card" method="post" action="/team/submit?view=team"><label>方案摘要<textarea name="answer" rows="4" placeholder="说明产品定义、系统方案和验证。">满分答案：Race 数据留在 Organizer 侧，通过公开披露完成发现、参与和展示。</textarea></label><label>回放记录摘要<textarea name="ridingRecord" rows="8" placeholder="按计划、观察、干预、验收、复盘整理。">${escapeHtml(ridingTemplate())}</textarea></label><button class="button" type="submit">提交</button></form>` : `<section class="notice warn"><strong>${escapeHtml(state.publicLabel)}</strong><p>${escapeHtml(state.body)}</p></section>`;
  return page('提交', '/team/submit', session, `<section class="hero"><div class="panel hero-art"><div class="eyebrow">Submission</div><h1>提交摘要</h1><p>评分取决于 Organizer 数据状态。</p>${metricStrip([{ label: 'Race', value: state.label, caption: race?.title || '等待披露', tone: state.tone }, { label: 'Review', value: review.value, caption: review.caption, tone: review.tone }])}</div><aside class="card visual-card"><span class="pill green">Riding Record</span><h2>五段回放</h2><p>计划、观察、干预、验收、复盘。</p></aside></section>${resultPanel}${form}`);
}

async function renderRecords(req, session) {
  if (!hasTeamSubmission(req, session)) {
    return page('过程证据', '/team/records', session, `<section class="notice warn"><strong>尚未提交</strong><p>提交后可查看本队过程证据。</p><div class="cta-row"><a class="button" href="/team/submit?view=team">去提交</a></div></section>`);
  }
  const records = teamOnly(await readJson(recordsPath), session);
  const events = await readJson(eventsPath);
  const leaderboard = await readJson(leaderboardPath);
  return page('过程证据', '/team/records', session, `<section class="panel hero-art"><div class="eyebrow">Riding Evidence</div><h1>本队回放记录</h1><p>这里展示整理后的过程证据，不展示本地素材原文。</p></section><section class="stack" style="margin-top:14px">${records.map((record) => `<article class="card"><span class="pill green">${escapeHtml(record.title)}</span><h2>${escapeHtml(record.summary)}</h2><p class="muted">维度：${escapeHtml(record.dimensions.join('、'))}</p><p class="muted">本地素材保留：${record.sourceRetainedLocally ? '是' : '否'}；提交内容：整理后的回放记录。</p>${flowSteps([{ kicker: 'Plan', title: '计划', body: record.plan || '确定证明目标。', tone: 'purple' }, { kicker: 'Observe', title: '观察', body: record.observation || '识别页面和数据状态。', tone: 'amber' }, { kicker: 'Steer', title: '干预', body: record.steering || '修正表达和实现边界。', tone: 'green' }, { kicker: 'Check', title: '验收', body: record.validation || '跑通关键场景。', tone: 'green' }, { kicker: 'Review', title: '复盘', body: record.review || '收敛提交证据。', tone: 'purple' }])}${renderResultRadar('评测结果维度', resultDimensionsFor(record.teamId, leaderboard), '提交通过后查看本队结果画像。')}${renderRecordEvents(events.filter((event) => event.recordId === record.recordId))}</article>`).join('')}</section>`);
}

async function renderReplay(req, session) {
  if (!hasTeamSubmission(req, session)) {
    return page('回放', '/team/replay', session, `<section class="notice warn"><strong>尚未提交</strong><p>提交后可查看本队回放。</p><div class="cta-row"><a class="button" href="/team/submit?view=team">去提交</a></div></section>`);
  }
  const records = teamOnly(await readJson(recordsPath), session);
  const events = await readJson(eventsPath).then((items) => items.filter((event) => records.some((record) => record.recordId === event.recordId)));
  return page('回放', '/team/replay', session, `<section class="hero"><div class="panel hero-art"><div class="eyebrow">Replay</div><h1>过程回放</h1><p>DevCompass 整理时间线、actor、验证节点和贡献证据摘要。</p>${metricStrip([{ label: 'Events', value: events.length, caption: '本队事件', tone: 'purple' }, { label: 'Actor', value: 'Rider + Agent', caption: '区分判断与执行', tone: 'green' }, { label: 'Check', value: '一致性', caption: '按时间线验收', tone: 'amber' }])}</div><aside class="card visual-card"><span class="pill purple">Replay</span><h2>看过程</h2><p>不是本地素材原文，而是整理后的回放记录。</p></aside></section><section class="card">${renderRecordEvents(events)}</section>`);
}

function renderRecordEvents(events) {
  return `<div class="timeline" style="margin-top:12px">${events.map((event) => `<article class="event"><div class="event-no">${escapeHtml(event.eventNo)}</div><div class="card"><span class="pill ${event.type === 'validation' ? 'green' : event.type === 'steering' ? 'amber' : event.type === 'agent-action' ? 'purple' : ''}">${escapeHtml(event.phase)}</span><h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(event.content)}</p><p class="muted">actor：${escapeHtml(event.actor)}；验证：${escapeHtml(event.validation || '已记录')}</p></div></article>`).join('')}</div>`;
}

async function renderLeaderboard(session) {
  const leaderboard = await readJson(leaderboardPath);
  const teams = await readJson(teamsPath);
  const byTeam = new Map(teams.map((team) => [team.teamId, team]));
  return page('榜单', '/leaderboard', session, `<section class="hero"><div class="panel hero-art"><div class="eyebrow">Public Results</div><h1>公开结果</h1><p>观众可以看到成绩、排名、评语和六维结果画像。</p></div><aside class="card visual-card"><span class="pill green">Audience</span><h2>公开展示</h2><p>展示成果，不展示队伍私有过程。</p></aside></section><section class="card"><table><thead><tr><th>排名</th><th>队伍</th><th>等级</th><th>公开评语</th></tr></thead><tbody>${leaderboard.map((row) => `<tr><td>${escapeHtml(row.rank)}</td><td>${escapeHtml(byTeam.get(row.teamId)?.teamName || row.teamId)}</td><td>${escapeHtml(row.scoreBand)}</td><td>${escapeHtml(row.publicComment)}</td></tr>`).join('')}</tbody></table></section>${renderResultCards(leaderboard, teams, '六维结果画像', '榜单公开展示评测后的维度表现，队伍提交与回放内容仍不公开。')}`);
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
      const session = decodeSession(req.headers.cookie, url.searchParams.get('view') || '', url.pathname);

      if (req.method === 'GET' && url.pathname === '/') return redirect(res, '/yard');
      if (req.method === 'GET' && url.pathname === '/assets/public-yard-hero.webp') {
        const asset = await readFile(join(rootDir, 'assets', 'public-yard-hero.webp'));
        res.writeHead(200, { 'content-type': 'image/webp', 'content-length': asset.length, 'cache-control': 'public, max-age=3600' });
        return res.end(asset);
      }
      if (req.method === 'GET' && url.pathname === '/assets/organizer-source-visual.webp') {
        const asset = await readFile(join(rootDir, 'assets', 'organizer-source-visual.webp'));
        res.writeHead(200, { 'content-type': 'image/webp', 'content-length': asset.length, 'cache-control': 'public, max-age=3600' });
        return res.end(asset);
      }
      if (req.method === 'GET' && url.pathname === '/demo') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderDemo(session));
      }
      if (req.method === 'GET' && url.pathname === '/login') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderLogin('', url.searchParams.get('view') || ''));
      }
      if (req.method === 'POST' && url.pathname === '/login') {
        const body = await readBody(req);
        const user = credentials.find((item) => item.username === body.username && item.password === body.password);
        if (!user) {
          res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' });
          return res.end(renderLogin('账号或密码不正确。', url.searchParams.get('view') || ''));
        }
        const role = user.role === 'organizer' ? 'organizer' : 'team';
        const nextPath = role === 'organizer' ? '/organizer' : '/team';
        return redirect(res, targetWithView(nextPath, role), { 'set-cookie': `${sessionCookieName(role)}=${encodeSession(user)}; Path=/; HttpOnly; SameSite=Lax` });
      }
      if (req.method === 'GET' && url.pathname === '/logout') {
        const view = url.searchParams.get('view') || '';
        const cookies = [
          `${sessionCookieName(view)}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
          'ary_grs001_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
        ];
        return redirect(res, targetWithView('/login', view), { 'set-cookie': cookies });
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
      if (req.method === 'POST' && url.pathname === '/organizer/race') {
        if (requireLogin(res, session) || requireOrganizer(res, session)) return;
        const body = await readBody(req);
        await updateRaceLifecycle(body.status || 'open');
        return redirect(res, '/organizer/race?view=organizer');
      }
      if (req.method === 'POST' && url.pathname === '/organizer/evaluator') {
        if (requireLogin(res, session) || requireOrganizer(res, session)) return;
        const body = await readBody(req);
        await writeEvaluatorService(body.enabled === 'on');
        return redirect(res, '/organizer?view=organizer');
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
      if (req.method === 'GET' && url.pathname === '/team/records') {
        if (requireLogin(res, session) || requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderRecords(req, session));
      }
      if (req.method === 'GET' && url.pathname === '/team/replay') {
        if (requireLogin(res, session) || requireTeam(res, session)) return;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderReplay(req, session));
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
