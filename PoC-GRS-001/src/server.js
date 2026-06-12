import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
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

function jumbotronBubbleAnimationCss() {
  const percent = (seconds, cycleSeconds) => Number(Math.min(100, (seconds / cycleSeconds) * 100).toFixed(2));
  const classes = JUMBOTRON_BUBBLE_CYCLE_OPTIONS.flatMap((cycleSeconds) => JUMBOTRON_BUBBLE_DURATIONS.map((durationSecond) => `.bubble-live-${durationSecond}-cycle-${cycleSeconds}{animation-name:jumbotronBubbleCycle${durationSecond}In${cycleSeconds}}`)).join('');
  const keyframes = JUMBOTRON_BUBBLE_CYCLE_OPTIONS.flatMap((cycleSeconds) => JUMBOTRON_BUBBLE_DURATIONS.map((durationSecond) => {
    const pop = percent(1.2, cycleSeconds);
    const settle = percent(2.2, cycleSeconds);
    const hold = percent(durationSecond, cycleSeconds);
    const fade = percent(durationSecond + 1.8, cycleSeconds);
    return `@keyframes jumbotronBubbleCycle${durationSecond}In${cycleSeconds}{0%,100%{opacity:0;transform:translate(var(--bubble-pop-x),var(--bubble-pop-y)) scale(.86)}${pop}%{opacity:1;transform:translate(0,0) scale(1.05)}${settle}%,${hold}%{opacity:1;transform:translate(0,0) scale(1)}${fade}%{opacity:0;transform:translate(var(--bubble-pop-x),var(--bubble-pop-y)) scale(.92)}}`;
  })).join('');
  return `${classes}${keyframes}`;
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
:root{--ink:#172033;--muted:#667085;--line:#d9dee8;--bg:#f4f6fb;--panel:#fff;--accent:#1f49d8;--dark:#121826;--green:#15734f;--green-bg:#e7f5ee;--amber:#9a6500;--amber-bg:#fff5d8;--red:#b42318;--red-bg:#fff1f0;--purple:#5b3fb5;--purple-bg:#f0ecff;--blue-bg:#edf4ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#e9efff 0,#f4f6fb 36%,#eef2f7 100%);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.jumbotron-page{width:calc(100vw - 44px);margin-left:calc(50% - 50vw + 22px);min-height:calc(100vh - 92px);background:linear-gradient(135deg,#f8fbff 0,#eef4ff 48%,#fff7ed 100%);color:#172033;border-radius:22px;padding:10px}.jumbotron-page .muted{color:#667085}.jumbotron-page a{text-decoration:none;color:inherit}.jumbotron-header,.jumbotron-kpis,.jumbotron-layout,.jumbotron-ticker,.jumbotron-debug,.jumbotron-calibrator,.jumbotron-validation,.jumbotron-footer{border:1px solid rgba(148,163,184,.32);background:rgba(255,255,255,.92);border-radius:18px;padding:12px;margin-bottom:8px;box-shadow:0 12px 28px rgba(31,73,216,.06)}.jumbotron-header{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:8px 12px}.jumbotron-brandline{display:flex;align-items:center;gap:10px;min-width:0}.jumbotron-brandline strong{font-size:18px;white-space:nowrap}.jumbotron-brandline span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.jumbotron-statusbar{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.jumbotron-statusbar span,.jumbotron-chip{border:1px solid rgba(148,163,184,.34);background:#fff;border-radius:999px;padding:6px 10px;font-weight:850;color:#344054}.jumbotron-live{display:inline-flex;border-radius:999px;background:#dc2626;color:#fff;padding:5px 10px;font-weight:900;letter-spacing:.08em}.jumbotron-kpis{display:flex;gap:8px;overflow:hidden;align-items:center;padding:8px 10px}.jumbotron-chip{display:flex;gap:6px;align-items:center;flex:0 0 auto}.jumbotron-chip strong{font-size:16px;color:#172033}.jumbotron-chip span{font-size:12px;color:#667085}.jumbotron-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:10px;align-items:stretch}.jumbotron-live-layout{grid-template-columns:280px minmax(0,1fr);height:clamp(620px,calc(100vh - 300px),780px)}.jumbotron-live-layout>aside{grid-column:1;grid-row:1}.jumbotron-live-layout>.track-stage-card{grid-column:2;grid-row:1}.track-stage-card{background:rgba(255,255,255,.78);border:1px solid rgba(148,163,184,.26);border-radius:18px;padding:10px}.track-stage-card h2{font-size:24px;margin:2px 0 6px}.track-svg{display:block;width:100%;height:auto;aspect-ratio:1200/620}.mini-map-svg{width:100%;height:128px;border-radius:12px;background:#f8fafc}.mini-map-svg .track-band{stroke-width:110}.mini-map-svg .track-centerline{stroke-width:12}.track-bg{fill:#f8fafc;stroke:rgba(31,73,216,.25);stroke-width:2}.track-band{fill:none;stroke:#d7e3f8;stroke-width:72;stroke-linecap:round;stroke-linejoin:round}.track-centerline{fill:none;stroke:#1f49d8;stroke-width:4;stroke-dasharray:10 10}.track-samples{fill:none;stroke:#f59e0b;stroke-width:2;stroke-dasharray:3 14}.horse-body{fill:#fff;stroke:#172033;stroke-width:3}.horse-arrow{fill:#2563eb}.horse-low .horse-arrow{fill:#22c55e}.horse-medium .horse-arrow{fill:#f59e0b}.horse-high .horse-arrow,.horse-critical .horse-arrow{fill:#ef4444}.horse-state-sprinting .horse-body,.horse-rank-leader .horse-body{filter:drop-shadow(0 0 10px rgba(37,99,235,.45));animation:jumbotronLowPulse 2.8s ease-in-out infinite}.horse-state-blocked .horse-body,.horse-state-takeover .horse-body,.horse-risk-critical .horse-body,.horse-risk-high .horse-body{stroke:#dc2626;stroke-width:4;filter:drop-shadow(0 0 10px rgba(220,38,38,.36))}.horse-state-finished .horse-body{stroke:#16a34a;stroke-width:4}.horse-state-stale .horse-body{stroke:#64748b;stroke-dasharray:5 4}.horse-status-pill text{font-size:11px;font-weight:950;fill:#172033;stroke:#fff;stroke-width:3px;paint-order:stroke}.horse-status-pill rect{fill:rgba(255,255,255,.92);stroke:rgba(23,32,51,.24);stroke-width:1.2}.track-alert-ring{fill:none;stroke:#ef4444;stroke-width:3;stroke-dasharray:8 6;opacity:.62;animation:jumbotronLowPulse 3.2s ease-in-out infinite}@keyframes jumbotronLowPulse{0%,100%{opacity:.82}50%{opacity:1}}.horse-label-group{pointer-events:visiblePainted}.horse-label-line{stroke:#172033;stroke-width:1.8;stroke-linecap:round;opacity:.34}.horse-label-bg{fill:none;stroke:none}.horse-label,.checkpoint text,.debug-label{fill:#172033;font-size:16px;font-weight:900;paint-order:stroke;stroke:#fff;stroke-width:4px}.message-bubble-anchor{opacity:0;transform-box:fill-box;transform-origin:center;animation-duration:var(--bubble-cycle);animation-delay:var(--bubble-start);animation-iteration-count:infinite;animation-timing-function:ease-in-out}.message-bubble-line{stroke:#1f49d8;stroke-width:2.5;stroke-linecap:round;opacity:.72}.message-bubble rect{fill:rgba(255,255,255,.96);stroke:#1f49d8;stroke-width:2}.message-bubble text{fill:#1d2939;font-size:13px;font-weight:800}${jumbotronBubbleAnimationCss()}.entry-tooltip{opacity:0;pointer-events:none;transition:opacity .12s ease}.jumbotron-focus-source:hover .entry-tooltip,.jumbotron-focus-source:focus .entry-tooltip,.jumbotron-focus-source:focus-within .entry-tooltip{opacity:1}.entry-tooltip rect{fill:rgba(15,23,42,.94);stroke:rgba(255,255,255,.72);stroke-width:1.5}.entry-tooltip text{fill:#fff;font-size:14px;font-weight:850;stroke:none}.jumbotron-focus-source{position:relative;outline:none}.html-tooltip{position:absolute;left:0;bottom:calc(100% + 8px);z-index:5;width:268px;background:#172033;color:#fff;border-radius:12px;padding:10px;box-shadow:0 16px 28px rgba(16,24,40,.22);opacity:0;pointer-events:none;transform:translateY(4px);transition:opacity .12s ease,transform .12s ease}.jumbotron-focus-source:hover .html-tooltip,.jumbotron-focus-source:focus .html-tooltip,.jumbotron-focus-source:focus-within .html-tooltip{opacity:1;transform:translateY(0)}.html-tooltip strong{display:block;color:#fff}.html-tooltip span{display:block;color:#dbeafe;font-size:12px;line-height:1.45}.ticker-item{position:relative;display:inline-flex}.ticker-item .html-tooltip{left:auto;right:0;bottom:calc(100% + 10px)}.focus-details-card{position:sticky;top:74px}.jumbotron-live-layout>aside{display:flex;flex-direction:column;height:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-right:2px}.jumbotron-live-layout .side-card:last-child{margin-bottom:0}.jumbotron-live-layout .focus-details-card{position:static}.jumbotron-live-layout>.track-stage-card{height:100%;display:flex;flex-direction:column;min-height:0}.jumbotron-live-layout .track-svg{flex:1;min-height:0;height:100%;aspect-ratio:auto}.focus-detail-list{display:grid;gap:8px}.focus-detail-card{display:none;border:1px solid rgba(31,73,216,.22);background:#f8fbff;border-radius:12px;padding:10px}.focus-detail-card:first-child{display:block}.focus-detail-list:has(.focus-detail-card:target) .focus-detail-card{display:none}.focus-detail-list:has(.focus-detail-card:target) .focus-detail-card:target{display:block}.focus-detail-card:target{outline:3px solid rgba(31,73,216,.24)}.focus-detail-card p{margin:6px 0}.focus-trigger{cursor:pointer}.side-card{background:rgba(255,255,255,.86);border:1px solid rgba(148,163,184,.28);border-radius:16px;padding:9px;margin-bottom:7px}.side-card h2,.jumbotron-debug h2,.jumbotron-calibrator h2,.jumbotron-validation h2{margin:3px 0 7px;color:#172033;font-size:18px}.side-card h3{margin:8px 0 5px;font-size:14px}.side-card p{margin:5px 0}.ranking-list{margin:0;padding-left:19px}.ranking-list li{margin:6px 0}.attention-item{border-radius:12px;background:rgba(127,29,29,.18);padding:7px;margin-top:6px}.attention-item-high,.attention-item-critical{box-shadow:inset 3px 0 0 #dc2626,0 0 0 1px rgba(220,38,38,.18);animation:jumbotronLowPulse 3.4s ease-in-out infinite}.gap-pill,.state-pill{display:inline-flex;border-radius:999px;background:#eef4ff;border:1px solid rgba(31,73,216,.18);padding:2px 7px;margin-left:4px;font-size:11px;font-weight:900;color:#1d2939}.state-pill-risk{background:#fff1f0;border-color:rgba(220,38,38,.28);color:#b42318}.focus-trigger strong{text-decoration-thickness:2px;text-underline-offset:3px}.focus-trigger:hover strong,.focus-trigger:focus strong{text-decoration:underline}.jumbotron-ticker{display:flex;gap:10px;align-items:center;overflow:hidden;padding:9px 12px}.jumbotron-ticker div{display:flex;gap:8px;overflow:hidden}.jumbotron-ticker span{flex:0 0 auto;background:#eef4ff;border-radius:999px;padding:7px 10px;color:#344054}.debug-grid,.validation-grid,.calibrator-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.debug-grid article,.validation-grid article,.calibrator-grid article{background:#fff;border:1px solid rgba(148,163,184,.26);border-radius:12px;padding:12px}.calibrator-preview-svg{width:100%;height:220px}.jumbotron-footer{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.boundary-pill{display:inline-flex;border:1px solid rgba(56,189,248,.35);border-radius:999px;padding:6px 9px;color:#bae6fd;margin:3px}.topbar{position:sticky;top:0;z-index:2;background:rgba(255,255,255,.96);color:#172033;border-bottom:1px solid rgba(148,163,184,.32);box-shadow:0 12px 28px rgba(31,73,216,.06)}.topbar-inner{max-width:1180px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{display:flex;align-items:center;gap:10px}.mark{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#e11d48,#f97316);box-shadow:inset 0 -10px 0 rgba(0,0,0,.18)}.brand strong{display:block;font-size:15px}.brand span{display:block;color:#667085;font-size:12px}.nav{display:flex;gap:4px;flex-wrap:wrap}.nav a,.identity a,.identity span{border-radius:8px;padding:8px 10px;text-decoration:none;font-weight:800}.nav a{color:#475467}.nav a.active,.nav a:hover{background:#eef4ff;color:#1f49d8}.identity{display:flex;align-items:center;gap:8px}.identity span,.identity a{background:#f8fafc;color:#172033;border:1px solid rgba(148,163,184,.32)}.workspace{max-width:1180px;margin:0 auto;padding:26px 22px}.hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr);gap:14px;margin-bottom:14px}.panel,.card,.notice{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:14px;padding:18px}.panel{box-shadow:0 18px 40px rgba(16,24,40,.07);position:relative;overflow:hidden}.hero-art:after{content:"";position:absolute;right:-70px;top:-70px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,#bfd2ff 0,#e8efff 42%,transparent 70%);opacity:.9}.public-hero{background:linear-gradient(90deg,rgba(255,255,255,.86) 0%,rgba(255,255,255,.62) 52%,rgba(255,255,255,.34) 100%),url('/assets/public-yard-hero.webp') center/cover}.public-hero:after{right:-30px;top:-40px;background:radial-gradient(circle,rgba(249,115,22,.24) 0,rgba(191,210,255,.18) 48%,transparent 72%)}.organizer-hero{background:linear-gradient(90deg,rgba(255,255,255,.96),rgba(255,255,255,.88)),url('/assets/organizer-source-visual.webp') center/cover}.organizer-hero:after{right:-40px;top:-50px;background:radial-gradient(circle,rgba(20,184,166,.22) 0,rgba(91,63,181,.18) 50%,transparent 74%)}.hero-art>*{position:relative;z-index:1}.visual-card{position:relative;overflow:hidden;min-height:190px}.organizer-card{background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,255,255,.8)),url('/assets/organizer-source-visual.webp') center/cover}.visual-card:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(31,73,216,.12),rgba(225,29,72,.08)),repeating-linear-gradient(135deg,transparent 0 18px,rgba(31,73,216,.06) 18px 19px);pointer-events:none}.organizer-card:before{background:linear-gradient(135deg,rgba(16,24,40,.1),rgba(20,184,166,.12)),radial-gradient(circle at 80% 20%,rgba(249,115,22,.16),transparent 42%)}.visual-card>*{position:relative;z-index:1}.service-hero{grid-template-columns:minmax(0,1fr) minmax(420px,.82fr)}.service-card{min-height:300px;padding:30px}.service-card h2{font-size:34px;line-height:1.08;margin:22px 0 18px}.service-card>p{font-size:19px;line-height:1.7}.service-card .signal{margin:22px 0}.service-card .signal-row{padding:22px;border-radius:18px;gap:16px}.service-card .signal-row strong{font-size:21px}.service-card .signal-row p{font-size:18px;line-height:1.65;margin:12px 0 0}.service-card .signal-dot{width:13px;height:20px;border-radius:999px;margin-top:4px}.service-card .button{width:100%;padding:17px 18px;border-radius:14px;font-size:18px}.panel h1{font-size:34px;line-height:1.08;margin:8px 0}.panel p,.card p,.notice p{color:var(--muted);line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.stack{display:grid;gap:12px}.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.eyebrow{letter-spacing:.08em;text-transform:uppercase;font-size:11px;font-weight:900;color:#667085}.pill{display:inline-flex;border-radius:7px;padding:4px 8px;font-size:12px;font-weight:900;background:#eef2ff;color:#243b83}.pill.green{background:var(--green-bg);color:var(--green)}.pill.amber{background:var(--amber-bg);color:var(--amber)}.pill.red{background:var(--red-bg);color:var(--red)}.pill.purple{background:var(--purple-bg);color:var(--purple)}.button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent);border-radius:9px;padding:10px 13px;background:var(--accent);color:#fff;font-weight:900;text-decoration:none;cursor:pointer}.button.secondary{background:#fff;color:#1d2939;border-color:var(--line)}.button.danger{background:#b42318;border-color:#b42318}.button.disabled{background:#eef2f7;color:#667085;border-color:#d0d5dd;cursor:not-allowed}.cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.metric-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}.metric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}.metric strong{display:block;font-size:24px;margin:6px 0 2px}.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:12px}.flow-step{border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px}.flow-step strong{display:block;margin-top:4px}.signal{display:grid;gap:10px}.signal-row{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}.signal-dot{width:11px;height:11px;border-radius:50%;background:#98a2b3;margin-top:7px}.signal-dot.green{background:#17b26a}.signal-dot.amber{background:#f79009}.signal-dot.red{background:#f04438}.action-list{display:grid;gap:10px}.action-item{display:flex;justify-content:space-between;gap:16px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px;text-decoration:none;color:var(--ink)}.action-item:hover{box-shadow:0 10px 24px rgba(16,24,40,.06)}.action-item strong{display:block;margin-bottom:4px}.action-item em{display:block;color:var(--muted);font-style:normal;line-height:1.45}.arrow{font-size:22px;font-weight:900;color:#98a2b3}.notice.ok{background:var(--green-bg);border-color:#b7ebd0}.notice.warn{background:var(--amber-bg);border-color:#f6dfa0}.notice.danger{background:var(--red-bg);border-color:#ffd0d0}form{display:grid;gap:12px}label{display:grid;gap:6px;font-weight:800;color:#344054}input,textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:11px;font:inherit;background:#fff}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}th,td{padding:11px 12px;border-bottom:1px solid #edf0f5;text-align:left;vertical-align:top}th{background:#f8fafc;color:#344054;font-size:12px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}.radar-panel{display:grid;grid-template-columns:minmax(260px,330px) minmax(0,1fr);gap:16px;align-items:center;margin-top:14px}.radar-svg{width:100%;max-width:330px}.radar-legend{display:grid;gap:8px;list-style:none;margin:0;padding:0}.radar-legend li{display:flex;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:9px 11px}.radar-score{font-weight:900;color:var(--accent)}.result-radar{margin-top:14px}.timeline{display:grid;gap:10px}.event{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px}.event-no{width:34px;height:34px;border-radius:50%;background:#101828;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}details{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}summary{cursor:pointer;list-style:none;padding:14px 16px;font-weight:900}summary::-webkit-details-marker{display:none}.details-body{border-top:1px solid var(--line);padding:14px 16px;background:#fbfcff}.muted{color:var(--muted)}@media(max-width:820px){.jumbotron-page{width:auto;margin-left:0}.jumbotron-header{align-items:flex-start;flex-direction:column}.jumbotron-layout{grid-template-columns:1fr}.jumbotron-live-layout>aside,.jumbotron-live-layout>.track-stage-card{grid-column:auto;grid-row:auto}.track-svg{height:520px}.topbar-inner{align-items:flex-start;flex-direction:column}.hero,.split,.radar-panel,.service-hero{grid-template-columns:1fr}.event{grid-template-columns:1fr}}
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
const JUMBOTRON_MIN_PATH_LENGTH_RATIO = 0.35;
const JUMBOTRON_MANUAL_CHECK_PENDING = { status: 'pending', label: '待人工复核' };
const JUMBOTRON_MANUAL_CHECK_CONFIRMED = { status: 'confirmed', label: '已人工确认' };
const JUMBOTRON_CURATED_MOCK_DIR = join(rootDir, 'jumbotron-mock-data', 'curated');
const JUMBOTRON_CURATED_RACE_SNAPSHOT_PATH = join(JUMBOTRON_CURATED_MOCK_DIR, 'race-snapshot.json');
const JUMBOTRON_CURATED_TRACK_PROFILE_PATH = join(JUMBOTRON_CURATED_MOCK_DIR, 'track.profile.json');
const JUMBOTRON_REVIEW_PACKAGE_DIR = join(rootDir, '..', 'Week2-Jumbotron', 'mock-data', 'review-package');
const JUMBOTRON_SMOKE_8_RACE_SNAPSHOT_PATH = join(JUMBOTRON_REVIEW_PACKAGE_DIR, 'smoke-race-snapshot-8.json');
const JUMBOTRON_COVERAGE_9_RACE_SNAPSHOT_PATH = join(JUMBOTRON_REVIEW_PACKAGE_DIR, 'smoke-race-snapshot-9-coverage.json');
const JUMBOTRON_EXPECTED_MOTION_STATES = ['idle', 'running', 'sprinting', 'slowed', 'blocked', 'pit_stop', 'takeover', 'finished', 'stale'];
const JUMBOTRON_EXPECTED_MESSAGE_TYPES = ['progress_update', 'milestone', 'strategy_change', 'quality_signal', 'risk_alert', 'obstacle', 'violation', 'takeover', 'pit_stop'];
const JUMBOTRON_EXPECTED_ATTENTION_CATEGORIES = ['risk', 'obstacle', 'violation'];
const JUMBOTRON_DATA_PROFILES = [
  {
    alias: 'full',
    canonicalId: 'curated-full-12',
    raceSnapshotPath: JUMBOTRON_CURATED_RACE_SNAPSHOT_PATH,
    trackProfilePath: JUMBOTRON_CURATED_TRACK_PROFILE_PATH,
    defaultUse: 'complete Jumbotron data evidence and pressure profile',
    recommendedSurface: ['/jumbotron default', '/jumbotron?debug=1', 'final completeness evidence'],
    notFor: ['the only video main-shot profile if labels and bubbles overload the screen'],
    validatorStatus: 'pass',
    expectedWarnings: []
  },
  {
    alias: 'smoke-8',
    canonicalId: 'smoke-8-visual-low-load',
    raceSnapshotPath: JUMBOTRON_SMOKE_8_RACE_SNAPSHOT_PATH,
    trackProfilePath: JUMBOTRON_CURATED_TRACK_PROFILE_PATH,
    defaultUse: 'low-load visual smoke and classroom screen candidate',
    recommendedSurface: ['video main shot', 'visual smoke review', 'label-bubble overlap review'],
    notFor: ['proving all 9 motion states', 'proving all 9 message types'],
    validatorStatus: 'pass_with_expected_warnings',
    expectedWarnings: [
      'motionState not covered: slowed',
      'motionState not covered: pit_stop',
      'motionState not covered: takeover',
      'message type not covered: takeover',
      'message type not covered: pit_stop'
    ]
  },
  {
    alias: 'coverage-9',
    canonicalId: 'coverage-9-enum-complete',
    raceSnapshotPath: JUMBOTRON_COVERAGE_9_RACE_SNAPSHOT_PATH,
    trackProfilePath: JUMBOTRON_CURATED_TRACK_PROFILE_PATH,
    defaultUse: 'coverage and validator evidence for all motion states and message types',
    recommendedSurface: ['debug coverage page', 'validator evidence', 'technical explanation segment'],
    notFor: ['lowest-load main visual screenshot'],
    validatorStatus: 'pass',
    expectedWarnings: []
  }
];
const JUMBOTRON_DATA_PROFILE_BY_KEY = new Map(JUMBOTRON_DATA_PROFILES.flatMap((profile) => [[profile.alias, profile], [profile.canonicalId, profile]]));
const JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS = 60;
const JUMBOTRON_BUBBLE_CYCLE_SECONDS = JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS;
const JUMBOTRON_BUBBLE_CYCLE_OPTIONS = [34, 42, 48, 60, 72, 84, 96, 108, 120];
const JUMBOTRON_BUBBLE_DURATIONS = [6, 8, 10, 12];
const JUMBOTRON_BUBBLE_VISIBLE_LIMIT = 3;
const JUMBOTRON_BUBBLE_SCHEDULE_LIMIT = 16;
const JUMBOTRON_BUBBLE_TARGET_VISIBLE_AVERAGE = 1.5;
const JUMBOTRON_BUBBLE_MIN_CYCLE_SECONDS = JUMBOTRON_BUBBLE_CYCLE_OPTIONS[0];
const JUMBOTRON_BUBBLE_MAX_CYCLE_SECONDS = JUMBOTRON_BUBBLE_CYCLE_OPTIONS[JUMBOTRON_BUBBLE_CYCLE_OPTIONS.length - 1];
const JUMBOTRON_BUBBLE_EVENT_GAP_SECONDS = 1;
const JUMBOTRON_BUBBLE_SPATIAL_GAP = 220;
const JUMBOTRON_HORSE_LABEL_FONT_SIZE = 16;
const JUMBOTRON_HORSE_LABEL_PADDING_X = 6;
const JUMBOTRON_HORSE_LABEL_PADDING_Y = 3;
const JUMBOTRON_HORSE_LABEL_INNER_GAP = 28;
const JUMBOTRON_HORSE_LABEL_OUTER_GAP = 52;
const JUMBOTRON_HORSE_LABEL_VIEWBOX_PADDING = 8;
const JUMBOTRON_HORSE_MARKER_BOX_SIZE = 44;

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
    debug: { sampleCount: 28, collisionBox: { width: 44, height: 44 }, staleThresholdMs: JUMBOTRON_STALE_THRESHOLD_MS, manualChecks: { horseOnTrack: JUMBOTRON_MANUAL_CHECK_CONFIRMED, curveNatural: JUMBOTRON_MANUAL_CHECK_PENDING, bubbleClearance: JUMBOTRON_MANUAL_CHECK_PENDING, checkpointMeaning: JUMBOTRON_MANUAL_CHECK_PENDING } },
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
    debug: { sampleCount: 28, collisionBox: { width: 44, height: 44 }, staleThresholdMs: JUMBOTRON_STALE_THRESHOLD_MS, manualChecks: { horseOnTrack: JUMBOTRON_MANUAL_CHECK_CONFIRMED, curveNatural: JUMBOTRON_MANUAL_CHECK_PENDING, bubbleClearance: JUMBOTRON_MANUAL_CHECK_PENDING, checkpointMeaning: JUMBOTRON_MANUAL_CHECK_PENDING } },
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

function allowedJumbotronDataProfiles() {
  return JUMBOTRON_DATA_PROFILES.map(({ alias, canonicalId }) => ({ alias, canonicalId }));
}

function resolveJumbotronDataProfile(profileParam = '') {
  const requested = String(profileParam || '').trim() || 'full';
  const profile = JUMBOTRON_DATA_PROFILE_BY_KEY.get(requested);
  const allowedProfiles = allowedJumbotronDataProfiles();
  if (!profile) return { ok: false, requestedProfile: requested, allowedProfiles };
  return {
    ok: true,
    requestedProfile: requested,
    selectedProfile: profile.alias,
    profileAlias: profile.alias,
    dataProfileId: profile.canonicalId,
    allowedProfiles,
    profile
  };
}

function readCuratedJumbotronMockData(profileResolution = resolveJumbotronDataProfile()) {
  const profile = profileResolution.profile;
  if (!profile || !existsSync(profile.raceSnapshotPath) || !existsSync(profile.trackProfilePath)) return null;
  return {
    profile: profileResolution,
    raceSnapshot: JSON.parse(readFileSync(profile.raceSnapshotPath, 'utf8')),
    trackProfile: JSON.parse(readFileSync(profile.trackProfilePath, 'utf8'))
  };
}

function dataProfileUrl(alias, showReviewTools = false) {
  const params = new URLSearchParams({ profile: alias });
  if (showReviewTools) params.set('debug', '1');
  return `/jumbotron?${params.toString()}`;
}

function renderJumbotronProfileSelector({ dataProfile, showReviewTools }) {
  return `<section class="jumbotron-debug"><div class="eyebrow">Data Profile</div><h2>数据档位</h2><div class="debug-grid">${JUMBOTRON_DATA_PROFILES.map((profile) => {
    const active = profile.alias === dataProfile.profileAlias;
    return `<article><strong>${active ? '✓ ' : ''}${escapeHtml(profile.alias)}</strong><p class="muted">dataProfileId=${escapeHtml(profile.canonicalId)}</p><p class="muted">${escapeHtml(profile.defaultUse)}</p><a class="button secondary" href="${escapeHtml(dataProfileUrl(profile.alias, showReviewTools))}">${active ? '当前档位' : '切换档位'}</a></article>`;
  }).join('')}</div></section>`;
}

function profileUsageGuard(profileResolution) {
  const profile = profileResolution.profile;
  return {
    selectedProfile: profileResolution.profileAlias,
    dataProfileId: profileResolution.dataProfileId,
    defaultFullProfile: profile.alias === 'full',
    smoke8VisualLowLoadOnly: profile.alias === 'smoke-8',
    coverage9EnumCoverageOnly: profile.alias === 'coverage-9',
    notFor: profile.notFor
  };
}

function coverageEvidence(values, expected) {
  const present = [...new Set(values.filter(Boolean))].sort();
  const missing = expected.filter((item) => !present.includes(item));
  return { expected, present, missing, complete: missing.length === 0 };
}

function publicHiddenEvidence(raceSnapshot) {
  const entries = raceSnapshot.entries || [];
  const messages = raceSnapshot.messages || [];
  const attentionItems = raceSnapshot.attentionItems || [];
  return {
    rawValuesExcludedFromEvidence: true,
    fields: [
      { field: 'remoteCockpitUrl', locations: ['entries'], count: entries.filter((entry) => Boolean(entry.remoteCockpitUrl)).length },
      { field: 'targetUrl', locations: ['messages'], count: messages.filter((message) => Boolean(message.targetUrl)).length },
      { field: 'targetUrl', locations: ['attentionItems'], count: attentionItems.filter((item) => Boolean(item.targetUrl)).length }
    ],
    publicRule: 'raw values are hidden from public page, debug panel, and JSON evidence endpoint'
  };
}

function resolveJumbotronEntryLastMessage(entry, messagesById) {
  const resolved = entry.latestMessageId ? messagesById.get(entry.latestMessageId) : null;
  if (resolved) return { resolved: true, fallbackUsed: false, latestMessageId: entry.latestMessageId, lastMessage: resolved };
  if (entry.latestMessage) {
    return {
      resolved: false,
      fallbackUsed: true,
      latestMessageId: entry.latestMessageId || null,
      lastMessage: {
        messageId: `fallback-${entry.entryId || 'entry'}`,
        entryId: entry.entryId,
        type: 'progress_update',
        severity: 'info',
        displayMode: 'ticker',
        summary: entry.latestMessage,
        createdAt: entry.updatedAt || 'unknown'
      }
    };
  }
  return { resolved: false, fallbackUsed: false, latestMessageId: entry.latestMessageId || null, lastMessage: null };
}

function lastMessageEvidenceForEntry(entry, messagesById) {
  const mapping = resolveJumbotronEntryLastMessage(entry, messagesById);
  const lastMessage = mapping.lastMessage;
  return {
    entryId: entry.entryId,
    latestMessageId: mapping.latestMessageId,
    latestMessagePresent: Boolean(entry.latestMessage),
    remoteCockpitUrlHidden: Object.hasOwn(entry, 'remoteCockpitUrl'),
    lastMessageResolved: mapping.resolved,
    resolved: mapping.resolved,
    fallbackUsed: mapping.fallbackUsed,
    lastMessage: lastMessage ? {
      type: lastMessage.type,
      displayMode: lastMessage.displayMode,
      summaryPresent: Boolean(lastMessage.summary),
      targetUrlHidden: Object.hasOwn(lastMessage, 'targetUrl')
    } : null,
    targetUrlHidden: lastMessage ? Object.hasOwn(lastMessage, 'targetUrl') : false
  };
}

function buildLastMessageMappingEvidence(raceSnapshot, profileResolution) {
  const entries = raceSnapshot.entries || [];
  const messagesById = new Map((raceSnapshot.messages || []).map((message) => [message.messageId, message]));
  const entryMappings = entries.map((entry) => lastMessageEvidenceForEntry(entry, messagesById));
  const syntheticEntry = entries[0] ? { ...entries[0], latestMessageId: '__missing_message_id__' } : { entryId: null, latestMessage: 'synthetic fallback summary', latestMessageId: '__missing_message_id__' };
  const syntheticFallback = lastMessageEvidenceForEntry(syntheticEntry, messagesById);
  const resolvedCount = entryMappings.filter((entry) => entry.lastMessageResolved).length;
  const fallbackCount = entryMappings.filter((entry) => entry.fallbackUsed).length;
  const missingLatestMessageIdCount = entryMappings.filter((entry) => !entry.latestMessageId).length;
  const unresolvedCount = entryMappings.filter((entry) => !entry.lastMessageResolved && !entry.fallbackUsed).length;
  return {
    dataProfileId: profileResolution.dataProfileId,
    profileAlias: profileResolution.profileAlias,
    rule: 'entry.latestMessageId + raceSnapshot.messages[] -> entry.lastMessage; fallback to entry.latestMessage summary',
    entryMappings,
    aggregate: {
      entryCount: entries.length,
      resolvedCount,
      fallbackCount,
      missingLatestMessageIdCount,
      unresolvedCount,
      syntheticMissingIdFallsBack: syntheticFallback.fallbackUsed === true
    },
    syntheticFallbackCheck: syntheticFallback
  };
}

function buildJumbotronDataEvidence(raceSnapshot, profileResolution) {
  const entries = raceSnapshot.entries || [];
  const messages = raceSnapshot.messages || [];
  const attentionItems = raceSnapshot.attentionItems || [];
  const profile = profileResolution.profile;
  const lastMessageMapping = buildLastMessageMappingEvidence(raceSnapshot, profileResolution);
  return {
    dataProfileId: profileResolution.dataProfileId,
    profileAlias: profileResolution.profileAlias,
    selectedProfile: profileResolution.selectedProfile,
    requestedProfile: profileResolution.requestedProfile,
    entryCount: entries.length,
    messageCount: messages.length,
    attentionItemCount: attentionItems.length,
    motionStateCoverage: coverageEvidence(entries.map((entry) => entry.motionState), JUMBOTRON_EXPECTED_MOTION_STATES),
    messageTypeCoverage: coverageEvidence(messages.map((message) => message.type), JUMBOTRON_EXPECTED_MESSAGE_TYPES),
    attentionCategoryCoverage: coverageEvidence(attentionItems.map((item) => item.category), JUMBOTRON_EXPECTED_ATTENTION_CATEGORIES),
    publicHiddenFields: publicHiddenEvidence(raceSnapshot),
    validatorStatus: profile.validatorStatus,
    expectedWarnings: profile.expectedWarnings,
    profileUsageGuard: profileUsageGuard(profileResolution),
    lastMessageMapping
  };
}

function renderJumbotronProfileError(session, profileResolution) {
  const allowed = profileResolution.allowedProfiles.map((profile) => `${profile.alias} (${profile.canonicalId})`).join(' / ');
  const content = `<section class="notice danger"><strong>Jumbotron data profile 不存在</strong><p>请求的 profile=${escapeHtml(profileResolution.requestedProfile)} 未配置；允许值：${escapeHtml(allowed)}。</p><div class="cta-row"><a class="button" href="/jumbotron?profile=full">回到 full</a></div></section>`;
  return page('Jumbotron profile 不存在', '/jumbotron', session, content);
}

function renderJumbotronBubbleSyncScript(profileAlias = 'full') {
  const endpoint = `/api/jumbotron-bubbles?profile=${encodeURIComponent(profileAlias)}`;
  return `<script>
(() => {
  const endpoint = '${escapeHtml(endpoint)}';
  const currentLayer = () => document.getElementById('jumbotron-bubble-layer');
  let version = currentLayer()?.dataset.bubbleVersion || '';
  async function syncBubbleLayer() {
    try {
      const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      const layer = currentLayer();
      if (!layer || !data.version || data.version === version || !data.bubbleLayerHtml) return;
      const template = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      template.innerHTML = data.bubbleLayerHtml;
      const nextLayer = template.querySelector('#jumbotron-bubble-layer');
      if (nextLayer) {
        layer.replaceWith(nextLayer);
        version = data.version;
      }
    } catch {}
  }
  window.setInterval(syncBubbleLayer, 2500);
})();
</script>`;
}

async function renderJumbotron(session, options = {}) {
  const profileResolution = resolveJumbotronDataProfile(options.profile);
  if (!profileResolution.ok) return renderJumbotronProfileError(session, profileResolution);
  const [disclosures, leaderboard, teams, records, service] = await Promise.all([
    readDisclosures(),
    readJson(leaderboardPath),
    readJson(teamsPath),
    readJson(recordsPath),
    readEvaluatorService()
  ]);
  const model = buildJumbotronModel(disclosures, leaderboard, teams, records, service, { profileResolution });
  const showReviewTools = Boolean(options.showReviewTools);
  const viewModel = { ...model, showReviewTools };
  const content = `<section class="jumbotron-page">
    ${renderJumbotronHeader(viewModel)}
    ${renderJumbotronProfileSelector(viewModel)}
    ${renderJumbotronKpis(model.raceSnapshot.kpi)}
    <section class="jumbotron-layout jumbotron-live-layout">
      ${renderJumbotronTrack(viewModel)}
      ${renderJumbotronSide(viewModel)}
    </section>
    ${renderJumbotronTicker(viewModel)}
    ${showReviewTools ? `${renderJumbotronDataEvidenceDebug(viewModel)}${renderJumbotronCalibrator(viewModel)}${renderJumbotronValidation(viewModel)}` : ''}
    ${renderJumbotronFooter(viewModel)}
    ${renderJumbotronBubbleSyncScript(model.dataProfile.profileAlias)}
  </section>`;
  return page('Jumbotron', '/jumbotron', session, content);
}

function buildJumbotronModel(disclosures, leaderboard, teams, records, service, options = {}) {
  const race = visibleDisclosures(disclosures)[0] || disclosures[0] || { raceId: 'grs-001', title: 'ARY GRS 001', status: 'draft', publicSummary: '等待公开摘要。', publicGoal: '等待 Organizer 披露。' };
  const profileResolution = options.profileResolution || resolveJumbotronDataProfile(options.profile);
  const curated = profileResolution.ok ? readCuratedJumbotronMockData(profileResolution) : null;
  const trackProfile = normalizeTrackProfile(curated?.trackProfile || jumbotronTrackProfiles[0]);
  const raceSnapshot = curated?.raceSnapshot || buildRaceSnapshot(race, leaderboard, teams, records, service);
  const dataProfile = curated?.profile || resolveJumbotronDataProfile('full');
  const adapted = adaptJumbotronSnapshot(raceSnapshot, trackProfile);
  const runtime = createJumbotronRuntime(trackProfile);
  const horsePoses = adapted.racingEntries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
  const messagePlan = planRidingMessages(adapted.ridingMessages, horsePoses, trackProfile);
  const debug = buildDebugModel(runtime, adapted.racingEntries, horsePoses, trackProfile);
  const validation = buildValidationModel(trackProfile, adapted, runtime, horsePoses, messagePlan);
  const dataEvidence = buildJumbotronDataEvidence(raceSnapshot, dataProfile);
  return { race, raceSnapshot, adapted, trackProfile, runtime, horsePoses, messagePlan, debug, validation, dataProfile, dataEvidence };
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
  if (entries.length) {
    const entry = entries.at(-1);
    messages.push({
      messageId: 'race-status-ticker',
      entryId: entry.entryId,
      source: 'runtime',
      type: 'quality_signal',
      severity: 'info',
      summary: '普通进展进入底部消息条，保持气泡降噪。',
      createdAt: 'now',
      displayMode: 'ticker',
      targetUrl: entry.remoteCockpitUrl
    });
  }
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
  const messagesById = new Map((raceSnapshot.messages || []).map((message) => [message.messageId, message]));
  return {
    competition: raceSnapshot.competition,
    kpi: raceSnapshot.kpi,
    racingEntries: raceSnapshot.entries.map((entry, index) => {
      const fallbackLane = trackProfile.lanes[index % trackProfile.lanes.length];
      const lane = trackProfile.lanes.find((item) => item.laneId === entry.laneId) || fallbackLane;
      const laneOffsetIndex = Math.max(0, trackProfile.lanes.findIndex((item) => item.laneId === lane.laneId));
      const caProvider = normalizeCaProvider(entry.caProvider);
      const costTokens = Number.isFinite(entry.costTokens) ? entry.costTokens : Number(entry.tokenCost || 0);
      const motionState = normalizeMotionState(entry.motionState || entry.status, entry.updatedAt);
      const lastMessageMapping = resolveJumbotronEntryLastMessage(entry, messagesById);
      return {
        ...entry,
        lastMessage: lastMessageMapping.lastMessage || entry.lastMessage,
        lastMessageResolved: lastMessageMapping.resolved,
        lastMessageFallbackUsed: lastMessageMapping.fallbackUsed,
        caProvider,
        primaryCA: entry.primaryCA || caProviderLabel(caProvider),
        costTokens,
        costUsd: Number.isFinite(entry.costUsd) ? entry.costUsd : Number((costTokens * 0.000015).toFixed(2)),
        obstacleCount: Number.isFinite(entry.obstacleCount) ? entry.obstacleCount : 0,
        violationCount: Number.isFinite(entry.violationCount) ? entry.violationCount : 0,
        updatedAt: entry.updatedAt || Date.now(),
        currentPhase: entry.currentPhase || raceSnapshot.competition.currentPhase || 'DEV',
        roundProgress: Number.isFinite(entry.roundProgress) ? Math.max(0, Math.min(100, entry.roundProgress)) : Math.max(0, Math.min(100, entry.overallProgress || 0)),
        laneId: lane.laneId,
        laneOffsetIndex,
        progressMapping: Number.isFinite(entry.roundProgress) ? 'roundProgress' : 'temporary_overallProgress',
        motionState,
        status: motionState
      };
    }),
    ridingMessages: raceSnapshot.messages,
    attentionItems: raceSnapshot.attentionItems
  };
}

function normalizeCaProvider(value) {
  return ['codex', 'claude', 'other'].includes(value) ? value : 'other';
}

function caProviderLabel(value) {
  return value === 'claude' ? 'Claude Code' : value === 'codex' ? 'Codex' : 'Other CA';
}

function updatedAtMs(value) {
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMotionState(state, updatedAt) {
  const allowed = new Set(['idle', 'running', 'sprinting', 'slowed', 'blocked', 'pit_stop', 'takeover', 'finished', 'stale']);
  if (allowed.has(state)) return state;
  const timestamp = updatedAtMs(updatedAt);
  if (timestamp && Date.now() - timestamp > JUMBOTRON_STALE_THRESHOLD_MS) return 'stale';
  return 'running';
}

function createJumbotronRuntime(trackProfile) {
  const segments = buildTrackSegments(trackProfile.centerlinePath);
  const pathLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const poseAtS = (entry, s) => {
    const clampedS = Math.max(0, Math.min(1, s));
    const sample = sampleTrackPath(segments, pathLength, clampedS);
    const lane = trackProfile.lanes.find((item) => item.laneId === entry.laneId) || trackProfile.lanes[entry.laneOffsetIndex % trackProfile.lanes.length] || trackProfile.lanes[0];
    const adjustment = trackProfile.displayAdjustment || { horseX: 0, horseY: 0 };
    const laneOffset = lane.offset;
    return {
      entryId: entry.entryId,
      x: sample.point.x + sample.normal.x * laneOffset + (adjustment.horseX || 0),
      y: sample.point.y + sample.normal.y * laneOffset + (adjustment.horseY || 0),
      rotation: sample.rotation,
      s: clampedS,
      laneId: lane.laneId,
      state: entry.motionState,
      zIndex: Math.round(1000 + clampedS * 100 + (entry.laneOffsetIndex || 0))
    };
  };
  return {
    pathLength,
    sampleHorsePose(entry) {
      return poseAtS(entry, entry.roundProgress / 100);
    },
    sampleInterpolatedPose(entry, previousS, nextS, t) {
      const s = previousS + (nextS - previousS) * Math.max(0, Math.min(1, t));
      return poseAtS(entry, s);
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

function messagePriority(type) {
  return ({ risk_alert: 4, obstacle: 3, violation: 3, milestone: 2, progress_update: 1, quality_signal: 1, strategy_change: 1, takeover: 1, pit_stop: 1 })[type] || 0;
}

function bubbleDurationSeconds(type) {
  const priority = messagePriority(type);
  if (priority >= 4) return 12;
  if (priority >= 3) return 10;
  if (priority >= 2) return 8;
  return 6;
}

function bubbleVisibleAtSecond(item, second, cycleSeconds = item.cycleSeconds || JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS) {
  const start = item.startSecond;
  const duration = item.durationSecond;
  if (duration >= cycleSeconds) return true;
  if (start + duration <= cycleSeconds) return second >= start && second < start + duration;
  return second >= start || second < (start + duration) % cycleSeconds;
}

function bubbleEndSecond(item, cycleSeconds) {
  return (item.startSecond + item.durationSecond) % cycleSeconds;
}

function circularSecondDistance(a, b, cycleSeconds) {
  const direct = Math.abs(a - b);
  return Math.min(direct, cycleSeconds - direct);
}

function bubbleAverageVisibleCount(bubbles, cycleSeconds) {
  if (!cycleSeconds) return 0;
  return bubbles.reduce((sum, item) => sum + item.durationSecond, 0) / cycleSeconds;
}

function maxOverlappingBubbles(bubbles, cycleSeconds = JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS) {
  return Math.max(0, ...Array.from({ length: cycleSeconds }, (_, second) => bubbles.filter((item) => bubbleVisibleAtSecond(item, second, cycleSeconds)).length));
}

function computeBubbleCycleSeconds(bubbles) {
  if (!bubbles.length) return JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS;
  const totalDuration = bubbles.reduce((sum, item) => sum + item.durationSecond, 0);
  return JUMBOTRON_BUBBLE_CYCLE_OPTIONS.reduce((best, cycleSeconds) => {
    const average = totalDuration / cycleSeconds;
    const score = Math.abs(average - JUMBOTRON_BUBBLE_TARGET_VISIBLE_AVERAGE) + (average > 1.8 ? 10 : 0);
    const bestAverage = totalDuration / best;
    const bestScore = Math.abs(bestAverage - JUMBOTRON_BUBBLE_TARGET_VISIBLE_AVERAGE) + (bestAverage > 1.8 ? 10 : 0);
    return score < bestScore ? cycleSeconds : best;
  }, JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS);
}

function bubbleEventSeconds(bubbles, cycleSeconds) {
  return bubbles.flatMap((item) => [item.startSecond, bubbleEndSecond(item, cycleSeconds)]);
}

function eventsHaveMinimumGap(bubbles, cycleSeconds) {
  const events = bubbleEventSeconds(bubbles, cycleSeconds);
  return events.every((eventSecond, index) => events.slice(index + 1).every((otherSecond) => circularSecondDistance(eventSecond, otherSecond, cycleSeconds) >= JUMBOTRON_BUBBLE_EVENT_GAP_SECONDS));
}

function rectCenterDistance(a, b) {
  const ax = a.centerX ?? a.x + a.width / 2;
  const ay = a.centerY ?? a.y + a.height / 2;
  const bx = b.centerX ?? b.x + b.width / 2;
  const by = b.centerY ?? b.y + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

function rectsSpatiallySeparated(a, b) {
  return !intersects(a, b) && rectCenterDistance(a, b) >= JUMBOTRON_BUBBLE_SPATIAL_GAP;
}

function visibleBubblesSpatiallySeparated(bubbles, rects, cycleSeconds) {
  return Array.from({ length: cycleSeconds }, (_, second) => bubbles
    .map((item, index) => ({ item, rect: rects[index] }))
    .filter(({ item }) => bubbleVisibleAtSecond(item, second, cycleSeconds)))
    .every((visible) => visible.every((current, index) => visible.slice(index + 1).every((other) => rectsSpatiallySeparated(current.rect, other.rect))));
}

function nearestEventDistance(bubbles, startSecond, durationSecond, cycleSeconds) {
  const events = bubbleEventSeconds(bubbles, cycleSeconds);
  if (!events.length) return cycleSeconds / 2;
  const endSecond = (startSecond + durationSecond) % cycleSeconds;
  return Math.min(...events.flatMap((eventSecond) => [circularSecondDistance(startSecond, eventSecond, cycleSeconds), circularSecondDistance(endSecond, eventSecond, cycleSeconds)]));
}

function scheduleBubbleStartSecond(bubbles, candidate, cycleSeconds, rects, candidateRect) {
  return Array.from({ length: cycleSeconds }, (_, second) => {
    const trial = [...bubbles, { ...candidate, startSecond: second, cycleSeconds }];
    const trialRects = [...rects, candidateRect];
    const overlap = maxOverlappingBubbles(trial, cycleSeconds);
    const eventsOk = eventsHaveMinimumGap(trial, cycleSeconds);
    const spatialOk = visibleBubblesSpatiallySeparated(trial, trialRects, cycleSeconds);
    const visibleDuringBubble = Array.from({ length: candidate.durationSecond }, (_, offset) => (second + offset) % cycleSeconds)
      .map((moment) => trial.filter((item) => bubbleVisibleAtSecond(item, moment, cycleSeconds)).length);
    const averageDuringBubble = visibleDuringBubble.reduce((sum, value) => sum + value, 0) / visibleDuringBubble.length;
    const eventDistance = nearestEventDistance(bubbles, second, candidate.durationSecond, cycleSeconds);
    const score = (overlap > JUMBOTRON_BUBBLE_VISIBLE_LIMIT ? 100000 : 0)
      + (eventsOk ? 0 : 40000)
      + (spatialOk ? 0 : 20000)
      + Math.abs(averageDuringBubble - JUMBOTRON_BUBBLE_TARGET_VISIBLE_AVERAGE) * 100
      + Math.max(0, JUMBOTRON_BUBBLE_EVENT_GAP_SECONDS * 3 - eventDistance) * 25
      + (second % JUMBOTRON_BUBBLE_EVENT_GAP_SECONDS);
    return { second, score };
  }).sort((a, b) => a.score - b.score || a.second - b.second)[0].second;
}

function bubbleLiveClass(durationSecond, cycleSeconds = JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS) {
  return `bubble-live-${durationSecond}-cycle-${cycleSeconds}`;
}

function bubbleSizeHintForMessage(message) {
  return Math.min(31, Math.max(15, String(message.summary || '').length));
}

function bubbleWidthFromSizeHint(sizeHint) {
  return Math.min(260, Math.max(150, 44 + Number(sizeHint || 0) * 7));
}

function stableHash(value) {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return hash.toString(16);
}

function bubbleQueueVersion(queue) {
  return stableHash(queue.map((item) => ({ queueId: item.queueId, entryId: item.entryId, priority: item.priority, durationSecond: item.durationSecond, sizeHint: item.sizeHint, updatedAt: item.updatedAt })));
}

function buildBubbleQueue(messages, horsePoses) {
  return [...messages]
    .sort((a, b) => messagePriority(b.type) - messagePriority(a.type))
    .map((message, index) => {
      const pose = horsePoses.find((item) => item.entry.entryId === message.entryId)?.pose;
      return {
        queueId: message.messageId || `${message.entryId}-${index}`,
        entryId: message.entryId,
        pose,
        priority: messagePriority(message.type),
        durationSecond: bubbleDurationSeconds(message.type),
        sizeHint: bubbleSizeHintForMessage(message),
        displayMode: message.displayMode || 'bubble',
        placementSeed: index % 4,
        payloadRef: message.messageId || `${message.entryId}-${index}`,
        updatedAt: message.createdAt || ''
      };
    });
}

function canPromoteBubbleQueueItem() {
  return true;
}

function planBubbleQueue(queueItems, trackProfile) {
  const usedEntries = new Set();
  const bubbles = [];
  const rejectedQueue = [];
  for (const item of queueItems) {
    const canBubble = item.pose && !usedEntries.has(item.entryId) && bubbles.length < JUMBOTRON_BUBBLE_SCHEDULE_LIMIT && canPromoteBubbleQueueItem(item) && isBubbleEligiblePose(item.pose, trackProfile);
    if (canBubble) {
      const slotIndex = bubbles.length;
      usedEntries.add(item.entryId);
      bubbles.push({ ...item, slotIndex, placementSeed: slotIndex % 4 });
    } else {
      rejectedQueue.push(item);
    }
  }
  const cycleSeconds = computeBubbleCycleSeconds(bubbles);
  const candidateRects = mapBubbleQueueToGeometry(trackProfile, bubbles);
  const plannedBubbles = [];
  const bubbleRects = [];
  for (const candidate of bubbles) {
    const rect = candidateRects[candidate.slotIndex];
    const startSecond = scheduleBubbleStartSecond(plannedBubbles, candidate, cycleSeconds, bubbleRects, rect);
    const bubble = { ...candidate, startSecond, cycleSeconds, liveClass: bubbleLiveClass(candidate.durationSecond, cycleSeconds) };
    plannedBubbles.push(bubble);
    bubbleRects.push(rect);
  }
  const averageVisibleCount = Number(bubbleAverageVisibleCount(plannedBubbles, cycleSeconds).toFixed(2));
  return { bubbles: plannedBubbles, rejectedQueue, rules: { oneBubblePerEntry: true, visibleBubbleLimit: JUMBOTRON_BUBBLE_VISIBLE_LIMIT, scheduledBubbleLimit: JUMBOTRON_BUBBLE_SCHEDULE_LIMIT, targetVisibleAverage: JUMBOTRON_BUBBLE_TARGET_VISIBLE_AVERAGE, averageVisibleCount, cycleSeconds, eventGapSeconds: JUMBOTRON_BUBBLE_EVENT_GAP_SECONDS, spatialGap: JUMBOTRON_BUBBLE_SPATIAL_GAP, priority: 'risk_alert > obstacle / violation > milestone > normal', tickerFallback: rejectedQueue.length > 0 } };
}

function planRidingMessages(messages, horsePoses, trackProfile) {
  const queue = buildBubbleQueue(messages, horsePoses);
  const messageByRef = new Map(messages.map((message, index) => [message.messageId || `${message.entryId}-${index}`, message]));
  const plan = planBubbleQueue(queue, trackProfile);
  const tickerRefs = new Set([...plan.rejectedQueue.map((item) => item.payloadRef), ...queue.filter((item) => item.displayMode === 'ticker').map((item) => item.payloadRef)]);
  return {
    ...plan,
    queue,
    version: bubbleQueueVersion(queue),
    bubbles: plan.bubbles.map((item) => ({ ...item, message: messageByRef.get(item.payloadRef) })),
    ticker: [...tickerRefs].map((ref) => messageByRef.get(ref)).filter(Boolean)
  };
}

function isBubbleEligiblePose(pose, trackProfile) {
  return poseWithinViewBox(pose, trackProfile.viewBox)
    && !trackProfile.noBubbleZones.some((zone) => pose.x >= zone.x && pose.x <= zone.x + zone.width && pose.y >= zone.y && pose.y <= zone.y + zone.height);
}

function isInSafeZone(pose, trackProfile) {
  return trackProfile.safeZones.some((zone) => pose.x >= zone.x && pose.x <= zone.x + zone.width && pose.y >= zone.y && pose.y <= zone.y + zone.height)
    && !trackProfile.noBubbleZones.some((zone) => pose.x >= zone.x && pose.x <= zone.x + zone.width && pose.y >= zone.y && pose.y <= zone.y + zone.height);
}

function buildDebugModel(runtime, entries, horsePoses, trackProfile) {
  const firstEntry = entries[0] || { entryId: 'preview', roundProgress: 0, laneOffsetIndex: 0, laneId: trackProfile.lanes[0]?.laneId, motionState: 'running' };
  return {
    sampledPoints: runtime.samplePoints(28),
    laneOffsets: trackProfile.laneOffsets,
    checkpoints: trackProfile.checkpoints.map((checkpoint) => ({ ...checkpoint, pose: runtime.samplePoint(checkpoint.s) })),
    horseSValues: horsePoses.map(({ entry, pose }) => `${entry.displayName}: ${Math.round(pose.s * 100)}%`),
    collisionBoxes: horsePoses.map(({ pose }) => ({ x: pose.x - 22, y: pose.y - 22, width: 44, height: 44 })),
    staleEntries: entries.filter((entry) => entry.motionState === 'stale'),
    motionStates: ['idle', 'running', 'sprinting', 'slowed', 'blocked', 'pit_stop', 'takeover', 'finished', 'stale'],
    interpolationEvidence: runtime.sampleInterpolatedPose(firstEntry, 0.1, 0.4, 0.5),
    messageRules: ['每个 Entry 每轮最多一个动态气泡', '自适应循环平均约 1.5 条可见气泡', '任意时刻最多 3 条且空间分散', '气泡冒出 / 消失事件错峰', '风险 / 里程碑优先', '无合适位置 fallback ticker'],
    manualChecks: trackProfile.debug?.manualChecks || {}
  };
}

function buildValidationModel(trackProfile, adapted, runtime, horsePoses, messagePlan) {
  const multiHorsePreview = buildMultiHorsePreview(trackProfile, runtime);
  return {
    contractChecks: validateJumbotronContract(adapted),
    trackChecks: validateTrackProfile(trackProfile, runtime),
    runtimeChecks: adapted.racingEntries.flatMap((entry) => validateRuntimeEntry(entry, trackProfile)),
    visualChecks: validateVisualLayout(trackProfile, horsePoses, messagePlan, multiHorsePreview),
    multiHorsePreview
  };
}

function validateJumbotronContract(adapted) {
  return [
    ['competitionId', Boolean(adapted.competition?.competitionId)],
    ['competition metadata', ['title', 'subtitle', 'theme', 'organizer', 'liveStatus', 'currentPhase', 'currentRound', 'nextPhase', 'elapsedTime', 'systemTime'].every((key) => Object.hasOwn(adapted.competition || {}, key))],
    ['activeCockpits', Number.isFinite(adapted.kpi?.activeCockpits)],
    ['KPI obstacleCount', Number.isFinite(adapted.kpi?.obstacleCount)],
    ['KPI violationCount', Number.isFinite(adapted.kpi?.violationCount)],
    ['caProvider contract', adapted.racingEntries.every((entry) => ['codex', 'claude', 'other'].includes(entry.caProvider))],
    ['costTokens mapping', adapted.racingEntries.every((entry) => Number.isFinite(entry.costTokens))],
    ['entry updatedAt contract', adapted.racingEntries.every((entry) => updatedAtMs(entry.updatedAt) !== null)],
    ['entry currentPhase contract', adapted.racingEntries.every((entry) => Boolean(entry.currentPhase))]
  ];
}

function validateTrackProfile(trackProfile, runtime) {
  const points = trackProfile.centerlinePath;
  const backgroundExists = trackBackgroundExists(trackProfile);
  const minPathLength = minimumTrackPathLength(trackProfile.viewBox);
  const sampledPoints = runtime.samplePoints(trackProfile.debug?.sampleCount || 28);
  const adjacentDistances = sampledPoints.slice(1).map((point, index) => Math.hypot(point.x - sampledPoints[index].x, point.y - sampledPoints[index].y));
  const closed = Boolean(trackProfile.centerline?.closed);
  return [
    ['schemaVersion', Boolean(trackProfile.schemaVersion)],
    ['trackId', Boolean(trackProfile.trackId)],
    ['name', Boolean(trackProfile.name)],
    ['viewBox', Boolean(trackProfile.viewBox) && trackProfile.viewBox.width > 0 && trackProfile.viewBox.height > 0],
    ['background', Boolean(trackProfile.background?.src || trackProfile.backgroundAsset)],
    ['centerline type', trackProfile.centerline?.type === 'polyline'],
    ['centerline closed', !closed || samePoint(points[0], points.at(-1))],
    ['closed point count', !closed || points.length >= 4],
    ['open point count', closed || points.length >= 2],
    ['centerline points', points.length >= 2],
    ['direction', ['clockwise', 'counterclockwise'].includes(trackProfile.direction)],
    ['startFinish', Number.isFinite(trackProfile.startFinish?.startS) && Number.isFinite(trackProfile.startFinish?.finishS) && trackProfile.startFinish.startS >= 0 && trackProfile.startFinish.finishS <= 1],
    ['startFinish.s', [trackProfile.startFinish?.startS, trackProfile.startFinish?.finishS].every((s) => Number.isFinite(s) && s >= 0 && s <= 1)],
    ['checkpoints.s', trackProfile.checkpoints.every((checkpoint) => Number.isFinite(checkpoint.s) && checkpoint.s >= 0 && checkpoint.s <= 1)],
    ['lanes', trackProfile.lanes.length >= 1 && trackProfile.lanes.every((lane) => lane.laneId && Number.isFinite(lane.offset))],
    ['lane offsets unique', new Set(trackProfile.lanes.map((lane) => lane.offset)).size === trackProfile.lanes.length],
    ['lane offset duplicate', new Set(trackProfile.lanes.map((lane) => lane.offset)).size === trackProfile.lanes.length],
    ['profile schema', trackProfile.schemaVersion === JUMBOTRON_TRACK_PROFILE_SCHEMA_VERSION],
    ['background file exists', backgroundExists],
    ['background asset allowlist', JUMBOTRON_BACKGROUND_ASSETS.has(trackProfile.background?.src)],
    ['checkpoints', trackProfile.checkpoints.every((checkpoint) => checkpoint.s >= 0 && checkpoint.s <= 1)],
    ['NaN / Infinity', sampledPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))],
    ['sample finite', sampledPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))],
    ['sample continuity', adjacentDistances.every((distance) => distance > 0 && distance < 180)],
    ['sample jump warning', adjacentDistances.every((distance) => distance > 0 && distance < 180)],
    ['curvature warning', maxTurnAngle(points) < 135],
    ['turn angle warning', maxTurnAngle(points) < 135],
    ['path length', Number.isFinite(runtime.pathLength) && runtime.pathLength >= minPathLength],
    ['path length minimum threshold', Number.isFinite(runtime.pathLength) && runtime.pathLength >= minPathLength]
  ];
}

function validateRuntimeEntry(entry, trackProfile) {
  const timestamp = updatedAtMs(entry.updatedAt);
  const backgroundExists = trackBackgroundExists(trackProfile);
  return [
    [`${entry.displayName} 进度`, entry.roundProgress >= 0 && entry.roundProgress <= 100],
    [`${entry.displayName} 泳道`, trackProfile.lanes.some((lane) => lane.laneId === entry.laneId)],
    [`${entry.displayName} updatedAt`, timestamp !== null],
    [`${entry.displayName} 更新时间`, timestamp !== null],
    [`${entry.displayName} 进度映射`, entry.progressMapping === 'roundProgress'],
    [`${entry.displayName} 状态`, ['idle', 'running', 'sprinting', 'slowed', 'blocked', 'pit_stop', 'takeover', 'finished', 'stale'].includes(entry.motionState)],
    [`${entry.displayName} caProvider`, ['codex', 'claude', 'other'].includes(entry.caProvider || 'other')],
    [`${entry.displayName} CA`, ['codex', 'claude', 'other'].includes(entry.caProvider || 'other')],
    [`${entry.displayName} primaryCA display`, Boolean(entry.primaryCA)],
    [`${entry.displayName} obstacleCount`, Number.isFinite(entry.obstacleCount)],
    [`${entry.displayName} violationCount`, Number.isFinite(entry.violationCount)],
    [`${entry.displayName} currentPhase`, Boolean(entry.currentPhase)],
    [`${entry.displayName} costTokens`, Number.isFinite(entry.costTokens)],
    [`${entry.displayName} token`, Number.isFinite(entry.costTokens || entry.tokenCost)],
    [`${entry.displayName} profile schema`, trackProfile.schemaVersion === JUMBOTRON_TRACK_PROFILE_SCHEMA_VERSION],
    [`${entry.displayName} profile version mismatch`, trackProfile.schemaVersion === JUMBOTRON_TRACK_PROFILE_SCHEMA_VERSION],
    [`${entry.displayName} background file exists`, backgroundExists],
    [`${entry.displayName} background asset allowlist`, JUMBOTRON_BACKGROUND_ASSETS.has(trackProfile.background?.src)],
    [`${entry.displayName} stale threshold`, entry.motionState !== 'stale' || (timestamp !== null && Date.now() - timestamp >= JUMBOTRON_STALE_THRESHOLD_MS)]
  ];
}

function validateVisualLayout(trackProfile, horsePoses, messagePlan, multiHorsePreview = buildMultiHorsePreview(trackProfile)) {
  const bubbleEntryCounts = messagePlan.bubbles.reduce((counts, item) => counts.set(item.message.entryId, (counts.get(item.message.entryId) || 0) + 1), new Map());
  const bubbleRects = estimateBubbleRects(trackProfile, messagePlan.bubbles);
  const labelLayout = buildHorseLabelLayout({ horsePoses, trackProfile, messageBubbleRects: bubbleRects, viewBox: trackProfile.viewBox });
  const bubblesAvoidHeader = bubbleRects.every((rect) => !intersects(rect, topReservedRect(trackProfile)));
  const bubbleDurations = new Set(JUMBOTRON_BUBBLE_DURATIONS);
  const cycleSeconds = messagePlan.rules?.cycleSeconds || JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS;
  const averageVisibleCount = bubbleAverageVisibleCount(messagePlan.bubbles, cycleSeconds);
  const bubbleTimingValid = JUMBOTRON_BUBBLE_CYCLE_OPTIONS.includes(cycleSeconds) && messagePlan.bubbles.every((item) => item.startSecond >= 0 && item.startSecond < cycleSeconds && bubbleDurations.has(item.durationSecond));
  const bubbleOverlapValid = maxOverlappingBubbles(messagePlan.bubbles, cycleSeconds) <= JUMBOTRON_BUBBLE_VISIBLE_LIMIT;
  const bubbleAverageValid = messagePlan.bubbles.length < 3 ? averageVisibleCount <= 1.8 : averageVisibleCount >= 1.2 && averageVisibleCount <= 1.8;
  const bubbleEventStaggeringValid = eventsHaveMinimumGap(messagePlan.bubbles, cycleSeconds);
  const bubbleSpatialSeparationValid = visibleBubblesSpatiallySeparated(messagePlan.bubbles, bubbleRects, cycleSeconds);
  const horseDistances = horsePoses.flatMap((item, index) => horsePoses.slice(index + 1).map((other) => Math.hypot(item.pose.x - other.pose.x, item.pose.y - other.pose.y)));
  const manualChecks = trackProfile.debug?.manualChecks || {};
  return [
    ['horse on track', horsePoses.every(({ pose }) => poseWithinViewBox(pose, trackProfile.viewBox))],
    ['one bubble per entry', [...bubbleEntryCounts.values()].every((count) => count <= 1)],
    ['scheduled bubble limit', messagePlan.bubbles.length <= JUMBOTRON_BUBBLE_SCHEDULE_LIMIT],
    ['visible bubble limit', bubbleOverlapValid],
    ['bubble timing range', bubbleTimingValid],
    ['bubble average visible', bubbleAverageValid],
    ['bubble event staggering', bubbleEventStaggeringValid],
    ['bubble spatial separation', bubbleSpatialSeparationValid],
    ['bubble avoids header', bubblesAvoidHeader],
    ['bubble rectangle top-overlap', bubblesAvoidHeader],
    ['bubble top-overlap', bubblesAvoidHeader],
    ['horse label layout generated', labelLayout.items.length === horsePoses.length],
    ['horse label bbox in viewBox', labelLayout.summary.outOfViewBox === 0],
    ['horse label-label overlap', labelLayout.summary.labelLabelOverlaps === 0],
    ['horse label-marker overlap', labelLayout.summary.labelMarkerOverlaps === 0],
    ['horse label-bubble overlap', labelLayout.summary.labelBubbleOverlaps === 0],
    ['horse overlap', horseDistances.every((distance) => distance > 32)],
    ['multi-horse preview count', multiHorsePreview.count >= 8],
    ['multi-horse preview in viewBox', multiHorsePreview.inViewBox],
    ['multi-horse preview distance', multiHorsePreview.minDistance > 24],
    ['multi-horse preview severe overlap', !multiHorsePreview.severeOverlap],
    ['multi-horse preview turn direction', multiHorsePreview.turnDirectionsValid],
    ['multi-horse preview', multiHorsePreview.count >= 8 && multiHorsePreview.inViewBox && !multiHorsePreview.severeOverlap],
    ['checkpoint semantics', trackProfile.checkpoints.length >= 3],
    ['16:9 stable', trackProfile.designSize?.aspectRatio === '16:9'],
    ['two tracks ready', jumbotronTrackProfiles.length >= 2],
    ['eight lane preview', multiHorsePreview.count >= 8],
    ['ticker fallback', messagePlan.ticker.length > 0 || messagePlan.rules?.tickerFallback],
    ['risk milestone priority', messagePlan.bubbles.every((item, index, list) => index === 0 || messagePriority(list[index - 1].message.type) >= messagePriority(item.message.type))],
    ['manual horse-on-track confirmation', manualCheckStatus(manualChecks.horseOnTrack) === 'confirmed'],
    ['manual curve confirmation', manualCheckStatus(manualChecks.curveNatural) === 'confirmed'],
    ['manual bubble clearance confirmation', manualCheckStatus(manualChecks.bubbleClearance) === 'confirmed'],
    ['manual checkpoint confirmation', manualCheckStatus(manualChecks.checkpointMeaning) === 'confirmed']
  ];
}

function trackBackgroundFilePath(src) {
  const value = String(src || '');
  if (!value.startsWith('/assets/') || value.includes('..')) return null;
  return join(rootDir, 'assets', value.slice('/assets/'.length));
}

function trackBackgroundExists(trackProfile) {
  const filePath = trackBackgroundFilePath(trackProfile.background?.src);
  return Boolean(filePath && existsSync(filePath));
}

function poseWithinViewBox(pose, viewBox) {
  return Boolean(viewBox) && pose.x >= viewBox.x && pose.x <= viewBox.x + viewBox.width && pose.y >= viewBox.y && pose.y <= viewBox.y + viewBox.height;
}

function minimumTrackPathLength(viewBox = {}) {
  const diagonal = Math.hypot(Number(viewBox.width) || 0, Number(viewBox.height) || 0);
  return Math.max(240, diagonal * JUMBOTRON_MIN_PATH_LENGTH_RATIO);
}

function buildMultiHorsePreview(trackProfile, runtime = createJumbotronRuntime(trackProfile)) {
  const lanes = trackProfile.lanes.slice(0, 8);
  const entries = lanes.map((lane, index) => ({ entryId: `multi-${index}`, displayName: `Horse ${index + 1}`, roundProgress: 48 + index * 2, laneOffsetIndex: index, laneId: lane.laneId, motionState: 'running' }));
  const poses = entries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
  const distances = poses.flatMap((item, index) => poses.slice(index + 1).map((other) => Math.hypot(item.pose.x - other.pose.x, item.pose.y - other.pose.y)));
  const rotations = poses.map((item) => item.pose.rotation);
  return {
    count: poses.length,
    poses,
    inViewBox: poses.every(({ pose }) => poseWithinViewBox(pose, trackProfile.viewBox)),
    minDistance: distances.length ? Math.min(...distances) : 0,
    severeOverlap: distances.some((distance) => distance <= 24),
    turnDirectionsValid: rotations.every((rotation) => Number.isFinite(rotation) && Math.abs(rotation) <= 180)
  };
}

function topReservedRect(trackProfile) {
  return { x: trackProfile.viewBox.x, y: trackProfile.viewBox.y, width: trackProfile.viewBox.width, height: 96 };
}

function bubbleOverflow(rect, viewBox, padding) {
  const left = Math.max(0, viewBox.x + padding - rect.x);
  const top = Math.max(0, viewBox.y + padding - rect.y);
  const right = Math.max(0, rect.x + rect.width - (viewBox.x + viewBox.width - padding));
  const bottom = Math.max(0, rect.y + rect.height - (viewBox.y + viewBox.height - padding));
  return left + top + right + bottom;
}

function distanceFromPoseToRect(pose, rect) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  return Math.hypot(centerX - pose.x, centerY - pose.y);
}

function bubbleAnchorForPlacement(pose, rect, placement) {
  const anchor = {
    right: { x: rect.x, y: rect.y + rect.height / 2 },
    left: { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
    bottom: { x: rect.x + rect.width / 2, y: rect.y },
    top: { x: rect.x + rect.width / 2, y: rect.y + rect.height }
  }[placement] || { x: rect.x, y: rect.y + rect.height / 2 };
  return { x1: pose.x, y1: pose.y, x2: anchor.x, y2: anchor.y };
}

function bubblePlacementPreferences(seed = 0) {
  const orders = [
    ['right', 'left', 'bottom', 'top'],
    ['left', 'right', 'top', 'bottom'],
    ['bottom', 'top', 'right', 'left'],
    ['top', 'bottom', 'left', 'right']
  ];
  return Object.fromEntries((orders[Math.abs(seed) % orders.length] || orders[0]).map((placement, index) => [placement, index * 4]));
}

function bubblePopOffset(placement) {
  return ({ right: { x: -12, y: 0 }, left: { x: 12, y: 0 }, bottom: { x: 0, y: -12 }, top: { x: 0, y: 12 } })[placement] || { x: -12, y: 0 };
}

function mapBubbleQueueToGeometry(trackProfile, queueItems) {
  return estimateBubbleRects(trackProfile, queueItems);
}

function svgNumber(value) {
  return Number(Number(value).toFixed(2));
}

function clampRectToViewBox(rect, viewBox, padding = 0) {
  const minX = viewBox.x + padding;
  const minY = viewBox.y + padding;
  const maxX = viewBox.x + viewBox.width - rect.width - padding;
  const maxY = viewBox.y + viewBox.height - rect.height - padding;
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(rect.y, minY), Math.max(minY, maxY))
  };
}

function rectOverlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function estimateHorseLabelTextWidth(text, fontSize = JUMBOTRON_HORSE_LABEL_FONT_SIZE) {
  return Array.from(String(text || '')).reduce((width, char) => {
    if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(char)) return width + fontSize * 0.92;
    if (/\s|[·%.,:;!?/\\|()\[\]{}\-+]/u.test(char)) return width + fontSize * 0.28;
    return width + fontSize * 0.56;
  }, 0);
}

function estimateHorseLabelSize(text) {
  const fontSize = JUMBOTRON_HORSE_LABEL_FONT_SIZE;
  const paddingX = JUMBOTRON_HORSE_LABEL_PADDING_X;
  const paddingY = JUMBOTRON_HORSE_LABEL_PADDING_Y;
  return {
    width: Math.ceil(estimateHorseLabelTextWidth(text, fontSize) + paddingX * 2),
    height: Math.ceil(fontSize + paddingY * 2 + 2),
    fontSize,
    paddingX,
    paddingY
  };
}

function markerRectForPose(pose) {
  const size = JUMBOTRON_HORSE_MARKER_BOX_SIZE;
  return { x: pose.x - size / 2, y: pose.y - size / 2, width: size, height: size };
}

function horseLabelCandidateOrder() {
  return [
    ['inner', 'NE'], ['inner', 'E'], ['inner', 'SE'], ['inner', 'N'], ['inner', 'S'], ['inner', 'NW'], ['inner', 'W'], ['inner', 'SW'],
    ['outer', 'NE'], ['outer', 'E'], ['outer', 'SE'], ['outer', 'N'], ['outer', 'S'], ['outer', 'NW'], ['outer', 'W'], ['outer', 'SW']
  ];
}

function horseLabelRawRect(pose, size, direction, gap) {
  const rect = { width: size.width, height: size.height };
  if (direction.includes('E')) rect.x = pose.x + gap;
  else if (direction.includes('W')) rect.x = pose.x - gap - size.width;
  else rect.x = pose.x - size.width / 2;
  if (direction.includes('N')) rect.y = pose.y - gap - size.height;
  else if (direction.includes('S')) rect.y = pose.y + gap;
  else rect.y = pose.y - size.height / 2;
  return rect;
}

function labelAnchorForRect(pose, rect, direction) {
  const anchor = {
    E: { x: rect.x, y: rect.y + rect.height / 2 },
    W: { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
    N: { x: rect.x + rect.width / 2, y: rect.y + rect.height },
    S: { x: rect.x + rect.width / 2, y: rect.y },
    NE: { x: rect.x, y: rect.y + rect.height },
    SE: { x: rect.x, y: rect.y },
    NW: { x: rect.x + rect.width, y: rect.y + rect.height },
    SW: { x: rect.x + rect.width, y: rect.y }
  }[direction] || { x: rect.x, y: rect.y + rect.height / 2 };
  return { x1: pose.x, y1: pose.y, x2: anchor.x, y2: anchor.y };
}

function buildHorseLabelCandidates({ pose, size, viewBox }) {
  return horseLabelCandidateOrder().map(([ring, direction], order) => {
    const gap = ring === 'inner' ? JUMBOTRON_HORSE_LABEL_INNER_GAP : JUMBOTRON_HORSE_LABEL_OUTER_GAP;
    const rawRect = horseLabelRawRect(pose, size, direction, gap);
    const rect = clampRectToViewBox(rawRect, viewBox, JUMBOTRON_HORSE_LABEL_VIEWBOX_PADDING);
    const anchor = labelAnchorForRect(pose, rect, direction);
    return {
      ring,
      direction,
      order,
      rect,
      anchor,
      distance: distanceFromPoseToRect(pose, rect),
      overflow: bubbleOverflow(rawRect, viewBox, JUMBOTRON_HORSE_LABEL_VIEWBOX_PADDING)
    };
  });
}

function bottomReservedRect(trackProfile) {
  const viewBox = trackProfile.viewBox || { x: 0, y: 0, width: 1200, height: 620 };
  return { x: viewBox.x, y: viewBox.y + viewBox.height - 52, width: viewBox.width, height: 52 };
}

function scoreHorseLabelCandidate(candidate, context) {
  const rect = candidate.rect;
  const labelOverlap = context.placedLabels.reduce((score, item) => score + (intersects(rect, item.rect) ? 1000000 + rectOverlapArea(rect, item.rect) * 80 : 0), 0);
  const currentMarkerOverlap = intersects(rect, context.currentMarkerRect) ? 800000 + rectOverlapArea(rect, context.currentMarkerRect) * 80 : 0;
  const markerOverlap = context.markerRects.reduce((score, marker) => {
    if (marker.entryId === context.entryId) return score;
    return score + (intersects(rect, marker) ? 600000 + rectOverlapArea(rect, marker) * 60 : 0);
  }, 0);
  const bubbleOverlap = context.messageBubbleRects.reduce((score, bubbleRect) => score + (intersects(rect, bubbleRect) ? 300000 + rectOverlapArea(rect, bubbleRect) * 40 : 0), 0);
  const zoneOverlap = (context.noBubbleZones || []).reduce((score, zone) => score + (intersects(rect, zone) ? 30000 + rectOverlapArea(rect, zone) * 8 : 0), 0);
  const headerOverlap = intersects(rect, context.headerRect) ? 25000 + rectOverlapArea(rect, context.headerRect) * 6 : 0;
  const tickerOverlap = intersects(rect, context.tickerRect) ? 8000 + rectOverlapArea(rect, context.tickerRect) * 3 : 0;
  const viewBoxPenalty = candidate.overflow * 10000;
  return labelOverlap + currentMarkerOverlap + markerOverlap + bubbleOverlap + zoneOverlap + headerOverlap + tickerOverlap + viewBoxPenalty + candidate.distance * 2 + Math.hypot(candidate.anchor.x2 - candidate.anchor.x1, candidate.anchor.y2 - candidate.anchor.y1);
}

function horseLabelPriority({ entry }) {
  const top3 = Number(entry.rank) <= 3 ? 0 : 1;
  const priorityState = ['high', 'critical'].includes(entry.riskLevel) || ['blocked', 'takeover', 'stale'].includes(entry.motionState) ? 0 : 1;
  return [top3, priorityState, Number(entry.rank) || 999, String(entry.entryId || '')];
}

function compareHorseLabelPriority(a, b) {
  const left = horseLabelPriority(a);
  const right = horseLabelPriority(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

function updateHorseLabelItemGeometry(item, candidate, size) {
  const rect = candidate.rect;
  return {
    ...item,
    ring: candidate.ring,
    direction: candidate.direction,
    rect: { x: svgNumber(rect.x), y: svgNumber(rect.y), width: svgNumber(rect.width), height: svgNumber(rect.height) },
    textX: svgNumber(rect.x + size.paddingX),
    textY: svgNumber(rect.y + size.paddingY + size.fontSize * 0.82),
    anchor: {
      x1: svgNumber(candidate.anchor.x1),
      y1: svgNumber(candidate.anchor.y1),
      x2: svgNumber(candidate.anchor.x2),
      y2: svgNumber(candidate.anchor.y2)
    },
    penalty: svgNumber(candidate.penalty)
  };
}

function updateHorseLabelItemRect(item, rect, viewBox, penalty = item.penalty) {
  const size = estimateHorseLabelSize(item.text);
  const clampedRect = clampRectToViewBox({ ...rect, width: item.rect.width, height: item.rect.height }, viewBox, JUMBOTRON_HORSE_LABEL_VIEWBOX_PADDING);
  return updateHorseLabelItemGeometry(item, {
    ring: item.ring,
    direction: item.direction,
    rect: clampedRect,
    anchor: labelAnchorForRect(item.pose, clampedRect, item.direction),
    penalty
  }, size);
}

function horseLabelHardOverlapCount(item, items, markerRects) {
  const labelOverlaps = items.filter((other) => other.entryId !== item.entryId && intersects(item.rect, other.rect)).length;
  const markerOverlaps = markerRects.filter((marker) => marker.entryId !== item.entryId && intersects(item.rect, marker)).length + (intersects(item.rect, markerRects.find((marker) => marker.entryId === item.entryId) || {}) ? 1 : 0);
  return labelOverlaps + markerOverlaps;
}

function horseLabelBlockingObstacles(item, items, markerRects, messageBubbleRects) {
  return [
    ...items.filter((other) => other.entryId !== item.entryId).map((other) => other.rect),
    ...markerRects.map((marker) => marker),
    ...messageBubbleRects
  ].filter((rect) => intersects(item.rect, rect));
}

function pushApartHorseLabelCandidates(item, obstacles, viewBox) {
  const gap = 8;
  const centerX = (rect) => rect.x + rect.width / 2;
  const centerY = (rect) => rect.y + rect.height / 2;
  const candidates = obstacles.flatMap((obstacle) => [
    { x: item.rect.x, y: obstacle.y - item.rect.height - gap },
    { x: item.rect.x, y: obstacle.y + obstacle.height + gap },
    { x: obstacle.x - item.rect.width - gap, y: item.rect.y },
    { x: obstacle.x + obstacle.width + gap, y: item.rect.y },
    { x: centerX(obstacle) - item.rect.width / 2, y: obstacle.y - item.rect.height - gap },
    { x: centerX(obstacle) - item.rect.width / 2, y: obstacle.y + obstacle.height + gap },
    { x: obstacle.x - item.rect.width - gap, y: centerY(obstacle) - item.rect.height / 2 },
    { x: obstacle.x + obstacle.width + gap, y: centerY(obstacle) - item.rect.height / 2 }
  ]);
  return candidates.map((rect) => updateHorseLabelItemRect(item, rect, viewBox, item.penalty + 1))
    .filter((candidate) => Math.hypot(candidate.anchor.x2 - candidate.anchor.x1, candidate.anchor.y2 - candidate.anchor.y1) <= 220);
}

function labelBubbleOverlapCount(item, messageBubbleRects) {
  return messageBubbleRects.filter((rect) => intersects(item.rect, rect)).length;
}

function horseLabelAnchorDistance(item) {
  return Math.hypot(item.anchor.x2 - item.anchor.x1, item.anchor.y2 - item.anchor.y1);
}

function horseLabelOutOfViewBox(item, viewBox) {
  return item.rect.x < viewBox.x || item.rect.y < viewBox.y || item.rect.x + item.rect.width > viewBox.x + viewBox.width || item.rect.y + item.rect.height > viewBox.y + viewBox.height;
}

function scoreRefinedHorseLabel(item, items, markerRects, messageBubbleRects, viewBox) {
  const hardOverlap = horseLabelHardOverlapCount(item, items, markerRects);
  const bubbleOverlap = labelBubbleOverlapCount(item, messageBubbleRects);
  const overflow = horseLabelOutOfViewBox(item, viewBox) ? 1 : 0;
  return hardOverlap * 1000000 + bubbleOverlap * 350000 + overflow * 100000 + distanceFromPoseToRect(item.pose, item.rect) + item.penalty / 100000;
}

function refineHorseLabelLayout(items, { markerRects, messageBubbleRects, trackProfile, viewBox, headerRect, tickerRect }) {
  let refined = items;
  for (let round = 0; round < 4; round += 1) {
    let changed = false;
    refined = refined.map((item) => {
      if (!horseLabelHardOverlapCount(item, refined, markerRects) && !labelBubbleOverlapCount(item, messageBubbleRects)) return item;
      const size = estimateHorseLabelSize(item.text);
      const currentMarkerRect = markerRects.find((marker) => marker.entryId === item.entryId) || markerRectForPose(item.pose);
      const context = { entryId: item.entryId, placedLabels: refined.filter((other) => other.entryId !== item.entryId), markerRects, currentMarkerRect, messageBubbleRects, noBubbleZones: trackProfile.noBubbleZones || [], headerRect, tickerRect, viewBox };
      const geometryCandidates = buildHorseLabelCandidates({ pose: item.pose, size, viewBox })
        .map((candidateItem) => updateHorseLabelItemGeometry(item, { ...candidateItem, penalty: scoreHorseLabelCandidate(candidateItem, context) }, size));
      const pushCandidates = pushApartHorseLabelCandidates(item, horseLabelBlockingObstacles(item, refined, markerRects, messageBubbleRects), viewBox);
      const candidates = [item, ...geometryCandidates, ...pushCandidates];
      const next = candidates.sort((a, b) => scoreRefinedHorseLabel(a, refined, markerRects, messageBubbleRects, viewBox) - scoreRefinedHorseLabel(b, refined, markerRects, messageBubbleRects, viewBox) || a.rect.x - b.rect.x || a.rect.y - b.rect.y)[0];
      changed = changed || next.rect.x !== item.rect.x || next.rect.y !== item.rect.y || next.direction !== item.direction || next.ring !== item.ring;
      return next;
    });
    if (!changed) break;
  }
  return refined;
}

function scoreBubbleClearanceHorseLabel(item, items, markerRects, messageBubbleRects, viewBox) {
  const otherItems = items.filter((other) => other.entryId !== item.entryId);
  return labelBubbleOverlapCount(item, messageBubbleRects) * 10000000
    + horseLabelHardOverlapCount(item, otherItems, markerRects) * 1000000
    + (horseLabelOutOfViewBox(item, viewBox) ? 100000 : 0)
    + Math.max(0, horseLabelAnchorDistance(item) - 220) * 1000
    + distanceFromPoseToRect(item.pose, item.rect)
    + item.penalty / 100000;
}

function clearHorseLabelLayoutConflicts(items, { markerRects, messageBubbleRects, viewBox }) {
  let resolved = items;
  for (let round = 0; round < 3; round += 1) {
    let changed = false;
    resolved = resolved.map((item, index, currentItems) => {
      if (!labelBubbleOverlapCount(item, messageBubbleRects) && !horseLabelHardOverlapCount(item, currentItems, markerRects)) return item;
      const obstacles = horseLabelBlockingObstacles(item, currentItems, markerRects, messageBubbleRects);
      const candidates = [item, ...pushApartHorseLabelCandidates(item, obstacles, viewBox)];
      const next = candidates.sort((a, b) => scoreBubbleClearanceHorseLabel(a, currentItems, markerRects, messageBubbleRects, viewBox) - scoreBubbleClearanceHorseLabel(b, currentItems, markerRects, messageBubbleRects, viewBox) || a.rect.x - b.rect.x || a.rect.y - b.rect.y)[0];
      changed = changed || next.rect.x !== item.rect.x || next.rect.y !== item.rect.y;
      return next;
    });
    if (!changed) break;
  }
  return resolved;
}

function summarizeHorseLabelLayout(items, markerRects, messageBubbleRects, viewBox) {
  const labelLabelOverlaps = items.reduce((count, item, index) => count + items.slice(index + 1).filter((other) => intersects(item.rect, other.rect)).length, 0);
  const labelMarkerOverlaps = items.reduce((count, item) => count + markerRects.filter((marker) => marker.entryId !== item.entryId && intersects(item.rect, marker)).length + (intersects(item.rect, markerRects.find((marker) => marker.entryId === item.entryId) || {}) ? 1 : 0), 0);
  const labelBubbleOverlaps = items.reduce((count, item) => count + messageBubbleRects.filter((rect) => intersects(item.rect, rect)).length, 0);
  const outOfViewBox = items.filter((item) => item.rect.x < viewBox.x || item.rect.y < viewBox.y || item.rect.x + item.rect.width > viewBox.x + viewBox.width || item.rect.y + item.rect.height > viewBox.y + viewBox.height).length;
  return {
    total: items.length,
    labelLabelOverlaps,
    labelMarkerOverlaps,
    labelBubbleOverlaps,
    outOfViewBox,
    maxPenalty: Math.max(0, ...items.map((item) => item.penalty))
  };
}

function buildHorseLabelLayout({ horsePoses, trackProfile, messageBubbleRects = [], viewBox = trackProfile.viewBox || { x: 0, y: 0, width: 1200, height: 620 } }) {
  const markerRects = horsePoses.map(({ entry, pose }) => ({ entryId: entry.entryId, ...markerRectForPose(pose) }));
  const ordered = [...horsePoses].sort(compareHorseLabelPriority);
  const placedLabels = [];
  const headerRect = topReservedRect({ ...trackProfile, viewBox });
  const tickerRect = bottomReservedRect({ ...trackProfile, viewBox });
  const items = [];
  for (const { entry, pose } of ordered) {
    const text = `${entry.displayName} · ${Math.round(pose.s * 100)}%`;
    const size = estimateHorseLabelSize(text);
    const currentMarkerRect = markerRects.find((marker) => marker.entryId === entry.entryId) || markerRectForPose(pose);
    const context = { entryId: entry.entryId, placedLabels, markerRects, currentMarkerRect, messageBubbleRects, noBubbleZones: trackProfile.noBubbleZones || [], headerRect, tickerRect, viewBox };
    const candidate = buildHorseLabelCandidates({ pose, size, viewBox })
      .map((item) => ({ ...item, penalty: scoreHorseLabelCandidate(item, context) }))
      .sort((a, b) => a.penalty - b.penalty || a.order - b.order || a.rect.x - b.rect.x || a.rect.y - b.rect.y)[0];
    const rect = candidate.rect;
    const item = updateHorseLabelItemGeometry({
      entryId: entry.entryId,
      text,
      pose,
      leaderLine: true
    }, candidate, size);
    placedLabels.push(item);
    items.push(item);
  }
  const refinedItems = clearHorseLabelLayoutConflicts(refineHorseLabelLayout(items, { markerRects, messageBubbleRects, trackProfile, viewBox, headerRect, tickerRect }), { markerRects, messageBubbleRects, viewBox });
  const byEntryId = Object.fromEntries(refinedItems.map((item) => [item.entryId, item]));
  return { items: refinedItems, byEntryId, summary: summarizeHorseLabelLayout(refinedItems, markerRects, messageBubbleRects, viewBox) };
}

function estimateBubbleRects(trackProfile, bubbles) {
  const zone = trackProfile.messageZones?.[0] || { offsetX: trackProfile.displayAdjustment?.bubbleX || 28, offsetY: trackProfile.displayAdjustment?.bubbleY || -64 };
  const padding = 14;
  const gap = 24;
  const viewBox = trackProfile.viewBox || { x: 0, y: 0, width: 1200, height: 620 };
  return bubbles.map(({ sizeHint, pose, placementSeed }) => {
    const width = bubbleWidthFromSizeHint(sizeHint);
    const height = 54;
    const offsetX = Number(zone.offsetX || 0);
    const offsetY = Number(zone.offsetY || 0);
    const preference = bubblePlacementPreferences(placementSeed);
    const candidates = [
      { placement: 'right', x: pose.x + gap + Math.max(0, offsetX), y: pose.y + offsetY - height / 2, preference: preference.right },
      { placement: 'left', x: pose.x - width - gap - Math.max(0, offsetX), y: pose.y + offsetY - height / 2, preference: preference.left },
      { placement: 'bottom', x: pose.x - width / 2, y: pose.y + gap, preference: preference.bottom },
      { placement: 'top', x: pose.x - width / 2, y: pose.y - height - gap, preference: preference.top }
    ];
    const ranked = candidates.map((candidate) => {
      const rect = { x: candidate.x, y: candidate.y, width, height, placement: candidate.placement };
      const overflow = bubbleOverflow(rect, viewBox, padding);
      return { ...rect, score: overflow * 1000 + distanceFromPoseToRect(pose, rect) + candidate.preference };
    }).sort((a, b) => a.score - b.score);
    const best = ranked[0];
    const fallbackX = clampNumber(best.x, viewBox.x + padding, viewBox.x + viewBox.width - width - padding);
    const fallbackY = clampNumber(best.y, viewBox.y + padding, viewBox.y + viewBox.height - height - padding);
    const rect = { x: best.score >= 1000 ? fallbackX : best.x, y: best.score >= 1000 ? fallbackY : best.y, width, height, placement: best.placement };
    return { ...rect, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2, anchor: bubbleAnchorForPlacement(pose, rect, rect.placement) };
  });
}

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function manualCheckStatus(value) {
  if (typeof value === 'string') return value === 'confirmed' || value === '已人工确认' ? 'confirmed' : 'pending';
  return value?.status || 'pending';
}

function manualCheckLabel(value) {
  const labels = { confirmed: '已人工确认', pending: '待人工复核', failed: '人工复核未通过' };
  return labels[manualCheckStatus(value)] || '待人工复核';
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
    `队伍：${entry?.displayName || message.entryId}`,
    `时间：${message.createdAt}`,
    `摘要：${message.summary}`,
    '点击固定到焦点详情'
  ];
}

function attentionTooltipLines(item, entries) {
  const entry = entries.find((candidate) => candidate.entryId === item.entryId);
  return [
    `类别：${attentionCategoryLabel(item.category)} · ${severityLabel(item.severity)}`,
    `队伍：${entry?.displayName || item.entryId}`,
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
  return `<section class="jumbotron-header"><div class="jumbotron-brandline"><span class="jumbotron-live">LIVE</span><strong>${escapeHtml(competition.brand)}</strong><span>${escapeHtml(competition.title)}</span></div><div class="jumbotron-statusbar"><span>${escapeHtml(competition.currentRound)}</span><span>${escapeHtml(competition.elapsedTime)}</span><span>在线 ${raceSnapshot.kpi.onlineRiders}/${raceSnapshot.kpi.activeRiders}</span></div></section>`;
}

function renderJumbotronKpis(kpi) {
  return `<section class="jumbotron-kpis" aria-label="赛事状态贴边信息">${[
    { label: '进度', value: `${kpi.completionRate}%` },
    { label: '在线', value: `${kpi.onlineRiders}/${kpi.activeRiders}` },
    { label: 'Token', value: String(kpi.totalTokens) },
    { label: 'CA 占比', value: `${kpi.codexShare}% / ${kpi.claudeShare}%` },
    { label: '风险', value: `${kpi.riskCount}/${kpi.obstacleCount}` }
  ].map((item) => `<div class="jumbotron-chip"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('')}</section>`;
}

function renderJumbotronBubbleLayer({ trackProfile, messagePlan, adapted }) {
  const bubbleRects = mapBubbleQueueToGeometry(trackProfile, messagePlan.bubbles);
  const items = messagePlan.bubbles.map((bubble, index) => {
    const { message, pose, startSecond, durationSecond, slotIndex, priority, liveClass } = bubble;
    if (!message) return '';
    const rect = bubbleRects[index] || { x: pose.x + 30, y: pose.y - 70, width: bubbleWidthFromSizeHint(bubble.sizeHint), height: 52, placement: 'right' };
    const placement = jumbotronTooltipPlacement({ x: rect.x, y: rect.y }, 290, 96);
    const lines = messageTooltipLines(message, adapted.racingEntries);
    const anchor = rect.anchor || { x1: pose.x, y1: pose.y, x2: rect.x, y2: rect.y + rect.height / 2 };
    const pop = bubblePopOffset(rect.placement);
    return `<a class="jumbotron-focus-source focus-trigger" href="#${messageFocusId(message)}" aria-label="查看 ${escapeHtml(messageTypeLabel(message.type))} 焦点详情"><g class="message-bubble-anchor ${escapeHtml(liveClass || bubbleLiveClass(durationSecond, messagePlan.rules?.cycleSeconds))}" style="--bubble-cycle:${escapeHtml(messagePlan.rules?.cycleSeconds || JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS)}s;--bubble-start:${escapeHtml(startSecond)}s;--bubble-pop-x:${pop.x}px;--bubble-pop-y:${pop.y}px" data-start-second="${escapeHtml(startSecond)}" data-duration-second="${escapeHtml(durationSecond)}" data-cycle-second="${escapeHtml(messagePlan.rules?.cycleSeconds || JUMBOTRON_BUBBLE_DEFAULT_CYCLE_SECONDS)}" data-average-visible="${escapeHtml(messagePlan.rules?.averageVisibleCount || 0)}" data-placement="${escapeHtml(rect.placement)}" data-slot-index="${escapeHtml(slotIndex)}" data-priority="${escapeHtml(priority)}"><line class="message-bubble-line" x1="${anchor.x1}" y1="${anchor.y1}" x2="${anchor.x2}" y2="${anchor.y2}"/><g class="message-bubble" transform="translate(${rect.x} ${rect.y})"><rect width="${rect.width}" height="${rect.height}" rx="14"/><text x="13" y="21">${escapeHtml(messageTypeLabel(message.type))}</text><text x="13" y="40">${escapeHtml(message.summary).slice(0, 28)}</text></g></g>${renderSvgTooltip(lines, placement)}</a>`;
  }).join('');
  return `<g id="jumbotron-bubble-layer" data-bubble-version="${escapeHtml(messagePlan.version || '')}">${items}</g>`;
}

function renderHorseLabelGroup(label) {
  return `<g class="horse-label-group" data-entry-id="${escapeHtml(label.entryId)}" data-label-placement="${escapeHtml(label.direction)}" data-label-ring="${escapeHtml(label.ring)}" data-label-x="${label.rect.x}" data-label-y="${label.rect.y}" data-label-width="${label.rect.width}" data-label-height="${label.rect.height}" data-horse-x="${label.anchor.x1}" data-horse-y="${label.anchor.y1}" data-label-penalty="${label.penalty}"><line class="horse-label-line" x1="${label.anchor.x1}" y1="${label.anchor.y1}" x2="${label.anchor.x2}" y2="${label.anchor.y2}"/><text class="horse-label" x="${label.textX}" y="${label.textY}">${escapeHtml(label.text)}</text></g>`;
}

function jumbotronMotionStateShortLabel(state) {
  const labels = { sprinting: '冲', running: '跑', blocked: '阻', pit_stop: '停', takeover: '接', finished: '成', stale: '刷', slowed: '慢', idle: '待' };
  return labels[state] || '动';
}

function jumbotronHorseVisualClass(entry) {
  return [
    `horse-${entry.riskLevel}`,
    `horse-risk-${entry.riskLevel || 'none'}`,
    `horse-state-${entry.motionState || 'unknown'}`,
    Number(entry.rank) === 1 ? 'horse-rank-leader' : ''
  ].filter(Boolean).join(' ');
}

function top3GapLabel(entry, entries) {
  const ordered = [...entries].sort((a, b) => a.rank - b.rank);
  const leader = ordered[0];
  if (!leader || Number(entry.rank) === 1) return '领先';
  const leaderGap = Math.max(0, Math.round((leader.roundProgress - entry.roundProgress) * 10) / 10);
  const previous = ordered.find((item) => Number(item.rank) === Number(entry.rank) - 1);
  const chaseGap = previous ? Math.max(0, Math.round((previous.roundProgress - entry.roundProgress) * 10) / 10) : leaderGap;
  return `追 ${chaseGap}% / 距首 ${leaderGap}%`;
}

function riskStatePill(entry) {
  if (['critical', 'high'].includes(entry.riskLevel)) return `<span class="state-pill state-pill-risk">${escapeHtml(riskLevelLabel(entry.riskLevel))}</span>`;
  if (['blocked', 'takeover', 'stale'].includes(entry.motionState)) return `<span class="state-pill state-pill-risk">${escapeHtml(motionStateLabel(entry.motionState))}</span>`;
  return `<span class="state-pill">${escapeHtml(motionStateLabel(entry.motionState))}</span>`;
}

function publicCheckpointLabel(label) {
  const labels = {
    'Start': '起点',
    'Finish': '终点',
    'Start / Finish': '终点线',
    'Far Turn': '远端弯道',
    'Back Straight': '对面直道',
    'Home Straight': '冲刺直道'
  };
  return labels[label] || label;
}

function renderJumbotronTrack({ trackProfile, horsePoses, debug, messagePlan, adapted, showReviewTools }) {
  const messageBubbleRects = mapBubbleQueueToGeometry(trackProfile, messagePlan.bubbles);
  const labelLayout = buildHorseLabelLayout({ horsePoses, trackProfile, messageBubbleRects, viewBox: trackProfile.viewBox });
  const debugLayer = showReviewTools ? `<polyline class="track-samples" points="${jumbotronPolyline(debug.sampledPoints)}"/>${debug.collisionBoxes.map((box) => `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="none" stroke="rgba(248,113,113,.7)" stroke-dasharray="5 5"/>`).join('')}${labelLayout.items.map((item) => `<rect x="${item.rect.x}" y="${item.rect.y}" width="${item.rect.width}" height="${item.rect.height}" fill="none" stroke="rgba(31,73,216,.45)" stroke-dasharray="4 6"/>`).join('')}` : '';
  const entryLayer = horsePoses.map(({ entry, pose }) => {
    const placement = jumbotronTooltipPlacement(pose, 310, 112);
    const label = labelLayout.byEntryId[entry.entryId];
    const visualClass = jumbotronHorseVisualClass(entry);
    const statusLabel = jumbotronMotionStateShortLabel(entry.motionState);
    const riskRing = ['high', 'critical'].includes(entry.riskLevel) ? `<circle class="track-alert-ring" r="27"/>` : '';
    return `<a class="jumbotron-focus-source focus-trigger" href="#${entryFocusId(entry)}" aria-label="查看 ${escapeHtml(entry.displayName)} 焦点详情"><g class="horse ${escapeHtml(visualClass)}" data-motion-state="${escapeHtml(entry.motionState)}" data-risk-level="${escapeHtml(entry.riskLevel)}" transform="translate(${pose.x} ${pose.y}) rotate(${pose.rotation})">${riskRing}<circle class="horse-body" r="18"/><path class="horse-arrow" d="M-7,-9 L19,0 L-7,9 Z"/><text class="debug-label" transform="rotate(${-pose.rotation})" text-anchor="middle" y="6">${escapeHtml(entry.rank)}</text><g class="horse-status-pill" transform="rotate(${-pose.rotation}) translate(18 -30)"><rect x="-2" y="-13" width="24" height="18" rx="9"/><text x="10" y="0" text-anchor="middle">${escapeHtml(statusLabel)}</text></g></g>${label ? renderHorseLabelGroup(label) : ''}${renderSvgTooltip(entryTooltipLines(entry), placement)}</a>`;
  }).join('');
  const bubbleLayer = renderJumbotronBubbleLayer({ trackProfile, messagePlan, adapted });
  return `<section class="track-stage-card"><div class="eyebrow">赛事大屏</div><h2>实时赛道</h2><svg class="track-svg" viewBox="0 0 1200 620" role="img" aria-label="赛事实时赛道" data-label-count="${labelLayout.summary.total}" data-label-overlaps="${labelLayout.summary.labelLabelOverlaps}" data-label-marker-overlaps="${labelLayout.summary.labelMarkerOverlaps}" data-label-bubble-overlaps="${labelLayout.summary.labelBubbleOverlaps}" data-label-out-of-viewbox="${labelLayout.summary.outOfViewBox}"><rect class="track-bg" x="22" y="22" width="1156" height="576" rx="42"/><path class="track-band" d="${jumbotronPath(trackProfile.centerlinePath)}"/><polyline class="track-centerline" points="${jumbotronPolyline(trackProfile.centerlinePath)}"/>${debugLayer}${debug.checkpoints.map((checkpoint) => `<g class="checkpoint" transform="translate(${checkpoint.pose.point.x} ${checkpoint.pose.point.y})"><circle r="9" fill="#facc15" stroke="#713f12" stroke-width="3"/><text x="13" y="5">${escapeHtml(publicCheckpointLabel(checkpoint.label))}</text></g>`).join('')}${entryLayer}${bubbleLayer}</svg></section>`;
}

function renderJumbotronSide({ adapted, horsePoses, debug, trackProfile, showReviewTools }) {
  const top3 = [...adapted.racingEntries].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const legend = adapted.racingEntries.map((entry) => `<p><strong>#${entry.rank} ${escapeHtml(entry.displayName)}</strong>${riskStatePill(entry)}<br><span class="muted">${escapeHtml(entry.primaryCA)} · ${escapeHtml(riskLevelLabel(entry.riskLevel))}</span></p>`).join('');
  const phaseSummary = adapted.racingEntries.slice(0, 6).map((entry) => `<p><strong>${escapeHtml(entry.displayName)}</strong>${riskStatePill(entry)}<br><span class="muted">${entry.phaseProgress}% · ${Math.round(entry.score)} 分</span></p>`).join('');
  const attentionItems = adapted.attentionItems
    .filter((item) => ['critical', 'high'].includes(item.severity) || ['risk', 'obstacle', 'violation'].includes(item.category))
    .slice(0, 4);
  const attention = attentionItems.length ? attentionItems.map((item) => `<a class="jumbotron-focus-source focus-trigger" href="#${attentionFocusId(item)}"><article class="attention-item attention-item-${escapeHtml(item.severity)}"><strong>${escapeHtml(attentionCategoryLabel(item.category))} · ${escapeHtml(severityLabel(item.severity))}</strong><p>${escapeHtml(item.summary)}</p>${renderHtmlTooltip(attentionTooltipLines(item, adapted.racingEntries))}</article></a>`).join('') : '<p class="muted">当前没有高优先级风险。</p>';
  return `<aside><section class="side-card"><div class="eyebrow">TOP3</div><h2>领先队伍</h2><ol class="ranking-list">${top3.map((entry) => `<li><a class="jumbotron-focus-source focus-trigger" href="#${entryFocusId(entry)}"><strong>#${entry.rank} ${escapeHtml(entry.displayName)}</strong><span class="gap-pill">${escapeHtml(top3GapLabel(entry, adapted.racingEntries))}</span>${renderHtmlTooltip(entryTooltipLines(entry))}</a><div class="muted">${entry.roundProgress}% · ${escapeHtml(motionStateLabel(entry.motionState))}</div></li>`).join('')}</ol></section>${renderFocusDetailPanel(adapted)}<section class="side-card"><div class="eyebrow">赛道概览</div><h2>小地图</h2><svg class="mini-map-svg" viewBox="0 0 ${trackProfile.viewBox.width} ${trackProfile.viewBox.height}" role="img" aria-label="赛道小地图"><path class="track-band" d="${jumbotronPath(trackProfile.centerlinePath)}"/><polyline class="track-centerline" points="${jumbotronPolyline(trackProfile.centerlinePath)}"/>${horsePoses.map(({ entry, pose }) => `<a class="jumbotron-focus-source" href="#${entryFocusId(entry)}"><circle cx="${pose.x}" cy="${pose.y}" r="18" fill="#1f49d8"><title>${escapeHtml(entry.displayName)}</title></circle></a>`).join('')}</svg><h3>队伍图例</h3>${legend}</section><section class="side-card"><div class="eyebrow">阶段</div><h2>进度快照</h2>${phaseSummary}</section><section class="side-card"><div class="eyebrow">提醒</div><h2>风险 / 阻塞 / 违规</h2>${attention}</section>${showReviewTools ? `<section class="side-card"><div class="eyebrow">HorsePose</div><h2>运行时输出</h2><p class="muted">${horsePoses.length} 个 Entry · ${debug.horseSValues.map(escapeHtml).join(' / ')}</p></section>` : ''}</aside>`;
}

function renderJumbotronTicker({ messagePlan, adapted }) {
  const items = messagePlan.ticker.map((message) => ({ message, text: `${messageTypeLabel(message.type)} · ${message.summary}` }));
  return `<section class="jumbotron-ticker"><strong>现场播报</strong><div>${items.map(({ message, text }) => `<a class="ticker-item jumbotron-focus-source focus-trigger" href="#${messageFocusId(message)}"><span>${escapeHtml(text)}</span>${renderHtmlTooltip(messageTooltipLines(message, adapted.racingEntries))}</a>`).join('') || '<span>普通消息进入现场播报；风险和里程碑优先显示气泡。</span>'}</div><a class="button secondary" href="#remote-cockpit">协作入口</a></section>`;
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
  const entryCards = adapted.racingEntries.map((entry) => `<article id="${entryFocusId(entry)}" class="focus-detail-card" data-focus-kind="entry"><strong>队伍 · #${entry.rank} ${escapeHtml(entry.displayName)}</strong><p>进度 ${entry.roundProgress}% · 阶段 ${entry.phaseProgress}% · ${Math.round(entry.score)} 分</p><p>状态 ${escapeHtml(motionStateLabel(entry.motionState))} · 风险 ${escapeHtml(riskLevelLabel(entry.riskLevel))}</p><p class="muted">最近消息：${escapeHtml((entry.lastMessage?.summary || entry.latestMessage || '暂无最新消息').slice(0, 72))}</p></article>`).join('');
  const messageCards = adapted.ridingMessages.slice(0, 5).map((message) => {
    const entry = adapted.racingEntries.find((item) => item.entryId === message.entryId);
    return `<article id="${messageFocusId(message)}" class="focus-detail-card" data-focus-kind="message"><strong>消息 · ${escapeHtml(messageTypeLabel(message.type))}</strong><p>${escapeHtml(severityLabel(message.severity))} · ${escapeHtml(entry?.displayName || message.entryId)} · ${escapeHtml(message.createdAt)}</p><p class="muted">${escapeHtml(message.summary.slice(0, 84))}</p><p>点击队伍可继续查看协作入口。</p></article>`;
  }).join('');
  const attentionCards = adapted.attentionItems.map((item) => {
    const entry = adapted.racingEntries.find((candidate) => candidate.entryId === item.entryId);
    return `<article id="${attentionFocusId(item)}" class="focus-detail-card" data-focus-kind="attention"><strong>提醒 · ${escapeHtml(attentionCategoryLabel(item.category))}</strong><p>${escapeHtml(severityLabel(item.severity))} · ${escapeHtml(attentionStatusLabel(item.status))} · ${escapeHtml(entry?.displayName || item.entryId)}</p><p class="muted">${escapeHtml(item.summary.slice(0, 84))}</p><p>下一步：${escapeHtml(attentionNextStep(item.category))}</p></article>`;
  }).join('');
  return `<section class="side-card focus-details-card" aria-label="焦点详情"><div class="eyebrow">焦点</div><h2>焦点详情</h2><p class="muted">悬停预览，点击固定。</p><div class="focus-detail-list">${entryCards}${messageCards}${attentionCards}</div></section>`;
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
    'closed point count': '闭合路径点数',
    'open point count': '开放路径点数',
    'centerline points': '中心线点位',
    direction: '赛道方向',
    startFinish: '起终点范围',
    'startFinish.s': 'startFinish.s 范围',
    'checkpoints.s': 'checkpoints.s 范围',
    lanes: '泳道配置',
    'lane offsets unique': '泳道偏移不重复',
    'lane offset duplicate': '泳道偏移重复检测',
    'profile schema': 'Profile 版本匹配',
    'profile version mismatch': 'Profile 版本不匹配防御',
    'background file exists': '背景文件真实存在',
    'background asset allowlist': '背景资产 allowlist',
    'start / finish': '起点 / 终点',
    checkpoints: '检查点',
    'NaN / Infinity': 'NaN / Infinity 检查',
    'sample finite': '采样数值有效',
    'sample continuity': '相邻采样连续',
    'sample jump warning': '采样跳变 warning',
    'curvature warning': '曲率 warning',
    'turn angle warning': '弯道转角自然',
    'path length': '路径长度',
    'path length minimum threshold': '路径长度最小阈值',
    competitionId: 'competitionId',
    'competition metadata': 'Competition metadata',
    activeCockpits: 'activeCockpits',
    'KPI obstacleCount': 'KPI obstacleCount',
    'KPI violationCount': 'KPI violationCount',
    'caProvider contract': 'caProvider 契约',
    'costTokens mapping': 'costTokens 映射',
    'entry updatedAt contract': 'updatedAt 契约',
    'entry currentPhase contract': 'currentPhase 契约',
    'horse on track': '马匹位于赛道范围内',
    'one bubble per entry': '每个 Entry 每轮最多一个气泡',
    'global bubble limit': '全局最多 3 条气泡',
    'scheduled bubble limit': '动态气泡调度数量',
    'visible bubble limit': '任意时刻最多 3 条可见气泡',
    'bubble timing range': '气泡自适应循环时间表',
    'bubble average visible': '自适应循环平均约 1.5 条可见气泡',
    'bubble event staggering': '气泡冒出 / 消失事件错峰',
    'bubble spatial separation': '同屏气泡空间分散',
    'bubble avoids header': '气泡避开页头',
    'bubble top-overlap': '气泡顶部遮挡检测',
    'bubble rectangle top-overlap': '气泡矩形顶部遮挡检测',
    'horse label layout generated': '马匹标签 bbox 自适应避让',
    'horse label bbox in viewBox': '马匹标签 viewBox 边界',
    'horse label-label overlap': '马匹标签互不重叠',
    'horse label-marker overlap': '马匹标签避让马匹标记',
    'horse label-bubble overlap': '马匹标签避让气泡 bbox',
    'horse overlap': '马匹不过度重叠',
    'multi-horse preview count': '多马预览数量',
    'multi-horse preview in viewBox': '多马预览不出界',
    'multi-horse preview distance': '多马预览相互距离',
    'multi-horse preview severe overlap': '多马预览严重重叠检测',
    'multi-horse preview turn direction': '多马预览弯道方向检查',
    'multi-horse preview': '至少 8 匹马多马预览',
    'checkpoint semantics': '检查点语义完整',
    '16:9 stable': '16:9 大屏稳定',
    'two tracks ready': '两条赛道已准备',
    'eight lane preview': '八条泳道预览',
    'ticker fallback': 'ticker fallback',
    'risk milestone priority': '风险 / 里程碑优先',
    'manual horse-on-track confirmation': '马匹在赛道上人工确认',
    'manual curve confirmation': '弯道自然人工确认',
    'manual bubble clearance confirmation': '气泡遮挡人工确认',
    'manual checkpoint confirmation': 'checkpoint 语义人工确认'
  };
  return labels[label] || label.replace('progress mapping', '进度映射').replace('progress', '进度').replace('lane', '泳道').replace('updatedAt', '更新时间');
}

function renderJumbotronDataEvidenceDebug({ dataEvidence }) {
  const coverageLine = (coverage) => `present=${coverage.present.join(' / ') || 'none'}; missing=${coverage.missing.join(' / ') || 'none'}; complete=${coverage.complete}`;
  const hiddenLine = dataEvidence.publicHiddenFields.fields.map((item) => `${item.field}@${item.locations.join('+')}:${item.count}`).join(' / ');
  const aggregate = dataEvidence.lastMessageMapping.aggregate;
  const entryRows = dataEvidence.lastMessageMapping.entryMappings.map((entry) => `<tr><td>${escapeHtml(entry.entryId)}</td><td>${escapeHtml(entry.latestMessageId || 'none')}</td><td>${entry.lastMessageResolved}</td><td>${entry.fallbackUsed}</td><td>${escapeHtml(entry.lastMessage?.type || 'none')}</td><td>${escapeHtml(entry.lastMessage?.displayMode || 'none')}</td><td>${entry.lastMessage?.summaryPresent === true}</td><td>${entry.targetUrlHidden}</td></tr>`).join('');
  return `<section class="jumbotron-debug"><div class="eyebrow">Data Evidence</div><h2>data evidence debug panel</h2><div class="debug-grid"><article><strong>dataProfileId</strong><p class="muted">${escapeHtml(dataEvidence.dataProfileId)}</p></article><article><strong>profileAlias / selectedProfile</strong><p class="muted">${escapeHtml(dataEvidence.profileAlias)} / ${escapeHtml(dataEvidence.selectedProfile)}</p></article><article><strong>entryCount / messageCount / attentionItemCount</strong><p class="muted">${dataEvidence.entryCount} / ${dataEvidence.messageCount} / ${dataEvidence.attentionItemCount}</p></article><article><strong>validatorStatus</strong><p class="muted">${escapeHtml(dataEvidence.validatorStatus)}</p></article><article><strong>motionStateCoverage</strong><p class="muted">${escapeHtml(coverageLine(dataEvidence.motionStateCoverage))}</p></article><article><strong>messageTypeCoverage</strong><p class="muted">${escapeHtml(coverageLine(dataEvidence.messageTypeCoverage))}</p></article><article><strong>publicHiddenFields</strong><p class="muted">${escapeHtml(hiddenLine)}; rawValuesExcludedFromEvidence=${dataEvidence.publicHiddenFields.rawValuesExcludedFromEvidence}</p></article><article><strong>profileUsageGuard</strong><p class="muted">smoke8VisualLowLoadOnly=${dataEvidence.profileUsageGuard.smoke8VisualLowLoadOnly}; coverage9EnumCoverageOnly=${dataEvidence.profileUsageGuard.coverage9EnumCoverageOnly}</p></article><article><strong>lastMessage aggregate</strong><p class="muted">resolvedCount=${aggregate.resolvedCount}/${aggregate.entryCount}; fallbackCount=${aggregate.fallbackCount}; missingLatestMessageIdCount=${aggregate.missingLatestMessageIdCount}; unresolvedCount=${aggregate.unresolvedCount}; syntheticMissingIdFallsBack=${aggregate.syntheticMissingIdFallsBack}</p></article></div><h3>lastMessage mapping evidence</h3><table><thead><tr><th>entryId</th><th>latestMessageId</th><th>lastMessageResolved</th><th>fallbackUsed</th><th>lastMessage.type</th><th>lastMessage.displayMode</th><th>summaryPresent</th><th>targetUrlHidden</th></tr></thead><tbody>${entryRows}</tbody></table></section>`;
}

function renderJumbotronCalibrator({ trackProfile, runtime }) {
  const previewEntries = [0, 25, 50, 75, 100].map((progress, index) => ({ entryId: `preview-${progress}`, displayName: `${progress}%`, roundProgress: progress, laneOffsetIndex: index % trackProfile.laneOffsets.length, laneId: `lane-${index}`, motionState: progress === 100 ? 'finished' : 'running' }));
  const poses = previewEntries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
  return `<section class="jumbotron-calibrator"><div class="eyebrow">Track Profile 校准器 Preview</div><h2>设计侧预览</h2><div class="calibrator-grid"><article><strong>独立设计入口</strong><p class="muted">Calibrator MVP 已拆到 /jumbotron/calibrator，提供 Import / Validate / Preview / Export。</p></article><article><strong>预览画布</strong><p class="muted">背景 · 中心线 · 控制点 · 赛道预览 · 检查点 · 马匹预览 · 消息气泡预览</p></article><article><strong>共用 runtime</strong><p class="muted">Preview 复用 createJumbotronRuntime / sampleHorsePose，不另写坐标计算。</p></article><article><strong>仍待增强</strong><p class="muted">拖拽点位、AI 候选导入、JSON diff 和 debug-preview.png 仍是后续项。</p></article></div><svg class="calibrator-preview-svg" viewBox="0 0 1200 620" role="img" aria-label="校准器预览"><rect class="track-bg" x="40" y="60" width="1120" height="500" rx="34"/><polyline class="track-centerline" points="${jumbotronPolyline(trackProfile.centerlinePath)}"/>${poses.map(({ entry, pose }) => `<g transform="translate(${pose.x} ${pose.y})"><circle r="15" fill="#a855f7" stroke="#f5d0fe" stroke-width="3"/><text class="debug-label" x="22" y="6">${escapeHtml(entry.displayName)}</text></g>`).join('')}</svg><p class="muted">打开 <a class="button secondary" href="/jumbotron/calibrator">Track Profile Calibrator MVP</a> 可粘贴候选 profile、编辑 centerline / lanes / checkpoints、Validate 并 Export JSON。</p></section>`;
}

function renderJumbotronValidation({ debug, validation }) {
  const renderChecks = (checks) => checks.map(([label, ok]) => `<article><strong>${ok ? '✓' : '!' } ${escapeHtml(validationLabel(label))}</strong><p class="muted">${ok ? '通过' : '需要补齐'}</p></article>`).join('');
  return `<section class="jumbotron-debug"><div class="eyebrow">调试模式</div><h2>几何 / 运行时 / 待刷新</h2><div class="debug-grid"><article><strong>中心线</strong><p class="muted">${debug.sampledPoints.length} 个采样点</p></article><article><strong>泳道偏移</strong><p class="muted">${debug.laneOffsets.join(' / ')}</p></article><article><strong>检查点</strong><p class="muted">${debug.checkpoints.map((item) => item.label).join(' / ')}</p></article><article><strong>待刷新 Entry</strong><p class="muted">${debug.staleEntries.length || '无'}</p></article><article><strong>状态机覆盖</strong><p class="muted">${debug.motionStates.join(' / ')}</p></article><article><strong>s-axis interpolation</strong><p class="muted">sampleInterpolatedPose 输出 s=${debug.interpolationEvidence.s.toFixed(2)}</p></article><article><strong>消息降噪规则</strong><p class="muted">${debug.messageRules.join('；')}</p></article><article><strong>人工确认状态</strong><p class="muted">马在赛道上：${manualCheckLabel(debug.manualChecks.horseOnTrack)}；弯道自然：${manualCheckLabel(debug.manualChecks.curveNatural)}；气泡遮挡：${manualCheckLabel(debug.manualChecks.bubbleClearance)}；checkpoint 语义：${manualCheckLabel(debug.manualChecks.checkpointMeaning)}</p></article><article><strong>多马预览证据</strong><p class="muted">${validation.multiHorsePreview.count} 匹；最小距离 ${Math.round(validation.multiHorsePreview.minDistance)}；出界 ${validation.multiHorsePreview.inViewBox ? '无' : '有'}；严重重叠 ${validation.multiHorsePreview.severeOverlap ? '有' : '无'}</p></article></div></section><section class="jumbotron-validation"><div class="eyebrow">校验结果</div><h2>Track Profile / 数据契约 / 运行时 / 视觉</h2><h3>数据契约校验</h3><div class="validation-grid">${renderChecks(validation.contractChecks)}</div><h3>Track Profile 校验</h3><div class="validation-grid">${renderChecks(validation.trackChecks)}</div><h3>运行时校验</h3><div class="validation-grid">${renderChecks(validation.runtimeChecks)}</div><h3>视觉校验</h3><div class="validation-grid">${renderChecks(validation.visualChecks)}</div></section>`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJsonInput(value, fallback) {
  if (!String(value || '').trim()) return fallback;
  return JSON.parse(value);
}

function numberOrFallback(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function exportTrackProfileShape(trackProfile) {
  return {
    schemaVersion: trackProfile.schemaVersion || JUMBOTRON_TRACK_PROFILE_SCHEMA_VERSION,
    trackId: trackProfile.trackId,
    name: trackProfile.name,
    viewBox: trackProfile.viewBox,
    background: trackProfile.background,
    centerline: {
      type: trackProfile.centerline?.type || 'polyline',
      closed: Boolean(trackProfile.centerline?.closed),
      points: trackProfile.centerlinePath.map((point) => ({ x: Number(point.x), y: Number(point.y) })),
      smoothing: trackProfile.centerline?.smoothing || 'mvp-polyline'
    },
    direction: trackProfile.direction,
    startFinish: trackProfile.startFinish,
    lanes: trackProfile.lanes.map((lane) => ({ laneId: lane.laneId, offset: Number(lane.offset) })),
    checkpoints: trackProfile.checkpoints.map((checkpoint) => ({ checkpointId: checkpoint.checkpointId, label: checkpoint.label, s: Number(checkpoint.s) })),
    messageZones: trackProfile.messageZones || [],
    noBubbleZones: trackProfile.noBubbleZones || [],
    riskZones: trackProfile.riskZones || [],
    debug: trackProfile.debug || {}
  };
}

function finitePoint(value) {
  return value && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y));
}

function ensureClosedCenterline(points, closed) {
  const finitePoints = points.filter(finitePoint).map((point) => ({ x: Number(point.x), y: Number(point.y) }));
  if (!closed || finitePoints.length < 2) return finitePoints;
  const withoutClosingDuplicate = samePoint(finitePoints[0], finitePoints.at(-1)) ? finitePoints.slice(0, -1) : finitePoints;
  return [...withoutClosingDuplicate, { ...withoutClosingDuplicate[0] }];
}

function reverseCenterlinePoints(points, closed) {
  const finitePoints = ensureClosedCenterline(points, false);
  const uniquePoints = closed && samePoint(finitePoints[0], finitePoints.at(-1)) ? finitePoints.slice(0, -1) : finitePoints;
  return ensureClosedCenterline([...uniquePoints].reverse(), closed);
}

function toggleDirection(direction) {
  return direction === 'clockwise' ? 'counterclockwise' : 'clockwise';
}

function clampNumber(value, fallback, min, max) {
  const number = numberOrFallback(value, fallback);
  return Math.max(min, Math.min(max, number));
}

function backgroundAssetId(src) {
  return String(src || '').replace('/assets/', '').replace(/\.[^.]+$/, '') || 'candidate-background';
}

function buildCalibratorProfile(body = {}) {
  const base = cloneJson(jumbotronTrackProfiles[0]);
  let profile = body.profileJson ? { ...base, ...parseJsonInput(body.profileJson, base) } : base;
  profile.trackId = body.trackId || profile.trackId || 'calibrated-track';
  profile.name = body.name || profile.name || '校准赛道';
  profile.direction = body.reverseDirection ? toggleDirection(body.direction || profile.direction || 'clockwise') : (body.direction || profile.direction || 'clockwise');
  const backgroundSrc = String(body.backgroundSrcCustom || body.backgroundSrc || profile.background?.src || '').trim();
  if (backgroundSrc) {
    profile.background = { ...(profile.background || {}), assetId: backgroundAssetId(backgroundSrc), src: backgroundSrc, kind: backgroundSrc.split('.').pop() || 'webp' };
    profile.backgroundAsset = profile.background.assetId;
  }
  profile.centerline = profile.centerline || { type: 'polyline', closed: true, smoothing: 'mvp-polyline', points: profile.centerlinePath || [] };
  if (Object.hasOwn(body, 'closed')) profile.centerline.closed = body.closed === 'true';
  profile.centerline.smoothing = body.smoothing || profile.centerline.smoothing || 'mvp-polyline';
  let centerlinePoints = parseJsonInput(body.centerlinePoints, profile.centerline.points || profile.centerlinePath || []);
  if (body.deletePointIndex !== undefined && body.deletePointIndex !== '') {
    const deleteIndex = Number(body.deletePointIndex);
    if (Number.isInteger(deleteIndex)) centerlinePoints = centerlinePoints.filter((_, index) => index !== deleteIndex);
  }
  if (body.centerlineAction === 'add') {
    const point = { x: Number(body.addPointX), y: Number(body.addPointY) };
    if (finitePoint(point)) {
      const closed = Boolean(profile.centerline.closed);
      const pointsWithoutClosingDuplicate = closed && samePoint(centerlinePoints[0], centerlinePoints.at(-1)) ? centerlinePoints.slice(0, -1) : centerlinePoints;
      centerlinePoints = [...pointsWithoutClosingDuplicate, point];
    }
  }
  if (body.reverseDirection) centerlinePoints = reverseCenterlinePoints(centerlinePoints, Boolean(profile.centerline.closed));
  profile.centerline.points = ensureClosedCenterline(centerlinePoints, Boolean(profile.centerline.closed));
  profile.centerlinePath = profile.centerline.points;
  profile.startFinish = {
    ...(profile.startFinish || { startS: 0, finishS: 1, label: '起终点' }),
    startS: numberOrFallback(body.startS, profile.startFinish?.startS ?? 0),
    finishS: numberOrFallback(body.finishS, profile.startFinish?.finishS ?? 1)
  };
  profile.lanes = parseJsonInput(body.lanes, profile.lanes || (profile.laneOffsets || []).map((offset, index) => ({ laneId: `lane-${index}`, offset })));
  profile.checkpoints = parseJsonInput(body.checkpoints, profile.checkpoints || []);
  profile.messageZones = parseJsonInput(body.messageZones, profile.messageZones || [{ zoneId: 'track-bubble', offsetX: 28, offsetY: -64 }]);
  profile.noBubbleZones = parseJsonInput(body.noBubbleZones, profile.noBubbleZones || []);
  profile.riskZones = parseJsonInput(body.riskZones, profile.riskZones || []);
  profile.debug = { sampleCount: 28, collisionBox: { width: 44, height: 44 }, staleThresholdMs: JUMBOTRON_STALE_THRESHOLD_MS, ...(profile.debug || {}) };
  profile.debug.manualChecks = { horseOnTrack: JUMBOTRON_MANUAL_CHECK_PENDING, curveNatural: JUMBOTRON_MANUAL_CHECK_PENDING, bubbleClearance: JUMBOTRON_MANUAL_CHECK_PENDING, checkpointMeaning: JUMBOTRON_MANUAL_CHECK_PENDING, ...(profile.debug.manualChecks || {}) };
  return normalizeTrackProfile(profile);
}

function buildCalibratorMultiHorseEntries(trackProfile, settings) {
  const count = Math.max(1, Math.min(12, settings.horseCount));
  const laneCount = Math.max(1, trackProfile.lanes.length);
  const startByScenario = { spread: 18, clustered: 46, finish: 72 }[settings.scenarioPreset] ?? 44;
  const stepByScenario = { spread: 9, clustered: 2, finish: 3 }[settings.scenarioPreset] ?? 4;
  return Array.from({ length: count }, (_, index) => {
    const lane = trackProfile.lanes[index % laneCount] || { laneId: `lane-${index}`, offset: 0 };
    const progress = Math.min(100, startByScenario + index * stepByScenario);
    return { entryId: `multi-${index}`, displayName: `Horse ${index + 1}`, roundProgress: progress, laneOffsetIndex: index, laneId: lane.laneId, motionState: progress >= 100 ? 'finished' : 'running' };
  });
}

function buildCalibratorP1Backlog() {
  return [
    ['气泡区域编辑', 'pending', '后续把 messageZones 从 JSON textarea 升级为画布拖拽编辑。'],
    ['no bubble zone 编辑', 'pending', '后续把 noBubbleZones 从 JSON textarea 升级为画布区域编辑。'],
    ['风险区域编辑', 'pending', '后续把 riskZones 从 JSON textarea 升级为画布区域编辑。'],
    ['AI 候选点导入', 'pending', '当前只支持候选 profile JSON 粘贴，不接入 AI 识别链路。'],
    ['自动检测尖角', 'pending', '当前 Validate 提供弯道转角 warning，不自动修复。'],
    ['自动分配 lanes', 'pending', '当前手动编辑 lane offsets，不自动分配。'],
    ['导出 debug-preview.png', 'pending', '当前只导出 frozen track.profile.json 候选。'],
    ['JSON diff preview', 'implemented', '当前展示 imported profile 与 exported frozen candidate 的字段差异。']
  ];
}

function buildImportedCalibratorProfile(body = {}) {
  const base = cloneJson(jumbotronTrackProfiles[0]);
  const imported = body.profileJson ? { ...base, ...parseJsonInput(body.profileJson, base) } : base;
  const normalized = normalizeTrackProfile(imported);
  normalized.centerline = normalized.centerline || { type: 'polyline', closed: true, smoothing: 'mvp-polyline', points: normalized.centerlinePath || [] };
  normalized.centerlinePath = normalized.centerline.points || normalized.centerlinePath || [];
  normalized.lanes = normalized.lanes || [];
  normalized.checkpoints = normalized.checkpoints || [];
  return normalized;
}

function valueAtPath(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
}

function compactDiffValue(value) {
  if (Array.isArray(value)) return `${value.length} 项`;
  if (value && typeof value === 'object') return JSON.stringify(value).slice(0, 90);
  if (value === undefined || value === null || value === '') return '未设置';
  return String(value);
}

function buildTrackProfileDiffRows(importedProfile, exportProfile) {
  const imported = exportTrackProfileShape(importedProfile);
  const fields = [
    ['trackId', 'trackId'],
    ['name', 'name'],
    ['background.src', 'background.src'],
    ['centerline.closed', 'centerline.closed'],
    ['centerline.smoothing', 'centerline.smoothing'],
    ['centerline.points', 'centerline.points'],
    ['direction', 'direction'],
    ['startFinish.startS', 'startFinish.startS'],
    ['startFinish.finishS', 'startFinish.finishS'],
    ['lanes', 'lanes'],
    ['checkpoints', 'checkpoints'],
    ['messageZones', 'messageZones'],
    ['noBubbleZones', 'noBubbleZones'],
    ['riskZones', 'riskZones']
  ];
  const rows = fields.map(([path, label]) => {
    const before = valueAtPath(imported, path);
    const after = valueAtPath(exportProfile, path);
    return { label, before: compactDiffValue(before), after: compactDiffValue(after), changed: JSON.stringify(before) !== JSON.stringify(after) };
  });
  return rows.filter((row) => row.changed);
}

function buildCalibratorWorkbench(body = {}) {
  const defaultSettings = { previewProgress: 50, horseCount: 8, previewSpeed: 1, scenarioPreset: 'clustered', playMode: 'paused' };
  try {
    const trackProfile = buildCalibratorProfile(body);
    const importedProfile = buildImportedCalibratorProfile(body);
    const runtime = createJumbotronRuntime(trackProfile);
    const exportProfile = exportTrackProfileShape(trackProfile);
    const diffRows = buildTrackProfileDiffRows(importedProfile, exportProfile);
    const settings = {
      previewProgress: clampNumber(body.previewProgress, defaultSettings.previewProgress, 0, 100),
      horseCount: Math.round(clampNumber(body.horseCount, defaultSettings.horseCount, 1, 12)),
      previewSpeed: clampNumber(body.previewSpeed, defaultSettings.previewSpeed, 0.25, 4),
      scenarioPreset: body.scenarioPreset || defaultSettings.scenarioPreset,
      playMode: body.playMode || defaultSettings.playMode
    };
    const singleEntry = { entryId: 'calibrator-scrubber', displayName: `Scrubber ${settings.previewProgress}%`, roundProgress: settings.previewProgress, laneOffsetIndex: 0, laneId: trackProfile.lanes[0]?.laneId, motionState: settings.previewProgress >= 100 ? 'finished' : 'running' };
    const singlePose = { entry: singleEntry, pose: runtime.sampleHorsePose(singleEntry) };
    const previewEntries = [0, 25, 50, 75, 100].map((progress, index) => ({ entryId: `calibrator-preview-${progress}`, displayName: `${progress}%`, roundProgress: progress, laneOffsetIndex: index % Math.max(1, trackProfile.lanes.length), laneId: trackProfile.lanes[index % Math.max(1, trackProfile.lanes.length)]?.laneId, motionState: progress === 100 ? 'finished' : 'running' }));
    const poses = previewEntries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
    const multiHorseEntries = buildCalibratorMultiHorseEntries(trackProfile, settings);
    const multiHorsePoses = multiHorseEntries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
    const multiHorsePreview = buildMultiHorsePreview(trackProfile, runtime);
    const previewMessage = { messageId: 'calibrator-bubble-preview', entryId: singleEntry.entryId, type: 'milestone', severity: 'info', summary: '示例消息气泡：风险 / 里程碑优先' };
    const bubbleRect = estimateBubbleRects(trackProfile, [{ message: previewMessage, pose: singlePose.pose }])[0];
    const bubbleBlockedByNoZone = trackProfile.noBubbleZones.some((zone) => singlePose.pose.x >= zone.x && singlePose.pose.x <= zone.x + zone.width && singlePose.pose.y >= zone.y && singlePose.pose.y <= zone.y + zone.height);
    const checks = [
      ...validateTrackProfile(trackProfile, runtime),
      ['multi-horse preview count', multiHorsePreview.count >= 8],
      ['multi-horse preview in viewBox', multiHorsePreview.inViewBox],
      ['multi-horse preview distance', multiHorsePreview.minDistance > 24],
      ['multi-horse preview severe overlap', !multiHorsePreview.severeOverlap],
      ['multi-horse preview turn direction', multiHorsePreview.turnDirectionsValid]
    ];
    return { trackProfile, runtime, exportProfile, exportJson: JSON.stringify(exportProfile, null, 2), diffRows, poses, singlePose, multiHorsePoses, multiHorsePreview, messageBubblePreview: { message: previewMessage, rect: bubbleRect, blockedByNoZone: bubbleBlockedByNoZone }, settings, checks, p1Backlog: buildCalibratorP1Backlog(), error: '' };
  } catch (error) {
    const trackProfile = normalizeTrackProfile(jumbotronTrackProfiles[0]);
    const runtime = createJumbotronRuntime(trackProfile);
    const exportProfile = exportTrackProfileShape(trackProfile);
    const settings = defaultSettings;
    const singleEntry = { entryId: 'calibrator-scrubber', displayName: 'Scrubber 50%', roundProgress: 50, laneOffsetIndex: 0, laneId: trackProfile.lanes[0]?.laneId, motionState: 'running' };
    const singlePose = { entry: singleEntry, pose: runtime.sampleHorsePose(singleEntry) };
    const previewMessage = { summary: '示例消息气泡：风险 / 里程碑优先' };
    return { trackProfile, runtime, exportProfile, exportJson: JSON.stringify(exportProfile, null, 2), diffRows: [], poses: [], singlePose, multiHorsePoses: [], multiHorsePreview: buildMultiHorsePreview(trackProfile, runtime), messageBubblePreview: { message: previewMessage, rect: estimateBubbleRects(trackProfile, [{ message: previewMessage, pose: singlePose.pose }])[0], blockedByNoZone: false }, settings, checks: validateTrackProfile(trackProfile, runtime), p1Backlog: buildCalibratorP1Backlog(), error: error.message };
  }
}

function renderTrackCalibrator(session, body = {}) {
  const workbench = buildCalibratorWorkbench(body);
  const profile = workbench.trackProfile;
  const backgroundOptions = Array.from(JUMBOTRON_BACKGROUND_ASSETS).map((src) => `<option value="${escapeHtml(src)}"${profile.background?.src === src ? ' selected' : ''}>${escapeHtml(src)}</option>`).join('');
  const renderChecks = (checks) => checks.map(([label, ok]) => `<article><strong>${ok ? '✓' : '!' } ${escapeHtml(validationLabel(label))}</strong><p class="muted">${ok ? '通过' : '需要补齐'}</p></article>`).join('');
  const renderControlPoints = profile.centerlinePath.map((point, index) => `<tr><td>${index}</td><td>${Math.round(point.x)}</td><td>${Math.round(point.y)}</td><td><button class="button secondary" name="deletePointIndex" value="${index}" type="submit">删除点位</button></td></tr>`).join('');
  const checkpointMarkers = profile.checkpoints.map((checkpoint) => {
    const sample = workbench.runtime.samplePoint(checkpoint.s);
    return `<g class="checkpoint" transform="translate(${sample.point.x} ${sample.point.y})"><circle r="8" fill="#facc15" stroke="#713f12" stroke-width="3"/><text x="12" y="5">${escapeHtml(checkpoint.label)}</text></g>`;
  }).join('');
  const lanePreview = profile.lanes.map((lane) => {
    const offsetPoints = workbench.runtime.samplePoints(34).map((point, index) => {
      const sample = workbench.runtime.samplePoint(index / 33);
      return `${sample.point.x + sample.normal.x * lane.offset},${sample.point.y + sample.normal.y * lane.offset}`;
    }).join(' ');
    return `<polyline points="${offsetPoints}" fill="none" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="4 7"/>`;
  }).join('');
  const bubble = workbench.messageBubblePreview.rect || { x: 0, y: 0, width: 0, height: 0 };
  const renderJsonDiffRows = workbench.diffRows.length
    ? workbench.diffRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.before)}</td><td>${escapeHtml(row.after)}</td><td>changed</td></tr>`).join('')
    : '<tr><td colspan="4">暂无字段差异；imported profile 与 exported frozen candidate 一致。</td></tr>';
  const content = `<section class="jumbotron-page calibrator-page"><section class="jumbotron-header" aria-label="Top Toolbar"><div class="jumbotron-brandline"><span class="jumbotron-live">MVP</span><strong>Track Profile Calibrator</strong><span>设计 / 资产生产工具</span></div><div class="jumbotron-statusbar"><button class="button secondary" form="calibrator-form" type="submit">Import Background</button><button class="button secondary" form="calibrator-form" type="submit">Import Candidate Profile</button><button class="button secondary" form="calibrator-form" type="submit">Validate</button><button class="button secondary" form="calibrator-form" type="submit">Preview</button><button class="button" form="calibrator-form" type="submit">Export</button></div></section>${workbench.error ? `<section class="notice warn"><strong>导入解析失败</strong><p>${escapeHtml(workbench.error)}</p></section>` : ''}<form id="calibrator-form" method="post" action="/jumbotron/calibrator"><section class="jumbotron-calibrator"><div class="eyebrow">Import Candidate Profile → 编辑 → Validate → Export</div><h1>Track Profile Calibrator MVP</h1><p class="muted">这是设计时赛道校准工具，不是运行时大屏。候选 profile 先导入和编辑，再经过 Validate / Preview，最后导出 frozen track.profile.json candidate；预览复用 createJumbotronRuntime / sampleHorsePose，正式资产确认仍需要人工复核。</p><div class="calibrator-grid"><article><strong>Import Background</strong><p class="muted">选择允许的背景资产，Validate 会同时检查 allowlist 与真实文件存在。</p><label>允许背景资产<select name="backgroundSrc">${backgroundOptions}</select></label><label>自定义 /assets/ 输入<input name="backgroundSrcCustom" value="${escapeHtml(body.backgroundSrcCustom || '')}" placeholder="/assets/public-yard-hero.webp"></label></article><article><strong>Import Candidate Profile</strong><textarea name="profileJson" rows="8">${escapeHtml(body.profileJson || workbench.exportJson)}</textarea></article><article><strong>Export frozen track.profile.json candidate</strong><textarea readonly rows="8">${escapeHtml(workbench.exportJson)}</textarea><p class="muted">冻结候选不等于正式资产 confirmed。</p></article></div></section><section class="jumbotron-layout" aria-label="Calibrator IA"><section class="track-stage-card" aria-label="Main Canvas"><div class="eyebrow">Main Canvas</div><h2>Background Layer / Centerline Layer / Control Points Layer</h2><svg class="track-svg" viewBox="0 0 1200 620" role="img" aria-label="Track Profile Calibrator Main Canvas"><rect class="track-bg" x="22" y="22" width="1156" height="576" rx="42"/><text class="debug-label" x="44" y="58">Background Layer：${escapeHtml(profile.background?.src || '未选择')}</text>${profile.riskZones.map((zone) => `<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" fill="rgba(239,68,68,.12)" stroke="#ef4444" stroke-dasharray="8 6"/>`).join('')}${profile.noBubbleZones.map((zone) => `<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" fill="rgba(15,23,42,.08)" stroke="#64748b" stroke-dasharray="5 6"/>`).join('')}<path class="track-band" d="${jumbotronPath(profile.centerlinePath)}"/>${lanePreview}<polyline class="track-centerline" points="${jumbotronPolyline(profile.centerlinePath)}"/>${profile.centerlinePath.map((point, index) => `<g transform="translate(${point.x} ${point.y})"><circle r="8" fill="#fff" stroke="#1f49d8" stroke-width="3"/><text class="debug-label" x="12" y="5">P${index}</text></g>`).join('')}${checkpointMarkers}<g transform="translate(${workbench.singlePose.pose.x} ${workbench.singlePose.pose.y})"><circle r="18" fill="#a855f7" stroke="#f5d0fe" stroke-width="4"/><text class="debug-label" x="24" y="6">Scrubber ${workbench.settings.previewProgress}%</text></g>${workbench.multiHorsePoses.map(({ entry, pose }) => `<g transform="translate(${pose.x} ${pose.y})"><circle r="9" fill="#1f49d8" stroke="#dbeafe" stroke-width="2"/><text class="debug-label" x="14" y="5">${escapeHtml(entry.displayName.replace('Horse ', '#'))}</text></g>`).join('')}<rect x="${bubble.x}" y="${bubble.y}" width="${bubble.width}" height="${bubble.height}" rx="12" fill="rgba(255,255,255,.96)" stroke="${workbench.messageBubblePreview.blockedByNoZone ? '#ef4444' : '#1f49d8'}" stroke-width="2"/><text class="debug-label" x="${bubble.x + 12}" y="${bubble.y + 32}">Message Bubble Preview</text></svg><div class="calibrator-grid"><article><strong>Background Layer</strong><p class="muted">${escapeHtml(profile.background?.src || '未选择背景')}</p></article><article><strong>Centerline Layer</strong><p class="muted">${profile.centerlinePath.length} 个点；${profile.centerline?.closed ? '闭合路径' : '开放路径'}</p></article><article><strong>Control Points Layer</strong><p class="muted">支持添加、删除、JSON 编辑；拖拽点位 pending。</p></article><article><strong>Lane Preview Layer</strong><p class="muted">${profile.lanes.length} 条泳道偏移预览。</p></article><article><strong>Checkpoint Layer</strong><p class="muted">${profile.checkpoints.length} 个 checkpoint。</p></article><article><strong>Horse Preview Layer</strong><p class="muted">scrubber 单马 + ${workbench.multiHorsePoses.length} 匹多马预览。</p></article><article><strong>Message Bubble Preview Layer</strong><p class="muted">基于 messageZones / noBubbleZones；${workbench.messageBubblePreview.blockedByNoZone ? '当前落在 no bubble zone' : '当前可显示示例气泡'}。</p></article></div></section><aside aria-label="Right Inspector"><section class="side-card"><div class="eyebrow">Right Inspector</div><h2>Track Info</h2><label>trackId<input name="trackId" value="${escapeHtml(profile.trackId)}"></label><label>name<input name="name" value="${escapeHtml(profile.name)}"></label></section><section class="side-card"><h2>Geometry</h2><label>centerline JSON<textarea name="centerlinePoints" rows="8">${escapeHtml(JSON.stringify(profile.centerlinePath, null, 2))}</textarea></label><div class="cta-row"><label>新增 x<input name="addPointX" value="${escapeHtml(body.addPointX || '600')}"></label><label>新增 y<input name="addPointY" value="${escapeHtml(body.addPointY || '310')}"></label><button class="button secondary" name="centerlineAction" value="add" type="submit">添加 centerline point</button><button class="button secondary" name="reverseDirection" value="1" type="submit">Reverse Direction / 反转路径方向</button></div><table><thead><tr><th>#</th><th>x</th><th>y</th><th>操作</th></tr></thead><tbody>${renderControlPoints}</tbody></table><p class="muted">拖拽 centerline points：pending。</p></section><section class="side-card"><h2>终点线</h2><label>startS<input name="startS" value="${escapeHtml(profile.startFinish?.startS ?? 0)}"></label><label>finishS<input name="finishS" value="${escapeHtml(profile.startFinish?.finishS ?? 1)}"></label></section><section class="side-card"><h2>Direction</h2><label>direction<select name="direction"><option value="clockwise"${profile.direction === 'clockwise' ? ' selected' : ''}>clockwise</option><option value="counterclockwise"${profile.direction === 'counterclockwise' ? ' selected' : ''}>counterclockwise</option></select></label><label>closed<select name="closed"><option value="true"${profile.centerline?.closed ? ' selected' : ''}>true</option><option value="false"${!profile.centerline?.closed ? ' selected' : ''}>false</option></select></label><label>平滑路径预览<select name="smoothing"><option value="mvp-polyline"${profile.centerline?.smoothing === 'mvp-polyline' ? ' selected' : ''}>关闭：mvp-polyline</option><option value="preview-smoothing"${profile.centerline?.smoothing === 'preview-smoothing' ? ' selected' : ''}>开启：preview-smoothing</option></select></label><p class="muted">平滑路径预览是 MVP 视觉提示，不改写 runtime 事实来源。</p></section><section class="side-card"><h2>Lanes</h2><textarea name="lanes" rows="8">${escapeHtml(JSON.stringify(profile.lanes, null, 2))}</textarea></section><section class="side-card"><h2>Checkpoints</h2><textarea name="checkpoints" rows="7">${escapeHtml(JSON.stringify(profile.checkpoints, null, 2))}</textarea></section><section class="side-card"><h2>Message Bubble</h2><label>messageZones<textarea name="messageZones" rows="5">${escapeHtml(JSON.stringify(profile.messageZones, null, 2))}</textarea></label><label>noBubbleZones<textarea name="noBubbleZones" rows="5">${escapeHtml(JSON.stringify(profile.noBubbleZones, null, 2))}</textarea></label><label>riskZones<textarea name="riskZones" rows="5">${escapeHtml(JSON.stringify(profile.riskZones, null, 2))}</textarea></label></section><section class="side-card"><h2>Validation Results</h2><div class="validation-grid">${renderChecks(workbench.checks)}</div></section></aside></section><section class="jumbotron-kpis" aria-label="Bottom Preview Bar"><span class="jumbotron-chip"><span>Progress Scrubber</span><strong>${workbench.settings.previewProgress}%</strong></span><label>Progress Scrubber<input type="range" name="previewProgress" min="0" max="100" value="${escapeHtml(workbench.settings.previewProgress)}"></label><label>Horse Count<input name="horseCount" value="${escapeHtml(workbench.settings.horseCount)}"></label><label>Speed<input name="previewSpeed" value="${escapeHtml(workbench.settings.previewSpeed)}"></label><label>Play / Pause<select name="playMode"><option value="paused"${workbench.settings.playMode === 'paused' ? ' selected' : ''}>Pause</option><option value="play"${workbench.settings.playMode === 'play' ? ' selected' : ''}>Play</option></select></label><label>Scenario Presets<select name="scenarioPreset"><option value="clustered"${workbench.settings.scenarioPreset === 'clustered' ? ' selected' : ''}>clustered</option><option value="spread"${workbench.settings.scenarioPreset === 'spread' ? ' selected' : ''}>spread</option><option value="finish"${workbench.settings.scenarioPreset === 'finish' ? ' selected' : ''}>finish</option></select></label><button class="button" type="submit">Validate / Preview / Export</button><a class="button secondary" href="/jumbotron">返回 Race Live View</a></section></form><section class="jumbotron-validation"><div class="eyebrow">JSON diff preview</div><h2>Imported profile → Exported frozen candidate</h2><p class="muted">只比较 Calibrator 会写入 track.profile.json 的关键字段，用于审阅导入值和冻结候选之间发生了什么变化。</p><table><thead><tr><th>字段</th><th>Imported profile</th><th>Exported candidate</th><th>状态</th></tr></thead><tbody>${renderJsonDiffRows}</tbody></table></section><section class="jumbotron-validation"><div class="eyebrow">Calibrator P1 Backlog / Pending</div><h2>P1 功能边界</h2><div class="validation-grid">${workbench.p1Backlog.map(([title, status, note]) => `<article><strong>${escapeHtml(title)} · ${escapeHtml(status)}</strong><p class="muted">${escapeHtml(note)}</p></article>`).join('')}</div></section></section>`;
  return page('Track Profile Calibrator', '/jumbotron', session, content);
}

function renderJumbotronFooter({ trackProfile, raceSnapshot, showReviewTools }) {
  const competition = raceSnapshot.competition;
  const reviewHref = showReviewTools ? '/jumbotron' : '/jumbotron?debug=1';
  const reviewLabelText = showReviewTools ? '返回公开视图' : '打开审阅工具';
  return `<section class="jumbotron-footer"><article><div class="eyebrow">展示边界</div><h2>只展示摘要</h2><p class="muted">不展示完整 Session、终端日志、长文本评论流或复杂 diff。</p><div class="cta-row"><a class="button secondary" href="${reviewHref}">${reviewLabelText}</a><a class="button secondary" href="/jumbotron/calibrator">赛道校准器</a></div></article><article><div class="eyebrow">赛事状态</div><h2>${escapeHtml(competition.liveStatus)}</h2><p class="muted">主题：${escapeHtml(competition.theme)}；主办方：${escapeHtml(competition.organizer || 'Organizer')}</p><p class="muted">阶段：${escapeHtml(competition.currentPhase)}；下一步：${escapeHtml(competition.nextPhase)}</p></article><article><div class="eyebrow">赛道模板</div><h2>${escapeHtml(trackProfile.name || trackProfile.trackId)}</h2><p><span class="boundary-pill">背景资产</span><span class="boundary-pill">视图框</span><span class="boundary-pill">设计尺寸</span><span class="boundary-pill">中心线路径</span><span class="boundary-pill">起点</span><span class="boundary-pill">终点</span><span class="boundary-pill">检查点</span><span class="boundary-pill">泳道偏移</span><span class="boundary-pill">安全区</span></p></article><article id="remote-cockpit"><div class="eyebrow">协作入口</div><h2>查看队伍现场</h2><p class="muted">入口保留在大屏，不在此页展开完整协作流程。</p><p class="muted">系统时间：${escapeHtml(competition.systemTime)}</p></article></section>`;
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

async function apiJumbotronBubbles(res, profileParam = '') {
  const profileResolution = resolveJumbotronDataProfile(profileParam);
  if (!profileResolution.ok) return jsonResponse(res, 400, { error: 'invalid_jumbotron_data_profile', requestedProfile: profileResolution.requestedProfile, allowedProfiles: profileResolution.allowedProfiles });
  const [disclosures, leaderboard, teams, records, service] = await Promise.all([
    readDisclosures(),
    readJson(leaderboardPath),
    readJson(teamsPath),
    readJson(recordsPath),
    readEvaluatorService()
  ]);
  const model = buildJumbotronModel(disclosures, leaderboard, teams, records, service, { profileResolution });
  const messagePlan = model.messagePlan;
  const bubbleLayerHtml = renderJumbotronBubbleLayer(model);
  const queue = messagePlan.queue.map((item) => ({
    queueId: item.queueId,
    entryId: item.entryId,
    priority: item.priority,
    durationSecond: item.durationSecond,
    sizeHint: item.sizeHint,
    displayMode: item.displayMode,
    placementSeed: item.placementSeed,
    hasPose: Boolean(item.pose)
  }));
  const plan = {
    bubbles: messagePlan.bubbles.map((item) => ({
      queueId: item.queueId,
      entryId: item.entryId,
      startSecond: item.startSecond,
      durationSecond: item.durationSecond,
      cycleSeconds: item.cycleSeconds,
      priority: item.priority,
      slotIndex: item.slotIndex,
      sizeHint: item.sizeHint
    })),
    rejectedQueue: messagePlan.rejectedQueue.map((item) => ({ queueId: item.queueId, entryId: item.entryId, priority: item.priority, hasPose: Boolean(item.pose) }))
  };
  return jsonResponse(res, 200, { dataProfileId: model.dataProfile.dataProfileId, profileAlias: model.dataProfile.profileAlias, version: messagePlan.version, queue, plan, bubbleLayerHtml, rules: messagePlan.rules });
}

async function apiJumbotronDataEvidence(res, profileParam = '') {
  const profileResolution = resolveJumbotronDataProfile(profileParam);
  if (!profileResolution.ok) return jsonResponse(res, 400, { error: 'invalid_jumbotron_data_profile', requestedProfile: profileResolution.requestedProfile, allowedProfiles: profileResolution.allowedProfiles });
  const curated = readCuratedJumbotronMockData(profileResolution);
  if (!curated) return jsonResponse(res, 404, { error: 'jumbotron_data_profile_missing', requestedProfile: profileResolution.requestedProfile, dataProfileId: profileResolution.dataProfileId });
  return jsonResponse(res, 200, buildJumbotronDataEvidence(curated.raceSnapshot, profileResolution));
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
        return res.end(await renderJumbotron(session, { showReviewTools: url.searchParams.get('debug') === '1', profile: url.searchParams.get('profile') || 'full' }));
      }
      if (req.method === 'GET' && url.pathname === '/jumbotron/calibrator') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderTrackCalibrator(session));
      }
      if (req.method === 'POST' && url.pathname === '/jumbotron/calibrator') {
        const body = await readBody(req);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderTrackCalibrator(session, body));
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

      if (req.method === 'GET' && url.pathname === '/api/jumbotron-bubbles') return apiJumbotronBubbles(res, url.searchParams.get('profile') || 'full');
      if (req.method === 'GET' && url.pathname === '/api/jumbotron-data-evidence') return apiJumbotronDataEvidence(res, url.searchParams.get('profile') || 'full');
      if (req.method === 'GET' && url.pathname === '/api/team-history') return apiTeamHistory(req, res, session);
      if (req.method === 'GET' && url.pathname.startsWith('/api/team-records/')) return apiTeamRecord(req, res, session, url.pathname.split('/').at(-1));

      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page('未找到', '', session, '<section class="notice danger"><strong>未找到页面</strong></section>'));
    } catch (error) {
      if (res.headersSent) {
        console.error(error);
        return res.destroy(error);
      }
      res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page('错误', '', null, `<section class="notice danger"><strong>运行错误</strong><p>${escapeHtml(error.message)}</p></section>`));
    }
  });
  server.listen(port);
  return server;
}
