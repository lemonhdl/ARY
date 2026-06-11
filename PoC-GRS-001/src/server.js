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
  const publicItems = [['/yard', '赛事'], ['/jumbotron', 'Jumbotron'], ['/leaderboard', '榜单']];
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
:root{--ink:#172033;--muted:#667085;--line:#d9dee8;--bg:#f4f6fb;--panel:#fff;--accent:#1f49d8;--dark:#121826;--green:#15734f;--green-bg:#e7f5ee;--amber:#9a6500;--amber-bg:#fff5d8;--red:#b42318;--red-bg:#fff1f0;--purple:#5b3fb5;--purple-bg:#f0ecff;--blue-bg:#edf4ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#e9efff 0,#f4f6fb 36%,#eef2f7 100%);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.jumbotron-page{width:calc(100vw - 44px);margin-left:calc(50% - 50vw + 22px);min-height:calc(100vh - 92px);background:linear-gradient(135deg,#f8fbff 0,#eef4ff 48%,#fff7ed 100%);color:#172033;border-radius:22px;padding:10px}.jumbotron-page .muted{color:#667085}.jumbotron-page a{text-decoration:none;color:inherit}.jumbotron-header,.jumbotron-kpis,.jumbotron-layout,.jumbotron-ticker,.jumbotron-debug,.jumbotron-calibrator,.jumbotron-validation,.jumbotron-footer{border:1px solid rgba(148,163,184,.32);background:rgba(255,255,255,.92);border-radius:18px;padding:12px;margin-bottom:8px;box-shadow:0 12px 28px rgba(31,73,216,.06)}.jumbotron-header{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:8px 12px}.jumbotron-brandline{display:flex;align-items:center;gap:10px;min-width:0}.jumbotron-brandline strong{font-size:18px;white-space:nowrap}.jumbotron-brandline span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.jumbotron-statusbar{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.jumbotron-statusbar span,.jumbotron-chip{border:1px solid rgba(148,163,184,.34);background:#fff;border-radius:999px;padding:6px 10px;font-weight:850;color:#344054}.jumbotron-live{display:inline-flex;border-radius:999px;background:#dc2626;color:#fff;padding:5px 10px;font-weight:900;letter-spacing:.08em}.jumbotron-kpis{display:flex;gap:8px;overflow:hidden;align-items:center;padding:8px 10px}.jumbotron-chip{display:flex;gap:6px;align-items:center;flex:0 0 auto}.jumbotron-chip strong{font-size:16px;color:#172033}.jumbotron-chip span{font-size:12px;color:#667085}.jumbotron-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:10px;align-items:stretch}.track-stage-card{background:rgba(255,255,255,.78);border:1px solid rgba(148,163,184,.26);border-radius:18px;padding:10px}.track-stage-card h2{font-size:22px;margin:2px 0 6px}.track-svg{width:100%;height:clamp(640px,72vh,780px)}.mini-map-svg{width:100%;height:150px;border-radius:12px;background:#f8fafc}.mini-map-svg .track-band{stroke-width:110}.mini-map-svg .track-centerline{stroke-width:12}.track-bg{fill:#f8fafc;stroke:rgba(31,73,216,.25);stroke-width:2}.track-band{fill:none;stroke:#d7e3f8;stroke-width:72;stroke-linecap:round;stroke-linejoin:round}.track-centerline{fill:none;stroke:#1f49d8;stroke-width:4;stroke-dasharray:10 10}.track-samples{fill:none;stroke:#f59e0b;stroke-width:2;stroke-dasharray:3 14}.horse-body{fill:#fff;stroke:#172033;stroke-width:3}.horse-arrow{fill:#2563eb}.horse-low .horse-arrow{fill:#22c55e}.horse-medium .horse-arrow{fill:#f59e0b}.horse-high .horse-arrow,.horse-critical .horse-arrow{fill:#ef4444}.horse-label,.checkpoint text,.debug-label{fill:#172033;font-size:18px;font-weight:900;paint-order:stroke;stroke:#fff;stroke-width:5px}.message-bubble rect{fill:rgba(255,255,255,.96);stroke:#1f49d8;stroke-width:2}.message-bubble text{fill:#1d2939;font-size:13px;font-weight:800}.entry-tooltip{opacity:0;pointer-events:none;transition:opacity .12s ease}.jumbotron-focus-source:hover .entry-tooltip,.jumbotron-focus-source:focus .entry-tooltip,.jumbotron-focus-source:focus-within .entry-tooltip{opacity:1}.entry-tooltip rect{fill:rgba(15,23,42,.94);stroke:rgba(255,255,255,.72);stroke-width:1.5}.entry-tooltip text{fill:#fff;font-size:14px;font-weight:850;stroke:none}.jumbotron-focus-source{position:relative;outline:none}.html-tooltip{position:absolute;left:0;bottom:calc(100% + 8px);z-index:5;width:268px;background:#172033;color:#fff;border-radius:12px;padding:10px;box-shadow:0 16px 28px rgba(16,24,40,.22);opacity:0;pointer-events:none;transform:translateY(4px);transition:opacity .12s ease,transform .12s ease}.jumbotron-focus-source:hover .html-tooltip,.jumbotron-focus-source:focus .html-tooltip,.jumbotron-focus-source:focus-within .html-tooltip{opacity:1;transform:translateY(0)}.html-tooltip strong{display:block;color:#fff}.html-tooltip span{display:block;color:#dbeafe;font-size:12px;line-height:1.45}.ticker-item{position:relative;display:inline-flex}.ticker-item .html-tooltip{left:auto;right:0;bottom:calc(100% + 10px)}.focus-details-card{position:sticky;top:74px}.focus-detail-list{display:grid;gap:8px}.focus-detail-card{display:none;border:1px solid rgba(31,73,216,.22);background:#f8fbff;border-radius:12px;padding:10px}.focus-detail-card:first-child{display:block}.focus-detail-list:has(.focus-detail-card:target) .focus-detail-card{display:none}.focus-detail-list:has(.focus-detail-card:target) .focus-detail-card:target{display:block}.focus-detail-card:target{outline:3px solid rgba(31,73,216,.24)}.focus-detail-card p{margin:6px 0}.focus-trigger{cursor:pointer}.side-card{background:rgba(255,255,255,.86);border:1px solid rgba(148,163,184,.28);border-radius:16px;padding:10px;margin-bottom:8px}.side-card h2,.jumbotron-debug h2,.jumbotron-calibrator h2,.jumbotron-validation h2{margin:3px 0 8px;color:#172033;font-size:20px}.side-card p{margin:7px 0}.ranking-list{margin:0;padding-left:20px}.ranking-list li{margin:7px 0}.attention-item{border-radius:12px;background:rgba(127,29,29,.18);padding:8px;margin-top:7px}.jumbotron-ticker{display:flex;gap:10px;align-items:center;overflow:hidden;padding:9px 12px}.jumbotron-ticker div{display:flex;gap:8px;overflow:hidden}.jumbotron-ticker span{flex:0 0 auto;background:#eef4ff;border-radius:999px;padding:7px 10px;color:#344054}.debug-grid,.validation-grid,.calibrator-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.debug-grid article,.validation-grid article,.calibrator-grid article{background:#fff;border:1px solid rgba(148,163,184,.26);border-radius:12px;padding:12px}.calibrator-preview-svg{width:100%;height:220px}.jumbotron-footer{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.boundary-pill{display:inline-flex;border:1px solid rgba(56,189,248,.35);border-radius:999px;padding:6px 9px;color:#bae6fd;margin:3px}.topbar{position:sticky;top:0;z-index:2;background:rgba(255,255,255,.96);color:#172033;border-bottom:1px solid rgba(148,163,184,.32);box-shadow:0 12px 28px rgba(31,73,216,.06)}.topbar-inner{max-width:1180px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{display:flex;align-items:center;gap:10px}.mark{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#e11d48,#f97316);box-shadow:inset 0 -10px 0 rgba(0,0,0,.18)}.brand strong{display:block;font-size:15px}.brand span{display:block;color:#667085;font-size:12px}.nav{display:flex;gap:4px;flex-wrap:wrap}.nav a,.identity a,.identity span{border-radius:8px;padding:8px 10px;text-decoration:none;font-weight:800}.nav a{color:#475467}.nav a.active,.nav a:hover{background:#eef4ff;color:#1f49d8}.identity{display:flex;align-items:center;gap:8px}.identity span,.identity a{background:#f8fafc;color:#172033;border:1px solid rgba(148,163,184,.32)}.workspace{max-width:1180px;margin:0 auto;padding:26px 22px}.hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr);gap:14px;margin-bottom:14px}.panel,.card,.notice{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:14px;padding:18px}.panel{box-shadow:0 18px 40px rgba(16,24,40,.07);position:relative;overflow:hidden}.hero-art:after{content:"";position:absolute;right:-70px;top:-70px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,#bfd2ff 0,#e8efff 42%,transparent 70%);opacity:.9}.public-hero{background:linear-gradient(90deg,rgba(255,255,255,.86) 0%,rgba(255,255,255,.62) 52%,rgba(255,255,255,.34) 100%),url('/assets/public-yard-hero.webp') center/cover}.public-hero:after{right:-30px;top:-40px;background:radial-gradient(circle,rgba(249,115,22,.24) 0,rgba(191,210,255,.18) 48%,transparent 72%)}.organizer-hero{background:linear-gradient(90deg,rgba(255,255,255,.96),rgba(255,255,255,.88)),url('/assets/organizer-source-visual.webp') center/cover}.organizer-hero:after{right:-40px;top:-50px;background:radial-gradient(circle,rgba(20,184,166,.22) 0,rgba(91,63,181,.18) 50%,transparent 74%)}.hero-art>*{position:relative;z-index:1}.visual-card{position:relative;overflow:hidden;min-height:190px}.organizer-card{background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,255,255,.8)),url('/assets/organizer-source-visual.webp') center/cover}.visual-card:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(31,73,216,.12),rgba(225,29,72,.08)),repeating-linear-gradient(135deg,transparent 0 18px,rgba(31,73,216,.06) 18px 19px);pointer-events:none}.organizer-card:before{background:linear-gradient(135deg,rgba(16,24,40,.1),rgba(20,184,166,.12)),radial-gradient(circle at 80% 20%,rgba(249,115,22,.16),transparent 42%)}.visual-card>*{position:relative;z-index:1}.service-hero{grid-template-columns:minmax(0,1fr) minmax(420px,.82fr)}.service-card{min-height:300px;padding:30px}.service-card h2{font-size:34px;line-height:1.08;margin:22px 0 18px}.service-card>p{font-size:19px;line-height:1.7}.service-card .signal{margin:22px 0}.service-card .signal-row{padding:22px;border-radius:18px;gap:16px}.service-card .signal-row strong{font-size:21px}.service-card .signal-row p{font-size:18px;line-height:1.65;margin:12px 0 0}.service-card .signal-dot{width:13px;height:20px;border-radius:999px;margin-top:4px}.service-card .button{width:100%;padding:17px 18px;border-radius:14px;font-size:18px}.panel h1{font-size:34px;line-height:1.08;margin:8px 0}.panel p,.card p,.notice p{color:var(--muted);line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.stack{display:grid;gap:12px}.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.eyebrow{letter-spacing:.08em;text-transform:uppercase;font-size:11px;font-weight:900;color:#667085}.pill{display:inline-flex;border-radius:7px;padding:4px 8px;font-size:12px;font-weight:900;background:#eef2ff;color:#243b83}.pill.green{background:var(--green-bg);color:var(--green)}.pill.amber{background:var(--amber-bg);color:var(--amber)}.pill.red{background:var(--red-bg);color:var(--red)}.pill.purple{background:var(--purple-bg);color:var(--purple)}.button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent);border-radius:9px;padding:10px 13px;background:var(--accent);color:#fff;font-weight:900;text-decoration:none;cursor:pointer}.button.secondary{background:#fff;color:#1d2939;border-color:var(--line)}.button.danger{background:#b42318;border-color:#b42318}.button.disabled{background:#eef2f7;color:#667085;border-color:#d0d5dd;cursor:not-allowed}.cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.metric-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}.metric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}.metric strong{display:block;font-size:24px;margin:6px 0 2px}.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:12px}.flow-step{border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px}.flow-step strong{display:block;margin-top:4px}.signal{display:grid;gap:10px}.signal-row{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}.signal-dot{width:11px;height:11px;border-radius:50%;background:#98a2b3;margin-top:7px}.signal-dot.green{background:#17b26a}.signal-dot.amber{background:#f79009}.signal-dot.red{background:#f04438}.action-list{display:grid;gap:10px}.action-item{display:flex;justify-content:space-between;gap:16px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px;text-decoration:none;color:var(--ink)}.action-item:hover{box-shadow:0 10px 24px rgba(16,24,40,.06)}.action-item strong{display:block;margin-bottom:4px}.action-item em{display:block;color:var(--muted);font-style:normal;line-height:1.45}.arrow{font-size:22px;font-weight:900;color:#98a2b3}.notice.ok{background:var(--green-bg);border-color:#b7ebd0}.notice.warn{background:var(--amber-bg);border-color:#f6dfa0}.notice.danger{background:var(--red-bg);border-color:#ffd0d0}form{display:grid;gap:12px}label{display:grid;gap:6px;font-weight:800;color:#344054}input,textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:11px;font:inherit;background:#fff}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}th,td{padding:11px 12px;border-bottom:1px solid #edf0f5;text-align:left;vertical-align:top}th{background:#f8fafc;color:#344054;font-size:12px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}.radar-panel{display:grid;grid-template-columns:minmax(260px,330px) minmax(0,1fr);gap:16px;align-items:center;margin-top:14px}.radar-svg{width:100%;max-width:330px}.radar-legend{display:grid;gap:8px;list-style:none;margin:0;padding:0}.radar-legend li{display:flex;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:9px 11px}.radar-score{font-weight:900;color:var(--accent)}.result-radar{margin-top:14px}.timeline{display:grid;gap:10px}.event{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px}.event-no{width:34px;height:34px;border-radius:50%;background:#101828;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}details{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}summary{cursor:pointer;list-style:none;padding:14px 16px;font-weight:900}summary::-webkit-details-marker{display:none}.details-body{border-top:1px solid var(--line);padding:14px 16px;background:#fbfcff}.muted{color:var(--muted)}@media(max-width:820px){.jumbotron-page{width:auto;margin-left:0}.jumbotron-header{align-items:flex-start;flex-direction:column}.jumbotron-layout{grid-template-columns:1fr}.track-svg{height:520px}.topbar-inner{align-items:flex-start;flex-direction:column}.hero,.split,.radar-panel,.service-hero{grid-template-columns:1fr}.event{grid-template-columns:1fr}}
</style>
</head>
<body><main class="shell"><header class="topbar"><div class="topbar-inner"><div class="brand"><div class="mark"></div><div><strong>GRS 001</strong><span>赛事公开展示</span></div></div>${nav}${identity}</div></header><section class="workspace">${content}</section></main></body></html>`;
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

const JUMBOTRON_STALE_THRESHOLD_MS = 1000 * 60 * 5;
const JUMBOTRON_TRACK_PROFILE_SCHEMA_VERSION = '0.1.0';
const JUMBOTRON_BACKGROUND_ASSETS = new Set(['/assets/public-yard-hero.webp', '/assets/organizer-source-visual.webp']);

const jumbotronTrackProfiles = [
  {
    schemaVersion: '0.1.0',
    trackId: 'grs-public-oval',
    name: 'GRS 公开椭圆赛道',
    label: 'GRS 公开椭圆赛道',
    background: { assetId: 'public-yard-hero', src: '/assets/public-yard-hero.webp', kind: 'webp' },
    backgroundAsset: 'public-yard-hero',
    viewBox: { x: 0, y: 0, width: 1200, height: 620 },
    designSize: { width: 1200, height: 620, aspectRatio: '16:9' },
    direction: 'clockwise',
    centerline: { type: 'polyline', closed: true, smoothing: 'mvp-polyline', points: [
      { x: 160, y: 312 }, { x: 230, y: 150 }, { x: 500, y: 86 }, { x: 850, y: 115 },
      { x: 1050, y: 260 }, { x: 990, y: 455 }, { x: 680, y: 530 }, { x: 330, y: 485 }, { x: 160, y: 312 }
    ] },
    centerlinePath: [
      { x: 160, y: 312 }, { x: 230, y: 150 }, { x: 500, y: 86 }, { x: 850, y: 115 },
      { x: 1050, y: 260 }, { x: 990, y: 455 }, { x: 680, y: 530 }, { x: 330, y: 485 }, { x: 160, y: 312 }
    ],
    startFinish: { startS: 0, finishS: 1, label: '起终点' },
    startLine: { s: 0, label: '起点' },
    finishLine: { s: 1, label: '终点' },
    lanes: [-54, -28, 0, 28, 54, 78, -78, 100].map((offset, index) => ({ laneId: `lane-${index}`, offset })),
    displayAdjustment: { horseX: 0, horseY: 0, bubbleX: 28, bubbleY: -64 },
    riskZones: [{ zoneId: 'finish-risk-watch', x: 920, y: 190, width: 190, height: 210, severity: 'medium' }],
    debug: { sampleCount: 28, collisionBox: { width: 44, height: 44 }, staleThresholdMs: JUMBOTRON_STALE_THRESHOLD_MS },
    checkpoints: [
      { checkpointId: 'cp-discovery', label: '发现', s: 0.18 },
      { checkpointId: 'cp-submit', label: '提交', s: 0.42 },
      { checkpointId: 'cp-evaluate', label: '评测', s: 0.68 },
      { checkpointId: 'cp-result', label: '展示', s: 0.88 }
    ],
    laneOffsets: [-54, -28, 0, 28, 54, 78, -78, 100],
    safeZones: [{ zoneId: 'main-bubble-zone', x: 260, y: 115, width: 720, height: 390 }],
    noBubbleZones: [{ zoneId: 'finish-line', x: 980, y: 210, width: 120, height: 160 }],
    messageZones: [{ zoneId: 'track-bubble', offsetX: 28, offsetY: -64 }]
  },
  {
    schemaVersion: '0.1.0',
    trackId: 'grs-technical-loop',
    name: 'GRS 技术回环赛道',
    label: 'GRS 技术回环赛道',
    background: { assetId: 'organizer-source-visual', src: '/assets/organizer-source-visual.webp', kind: 'webp' },
    backgroundAsset: 'organizer-source-visual',
    viewBox: { x: 0, y: 0, width: 1200, height: 620 },
    designSize: { width: 1200, height: 620, aspectRatio: '16:9' },
    direction: 'counterclockwise',
    centerline: { type: 'polyline', closed: true, smoothing: 'mvp-polyline', points: [
      { x: 210, y: 500 }, { x: 120, y: 310 }, { x: 270, y: 140 }, { x: 560, y: 190 },
      { x: 720, y: 80 }, { x: 1030, y: 160 }, { x: 980, y: 420 }, { x: 690, y: 475 }, { x: 430, y: 360 }, { x: 210, y: 500 }
    ] },
    centerlinePath: [
      { x: 210, y: 500 }, { x: 120, y: 310 }, { x: 270, y: 140 }, { x: 560, y: 190 },
      { x: 720, y: 80 }, { x: 1030, y: 160 }, { x: 980, y: 420 }, { x: 690, y: 475 }, { x: 430, y: 360 }, { x: 210, y: 500 }
    ],
    startFinish: { startS: 0, finishS: 1, label: '起终点' },
    startLine: { s: 0, label: '起点' },
    finishLine: { s: 1, label: '终点' },
    lanes: [-48, -20, 20, 48, 72, -72, 96, -96].map((offset, index) => ({ laneId: `lane-${index}`, offset })),
    displayAdjustment: { horseX: 0, horseY: 0, bubbleX: 26, bubbleY: -58 },
    riskZones: [{ zoneId: 'tight-turn-watch', x: 105, y: 235, width: 220, height: 160, severity: 'medium' }],
    debug: { sampleCount: 28, collisionBox: { width: 44, height: 44 }, staleThresholdMs: JUMBOTRON_STALE_THRESHOLD_MS },
    checkpoints: [
      { checkpointId: 'cp-source', label: '源', s: 0.2 },
      { checkpointId: 'cp-boundary', label: '边界', s: 0.46 },
      { checkpointId: 'cp-proof', label: '证明', s: 0.7 }
    ],
    laneOffsets: [-48, -20, 20, 48, 72, -72, 96, -96],
    safeZones: [{ zoneId: 'inside-loop', x: 260, y: 170, width: 630, height: 260 }],
    noBubbleZones: [{ zoneId: 'tight-turn', x: 120, y: 250, width: 180, height: 130 }],
    messageZones: [{ zoneId: 'loop-bubble', offsetX: 26, offsetY: -58 }]
  }
];

async function renderJumbotron(session, options = {}) {
  const [disclosures, leaderboard, teams, records, service] = await Promise.all([
    readDisclosures(),
    readJson(leaderboardPath),
    readJson(teamsPath),
    readJson(recordsPath),
    readEvaluatorService()
  ]);
  const model = buildJumbotronModel(disclosures, leaderboard, teams, records, service);
  const showReviewTools = Boolean(options.showReviewTools);
  const viewModel = { ...model, showReviewTools };
  const content = `<section class="jumbotron-page">
    ${renderJumbotronHeader(viewModel)}
    ${renderJumbotronKpis(model.raceSnapshot.kpi)}
    <section class="jumbotron-layout">
      ${renderJumbotronTrack(viewModel)}
      ${renderJumbotronSide(viewModel)}
    </section>
    ${renderJumbotronTicker(viewModel)}
    ${showReviewTools ? `${renderJumbotronCalibrator(viewModel)}${renderJumbotronValidation(viewModel)}` : ''}
    ${renderJumbotronFooter(viewModel)}
  </section>`;
  return page('Jumbotron', '/jumbotron', session, content);
}

function buildJumbotronModel(disclosures, leaderboard, teams, records, service) {
  const race = visibleDisclosures(disclosures)[0] || disclosures[0] || { raceId: 'grs-001', title: 'ARY GRS 001', status: 'draft', publicSummary: '等待公开摘要。', publicGoal: '等待 Organizer 披露。' };
  const trackProfile = normalizeTrackProfile(jumbotronTrackProfiles[0]);
  const raceSnapshot = buildRaceSnapshot(race, leaderboard, teams, records, service);
  const adapted = adaptJumbotronSnapshot(raceSnapshot, trackProfile);
  const runtime = createJumbotronRuntime(trackProfile);
  const horsePoses = adapted.racingEntries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
  const messagePlan = planRidingMessages(adapted.ridingMessages, horsePoses, trackProfile);
  const debug = buildDebugModel(runtime, adapted.racingEntries, horsePoses, trackProfile);
  const validation = buildValidationModel(trackProfile, adapted, runtime, horsePoses, messagePlan);
  return { race, raceSnapshot, adapted, trackProfile, runtime, horsePoses, messagePlan, debug, validation };
}

function buildRaceSnapshot(race, leaderboard, teams, records, service) {
  const byTeam = new Map(teams.map((team) => [team.teamId, team]));
  const byRecord = new Map(records.map((record) => [record.teamId, record]));
  const entries = leaderboard.map((row, index) => {
    const team = byTeam.get(row.teamId) || { teamName: row.teamId, publicProfile: '公开摘要待补充。' };
    const record = byRecord.get(row.teamId);
    const score = averageResultScore(row.resultDimensions) * 20;
    const roundProgress = Math.max(8, Math.min(96, Math.round(score - index * 7)));
    const caProvider = index % 2 === 0 ? 'claude' : 'codex';
    const costTokens = 42000 - index * 6300;
    return {
      entryId: row.teamId,
      displayName: team.teamName,
      riderName: team.teamName,
      projectName: team.publicProfile,
      rank: row.rank,
      rankDelta: index === 0 ? 1 : 0,
      score,
      overallProgress: Math.round(score),
      roundProgress,
      phaseProgress: Math.max(0, Math.min(100, roundProgress - 8 + index * 6)),
      currentPhase: 'DEV',
      tokenCost: costTokens,
      primaryCA: caProvider === 'claude' ? 'Claude Code' : 'Codex',
      caProvider,
      codexUsage: caProvider === 'claude' ? 42 : 58,
      claudeUsage: caProvider === 'claude' ? 58 : 42,
      riskLevel: row.scoreBand === 'excellent' ? 'low' : 'medium',
      motionState: row.rank === 1 ? 'sprinting' : 'running',
      status: row.rank === 1 ? 'sprinting' : 'running',
      latestMessage: row.publicComment,
      lastMessage: null,
      remoteCockpitUrl: '#remote-cockpit',
      costTokens,
      costUsd: Number((costTokens * 0.000015).toFixed(2)),
      obstacleCount: service.enabled ? 0 : index === 0 ? 1 : 0,
      violationCount: 0,
      updatedAt: Date.now() - index * 60000,
      recordDimensions: record?.dimensions || []
    };
  });
  const riskCount = entries.filter((entry) => entry.riskLevel !== 'low').length + (service.enabled ? 0 : 1);
  const messages = buildJumbotronMessages(entries, service);
  const lastMessageByEntry = new Map(messages.map((message) => [message.entryId, message]));
  return {
    competition: {
      competitionId: race.raceId,
      title: race.title,
      subtitle: race.publicGoal,
      organizer: race.organizerName,
      theme: 'Agent Riding 公开赛',
      brand: 'ARY GRS Jumbotron',
      liveStatus: race.status === 'open' ? '直播中' : stateFor(race.status).label,
      currentPhase: race.reviewStateLabel || stateFor(race.status).body,
      currentRound: '赛事直播',
      nextPhase: service.enabled ? '结果展示' : '等待数据恢复',
      elapsedTime: dateLabel(race.disclosedAt),
      systemTime: dateLabel(new Date().toISOString())
    },
    kpi: {
      completionRate: entries.length ? Math.round(entries.reduce((sum, entry) => sum + entry.overallProgress, 0) / entries.length) : 0,
      totalTokens: entries.reduce((sum, entry) => sum + entry.tokenCost, 0),
      activeRiders: entries.length,
      onlineRiders: entries.length,
      activeCockpits: entries.length,
      codexTokens: entries.reduce((sum, entry) => sum + Math.round(entry.tokenCost * entry.codexUsage / 100), 0),
      claudeTokens: entries.reduce((sum, entry) => sum + Math.round(entry.tokenCost * entry.claudeUsage / 100), 0),
      codexShare: entries.length ? Math.round(entries.reduce((sum, entry) => sum + entry.codexUsage, 0) / entries.length) : 0,
      claudeShare: entries.length ? Math.round(entries.reduce((sum, entry) => sum + entry.claudeUsage, 0) / entries.length) : 0,
      riskCount,
      obstacleCount: service.enabled ? 0 : 1,
      violationCount: 0
    },
    entries: entries.map((entry) => ({ ...entry, lastMessage: lastMessageByEntry.get(entry.entryId) || null })),
    messages,
    attentionItems: buildAttentionItems(entries, service)
  };
}

function averageResultScore(dimensions = []) {
  if (!dimensions.length) return 3;
  return dimensions.reduce((sum, item) => sum + clampScore(item.score), 0) / dimensions.length;
}

function buildJumbotronMessages(entries, service) {
  const messages = entries.flatMap((entry, index) => ([
    {
      messageId: `milestone-${entry.entryId}`,
      entryId: entry.entryId,
      source: 'rider',
      type: entry.rank === 1 ? 'milestone' : 'progress_update',
      severity: entry.riskLevel === 'low' ? 'info' : 'medium',
      summary: entry.latestMessage,
      createdAt: `${14 + index}:2${index}`,
      displayMode: entry.rank <= 2 ? 'bubble' : 'ticker',
      targetUrl: entry.remoteCockpitUrl
    }
  ]));
  if (!service.enabled) {
    messages.push({
      messageId: 'organizer-data-obstacle',
      entryId: entries[0]?.entryId || 'race',
      source: 'organizer',
      type: 'obstacle',
      severity: 'high',
      summary: 'Organizer 数据不可用，评测暂缓。',
      createdAt: 'now',
      displayMode: 'alert',
      targetUrl: '#remote-cockpit'
    });
  }
  return messages;
}

function buildAttentionItems(entries, service) {
  const items = entries.filter((entry) => entry.riskLevel !== 'low').map((entry) => ({
    itemId: `risk-${entry.entryId}`,
    entryId: entry.entryId,
    category: 'risk',
    severity: 'medium',
    summary: `${entry.displayName} 需要关注公开结果质量。`,
    status: 'watching',
    createdAt: 'now',
    targetUrl: '#remote-cockpit'
  }));
  if (!service.enabled) {
    items.unshift({ itemId: 'obstacle-organizer-data', entryId: entries[0]?.entryId || 'race', category: 'obstacle', severity: 'high', summary: '本地数据服务不可用，Jumbotron 只展示公开摘要。', status: 'open', createdAt: 'now', targetUrl: '#remote-cockpit' });
  }
  return items;
}

function normalizeTrackProfile(trackProfile) {
  const points = trackProfile.centerline?.points || trackProfile.centerlinePath || [];
  const lanes = trackProfile.lanes?.length ? trackProfile.lanes : (trackProfile.laneOffsets || []).map((offset, index) => ({ laneId: `lane-${index}`, offset }));
  return { ...trackProfile, centerlinePath: points, laneOffsets: lanes.map((lane) => lane.offset), lanes };
}

function adaptJumbotronSnapshot(raceSnapshot, trackProfile) {
  return {
    competition: raceSnapshot.competition,
    kpi: raceSnapshot.kpi,
    racingEntries: raceSnapshot.entries.map((entry, index) => {
      const lane = trackProfile.lanes[index % trackProfile.lanes.length];
      return {
        ...entry,
        roundProgress: Number.isFinite(entry.roundProgress) ? Math.max(0, Math.min(100, entry.roundProgress)) : Math.max(0, Math.min(100, entry.overallProgress || 0)),
        laneId: lane.laneId,
        laneOffsetIndex: index % trackProfile.lanes.length,
        progressMapping: Number.isFinite(entry.roundProgress) ? 'roundProgress' : 'temporary_overallProgress',
        motionState: normalizeMotionState(entry.motionState, entry.updatedAt)
      };
    }),
    ridingMessages: raceSnapshot.messages,
    attentionItems: raceSnapshot.attentionItems
  };
}

function normalizeMotionState(state, updatedAt) {
  if (updatedAt && Date.now() - updatedAt > JUMBOTRON_STALE_THRESHOLD_MS) return 'stale';
  const allowed = new Set(['idle', 'running', 'sprinting', 'slowed', 'blocked', 'pit_stop', 'takeover', 'finished', 'stale']);
  return allowed.has(state) ? state : 'running';
}

function createJumbotronRuntime(trackProfile) {
  const segments = buildTrackSegments(trackProfile.centerlinePath);
  const pathLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  return {
    pathLength,
    sampleHorsePose(entry) {
      const s = Math.max(0, Math.min(1, entry.roundProgress / 100));
      const sample = sampleTrackPath(segments, pathLength, s);
      const lane = trackProfile.lanes.find((item) => item.laneId === entry.laneId) || trackProfile.lanes[entry.laneOffsetIndex % trackProfile.lanes.length];
      const adjustment = trackProfile.displayAdjustment || { horseX: 0, horseY: 0 };
      const laneOffset = lane.offset;
      return {
        entryId: entry.entryId,
        x: sample.point.x + sample.normal.x * laneOffset + (adjustment.horseX || 0),
        y: sample.point.y + sample.normal.y * laneOffset + (adjustment.horseY || 0),
        rotation: sample.rotation,
        s,
        laneId: entry.laneId,
        state: entry.motionState,
        zIndex: Math.round(1000 + s * 100 + entry.laneOffsetIndex)
      };
    },
    samplePoint(s) {
      return sampleTrackPath(segments, pathLength, s);
    },
    samplePoints(count = 28) {
      return Array.from({ length: count }, (_, index) => sampleTrackPath(segments, pathLength, index / (count - 1)).point);
    }
  };
}

function buildTrackSegments(points) {
  return points.slice(0, -1).map((point, index) => {
    const nextPoint = points[index + 1];
    const dx = nextPoint.x - point.x;
    const dy = nextPoint.y - point.y;
    const length = Math.hypot(dx, dy);
    const tangent = length ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
    return { start: point, end: nextPoint, length, tangent, normal: { x: -tangent.y, y: tangent.x } };
  });
}

function sampleTrackPath(segments, pathLength, s) {
  const target = Math.max(0, Math.min(1, s)) * pathLength;
  let traversed = 0;
  for (const segment of segments) {
    if (traversed + segment.length >= target) {
      const local = segment.length ? (target - traversed) / segment.length : 0;
      return {
        point: { x: segment.start.x + (segment.end.x - segment.start.x) * local, y: segment.start.y + (segment.end.y - segment.start.y) * local },
        tangent: segment.tangent,
        normal: segment.normal,
        rotation: Math.atan2(segment.tangent.y, segment.tangent.x) * 180 / Math.PI
      };
    }
    traversed += segment.length;
  }
  const last = segments[segments.length - 1];
  return { point: last.end, tangent: last.tangent, normal: last.normal, rotation: Math.atan2(last.tangent.y, last.tangent.x) * 180 / Math.PI };
}

function planRidingMessages(messages, horsePoses, trackProfile) {
  const priority = { risk_alert: 4, obstacle: 3, violation: 3, milestone: 2, progress_update: 1, quality_signal: 1, strategy_change: 1, takeover: 1, pit_stop: 1 };
  const usedEntries = new Set();
  const bubbles = [];
  const ticker = [];
  for (const message of [...messages].sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0))) {
    const pose = horsePoses.find((item) => item.entry.entryId === message.entryId)?.pose;
    const canBubble = pose && !usedEntries.has(message.entryId) && bubbles.length < 3 && message.displayMode !== 'ticker' && isInSafeZone(pose, trackProfile);
    if (canBubble) {
      usedEntries.add(message.entryId);
      bubbles.push({ message, pose });
    } else {
      ticker.push(message);
    }
  }
  return { bubbles, ticker };
}

function isInSafeZone(pose, trackProfile) {
  return trackProfile.safeZones.some((zone) => pose.x >= zone.x && pose.x <= zone.x + zone.width && pose.y >= zone.y && pose.y <= zone.y + zone.height)
    && !trackProfile.noBubbleZones.some((zone) => pose.x >= zone.x && pose.x <= zone.x + zone.width && pose.y >= zone.y && pose.y <= zone.y + zone.height);
}

function buildDebugModel(runtime, entries, horsePoses, trackProfile) {
  return {
    sampledPoints: runtime.samplePoints(28),
    laneOffsets: trackProfile.laneOffsets,
    checkpoints: trackProfile.checkpoints.map((checkpoint) => ({ ...checkpoint, pose: runtime.samplePoint(checkpoint.s) })),
    horseSValues: horsePoses.map(({ entry, pose }) => `${entry.displayName}: ${Math.round(pose.s * 100)}%`),
    collisionBoxes: horsePoses.map(({ pose }) => ({ x: pose.x - 22, y: pose.y - 22, width: 44, height: 44 })),
    staleEntries: entries.filter((entry) => entry.motionState === 'stale')
  };
}

function buildValidationModel(trackProfile, adapted, runtime, horsePoses, messagePlan) {
  return {
    trackChecks: validateTrackProfile(trackProfile, runtime),
    runtimeChecks: adapted.racingEntries.flatMap((entry) => validateRuntimeEntry(entry, trackProfile)),
    visualChecks: validateVisualLayout(trackProfile, horsePoses, messagePlan)
  };
}

function validateTrackProfile(trackProfile, runtime) {
  const points = trackProfile.centerlinePath;
  const sampledPoints = runtime.samplePoints(trackProfile.debug?.sampleCount || 28);
  const adjacentDistances = sampledPoints.slice(1).map((point, index) => Math.hypot(point.x - sampledPoints[index].x, point.y - sampledPoints[index].y));
  return [
    ['schemaVersion', Boolean(trackProfile.schemaVersion)],
    ['trackId', Boolean(trackProfile.trackId)],
    ['name', Boolean(trackProfile.name)],
    ['viewBox', Boolean(trackProfile.viewBox) && trackProfile.viewBox.width > 0 && trackProfile.viewBox.height > 0],
    ['background', Boolean(trackProfile.background?.src || trackProfile.backgroundAsset)],
    ['centerline type', trackProfile.centerline?.type === 'polyline'],
    ['centerline closed', !trackProfile.centerline?.closed || samePoint(points[0], points.at(-1))],
    ['centerline points', points.length >= 2],
    ['direction', ['clockwise', 'counterclockwise'].includes(trackProfile.direction)],
    ['startFinish', Number.isFinite(trackProfile.startFinish?.startS) && Number.isFinite(trackProfile.startFinish?.finishS) && trackProfile.startFinish.startS >= 0 && trackProfile.startFinish.finishS <= 1],
    ['lanes', trackProfile.lanes.length >= 1 && trackProfile.lanes.every((lane) => lane.laneId && Number.isFinite(lane.offset))],
    ['lane offsets unique', new Set(trackProfile.lanes.map((lane) => lane.offset)).size === trackProfile.lanes.length],
    ['profile schema', trackProfile.schemaVersion === JUMBOTRON_TRACK_PROFILE_SCHEMA_VERSION],
    ['background loadable', JUMBOTRON_BACKGROUND_ASSETS.has(trackProfile.background?.src)],
    ['checkpoints', trackProfile.checkpoints.every((checkpoint) => checkpoint.s >= 0 && checkpoint.s <= 1)],
    ['sample finite', sampledPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))],
    ['sample continuity', adjacentDistances.every((distance) => distance > 0 && distance < 180)],
    ['turn angle warning', maxTurnAngle(points) < 135],
    ['path length', Number.isFinite(runtime.pathLength) && runtime.pathLength > 0]
  ];
}

function validateRuntimeEntry(entry, trackProfile) {
  return [
    [`${entry.displayName} 进度`, entry.roundProgress >= 0 && entry.roundProgress <= 100],
    [`${entry.displayName} 泳道`, trackProfile.lanes.some((lane) => lane.laneId === entry.laneId)],
    [`${entry.displayName} 更新时间`, Boolean(entry.updatedAt)],
    [`${entry.displayName} 进度映射`, entry.progressMapping === 'roundProgress'],
    [`${entry.displayName} 状态`, ['idle', 'running', 'sprinting', 'slowed', 'blocked', 'pit_stop', 'takeover', 'finished', 'stale'].includes(entry.motionState)],
    [`${entry.displayName} CA`, ['codex', 'claude', 'other'].includes(entry.caProvider || 'other')],
    [`${entry.displayName} primaryCA display`, Boolean(entry.primaryCA)],
    [`${entry.displayName} obstacleCount`, Number.isFinite(entry.obstacleCount)],
    [`${entry.displayName} violationCount`, Number.isFinite(entry.violationCount)],
    [`${entry.displayName} token`, Number.isFinite(entry.costTokens || entry.tokenCost)],
    [`${entry.displayName} profile schema`, trackProfile.schemaVersion === JUMBOTRON_TRACK_PROFILE_SCHEMA_VERSION],
    [`${entry.displayName} stale threshold`, entry.motionState !== 'stale' || Date.now() - entry.updatedAt >= JUMBOTRON_STALE_THRESHOLD_MS]
  ];
}

function validateVisualLayout(trackProfile, horsePoses, messagePlan) {
  const bubbleEntryCounts = messagePlan.bubbles.reduce((counts, item) => counts.set(item.message.entryId, (counts.get(item.message.entryId) || 0) + 1), new Map());
  const bubblesAvoidHeader = messagePlan.bubbles.every(({ pose }) => pose.y > 90);
  const horseDistances = horsePoses.flatMap((item, index) => horsePoses.slice(index + 1).map((other) => Math.hypot(item.pose.x - other.pose.x, item.pose.y - other.pose.y)));
  return [
    ['horse on track', horsePoses.every(({ pose }) => pose.x >= 0 && pose.x <= trackProfile.viewBox.width && pose.y >= 0 && pose.y <= trackProfile.viewBox.height)],
    ['one bubble per entry', [...bubbleEntryCounts.values()].every((count) => count <= 1)],
    ['global bubble limit', messagePlan.bubbles.length <= 3],
    ['bubble avoids header', bubblesAvoidHeader],
    ['horse overlap', horseDistances.every((distance) => distance > 32)],
    ['checkpoint semantics', trackProfile.checkpoints.length >= 3],
    ['two tracks ready', jumbotronTrackProfiles.length >= 2],
    ['eight lane preview', trackProfile.laneOffsets.length >= 8]
  ];
}

function maxTurnAngle(points) {
  return points.slice(1, -1).reduce((maxAngle, point, index) => {
    const previous = points[index];
    const next = points[index + 2];
    const a = Math.atan2(point.y - previous.y, point.x - previous.x);
    const b = Math.atan2(next.y - point.y, next.x - point.x);
    const diff = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) * 180 / Math.PI;
    return Math.max(maxAngle, diff);
  }, 0);
}

function samePoint(a, b) {
  return Boolean(a && b && Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001);
}

function jumbotronPolyline(points) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function jumbotronPath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function jumbotronSafeId(value) {
  return String(value || 'item').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function entryFocusId(entry) {
  return `focus-entry-${jumbotronSafeId(entry.entryId)}`;
}

function messageFocusId(message) {
  return `focus-message-${jumbotronSafeId(message.messageId)}`;
}

function attentionFocusId(item) {
  return `focus-attention-${jumbotronSafeId(item.itemId)}`;
}

function entryTooltipLines(entry) {
  const lastMessage = entry.lastMessage?.summary || entry.latestMessage || '暂无最新消息';
  return [
    `队伍：${entry.displayName}`,
    `排名 #${entry.rank} · 赛道 ${entry.roundProgress}% · 阶段 ${entry.phaseProgress}%`,
    `得分 ${Math.round(entry.score)} · 状态 ${motionStateLabel(entry.motionState)} · ${riskLevelLabel(entry.riskLevel)}`,
    `CA：${entry.primaryCA || entry.caProvider || '待确认'}`,
    `最近消息：${lastMessage}`
  ];
}

function messageTooltipLines(message, entries) {
  const entry = entries.find((item) => item.entryId === message.entryId);
  return [
    `消息：${messageTypeLabel(message.type)} · ${severityLabel(message.severity)}`,
    `Entry：${entry?.displayName || message.entryId}`,
    `时间：${message.createdAt}`,
    `摘要：${message.summary}`,
    '目标入口：Remote Racing Cockpit'
  ];
}

function attentionTooltipLines(item, entries) {
  const entry = entries.find((candidate) => candidate.entryId === item.entryId);
  return [
    `类别：${attentionCategoryLabel(item.category)} · ${severityLabel(item.severity)}`,
    `Entry：${entry?.displayName || item.entryId}`,
    `状态：${attentionStatusLabel(item.status)}`,
    `摘要：${item.summary}`,
    `下一步：${attentionNextStep(item.category)}`
  ];
}

function jumbotronTooltipPlacement(pose, width = 286, height = 104) {
  const x = pose.x > 850 ? pose.x - width - 34 : pose.x + 34;
  const y = Math.max(72, Math.min(500 - height, pose.y - height - 30));
  return { x, y, width, height };
}

function renderSvgTooltip(lines, placement) {
  return `<g class="entry-tooltip" transform="translate(${placement.x} ${placement.y})"><rect width="${placement.width}" height="${placement.height}" rx="14"/>${lines.slice(0, 5).map((line, index) => `<text x="12" y="${22 + index * 18}">${escapeHtml(line.slice(0, 42))}</text>`).join('')}</g>`;
}

function renderHtmlTooltip(lines) {
  return `<span class="html-tooltip" role="tooltip"><strong>悬停提示</strong>${lines.slice(0, 5).map((line) => `<span>${escapeHtml(line.slice(0, 64))}</span>`).join('')}</span>`;
}

function renderJumbotronHeader({ raceSnapshot }) {
  const competition = raceSnapshot.competition;
  return `<section class="jumbotron-header"><div class="jumbotron-brandline"><span class="jumbotron-live">LIVE</span><strong>${escapeHtml(competition.brand)}</strong><span>${escapeHtml(competition.title)}</span></div><div class="jumbotron-statusbar"><span>阶段：${escapeHtml(competition.currentRound)}</span><span>计时：${escapeHtml(competition.elapsedTime)}</span><span>在线 Rider：${raceSnapshot.kpi.onlineRiders}/${raceSnapshot.kpi.activeRiders}</span></div></section>`;
}

function renderJumbotronKpis(kpi) {
  return `<section class="jumbotron-kpis" aria-label="赛事状态贴边信息">${[
    { label: '总进度', value: `${kpi.completionRate}%` },
    { label: '活跃 Rider', value: `${kpi.activeRiders}/${kpi.onlineRiders}` },
    { label: 'Token', value: String(kpi.totalTokens) },
    { label: 'Codex / Claude', value: `${kpi.codexShare}% / ${kpi.claudeShare}%` },
    { label: '风险 / 阻塞', value: `${kpi.riskCount}/${kpi.obstacleCount}` }
  ].map((item) => `<div class="jumbotron-chip"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('')}</section>`;
}

function renderJumbotronTrack({ trackProfile, horsePoses, debug, messagePlan, adapted, showReviewTools }) {
  const debugLayer = showReviewTools ? `<polyline class="track-samples" points="${jumbotronPolyline(debug.sampledPoints)}"/>${debug.collisionBoxes.map((box) => `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="none" stroke="rgba(248,113,113,.7)" stroke-dasharray="5 5"/>`).join('')}` : '';
  const entryLayer = horsePoses.map(({ entry, pose }) => {
    const placement = jumbotronTooltipPlacement(pose, 310, 112);
    return `<a class="jumbotron-focus-source focus-trigger" href="#${entryFocusId(entry)}" aria-label="查看 ${escapeHtml(entry.displayName)} 焦点详情"><g class="horse horse-${entry.riskLevel}" transform="translate(${pose.x} ${pose.y}) rotate(${pose.rotation})"><circle class="horse-body" r="18"/><path class="horse-arrow" d="M-7,-9 L19,0 L-7,9 Z"/><text class="debug-label" transform="rotate(${-pose.rotation})" text-anchor="middle" y="6">${escapeHtml(entry.rank)}</text></g><text class="horse-label" x="${pose.x + 24}" y="${pose.y - 23}">${escapeHtml(entry.displayName)} · 赛道进度 ${Math.round(pose.s * 100)}%</text>${renderSvgTooltip(entryTooltipLines(entry), placement)}</a>`;
  }).join('');
  const bubbleLayer = messagePlan.bubbles.map(({ message, pose }) => {
    const placement = jumbotronTooltipPlacement({ x: pose.x + 30, y: pose.y - 70 }, 290, 96);
    const lines = messageTooltipLines(message, adapted.racingEntries);
    return `<a class="jumbotron-focus-source focus-trigger" href="#${messageFocusId(message)}" aria-label="查看 ${escapeHtml(messageTypeLabel(message.type))} 焦点详情"><g class="message-bubble" transform="translate(${pose.x + 30} ${pose.y - 70})"><rect width="245" height="52" rx="14"/><text x="13" y="21">${escapeHtml(messageTypeLabel(message.type))}</text><text x="13" y="40">${escapeHtml(message.summary).slice(0, 28)}</text></g>${renderSvgTooltip(lines, placement)}</a>`;
  }).join('');
  return `<section class="track-stage-card"><div class="eyebrow">Jumbotron 赛事直播视图</div><h2>赛道主视觉 <span class="jumbotron-live">LIVE</span></h2><svg class="track-svg" viewBox="0 0 1200 620" role="img" aria-label="Jumbotron 赛事直播赛道"><rect class="track-bg" x="22" y="22" width="1156" height="576" rx="42"/><path class="track-band" d="${jumbotronPath(trackProfile.centerlinePath)}"/><polyline class="track-centerline" points="${jumbotronPolyline(trackProfile.centerlinePath)}"/>${debugLayer}${debug.checkpoints.map((checkpoint) => `<g class="checkpoint" transform="translate(${checkpoint.pose.point.x} ${checkpoint.pose.point.y})"><circle r="9" fill="#facc15" stroke="#713f12" stroke-width="3"/><text x="13" y="5">${escapeHtml(checkpoint.label)}</text></g>`).join('')}${entryLayer}${bubbleLayer}</svg></section>`;
}

function renderJumbotronSide({ adapted, horsePoses, debug, trackProfile, showReviewTools }) {
  const top3 = [...adapted.racingEntries].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const legend = adapted.racingEntries.map((entry) => `<p><strong>#${entry.rank} ${escapeHtml(entry.displayName)}</strong><br><span class="muted">${escapeHtml(entry.primaryCA)} · ${escapeHtml(riskLevelLabel(entry.riskLevel))}</span></p>`).join('');
  const attention = adapted.attentionItems.length ? adapted.attentionItems.map((item) => `<a class="jumbotron-focus-source focus-trigger" href="#${attentionFocusId(item)}"><article class="attention-item"><strong>${escapeHtml(attentionCategoryLabel(item.category))} · ${escapeHtml(severityLabel(item.severity))}</strong><p>${escapeHtml(item.summary)}</p>${renderHtmlTooltip(attentionTooltipLines(item, adapted.racingEntries))}</article></a>`).join('') : '<p class="muted">当前没有高优先级风险。</p>';
  return `<aside><section class="side-card"><div class="eyebrow">实时 TOP3</div><h2>领先与追赶</h2><ol class="ranking-list">${top3.map((entry) => `<li><a class="jumbotron-focus-source focus-trigger" href="#${entryFocusId(entry)}"><strong>#${entry.rank} ${escapeHtml(entry.displayName)}</strong>${renderHtmlTooltip(entryTooltipLines(entry))}</a><div class="muted">赛道进度 ${entry.roundProgress}% · ${escapeHtml(motionStateLabel(entry.motionState))}</div></li>`).join('')}</ol></section>${renderFocusDetailPanel(adapted)}<section class="side-card"><div class="eyebrow">左侧轨道</div><h2>小地图</h2><svg class="mini-map-svg" viewBox="0 0 ${trackProfile.viewBox.width} ${trackProfile.viewBox.height}" role="img" aria-label="Track Mini Map"><path class="track-band" d="${jumbotronPath(trackProfile.centerlinePath)}"/><polyline class="track-centerline" points="${jumbotronPolyline(trackProfile.centerlinePath)}"/>${horsePoses.map(({ entry, pose }) => `<a class="jumbotron-focus-source" href="#${entryFocusId(entry)}"><circle cx="${pose.x}" cy="${pose.y}" r="18" fill="#1f49d8"><title>${escapeHtml(entry.displayName)}</title></circle></a>`).join('')}</svg><h3>Entry 图例</h3>${legend}</section><section class="side-card"><div class="eyebrow">阶段信息</div><h2>阶段检查点</h2>${adapted.racingEntries.map((entry) => `<p><strong>${escapeHtml(entry.displayName)}</strong><br><span class="muted">阶段进度 ${entry.phaseProgress}% · 得分 ${Math.round(entry.score)}</span></p>`).join('')}</section><section class="side-card"><div class="eyebrow">关注事项</div><h2>风险 / 阻塞 / 违规</h2>${attention}</section>${showReviewTools ? `<section class="side-card"><div class="eyebrow">HorsePose</div><h2>运行时输出</h2><p class="muted">${horsePoses.length} 个 Entry · ${debug.horseSValues.map(escapeHtml).join(' / ')}</p></section>` : ''}</aside>`;
}

function renderJumbotronTicker({ messagePlan, adapted }) {
  const items = messagePlan.ticker.map((message) => ({ message, text: `${messageTypeLabel(message.type)} · ${message.summary}` }));
  return `<section class="jumbotron-ticker"><strong>底部消息条</strong><div>${items.map(({ message, text }) => `<a class="ticker-item jumbotron-focus-source focus-trigger" href="#${messageFocusId(message)}"><span>${escapeHtml(text)}</span>${renderHtmlTooltip(messageTooltipLines(message, adapted.racingEntries))}</a>`).join('') || '<span>普通消息进入底部消息条，风险和里程碑优先气泡展示。</span>'}</div><a class="button secondary" href="#remote-cockpit">查看更多</a></section>`;
}

function messageTypeLabel(type) {
  const labels = { milestone: '里程碑', progress_update: '进度更新', obstacle: '阻塞', risk_alert: '风险提醒', violation: '违规', quality_signal: '质量信号', strategy_change: '策略调整', takeover: '接管', pit_stop: '暂停整理' };
  return labels[type] || type;
}

function motionStateLabel(state) {
  const labels = { idle: '待命', running: '行进中', sprinting: '冲刺', slowed: '减速', blocked: '阻塞', pit_stop: '暂停整理', takeover: '接管', finished: '完成', stale: '待刷新' };
  return labels[state] || state;
}

function riskLevelLabel(level) {
  const labels = { none: '无风险', low: '低风险', medium: '中风险', high: '高风险', critical: '紧急风险' };
  return labels[level] || level;
}

function attentionCategoryLabel(category) {
  const labels = { risk: '风险', obstacle: '阻塞', violation: '违规' };
  return labels[category] || category;
}

function attentionStatusLabel(status) {
  const labels = { watching: '观察中', open: '待处理', resolved: '已处理' };
  return labels[status] || status;
}

function attentionNextStep(category) {
  const labels = { risk: '检查公开结果质量', obstacle: '确认阻塞是否需要介入', violation: '核对违规状态' };
  return labels[category] || '继续观察';
}

function renderFocusDetailPanel(adapted) {
  const entryCards = adapted.racingEntries.map((entry) => `<article id="${entryFocusId(entry)}" class="focus-detail-card" data-focus-kind="entry"><strong>当前焦点对象详情 · #${entry.rank} ${escapeHtml(entry.displayName)}</strong><p>赛道进度 ${entry.roundProgress}% · 阶段进度 ${entry.phaseProgress}% · 得分 ${Math.round(entry.score)}</p><p>${escapeHtml(motionStateLabel(entry.motionState))} · ${escapeHtml(riskLevelLabel(entry.riskLevel))} · ${escapeHtml(entry.primaryCA || entry.caProvider || 'CA 待确认')}</p><p class="muted">${escapeHtml((entry.lastMessage?.summary || entry.latestMessage || '暂无最新消息').slice(0, 72))}</p></article>`).join('');
  const messageCards = adapted.ridingMessages.slice(0, 5).map((message) => {
    const entry = adapted.racingEntries.find((item) => item.entryId === message.entryId);
    return `<article id="${messageFocusId(message)}" class="focus-detail-card" data-focus-kind="message"><strong>当前焦点对象详情 · ${escapeHtml(messageTypeLabel(message.type))}</strong><p>${escapeHtml(severityLabel(message.severity))} · ${escapeHtml(entry?.displayName || message.entryId)} · ${escapeHtml(message.createdAt)}</p><p class="muted">${escapeHtml(message.summary.slice(0, 84))}</p><p>目标入口：Remote Racing Cockpit</p></article>`;
  }).join('');
  const attentionCards = adapted.attentionItems.map((item) => {
    const entry = adapted.racingEntries.find((candidate) => candidate.entryId === item.entryId);
    return `<article id="${attentionFocusId(item)}" class="focus-detail-card" data-focus-kind="attention"><strong>当前焦点对象详情 · ${escapeHtml(attentionCategoryLabel(item.category))}</strong><p>${escapeHtml(severityLabel(item.severity))} · ${escapeHtml(attentionStatusLabel(item.status))} · ${escapeHtml(entry?.displayName || item.entryId)}</p><p class="muted">${escapeHtml(item.summary.slice(0, 84))}</p><p>下一步：${escapeHtml(attentionNextStep(item.category))}</p></article>`;
  }).join('');
  return `<section class="side-card focus-details-card" aria-label="焦点详情栏"><div class="eyebrow">焦点信息</div><h2>焦点详情栏</h2><p class="muted">在赛道节点、关注事项或底部消息上悬停查看悬停提示；点击可把详情固定到这里。</p><div class="focus-detail-list">${entryCards}${messageCards}${attentionCards}</div></section>`;
}

function severityLabel(severity) {
  const labels = { info: '提示', medium: '中', high: '高', critical: '紧急' };
  return labels[severity] || severity;
}

function validationLabel(label) {
  const labels = {
    schemaVersion: 'Schema 版本',
    trackId: 'Track 标识',
    name: '赛道名称',
    viewBox: '视图框',
    background: '背景资产',
    backgroundAsset: '背景资产',
    'centerline type': '中心线类型',
    'centerline closed': '闭合路径',
    'centerline points': '中心线点位',
    direction: '赛道方向',
    startFinish: '起终点范围',
    lanes: '泳道配置',
    'lane offsets unique': '泳道偏移不重复',
    'profile schema': 'Profile 版本匹配',
    'background loadable': '背景资产可加载',
    'start / finish': '起点 / 终点',
    checkpoints: '检查点',
    'sample finite': '采样数值有效',
    'sample continuity': '相邻采样连续',
    'turn angle warning': '弯道转角自然',
    'path length': '路径长度',
    'horse on track': '马匹位于赛道范围内',
    'one bubble per entry': '每个 Entry 最多一个气泡',
    'bubble avoids header': '气泡避开页头',
    'horse overlap': '马匹不过度重叠',
    'checkpoint semantics': '检查点语义完整',
    'two tracks ready': '两条赛道已准备',
    'eight lane preview': '八条泳道预览'
  };
  return labels[label] || label.replace('progress mapping', '进度映射').replace('progress', '进度').replace('lane', '泳道').replace('updatedAt', '更新时间');
}

function renderJumbotronCalibrator({ trackProfile, runtime }) {
  const previewEntries = [0, 25, 50, 75, 100].map((progress, index) => ({ entryId: `preview-${progress}`, displayName: `${progress}%`, roundProgress: progress, laneOffsetIndex: index % trackProfile.laneOffsets.length, laneId: `lane-${index}`, motionState: progress === 100 ? 'finished' : 'running' }));
  const poses = previewEntries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
  return `<section class="jumbotron-calibrator"><div class="eyebrow">Track Profile 校准器 Preview</div><h2>设计侧预览</h2><div class="calibrator-grid"><article><strong>后续工具栏</strong><p class="muted">导入背景 · 导入候选 Profile · 校验 · 预览 · 导出</p></article><article><strong>预览画布</strong><p class="muted">背景 · 中心线 · 控制点 · 赛道预览 · 检查点 · 马匹预览 · 消息气泡预览</p></article><article><strong>后续检查器</strong><p class="muted">赛道信息 · 几何 · 起点/终点 · 方向 · 泳道 · 检查点 · 消息气泡 · 校验结果</p></article><article><strong>预览范围</strong><p class="muted">当前只验证 runtime 采样和多马位置，不提供导入、拖拽编辑或导出。</p></article></div><svg class="calibrator-preview-svg" viewBox="0 0 1200 620" role="img" aria-label="校准器预览"><rect class="track-bg" x="40" y="60" width="1120" height="500" rx="34"/><polyline class="track-centerline" points="${jumbotronPolyline(trackProfile.centerlinePath)}"/>${poses.map(({ entry, pose }) => `<g transform="translate(${pose.x} ${pose.y})"><circle r="15" fill="#a855f7" stroke="#f5d0fe" stroke-width="3"/><text class="debug-label" x="22" y="6">${escapeHtml(entry.displayName)}</text></g>`).join('')}</svg><p class="muted">预览复用同一套 track-runtime；完整 Calibrator MVP 需独立设计时工具继续实现。</p></section>`;
}

function renderJumbotronValidation({ debug, validation }) {
  const renderChecks = (checks) => checks.map(([label, ok]) => `<article><strong>${ok ? '✓' : '!' } ${escapeHtml(validationLabel(label))}</strong><p class="muted">${ok ? '通过' : '需要补齐'}</p></article>`).join('');
  return `<section class="jumbotron-debug"><div class="eyebrow">调试模式</div><h2>几何 / 运行时 / 待刷新</h2><div class="debug-grid"><article><strong>中心线</strong><p class="muted">${debug.sampledPoints.length} 个采样点</p></article><article><strong>泳道偏移</strong><p class="muted">${debug.laneOffsets.join(' / ')}</p></article><article><strong>检查点</strong><p class="muted">${debug.checkpoints.map((item) => item.label).join(' / ')}</p></article><article><strong>待刷新 Entry</strong><p class="muted">${debug.staleEntries.length || '无'}</p></article></div></section><section class="jumbotron-validation"><div class="eyebrow">校验结果</div><h2>Track Profile / 运行时 / 视觉</h2><h3>Track Profile 校验</h3><div class="validation-grid">${renderChecks(validation.trackChecks)}</div><h3>运行时校验</h3><div class="validation-grid">${renderChecks(validation.runtimeChecks)}</div><h3>视觉校验</h3><div class="validation-grid">${renderChecks(validation.visualChecks)}</div></section>`;
}

function renderJumbotronFooter({ trackProfile, raceSnapshot, showReviewTools }) {
  const competition = raceSnapshot.competition;
  const reviewHref = showReviewTools ? '/jumbotron' : '/jumbotron?debug=1';
  const reviewLabelText = showReviewTools ? '返回公开视图' : '打开审阅工具';
  return `<section class="jumbotron-footer"><article><div class="eyebrow">展示边界</div><h2>只展示摘要</h2><p class="muted">不展示完整 Session、终端日志、长文本评论流或复杂 diff。</p><div class="cta-row"><a class="button secondary" href="${reviewHref}">${reviewLabelText}</a></div></article><article><div class="eyebrow">赛事状态</div><h2>${escapeHtml(competition.liveStatus)}</h2><p class="muted">主题：${escapeHtml(competition.theme)}；主办方：${escapeHtml(competition.organizer || 'Organizer')}</p><p class="muted">阶段：${escapeHtml(competition.currentPhase)}；下一步：${escapeHtml(competition.nextPhase)}</p></article><article><div class="eyebrow">Track Template</div><h2>${escapeHtml(trackProfile.name || trackProfile.trackId)}</h2><p><span class="boundary-pill">背景资产</span><span class="boundary-pill">视图框</span><span class="boundary-pill">设计尺寸</span><span class="boundary-pill">中心线路径</span><span class="boundary-pill">起点</span><span class="boundary-pill">终点</span><span class="boundary-pill">检查点</span><span class="boundary-pill">泳道偏移</span><span class="boundary-pill">安全区</span></p></article><article id="remote-cockpit"><div class="eyebrow">远程 Racing Cockpit</div><h2>协作入口</h2><p class="muted">入口保留在大屏，不在此页展开完整协作流程。</p><p class="muted">系统时间：${escapeHtml(competition.systemTime)}</p></article></section>`;
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
      if (req.method === 'GET' && url.pathname === '/jumbotron') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderJumbotron(session, { showReviewTools: url.searchParams.get('debug') === '1' }));
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
