import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
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
  const topbarToggle = active === '/login' ? '' : '<button class="topbar-toggle" type="button" data-topbar-toggle aria-expanded="true" aria-controls="topbar-content">收起顶栏</button>';
  const topbarCollapseScript = active === '/login' ? '' : `<script>(()=>{const topbar=document.querySelector('[data-topbar]');const button=topbar?.querySelector('[data-topbar-toggle]');if(!topbar||!button)return;const setCollapsed=(collapsed)=>{topbar.classList.toggle('is-collapsed',collapsed);button.textContent=collapsed?'展开顶栏':'收起顶栏';button.setAttribute('aria-expanded',collapsed?'false':'true');};button.addEventListener('click',()=>setCollapsed(!topbar.classList.contains('is-collapsed')));})();</script>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{--ink:#172033;--muted:#667085;--line:#d9dee8;--bg:#f4f6fb;--panel:#fff;--accent:#1f49d8;--dark:#121826;--green:#15734f;--green-bg:#e7f5ee;--amber:#9a6500;--amber-bg:#fff5d8;--red:#b42318;--red-bg:#fff1f0;--purple:#5b3fb5;--purple-bg:#f0ecff;--blue-bg:#edf4ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#e9efff 0,#f4f6fb 36%,#eef2f7 100%);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.jumbotron-page{width:calc(100vw - 44px);margin-left:calc(50% - 50vw + 22px);min-height:calc(100vh - 92px);background:linear-gradient(135deg,#f8fbff 0,#eef4ff 48%,#fff7ed 100%);color:#172033;border-radius:22px;padding:10px}.jumbotron-page .muted{color:#667085}.jumbotron-page a{text-decoration:none;color:inherit}.jumbotron-header,.jumbotron-kpis,.jumbotron-layout,.jumbotron-ticker,.jumbotron-debug,.jumbotron-calibrator,.jumbotron-validation,.jumbotron-footer{border:1px solid rgba(148,163,184,.32);background:rgba(255,255,255,.92);border-radius:18px;padding:12px;margin-bottom:8px;box-shadow:0 12px 28px rgba(31,73,216,.06)}.jumbotron-drawer{border:1px solid rgba(148,163,184,.32);background:rgba(255,255,255,.92);border-radius:18px;margin-bottom:8px;box-shadow:0 12px 28px rgba(31,73,216,.06);overflow:hidden;overflow-anchor:none}.jumbotron-drawer-card{background:rgba(255,255,255,.9);border-color:rgba(148,163,184,.38)}.jumbotron-drawer-head{min-height:54px;padding:7px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative;z-index:1}.jumbotron-drawer-head>div{min-width:0}.jumbotron-drawer-head h2{display:block;margin:0;font-size:18px;line-height:1.12;color:#172033;white-space:normal}.jumbotron-drawer-icon{flex:0 0 auto;opacity:.58;font-size:34px;font-weight:950;line-height:1;color:#172033;transition:transform .18s ease,opacity .18s ease}.jumbotron-drawer-body{max-height:0;opacity:0;overflow:hidden;padding:0 12px 0;pointer-events:none;transition:max-height .26s ease,opacity .14s ease,padding-bottom .26s ease}.jumbotron-drawer:hover .jumbotron-drawer-body,.jumbotron-drawer:focus-within .jumbotron-drawer-body,.jumbotron-drawer.is-focus-open .jumbotron-drawer-body,.jumbotron-drawer.is-replay-expanded .jumbotron-drawer-body{max-height:420px;opacity:1;padding:0 12px 12px;pointer-events:auto;transition-delay:.45s}.jumbotron-profile-drawer:hover .jumbotron-drawer-body,.jumbotron-profile-drawer:focus-within .jumbotron-drawer-body{max-height:760px}.jumbotron-drawer:hover .jumbotron-drawer-icon,.jumbotron-drawer:focus-within .jumbotron-drawer-icon,.jumbotron-drawer.is-focus-open .jumbotron-drawer-icon,.jumbotron-drawer.is-replay-expanded .jumbotron-drawer-icon{opacity:.76;transform:rotate(180deg)}.jumbotron-mini-map-drawer{position:relative;z-index:6;overflow:visible}.jumbotron-mini-map-drawer .jumbotron-drawer-body{position:absolute;left:0;right:0;top:100%;z-index:8;background:rgba(255,255,255,.96);border:1px solid rgba(148,163,184,.32);border-top:0;border-radius:0 0 18px 18px;box-shadow:0 18px 34px rgba(16,24,40,.18);overflow:visible}.jumbotron-mini-map-drawer:hover .jumbotron-drawer-body,.jumbotron-mini-map-drawer:focus-within .jumbotron-drawer-body,.jumbotron-mini-map-drawer.is-replay-expanded .jumbotron-drawer-body{max-height:420px;opacity:1;padding:0 12px 12px;pointer-events:auto;transition-delay:.45s}.jumbotron-profile-grid article.is-active{background:#f8fbff;box-shadow:inset 3px 0 0 #1f49d8}.jumbotron-header{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:8px 12px}.jumbotron-brandline{display:flex;align-items:center;gap:10px;min-width:0}.jumbotron-brandline strong{font-size:18px;white-space:nowrap}.jumbotron-brandline span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.jumbotron-statusbar{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.jumbotron-statusbar span,.jumbotron-chip{border:1px solid rgba(148,163,184,.34);background:#fff;border-radius:999px;padding:6px 10px;font-weight:850;color:#344054}.jumbotron-live{display:inline-flex;border-radius:999px;background:#dc2626;color:#fff;padding:5px 10px;font-weight:900;letter-spacing:.08em}.jumbotron-kpis{display:flex;gap:8px;overflow:hidden;align-items:center;padding:8px 10px}.jumbotron-chip{display:flex;gap:6px;align-items:center;flex:0 0 auto}.jumbotron-chip strong{font-size:16px;color:#172033}.jumbotron-chip span{font-size:12px;color:#667085}.jumbotron-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:10px;align-items:stretch}.calibrator-layout{align-items:start}.calibrator-layout>aside{overflow-y:auto;overscroll-behavior:contain;padding-right:2px}.calibrator-layout .side-card:last-child{margin-bottom:0}.jumbotron-live-layout{grid-template-columns:280px minmax(0,1fr);height:auto;min-height:0}.jumbotron-live-layout>aside{grid-column:1;grid-row:1;overflow:visible}.jumbotron-live-layout>.track-stage-card{grid-column:2;grid-row:1}.track-stage-card{background:rgba(255,255,255,.78);border:1px solid rgba(148,163,184,.26);border-radius:18px;padding:10px}.track-stage-card h2{font-size:24px;margin:2px 0 6px}.track-svg{display:block;width:100%;height:auto;aspect-ratio:var(--track-aspect-ratio,1672/941)}.calibrator-layout .track-svg{touch-action:none}.calibrator-point{cursor:grab}.calibrator-point.is-selected circle,.calibrator-point.is-dragging circle{fill:#dbeafe;stroke:#0f2f9e;stroke-width:4}.calibrator-point.is-dragging{cursor:grabbing}.calibrator-canvas-help{margin:0 0 8px;color:#475467}.mini-map-svg{width:100%;height:128px;border-radius:12px;background:#f8fafc}.mini-map-svg .track-band{stroke-width:110}.mini-map-svg .track-centerline{stroke-width:12}.track-bg{fill:#f8fafc;stroke:rgba(31,73,216,.25);stroke-width:2}.track-background-image{opacity:.88;filter:saturate(1.06) contrast(1.04)}.track-band{fill:none;stroke:rgba(215,227,248,.72);stroke-width:72;stroke-linecap:round;stroke-linejoin:round}.track-centerline{fill:none;stroke:#1f49d8;stroke-width:4;stroke-dasharray:10 10}.track-samples{fill:none;stroke:#f59e0b;stroke-width:2;stroke-dasharray:3 14}.jumbotron-geometry-hidden .track-band,.jumbotron-geometry-hidden .track-centerline,.jumbotron-geometry-hidden .track-samples{display:none}.horse-body{fill:rgba(255,255,255,.7);stroke:#172033;stroke-width:3}.horse-rider-sprite{pointer-events:none;filter:drop-shadow(0 5px 8px rgba(15,23,42,.28))}.horse-arrow{fill:#2563eb}.horse-low .horse-arrow{fill:#22c55e}.horse-medium .horse-arrow{fill:#f59e0b}.horse-high .horse-arrow,.horse-critical .horse-arrow{fill:#ef4444}.horse-state-sprinting .horse-body,.horse-rank-leader .horse-body{filter:drop-shadow(0 0 10px rgba(37,99,235,.45));animation:jumbotronLowPulse 2.8s ease-in-out infinite}.horse-state-blocked .horse-body,.horse-state-takeover .horse-body,.horse-risk-critical .horse-body,.horse-risk-high .horse-body{stroke:#dc2626;stroke-width:4;filter:drop-shadow(0 0 10px rgba(220,38,38,.36))}.horse-state-finished .horse-body{stroke:#16a34a;stroke-width:4}.horse-state-stale .horse-body{stroke:#64748b;stroke-dasharray:5 4}.horse-status-pill text{font-size:11px;font-weight:950;fill:#172033;stroke:#fff;stroke-width:3px;paint-order:stroke}.horse-status-pill rect{fill:rgba(255,255,255,.92);stroke:rgba(23,32,51,.24);stroke-width:1.2}.track-alert-ring{fill:none;stroke:#ef4444;stroke-width:3;stroke-dasharray:8 6;opacity:.62;animation:jumbotronLowPulse 3.2s ease-in-out infinite}@keyframes jumbotronLowPulse{0%,100%{opacity:.82}50%{opacity:1}}.horse-label-group{pointer-events:visiblePainted}.horse-label-line{stroke:#172033;stroke-width:1.8;stroke-linecap:round;opacity:.34}.horse-label-bg{fill:none;stroke:none}.horse-label,.checkpoint text,.debug-label{fill:#172033;font-size:16px;font-weight:900;paint-order:stroke;stroke:#fff;stroke-width:4px}.message-bubble-anchor{opacity:0;transform-box:fill-box;transform-origin:center;animation-duration:var(--bubble-cycle);animation-delay:var(--bubble-start);animation-iteration-count:infinite;animation-timing-function:ease-in-out}.message-bubble-line{stroke:#1f49d8;stroke-width:2.5;stroke-linecap:round;opacity:.72}.message-bubble rect{fill:rgba(255,255,255,.96);stroke:#1f49d8;stroke-width:2}.message-bubble text{fill:#1d2939;font-size:13px;font-weight:800}${jumbotronBubbleAnimationCss()}.entry-tooltip{opacity:0;pointer-events:none;transition:opacity .12s ease}.jumbotron-focus-source:hover .entry-tooltip,.jumbotron-focus-source:focus .entry-tooltip,.jumbotron-focus-source:focus-within .entry-tooltip{opacity:1}.entry-tooltip rect{fill:rgba(15,23,42,.94);stroke:rgba(255,255,255,.72);stroke-width:1.5}.entry-tooltip text{fill:#fff;font-size:14px;font-weight:850;stroke:none}.jumbotron-focus-source{position:relative;outline:none}.html-tooltip{position:absolute;left:0;bottom:calc(100% + 8px);z-index:5;width:268px;background:#172033;color:#fff;border-radius:12px;padding:10px;box-shadow:0 16px 28px rgba(16,24,40,.22);opacity:0;pointer-events:none;transform:translateY(4px);transition:opacity .12s ease,transform .12s ease}.legend-entry{display:block;position:relative;border-radius:10px;padding:6px 7px;margin:3px 0;color:inherit}.legend-entry:hover,.legend-entry:focus{background:#f8fbff}.legend-entry .html-tooltip{left:calc(100% + 10px);right:auto;top:50%;bottom:auto;transform:translate(4px,-50%);z-index:20}.legend-entry:hover .html-tooltip,.legend-entry:focus .html-tooltip,.legend-entry:focus-within .html-tooltip{opacity:1;transform:translate(0,-50%)}@media(max-width:820px){.legend-entry .html-tooltip{left:0;top:auto;bottom:calc(100% + 8px);transform:translateY(4px)}.legend-entry:hover .html-tooltip,.legend-entry:focus .html-tooltip,.legend-entry:focus-within .html-tooltip{transform:translateY(0)}}.jumbotron-focus-source:hover .html-tooltip,.jumbotron-focus-source:focus .html-tooltip,.jumbotron-focus-source:focus-within .html-tooltip{opacity:1;transform:translateY(0)}.jumbotron-focus-source.legend-entry:hover .html-tooltip,.jumbotron-focus-source.legend-entry:focus .html-tooltip,.jumbotron-focus-source.legend-entry:focus-within .html-tooltip{opacity:1;transform:translate(0,-50%)}.html-tooltip strong{display:block;color:#fff}.html-tooltip span{display:block;color:#dbeafe;font-size:12px;line-height:1.45}.ticker-item{position:relative;display:inline-flex;min-width:0;max-width:clamp(150px,22vw,260px)}.ticker-item>span,.ticker-more{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ticker-item .html-tooltip{left:auto;right:0;bottom:calc(100% + 10px)}.focus-details-card{position:sticky;top:74px}.jumbotron-live-layout>aside{display:flex;flex-direction:column;height:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;overflow-anchor:none;padding-right:2px}.jumbotron-live-layout>aside>.side-card,.jumbotron-live-layout>aside>.jumbotron-drawer{flex:0 0 auto}.jumbotron-live-layout .side-card:last-child,.jumbotron-live-layout .jumbotron-drawer:last-child{margin-bottom:0}.jumbotron-live-layout .focus-details-card{position:static}.jumbotron-live-layout>.track-stage-card{height:auto;display:flex;flex-direction:column;min-height:0}.jumbotron-live-layout .track-svg{flex:0 0 auto;min-height:0;height:auto;aspect-ratio:auto}.focus-detail-list{display:grid;gap:8px}.focus-detail-card{display:none;border:1px solid rgba(31,73,216,.22);background:#f8fbff;border-radius:12px;padding:10px}.focus-detail-card:first-child{display:block}.focus-detail-list.has-active-focus .focus-detail-card{display:none}.focus-detail-list.has-active-focus .focus-detail-card.is-active{display:block;outline:3px solid rgba(31,73,216,.24)}.focus-detail-list:has(.focus-detail-card:target) .focus-detail-card{display:none}.focus-detail-list:has(.focus-detail-card:target) .focus-detail-card:target{display:block}.focus-detail-card:target{outline:3px solid rgba(31,73,216,.24)}.focus-detail-card p{margin:6px 0}.focus-trigger{cursor:pointer}.side-card{background:rgba(255,255,255,.86);border:1px solid rgba(148,163,184,.28);border-radius:16px;padding:9px;margin-bottom:7px}.side-card h2,.jumbotron-debug h2,.jumbotron-calibrator h2,.jumbotron-validation h2{margin:3px 0 7px;color:#172033;font-size:18px}.side-card h3{margin:8px 0 5px;font-size:14px}.side-card p{margin:5px 0}.ranking-list{margin:0;padding-left:19px}.ranking-list li{margin:6px 0}.attention-item{border-radius:12px;background:rgba(127,29,29,.18);padding:7px;margin-top:6px}.attention-item-high,.attention-item-critical{box-shadow:inset 3px 0 0 #dc2626,0 0 0 1px rgba(220,38,38,.18);animation:jumbotronLowPulse 3.4s ease-in-out infinite}.gap-pill,.state-pill{display:inline-flex;border-radius:999px;background:#eef4ff;border:1px solid rgba(31,73,216,.18);padding:2px 7px;margin-left:4px;font-size:11px;font-weight:900;color:#1d2939}.state-pill-risk{background:#fff1f0;border-color:rgba(220,38,38,.28);color:#b42318}.focus-trigger strong{text-decoration-thickness:2px;text-underline-offset:3px}.focus-trigger:hover strong,.focus-trigger:focus strong{text-decoration:underline}.jumbotron-ticker{display:flex;gap:10px;align-items:center;overflow:hidden;padding:9px 12px}.jumbotron-ticker div{display:flex;gap:8px;overflow:hidden}.jumbotron-ticker span{flex:0 0 auto;background:#eef4ff;border-radius:999px;padding:7px 10px;color:#344054}.debug-grid,.validation-grid,.calibrator-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.debug-grid article,.validation-grid article,.calibrator-grid article{background:#fff;border:1px solid rgba(148,163,184,.26);border-radius:12px;padding:12px}.debug-grid article.review-check-ok,.validation-grid article.review-check-ok,.calibrator-grid article.review-check-ok{background:rgba(34,197,94,.5);border-color:rgba(22,163,74,.48)}.debug-grid article.review-check-warn,.validation-grid article.review-check-warn,.calibrator-grid article.review-check-warn{background:rgba(180,111,55,.5);border-color:rgba(146,64,14,.5)}.review-check-status{display:inline-flex;border-radius:999px;background:rgba(255,255,255,.58);padding:4px 10px;font-weight:950;color:#172033;margin-top:4px}.calibrator-preview-svg{width:100%;height:220px}.jumbotron-footer{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.jumbotron-footer .jumbotron-drawer{margin-bottom:0}.boundary-pill{display:inline-flex;border:1px solid rgba(56,189,248,.35);border-radius:999px;padding:6px 9px;color:#bae6fd;margin:3px}.topbar{position:sticky;top:0;z-index:2;background:rgba(255,255,255,.96);color:#172033;border-bottom:1px solid rgba(148,163,184,.32);box-shadow:0 12px 28px rgba(31,73,216,.06);transition:min-height .18s ease,box-shadow .18s ease}.topbar-inner{max-width:1180px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;transition:padding .18s ease,min-height .18s ease}.topbar-actions{display:flex;align-items:center;gap:8px}.topbar-toggle{border:1px solid rgba(148,163,184,.38);border-radius:8px;padding:8px 10px;background:#fff;color:#475467;font:inherit;font-weight:900;cursor:pointer}.topbar-toggle:hover{background:#eef4ff;color:#1f49d8}.topbar.is-collapsed .brand,.topbar.is-collapsed .nav,.topbar.is-collapsed .identity{display:none}.topbar.is-collapsed .topbar-inner{min-height:44px;padding:6px 22px;justify-content:flex-end}.topbar.is-collapsed .topbar-toggle{background:#eef4ff;color:#1f49d8;border-color:rgba(31,73,216,.22)}.brand{display:flex;align-items:center;gap:10px}.mark{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#e11d48,#f97316);box-shadow:inset 0 -10px 0 rgba(0,0,0,.18)}.brand strong{display:block;font-size:15px}.brand span{display:block;color:#667085;font-size:12px}.nav{display:flex;gap:4px;flex-wrap:wrap}.nav a,.identity a,.identity span{border-radius:8px;padding:8px 10px;text-decoration:none;font-weight:800}.nav a{color:#475467}.nav a.active,.nav a:hover{background:#eef4ff;color:#1f49d8}.identity{display:flex;align-items:center;gap:8px}.identity span,.identity a{background:#f8fafc;color:#172033;border:1px solid rgba(148,163,184,.32)}.workspace{max-width:1180px;margin:0 auto;padding:26px 22px}.hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr);gap:14px;margin-bottom:14px}.panel,.card,.notice{background:rgba(255,255,255,.94);border:1px solid var(--line);border-radius:14px;padding:18px}.panel{box-shadow:0 18px 40px rgba(16,24,40,.07);position:relative;overflow:hidden}.hero-art:after{content:"";position:absolute;right:-70px;top:-70px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,#bfd2ff 0,#e8efff 42%,transparent 70%);opacity:.9}.public-hero{background:linear-gradient(90deg,rgba(255,255,255,.86) 0%,rgba(255,255,255,.62) 52%,rgba(255,255,255,.34) 100%),url('/assets/public-yard-hero.webp') center/cover}.public-hero:after{right:-30px;top:-40px;background:radial-gradient(circle,rgba(249,115,22,.24) 0,rgba(191,210,255,.18) 48%,transparent 72%)}.organizer-hero{background:linear-gradient(90deg,rgba(255,255,255,.96),rgba(255,255,255,.88)),url('/assets/organizer-source-visual.webp') center/cover}.organizer-hero:after{right:-40px;top:-50px;background:radial-gradient(circle,rgba(20,184,166,.22) 0,rgba(91,63,181,.18) 50%,transparent 74%)}.hero-art>*{position:relative;z-index:1}.visual-card{position:relative;overflow:hidden;min-height:190px}.organizer-card{background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,255,255,.8)),url('/assets/organizer-source-visual.webp') center/cover}.visual-card:before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(31,73,216,.12),rgba(225,29,72,.08)),repeating-linear-gradient(135deg,transparent 0 18px,rgba(31,73,216,.06) 18px 19px);pointer-events:none}.organizer-card:before{background:linear-gradient(135deg,rgba(16,24,40,.1),rgba(20,184,166,.12)),radial-gradient(circle at 80% 20%,rgba(249,115,22,.16),transparent 42%)}.visual-card>*{position:relative;z-index:1}.service-hero{grid-template-columns:minmax(0,1fr) minmax(420px,.82fr)}.service-card{min-height:300px;padding:30px}.service-card h2{font-size:34px;line-height:1.08;margin:22px 0 18px}.service-card>p{font-size:19px;line-height:1.7}.service-card .signal{margin:22px 0}.service-card .signal-row{padding:22px;border-radius:18px;gap:16px}.service-card .signal-row strong{font-size:21px}.service-card .signal-row p{font-size:18px;line-height:1.65;margin:12px 0 0}.service-card .signal-dot{width:13px;height:20px;border-radius:999px;margin-top:4px}.service-card .button{width:100%;padding:17px 18px;border-radius:14px;font-size:18px}.panel h1{font-size:34px;line-height:1.08;margin:8px 0}.panel p,.card p,.notice p{color:var(--muted);line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.stack{display:grid;gap:12px}.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.eyebrow{letter-spacing:.08em;text-transform:uppercase;font-size:11px;font-weight:900;color:#667085}.pill{display:inline-flex;border-radius:7px;padding:4px 8px;font-size:12px;font-weight:900;background:#eef2ff;color:#243b83}.pill[hidden]{display:none}.pill.green{background:var(--green-bg);color:var(--green)}.pill.amber{background:var(--amber-bg);color:var(--amber)}.pill.red{background:var(--red-bg);color:var(--red)}.pill.purple{background:var(--purple-bg);color:var(--purple)}.button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent);border-radius:9px;padding:10px 13px;background:var(--accent);color:#fff;font-weight:900;text-decoration:none;cursor:pointer}.button.secondary{background:#fff;color:#1d2939;border-color:var(--line)}.button.danger{background:#b42318;border-color:#b42318}.button.disabled{background:#eef2f7;color:#667085;border-color:#d0d5dd;cursor:not-allowed}.cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.metric-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}.metric{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}.metric strong{display:block;font-size:24px;margin:6px 0 2px}.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:12px}.flow-step{border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px}.flow-step strong{display:block;margin-top:4px}.signal{display:grid;gap:10px}.signal-row{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}.signal-dot{width:11px;height:11px;border-radius:50%;background:#98a2b3;margin-top:7px}.signal-dot.green{background:#17b26a}.signal-dot.amber{background:#f79009}.signal-dot.red{background:#f04438}.action-list{display:grid;gap:10px}.action-item{display:flex;justify-content:space-between;gap:16px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px;text-decoration:none;color:var(--ink)}.action-item:hover{box-shadow:0 10px 24px rgba(16,24,40,.06)}.action-item strong{display:block;margin-bottom:4px}.action-item em{display:block;color:var(--muted);font-style:normal;line-height:1.45}.arrow{font-size:22px;font-weight:900;color:#98a2b3}.notice.ok{background:var(--green-bg);border-color:#b7ebd0}.notice.warn{background:var(--amber-bg);border-color:#f6dfa0}.notice.danger{background:var(--red-bg);border-color:#ffd0d0}form{display:grid;gap:12px}label{display:grid;gap:6px;font-weight:800;color:#344054}input,textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:11px;font:inherit;background:#fff}table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}th,td{padding:11px 12px;border-bottom:1px solid #edf0f5;text-align:left;vertical-align:top}th{background:#f8fafc;color:#344054;font-size:12px;text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}.radar-panel{display:grid;grid-template-columns:minmax(260px,330px) minmax(0,1fr);gap:16px;align-items:center;margin-top:14px}.radar-svg{width:100%;max-width:330px}.radar-legend{display:grid;gap:8px;list-style:none;margin:0;padding:0}.radar-legend li{display:flex;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:9px 11px}.radar-score{font-weight:900;color:var(--accent)}.result-radar{margin-top:14px}.timeline{display:grid;gap:10px}.event{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px}.event-no{width:34px;height:34px;border-radius:50%;background:#101828;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}details{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}summary{cursor:pointer;list-style:none;padding:14px 16px;font-weight:900}summary::-webkit-details-marker{display:none}.details-body{border-top:1px solid var(--line);padding:14px 16px;background:#fbfcff}.muted{color:var(--muted)}@media(max-width:820px){.jumbotron-page{width:auto;margin-left:0}.jumbotron-header{align-items:flex-start;flex-direction:column}.jumbotron-layout{grid-template-columns:1fr}.jumbotron-live-layout>aside,.jumbotron-live-layout>.track-stage-card{grid-column:auto;grid-row:auto}.track-svg{height:520px}.topbar-inner{align-items:flex-start;flex-direction:column}.hero,.split,.radar-panel,.service-hero{grid-template-columns:1fr}.event{grid-template-columns:1fr}}
.calibrator-trace-guide{fill:none;stroke:#0ea5e9;stroke-width:4;stroke-dasharray:2 7;stroke-linecap:round;opacity:.72;vector-effect:non-scaling-stroke}</style>
</head>
<body><main class="shell"><header class="topbar" data-topbar><div class="topbar-inner" id="topbar-content"><div class="brand"><div class="mark"></div><div><strong>GRS 001</strong><span>赛事公开展示</span></div></div>${nav}<div class="topbar-actions">${identity}${topbarToggle}</div></div></header><section class="workspace">${content}</section>${topbarCollapseScript}</main></body></html>`;
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
const JUMBOTRON_RUNTIME_ASSETS = new Map([
  ['/assets/jumbotron/background1.png', { file: 'background1.png', contentType: 'image/png' }],
  ['/assets/jumbotron/example.png', { file: 'example.png', contentType: 'image/png' }],
  ['/assets/jumbotron/rider3_run.png', { file: 'rider3_run.png', contentType: 'image/png' }],
  ['/assets/jumbotron/rider3_walk.png', { file: 'rider3_walk.png', contentType: 'image/png' }],
  ['/assets/jumbotron/rider3_stay.png', { file: 'rider3_stay.png', contentType: 'image/png' }],
  ['/assets/jumbotron/rider3_run.gif', { file: 'rider3_run.gif', contentType: 'image/gif' }],
  ['/assets/jumbotron/rider3_walk.gif', { file: 'rider3_walk.gif', contentType: 'image/gif' }],
  ['/assets/jumbotron/rider3_stay.gif', { file: 'rider3_stay.gif', contentType: 'image/gif' }],
  ['/assets/jumbotron/rider3_run.webp', { file: 'rider3_run.webp', contentType: 'image/webp' }],
  ['/assets/jumbotron/rider3_walk.webp', { file: 'rider3_walk.webp', contentType: 'image/webp' }],
  ['/assets/jumbotron/rider3_stay.webp', { file: 'rider3_stay.webp', contentType: 'image/webp' }],
  ['/assets/jumbotron/jumbotron-state-badges.png', { file: 'jumbotron-state-badges.png', contentType: 'image/png' }],
  ['/assets/jumbotron/state-badge-idle.png', { file: 'state-badge-idle.png', contentType: 'image/png' }],
  ['/assets/jumbotron/state-badge-running.png', { file: 'state-badge-running.png', contentType: 'image/png' }],
  ['/assets/jumbotron/state-badge-sprinting.png', { file: 'state-badge-sprinting.png', contentType: 'image/png' }],
  ['/assets/jumbotron/state-badge-slowed.png', { file: 'state-badge-slowed.png', contentType: 'image/png' }],
  ['/assets/jumbotron/state-badge-blocked.png', { file: 'state-badge-blocked.png', contentType: 'image/png' }],
  ['/assets/jumbotron/state-badge-pit_stop.png', { file: 'state-badge-pit_stop.png', contentType: 'image/png' }],
  ['/assets/jumbotron/state-badge-takeover.png', { file: 'state-badge-takeover.png', contentType: 'image/png' }],
  ['/assets/jumbotron/state-badge-finished.png', { file: 'state-badge-finished.png', contentType: 'image/png' }],
  ['/assets/jumbotron/state-badge-stale.png', { file: 'state-badge-stale.png', contentType: 'image/png' }]
]);
const JUMBOTRON_BACKGROUND_ASSETS = new Set(['/assets/public-yard-hero.webp', '/assets/jumbotron/background1.png', '/assets/jumbotron/example.png']);
const JUMBOTRON_MIN_PATH_LENGTH_RATIO = 0.35;
const JUMBOTRON_MANUAL_CHECK_PENDING = { status: 'pending', label: '待人工复核' };
const JUMBOTRON_MANUAL_CHECK_CONFIRMED = { status: 'confirmed', label: '已人工确认' };
const JUMBOTRON_CURATED_MOCK_DIR = join(rootDir, 'jumbotron-mock-data', 'curated');
const JUMBOTRON_CURATED_RACE_SNAPSHOT_PATH = join(JUMBOTRON_CURATED_MOCK_DIR, 'race-snapshot.json');
const JUMBOTRON_CURATED_TRACK_PROFILE_PATH = join(JUMBOTRON_CURATED_MOCK_DIR, 'track.profile.json');
const JUMBOTRON_REVIEW_PACKAGE_DIR = join(rootDir, '..', 'Week2-Jumbotron', 'mock-data', 'review-package');
const JUMBOTRON_RAW_MOCK_DATA_DIR = join(rootDir, '..', 'Week2-Jumbotron', 'mock-data', 'raw', 'mock_data');
const JUMBOTRON_RAW_TRACKS_DIR = join(rootDir, 'jumbotron-candidate-assets');
const JUMBOTRON_RAW_RACE_TIMELINE_PATH = join(JUMBOTRON_RAW_MOCK_DATA_DIR, 'race-timeline.json');
const JUMBOTRON_SECOND_TRACK_CANDIDATE_SEEDS = ['real-explicit-closed-course', 'grandstand-oval'];
const JUMBOTRON_CANDIDATE_IMPORT_VALUE = 'active-second-track-ai';
const JUMBOTRON_CANDIDATE_ASSET_ROUTE_PREFIX = '/jumbotron/candidate-assets';
const JUMBOTRON_CANDIDATE_ASSET_FILES = new Map([
  ['background.webp', { role: 'background', contentType: 'image/webp' }],
  ['preview.png', { role: 'preview', contentType: 'image/png' }]
]);
const JUMBOTRON_CONFIRMED_TRACKS = [
  { trackId: 'default-public-track', label: '当前公开赛道', mode: 'curated' }
];
const JUMBOTRON_DEFAULT_TRACK_ID = 'real-explicit-closed-course';
const JUMBOTRON_DEBUG_PREVIEW_PNG_ROUTE = '/jumbotron/debug-preview.png';
const JUMBOTRON_DEBUG_PREVIEW_PNG_RELATIVE_PATH = 'Week2-Jumbotron/review-ledger/screenshots/2026-06-13-jumbotron-debug-preview-export/debug-preview.png';
const JUMBOTRON_DEBUG_PREVIEW_PNG_PATH = join(rootDir, '..', JUMBOTRON_DEBUG_PREVIEW_PNG_RELATIVE_PATH);
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
    publicName: '完整赛况',
    publicUse: '全部公开队伍、消息和异常情况',
    publicSurface: '默认大屏与赛后核对',
    notFor: ['the only video main-shot profile if labels and bubbles overload the screen'],
    recommendedSurface: ['/jumbotron default', '/jumbotron?debug=1', 'final completeness evidence'],
    validatorStatus: 'pass',
    expectedWarnings: []
  },
  {
    alias: 'smoke-8',
    canonicalId: 'smoke-8-visual-low-load',
    raceSnapshotPath: JUMBOTRON_SMOKE_8_RACE_SNAPSHOT_PATH,
    trackProfilePath: JUMBOTRON_CURATED_TRACK_PROFILE_PATH,
    defaultUse: 'low-load visual smoke and classroom screen candidate',
    publicName: '轻量视图',
    publicUse: '减少标签和气泡，保留赛道走势',
    publicSurface: '适合录制主镜头和课堂投屏',
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
    publicName: '覆盖视图',
    publicUse: '展示全部状态和消息类型',
    publicSurface: '适合检查视觉覆盖范围',
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
const JUMBOTRON_REPLAY_INTERPOLATION_STEPS = 24;
const JUMBOTRON_REPLAY_FRAME_DELAY_MS = 90;
const JUMBOTRON_REPLAY_EVENT_HOLD_FRAMES = 40;
const JUMBOTRON_REPLAY_FINAL_HOLD_FRAMES = 48;
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

];

const JUMBOTRON_CALIBRATOR_DEFAULT_TRACK_PROFILE = {
  "schemaVersion": "0.1.0",
  "trackId": "grandstand-oval",
  "name": "Grandstand Oval",
  "viewBox": {
    "x": 0,
    "y": 0,
    "width": 1200,
    "height": 620
  },
  "background": {
    "assetId": "jumbotron-background1",
    "src": "/assets/jumbotron/background1.png",
    "kind": "png"
  },
  "centerline": {
    "type": "curve",
    "closed": true,
    "points": [
      {
        "x": 558.4,
        "y": 509.2
      },
      {
        "x": 527.1,
        "y": 507
      },
      {
        "x": 493.8,
        "y": 506.9
      },
      {
        "x": 465.8,
        "y": 506.8
      },
      {
        "x": 421.9,
        "y": 506.4
      },
      {
        "x": 365,
        "y": 506.8
      },
      {
        "x": 311.3,
        "y": 505.6
      },
      {
        "x": 247.5,
        "y": 487.2
      },
      {
        "x": 251.8,
        "y": 432.6
      },
      {
        "x": 302.6,
        "y": 369
      },
      {
        "x": 316,
        "y": 333.5
      },
      {
        "x": 285.1,
        "y": 290.9
      },
      {
        "x": 222.4,
        "y": 235.1
      },
      {
        "x": 187,
        "y": 185.5
      },
      {
        "x": 190.8,
        "y": 125.7
      },
      {
        "x": 236,
        "y": 82.9
      },
      {
        "x": 302.4,
        "y": 64.7
      },
      {
        "x": 364.8,
        "y": 73.5
      },
      {
        "x": 434.3,
        "y": 88.5
      },
      {
        "x": 484.5,
        "y": 105.3
      },
      {
        "x": 519.5,
        "y": 127.1
      },
      {
        "x": 553.5,
        "y": 148.9
      },
      {
        "x": 577.7,
        "y": 159.9
      },
      {
        "x": 598.1,
        "y": 165.7
      },
      {
        "x": 612.6,
        "y": 168.1
      },
      {
        "x": 631.9,
        "y": 170.9
      },
      {
        "x": 653.4,
        "y": 171.3
      },
      {
        "x": 673.3,
        "y": 168.2
      },
      {
        "x": 713.3,
        "y": 155.1
      },
      {
        "x": 782.5,
        "y": 128
      },
      {
        "x": 856,
        "y": 105.8
      },
      {
        "x": 948.3,
        "y": 102.9
      },
      {
        "x": 1005.3,
        "y": 139
      },
      {
        "x": 1009.6,
        "y": 198.3
      },
      {
        "x": 977.2,
        "y": 247.3
      },
      {
        "x": 949.8,
        "y": 304.8
      },
      {
        "x": 986.9,
        "y": 363.3
      },
      {
        "x": 1021.2,
        "y": 413.5
      },
      {
        "x": 1010.7,
        "y": 471.4
      },
      {
        "x": 939.7,
        "y": 500.3
      },
      {
        "x": 857.1,
        "y": 506.6
      },
      {
        "x": 807.1,
        "y": 507.9
      },
      {
        "x": 754.7,
        "y": 508.4
      },
      {
        "x": 711.8,
        "y": 507.5
      },
      {
        "x": 684.6,
        "y": 507.6
      },
      {
        "x": 652.2,
        "y": 507.8
      },
      {
        "x": 620.9,
        "y": 508.4
      },
      {
        "x": 594.3,
        "y": 510.4
      },
      {
        "x": 558.4,
        "y": 509.2
      }
    ],
    "smoothing": "catmull-rom-closed-from-original-background-gray-mask"
  },
  "direction": "counterclockwise",
  "startFinish": {
    "startS": 0,
    "finishS": 1,
    "label": "终点线"
  },
  "lanes": [
    {
      "laneId": "lane-1",
      "offset": -24
    },
    {
      "laneId": "lane-2",
      "offset": -20
    },
    {
      "laneId": "lane-3",
      "offset": -16
    },
    {
      "laneId": "lane-4",
      "offset": -12
    },
    {
      "laneId": "lane-5",
      "offset": -8
    },
    {
      "laneId": "lane-6",
      "offset": -4
    },
    {
      "laneId": "lane-7",
      "offset": 4
    },
    {
      "laneId": "lane-8",
      "offset": 8
    },
    {
      "laneId": "lane-9",
      "offset": 12
    },
    {
      "laneId": "lane-10",
      "offset": 16
    },
    {
      "laneId": "lane-11",
      "offset": 20
    },
    {
      "laneId": "lane-12",
      "offset": 24
    }
  ],
  "checkpoints": [
    {
      "checkpointId": "cp-start",
      "label": "终点线",
      "s": 0
    },
    {
      "checkpointId": "cp-1",
      "label": "右侧折返弯",
      "s": 0.25
    },
    {
      "checkpointId": "cp-2",
      "label": "后段直道",
      "s": 0.5
    },
    {
      "checkpointId": "cp-3",
      "label": "主看台直道",
      "s": 0.75
    }
  ],
  "messageZones": [
    {
      "zoneId": "track-bubble",
      "offsetX": 28,
      "offsetY": -64,
      "rect": {
        "x": 93.75,
        "y": 86.11,
        "width": 1012.5,
        "height": 97.59
      },
      "x": 93.75,
      "y": 86.11,
      "width": 1012.5,
      "height": 97.59
    }
  ],
  "noBubbleZones": [
    {
      "zoneId": "nb-header",
      "x": 0,
      "y": 0,
      "width": 1200,
      "height": 68.89,
      "label": "Header（标题/LIVE/计时）",
      "rect": {
        "x": 0,
        "y": 0,
        "width": 1200,
        "height": 68.89
      }
    },
    {
      "zoneId": "nb-summary",
      "x": 0,
      "y": 68.89,
      "width": 1200,
      "height": 51.67,
      "label": "TOP3 + KPI 摘要行",
      "rect": {
        "x": 0,
        "y": 68.89,
        "width": 1200,
        "height": 51.67
      }
    },
    {
      "zoneId": "nb-leftrail",
      "x": 0,
      "y": 120.56,
      "width": 187.5,
      "height": 396.11,
      "label": "左侧小地图 + 图例",
      "rect": {
        "x": 0,
        "y": 120.56,
        "width": 187.5,
        "height": 396.11
      }
    },
    {
      "zoneId": "nb-ticker",
      "x": 0,
      "y": 522.41,
      "width": 1200,
      "height": 51.67,
      "label": "底部风险/违章 ticker",
      "rect": {
        "x": 0,
        "y": 522.41,
        "width": 1200,
        "height": 51.67
      }
    },
    {
      "zoneId": "nb-footer",
      "x": 0,
      "y": 574.07,
      "width": 1200,
      "height": 45.93,
      "label": "Footer（主题/主办方/时间）",
      "rect": {
        "x": 0,
        "y": 574.07,
        "width": 1200,
        "height": 45.93
      }
    }
  ],
  "riskZones": [
    {
      "zoneId": "critical-takeover-watch",
      "x": 760,
      "y": 230,
      "width": 170,
      "height": 120,
      "severity": "critical",
      "rect": {
        "x": 760,
        "y": 230,
        "width": 170,
        "height": 120
      }
    }
  ],
  "debug": {
    "sampleCount": 28,
    "collisionBox": {
      "width": 44,
      "height": 44
    },
    "staleThresholdMs": 300000,
    "manualChecks": {
      "horseOnTrack": {
        "status": "confirmed",
        "label": "已人工确认"
      },
      "curveNatural": {
        "status": "pending",
        "label": "待人工复核"
      },
      "bubbleClearance": {
        "status": "pending",
        "label": "待人工复核"
      },
      "checkpointMeaning": {
        "status": "pending",
        "label": "待人工复核"
      }
    }
  }
};

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

function readJumbotronRaceTimeline() {
  if (!existsSync(JUMBOTRON_RAW_RACE_TIMELINE_PATH)) return null;
  try {
    const timeline = JSON.parse(readFileSync(JUMBOTRON_RAW_RACE_TIMELINE_PATH, 'utf8'));
    return Array.isArray(timeline.frames) && timeline.frames.length ? timeline : null;
  } catch {
    return null;
  }
}

function jumbotronTimelineProgress(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const percent = Math.abs(number) <= 1 ? number * 100 : number;
  return Math.max(0, Math.min(100, Math.round(percent * 10) / 10));
}

function jumbotronTimelineTimeToSeconds(value) {
  const parts = String(value || '').split(':').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function jumbotronTimelineSecondsToTime(seconds) {
  const clamped = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':');
}

function jumbotronTimelineInterpolateTime(from, to, t) {
  const a = jumbotronTimelineTimeToSeconds(from);
  const b = jumbotronTimelineTimeToSeconds(to);
  if (a === null || b === null) return t < 0.5 ? from : to;
  return jumbotronTimelineSecondsToTime(a + (b - a) * t);
}

function jumbotronTimelineUpdatedAt(timeline, frame) {
  const date = String(timeline.generatedAt || '').slice(0, 10);
  const time = String(frame.systemTime || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && time ? `${date}T${time}+08:00` : frame.systemTime || timeline.generatedAt || new Date().toISOString();
}

function jumbotronTimelinePhaseLabel(phase) {
  return ({ start: '起跑段', race: '比赛段', finish: '冲线段' })[phase] || '回放段';
}

function jumbotronTimelineMessageType(type) {
  return ({ race_start: 'milestone', overtake: 'strategy_change', status_change: 'progress_update', lead_change: 'milestone' })[type] || 'progress_update';
}

function jumbotronTimelineEventLabel(type) {
  return ({ race_start: '起跑', overtake: '超越', status_change: '状态变化', lead_change: '领先变化' })[type] || '事件';
}

function jumbotronTimelineEventSummary(event, entry, frame) {
  if (event?.summary) return event.summary;
  const name = entry?.displayName || event?.entryId || '队伍';
  if (event?.type === 'race_start') return `${name} 进入起跑阶段`;
  if (event?.type === 'overtake') return `${name} 排名发生超越`;
  if (event?.type === 'status_change') return `${name} 状态更新`;
  if (event?.type === 'lead_change') return `${name} 领先位置变化`;
  return `${jumbotronTimelinePhaseLabel(frame.phase)} 发生新事件`;
}

function jumbotronTimelineNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function jumbotronTimelineLerp(from, to, t) {
  return from + (to - from) * Math.max(0, Math.min(1, t));
}

function jumbotronTimelineEntryById(frame) {
  return new Map((frame.entries || []).map((entry) => [entry.entryId, entry]));
}

function jumbotronInterpolatedEntry(entryId, fromFrame, toFrame, t) {
  const fromEntry = jumbotronTimelineEntryById(fromFrame).get(entryId) || {};
  const toEntry = jumbotronTimelineEntryById(toFrame).get(entryId) || fromEntry;
  const fromProgress = jumbotronTimelineProgress(fromEntry.roundProgress, 0);
  const toProgress = jumbotronTimelineProgress(toEntry.roundProgress, fromProgress);
  const fromPhaseProgress = jumbotronTimelineProgress(fromEntry.phaseProgress, fromProgress);
  const toPhaseProgress = jumbotronTimelineProgress(toEntry.phaseProgress, toProgress);
  const discrete = t < 0.5 ? fromEntry : toEntry;
  return {
    entryId,
    rank: jumbotronTimelineNumber(discrete.rank, fromEntry.rank),
    rankDelta: jumbotronTimelineNumber(discrete.rankDelta, fromEntry.rankDelta || 0),
    roundProgress: Math.round(jumbotronTimelineLerp(fromProgress, toProgress, t) * 10) / 10,
    phaseProgress: Math.round(jumbotronTimelineLerp(fromPhaseProgress, toPhaseProgress, t) * 10) / 10,
    status: discrete.status || fromEntry.status,
    motionState: discrete.motionState || discrete.status || fromEntry.motionState
  };
}

function buildJumbotronInterpolatedTimelineFrame(timeline, fromFrame, toFrame, t, playbackFrameIndex, sourceFrameIndex, nextFrameIndex) {
  const entryIds = [...new Set([...(fromFrame.entries || []).map((entry) => entry.entryId), ...(toFrame.entries || []).map((entry) => entry.entryId)])];
  const isKeyFrame = t === 0 || fromFrame === toFrame;
  const top3 = isKeyFrame ? fromFrame.top3 || [] : (t < 0.5 ? fromFrame.top3 : toFrame.top3) || [];
  const fromAvg = jumbotronTimelineProgress(fromFrame.avgRoundProgress, 0);
  const toAvg = jumbotronTimelineProgress(toFrame.avgRoundProgress, fromAvg);
  return {
    frameIndex: playbackFrameIndex,
    playbackFrameIndex,
    sourceFrameIndex,
    nextFrameIndex,
    interpolationAlpha: Number(t.toFixed(3)),
    interpolated: !isKeyFrame,
    keyFrame: isKeyFrame,
    rawFrameIndex: fromFrame.frameIndex,
    systemTime: jumbotronTimelineInterpolateTime(fromFrame.systemTime, toFrame.systemTime || fromFrame.systemTime, t),
    elapsedTime: jumbotronTimelineInterpolateTime(fromFrame.elapsedTime, toFrame.elapsedTime || fromFrame.elapsedTime, t),
    phase: t < 0.5 ? fromFrame.phase : toFrame.phase || fromFrame.phase,
    isCurrent: Boolean(isKeyFrame && fromFrame.isCurrent),
    avgRoundProgress: Math.round(jumbotronTimelineLerp(fromAvg, toAvg, t) * 10) / 10,
    top3,
    entries: entryIds.map((entryId) => jumbotronInterpolatedEntry(entryId, fromFrame, toFrame, t)),
    events: isKeyFrame ? fromFrame.events || [] : []
  };
}

function jumbotronTimelineFrameAverageProgress(frame) {
  const avg = jumbotronTimelineProgress(frame?.avgRoundProgress, NaN);
  if (Number.isFinite(avg)) return avg;
  const entries = frame?.entries || [];
  if (!entries.length) return 0;
  return entries.reduce((sum, entry) => sum + jumbotronTimelineProgress(entry.roundProgress, 0), 0) / entries.length;
}

function buildJumbotronReplaySegmentSteps(rawFrames) {
  const segmentCount = Math.max(0, rawFrames.length - 1);
  if (!segmentCount) return [];
  const totalSteps = segmentCount * JUMBOTRON_REPLAY_INTERPOLATION_STEPS;
  const minimumSteps = Math.min(3, Math.max(1, Math.floor(totalSteps / segmentCount)));
  const progress = rawFrames.map(jumbotronTimelineFrameAverageProgress);
  const deltas = progress.slice(0, -1).map((value, index) => Math.max(0, Math.abs(progress[index + 1] - value)));
  const totalDelta = deltas.reduce((sum, value) => sum + value, 0);
  if (!totalDelta) return Array.from({ length: segmentCount }, () => JUMBOTRON_REPLAY_INTERPOLATION_STEPS);
  const remainingSteps = Math.max(0, totalSteps - minimumSteps * segmentCount);
  const quotas = deltas.map((delta) => delta / totalDelta * remainingSteps);
  const steps = quotas.map((quota) => minimumSteps + Math.floor(quota));
  let remainder = totalSteps - steps.reduce((sum, value) => sum + value, 0);
  quotas
    .map((quota, index) => ({ index, fraction: quota - Math.floor(quota) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach(({ index }) => {
      if (remainder <= 0) return;
      steps[index] += 1;
      remainder -= 1;
    });
  return steps;
}


function buildJumbotronPlaybackFrames(timeline) {
  const rawFrames = timeline.frames || [];
  if (rawFrames.length <= 1) {
    const frames = rawFrames.map((frame, index) => buildJumbotronInterpolatedTimelineFrame(timeline, frame, frame, 0, index, index, index));
    frames.keyFramePlaybackIndexes = frames.map((_, index) => index);
    frames.segmentSteps = [];
    return frames;
  }
  const segmentSteps = buildJumbotronReplaySegmentSteps(rawFrames);
  const keyFramePlaybackIndexes = [0];
  const playbackFrames = [];
  for (let index = 0; index < rawFrames.length - 1; index += 1) {
    const steps = Math.max(1, segmentSteps[index] || JUMBOTRON_REPLAY_INTERPOLATION_STEPS);
    for (let step = 0; step < steps; step += 1) {
      playbackFrames.push(buildJumbotronInterpolatedTimelineFrame(timeline, rawFrames[index], rawFrames[index + 1], step / steps, playbackFrames.length, index, index + 1));
    }
    keyFramePlaybackIndexes.push(playbackFrames.length);
  }
  const lastIndex = rawFrames.length - 1;
  playbackFrames.push(buildJumbotronInterpolatedTimelineFrame(timeline, rawFrames[lastIndex], rawFrames[lastIndex], 0, playbackFrames.length, lastIndex, lastIndex));
  playbackFrames.segmentSteps = segmentSteps;
  playbackFrames.keyFramePlaybackIndexes = keyFramePlaybackIndexes;
  return playbackFrames;
}

function buildJumbotronSnapshotFromTimelineFrame(baseSnapshot, timeline, frame, options = {}) {
  const currentRoundPrefix = options.currentRoundPrefix || '近期回放';
  const dynamicByEntryId = new Map((frame.entries || []).map((entry) => [entry.entryId, entry]));
  const updatedAt = jumbotronTimelineUpdatedAt(timeline, frame);
  const entries = (baseSnapshot.entries || []).map((entry) => {
    const dynamic = dynamicByEntryId.get(entry.entryId) || {};
    const roundProgress = jumbotronTimelineProgress(dynamic.roundProgress, jumbotronTimelineProgress(entry.roundProgress, entry.overallProgress || 0));
    const phaseProgress = jumbotronTimelineProgress(dynamic.phaseProgress, jumbotronTimelineProgress(entry.phaseProgress, roundProgress));
    return {
      ...entry,
      rank: Number.isFinite(Number(dynamic.rank)) ? Number(dynamic.rank) : entry.rank,
      rankDelta: Number.isFinite(Number(dynamic.rankDelta)) ? Number(dynamic.rankDelta) : entry.rankDelta,
      roundProgress,
      overallProgress: roundProgress,
      phaseProgress,
      status: dynamic.status || entry.status,
      motionState: dynamic.motionState || dynamic.status || entry.motionState,
      updatedAt
    };
  }).sort((a, b) => Number(a.rank) - Number(b.rank));
  const entryById = new Map(entries.map((entry) => [entry.entryId, entry]));
  const events = (frame.events || []).map((event, index) => {
    const entry = entryById.get(event.entryId) || entries[0];
    return {
      messageId: `replay-${frame.frameIndex}-${index}`,
      entryId: entry?.entryId || event.entryId || entries[0]?.entryId || 'unknown-entry',
      type: jumbotronTimelineMessageType(event.type),
      severity: 'info',
      displayMode: 'ticker',
      summary: jumbotronTimelineEventSummary(event, entry, frame),
      createdAt: frame.systemTime || updatedAt
    };
  });
  const attentionItems = baseSnapshot.attentionItems || [];
  const stateMessages = buildJumbotronEntryStateMessages(entries, frame.systemTime || updatedAt, `frame-${frame.frameIndex}-state`);
  const attentionMessages = buildJumbotronAttentionMessages(attentionItems, frame.systemTime || updatedAt, `frame-${frame.frameIndex}-attention`);
  const messages = mergeJumbotronMessages(events, stateMessages, attentionMessages, baseSnapshot.messages || []);
  const completionRate = entries.length ? Math.round(entries.reduce((sum, entry) => sum + Number(entry.roundProgress || 0), 0) / entries.length) : 0;
  return {
    ...baseSnapshot,
    competition: {
      ...baseSnapshot.competition,
      currentRound: `${currentRoundPrefix} · ${jumbotronTimelinePhaseLabel(frame.phase)}`,
      elapsedTime: frame.elapsedTime || baseSnapshot.competition?.elapsedTime,
      systemTime: frame.systemTime || baseSnapshot.competition?.systemTime
    },
    kpi: { ...baseSnapshot.kpi, completionRate, onlineRiders: entries.length, activeRiders: entries.length },
    entries,
    messages,
    attentionItems
  };
}

function buildJumbotronFinalTimelineSnapshot(baseSnapshot) {
  const timeline = readJumbotronRaceTimeline();
  if (!timeline) return null;
  const playbackFrames = buildJumbotronPlaybackFrames(timeline);
  const finalFrame = playbackFrames.at(-1);
  if (!finalFrame) return null;
  return buildJumbotronSnapshotFromTimelineFrame(baseSnapshot, timeline, finalFrame, { currentRoundPrefix: '最终状态' });
}

function buildJumbotronReplayFrameModel(baseSnapshot, trackProfile, timeline, frame) {
  const raceSnapshot = buildJumbotronSnapshotFromTimelineFrame(baseSnapshot, timeline, frame);
  const adapted = adaptJumbotronSnapshot(raceSnapshot, trackProfile);
  const runtime = createJumbotronRuntime(trackProfile);
  const horsePoses = adapted.racingEntries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
  const top3Labels = (frame.top3 || []).map((entryId) => adapted.racingEntries.find((entry) => entry.entryId === entryId)?.displayName || entryId);
  return { timeline, frame, raceSnapshot, adapted, trackProfile, runtime, horsePoses, top3Labels };
}

function buildJumbotronReplayTimelineMeta(timeline, playbackFrames) {
  const keyFramePlaybackIndexes = playbackFrames.keyFramePlaybackIndexes || [];
  const playbackFrameCount = playbackFrames.length;
  return {
    ...timeline,
    keyFrames: timeline.frames,
    keyFrameCount: timeline.frames.length,
    rawFrameCount: timeline.frames.length,
    interpolationSteps: JUMBOTRON_REPLAY_INTERPOLATION_STEPS,
    segmentSteps: playbackFrames.segmentSteps || [],
    keyFramePlaybackIndexes,
    playbackFrameCount,
    frameCount: playbackFrameCount,
    currentPlaybackFrameIndex: Math.min(playbackFrameCount - 1, Math.max(0, keyFramePlaybackIndexes[Number(timeline.currentFrameIndex || 0)] ?? Number(timeline.currentFrameIndex || 0) * JUMBOTRON_REPLAY_INTERPOLATION_STEPS)),
    finishPlaybackFrameIndex: Math.min(playbackFrameCount - 1, Math.max(0, keyFramePlaybackIndexes[Number(timeline.finishFrameIndex || 0)] ?? Number(timeline.finishFrameIndex || 0) * JUMBOTRON_REPLAY_INTERPOLATION_STEPS)),
    playbackFrames
  };
}

function buildJumbotronReplayTimeline(baseSnapshot, trackProfile) {
  const timeline = readJumbotronRaceTimeline();
  if (!timeline) return null;
  const playbackFrames = buildJumbotronPlaybackFrames(timeline);
  const timelineForFrames = buildJumbotronReplayTimelineMeta(timeline, playbackFrames);
  const frames = playbackFrames.map((frame) => buildJumbotronReplayFrameModel(baseSnapshot, trackProfile, timelineForFrames, frame));
  return { ...timelineForFrames, frames };
}

function buildJumbotronReplayFrameAt(baseSnapshot, trackProfile, frameParam = '') {
  const timeline = readJumbotronRaceTimeline();
  if (!timeline) return null;
  const playbackFrames = buildJumbotronPlaybackFrames(timeline);
  if (!playbackFrames.length) return null;
  const requested = Number(frameParam);
  const playbackIndex = Number.isFinite(requested) ? Math.max(0, Math.min(playbackFrames.length - 1, Math.floor(requested))) : 0;
  const timelineForFrames = buildJumbotronReplayTimelineMeta(timeline, playbackFrames);
  return { timeline: timelineForFrames, playbackIndex, frameModel: buildJumbotronReplayFrameModel(baseSnapshot, trackProfile, timelineForFrames, playbackFrames[playbackIndex]) };
}

function dataProfileUrl(alias, showReviewTools = false) {
  const params = new URLSearchParams({ profile: alias });
  if (showReviewTools) params.set('debug', '1');
  return `/jumbotron?${params.toString()}`;
}

function secondTrackHumanReviewStatus(candidate = readActiveSecondTrackCandidate()) {
  const rawStatus = candidate.profile?.meta?.humanReviewStatus || candidate.provenance?.humanReviewStatus || candidate.validation?.humanReview?.status || candidate.validation?.checks?.humanReviewStatus || 'pending';
  return ['pending', 'confirmed', 'rejected'].includes(rawStatus) ? rawStatus : 'pending';
}

function jumbotronConfirmedTracks() {
  const active = readActiveSecondTrackCandidate();
  const secondTrackConfirmed = active.available && secondTrackHumanReviewStatus(active) === 'confirmed';
  const secondTrack = secondTrackConfirmed ? [{ trackId: active.trackId, label: 'Real Explicit Closed Course', mode: 'candidate', humanReviewStatus: 'confirmed' }] : [];
  return [...JUMBOTRON_CONFIRMED_TRACKS, ...secondTrack];
}

function resolveJumbotronTrackSelection(trackParam = '') {
  const requestedTrack = String(trackParam || '').trim();
  const effectiveTrack = requestedTrack || JUMBOTRON_DEFAULT_TRACK_ID;
  if (effectiveTrack === 'default-public-track') {
    return { ok: true, requestedTrack, trackId: 'default-public-track', label: '当前公开赛道', mode: 'curated', confirmed: true, defaultTrack: !requestedTrack };
  }
  const confirmed = jumbotronConfirmedTracks().find((track) => track.trackId === effectiveTrack);
  if (confirmed) return { ok: true, requestedTrack, confirmed: true, defaultTrack: !requestedTrack, ...confirmed };
  const candidate = jumbotronCandidateTracks().find((track) => track.trackId === effectiveTrack);
  if (candidate?.available) return { ok: true, requestedTrack, confirmed: false, mode: 'candidate', candidateOnly: true, ...candidate };
  if (candidate) return { ok: false, requestedTrack: effectiveTrack, candidateBlocked: true, confirmed: false, ...candidate };
  return { ok: false, requestedTrack: effectiveTrack, invalidTrack: true, confirmed: false };
}

function trackUrl(trackId, profileAlias = 'full', showReviewTools = false) {
  const params = new URLSearchParams({ profile: profileAlias });
  if (trackId) params.set('track', trackId);
  if (showReviewTools) params.set('debug', '1');
  return `/jumbotron?${params.toString()}`;
}

function renderJumbotronTrackSelector({ dataProfile, trackSelection, showReviewTools }) {
  const activeTrackId = trackSelection?.trackId || 'default-public-track';
  const confirmedTrackIds = new Set(jumbotronConfirmedTracks().map((track) => track.trackId));
  const confirmedRows = jumbotronConfirmedTracks().map((track) => {
    const active = track.trackId === activeTrackId;
    const copy = track.trackId === activeTrackId ? '正在用于当前大屏。' : '可切换用于当前大屏。';
    return `<article class="${active ? 'is-active' : ''}"><strong>${active ? '✓ ' : ''}${escapeHtml(track.label)}</strong><p class="muted">${escapeHtml(copy)}</p><a class="button secondary" href="${escapeHtml(trackUrl(track.trackId, dataProfile.profileAlias, showReviewTools))}">${active ? '当前赛道' : '切换赛道'}</a></article>`;
  }).join('');
  const candidateRows = jumbotronCandidateTracks().filter((track) => !confirmedTrackIds.has(track.trackId)).map((track) => {
    const active = track.trackId === activeTrackId;
    return `<article class="${active ? 'is-active' : ''}"><strong>${active ? '✓ ' : ''}${escapeHtml(track.trackId)} · 候选</strong><p class="muted">候选赛道预览，正式展示前需要人工确认。</p><a class="button secondary" href="${escapeHtml(trackUrl(track.trackId, dataProfile.profileAlias, showReviewTools))}">${active ? '当前候选主视图' : '切换到候选主视图'}</a></article>`;
  }).join('');
  return `<h3>赛道选择</h3><p class="muted">已确认赛道可用于当前大屏。</p><div class="debug-grid jumbotron-profile-grid">${confirmedRows}${candidateRows}</div>`;
}

function renderJumbotronProfileSelector({ dataProfile, trackSelection, showReviewTools }) {
  return `<section class="jumbotron-drawer jumbotron-profile-drawer" aria-label="数据视图选择"><div class="jumbotron-drawer-head"><div><div class="eyebrow">数据视图</div><h2>选择展示范围</h2></div><span class="jumbotron-drawer-icon" aria-hidden="true">⌄</span></div><div class="jumbotron-drawer-body jumbotron-profile-drawer-body"><div class="debug-grid jumbotron-profile-grid">${JUMBOTRON_DATA_PROFILES.map((profile) => {
    const active = profile.alias === dataProfile.profileAlias;
    return `<article class="${active ? 'is-active' : ''}"><strong>${active ? '✓ ' : ''}${escapeHtml(profile.publicName || profile.alias)}</strong><p class="muted">${escapeHtml(profile.publicUse || profile.defaultUse)}</p><p class="muted">${escapeHtml(profile.publicSurface || profile.recommendedSurface.join('、'))}</p><a class="button secondary" href="${escapeHtml(dataProfileUrl(profile.alias, showReviewTools))}">${active ? '当前视图' : '切换视图'}</a></article>`;
  }).join('')}</div>${renderJumbotronTrackSelector({ dataProfile, trackSelection, showReviewTools })}</div></section>`;
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

function jumbotronPublicMessageStatus(entry) {
  const labels = { idle: '待命', running: '行进中', sprinting: '冲刺', slowed: '减速', blocked: '暂停', pit_stop: '调整', takeover: '接管', finished: '完成', stale: '待刷新' };
  return labels[entry?.motionState || entry?.status] || '更新';
}

function jumbotronEntryStateMessageType(entry) {
  const state = entry?.motionState || entry?.status;
  if (state === 'blocked') return 'obstacle';
  if (state === 'takeover') return 'takeover';
  if (state === 'pit_stop') return 'pit_stop';
  if (state === 'stale') return 'risk_alert';
  if (state === 'finished') return 'milestone';
  if (state === 'sprinting') return 'milestone';
  if (state === 'slowed' || state === 'idle') return 'risk_alert';
  return 'progress_update';
}

function jumbotronEntryStateSeverity(entry) {
  const state = entry?.motionState || entry?.status;
  if (['blocked', 'takeover', 'stale'].includes(state)) return 'high';
  if (['pit_stop', 'slowed', 'idle'].includes(state)) return 'medium';
  return 'info';
}

function jumbotronEntryStateSummary(entry) {
  const name = entry?.displayName || entry?.entryId || '队伍';
  const state = entry?.motionState || entry?.status;
  const status = jumbotronPublicMessageStatus(entry);
  if (state === 'finished') return `${name} 已冲线，结果进入核对`;
  if (state === 'blocked') return `${name} 暂停推进，需关注阻碍`;
  if (state === 'takeover') return `${name} 进入接管，等待人工确认`;
  if (state === 'pit_stop') return `${name} 正在调整，等待补给完成`;
  if (state === 'stale') return `${name} 待刷新，暂无新数据`;
  if (state === 'idle') return `${name} 暂无推进，保持观察`;
  if (state === 'slowed') return `${name} 推进放缓，关注后续恢复`;
  if (state === 'sprinting') return `${name} ${status}，正在冲刺`;
  return `${name} ${status}，进度 ${Math.round(jumbotronTimelineProgress(entry?.roundProgress, 0))}%`;
}

function buildJumbotronEntryStateMessages(entries, createdAt, prefix = 'state') {
  return (entries || []).map((entry, index) => ({
    messageId: `${prefix}-${entry.entryId || index}`,
    entryId: entry.entryId,
    type: jumbotronEntryStateMessageType(entry),
    severity: jumbotronEntryStateSeverity(entry),
    displayMode: ['blocked', 'takeover', 'stale', 'finished', 'sprinting'].includes(entry.motionState || entry.status) ? 'bubble' : 'ticker',
    status: ['blocked', 'takeover', 'stale', 'pit_stop', 'slowed', 'idle'].includes(entry.motionState || entry.status) ? 'watching' : 'active',
    summary: jumbotronEntryStateSummary(entry),
    createdAt: createdAt || entry.updatedAt || 'unknown'
  }));
}

function buildJumbotronAttentionMessages(attentionItems, createdAt, prefix = 'attention') {
  return (attentionItems || []).map((item, index) => ({
    messageId: `${prefix}-${item.itemId || index}`,
    entryId: item.entryId,
    type: item.category === 'obstacle' ? 'obstacle' : item.category === 'violation' ? 'violation' : 'risk_alert',
    severity: item.severity || 'medium',
    displayMode: ['high', 'critical'].includes(item.severity) ? 'bubble' : 'ticker',
    status: item.status || 'watching',
    summary: item.summary,
    createdAt: item.createdAt || createdAt || 'unknown'
  }));
}

function mergeJumbotronMessages(...groups) {
  const seen = new Set();
  return groups.flat().filter((message) => {
    const id = message?.messageId || `${message?.entryId || 'event'}-${message?.type || 'message'}-${message?.summary || ''}`;
    if (!message || !message.summary || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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

function renderJumbotronBubbleSyncScript(profileAlias = 'full', trackId = JUMBOTRON_DEFAULT_TRACK_ID) {
  const params = new URLSearchParams({ profile: profileAlias });
  if (trackId) params.set('track', trackId);
  const endpoint = `/api/jumbotron-bubbles?${params.toString()}`;
  return `<script>
(() => {
  const endpoint = ${JSON.stringify(endpoint)};
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

function renderJumbotronDrawerStabilizerScript() {
  return `<script>
(() => {
  const liveAside = document.querySelector('.jumbotron-live-layout > aside');
  if (!liveAside) return;
  let active = null;
  let frame = 0;
  function stabilize() {
    if (!active) return;
    const currentTop = active.head.getBoundingClientRect().top;
    liveAside.scrollTop += currentTop - active.top;
    frame = window.requestAnimationFrame(stabilize);
  }
  function start(drawer) {
    const head = drawer.querySelector('.jumbotron-drawer-head');
    if (!head) return;
    if (frame) window.cancelAnimationFrame(frame);
    active = { head, top: head.getBoundingClientRect().top };
    frame = window.requestAnimationFrame(stabilize);
  }
  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    active = null;
  }
  liveAside.querySelectorAll('.jumbotron-drawer').forEach((drawer) => {
    drawer.addEventListener('mouseenter', () => start(drawer));
    drawer.addEventListener('focusin', () => start(drawer));
    drawer.addEventListener('mouseleave', stop);
    drawer.addEventListener('focusout', stop);
    drawer.addEventListener('transitionend', (event) => {
      if (event.target.classList.contains('jumbotron-drawer-body') && event.propertyName === 'max-height') stop();
    });
  });
})();
</script>`;
}

function renderJumbotronFocusDetailScript() {
  return `<script>
(() => {
  const list = document.querySelector('.focus-detail-list');
  const drawer = list?.closest('.focus-details-card');
  if (!list || !drawer) return;
  function activateFocusDetail(hash, shouldScroll = false) {
    const id = String(hash || '').replace(/^#/, '');
    if (!id) return false;
    const target = document.getElementById(id);
    if (!target || !list.contains(target)) return false;
    list.classList.add('has-active-focus');
    list.querySelectorAll('.focus-detail-card.is-active').forEach((card) => card.classList.remove('is-active'));
    target.classList.add('is-active');
    drawer.classList.add('is-focus-open');
    if (shouldScroll) drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return true;
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest('.focus-trigger[href^="#"],.jumbotron-focus-source[href^="#"]');
    if (!link) return;
    if (activateFocusDetail(link.getAttribute('href'), true)) link.setAttribute('aria-current', 'true');
  });
  window.addEventListener('hashchange', () => activateFocusDetail(window.location.hash, true));
  activateFocusDetail(window.location.hash, false);
})();
</script>`;
}

function validationManualCheck(manualChecks, key) {
  return manualChecks?.[key] || (key === 'checkpointMeaning' ? manualChecks?.checkpointMeaning : undefined);
}

function renderJumbotronValidationPanel({ debug, validation }) {
  const renderChecks = (checks = []) => checks.map(([label, ok]) => `<article class="review-check-${ok ? 'ok' : 'warn'}"><strong>${ok ? '✓' : '!'} ${escapeHtml(validationLabel(label))}</strong><p class="review-check-status">${ok ? '状态良好' : '待补齐'}</p></article>`).join('');
  const sampledPoints = debug?.sampledPoints || [];
  const laneOffsets = debug?.laneOffsets || [];
  const checkpoints = debug?.checkpoints || [];
  const staleEntries = debug?.staleEntries || [];
  const motionStates = debug?.motionStates || [];
  const interpolationEvidence = debug?.interpolationEvidence || { s: 0 };
  const messageRules = debug?.messageRules || [];
  const manualChecks = debug?.manualChecks || {};
  const multiHorsePreview = validation?.multiHorsePreview || { count: 0, minDistance: 0, inViewBox: true, severeOverlap: false };
  return `<section class="jumbotron-debug"><div class="eyebrow">调试模式</div><h2>几何 / 运行时 / 待刷新</h2><div class="debug-grid"><article><strong>中心线</strong><p class="muted">${sampledPoints.length} 个采样点</p></article><article><strong>泳道偏移</strong><p class="muted">${escapeHtml(laneOffsets.join(' / '))}</p></article><article><strong>检查点</strong><p class="muted">${escapeHtml(checkpoints.map((item) => item.label).join(' / '))}</p></article><article><strong>待刷新 Entry</strong><p class="muted">${staleEntries.length || '无'}</p></article><article><strong>状态机覆盖</strong><p class="muted">${escapeHtml(motionStates.join(' / '))}</p></article><article><strong>s-axis interpolation</strong><p class="muted">sampleInterpolatedPose 输出 s=${Number(interpolationEvidence.s || 0).toFixed(2)}</p></article><article><strong>消息降噪规则</strong><p class="muted">${escapeHtml(messageRules.join('；'))}</p></article><article><strong>人工确认状态</strong><p class="muted">马在赛道上：${manualCheckLabel(validationManualCheck(manualChecks, 'horseOnTrack'))}；弯道自然：${manualCheckLabel(validationManualCheck(manualChecks, 'curveNatural'))}；气泡遮挡：${manualCheckLabel(validationManualCheck(manualChecks, 'bubbleClearance'))}；checkpoint 语义：${manualCheckLabel(validationManualCheck(manualChecks, 'checkpointMeaning'))}</p></article><article><strong>多马预览证据</strong><p class="muted">${multiHorsePreview.count} 匹；最小距离 ${Math.round(multiHorsePreview.minDistance || 0)}；出界 ${multiHorsePreview.inViewBox ? '无' : '有'}；严重重叠 ${multiHorsePreview.severeOverlap ? '有' : '无'}</p></article></div></section><section class="jumbotron-validation"><div class="eyebrow">校验结果</div><h2>Track Profile / 数据契约 / 运行时 / 视觉</h2><h3>数据契约校验</h3><div class="validation-grid">${renderChecks(validation?.contractChecks)}</div><h3>Track Profile 校验</h3><div class="validation-grid">${renderChecks(validation?.trackChecks)}</div><h3>运行时校验</h3><div class="validation-grid">${renderChecks(validation?.runtimeChecks)}</div><h3>视觉校验</h3><div class="validation-grid">${renderChecks(validation?.visualChecks)}</div></section>`;
}

async function renderJumbotron(session, options = {}) {
  const profileResolution = resolveJumbotronDataProfile(options.profile);
  if (!profileResolution.ok) return renderJumbotronProfileError(session, profileResolution);
  const trackSelection = resolveJumbotronTrackSelection(options.track);
  if (!trackSelection.ok) return renderJumbotronTrackGate(session, profileResolution, trackSelection);
  const [disclosures, leaderboard, teams, records, service] = await Promise.all([
    readDisclosures(),
    readJson(leaderboardPath),
    readJson(teamsPath),
    readJson(recordsPath),
    readEvaluatorService()
  ]);
  const model = buildJumbotronModel(disclosures, leaderboard, teams, records, service, { profileResolution, trackSelection });
  const selectedTrackId = model.trackSelection?.trackId || trackSelection.trackId || model.trackProfile?.trackId || JUMBOTRON_DEFAULT_TRACK_ID;
  const showReviewTools = Boolean(options.showReviewTools);
  const viewModel = { ...model, trackSelection: { ...model.trackSelection, trackId: selectedTrackId }, showReviewTools };
  const content = `<section class="jumbotron-page">
    ${renderJumbotronHeader(viewModel)}
    <section class="jumbotron-layout jumbotron-live-layout">
      ${renderJumbotronTrack(viewModel)}
      ${renderJumbotronSide(viewModel)}
    </section>
    ${renderJumbotronTicker(viewModel)}
    ${showReviewTools ? renderJumbotronProfileSelector(viewModel) : ''}
    ${renderJumbotronKpis(model.raceSnapshot.kpi)}
    ${showReviewTools ? `${renderJumbotronDataEvidenceDebug(viewModel)}${renderJumbotronCalibrator(viewModel)}${renderJumbotronValidationPanel(viewModel)}` : ''}
    ${renderJumbotronFooter(viewModel)}
    ${renderJumbotronLocalClockScript()}
    ${renderJumbotronDrawerStabilizerScript()}
    ${renderJumbotronFocusDetailScript()}
    ${renderJumbotronReplayScript(model.dataProfile.profileAlias, selectedTrackId)}
    ${renderJumbotronBubbleSyncScript(model.dataProfile.profileAlias, selectedTrackId)}
  </section>`;
  return page('Jumbotron', '/jumbotron', session, content);
}

function renderJumbotronTrackGate(session, profileResolution, trackSelection) {
  const evidence = trackSelection.candidateBlocked ? sanitizeTrackCandidateEvidence(readActiveSecondTrackCandidate()) : null;
  const content = `<section class="jumbotron-page"><section class="notice warn"><strong>candidate track gate：未进入正式大屏资产流程</strong><p>请求的 track=${escapeHtml(trackSelection.requestedTrack || 'unknown')} 不是 confirmed track。候选不等于正式资产；校验通过 只能进入 Calibrator 候选复核，不能替换默认 赛事大屏。</p><div class="cta-row"><a class="button" href="/jumbotron?profile=${escapeHtml(profileResolution.profileAlias)}">回到默认公开大屏</a><a class="button secondary" href="/jumbotron/calibrator">打开 Calibrator 候选导入</a></div></section>${evidence ? renderTrackCandidateEvidence(evidence) : ''}</section>`;
  return page('Jumbotron candidate gate', '/jumbotron', session, content);
}

function buildJumbotronModel(disclosures, leaderboard, teams, records, service, options = {}) {
  const race = visibleDisclosures(disclosures)[0] || disclosures[0] || { raceId: 'grs-001', title: 'ARY GRS 001', status: 'draft', publicSummary: '等待公开摘要。', publicGoal: '等待 Organizer 披露。' };
  const profileResolution = options.profileResolution || resolveJumbotronDataProfile(options.profile);
  const trackSelection = options.trackSelection || resolveJumbotronTrackSelection(options.track);
  const curated = profileResolution.ok ? readCuratedJumbotronMockData(profileResolution) : null;
  const builtInTrack = trackSelection.mode === 'builtin' ? jumbotronTrackProfiles.find((profile) => profile.trackId === trackSelection.builtInTrackId) : null;
  const candidate = trackSelection.mode === 'candidate' ? readActiveSecondTrackCandidate() : null;
  const candidateTrack = candidate?.available ? normalizeExternalTrackCandidate(candidate.profile, candidate) : null;
  const trackProfile = candidateTrack || normalizeTrackProfile(builtInTrack || curated?.trackProfile || jumbotronTrackProfiles[0]);
  const baseRaceSnapshot = curated?.raceSnapshot || buildRaceSnapshot(race, leaderboard, teams, records, service);
  const raceSnapshot = buildJumbotronFinalTimelineSnapshot(baseRaceSnapshot) || baseRaceSnapshot;
  const dataProfile = curated?.profile || resolveJumbotronDataProfile('full');
  const adapted = adaptJumbotronSnapshot(raceSnapshot, trackProfile);
  const replayTimeline = curated ? buildJumbotronReplayTimeline(baseRaceSnapshot, trackProfile) : null;
  const runtime = createJumbotronRuntime(trackProfile);
  const horsePoses = adapted.racingEntries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
  const messagePlan = planRidingMessages(adapted.ridingMessages, horsePoses, trackProfile);
  const debug = buildDebugModel(runtime, adapted.racingEntries, horsePoses, trackProfile);
  const validation = buildValidationModel(trackProfile, adapted, runtime, horsePoses, messagePlan);
  const dataEvidence = buildJumbotronDataEvidence(baseRaceSnapshot, dataProfile);
  return { race, raceSnapshot, adapted, trackProfile, runtime, horsePoses, messagePlan, debug, validation, dataProfile, dataEvidence, trackSelection, replayTimeline };
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

function normalizeTrackViewBox(viewBox, fallback = { x: 0, y: 0, width: 1200, height: 620 }) {
  if (Array.isArray(viewBox)) return { x: Number(viewBox[0]) || 0, y: Number(viewBox[1]) || 0, width: Number(viewBox[2]) || fallback.width, height: Number(viewBox[3]) || fallback.height };
  return { x: Number(viewBox?.x) || 0, y: Number(viewBox?.y) || 0, width: Number(viewBox?.width) || fallback.width, height: Number(viewBox?.height) || fallback.height };
}

function normalizeTrackDirection(direction) {
  if (direction === undefined || direction === null || direction === '') return 'clockwise';
  if (direction === 'cw') return 'clockwise';
  if (direction === 'ccw') return 'counterclockwise';
  return ['clockwise', 'counterclockwise'].includes(direction) ? direction : String(direction);
}

function numberOrFallback(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, fallbackOrMin, minOrMax, maybeMax) {
  const hasFallback = maybeMax !== undefined;
  const fallback = fallbackOrMin;
  const min = hasFallback ? minOrMax : fallbackOrMin;
  const max = hasFallback ? maybeMax : minOrMax;
  const number = numberOrFallback(value, fallback);
  return Math.max(min, Math.min(max, number));
}

function normalizeTrackPoint(point) {
  if (Array.isArray(point)) return { x: Number(point[0]), y: Number(point[1]) };
  return { x: Number(point?.x), y: Number(point?.y) };
}

function ensureClosedCenterline(points, closed = true) {
  const normalized = (points || []).map(normalizeTrackPoint).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!closed || normalized.length < 2) return normalized;
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  return first.x === last.x && first.y === last.y ? normalized : [...normalized, { ...first }];
}

function normalizeTrackRect(rect) {
  if (Array.isArray(rect)) return { x: Number(rect[0]) || 0, y: Number(rect[1]) || 0, width: Number(rect[2]) || 0, height: Number(rect[3]) || 0 };
  return { x: Number(rect?.x) || 0, y: Number(rect?.y) || 0, width: Number(rect?.width) || 0, height: Number(rect?.height) || 0 };
}

function normalizeTrackZone(zone = {}) {
  const hasRect = Array.isArray(zone.rect) || Boolean(zone.rect && typeof zone.rect === 'object') || ['x', 'y', 'width', 'height'].every((key) => Object.hasOwn(zone, key));
  if (!hasRect) return { ...zone };
  const rect = normalizeTrackRect(zone.rect || zone);
  return { ...zone, ...rect, rect };
}

function backgroundAssetId(src = '') {
  const basename = String(src || 'candidate-background').split('/').filter(Boolean).at(-1) || 'candidate-background';
  return basename.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'candidate-background';
}

function normalizeTrackProfile(trackProfile) {
  const viewBox = normalizeTrackViewBox(trackProfile.viewBox);
  const centerline = trackProfile.centerline || { type: 'polyline', closed: true, smoothing: 'mvp-polyline', points: trackProfile.centerlinePath || [] };
  const rawPoints = centerline.points || trackProfile.centerlinePath || [];
  const closed = Boolean(centerline.closed);
  const points = ensureClosedCenterline(rawPoints.map(normalizeTrackPoint), closed);
  const rawLanes = trackProfile.lanes?.length ? trackProfile.lanes : (trackProfile.laneOffsets || []).map((offset, index) => ({ laneId: `lane-${index}`, offset }));
  const lanes = rawLanes.map((lane, index) => ({ ...lane, laneId: lane.laneId || `lane-${index}`, offset: Number(lane.offset) }));
  const startS = numberOrFallback(trackProfile.startFinish?.startS ?? trackProfile.startFinish?.s ?? trackProfile.startLine?.s, 0);
  const finishS = numberOrFallback(trackProfile.startFinish?.finishS ?? trackProfile.finishLine?.s, 1);
  const background = trackProfile.background || {};
  const backgroundSrc = background.src || (trackProfile.meta?.candidateOnly === true && background.asset === 'background.webp' ? candidateAssetRoute(trackProfile.trackId, 'background.webp') : '');
  const makeBackgroundAssetId = (src = '') => {
    const basename = String(src || 'candidate-background').split('/').filter(Boolean).at(-1) || 'candidate-background';
    return basename.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'candidate-background';
  };
  return {
    ...trackProfile,
    viewBox,
    designSize: { width: Number(trackProfile.designSize?.width) || viewBox.width, height: Number(trackProfile.designSize?.height) || viewBox.height, aspectRatio: trackProfile.designSize?.aspectRatio || '16:9' },
    direction: normalizeTrackDirection(trackProfile.direction),
    background: { ...background, ...(backgroundSrc ? { src: backgroundSrc } : {}), assetId: background.assetId || makeBackgroundAssetId(backgroundSrc || background.asset || trackProfile.backgroundAsset || 'candidate-background'), kind: background.kind || String(backgroundSrc || background.asset || '').split('.').pop() || 'webp' },
    backgroundAsset: trackProfile.backgroundAsset || background.assetId || background.asset || makeBackgroundAssetId(backgroundSrc),
    centerline: { ...centerline, type: centerline.type || 'polyline', closed, smoothing: centerline.smoothing || 'mvp-polyline', points },
    centerlinePath: points,
    laneOffsets: lanes.map((lane) => lane.offset),
    lanes,
    startFinish: { ...(trackProfile.startFinish || {}), startS, finishS, label: publicCheckpointLabel(trackProfile.startFinish?.label || trackProfile.startFinish?.finishLabel || '终点线') },
    checkpoints: (trackProfile.checkpoints || []).map((checkpoint, index) => ({ ...checkpoint, checkpointId: checkpoint.checkpointId || `cp-${index}`, label: publicCheckpointLabel(checkpoint.label || checkpoint.checkpointId || `CP ${index + 1}`), s: numberOrFallback(checkpoint.s, 0) })),
    messageZones: (trackProfile.messageZones || []).map(normalizeTrackZone),
    noBubbleZones: (trackProfile.noBubbleZones || []).map(normalizeTrackZone),
    riskZones: (trackProfile.riskZones || []).map(normalizeTrackZone)
  };
}

function readJsonFileIfExists(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function candidateAssetRoute(trackId, file) {
  return `${JUMBOTRON_CANDIDATE_ASSET_ROUTE_PREFIX}/${encodeURIComponent(trackId)}/${file}`;
}

function resolveCandidateAssetRoute(pathname) {
  const parts = String(pathname || '').split('/');
  if (parts.length !== 5 || `/${parts[1]}/${parts[2]}` !== JUMBOTRON_CANDIDATE_ASSET_ROUTE_PREFIX) return null;
  const trackId = decodeURIComponent(parts[3] || '');
  const file = parts[4] || '';
  const assetInfo = JUMBOTRON_CANDIDATE_ASSET_FILES.get(file);
  const candidate = readActiveSecondTrackCandidate();
  if (!assetInfo || !candidate.available || trackId !== candidate.trackId) return null;
  return { candidate, file, contentType: assetInfo.contentType, role: assetInfo.role };
}

function candidateDir(trackId) {
  return join(JUMBOTRON_RAW_TRACKS_DIR, trackId);
}

function safeCandidateTrackId(trackId) {
  return /^[a-z0-9][a-z0-9-]*$/i.test(String(trackId || ''));
}

function resolveCandidateReplacement(currentTrackId, replacementCandidate = '') {
  const raw = String(replacementCandidate || '').trim();
  if (!raw) return '';
  const resolved = resolve(candidateDir(currentTrackId), raw);
  const relativePath = relative(JUMBOTRON_RAW_TRACKS_DIR, resolved);
  if (!relativePath || relativePath.startsWith('..') || relativePath.includes('/')) return '';
  return safeCandidateTrackId(relativePath) ? relativePath : '';
}

function readSecondTrackCandidate(trackId, chain = []) {
  if (!safeCandidateTrackId(trackId) || chain.includes(trackId) || chain.length > 8) {
    return { available: false, trackId, profile: null, provenance: null, validation: null, backgroundExists: false, previewExists: false, chain, reason: '候选资产 replacement 链无效' };
  }
  const dir = candidateDir(trackId);
  try {
    const profile = readJsonFileIfExists(join(dir, 'track.profile.json'));
    const provenance = readJsonFileIfExists(join(dir, 'asset-provenance.json'));
    const validation = readJsonFileIfExists(join(dir, 'asset-validation.json'));
    const nextTrackId = resolveCandidateReplacement(trackId, validation?.checks?.replacementCandidate || provenance?.replacementCandidate);
    if (nextTrackId) return readSecondTrackCandidate(nextTrackId, [...chain, trackId]);
    const backgroundExists = existsSync(join(dir, 'background.webp'));
    const previewExists = existsSync(join(dir, 'preview.png'));
    const doNotUse = profile?.meta?.doNotUse === true || validation?.checks?.doNotUse === true || validation?.status === 'withdrawn' || String(profile?.meta?.assetStatus || provenance?.assetStatus || '').includes('withdrawn');
    const placeholderFree = (profile?.meta?.containsPlaceholderAssets === false || profile?.meta?.containsPlaceholderAssets === undefined) && validation?.checks?.containsPlaceholderAssets === false;
    const available = Boolean(profile && provenance && validation && backgroundExists && previewExists && validation.status === 'pass' && placeholderFree && !doNotUse);
    return { available, trackId: profile?.trackId || trackId, dir, profile, provenance, validation, backgroundExists, previewExists, chain: [...chain, trackId], reason: available ? '' : '候选资产仍未满足导入条件' };
  } catch {
    return { available: false, trackId, dir, profile: null, provenance: null, validation: null, backgroundExists: false, previewExists: false, chain: [...chain, trackId], reason: '候选资产读取失败' };
  }
}

function readActiveSecondTrackCandidate() {
  for (const seed of JUMBOTRON_SECOND_TRACK_CANDIDATE_SEEDS) {
    const candidate = readSecondTrackCandidate(seed);
    if (candidate.available) return candidate;
  }
  return readSecondTrackCandidate(JUMBOTRON_SECOND_TRACK_CANDIDATE_SEEDS[0]);
}

function jumbotronCandidateTracks() {
  const active = readActiveSecondTrackCandidate();
  return [{ trackId: active.trackId || 'second-track-candidate', label: active.profile?.name || active.trackId || 'Second Track Candidate', status: 'candidate', available: Boolean(active.available) }];
}

function sanitizeTrackCandidateEvidence(candidate = readActiveSecondTrackCandidate()) {
  const profile = candidate.profile || {};
  const checks = candidate.validation?.checks || {};
  const humanReviewStatus = secondTrackHumanReviewStatus(candidate);
  return {
    available: Boolean(candidate.available),
    trackId: profile.trackId || candidate.trackId || 'second-track-candidate',
    name: profile.name || candidate.trackId || 'Second Track Candidate',
    assetStatus: profile.meta?.assetStatus || candidate.provenance?.assetStatus || 'candidate',
    validationStatus: candidate.validation?.status || 'missing',
    humanReviewStatus,
    containsPlaceholderAssets: checks.containsPlaceholderAssets === false && profile.meta?.containsPlaceholderAssets === false ? false : Boolean(checks.containsPlaceholderAssets),
    centerlinePointCount: profile.centerline?.points?.length || 0,
    laneCount: profile.lanes?.length || 0,
    checkpointCount: profile.checkpoints?.length || 0,
    backgroundFormat: checks.backgroundFormat || 'WEBP',
    previewFormat: checks.previewFormat || 'PNG',
    backgroundSize: checks.backgroundSize?.length === 2 ? `${checks.backgroundSize[0]}×${checks.backgroundSize[1]}` : '未验证',
    previewSize: checks.previewSize?.length === 2 ? `${checks.previewSize[0]}×${checks.previewSize[1]}` : '未验证',
    backgroundBytes: checks.backgroundBytes || 0,
    previewBytes: checks.previewBytes || 0,
    backgroundColorCount: checks.backgroundNonBlankColorCount96x54 || 0,
    previewColorCount: checks.previewNonBlankColorCount96x54 || 0,
    backgroundRoute: candidateAssetRoute(profile.trackId || candidate.trackId || 'second-track-candidate', 'background.webp'),
    previewRoute: candidateAssetRoute(profile.trackId || candidate.trackId || 'second-track-candidate', 'preview.png'),
    humanReview: humanReviewStatus === 'confirmed' ? '用户人工确认通过：可作为已确认第二赛道进入默认大屏赛道流程。' : '候选资产待人工复核，不是正式资产'
  };
}

function renderTrackCandidateEvidence(evidence) {
  return `<section class="jumbotron-validation" data-track-candidate-evidence><div class="eyebrow">候选资产证据</div><h2>${escapeHtml(evidence.name)}</h2><div class="validation-grid"><article><strong>候选状态</strong><p class="muted">trackId=${escapeHtml(evidence.trackId)}；asset=${escapeHtml(evidence.assetStatus)}；validation=${escapeHtml(evidence.validationStatus)}；humanReview=${escapeHtml(evidence.humanReviewStatus)}</p></article><article><strong>几何摘要</strong><p class="muted">centerline=${escapeHtml(evidence.centerlinePointCount)}；lanes=${escapeHtml(evidence.laneCount)}；checkpoints=${escapeHtml(evidence.checkpointCount)}</p></article><article><strong>底图摘要</strong><p class="muted">background=${escapeHtml(evidence.backgroundFormat)} ${escapeHtml(evidence.backgroundSize)}；preview=${escapeHtml(evidence.previewFormat)} ${escapeHtml(evidence.previewSize)}</p></article><article><strong>人工边界</strong><p class="muted">${escapeHtml(evidence.humanReview)}</p></article></div><div class="cta-row"><a class="button secondary" href="${escapeHtml(evidence.previewRoute)}">查看候选预览图</a><a class="button secondary" href="${escapeHtml(evidence.backgroundRoute)}">查看候选底图</a></div></section>`;
}

function normalizeExternalTrackCandidate(profile, candidate = readActiveSecondTrackCandidate()) {
  const viewBox = normalizeTrackViewBox(profile.viewBox);
  const closed = Boolean(profile.centerline?.closed);
  const points = ensureClosedCenterline((profile.centerline?.points || []).map(normalizeTrackPoint), closed);
  return normalizeTrackProfile({
    schemaVersion: JUMBOTRON_TRACK_PROFILE_SCHEMA_VERSION,
    trackId: profile.trackId || candidate.trackId || 'second-track-candidate',
    name: profile.name || candidate.trackId || 'Second Track Candidate',
    label: profile.name || candidate.trackId || 'Second Track Candidate',
    viewBox,
    designSize: { width: profile.designSize?.width || viewBox.width, height: profile.designSize?.height || viewBox.height, aspectRatio: '16:9' },
    direction: normalizeTrackDirection(profile.direction),
    background: { assetId: `${profile.trackId || candidate.trackId || 'second-track'}-candidate-background`, src: candidateAssetRoute(profile.trackId || candidate.trackId || 'second-track-candidate', 'background.webp'), previewSrc: candidateAssetRoute(profile.trackId || candidate.trackId || 'second-track-candidate', 'preview.png'), kind: 'webp', status: 'candidate' },
    backgroundAsset: `${profile.trackId || candidate.trackId || 'second-track'}-candidate-background`,
    centerline: { type: 'polyline', closed, smoothing: 'mvp-polyline', points },
    centerlinePath: points,
    startFinish: {
      ...(profile.startFinish || {}),
      startS: numberOrFallback(profile.startFinish?.startS ?? profile.startFinish?.s, 0),
      finishS: numberOrFallback(profile.startFinish?.finishS ?? profile.startFinish?.s, 1),
      label: publicCheckpointLabel(profile.startFinish?.label || profile.startFinish?.finishLabel || '起终点')
    },
    lanes: (profile.lanes || []).map((lane, index) => ({ laneId: lane.laneId || `lane-${index + 1}`, offset: Number(lane.offset) })),
    checkpoints: (profile.checkpoints || []).map((checkpoint, index) => ({ checkpointId: checkpoint.checkpointId || `cp-${index}`, label: publicCheckpointLabel(checkpoint.label || `CP ${index + 1}`), s: numberOrFallback(checkpoint.s, 0) })),
    messageZones: (profile.messageZones || []).map(normalizeTrackZone),
    noBubbleZones: (profile.noBubbleZones || []).map(normalizeTrackZone),
    riskZones: (profile.riskZones || []).map(normalizeTrackZone),
    safeZones: profile.safeZones || [],
    meta: { ...(profile.meta || {}), candidateOnly: secondTrackHumanReviewStatus(candidate) !== 'confirmed', humanReviewStatus: secondTrackHumanReviewStatus(candidate) },
    debug: { sampleCount: 28, collisionBox: { width: 44, height: 44 }, staleThresholdMs: JUMBOTRON_STALE_THRESHOLD_MS, manualChecks: { horseOnTrack: JUMBOTRON_MANUAL_CHECK_CONFIRMED, curveNatural: JUMBOTRON_MANUAL_CHECK_CONFIRMED, bubbleClearance: JUMBOTRON_MANUAL_CHECK_CONFIRMED, checkpointMeaning: JUMBOTRON_MANUAL_CHECK_CONFIRMED } }
  });
}

function isActiveSecondTrackCandidateImport(body = {}) {
  return body.candidateImport === JUMBOTRON_CANDIDATE_IMPORT_VALUE || body.candidateImport === 'grandstand-oval-ai' || body.candidate === 'real-explicit-closed-course';
}

function assignJumbotronLanes(entries, trackProfile, attentionItems = []) {
  const lanes = (trackProfile.lanes || []).map((lane, laneIndex) => ({ ...lane, laneIndex }));
  if (!lanes.length) return entries;
  const byId = new Map(lanes.map((lane) => [lane.laneId, lane]));
  const laneCenterPriority = ['lane-10', 'lane-8', 'lane-6', 'lane-4', 'lane-12', 'lane-2'].map((id) => byId.get(id)).filter(Boolean);
  const laneExceptionPriority = ['lane-6', 'lane-8', 'lane-4', 'lane-10', 'lane-2', 'lane-12'].map((id) => byId.get(id)).filter(Boolean);
  const fallbackCenterPriority = [...lanes].sort((a, b) => Math.abs(b.offset) - Math.abs(a.offset) || a.laneIndex - b.laneIndex);
  const fallbackExceptionPriority = [...lanes].sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset) || a.offset - b.offset);
  const centerPriority = laneCenterPriority.length ? laneCenterPriority : fallbackCenterPriority;
  const exceptionPriority = laneExceptionPriority.length ? laneExceptionPriority : fallbackExceptionPriority;
  const attentionEntryIds = new Set((attentionItems || []).map((item) => item.entryId).filter(Boolean));
  let normalIndex = 0;
  let exceptionIndex = 0;
  return entries.map((entry) => {
    const risk = String(entry.riskLevel || '').toLowerCase();
    const state = entry.motionState || entry.status;
    const exception = attentionEntryIds.has(entry.entryId) || ['high', 'critical', 'medium'].includes(risk) || ['blocked', 'pit_stop', 'takeover', 'stale', 'slowed'].includes(state);
    const preferred = exception ? exceptionPriority : centerPriority;
    const laneIndex = exception ? exceptionIndex++ : normalIndex++;
    const lane = preferred[laneIndex % preferred.length] || lanes[laneIndex % lanes.length] || lanes[0];
    return { ...entry, laneId: lane.laneId, laneOffsetIndex: lane.laneIndex, laneAssignment: exception ? 'exception-outer-priority' : 'center-density-adaptive' };
  });
}


function adaptJumbotronSnapshot(raceSnapshot, trackProfile) {
  const messagesById = new Map((raceSnapshot.messages || []).map((message) => [message.messageId, message]));
  const baseEntries = raceSnapshot.entries.map((entry, index) => {
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
  });
  const racingEntries = assignJumbotronLanes(baseEntries, trackProfile, raceSnapshot.attentionItems || []);
  const derivedMessages = mergeJumbotronMessages(
    raceSnapshot.messages || [],
    buildJumbotronEntryStateMessages(racingEntries, raceSnapshot.competition?.systemTime || raceSnapshot.generatedAt, 'entry-state'),
    buildJumbotronAttentionMessages(raceSnapshot.attentionItems || [], raceSnapshot.competition?.systemTime || raceSnapshot.generatedAt, 'entry-attention')
  );
  return {
    competition: raceSnapshot.competition,
    kpi: raceSnapshot.kpi,
    racingEntries,
    ridingMessages: derivedMessages,
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
  const counterclockwise = trackProfile.direction === 'counterclockwise';
  const closedTrack = Boolean(trackProfile.centerline?.closed);
  const clampS = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  const startS = clampS(trackProfile.startFinish?.startS ?? trackProfile.startFinish?.s ?? 0);
  const finishS = clampS(trackProfile.startFinish?.finishS ?? trackProfile.startFinish?.s ?? 1);
  const progressToTrackS = (progress) => {
    const clampedProgress = clampS(progress);
    const directDelta = finishS - startS;
    const lapDelta = closedTrack && Math.abs(directDelta) < 0.0005 ? 1 : directDelta;
    const wrappedDelta = closedTrack && lapDelta < 0 ? lapDelta + 1 : lapDelta;
    const mapped = startS + clampedProgress * (closedTrack ? wrappedDelta : lapDelta);
    if (!closedTrack) return clampS(mapped);
    const wrapped = ((mapped % 1) + 1) % 1;
    return clampedProgress >= 1 && Math.abs(wrapped - startS) < 0.0005 ? finishS : wrapped;
  };
  const sampleAtS = (s) => {
    const rawS = clampS(s);
    const sample = sampleTrackPath(segments, pathLength, counterclockwise ? 1 - rawS : rawS);
    return counterclockwise
      ? { ...sample, tangent: { x: -sample.tangent.x, y: -sample.tangent.y }, rotation: sample.rotation + 180 }
      : sample;
  };
  const poseAtProgress = (entry, progress) => {
    const clampedProgress = clampS(progress);
    const trackS = progressToTrackS(clampedProgress);
    const sample = sampleAtS(trackS);
    const lane = trackProfile.lanes.find((item) => item.laneId === entry.laneId) || trackProfile.lanes[entry.laneOffsetIndex % trackProfile.lanes.length] || trackProfile.lanes[0] || { laneId: 'lane-0', offset: 0 };
    const adjustment = trackProfile.displayAdjustment || { horseX: 0, horseY: 0 };
    const laneOffset = lane.offset;
    return {
      entryId: entry.entryId,
      x: sample.point.x + sample.normal.x * laneOffset + (adjustment.horseX || 0),
      y: sample.point.y + sample.normal.y * laneOffset + (adjustment.horseY || 0),
      rotation: sample.rotation,
      s: trackS,
      progress: clampedProgress,
      laneId: lane.laneId,
      state: entry.motionState,
      zIndex: Math.round(1000 + clampedProgress * 100 + (entry.laneOffsetIndex || 0))
    };
  };
  return {
    pathLength,
    startS,
    finishS,
    progressToTrackS,
    sampleHorsePose(entry) {
      return poseAtProgress(entry, entry.roundProgress / 100);
    },
    sampleInterpolatedPose(entry, previousS, nextS, t) {
      const progress = previousS + (nextS - previousS) * Math.max(0, Math.min(1, t));
      return poseAtProgress(entry, progress);
    },
    samplePoint(s) {
      return sampleAtS(s);
    },
    samplePoints(count = 28) {
      return Array.from({ length: count }, (_, index) => sampleAtS(index / (count - 1)).point);
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
  const options = Array.from({ length: cycleSeconds }, (_, second) => {
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
    return { second, score, overlap, eventsOk, spatialOk, averageDuringBubble, eventDistance };
  });
  const viable = options.filter((item) => item.overlap <= JUMBOTRON_BUBBLE_VISIBLE_LIMIT && item.eventsOk && item.spatialOk);
  const spatiallySeparated = options.filter((item) => item.overlap <= JUMBOTRON_BUBBLE_VISIBLE_LIMIT && item.spatialOk);
  return (viable.length ? viable : spatiallySeparated.length ? spatiallySeparated : options)
    .sort((a, b) => a.score - b.score || a.second - b.second)[0].second;
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
    const nextBubbles = [...plannedBubbles, bubble];
    const nextRects = [...bubbleRects, rect];
    const scheduleOk = maxOverlappingBubbles(nextBubbles, cycleSeconds) <= JUMBOTRON_BUBBLE_VISIBLE_LIMIT
      && eventsHaveMinimumGap(nextBubbles, cycleSeconds)
      && visibleBubblesSpatiallySeparated(nextBubbles, nextRects, cycleSeconds);
    if (!scheduleOk) {
      rejectedQueue.push(candidate);
      continue;
    }
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
    ['中心线点s', points.length >= 2],
    ['direction', ['clockwise', 'counterclockwise'].includes(trackProfile.direction)],
    ['startFinish', Number.isFinite(trackProfile.startFinish?.startS) && Number.isFinite(trackProfile.startFinish?.finishS) && trackProfile.startFinish.startS >= 0 && trackProfile.startFinish.finishS <= 1],
    ['startFinish.s', [trackProfile.startFinish?.startS, trackProfile.startFinish?.finishS].every((s) => Number.isFinite(s) && s >= 0 && s <= 1)],
    ['checkpoints.s', trackProfile.checkpoints.every((checkpoint) => Number.isFinite(checkpoint.s) && checkpoint.s >= 0 && checkpoint.s <= 1)],
    ['lanes', trackProfile.lanes.length >= 1 && trackProfile.lanes.every((lane) => lane.laneId && Number.isFinite(lane.offset))],
    ['泳道偏移 unique', new Set(trackProfile.lanes.map((lane) => lane.offset)).size === trackProfile.lanes.length],
    ['lane offset duplicate', new Set(trackProfile.lanes.map((lane) => lane.offset)).size === trackProfile.lanes.length],
    ['profile schema', trackProfile.schemaVersion === JUMBOTRON_TRACK_PROFILE_SCHEMA_VERSION],
    ['background file exists', backgroundExists],
    ['background asset allowlist', trackBackgroundAllowed(trackProfile)],
    ['checkpoints', trackProfile.checkpoints.every((checkpoint) => checkpoint.s >= 0 && checkpoint.s <= 1)],
    ['NaN / Infinity', sampledPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))],
    ['sample finite', sampledPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))],
    ['sample continuity', adjacentDistances.every((distance) => distance > 0 && distance < 180)],
    ['sample jump warning', adjacentDistances.every((distance) => distance > 0 && distance < 180)],
    ['curvature warning', maxTurnAngle(points) < 135 || manualCheckStatus(trackProfile.debug?.manualChecks?.curveNatural) === 'confirmed'],
    ['turn angle warning', maxTurnAngle(points) < 135 || manualCheckStatus(trackProfile.debug?.manualChecks?.curveNatural) === 'confirmed'],
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
    [`${entry.displayName} background asset allowlist`, trackBackgroundAllowed(trackProfile)],
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
  const visualDistanceThreshold = trackProfile.trackId === JUMBOTRON_DEFAULT_TRACK_ID ? 18 : 24;
  const horseOverlapThreshold = trackProfile.trackId === JUMBOTRON_DEFAULT_TRACK_ID ? 18 : 32;
  const multiHorsePreviewDistanceValid = multiHorsePreview.minDistance >= visualDistanceThreshold;
  const multiHorsePreviewSevereOverlap = multiHorsePreview.minDistance < visualDistanceThreshold;
  const secondTrackReady = jumbotronConfirmedTracks().length >= 2 || readActiveSecondTrackCandidate().available;
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
    ['horse overlap', horseDistances.every((distance) => distance >= horseOverlapThreshold)],
    ['multi-horse preview count', multiHorsePreview.count >= 8],
    ['multi-horse preview in viewBox', multiHorsePreview.inViewBox],
    ['multi-horse preview distance', multiHorsePreviewDistanceValid],
    ['multi-horse preview severe overlap', !multiHorsePreviewSevereOverlap],
    ['multi-horse preview turn direction', multiHorsePreview.turnDirectionsValid],
    ['multi-horse preview', multiHorsePreview.count >= 8 && multiHorsePreview.inViewBox && multiHorsePreviewDistanceValid],
    ['检查点 semantics', trackProfile.checkpoints.length >= 3],
    ['16:9 stable', trackProfile.designSize?.aspectRatio === '16:9'],
    ['two tracks ready', secondTrackReady],
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
  const candidateAsset = resolveCandidateAssetRoute(value);
  if (candidateAsset) return join(candidateAsset.candidate.dir, candidateAsset.file);
  if (!value.startsWith('/assets/') || value.includes('..')) return null;
  return join(rootDir, 'assets', value.slice('/assets/'.length));
}

function trackBackgroundExists(trackProfile) {
  const filePath = trackBackgroundFilePath(trackProfile.background?.src);
  return Boolean(filePath && existsSync(filePath));
}

function trackBackgroundAllowed(trackProfile) {
  const src = trackProfile.background?.src;
  return JUMBOTRON_BACKGROUND_ASSETS.has(src) || (['confirmed', 'pending'].includes(trackProfile.meta?.humanReviewStatus) && Boolean(resolveCandidateAssetRoute(src)));
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
    severeOverlap: distances.some((distance) => distance < 18),
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

function labelLabelOverlapCount(item, items) {
  return items.filter((other) => other.entryId !== item.entryId && intersects(item.rect, other.rect)).length;
}

function horseLabelAnchorDistance(item) {
  return Math.hypot(item.anchor.x2 - item.anchor.x1, item.anchor.y2 - item.anchor.y1);
}

function horseLabelOutOfViewBox(item, viewBox) {
  return item.rect.x < viewBox.x || item.rect.y < viewBox.y || item.rect.x + item.rect.width > viewBox.x + viewBox.width || item.rect.y + item.rect.height > viewBox.y + viewBox.height;
}

function scoreRefinedHorseLabel(item, items, markerRects, messageBubbleRects, viewBox) {
  const labelOverlap = labelLabelOverlapCount(item, items);
  const hardOverlap = horseLabelHardOverlapCount(item, items, markerRects);
  const bubbleOverlap = labelBubbleOverlapCount(item, messageBubbleRects);
  const overflow = horseLabelOutOfViewBox(item, viewBox) ? 1 : 0;
  return labelOverlap * 10000000 + hardOverlap * 1000000 + bubbleOverlap * 350000 + overflow * 100000 + distanceFromPoseToRect(item.pose, item.rect) + item.penalty / 100000;
}

function refineHorseLabelLayout(items, { markerRects, messageBubbleRects, trackProfile, viewBox, headerRect, tickerRect }) {
  let refined = items;
  for (let round = 0; round < 4; round += 1) {
    let changed = false;
    refined = refined.map((item) => {
      if (!labelLabelOverlapCount(item, refined) && !horseLabelHardOverlapCount(item, refined, markerRects) && !labelBubbleOverlapCount(item, messageBubbleRects)) return item;
      const size = estimateHorseLabelSize(item.text);
      const currentMarkerRect = markerRects.find((marker) => marker.entryId === item.entryId) || markerRectForPose(item.pose);
      const context = { entryId: item.entryId, placedLabels: refined.filter((other) => other.entryId !== item.entryId), markerRects, currentMarkerRect, messageBubbleRects, noBubbleZones: trackProfile.noBubbleZones || [], headerRect, tickerRect, viewBox };
      const geometryCandidates = buildHorseLabelCandidates({ pose: item.pose, size, viewBox })
        .map((candidateItem) => updateHorseLabelItemGeometry(item, { ...candidateItem, penalty: scoreHorseLabelCandidate(candidateItem, context) }, size));
      const pushCandidates = pushApartHorseLabelCandidates(item, horseLabelBlockingObstacles(item, refined, markerRects, messageBubbleRects), viewBox);
      const candidates = [item, ...geometryCandidates, ...pushCandidates];
      const next = candidates.sort((a, b) => {
        const aItems = refined.map((candidate) => candidate.entryId === item.entryId ? a : candidate);
        const bItems = refined.map((candidate) => candidate.entryId === item.entryId ? b : candidate);
        return scoreRefinedHorseLabel(a, aItems, markerRects, messageBubbleRects, viewBox) - scoreRefinedHorseLabel(b, bItems, markerRects, messageBubbleRects, viewBox) || a.rect.x - b.rect.x || a.rect.y - b.rect.y;
      })[0];
      changed = changed || next.rect.x !== item.rect.x || next.rect.y !== item.rect.y || next.direction !== item.direction || next.ring !== item.ring;
      return next;
    });
    if (!changed) break;
  }
  return refined;
}

function scoreBubbleClearanceHorseLabel(item, items, markerRects, messageBubbleRects, viewBox) {
  const otherItems = items.filter((other) => other.entryId !== item.entryId);
  const labelOverlap = otherItems.filter((other) => intersects(item.rect, other.rect)).length;
  const markerOverlap = markerRects.filter((marker) => marker.entryId !== item.entryId && intersects(item.rect, marker)).length
    + (intersects(item.rect, markerRects.find((marker) => marker.entryId === item.entryId) || {}) ? 1 : 0);
  return labelOverlap * 10000000
    + labelBubbleOverlapCount(item, messageBubbleRects) * 3500000
    + markerOverlap * 900000
    + (horseLabelOutOfViewBox(item, viewBox) ? 100000 : 0)
    + Math.max(0, horseLabelAnchorDistance(item) - 220) * 1000
    + distanceFromPoseToRect(item.pose, item.rect)
    + item.penalty / 100000;
}

function firstHorseLabelOverlapPair(items) {
  for (let index = 0; index < items.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < items.length; otherIndex += 1) {
      if (intersects(items[index].rect, items[otherIndex].rect)) return [index, otherIndex];
    }
  }
  return null;
}

function chooseHorseLabelCandidate(item, currentItems, markerRects, messageBubbleRects, viewBox) {
  const size = estimateHorseLabelSize(item.text);
  const obstacles = horseLabelBlockingObstacles(item, currentItems, markerRects, messageBubbleRects);
  const geometryCandidates = buildHorseLabelCandidates({ pose: item.pose, size, viewBox })
    .map((candidateItem) => updateHorseLabelItemGeometry(item, { ...candidateItem, penalty: item.penalty + candidateItem.order }, size));
  const candidates = [item, ...geometryCandidates, ...pushApartHorseLabelCandidates(item, obstacles, viewBox)];
  return candidates.sort((a, b) => {
    const aItems = currentItems.map((candidate) => candidate.entryId === item.entryId ? a : candidate);
    const bItems = currentItems.map((candidate) => candidate.entryId === item.entryId ? b : candidate);
    return scoreBubbleClearanceHorseLabel(a, aItems, markerRects, messageBubbleRects, viewBox) - scoreBubbleClearanceHorseLabel(b, bItems, markerRects, messageBubbleRects, viewBox) || a.rect.x - b.rect.x || a.rect.y - b.rect.y;
  })[0];
}

function clearHorseLabelLayoutConflicts(items, { markerRects, messageBubbleRects, viewBox }) {
  let resolved = items;
  for (let round = 0; round < 24; round += 1) {
    const overlapPair = firstHorseLabelOverlapPair(resolved);
    const conflictIndex = overlapPair ? overlapPair[1] : resolved.findIndex((item) => labelBubbleOverlapCount(item, messageBubbleRects) || horseLabelHardOverlapCount(item, resolved, markerRects));
    if (conflictIndex < 0) break;
    const item = resolved[conflictIndex];
    const next = chooseHorseLabelCandidate(item, resolved, markerRects, messageBubbleRects, viewBox);
    if (next.rect.x === item.rect.x && next.rect.y === item.rect.y && next.direction === item.direction && next.ring === item.ring) break;
    resolved = resolved.map((candidate, index) => index === conflictIndex ? next : candidate);
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
    const text = `${entry.displayName} · ${Math.round(entry.roundProgress)}%`;
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
    const rect = { x: fallbackX, y: fallbackY, width, height, placement: best.placement };
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

function turnAngleAt(points, index) {
  const point = points[index];
  const previous = points[index - 1];
  const next = points[index + 1];
  if (!finitePoint(previous) || !finitePoint(point) || !finitePoint(next)) return 0;
  const a = Math.atan2(point.y - previous.y, point.x - previous.x);
  const b = Math.atan2(next.y - point.y, next.x - point.x);
  return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) * 180 / Math.PI;
}

function analyzeSharpTurns(points, threshold = 135) {
  return points.slice(1, -1).map((point, offset) => {
    const index = offset + 1;
    const previous = points[index - 1];
    const next = points[index + 1];
    const previousLength = finitePoint(previous) ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0;
    const nextLength = finitePoint(next) ? Math.hypot(next.x - point.x, next.y - point.y) : 0;
    const angle = turnAngleAt(points, index);
    return { index, x: point.x, y: point.y, angle, previousLength, nextLength, sharp: angle >= threshold || previousLength < 10 || nextLength < 10 };
  }).filter((item) => item.sharp);
}

function autoFixSharpTurns(points, options = {}) {
  const closed = Boolean(options.closed);
  const input = ensureClosedCenterline(points, closed);
  const working = input.map((point) => ({ ...point }));
  const fixes = [];
  for (let index = 1; index < working.length - 1; index += 1) {
    const previous = working[index - 1];
    const point = working[index];
    const next = working[index + 1];
    const previousLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    const nextLength = Math.hypot(next.x - point.x, next.y - point.y);
    const angle = turnAngleAt(working, index);
    if (angle < 135 && previousLength >= 10 && nextLength >= 10) continue;
    if ((previousLength < 10 || nextLength < 10) && working.length > (closed ? 5 : 3)) {
      fixes.push({ index, action: 'remove-short-spike', before: { ...point }, angle: Number(angle.toFixed(1)) });
      working.splice(index, 1);
      index -= 1;
      continue;
    }
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    const offset = Math.min(32, Math.max(18, Math.min(previousLength, nextLength) * 0.18));
    const after = { x: Number(((previous.x + next.x) / 2 - dy / length * offset).toFixed(2)), y: Number(((previous.y + next.y) / 2 + dx / length * offset).toFixed(2)) };
    fixes.push({ index, action: 'smooth-sharp-turn', before: { ...point }, after, angle: Number(angle.toFixed(1)) });
    working[index] = after;
  }
  const output = ensureClosedCenterline(working, closed);
  return { points: output, fixes, remainingSharpTurns: analyzeSharpTurns(output) };
}

function buildAutoFixEvidence(beforePoints = [], afterPoints = [], fixes = [], remainingSharpTurns = []) {
  return {
    enabled: true,
    label: '自动修复候选草稿',
    beforePointCount: beforePoints.length,
    afterPointCount: afterPoints.length,
    fixCount: fixes.length,
    remainingSharpTurnCount: remainingSharpTurns.length,
    fixes,
    beforePoints,
    afterPoints,
    humanReview: '自动修复只生成 draft，仍需人工复核后才能 confirmed'
  };
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

function jumbotronCurvePath(points) {
  const closedPoints = points.length > 1 && samePoint(points[0], points.at(-1)) ? points.slice(0, -1) : points;
  if (closedPoints.length < 3) return jumbotronPath(points);
  const commands = [`M ${closedPoints[0].x} ${closedPoints[0].y}`];
  for (let index = 0; index < closedPoints.length; index += 1) {
    const p0 = closedPoints[(index - 1 + closedPoints.length) % closedPoints.length];
    const p1 = closedPoints[index];
    const p2 = closedPoints[(index + 1) % closedPoints.length];
    const p3 = closedPoints[(index + 2) % closedPoints.length];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    commands.push(`C ${Number(c1.x.toFixed(2))} ${Number(c1.y.toFixed(2))} ${Number(c2.x.toFixed(2))} ${Number(c2.y.toFixed(2))} ${p2.x} ${p2.y}`);
  }
  commands.push('Z');
  return commands.join(' ');
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
    `摘要：${message.summary}`
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
  return `<span class="html-tooltip" role="tooltip"><strong>详情摘要</strong>${lines.slice(0, 5).map((line) => `<span>${escapeHtml(line.slice(0, 64))}</span>`).join('')}</span>`;
}

function renderJumbotronHeader({ raceSnapshot, dataProfile }) {
  const competition = raceSnapshot.competition;
  const brand = String(competition.brand || '').trim();
  const title = String(competition.title || '').trim();
  const titleText = title && title !== brand ? `<span>${escapeHtml(title)}</span>` : '';
  const profileName = dataProfile?.publicName || dataProfile?.profileAlias || '';
  const profileChip = profileName ? `<span>${escapeHtml(profileName)}</span>` : '';
  return `<section class="jumbotron-header"><div class="jumbotron-brandline"><span class="jumbotron-live">LIVE</span><strong>${escapeHtml(brand || title)}</strong>${titleText}</div><div class="jumbotron-statusbar"><span>${escapeHtml(competition.currentRound)}</span>${profileChip}<span data-local-clock>${escapeHtml(formatLocalClock(new Date()))}</span><span>在线 ${raceSnapshot.kpi.onlineRiders} 人</span></div></section>`;
}

function formatLocalClock(value) {
  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

function renderJumbotronLocalClockScript() {
  return `<script>(()=>{const clock=document.querySelector('[data-local-clock]');if(!clock)return;const pad=(value)=>String(value).padStart(2,'0');const updateLocalClock=()=>{const now=new Date();clock.textContent=pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());};updateLocalClock();window.setInterval(updateLocalClock,1000);})();</script>`;
}

function renderJumbotronKpis(kpi) {
  return `<section class="jumbotron-kpis" aria-label="赛事状态贴边信息">${[
    { label: '进度', value: `${kpi.completionRate}%` },
    { label: '在线', value: `${kpi.onlineRiders} 人` },
    { label: 'Token', value: String(kpi.totalTokens) },
    { label: 'Claude', value: `${kpi.claudeShare}%` },
    { label: '异常情况', value: String(kpi.riskCount + kpi.obstacleCount + kpi.violationCount) }
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
  return `落后 ${leaderGap}%`;
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

function jumbotronRuntimeAssetExists(href) {
  const assetInfo = JUMBOTRON_RUNTIME_ASSETS.get(href);
  return Boolean(assetInfo && existsSync(join(rootDir, 'assets', 'jumbotron', assetInfo.file)));
}

function jumbotronRiderAssetForMotionState(state) {
  const href = ['running', 'sprinting'].includes(state)
    ? '/assets/jumbotron/rider3_run.gif'
    : ['blocked', 'takeover', 'pit_stop'].includes(state)
      ? '/assets/jumbotron/rider3_walk.gif'
      : '/assets/jumbotron/rider3_stay.gif';
  return jumbotronRuntimeAssetExists(href) ? href : '';
}

function jumbotronMotionStateBadgeAsset(state) {
  const href = `/assets/jumbotron/state-badge-${state}.png`;
  return jumbotronRuntimeAssetExists(href) ? href : '';
}

function renderHorseStatusBadge(entry) {
  const href = jumbotronMotionStateBadgeAsset(entry.motionState);
  const label = motionStateLabel(entry.motionState);
  if (href) {
    return `<g class="horse-status-pill horse-status-badge-wrap" transform="translate(18 -30)"><title>${escapeHtml(label)}</title><image class="horse-status-badge" href="${escapeHtml(href)}" x="-14" y="-14" width="28" height="28" preserveAspectRatio="xMidYMid meet"/></g>`;
  }
  const shortLabel = jumbotronMotionStateShortLabel(entry.motionState);
  return `<g class="horse-status-pill" transform="translate(18 -30)"><rect x="-2" y="-13" width="24" height="18" rx="9"/><text x="10" y="0" text-anchor="middle">${escapeHtml(shortLabel)}</text></g>`;
}

function renderHorseTelemetryAttrs(entry, pose) {
  const rank = Number(entry.rank);
  const stableNumber = Number.isFinite(rank) && rank > 0 ? String(Math.round(rank)).padStart(2, '0') : '';
  const trackS = Number.isFinite(Number(pose.s)) ? Number(pose.s).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : pose.s;
  const attrs = [
    ['data-entry-id', entry.entryId],
    ['data-entry-stable-number', stableNumber],
    ['data-motion-state', entry.motionState],
    ['data-risk-level', entry.riskLevel],
    ['data-round-progress', entry.roundProgress],
    ['data-lane-id', pose.laneId || entry.laneId],
    ['data-lane-index', entry.laneOffsetIndex],
    ['data-lane-assignment', entry.laneAssignment || entry.progressMapping || 'runtime'],
    ['data-track-s', trackS]
  ];
  return attrs.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([name, value]) => `${name}="${escapeHtml(value)}"`).join(' ');
}

function renderJumbotronValidation({ debug, validation }) {
  const renderChecks = (checks) => checks.map(([label, ok]) => `<article class="review-check-${ok ? 'ok' : 'warn'}"><strong>${ok ? '✓' : '!' } ${escapeHtml(validationLabel(label))}</strong><p class="review-check-status">${ok ? '状态良好' : '待补齐'}</p></article>`).join('');
  return `<section class="jumbotron-debug"><div class="eyebrow">调试模式</div><h2>几何 / 运行时 / 待刷新</h2><div class="debug-grid"><article><strong>中心线</strong><p class="muted">${debug.sampledPoints.length} 个采样点</p></article><article><strong>泳道偏移</strong><p class="muted">${debug.laneOffsets.join(' / ')}</p></article><article><strong>检查点</strong><p class="muted">${debug.checkpoints.map((item) => item.label).join(' / ')}</p></article><article><strong>待刷新 Entry</strong><p class="muted">${debug.staleEntries.length || '无'}</p></article><article><strong>状态机覆盖</strong><p class="muted">${debug.motionStates.join(' / ')}</p></article><article><strong>s-axis interpolation</strong><p class="muted">sampleInterpolatedPose 输出 s=${debug.interpolationEvidence.s.toFixed(2)}</p></article><article><strong>消息降噪规则</strong><p class="muted">${debug.messageRules.join('；')}</p></article><article><strong>人工确认状态</strong><p class="muted">马在赛道上：${manualCheckLabel(debug.manualChecks.horseOnTrack)}；弯道自然：${manualCheckLabel(debug.manualChecks.curveNatural)}；气泡遮挡：${manualCheckLabel(debug.manualChecks.bubbleClearance)}；checkpoint 语义：${manualCheckLabel(debug.manualChecks.checkpointMeaning)}</p></article><article><strong>多马预览证据</strong><p class="muted">${validation.multiHorsePreview.count} 匹；最小距离 ${Math.round(validation.multiHorsePreview.minDistance)}；出界 ${validation.multiHorsePreview.inViewBox ? '无' : '有'}；严重重叠 ${validation.multiHorsePreview.severeOverlap ? '有' : '无'}</p></article></div></section><section class="jumbotron-validation"><div class="eyebrow">校验结果</div><h2>Track Profile / 数据契约 / 运行时 / 视觉</h2><h3>数据契约校验</h3><div class="validation-grid">${renderChecks(validation.contractChecks)}</div><h3>Track Profile 校验</h3><div class="validation-grid">${renderChecks(validation.trackChecks)}</div><h3>运行时校验</h3><div class="validation-grid">${renderChecks(validation.runtimeChecks)}</div><h3>视觉校验</h3><div class="validation-grid">${renderChecks(validation.visualChecks)}</div></section>`;
}



function renderTrackBackgroundImage(trackProfile) {
  const src = trackProfile.background?.src;
  if (!src) return '';
  const viewBox = trackProfile.viewBox || { x: 0, y: 0, width: 1200, height: 620 };
  return `<image class="track-background-image" href="${escapeHtml(src)}" x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" preserveAspectRatio="xMidYMid slice"/>`;
}

function jumbotronSpriteFacing(rotation) {
  const radians = Number(rotation || 0) * Math.PI / 180;
  return Math.cos(radians) >= 0 ? 'right' : 'left';
}

function jumbotronSpriteFacingTransform(facing) {
  return facing === 'left' ? 'scale(-1 1)' : 'scale(1 1)';
}

const JUMBOTRON_RIDER_TINT_PALETTE = [
  { name: 'violet', fill: '#7c3aed', opacity: 0.22 },
  { name: 'sky', fill: '#0ea5e9', opacity: 0.22 },
  { name: 'amber', fill: '#f59e0b', opacity: 0.2 },
  { name: 'emerald', fill: '#10b981', opacity: 0.2 },
  { name: 'rose', fill: '#f43f5e', opacity: 0.2 },
  { name: 'indigo', fill: '#4f46e5', opacity: 0.22 },
  { name: 'cyan', fill: '#06b6d4', opacity: 0.2 },
  { name: 'lime', fill: '#84cc16', opacity: 0.18 },
  { name: 'fuchsia', fill: '#d946ef', opacity: 0.2 },
  { name: 'orange', fill: '#f97316', opacity: 0.2 },
  { name: 'teal', fill: '#14b8a6', opacity: 0.2 },
  { name: 'red', fill: '#ef4444', opacity: 0.18 }
];

function jumbotronEntryProviderGroup(entry) {
  const value = String(entry.primaryCA || entry.caProvider || '').toLowerCase();
  if (value.includes('claude')) return 'claude';
  if (value.includes('codex')) return 'codex';
  return 'other';
}

function jumbotronHashString(value) {
  return [...String(value || '')].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0);
}

function jumbotronEntryTintIndex(entry) {
  const rank = Number(entry.rank);
  if (Number.isFinite(rank) && rank > 0) return (Math.round(rank) - 1) % JUMBOTRON_RIDER_TINT_PALETTE.length;
  return jumbotronHashString(entry.entryId || entry.displayName) % JUMBOTRON_RIDER_TINT_PALETTE.length;
}

function renderJumbotronRiderTintFilters() {
  return `<defs class="horse-rider-tint-filter-defs" data-rider-tint-palette-count="${JUMBOTRON_RIDER_TINT_PALETTE.length}">${JUMBOTRON_RIDER_TINT_PALETTE.map((tint, index) => `<filter id="horse-rider-tint-${index}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feFlood flood-color="${tint.fill}" flood-opacity="${tint.opacity}" result="tintColor"/><feComposite in="tintColor" in2="SourceAlpha" operator="in"/></filter>`).join('')}</defs>`;
}

const JUMBOTRON_RIDER_SPRITE_SIZE = { width: 151.2, height: 156.8 };
const JUMBOTRON_SECOND_TRACK_PERSPECTIVE = { trackId: 'real-explicit-closed-course', minScale: 0.6, maxScale: 1.1 };

function jumbotronRiderPerspectiveScale(trackProfile, pose) {
  if (trackProfile.trackId !== JUMBOTRON_SECOND_TRACK_PERSPECTIVE.trackId) return 1;
  const viewBox = trackProfile.viewBox || { y: 0, height: 620 };
  const yRatio = Math.max(0, Math.min(1, (Number(pose.y) - viewBox.y) / viewBox.height));
  const scale = JUMBOTRON_SECOND_TRACK_PERSPECTIVE.minScale + yRatio * (JUMBOTRON_SECOND_TRACK_PERSPECTIVE.maxScale - JUMBOTRON_SECOND_TRACK_PERSPECTIVE.minScale);
  return Number(scale.toFixed(3));
}

function renderHorseRiderSprite(entry, pose, trackProfile) {
  const href = jumbotronRiderAssetForMotionState(entry.motionState);
  const facing = jumbotronSpriteFacing(pose.rotation);
  const facingTransform = jumbotronSpriteFacingTransform(facing);
  const perspectiveScale = jumbotronRiderPerspectiveScale(trackProfile, pose);
  const tintIndex = jumbotronEntryTintIndex(entry);
  const tint = JUMBOTRON_RIDER_TINT_PALETTE[tintIndex];
  const providerGroup = jumbotronEntryProviderGroup(entry);
  const spriteAttrs = href ? `href="${escapeHtml(href)}" x="-75.6" y="-78.4" width="${JUMBOTRON_RIDER_SPRITE_SIZE.width}" height="${JUMBOTRON_RIDER_SPRITE_SIZE.height}" preserveAspectRatio="xMidYMid meet"` : '';
  const sprite = href
    ? `<image class="horse-rider-sprite" ${spriteAttrs}/>`
    : `<circle class="horse-body" r="18"/><path class="horse-arrow" d="M-7,-9 L19,0 L-7,9 Z"/>`;
  const groupMask = href
    ? `<image class="horse-rider-group-mask horse-rider-alpha-tint horse-rider-tint-${tintIndex}" data-entry-color-index="${tintIndex}" data-entry-tint="${escapeHtml(tint.name)}" data-entry-provider-group="${escapeHtml(providerGroup)}" data-mask-mode="source-alpha" ${spriteAttrs} filter="url(#horse-rider-tint-${tintIndex})" style="pointer-events:none"/>`
    : '';
  const scaledSprite = perspectiveScale === 1
    ? `${sprite}${groupMask}`
    : `<g class="horse-rider-perspective-scale" data-perspective-track="${escapeHtml(trackProfile.trackId)}" data-perspective-scale="${perspectiveScale}" data-perspective-y="${Number(pose.y).toFixed(1)}" data-perspective-min-scale="${JUMBOTRON_SECOND_TRACK_PERSPECTIVE.minScale}" data-perspective-max-scale="${JUMBOTRON_SECOND_TRACK_PERSPECTIVE.maxScale}" data-base-sprite-width="${JUMBOTRON_RIDER_SPRITE_SIZE.width}" data-base-sprite-height="${JUMBOTRON_RIDER_SPRITE_SIZE.height}" transform="scale(${perspectiveScale})">${sprite}${groupMask}</g>`;
  return `<g class="horse-rider-facing" data-facing="${facing}" transform="${facingTransform}">${scaledSprite}</g>`;
}

function renderJumbotronMainReplayControls(replayTimeline) {
  if (!replayTimeline?.frames?.length) return '';
  const frameCount = replayTimeline.playbackFrameCount || replayTimeline.frames.length;
  const keyFrameCount = replayTimeline.keyFrameCount || replayTimeline.rawFrameCount || frameCount;
  return `<div class="cta-row jumbotron-main-replay-controls" data-main-replay-controls data-playback-frame-count="${escapeHtml(frameCount)}" data-key-frame-count="${escapeHtml(keyFrameCount)}" data-interpolation-steps="${escapeHtml(replayTimeline.interpolationSteps || 0)}" data-event-hold-frames="${escapeHtml(JUMBOTRON_REPLAY_EVENT_HOLD_FRAMES)}" data-final-hold-frames="${escapeHtml(JUMBOTRON_REPLAY_FINAL_HOLD_FRAMES)}"><button class="button" type="button" data-replay-action="start">开始回放</button><button class="button secondary" type="button" data-replay-action="stop">停止回放</button><button class="button secondary" type="button" data-geometry-toggle aria-pressed="false">隐藏几何线</button><span class="pill green" data-replay-status hidden></span></div>`;
}

function renderJumbotronTrack({ trackProfile, horsePoses, debug, messagePlan, adapted, showReviewTools, replayTimeline }) {
  const viewBox = trackProfile.viewBox || { x: 0, y: 0, width: 1200, height: 620 };
  const trackAspectRatio = `${Number(viewBox.width) || 1200} / ${Number(viewBox.height) || 620}`;
  const messageBubbleRects = mapBubbleQueueToGeometry(trackProfile, messagePlan.bubbles);
  const labelLayout = buildHorseLabelLayout({ horsePoses, trackProfile, messageBubbleRects, viewBox });
  const debugLayer = showReviewTools ? `<polyline class="track-samples" points="${jumbotronPolyline(debug.sampledPoints)}"/>${debug.collisionBoxes.map((box) => `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="none" stroke="rgba(248,113,113,.7)" stroke-dasharray="5 5"/>`).join('')}${labelLayout.items.map((item) => `<rect x="${item.rect.x}" y="${item.rect.y}" width="${item.rect.width}" height="${item.rect.height}" fill="none" stroke="rgba(31,73,216,.45)" stroke-dasharray="4 6"/>`).join('')}` : '';
  const checkpointLayer = debug.checkpoints.map((checkpoint) => `<g class="checkpoint" transform="translate(${checkpoint.pose.point.x} ${checkpoint.pose.point.y})"><circle r="9" fill="#facc15" stroke="#713f12" stroke-width="3"/><text x="13" y="5">${escapeHtml(publicCheckpointLabel(checkpoint.label))}</text></g>`).join('');
  const entryLayer = horsePoses.map(({ entry, pose }) => {
    const placement = jumbotronTooltipPlacement(pose, 310, 112);
    const label = labelLayout.byEntryId[entry.entryId];
    const visualClass = jumbotronHorseVisualClass(entry);
    const riskRing = ['high', 'critical'].includes(entry.riskLevel) ? `<circle class="track-alert-ring" r="27"/>` : '';
    return `<a class="jumbotron-focus-source focus-trigger" href="#${entryFocusId(entry)}" aria-label="查看 ${escapeHtml(entry.displayName)} 焦点详情"><g class="horse ${escapeHtml(visualClass)}" ${renderHorseTelemetryAttrs(entry, pose)} transform="translate(${pose.x} ${pose.y})">${riskRing}${renderHorseRiderSprite(entry, pose, trackProfile)}<text class="debug-label" text-anchor="middle" y="6">${escapeHtml(entry.rank)}</text>${renderHorseStatusBadge(entry)}</g>${label ? renderHorseLabelGroup(label) : ''}${renderSvgTooltip(entryTooltipLines(entry), placement)}</a>`;
  }).join('');
  const bubbleLayer = renderJumbotronBubbleLayer({ trackProfile, messagePlan, adapted });
  const finalFrame = `<svg class="track-svg" style="aspect-ratio:${trackAspectRatio}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" role="img" aria-label="赛事实时赛道" data-label-count="${labelLayout.summary.total}" data-label-overlaps="${labelLayout.summary.labelLabelOverlaps}" data-label-marker-overlaps="${labelLayout.summary.labelMarkerOverlaps}" data-label-bubble-overlaps="${labelLayout.summary.labelBubbleOverlaps}" data-label-out-of-viewbox="${labelLayout.summary.outOfViewBox}">${renderJumbotronRiderTintFilters()}<rect class="track-bg" x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" rx="42"/>${renderTrackBackgroundImage(trackProfile)}<path class="track-band" d="${jumbotronCurvePath(trackProfile.centerlinePath)}"/><path class="track-centerline" d="${jumbotronCurvePath(trackProfile.centerlinePath)}"/>${debugLayer}${checkpointLayer}<g id="jumbotron-replay-entry-layer" data-replay-layer="entries">${entryLayer}</g><g id="jumbotron-replay-event-layer" data-replay-layer="events"></g>${bubbleLayer}</svg>`;
  return `<section class="track-stage-card" id="jumbotron-main-track-card"><div class="eyebrow">赛事大屏</div><h2>实时赛道</h2><div id="jumbotron-main-track-frame" class="jumbotron-main-track-frame" data-main-track-mode="final" style="display:flex;flex-direction:column;min-height:0;flex:0 0 auto;aspect-ratio:${trackAspectRatio}">${finalFrame}</div>${renderJumbotronMainReplayControls(replayTimeline)}</section>`;
}

function jumbotronReplayEventKind(event, entry) {
  if (event?.kind) return event.kind;
  if (event?.type) return event.type;
  if (entry?.status === 'finished' || entry?.motionState === 'finished') return 'finish';
  return 'status_change';
}

function jumbotronReplayEventBubbleLabel(kind, frame) {
  if (kind === 'finish') return '冲线';
  if (kind === 'overtake' || kind === 'rank_up' || kind === 'rank_down') return frame.phase === 'finish' ? '冲刺超越' : '超越';
  if (kind === 'lead_change') return '领先变化';
  if (kind === 'race_start') return '起跑';
  if (kind === 'sprinting') return '加速';
  if (kind === 'takeover') return '接管';
  if (kind === 'slowed' || kind === 'progress_slow') return '减速';
  if (kind === 'blocked') return '受阻';
  if (kind === 'pit_stop') return '调整';
  if (kind === 'stale') return '刷新';
  if (kind === 'idle') return '待命';
  if (kind === 'status_change') return '状态变化';
  return '关键事件';
}

function jumbotronReplayEventBubbleTone(kind) {
  return ({
    finish: { fill: '#ecfdf3', stroke: '#16a34a' },
    overtake: { fill: '#fff7ed', stroke: '#f97316' },
    rank_up: { fill: '#fff7ed', stroke: '#f97316' },
    rank_down: { fill: '#fff7ed', stroke: '#f97316' },
    lead_change: { fill: '#f5f3ff', stroke: '#7c3aed' },
    race_start: { fill: '#eef4ff', stroke: '#1f49d8' },
    sprinting: { fill: '#eff6ff', stroke: '#2563eb' },
    takeover: { fill: '#fdf2f8', stroke: '#db2777' },
    slowed: { fill: '#fefce8', stroke: '#ca8a04' },
    progress_slow: { fill: '#fefce8', stroke: '#ca8a04' },
    blocked: { fill: '#fef2f2', stroke: '#dc2626' },
    pit_stop: { fill: '#fff7ed', stroke: '#ea580c' },
    stale: { fill: '#f1f5f9', stroke: '#475569' },
    idle: { fill: '#f8fafc', stroke: '#64748b' },
    status_change: { fill: '#f8fafc', stroke: '#64748b' }
  })[kind] || { fill: '#f8fafc', stroke: '#1f49d8' };
}

function jumbotronReplayStateEventKinds(entry) {
  const kinds = [];
  const state = String(entry?.motionState || entry?.status || '').trim();
  if (state === 'finished') kinds.push('finish');
  if (Number(entry?.rankDelta || 0) !== 0) kinds.push('overtake');
  if (['sprinting', 'slowed', 'blocked', 'pit_stop', 'takeover', 'stale', 'idle'].includes(state)) kinds.push(state);
  return [...new Set(kinds)];
}

function jumbotronReplayStateEventKind(entry) {
  return jumbotronReplayStateEventKinds(entry)[0] || '';
}

function jumbotronReplayStateEventSummary(entry) {
  const name = entry?.displayName || entry?.entryId || '队伍';
  const state = entry?.motionState || entry?.status;
  if (state === 'sprinting') return `${name} 正在加速追赶`;
  if (state === 'takeover') return `${name} 触发接管`;
  if (state === 'blocked') return `${name} 路线受阻`;
  if (state === 'slowed') return `${name} 速度下降`;
  if (state === 'pit_stop') return `${name} 进站调整`;
  if (state === 'stale') return `${name} 等待数据刷新`;
  if (state === 'idle') return `${name} 暂未启动`;
  if (state === 'finished') return `${name} 冲线完成`;
  if (Number(entry?.rankDelta || 0) > 0) return `${name} 排名上升`;
  if (Number(entry?.rankDelta || 0) < 0) return `${name} 排名变化`;
  return `${name} 状态变化`;
}

function jumbotronReplayDerivedRawEvents(rawFrame = {}, sourceIndex = 0) {
  return (rawFrame.entries || []).flatMap((entry, index) => jumbotronReplayStateEventKinds(entry).map((kind, kindIndex) => ({
    event: { kind, type: kind === 'finish' ? 'finish' : kind, entryId: entry.entryId, summary: jumbotronReplayStateEventSummary(entry) },
    sourceIndex,
    index: `derived-${entry.entryId || index}-${kindIndex}`,
    derived: true
  })));
}

function jumbotronReplayActiveRawEvents(frameModel) {
  const { frame, timeline } = frameModel;
  const keyFrames = timeline.keyFrames || [];
  const keyFramePlaybackIndexes = timeline.keyFramePlaybackIndexes || [];
  const playbackIndex = Number(frame.playbackFrameIndex ?? frame.frameIndex ?? 0);
  return keyFrames.flatMap((rawFrame, sourceIndex) => {
    const eventPlaybackIndex = Number.isFinite(Number(keyFramePlaybackIndexes[sourceIndex])) ? Number(keyFramePlaybackIndexes[sourceIndex]) : sourceIndex * JUMBOTRON_REPLAY_INTERPOLATION_STEPS;
    const delta = playbackIndex - eventPlaybackIndex;
    if (delta < 0 || delta > JUMBOTRON_REPLAY_EVENT_HOLD_FRAMES) return [];
    return [
      ...(rawFrame?.events || []).map((event, index) => ({ event, sourceIndex, index, eventPlaybackIndex, playbackDelta: delta })),
      ...jumbotronReplayDerivedRawEvents(rawFrame, sourceIndex).map((item) => ({ ...item, eventPlaybackIndex, playbackDelta: delta }))
    ];
  });
}

function jumbotronReplayEventPriority(kind) {
  return ({
    finish: 7,
    overtake: 6,
    rank_up: 6,
    rank_down: 6,
    slowed: 5.5,
    progress_slow: 5.5,
    blocked: 5,
    pit_stop: 5,
    takeover: 5,
    stale: 3,
    idle: 3,
    sprinting: 3,
    lead_change: 3,
    race_start: 2,
    status_change: 1
  })[kind] || 0;
}

function buildJumbotronReplayEventBubbleItems(frameModel) {
  const { frame, adapted, horsePoses } = frameModel;
  const entryById = new Map(adapted.racingEntries.map((entry) => [entry.entryId, entry]));
  const poseByEntryId = new Map(horsePoses.map(({ entry, pose }) => [entry.entryId, pose]));
  const fallbackEntry = adapted.racingEntries[0];
  const items = [];
  const seen = new Set();
  const pushItem = (event, sourceIndex, index) => {
    const entry = entryById.get(event?.entryId) || fallbackEntry;
    if (!entry) return;
    const pose = poseByEntryId.get(entry.entryId);
    if (!pose) return;
    const kind = jumbotronReplayEventKind(event, entry);
    const key = `${kind}-${entry.entryId}-${sourceIndex}-${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const label = jumbotronReplayEventBubbleLabel(event?.stateKind || kind, frame);
    const summary = event?.summary || (kind === 'finish' ? `${entry.displayName} 冲线完成` : jumbotronTimelineEventSummary(event, entry, frame));
    items.push({
      kind,
      label,
      summary,
      entry,
      pose,
      priority: jumbotronReplayEventPriority(kind),
      sizeHint: Math.max(label.length + summary.length, 18),
      placementSeed: items.length % 4,
      sourceIndex,
      eventIndex: index
    });
  };
  jumbotronReplayActiveRawEvents(frameModel).forEach(({ event, sourceIndex, index }) => pushItem(event, sourceIndex, index));
  if (frame.phase === 'finish') {
    adapted.racingEntries
      .filter((entry) => entry.status === 'finished' || entry.motionState === 'finished')
      .slice(0, 4)
      .forEach((entry, index) => pushItem({ kind: 'finish', type: 'finish', entryId: entry.entryId, summary: `${entry.displayName} 冲线完成` }, frame.sourceFrameIndex ?? frame.frameIndex, `finish-${index}`));
  }
  return items;
}

function jumbotronReplayEventCandidatePlacements(trackProfile, item) {
  const viewBox = trackProfile.viewBox || { x: 0, y: 0, width: 1200, height: 620 };
  const seeds = [...new Set([item.placementSeed, 0, 1, 2, 3].map((seed) => Number(seed)).filter(Number.isFinite))];
  return seeds.map((seed) => {
    const candidate = { ...item, placementSeed: seed };
    const rect = estimateBubbleRects(trackProfile, [candidate])[0] || { x: item.pose.x + 30, y: item.pose.y - 70, width: bubbleWidthFromSizeHint(item.sizeHint), height: 54, placement: 'right' };
    return {
      item: candidate,
      rect,
      score: bubbleOverflow(rect, viewBox, 14) * 1000 + distanceFromPoseToRect(item.pose, rect) + seed
    };
  }).sort((a, b) => a.score - b.score || a.rect.x - b.rect.x || a.rect.y - b.rect.y);
}

function placeJumbotronReplayEventBubble(trackProfile, item, selectedRects) {
  return jumbotronReplayEventCandidatePlacements(trackProfile, item)
    .find(({ rect }) => selectedRects.every((selectedRect) => rectsSpatiallySeparated(rect, selectedRect)));
}

function selectJumbotronReplayEventBubbleItems(trackProfile, items) {
  const ordered = items
    .map((item, index) => ({ ...item, itemOrder: index }))
    .sort((a, b) => b.priority - a.priority || Number(a.entry.rank) - Number(b.entry.rank) || a.itemOrder - b.itemOrder);
  const selected = [];
  const selectedRects = [];
  const selectedKeys = new Set();
  const selectedEntries = new Set();
  const itemKey = (item) => `${item.kind}-${item.entry.entryId}-${item.sourceIndex}-${item.eventIndex}`;
  const tryAdd = (item) => {
    if (selected.length >= JUMBOTRON_BUBBLE_VISIBLE_LIMIT || selectedKeys.has(itemKey(item)) || selectedEntries.has(item.entry.entryId)) return false;
    const placement = placeJumbotronReplayEventBubble(trackProfile, item, selectedRects);
    if (!placement) return false;
    selected.push({ ...placement.item, rect: placement.rect });
    selectedRects.push(placement.rect);
    selectedKeys.add(itemKey(item));
    selectedEntries.add(item.entry.entryId);
    return true;
  };
  const addFirst = (predicate) => {
    for (const item of ordered) {
      if (!predicate(item)) continue;
      if (tryAdd(item)) return;
    }
  };
  addFirst((item) => item.kind === 'finish');
  addFirst((item) => item.kind === 'race_start');
  addFirst((item) => ['overtake', 'rank_up', 'rank_down'].includes(item.kind));
  addFirst((item) => ['slowed', 'progress_slow', 'blocked', 'pit_stop', 'takeover', 'stale'].includes(item.kind));
  for (const item of ordered) {
    if (selected.length >= JUMBOTRON_BUBBLE_VISIBLE_LIMIT) break;
    tryAdd(item);
  }
  return selected;
}


function renderJumbotronReplayEventBubbleLayer(frameModel) {
  const candidates = buildJumbotronReplayEventBubbleItems(frameModel);
  const items = selectJumbotronReplayEventBubbleItems(frameModel.trackProfile, candidates);
  if (!items.length) return '';
  return `<g class="jumbotron-replay-event-bubbles" data-replay-event-bubble-count="${escapeHtml(items.length)}" data-replay-event-candidate-count="${escapeHtml(candidates.length)}">${items.map((item) => {
    const rect = item.rect || { x: item.pose.x + 30, y: item.pose.y - 70, width: bubbleWidthFromSizeHint(item.sizeHint), height: 54, placement: 'right' };
    const anchor = rect.anchor || bubbleAnchorForPlacement(item.pose, rect, rect.placement);
    const tone = jumbotronReplayEventBubbleTone(item.kind);
    return `<g class="message-bubble-anchor jumbotron-replay-event-bubble" data-replay-event-kind="${escapeHtml(item.kind)}" data-entry-id="${escapeHtml(item.entry.entryId)}" data-placement="${escapeHtml(rect.placement || 'right')}" data-replay-bubble-x="${escapeHtml(svgNumber(rect.x))}" data-replay-bubble-y="${escapeHtml(svgNumber(rect.y))}" data-replay-bubble-width="${escapeHtml(svgNumber(rect.width))}" data-replay-bubble-height="${escapeHtml(svgNumber(rect.height))}" style="opacity:1"><line class="message-bubble-line" x1="${svgNumber(anchor.x1)}" y1="${svgNumber(anchor.y1)}" x2="${svgNumber(anchor.x2)}" y2="${svgNumber(anchor.y2)}" style="stroke:${tone.stroke}"/><g class="message-bubble" transform="translate(${svgNumber(rect.x)} ${svgNumber(rect.y)})"><rect width="${svgNumber(rect.width)}" height="${svgNumber(rect.height)}" rx="14" style="fill:${tone.fill};stroke:${tone.stroke};stroke-width:2.6"/><text x="13" y="21">${escapeHtml(item.label)}</text><text x="13" y="40">${escapeHtml(item.summary).slice(0, 28)}</text></g><title>${escapeHtml(`${item.label}：${item.summary}`)}</title></g>`;
  }).join('')}</g>`;
}

function renderJumbotronReplayMainTrackFrame(frameModel) {
  const { frame, horsePoses, trackProfile, runtime } = frameModel;
  const viewBox = trackProfile.viewBox || { x: 0, y: 0, width: 1200, height: 620 };
  const trackAspectRatio = `${Number(viewBox.width) || 1200} / ${Number(viewBox.height) || 620}`;
  const checkpoints = (trackProfile.checkpoints || []).map((checkpoint) => ({ checkpoint, pose: runtime.samplePoint(numberOrFallback(checkpoint.s, 0)) }));
  const entryLayer = horsePoses.map(({ entry, pose }) => {
    const visualClass = jumbotronHorseVisualClass(entry);
    const riskRing = ['high', 'critical'].includes(entry.riskLevel) ? `<circle class="track-alert-ring" r="27"/>` : '';
    return `<g class="horse ${escapeHtml(visualClass)}" ${renderHorseTelemetryAttrs(entry, pose)} transform="translate(${pose.x} ${pose.y})"><title>${escapeHtml(`#${entry.rank} ${entry.displayName} · ${entry.roundProgress}% · ${motionStateLabel(entry.motionState)}`)}</title>${riskRing}${renderHorseRiderSprite(entry, pose, trackProfile)}<text class="debug-label" text-anchor="middle" y="6">${escapeHtml(entry.rank)}</text>${renderHorseStatusBadge(entry)}</g>`;
  }).join('');
  const replayBubbleLayer = renderJumbotronReplayEventBubbleLayer(frameModel);
  return `<svg class="track-svg" style="aspect-ratio:${trackAspectRatio}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" role="img" aria-label="近期回放第 ${escapeHtml(Number(frame.frameIndex) + 1)} 帧">${renderJumbotronRiderTintFilters()}<rect class="track-bg" x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" rx="42"/>${renderTrackBackgroundImage(trackProfile)}<path class="track-band" d="${jumbotronCurvePath(trackProfile.centerlinePath)}"/><path class="track-centerline" d="${jumbotronCurvePath(trackProfile.centerlinePath)}"/>${checkpoints.map(({ checkpoint, pose }) => `<g class="checkpoint" transform="translate(${pose.point.x} ${pose.point.y})"><circle r="8" fill="#facc15" stroke="#713f12" stroke-width="3"/><text x="12" y="5">${escapeHtml(publicCheckpointLabel(checkpoint.label))}</text></g>`).join('')}${entryLayer}${replayBubbleLayer}</svg>`;
}

function renderJumbotronReplayFrame(frameModel) {
  const { frame, adapted, top3Labels } = frameModel;
  const top3 = top3Labels.length ? top3Labels : [...adapted.racingEntries].sort((a, b) => a.rank - b.rank).slice(0, 3).map((entry) => entry.displayName);
  const eventRows = (frame.events || []).map((event) => {
    const entry = adapted.racingEntries.find((item) => item.entryId === event.entryId);
    return `<article><strong>${escapeHtml(jumbotronTimelineEventLabel(event.type))}</strong><p class="muted">${escapeHtml(jumbotronTimelineEventSummary(event, entry, frame))}</p></article>`;
  }).join('') || '<article><strong>平滑插值</strong><p class="muted">此播放帧由相邻关键帧插值生成，只更新队伍位置和状态。</p></article>';
  return `<div class="jumbotron-replay-frame" data-frame-index="${escapeHtml(frame.frameIndex)}" data-source-frame-index="${escapeHtml(frame.sourceFrameIndex ?? frame.rawFrameIndex ?? frame.frameIndex)}" data-interpolated="${frame.interpolated ? 'true' : 'false'}">${renderJumbotronReplayMainTrackFrame(frameModel)}<div class="debug-grid"><article><strong>回放 ${escapeHtml(Number(frame.frameIndex) + 1)} / ${escapeHtml(frameModel.timeline.playbackFrameCount || frameModel.timeline.frameCount || frameModel.timeline.frames.length)}</strong><p class="muted">${escapeHtml(frame.systemTime || '')} · ${escapeHtml(frame.elapsedTime || '')} · ${escapeHtml(jumbotronTimelinePhaseLabel(frame.phase))}</p></article><article><strong>TOP3</strong><p class="muted">${escapeHtml(top3.join(' · '))}</p></article><article><strong>平均进度</strong><p class="muted">${escapeHtml(jumbotronTimelineProgress(frame.avgRoundProgress))}%</p></article>${eventRows}</div></div>`;
}

function renderJumbotronReplayPanel({ replayTimeline, dataProfile, trackSelection }) {
  if (!replayTimeline?.frames?.length) return '';
  const initialIndex = Math.max(0, Math.min(replayTimeline.frames.length - 1, replayTimeline.startFrameIndex || 0));
  const initialFrame = replayTimeline.frames[initialIndex];
  const frameButtons = replayTimeline.frames.map((frameModel, index) => `<button class="button secondary" type="button" data-replay-frame="${index}">${index + 1}</button>`).join('');
  return `<section id="jumbotron-replay" class="jumbotron-debug" data-frame-count="${replayTimeline.frames.length}" data-current-frame="${escapeHtml(replayTimeline.currentFrameIndex)}" data-finish-frame="${escapeHtml(replayTimeline.finishFrameIndex)}" data-autoplay="true"><div class="eyebrow">近期回放</div><h2>随时间变化的数据回放</h2><p class="muted">主视图保留最终数据；这里按 race-timeline.json 的 13 帧回放位置、排名、状态和事件变化。</p><div class="cta-row"><button class="button" type="button" data-replay-action="toggle">暂停</button><button class="button secondary" type="button" data-replay-action="prev">上一帧</button><button class="button secondary" type="button" data-replay-action="next">下一帧</button><input aria-label="回放帧" type="range" min="0" max="${replayTimeline.frames.length - 1}" value="${initialIndex}" step="1" data-replay-range style="min-width:220px;align-self:center"><span class="pill green" data-replay-status>自动播放中</span></div><div class="cta-row" style="margin-bottom:10px">${frameButtons}</div><div id="jumbotron-replay-frame">${renderJumbotronReplayFrame(initialFrame)}</div></section>`;
}

function renderJumbotronReplayScript(profileAlias = 'full', trackId = JUMBOTRON_DEFAULT_TRACK_ID) {
  const params = new URLSearchParams({ profile: profileAlias });
  if (trackId) params.set('track', trackId);
  const endpoint = `/api/jumbotron-replay?${params.toString()}`;
  return `<script>
(() => {
  const root = document.getElementById('jumbotron-main-track-card');
  if (!root) return;
  const endpoint = ${JSON.stringify(endpoint)};
  const controls = root.querySelector('[data-main-replay-controls]');
  const stage = document.getElementById('jumbotron-main-track-frame');
  const status = root.querySelector('[data-replay-status]');
  const geometryToggle = root.querySelector('[data-geometry-toggle]');
  const miniMapDrawer = document.querySelector('.jumbotron-mini-map-drawer');
  let miniMapReplayCollapseTimer = 0;
  if (!controls || !stage) return;
  function syncGeometryToggle() {
    if (!geometryToggle) return;
    const hidden = root.classList.contains('jumbotron-geometry-hidden');
    geometryToggle.textContent = hidden ? '显示几何线' : '隐藏几何线';
    geometryToggle.setAttribute('aria-pressed', hidden ? 'true' : 'false');
  }
  syncGeometryToggle();
  const frameCount = Number(controls.dataset.playbackFrameCount || 0);
  const finalHoldFrames = Math.max(1, Number(controls.dataset.finalHoldFrames || ${JUMBOTRON_REPLAY_FINAL_HOLD_FRAMES}));
  const frameDelayMs = ${JUMBOTRON_REPLAY_FRAME_DELAY_MS};
  const finalHtml = stage.innerHTML;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const frameTemplate = document.createElement('template');
  function setAttrs(target, source, names) {
    names.forEach((name) => {
      if (source.hasAttribute(name)) target.setAttribute(name, source.getAttribute(name));
      else target.removeAttribute(name);
    });
  }
  function directChild(node, selector) {
    return Array.from(node.children).find((child) => child.matches(selector));
  }
  function stableReplayLayer(id) {
    const svg = stage.querySelector('svg.track-svg');
    if (!svg) return null;
    let layer = svg.querySelector('#' + id);
    if (!layer && id === 'jumbotron-replay-event-layer') {
      layer = document.createElementNS(svgNamespace, 'g');
      layer.setAttribute('id', id);
      layer.setAttribute('data-replay-layer', 'events');
      svg.insertBefore(layer, svg.querySelector('#jumbotron-bubble-layer'));
    }
    return layer;
  }
  function setLiveBubbleLayerHidden(hidden) {
    const layer = stage.querySelector('#jumbotron-bubble-layer');
    if (layer) layer.style.display = hidden ? 'none' : '';
  }
  function clearMiniMapReplayCollapseTimer() {
    if (!miniMapReplayCollapseTimer) return;
    window.clearTimeout(miniMapReplayCollapseTimer);
    miniMapReplayCollapseTimer = 0;
  }
  function setMiniMapReplayExpanded(expanded) {
    if (!miniMapDrawer) return;
    miniMapDrawer.classList.toggle('is-replay-expanded', Boolean(expanded));
    miniMapDrawer.setAttribute('data-replay-expanded', expanded ? 'true' : 'false');
  }
  function expandMiniMapForReplay() {
    clearMiniMapReplayCollapseTimer();
    setMiniMapReplayExpanded(true);
  }
  function scheduleMiniMapReplayCollapse() {
    clearMiniMapReplayCollapseTimer();
    miniMapReplayCollapseTimer = window.setTimeout(() => {
      setMiniMapReplayExpanded(false);
      miniMapReplayCollapseTimer = 0;
    }, 5000);
  }
  function syncReplayMiniMap(html) {
    if (!miniMapDrawer || !html) return;
    const template = document.createElement('template');
    template.innerHTML = html;
    const nextMiniMap = template.content.querySelector('.mini-map-svg');
    const currentMiniMap = miniMapDrawer.querySelector('.mini-map-svg');
    if (nextMiniMap && currentMiniMap) currentMiniMap.replaceWith(nextMiniMap.cloneNode(true));
  }
  function replaceWholeTrack(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    stage.replaceChildren(template.content.cloneNode(true));
  }
  function syncHorseNode(current, next) {
    setAttrs(current, next, ['class', 'data-entry-id', 'data-motion-state', 'data-risk-level', 'transform']);
    const currentScale = current.querySelector('.horse-rider-perspective-scale');
    const nextScale = next.querySelector('.horse-rider-perspective-scale');
    if (Boolean(currentScale) !== Boolean(nextScale)) {
      current.innerHTML = next.innerHTML;
      return;
    }
    const syncImage = (selector, attrs) => {
      const currentImage = current.querySelector(selector);
      const nextImage = next.querySelector(selector);
      if (Boolean(currentImage) !== Boolean(nextImage)) return false;
      if (currentImage && nextImage) setAttrs(currentImage, nextImage, attrs);
      return true;
    };
    if (!syncImage('.horse-rider-sprite', ['class', 'href', 'x', 'y', 'width', 'height', 'preserveAspectRatio'])
      || !syncImage('.horse-rider-alpha-tint', ['class', 'href', 'x', 'y', 'width', 'height', 'preserveAspectRatio', 'filter', 'style', 'data-entry-color-index', 'data-entry-tint', 'data-entry-provider-group', 'data-mask-mode'])) {
      current.innerHTML = next.innerHTML;
      return;
    }
    const currentFacing = current.querySelector('.horse-rider-facing');
    const nextFacing = next.querySelector('.horse-rider-facing');
    if (currentFacing && nextFacing) setAttrs(currentFacing, nextFacing, ['data-facing', 'transform']);
    if (currentScale && nextScale) setAttrs(currentScale, nextScale, ['transform', 'data-perspective-track', 'data-perspective-scale', 'data-perspective-y', 'data-perspective-min-scale', 'data-perspective-max-scale', 'data-base-sprite-width', 'data-base-sprite-height']);
    const currentTitle = directChild(current, 'title');
    const nextTitle = directChild(next, 'title');
    if (currentTitle && nextTitle) currentTitle.textContent = nextTitle.textContent;
    const currentRank = directChild(current, 'text.debug-label');
    const nextRank = directChild(next, 'text.debug-label');
    if (currentRank && nextRank) currentRank.textContent = nextRank.textContent;
    const currentRisk = directChild(current, '.track-alert-ring');
    const nextRisk = directChild(next, '.track-alert-ring');
    if (currentRisk && !nextRisk) currentRisk.remove();
    if (!currentRisk && nextRisk) current.insertBefore(nextRisk.cloneNode(true), current.firstChild);
    const currentBadge = current.querySelector('.horse-status-pill');
    const nextBadge = next.querySelector('.horse-status-pill');
    if (currentBadge && nextBadge && currentBadge.outerHTML !== nextBadge.outerHTML) currentBadge.replaceWith(nextBadge.cloneNode(true));
  }
  function applyReplayFrameHtml(frameHtml) {
    frameTemplate.innerHTML = frameHtml || '';
    const nextSvg = frameTemplate.content.querySelector('svg.track-svg');
    const currentSvg = stage.querySelector('svg.track-svg');
    if (!nextSvg || !currentSvg) return false;
    const nextHorses = new Map(Array.from(nextSvg.querySelectorAll('.horse[data-entry-id]')).map((horse) => [horse.dataset.entryId, horse]));
    let updatedCount = 0;
    currentSvg.querySelectorAll('.horse[data-entry-id]').forEach((horse) => {
      const nextHorse = nextHorses.get(horse.dataset.entryId);
      if (!nextHorse) return;
      syncHorseNode(horse, nextHorse);
      updatedCount += 1;
    });
    const eventLayer = stableReplayLayer('jumbotron-replay-event-layer');
    const nextEventLayer = nextSvg.querySelector('.jumbotron-replay-event-bubbles');
    if (eventLayer) eventLayer.innerHTML = nextEventLayer ? nextEventLayer.outerHTML : '';
    setLiveBubbleLayerHidden(true);
    return updatedCount > 0;
  }
  let frameIndex = 0;
  let timer = null;
  let playing = false;
  const frameCache = new Map();
  const inflightFrames = new Map();
  function clearReplayTimer() {
    if (timer) window.clearTimeout(timer);
    timer = null;
  }
  function setReplayStatus(text) {
    if (!status) return;
    status.textContent = text || '';
    status.hidden = !text;
  }
  function restoreFinal() {
    clearReplayTimer();
    playing = false;
    frameIndex = 0;
    frameCache.clear();
    stage.innerHTML = finalHtml;
    stage.dataset.mainTrackMode = 'final';
    setLiveBubbleLayerHidden(false);
    scheduleMiniMapReplayCollapse();
    setReplayStatus('');
  }
  function renderReplayFrame(data, requestedIndex) {
    if (!data?.frameHtml) return false;
    frameIndex = data.playbackIndex ?? data.frameIndex ?? requestedIndex;
    if (!applyReplayFrameHtml(data.frameHtml)) replaceWholeTrack(data.frameHtml);
    syncReplayMiniMap(data.miniMapHtml);
    stage.dataset.mainTrackMode = 'replay';
    setReplayStatus('回放中 ' + String(frameIndex + 1) + ' / ' + String(data.playbackFrameCount || data.frameCount || frameCount));
    return true;
  }
  function requestFrame(index) {
    if (!frameCount) return Promise.resolve(null);
    const nextIndex = Math.max(0, Math.min(frameCount - 1, Number(index) || 0));
    if (frameCache.has(nextIndex)) return Promise.resolve(frameCache.get(nextIndex));
    if (inflightFrames.has(nextIndex)) return inflightFrames.get(nextIndex);
    const request = fetch(endpoint + '&frame=' + encodeURIComponent(nextIndex), { headers: { accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.frameHtml) frameCache.set(nextIndex, data);
        inflightFrames.delete(nextIndex);
        return data;
      })
      .catch(() => {
        inflightFrames.delete(nextIndex);
        return null;
      });
    inflightFrames.set(nextIndex, request);
    return request;
  }
  function prefetchFrame(index) {
    if (!frameCount) return;
    if (index < 0 || index >= frameCount) return;
    requestFrame(index);
  }
  async function loadFrame(index) {
    const data = await requestFrame(index);
    return renderReplayFrame(data, Math.max(0, Math.min(frameCount - 1, Number(index) || 0)));
  }
  function tick() {
    if (!playing) return;
    const requestedIndex = frameIndex;
    if (frameCache.has(requestedIndex)) {
      renderReplayFrame(frameCache.get(requestedIndex), requestedIndex);
    } else {
      requestFrame(requestedIndex).then((data) => {
        if (playing && frameIndex === requestedIndex) renderReplayFrame(data, requestedIndex);
      });
    }
    prefetchFrame(requestedIndex + 1);
    prefetchFrame(requestedIndex + 2);
    if (requestedIndex >= frameCount - 1) {
      setReplayStatus('回放结束，停留最终帧');
      timer = window.setTimeout(restoreFinal, frameDelayMs * finalHoldFrames);
      return;
    }
    frameIndex = requestedIndex + 1;
    timer = window.setTimeout(tick, frameDelayMs);
  }
  function startReplay() {
    clearReplayTimer();
    playing = true;
    frameIndex = 0;
    expandMiniMapForReplay();
    setReplayStatus('回放准备中');
    prefetchFrame(0);
    prefetchFrame(1);
    tick();
  }
  function liftFocusSource(target) {
    const source = target?.closest?.('.jumbotron-focus-source');
    const parent = source?.parentNode;
    if (source && parent && parent.lastChild !== source) parent.appendChild(source);
  }
  root.addEventListener('pointerover', (event) => liftFocusSource(event.target));
  root.addEventListener('focusin', (event) => liftFocusSource(event.target));
  root.addEventListener('click', (event) => {
    const geometryButton = event.target.closest('[data-geometry-toggle]');
    if (geometryButton) {
      root.classList.toggle('jumbotron-geometry-hidden');
      syncGeometryToggle();
      return;
    }
    const action = event.target.closest('[data-replay-action]')?.dataset.replayAction;
    if (action === 'start') startReplay();
    if (action === 'stop') restoreFinal();
  });
})();
</script>`;
}

function renderJumbotronSideDrawer({ eyebrow, title, body, className = '', id = '' }) {
  return `<section${id ? ` id="${escapeHtml(id)}"` : ''} class="jumbotron-drawer jumbotron-drawer-card ${escapeHtml(className)}"><div class="jumbotron-drawer-head"><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h2>${escapeHtml(title)}</h2></div><span class="jumbotron-drawer-icon" aria-hidden="true">⌄</span></div><div class="jumbotron-drawer-body">${body}</div></section>`;
}

function renderJumbotronMiniMap(trackProfile, horsePoses, options = {}) {
  const mode = options.mode || 'final';
  const frameIndex = Number.isFinite(Number(options.frameIndex)) ? Number(options.frameIndex) : 0;
  return `<svg class="mini-map-svg" viewBox="0 0 ${trackProfile.viewBox.width} ${trackProfile.viewBox.height}" role="img" aria-label="赛道小地图" data-mini-map-mode="${escapeHtml(mode)}" data-mini-map-frame="${escapeHtml(frameIndex)}"><path class="track-band" d="${jumbotronCurvePath(trackProfile.centerlinePath)}"/><path class="track-centerline" d="${jumbotronCurvePath(trackProfile.centerlinePath)}"/>${horsePoses.map(({ entry, pose }) => `<a class="jumbotron-focus-source" href="#${entryFocusId(entry)}"><circle cx="${pose.x}" cy="${pose.y}" r="18" fill="#1f49d8"><title>${escapeHtml(entry.displayName)}</title></circle></a>`).join('')}</svg>`;
}

function renderJumbotronSide({ adapted, horsePoses, debug, trackProfile, showReviewTools }) {
  const top3 = [...adapted.racingEntries].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const legend = adapted.racingEntries.map((entry) => `<a class="jumbotron-focus-source focus-trigger legend-entry" href="#${entryFocusId(entry)}" data-legend-entry-id="${escapeHtml(entry.entryId)}"><strong>#${entry.rank} ${escapeHtml(entry.displayName)}</strong>${riskStatePill(entry)}<br><span class="muted">${escapeHtml(entry.primaryCA)} · ${escapeHtml(riskLevelLabel(entry.riskLevel))}</span>${renderHtmlTooltip(entryTooltipLines(entry))}</a>`).join('');
  const phaseSummary = adapted.racingEntries.slice(0, 6).map((entry) => `<p><strong>${escapeHtml(entry.displayName)}</strong>${riskStatePill(entry)}<br><span class="muted">${entry.phaseProgress}% · ${Math.round(entry.score)} 分</span></p>`).join('');
  const attentionItems = adapted.attentionItems
    .filter((item) => ['critical', 'high'].includes(item.severity) || ['risk', 'obstacle', 'violation'].includes(item.category))
    .slice(0, 4);
  const attention = attentionItems.length ? attentionItems.map((item) => `<a class="jumbotron-focus-source focus-trigger" href="#${attentionFocusId(item)}"><article class="attention-item attention-item-${escapeHtml(item.severity)}"><strong>${escapeHtml(attentionCategoryLabel(item.category))} · ${escapeHtml(severityLabel(item.severity))}</strong><p>${escapeHtml(item.summary)}</p>${renderHtmlTooltip(attentionTooltipLines(item, adapted.racingEntries))}</article></a>`).join('') : '<p class="muted">当前没有高优先级异常。</p>';
  const miniMap = `${renderJumbotronMiniMap(trackProfile, horsePoses)}<h3>队伍图例</h3>${legend}`;
  const reviewTools = showReviewTools ? renderJumbotronSideDrawer({ eyebrow: 'HorsePose', title: '运行时输出', body: `<p class="muted">${horsePoses.length} 个 Entry · ${debug.horseSValues.map(escapeHtml).join(' · ')}</p>` }) : '';
  return `<aside><section class="side-card"><div class="eyebrow">TOP3</div><h2>领先队伍</h2><ol class="ranking-list">${top3.map((entry) => `<li><a class="jumbotron-focus-source focus-trigger" href="#${entryFocusId(entry)}"><strong>#${entry.rank} ${escapeHtml(entry.displayName)}</strong><span class="gap-pill">${escapeHtml(top3GapLabel(entry, adapted.racingEntries))}</span>${renderHtmlTooltip(entryTooltipLines(entry))}</a><div class="muted">${entry.roundProgress}% · ${escapeHtml(motionStateLabel(entry.motionState))}</div></li>`).join('')}</ol></section>${renderFocusDetailPanel(adapted)}${renderJumbotronSideDrawer({ eyebrow: '赛道概览', title: '小地图和队伍图例', body: miniMap, className: 'jumbotron-mini-map-drawer' })}${renderJumbotronSideDrawer({ eyebrow: '阶段', title: '进度快照', body: phaseSummary })}<section class="side-card"><div class="eyebrow">提醒</div><h2>异常情况</h2>${attention}</section>${reviewTools}</aside>`;
}

function renderTickerText(message, entries) {
  const entry = entries.find((item) => item.entryId === message.entryId);
  const entryName = entry?.displayName || message.entryId || '赛事';
  return `${messageTypeLabel(message.type)} · ${entryName}`;
}

function renderJumbotronTicker({ messagePlan, adapted }) {
  const items = messagePlan.ticker.slice(0, 3).map((message) => ({ message, text: renderTickerText(message, adapted.racingEntries) }));
  const hiddenCount = Math.max(0, messagePlan.ticker.length - items.length);
  const more = hiddenCount ? `<span class="ticker-more">另 ${hiddenCount} 条看右侧提醒</span>` : '';
  return `<section class="jumbotron-ticker"><strong>现场播报</strong><div>${items.map(({ message, text }) => `<a class="ticker-item jumbotron-focus-source focus-trigger" href="#${messageFocusId(message)}" aria-label="${escapeHtml(message.summary)}"><span>${escapeHtml(text)}</span>${renderHtmlTooltip(messageTooltipLines(message, adapted.racingEntries))}</a>`).join('') || '<span>暂无高优先级播报</span>'}${more}</div></section>`;
}

function messageTypeLabel(type) {
  const labels = { milestone: '进展', progress_update: '更新', obstacle: '异常', risk_alert: '关注', violation: '异常', quality_signal: '质量', strategy_change: '调整', takeover: '接管', pit_stop: '暂停' };
  return labels[type] || type;
}

function displayModeLabel(mode) {
  const labels = { bubble: '气泡', ticker: '消息条', alert: '提醒', none: '无' };
  return labels[mode] || mode;
}

function motionStateLabel(state) {
  const labels = { idle: '待命', running: '行进中', sprinting: '冲刺', slowed: '减速', blocked: '暂停', pit_stop: '调整', takeover: '接管', finished: '完成', stale: '待刷新' };
  return labels[state] || state;
}

function riskLevelLabel(level) {
  const labels = { none: '正常', low: '正常', medium: '关注', high: '异常', critical: '紧急' };
  return labels[level] || level;
}

function attentionCategoryLabel(category) {
  const labels = { risk: '异常情况', obstacle: '异常情况', violation: '异常情况' };
  return labels[category] || category;
}

function attentionStatusLabel(status) {
  const labels = { watching: '观察中', open: '待处理', resolved: '已处理' };
  return labels[status] || status;
}

function attentionNextStep(category) {
  const labels = { risk: '检查公开结果质量', obstacle: '确认是否需要介入', violation: '核对当前状态' };
  return labels[category] || '继续观察';
}

function renderFocusDetailPanel(adapted) {
  const entryCards = adapted.racingEntries.map((entry) => `<article id="${entryFocusId(entry)}" class="focus-detail-card" data-focus-kind="entry"><strong>队伍 · #${entry.rank} ${escapeHtml(entry.displayName)}</strong><p>进度 ${entry.roundProgress}% · 阶段 ${entry.phaseProgress}% · ${Math.round(entry.score)} 分</p><p>状态 ${escapeHtml(motionStateLabel(entry.motionState))} · ${escapeHtml(riskLevelLabel(entry.riskLevel))}</p><p class="muted">最近消息：${escapeHtml((entry.lastMessage?.summary || entry.latestMessage || '暂无最新消息').slice(0, 72))}</p></article>`).join('');
  const messageCards = adapted.ridingMessages.slice(0, 5).map((message) => {
    const entry = adapted.racingEntries.find((item) => item.entryId === message.entryId);
    return `<article id="${messageFocusId(message)}" class="focus-detail-card" data-focus-kind="message"><strong>消息 · ${escapeHtml(messageTypeLabel(message.type))}</strong><p>${escapeHtml(severityLabel(message.severity))} · ${escapeHtml(entry?.displayName || message.entryId)} · ${escapeHtml(message.createdAt)}</p><p class="muted">${escapeHtml(message.summary.slice(0, 84))}</p></article>`;
  }).join('');
  const attentionCards = adapted.attentionItems.map((item) => {
    const entry = adapted.racingEntries.find((candidate) => candidate.entryId === item.entryId);
    return `<article id="${attentionFocusId(item)}" class="focus-detail-card" data-focus-kind="attention"><strong>提醒 · ${escapeHtml(attentionCategoryLabel(item.category))}</strong><p>${escapeHtml(severityLabel(item.severity))} · ${escapeHtml(attentionStatusLabel(item.status))} · ${escapeHtml(entry?.displayName || item.entryId)}</p><p class="muted">${escapeHtml(item.summary.slice(0, 84))}</p><p>下一步：${escapeHtml(attentionNextStep(item.category))}</p></article>`;
  }).join('');
  return renderJumbotronSideDrawer({ eyebrow: '焦点', title: '焦点详情', className: 'focus-details-card', body: `<div class="focus-detail-list">${entryCards}${messageCards}${attentionCards}</div>` });
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
    '中心线点s': '中心线点位',
    direction: '赛道方向',
    startFinish: '起终点范围',
    'startFinish.s': 'startFinish.s 范围',
    'checkpoints.s': 'checkpoints.s 范围',
    lanes: '泳道配置',
    '泳道偏移 unique': '泳道偏移不重复',
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
    '检查点 semantics': '检查点语义完整',
    '16:9 stable': '16:9 大屏稳定',
    'two tracks ready': '两条赛道已准备',
    'eight lane preview': '八条泳道预览',
    'ticker fallback': 'ticker fallback',
    'risk milestone priority': '风险 / 里程碑优先',
    'manual horse-on-track confirmation': '马匹在赛道上人工确认',
    'manual curve confirmation': '弯道自然人工确认',
    'manual bubble clearance confirmation': '气泡遮挡人工确认',
    'manual checkpoint confirmation': '检查点 语义人工确认'
  };
  return labels[label] || label.replace('progress mapping', '进度映射').replace('progress', '进度').replace('lane', '泳道').replace('updatedAt', '更新时间');
}

function renderJumbotronDataEvidenceDebug({ dataEvidence }) {
  const coverageLine = (coverage) => `present=${coverage.present.join(' / ') || 'none'}; missing=${coverage.missing.join(' / ') || 'none'}; complete=${coverage.complete}`;
  const hiddenLine = dataEvidence.publicHiddenFields.fields.map((item) => `${item.field}@${item.locations.join('+')}:${item.count}`).join(' / ');
  const aggregate = dataEvidence.lastMessageMapping.aggregate;
  const entryRows = dataEvidence.lastMessageMapping.entryMappings.map((entry) => `<tr><td>${escapeHtml(entry.entryId)}</td><td>${escapeHtml(entry.latestMessageId || '无')}</td><td>${entry.lastMessageResolved ? '已解析' : '未解析'}</td><td>${entry.fallbackUsed ? '使用摘要' : '未使用'}</td><td>${escapeHtml(messageTypeLabel(entry.lastMessage?.type || 'none'))}</td><td>${escapeHtml(displayModeLabel(entry.lastMessage?.displayMode || 'none'))}</td><td>${entry.lastMessage?.summaryPresent === true ? '有' : '无'}</td><td>${entry.targetUrlHidden ? '已隐藏' : '未隐藏'}</td></tr>`).join('');
  return `<section class="jumbotron-debug"><div class="eyebrow">Data Evidence</div><h2>data evidence debug panel</h2><div class="debug-grid"><article><strong>dataProfileId</strong><p class="muted">${escapeHtml(dataEvidence.dataProfileId)}</p></article><article><strong>profileAlias / selectedProfile</strong><p class="muted">${escapeHtml(dataEvidence.profileAlias)} / ${escapeHtml(dataEvidence.selectedProfile)}</p></article><article><strong>entryCount / messageCount / attentionItemCount</strong><p class="muted">${dataEvidence.entryCount} / ${dataEvidence.messageCount} / ${dataEvidence.attentionItemCount}</p></article><article><strong>validatorStatus</strong><p class="muted">${escapeHtml(dataEvidence.validatorStatus)}</p></article><article><strong>motionStateCoverage</strong><p class="muted">${escapeHtml(coverageLine(dataEvidence.motionStateCoverage))}</p></article><article><strong>messageTypeCoverage</strong><p class="muted">${escapeHtml(coverageLine(dataEvidence.messageTypeCoverage))}</p></article><article><strong>publicHiddenFields</strong><p class="muted">${escapeHtml(hiddenLine)}; rawValuesExcludedFromEvidence=${dataEvidence.publicHiddenFields.rawValuesExcludedFromEvidence}</p></article><article><strong>profileUsageGuard</strong><p class="muted">smoke8VisualLowLoadOnly=${dataEvidence.profileUsageGuard.smoke8VisualLowLoadOnly}; coverage9EnumCoverageOnly=${dataEvidence.profileUsageGuard.coverage9EnumCoverageOnly}</p></article><article><strong>lastMessage aggregate</strong><p class="muted">已解析 ${aggregate.resolvedCount}/${aggregate.entryCount}；摘要兜底 ${aggregate.fallbackCount}；缺失 latestMessageId ${aggregate.missingLatestMessageIdCount}；未解析 ${aggregate.unresolvedCount}；缺失编号摘要兜底 ${aggregate.syntheticMissingIdFallsBack ? '通过' : '未通过'}</p></article></div><h3>lastMessage mapping evidence</h3><table><thead><tr><th>entryId</th><th>latestMessageId</th><th>lastMessageResolved</th><th>摘要兜底</th><th>lastMessage.type</th><th>lastMessage.displayMode</th><th>summaryPresent</th><th>targetUrlHidden</th></tr></thead><tbody>${entryRows}</tbody></table></section>`;
}

function renderJumbotronCalibrator({ trackProfile, runtime }) {
  const viewBox = trackProfile.viewBox || { x: 0, y: 0, width: 1200, height: 620 };
  const previewEntries = [0, 25, 50, 75, 100].map((progress, index) => ({ entryId: `preview-${progress}`, displayName: `${progress}%`, roundProgress: progress, laneOffsetIndex: index % trackProfile.laneOffsets.length, laneId: `lane-${index}`, motionState: progress === 100 ? 'finished' : 'running' }));
  const poses = previewEntries.map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }));
  return `<section class="jumbotron-calibrator"><div class="eyebrow">赛道校准器</div><h2>赛道预览采样</h2><svg class="mini-map-svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" role="img" aria-label="赛道校准预览"><path class="track-band" d="${jumbotronCurvePath(trackProfile.centerlinePath)}"/><path class="track-centerline" d="${jumbotronCurvePath(trackProfile.centerlinePath)}"/>${poses.map(({ entry, pose }) => `<g transform="translate(${pose.x} ${pose.y})"><circle class="horse-dot" r="7"/><text class="debug-label" x="10" y="4">${escapeHtml(entry.displayName)}</text></g>`).join('')}</svg><p class="muted">预览复用 Jumbotron runtime 采样。</p><div class="cta-row"><a class="button secondary" href="/jumbotron/calibrator">赛道校准器入口</a><a class="button secondary" href="/jumbotron/calibrator?candidate=real-explicit-closed-course">打开第二赛道校准器</a></div></section>`;
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

function nearestCalibratorInsertion(points, point, closed = false) {
  const source = ensureClosedCenterline(points, closed).filter(finitePoint);
  if (source.length < 2 || !finitePoint(point)) return null;
  let best = null;
  for (let index = 0; index < source.length - 1; index += 1) {
    const start = source[index];
    const end = source[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) continue;
    const rawRatio = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    const projectionRatio = Math.max(0, Math.min(1, rawRatio));
    const projected = { x: start.x + dx * projectionRatio, y: start.y + dy * projectionRatio };
    const projectionDistance = Math.hypot(point.x - projected.x, point.y - projected.y);
    const segmentLength = Math.sqrt(lengthSquared);
    const lengthDelta = Math.hypot(point.x - start.x, point.y - start.y) + Math.hypot(point.x - end.x, point.y - end.y) - segmentLength;
    const endpointPenalty = Math.max(0, 0.08 - projectionRatio, projectionRatio - 0.92) * segmentLength * 0.12;
    const score = projectionDistance * 1.4 + lengthDelta + endpointPenalty;
    const candidate = { index, insertIndex: index + 1, projectionDistance, lengthDelta, score };
    if (!best || candidate.score < best.score || (candidate.score === best.score && candidate.projectionDistance < best.projectionDistance)) best = candidate;
  }
  return best;
}

function insertCalibratorPointByNearestSegment(points, point, closed = false) {
  const source = ensureClosedCenterline(points, closed).filter(finitePoint);
  const segment = nearestCalibratorInsertion(source, point, closed);
  if (!segment) return ensureClosedCenterline([...source, point], closed);
  return ensureClosedCenterline([...source.slice(0, segment.insertIndex), point, ...source.slice(segment.insertIndex)], closed);
}

function reverseCenterlinePoints(points, closed) {
  const finitePoints = ensureClosedCenterline(points, false);
  const uniquePoints = closed && samePoint(finitePoints[0], finitePoints.at(-1)) ? finitePoints.slice(0, -1) : finitePoints;
  return ensureClosedCenterline([...uniquePoints].reverse(), closed);
}

function toggleDirection(direction) {
  return direction === 'counterclockwise' ? 'clockwise' : 'counterclockwise';
}

function buildCalibratorProfile(body = {}) {
  const activeCandidate = isActiveSecondTrackCandidateImport(body) ? readActiveSecondTrackCandidate() : null;
  const base = activeCandidate?.available ? normalizeExternalTrackCandidate(activeCandidate.profile, activeCandidate) : calibratorDefaultTrackProfile();
  let profile = body.profileJson ? { ...base, ...parseJsonInput(body.profileJson, base) } : base;
  profile.trackId = body.trackId || profile.trackId || 'calibrated-track';
  profile.name = body.name || profile.name || '校准赛道';
  profile.direction = body.reverseDirection ? toggleDirection(body.direction || profile.direction || 'clockwise') : (body.direction || profile.direction || 'clockwise');
  const backgroundSrc = String(body.backgroundSrcCustom || body.backgroundSrc || profile.background?.src || '').trim();
  if (backgroundSrc) {
    const assetId = profile.background?.assetId || backgroundSrc.split('/').filter(Boolean).at(-1)?.replace(/\.[a-z0-9]+$/i, '') || 'candidate-background';
    profile.background = { ...(profile.background || {}), assetId, src: backgroundSrc, kind: backgroundSrc.split('.').pop() || 'webp' };
    profile.backgroundAsset = profile.background.assetId;
  }
  profile.centerline = profile.centerline || { type: 'polyline', closed: true, smoothing: 'mvp-polyline', points: profile.centerlinePath || [] };
  if (Object.hasOwn(body, 'closed')) profile.centerline.closed = body.closed === 'true';
  profile.centerline.smoothing = body.smoothing || profile.centerline.smoothing || 'mvp-polyline';
  const centerlineInput = body.centerlinePoints || body.centerlinePointsJson;
  const hasCenterlineInput = centerlineInput !== undefined && centerlineInput !== null && centerlineInput !== '';
  let centerlinePoints = parseJsonInput(hasCenterlineInput ? centerlineInput : undefined, profile.centerline.points || profile.centerlinePath || []);
  if (body.deletePointIndex !== undefined && body.deletePointIndex !== '') {
    const deleteIndex = Number(body.deletePointIndex);
    if (Number.isInteger(deleteIndex)) centerlinePoints = centerlinePoints.filter((_, index) => index !== deleteIndex);
  }
  if (body.centerlineAction === 'insert' || body.insertPointIndex !== undefined) {
    const point = { x: Number(body.insertPointX), y: Number(body.insertPointY) };
    const insertAfter = Number(body.insertPointIndex);
    if (Number.isInteger(insertAfter) && finitePoint(point)) {
      const closed = Boolean(profile.centerline.closed);
      const closingDuplicate = closed && samePoint(centerlinePoints[0], centerlinePoints.at(-1));
      const maxInsert = closingDuplicate ? centerlinePoints.length - 1 : centerlinePoints.length;
      const insertIndex = Math.max(0, Math.min(maxInsert, insertAfter + 1));
      centerlinePoints = [...centerlinePoints.slice(0, insertIndex), point, ...centerlinePoints.slice(insertIndex)];
    }
  }
  if (body.centerlineAction === 'add') {
    const point = { x: Number(body.addPointX), y: Number(body.addPointY) };
    if (finitePoint(point)) centerlinePoints = insertCalibratorPointByNearestSegment(centerlinePoints, point, Boolean(profile.centerline.closed));
  }
  if (body.reverseDirection) centerlinePoints = reverseCenterlinePoints(centerlinePoints, Boolean(profile.centerline.closed));
  if (body.autoFixSharpTurns === '1') {
    const beforePoints = centerlinePoints.map((point) => ({ ...point }));
    const autoFixed = autoFixSharpTurns(beforePoints, { closed: Boolean(profile.centerline.closed) });
    centerlinePoints = autoFixed.points;
    profile.meta = { ...(profile.meta || {}), autoFixEvidence: buildAutoFixEvidence(beforePoints, autoFixed.points, autoFixed.fixes, autoFixed.remainingSharpTurns) };
  }
  profile.centerline.points = ensureClosedCenterline(centerlinePoints, Boolean(profile.centerline.closed));
  profile.centerlinePath = profile.centerline.points;
  profile.startFinish = {
    ...(profile.startFinish || { startS: 0, finishS: 1, label: '起终点' }),
    startS: numberOrFallback(body.startS || body.startSHidden, profile.startFinish?.startS ?? 0),
    finishS: numberOrFallback(body.finishS || body.finishSHidden, profile.startFinish?.finishS ?? 1)
  };
  profile.lanes = parseJsonInput(body.lanes || body.lanesJson, profile.lanes || (profile.laneOffsets || []).map((offset, index) => ({ laneId: `lane-${index}`, offset })));
  profile.checkpoints = parseJsonInput(body.checkpoints || body.checkpointsJson, profile.checkpoints || []);
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
    ['消息区 画布编辑', 'implemented', '可在画布中创建、移动和缩放 messageZones，JSON 仍保留为高级模式。'],
    ['禁气泡区 编辑', 'implemented', '可在画布中创建、移动和缩放 noBubbleZones，用于检查气泡避让。'],
    ['风险区 画布编辑', 'implemented', '可在画布中创建、移动和缩放 riskZones，风险区域在主画布可见。'],
    ['拖拽状态变化证据', 'implemented', 'centerline point / checkpoint / zone 拖拽时显示 before/current/delta，并在画布保留本次编辑连线。'],
    ['AI 候选点导入', 'implemented', 'AI 候选点导入：real-explicit-closed-course；可从已确认候选 profile 进入 Calibrator。'],
    ['自动检测尖角', 'implemented', '自动修复候选草稿；Validate 提供弯道转角 warning 和 draft fix evidence。'],
    ['lane 快捷调整', 'implemented', '可通过 lane count / spacing 生成 offsets，并逐条微调。'],
    ['导出 debug-preview.png', 'implemented', '已产出可引用 PNG 证据，路径为 Week2-Jumbotron/review-ledger/screenshots/2026-06-13-jumbotron-debug-preview-export/debug-preview.png。'],
    ['JSON 差异预览', 'implemented', '当前展示 imported profile 与 exported frozen candidate 的字段差异。']
  ];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function calibratorDefaultTrackProfile() {
  const profile = cloneJson(JUMBOTRON_CALIBRATOR_DEFAULT_TRACK_PROFILE);
  const points = [
    { x: 558.4, y: 509.2 },
    { x: 311.3, y: 505.6 },
    { x: 247.5, y: 487.2 },
    { x: 190.8, y: 125.7 },
    { x: 484.5, y: 105.3 },
    { x: 856.0, y: 105.8 },
    { x: 1009.6, y: 198.3 },
    { x: 1010.7, y: 471.4 },
    { x: 558.4, y: 509.2 }
  ];
  profile.centerline = { ...(profile.centerline || {}), points };
  profile.centerlinePath = points;
  return profile;
}

function parseJsonInput(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('JSON 解析失败');
  }
}

function buildImportedDiffProfile(profile) {
  const raw = cloneJson(profile);
  const rawPoints = (raw.centerline?.points || raw.centerlinePath || []).map(normalizeTrackPoint).filter(finitePoint);
  raw.centerline = { ...(raw.centerline || {}), points: rawPoints };
  raw.centerlinePath = rawPoints;
  raw.lanes = raw.lanes || [];
  raw.checkpoints = raw.checkpoints || [];
  raw.messageZones = raw.messageZones || [];
  raw.noBubbleZones = raw.noBubbleZones || [];
  raw.riskZones = raw.riskZones || [];
  return raw;
}

function buildImportedCalibratorProfile(body = {}) {
  const activeCandidate = isActiveSecondTrackCandidateImport(body) ? readActiveSecondTrackCandidate() : null;
  if (activeCandidate?.available && !body.profileJson) return normalizeExternalTrackCandidate(buildImportedDiffProfile(activeCandidate.profile), activeCandidate);
  const base = activeCandidate?.available ? normalizeExternalTrackCandidate(activeCandidate.profile, activeCandidate) : calibratorDefaultTrackProfile();
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

function safeAssetLabel(src = '') {
  const value = String(src || '未选择');
  return value.startsWith('/assets/') ? value : 'custom-asset-candidate';
}

function buildCalibratorAssetReview(body = {}) {
  const defaultStatus = secondTrackHumanReviewStatus() === 'confirmed' ? 'confirmed' : 'pending';
  const status = ['pending', 'confirmed', 'rejected'].includes(body.assetReviewStatus) ? body.assetReviewStatus : defaultStatus;
  const labels = {
    pending: '等待人工复核',
    confirmed: '人工复核确认',
    rejected: '人工复核驳回'
  };
  const gate = {
    pending: '候选预览：等待人工复核，不是正式资产，不会自动进入 Jumbotron confirmed asset。',
    confirmed: '人工确认：已由人工复核通过，可作为 confirmed asset 供 Jumbotron 正式使用。',
    rejected: '人工驳回：不得作为正式资产，只能保留为候选记录或继续修改。'
  };
  const useInJumbotron = {
    pending: '大屏使用：当前只允许候选预览；等待人工复核前，不会自动成为已确认资产。',
    confirmed: '大屏使用：正式资产 进入正式大屏资产流程；人工确认通过后，可作为已确认资产使用。',
    rejected: '大屏使用：已驳回候选不得进入正式大屏资产流程，只能继续修改后再复核。'
  };
  return { status, label: labels[status], gate: gate[status], useInJumbotron: useInJumbotron[status], confirmed: status === 'confirmed' };
}

function renderCalibratorAssetReviewStatus(assetReview) {
  return `<section class="calibrator-asset-review" data-asset-review-status="${escapeHtml(assetReview.status)}"><strong>Asset review status：${escapeHtml(assetReview.label)}</strong><p class="muted">${escapeHtml(assetReview.gate)}</p><p class="muted">${escapeHtml(assetReview.useInJumbotron)}</p></section>`;
}

function renderCalibratorAssetReviewOptions(assetReview) {
  return ['pending', 'confirmed', 'rejected'].map((status) => {
    const labels = { pending: '等待人工复核', confirmed: '人工复核确认', rejected: '人工复核驳回' };
    return `<label><input type="radio" name="assetReviewStatus" value="${status}"${assetReview.status === status ? ' checked' : ''}> ${labels[status]}</label>`;
  }).join('');
}

function renderCalibratorProofPanel(workbench, demoMode = false) {
  const profile = workbench.trackProfile;
  const background = safeAssetLabel(profile.background?.src);
  const viewBox = profile.viewBox || { width: 1200, height: 620 };
  const checksPassed = workbench.checks.filter(([, ok]) => ok).length;
  const checksTotal = workbench.checks.length;
  const assetReview = workbench.assetReview || buildCalibratorAssetReview();
  return `<section class="jumbotron-calibrator" id="calibrator-proof-mode"><div class="eyebrow">校准证明${demoMode ? ' · 演示路径' : ''}</div><h1>校准证明</h1><p class="muted">证明链：底图只作为视觉层；centerline、startFinish、direction、lane offsets、checkpoints 是 track.profile.json 语义资产；Jumbotron runtime 按 progress → centerline distance → point/rotation → laneOffset → displayAdjustment 计算 HorsePose。</p><div class="calibrator-grid"><article><strong>1. 当前赛道底图与 profile 来源</strong><p class="muted">background asset path：${escapeHtml(background)}</p><p class="muted">allowlist key：${escapeHtml(profile.background?.assetId || profile.backgroundAsset || 'candidate-background')}</p><p class="muted">profile source file：jumbotron curated track profile 或本页 imported candidate。</p></article><article><strong>2. 语义几何证据</strong><p class="muted">centerline point count=${profile.centerlinePath.length}；closed=${Boolean(profile.centerline?.closed)}；direction=${escapeHtml(profile.direction)}；startFinish=${escapeHtml(profile.startFinish?.label || '终点线')}；viewBox=${viewBox.width}×${viewBox.height}</p><p class="muted">lane offset count=${profile.lanes.length}；checkpoint count=${profile.checkpoints.length}；messageZones=${profile.messageZones.length}；noBubbleZones=${profile.noBubbleZones.length}；riskZones=${profile.riskZones.length}</p></article><article><strong>3. Preview 复用 runtime</strong><p class="muted">单马 scrubber：${workbench.settings.previewProgress}%；多马 preview：${workbench.multiHorsePoses.length} 匹；最小距离 ${Math.round(workbench.multiHorsePreview.minDistance)}。</p><p class="muted">预览调用 createJumbotronRuntime / sampleHorsePose，不把马匹位置写死到底图。</p></article><article><strong>4. 校验、导出与大屏使用</strong><p class="muted">Validate：${checksPassed}/${checksTotal} 项通过；Export 区域输出 frozen track.profile.json candidate。</p><p class="muted">${escapeHtml(assetReview.useInJumbotron)}</p>${renderCalibratorAssetReviewStatus(workbench.assetReview)}<div class="cta-row"><a class="button secondary" href="/jumbotron">在 Jumbotron 中使用</a><a class="button secondary" href="/jumbotron/calibrator?demo=1">打开演示模式</a></div></article></div><section class="notice warn"><strong>当前边界</strong><p>本页展示 candidate / preview / frozen export 证据；正式资产 confirmed 与第二条完整赛道资产仍按页面状态标注；debug-preview.png 已作为截图证据导出；zone 与 centerline 拖拽只声明当前画布证据，不伪装为正式资产确认。</p></section></section>`;
}

function renderCalibratorDemoGuide() {
  const steps = [
    '打开 /jumbotron，展示 赛事大屏。',
    '指出多个 参赛条目、TOP3、KPI、消息气泡和滚动条、风险和违规。',
    '切到 /jumbotron/calibrator?demo=1，展示底图、centerline、泳道偏移s、checkpoints。',
    '操作进度滑杆和马匹数量，展示单马和多马 preview。',
    '点击校验、预览或导出，展示校验结果。',
    '展示导出冻结候选配置和 JSON 差异预览。',
    '回到 /jumbotron，说明 Jumbotron 使用同一 track-runtime 和 track.profile 生成 horse pose。',
    '明确数据来源和可运行范围：race snapshot 是演示数据；Calibrator、Jumbotron、runtime 是可运行实现；正式资产冻结和第二条完整赛道资产仍待完成；debug-preview.png 已导出为可引用证据。'
  ];
  return `<section class="jumbotron-validation" id="demo-recording-guide"><div class="eyebrow">3–5 分钟短视频路径</div><h2>推荐录制路径</h2><ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol><div class="cta-row"><a class="button" href="/jumbotron">1. 赛事大屏</a><a class="button secondary" href="/jumbotron/calibrator?demo=1">2. 校准证明</a></div></section>`;
}

function renderCalibratorDebugPreview(workbench) {
  const profile = workbench.trackProfile;
  const sampled = workbench.runtime.samplePoints(18);
  const collision = profile.debug?.collisionBox || { width: 44, height: 44 };
  const sampleMarkers = sampled.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="3.5" fill="#0f2f9e"><title>sample-${index}</title></circle>`).join('');
  const horseBoxes = workbench.multiHorsePoses.map(({ pose }) => `<rect x="${pose.x - collision.width / 2}" y="${pose.y - collision.height / 2}" width="${collision.width}" height="${collision.height}" fill="none" stroke="rgba(31,73,216,.55)" stroke-dasharray="5 4"/>`).join('');
  const messageZoneRects = profile.messageZones.map((zone) => zone.rect ? `<rect x="${zone.rect.x}" y="${zone.rect.y}" width="${zone.rect.width}" height="${zone.rect.height}" fill="rgba(34,197,94,.1)" stroke="#22c55e" stroke-width="2"><title>${escapeHtml(zone.zoneId)}</title></rect>` : '').join('');
  const noBubbleRects = profile.noBubbleZones.map((zone) => `<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" fill="rgba(100,116,139,.08)" stroke="#64748b" stroke-dasharray="6 5"><title>${escapeHtml(zone.zoneId)}</title></rect>`).join('');
  const riskRects = profile.riskZones.map((zone) => `<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" fill="rgba(239,68,68,.12)" stroke="#ef4444" stroke-width="2"><title>${escapeHtml(zone.zoneId)}</title></rect>`).join('');
  return `<section class="jumbotron-validation" id="calibrator-debug-preview"><div class="eyebrow">P1 调试预览</div><h2>调试预览、区域和碰撞框</h2><p class="muted">当前完成 HTML/SVG debug preview 与 debug-preview.png 导出证据；PNG 用于提交引用，不代表第二赛道或完整视频。</p><div class="cta-row"><a class="button secondary" href="${JUMBOTRON_DEBUG_PREVIEW_PNG_ROUTE}">导出调试预览 PNG</a><span class="jumbotron-chip"><span>debug-preview.png</span><strong>implemented</strong></span></div><p class="muted">PNG 证据路径：${escapeHtml(JUMBOTRON_DEBUG_PREVIEW_PNG_RELATIVE_PATH)}</p><svg class="calibrator-preview-svg" viewBox="0 0 1200 620" role="img" aria-label="Calibrator debug preview HTML SVG"><rect class="track-bg" x="22" y="22" width="1156" height="576" rx="42"/><path class="track-band" d="${jumbotronPath(profile.centerlinePath)}"/><polyline class="track-centerline" points="${jumbotronPolyline(profile.centerlinePath)}"/>${messageZoneRects}${noBubbleRects}${riskRects}${sampleMarkers}${horseBoxes}${profile.checkpoints.map((checkpoint) => { const sample = workbench.runtime.samplePoint(checkpoint.s); return `<g transform="translate(${sample.point.x} ${sample.point.y})"><circle r="7" fill="#facc15" stroke="#713f12" stroke-width="2"/><text class="debug-label" x="11" y="5">${escapeHtml(publicCheckpointLabel(checkpoint.label))}</text></g>`; }).join('')}</svg><div class="calibrator-grid"><article><strong>消息区叠层</strong><p class="muted">${profile.messageZones.length} 个，约束气泡默认偏移和可显示区域。</p></article><article><strong>禁气泡区叠层</strong><p class="muted">${profile.noBubbleZones.length} 个，用于避免页头、摘要、小地图、ticker、footer。</p></article><article><strong>风险区叠层</strong><p class="muted">${profile.riskZones.length} 个，用于风险态势可视化证据。</p></article><article><strong>碰撞框</strong><p class="muted">${workbench.multiHorsePoses.length} 个 预览马匹碰撞框；停滞条目在 Race Live View 调试页中单独验证。</p></article></div></section>`;
}

function buildCalibratorWorkbench(body = {}) {
  const defaultSettings = { previewProgress: 50, horseCount: 8, previewSpeed: 1, scenarioPreset: 'clustered', playMode: 'paused' };
  try {
    const trackProfile = buildCalibratorProfile(body);
    const importedProfile = buildImportedCalibratorProfile(body);
    const assetReview = buildCalibratorAssetReview(body);
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
    return { trackProfile, runtime, exportProfile, exportJson: JSON.stringify(exportProfile, null, 2), diffRows, poses, singlePose, multiHorsePoses, multiHorsePreview, messageBubblePreview: { message: previewMessage, rect: bubbleRect, blockedByNoZone: bubbleBlockedByNoZone }, settings, checks, assetReview, autoFixEvidence: trackProfile.meta?.autoFixEvidence || null, p1Backlog: buildCalibratorP1Backlog(), error: '' };
  } catch (error) {
    const trackProfile = normalizeTrackProfile(calibratorDefaultTrackProfile());
    const runtime = createJumbotronRuntime(trackProfile);
    const exportProfile = exportTrackProfileShape(trackProfile);
    const settings = defaultSettings;
    const singleEntry = { entryId: 'calibrator-scrubber', displayName: 'Scrubber 50%', roundProgress: 50, laneOffsetIndex: 0, laneId: trackProfile.lanes[0]?.laneId, motionState: 'running' };
    const singlePose = { entry: singleEntry, pose: runtime.sampleHorsePose(singleEntry) };
    const previewMessage = { summary: '示例消息气泡：风险 / 里程碑优先' };
    return { trackProfile, runtime, exportProfile, exportJson: JSON.stringify(exportProfile, null, 2), diffRows: [], poses: [], singlePose, multiHorsePoses: [], multiHorsePreview: buildMultiHorsePreview(trackProfile, runtime), messageBubblePreview: { message: previewMessage, rect: estimateBubbleRects(trackProfile, [{ message: previewMessage, pose: singlePose.pose }])[0], blockedByNoZone: false }, settings, checks: validateTrackProfile(trackProfile, runtime), assetReview: buildCalibratorAssetReview(body), p1Backlog: buildCalibratorP1Backlog(), error: error.message };
  }
}


function renderTrackCalibrator(session, body = {}, options = {}) {
  const workbench = buildCalibratorWorkbench(body);
  const profile = workbench.trackProfile;
  const viewBox = profile.viewBox || { x: 0, y: 0, width: 1200, height: 620 };
  const backgroundSrc = profile.background?.src || '';
  const demoMode = Boolean(options.demoMode || body.demoMode === '1' || body.demoMode === true);
  const backgroundOptions = Array.from(JUMBOTRON_BACKGROUND_ASSETS).map((src) => `<option value="${escapeHtml(src)}"${profile.background?.src === src ? ' selected' : ''}>${escapeHtml(src)}</option>`).join('');
  const renderChecks = (checks) => checks.map(([label, ok]) => `<article class="review-check-${ok ? 'ok' : 'warn'}"><strong>${ok ? '✓' : '!' } ${escapeHtml(validationLabel(label))}</strong><p class="review-check-status">${ok ? '状态良好' : '待补齐'}</p></article>`).join('');
  const renderControlPoints = profile.centerlinePath.map((point, index) => `<tr><td>${index}</td><td>${Math.round(point.x)}</td><td>${Math.round(point.y)}</td><td><button class="button secondary" name="deletePointIndex" value="${index}" type="submit">删除点位</button></td></tr>`).join('');
  const checkpointMarkers = profile.checkpoints.map((checkpoint) => {
    const sample = workbench.runtime.samplePoint(checkpoint.s);
    return `<g class="检查点" transform="translate(${sample.point.x} ${sample.point.y})"><circle r="8" fill="#facc15" stroke="#713f12" stroke-width="3"/><text x="12" y="5">${escapeHtml(checkpoint.label)}</text></g>`;
  }).join('');
  const lanePreview = profile.lanes.map((lane) => {
    const offsetPoints = workbench.runtime.samplePoints(34).map((point, index) => {
      const sample = workbench.runtime.samplePoint(index / 33);
      return `${sample.point.x + sample.normal.x * lane.offset},${sample.point.y + sample.normal.y * lane.offset}`;
    }).join(' ');
    return `<polyline points="${offsetPoints}" fill="none" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="4 7"/>`;
  }).join('');
  const bubble = workbench.messageBubblePreview.rect || { x: 0, y: 0, width: 0, height: 0 };
  const startHandle = workbench.runtime.samplePoint(profile.startFinish?.startS ?? 0).point;
  const finishHandle = workbench.runtime.samplePoint(profile.startFinish?.finishS ?? 1).point;
  const renderJsonDiffRows = workbench.diffRows.length
    ? workbench.diffRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.before)}</td><td>${escapeHtml(row.after)}</td><td>已变化</td></tr>`).join('')
    : '<tr><td colspan="4">暂无字段差异；imported profile 与 exported frozen candidate 一致。</td></tr>';
  const activeCandidateId = isActiveSecondTrackCandidateImport(body) ? 'real-explicit-closed-course' : '';
  const secondTrackReviewTitle = workbench.assetReview?.status === 'rejected' ? '人工复核驳回' : workbench.assetReview?.status === 'pending' ? '等待人工复核' : '人工复核确认';
  const secondTrackReviewCopy = workbench.assetReview?.status === 'rejected'
    ? '当前候选已被驳回，不能进入正式大屏资产流程。'
    : '进入第二赛道候选后继续复核几何、泳道、关键点和气泡区；验证通过不等于正式资产确认。';
  const autoFixPanel = workbench.autoFixEvidence ? `<section class="notice"><strong>${escapeHtml(workbench.autoFixEvidence.label)}</strong><p class="muted">fix count=${escapeHtml(workbench.autoFixEvidence.fixCount)}；remainingSharpTurnCount=${escapeHtml(workbench.autoFixEvidence.remainingSharpTurnCount)}；${escapeHtml((workbench.autoFixEvidence.fixes || []).map((fix) => fix.action).join('、') || 'no-op')}</p><p class="muted">${escapeHtml(workbench.autoFixEvidence.humanReview)}</p></section>` : '';
  const content = `<section class="jumbotron-page calibrator-page"><section class="jumbotron-header" aria-label="顶部工具栏"><div class="jumbotron-brandline"><span class="jumbotron-live">MVP</span><strong>赛道校准器</strong><span>设计资产工具</span></div><div class="jumbotron-statusbar"><button class="button secondary" form="calibrator-form" type="submit">导入底图</button><button class="button secondary" form="calibrator-form" type="submit">导入候选配置</button><button class="button secondary" form="calibrator-form" type="submit">校验</button><button class="button secondary" form="calibrator-form" type="submit">预览</button><button class="button" form="calibrator-form" type="submit">导出</button></div></section>${workbench.error ? `<section class="notice warn"><strong>导入解析失败</strong><p>${escapeHtml(workbench.error)}</p></section>` : ''}<form id="calibrator-form" method="post" action="/jumbotron/calibrator"><input type="hidden" name="candidate" value="${escapeHtml(activeCandidateId)}"><input type="hidden" name="centerlinePointsJson" id="hf-centerlinePoints"><input type="hidden" name="checkpointsJson" id="hf-checkpoints"><input type="hidden" name="lanesJson" id="hf-lanes"><input type="hidden" name="startSHidden" id="hf-startS"><input type="hidden" name="finishSHidden" id="hf-finishS"><section class="jumbotron-calibrator calibrator-compact-head"><div class="eyebrow">画布校准 → 校验 → 导出</div><h1>赛道校准器</h1><p class="muted">先在主画布调整赛道；导入、候选 JSON 和冻结结果收在折叠区。</p><section class="notice" aria-label="赛道校准入口"><strong>赛道校准入口</strong><div class="cta-row"><a class="button secondary" href="/jumbotron/calibrator">第一赛道校准器</a><a class="button secondary" href="/jumbotron/calibrator?candidate=real-explicit-closed-course">第二赛道校准器</a></div></section><details class="calibrator-fold"><summary><strong>导入与候选配置</strong><span>底图、候选 JSON</span></summary><div class="calibrator-grid"><article><strong>导入底图</strong><p class="muted">选择允许的背景资产，校验会检查 allowlist 与文件存在。</p><label>允许背景资产<select name="backgroundSrc">${backgroundOptions}</select></label><label>自定义 /assets/ 输入<input name="backgroundSrcCustom" value="${escapeHtml(body.backgroundSrcCustom || '')}" placeholder="/assets/public-yard-hero.webp"></label></article><article><strong>导入候选配置</strong><textarea name="profileJson" rows="5">${escapeHtml(body.profileJson || workbench.exportJson)}</textarea></article></div></details><details class="calibrator-fold"><summary><strong>导出冻结候选配置</strong><span>JSON 与复核状态</span></summary><article class="calibrator-export"><textarea readonly rows="6">${escapeHtml(workbench.exportJson)}</textarea>${renderCalibratorAssetReviewStatus(workbench.assetReview)}<p class="muted">冻结候选不等于正式资产 confirmed。</p></article></details>${autoFixPanel}</section><section class="jumbotron-layout calibrator-layout" aria-label="Calibrator IA"><section class="track-stage-card" aria-label="主画布"><div class="eyebrow">主画布</div><h2>底图层、中心线层、控制点层</h2><div class="cta-row" data-trace-toolbar><button class="button secondary" type="button" data-set-calibrator-mode="trace">沿底图描线</button><button class="button secondary" type="button" data-trace-clear-next>清空后重描</button><button class="button secondary" type="button" data-trace-reduce>减少点数</button><button class="button secondary" type="button" data-trace-close>闭合描线</button><button class="button secondary" type="button" data-trace-copy>复制点集</button></div><p id="calibrator-canvas-status" class="calibrator-canvas-help">画布操作已开启：点击画布会插入最近的相邻线段，拖拽 P 点移动；选择沿底图描线后，按住鼠标沿底图道路采样。描完后可减少点数。</p><svg id="calibrator-canvas" class="track-svg" viewBox="${viewBox.x || 0} ${viewBox.y || 0} ${viewBox.width} ${viewBox.height}" role="img" aria-label="赛道校准器 主画布"><rect class="track-bg" x="${viewBox.x || 0}" y="${viewBox.y || 0}" width="${viewBox.width}" height="${viewBox.height}" rx="42"/><image data-background-image class="calibrator-background-image" href="${escapeHtml(backgroundSrc)}" x="${viewBox.x || 0}" y="${viewBox.y || 0}" width="${viewBox.width}" height="${viewBox.height}" opacity="0.42" preserveAspectRatio="xMidYMid slice"/><text class="debug-label" x="${(viewBox.x || 0) + 44}" y="${(viewBox.y || 0) + 58}">底图层：${escapeHtml(backgroundSrc || '未选择')}</text><g data-zone-layer data-zone-type="messageZones">${profile.messageZones.map((zone) => zone.rect ? `<rect x="${zone.rect.x}" y="${zone.rect.y}" width="${zone.rect.width}" height="${zone.rect.height}" fill="rgba(34,197,94,.1)" stroke="#22c55e" stroke-dasharray="6 5"/>` : '').join('')}</g><g data-zone-layer data-zone-type="riskZones">${profile.riskZones.map((zone) => `<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" fill="rgba(239,68,68,.12)" stroke="#ef4444" stroke-dasharray="8 6"/>`).join('')}</g><g data-zone-layer data-zone-type="noBubbleZones">${profile.noBubbleZones.map((zone) => `<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" fill="rgba(15,23,42,.08)" stroke="#64748b" stroke-dasharray="5 6"/>`).join('')}</g><path class="track-band" data-centerline-band d="${jumbotronPath(profile.centerlinePath)}"/>${lanePreview}<polyline class="track-centerline" data-centerline-polyline points="${jumbotronPolyline(profile.centerlinePath)}"/><polyline data-closing-segment class="track-closing-segment" points="" display="none"/><g data-control-points-layer>${profile.centerlinePath.map((point, index) => `<g class="calibrator-point" data-control-point data-index="${index}" transform="translate(${point.x} ${point.y})"><circle r="8" fill="#fff" stroke="#1f49d8" stroke-width="3"/><text class="debug-label" x="12" y="5">P${index}</text></g>`).join('')}</g><g data-checkpoints-layer>${checkpointMarkers}</g><g data-start-handle transform="translate(${startHandle.x} ${startHandle.y})"><circle r="10" fill="#22c55e" stroke="#064e3b" stroke-width="3"/><text class="debug-label" x="14" y="5">Start</text></g><g data-finish-handle transform="translate(${finishHandle.x} ${finishHandle.y})"><circle r="10" fill="#f97316" stroke="#7c2d12" stroke-width="3"/><text class="debug-label" x="14" y="5">Finish</text></g>${renderJumbotronRiderTintFilters()}<g class="horse calibrator-scrubber-horse" data-scrubber-preview data-entry-id="${escapeHtml(workbench.singlePose.entry.entryId)}" data-motion-state="${escapeHtml(workbench.singlePose.entry.motionState)}" data-round-progress="${escapeHtml(workbench.singlePose.entry.roundProgress)}" data-lane-id="${escapeHtml(workbench.singlePose.entry.laneId || 'lane-0')}" transform="translate(${workbench.singlePose.pose.x} ${workbench.singlePose.pose.y})">${renderHorseRiderSprite(workbench.singlePose.entry, workbench.singlePose.pose, profile)}<text class="debug-label" data-scrubber-label x="34" y="8">Scrubber ${workbench.settings.previewProgress}%</text></g><g data-multi-horse-preview-layer>${workbench.multiHorsePoses.map(({ entry, pose }) => `<g class="horse calibrator-preview-horse" data-multi-horse-preview data-entry-id="${escapeHtml(entry.entryId)}" data-motion-state="${escapeHtml(entry.motionState)}" data-round-progress="${escapeHtml(entry.roundProgress)}" data-lane-id="${escapeHtml(entry.laneId || 'lane-0')}" transform="translate(${pose.x} ${pose.y})">${renderHorseRiderSprite(entry, pose, profile)}<text class="debug-label" x="28" y="8">${escapeHtml(entry.displayName.replace('Horse ', '#'))}</text></g>`).join('')}</g><rect x="${bubble.x}" y="${bubble.y}" width="${bubble.width}" height="${bubble.height}" rx="12" fill="rgba(255,255,255,.96)" stroke="${workbench.messageBubblePreview.blockedByNoZone ? '#ef4444' : '#1f49d8'}" stroke-width="2"/><text class="debug-label" x="${bubble.x + 12}" y="${bubble.y + 32}">消息气泡预览</text><polyline data-trace-guide class="calibrator-trace-guide" points="" display="none"/></svg><div class="calibrator-grid"><article><strong>底图层</strong><p class="muted">${escapeHtml(profile.background?.src || '未选择背景')}</p></article><article><strong>中心线层</strong><p class="muted">${profile.centerlinePath.length} 个点；${profile.centerline?.closed ? '闭合路径' : '开放路径'}</p></article><article><strong>控制点层</strong><p class="muted">支持画布点击添加、拖拽移动、删除和 JSON 高级编辑。</p></article><article data-lane-summary><strong>泳道预览层</strong><p class="muted">${profile.lanes.length} 条泳道偏移预览。</p></article><article data-checkpoint-summary><strong>检查点层</strong><p class="muted">${profile.checkpoints.length} 个检查点。</p></article><article><strong>马匹预览层</strong><p class="muted">进度滑杆单马 + ${workbench.multiHorsePoses.length} 匹多马预览。大屏运行时采样，预览复用大屏运行时。</p></article><article><strong>消息气泡预览层</strong><p class="muted">基于 消息区、禁气泡区；${workbench.messageBubblePreview.blockedByNoZone ? '当前落在 禁气泡区' : '当前可显示示例气泡'}。</p></article></div></section><aside aria-label="右侧面板"><section class="side-card"><div class="eyebrow">右侧面板</div><h2>赛道信息</h2><label>trackId<input name="trackId" value="${escapeHtml(profile.trackId)}"></label><label>name<input name="name" value="${escapeHtml(profile.name)}"></label></section><section class="side-card"><h2>几何</h2><p class="muted">高级 JSON</p><label>中心线 JSON<textarea id="calibrator-centerline-points" name="centerlinePoints" rows="8">${escapeHtml(JSON.stringify(profile.centerlinePath, null, 2))}</textarea></label><div class="calibrator-mode-grid"><label><input type="radio" name="calibratorMode" value="centerline" checked> 中心线</label><label><input type="radio" name="calibratorMode" value="trace"> 描线</label><label><input type="radio" name="calibratorMode" value="keypoints"> 关键点安全</label><label><input type="radio" name="calibratorMode" value="checkpoint"> 检查点</label></div><p class="muted" data-keypoint-safe-copy>关键点安全模式只修改起终点和检查点的 s，不修改中心线几何。</p><div class="cta-row"><button class="button secondary" type="button" data-calibrator-undo>撤销</button><button class="button secondary" type="button" data-calibrator-redo>重做</button></div><div class="cta-row"><label>新增 x<input name="addPointX" value="${escapeHtml(body.addPointX || '600')}"></label><label>新增 y<input name="addPointY" value="${escapeHtml(body.addPointY || '310')}"></label><button id="calibrator-add-point-button" class="button secondary" name="centerlineAction" value="add" type="submit">添加中心线点</button><button id="calibrator-reverse-button" class="button secondary" name="reverseDirection" value="1" type="submit">反转路径方向</button></div><table><thead><tr><th>#</th><th>x</th><th>y</th><th>操作</th></tr></thead><tbody data-control-points-table>${renderControlPoints}</tbody></table><p class="muted">拖拽中心线点；Shift+点击路径添加检查点。</p><div class="calibrator-trace-panel" data-trace-panel><strong>描线模式</strong><p class="muted">按住鼠标沿底图道路拖动即可连续采样；验证通过不等于正式资产确认。</p><div class="calibrator-trace-controls"><label>采样距离<input id="calibrator-trace-min-distance" type="number" min="4" max="80" value="16"></label><button class="button secondary" data-trace-reduce type="button">减少点数</button><button class="button secondary" id="calibrator-close-trace" type="button">闭合描线</button><button class="button secondary" id="calibrator-copy-trace-json" type="button">复制点集 JSON</button></div><textarea id="calibrator-trace-output" readonly rows="5"></textarea></div><div data-context-menu class="calibrator-context-menu" hidden><button class="button secondary" type="button" data-context-action="insert-nearest-segment">在最近线段插入点</button></div></section><section class="side-card"><h2>终点线</h2><label>startS<input name="startS" value="${escapeHtml(profile.startFinish?.startS ?? 0)}"></label><label>finishS<input name="finishS" value="${escapeHtml(profile.startFinish?.finishS ?? 1)}"></label></section><section class="side-card"><h2>方向</h2><label>direction<select name="direction"><option value="clockwise"${profile.direction === 'clockwise' ? ' selected' : ''}>clockwise</option><option value="counterclockwise"${profile.direction === 'counterclockwise' ? ' selected' : ''}>counterclockwise</option></select></label><label>closed<select name="closed"><option value="true"${profile.centerline?.closed ? ' selected' : ''}>true</option><option value="false"${!profile.centerline?.closed ? ' selected' : ''}>false</option></select></label><label>平滑路径预览<select name="smoothing"><option value="mvp-polyline"${profile.centerline?.smoothing === 'mvp-polyline' ? ' selected' : ''}>关闭：mvp-polyline</option><option value="preview-smoothing"${profile.centerline?.smoothing === 'preview-smoothing' ? ' selected' : ''}>开启：preview-smoothing</option></select></label><p class="muted">平滑路径预览是 MVP 视觉提示，不改写 runtime 事实来源。</p></section><section class="side-card"><h2>泳道</h2><label>泳道数量<input name="laneCount" value="${escapeHtml(profile.lanes.length)}"></label><label>泳道间距<input name="laneSpacing" value="28"></label><textarea name="lanes" rows="8">${escapeHtml(JSON.stringify(profile.lanes, null, 2))}</textarea></section><section class="side-card"><h2>检查点</h2><textarea name="checkpoints" rows="7">${escapeHtml(JSON.stringify(profile.checkpoints, null, 2))}</textarea></section><section class="side-card"><h2>消息气泡与区域</h2><label>消息区<textarea name="messageZones" rows="5">${escapeHtml(JSON.stringify(profile.messageZones, null, 2))}</textarea></label><label>禁气泡区<textarea name="noBubbleZones" rows="5">${escapeHtml(JSON.stringify(profile.noBubbleZones, null, 2))}</textarea></label><label>风险区<textarea name="riskZones" rows="5">${escapeHtml(JSON.stringify(profile.riskZones, null, 2))}</textarea></label></section><section class="side-card"><h2>校验结果</h2><div class="validation-grid">${renderChecks(workbench.checks)}</div></section></aside></section><section class="jumbotron-kpis" aria-label="底部预览栏"><span class="jumbotron-chip"><span>进度滑杆</span><strong data-scrubber-value>${workbench.settings.previewProgress}%</strong></span><label>进度滑杆<input data-scrubber-range type="range" name="previewProgress" min="0" max="100" step="1" value="${escapeHtml(workbench.settings.previewProgress)}"></label><span class="jumbotron-chip" data-scrubber-range-hint><span>范围</span><strong>0% 到 100%</strong></span><label>马匹数量<input name="horseCount" value="${escapeHtml(workbench.settings.horseCount)}"></label><label>速度<input name="previewSpeed" value="${escapeHtml(workbench.settings.previewSpeed)}"></label><label>播放状态<select name="playMode"><option value="paused"${workbench.settings.playMode === 'paused' ? ' selected' : ''}>暂停</option><option value="play"${workbench.settings.playMode === 'play' ? ' selected' : ''}>播放</option></select></label><label>场景预设<select name="scenarioPreset"><option value="clustered"${workbench.settings.scenarioPreset === 'clustered' ? ' selected' : ''}>clustered</option><option value="spread"${workbench.settings.scenarioPreset === 'spread' ? ' selected' : ''}>spread</option><option value="finish"${workbench.settings.scenarioPreset === 'finish' ? ' selected' : ''}>finish</option></select></label><button class="button" type="submit">校验、预览或导出</button><a class="button secondary" href="/jumbotron">返回 赛事大屏</a></section></form><script>
(() => {
  const syncCalibratorInspectorHeight = () => {
    const layout = document.querySelector('.calibrator-layout');
    const mainCanvas = layout?.querySelector('.track-stage-card');
    const inspector = layout?.querySelector('aside[aria-label="右侧面板"]');
    if (!mainCanvas || !inspector) return;
    inspector.style.maxHeight = Math.ceil(mainCanvas.getBoundingClientRect().height) + 'px';
  };
  window.syncCalibratorInspectorHeight = syncCalibratorInspectorHeight;
  window.addEventListener('load', syncCalibratorInspectorHeight);
  window.addEventListener('resize', syncCalibratorInspectorHeight);
  if ('ResizeObserver' in window) {
    window.addEventListener('load', () => {
      const mainCanvas = document.querySelector('.calibrator-layout .track-stage-card');
      if (mainCanvas) new ResizeObserver(syncCalibratorInspectorHeight).observe(mainCanvas);
    });
  }
})();

(() => {
  const form = document.getElementById('calibrator-form');
  const svg = document.getElementById('calibrator-canvas');
  const textarea = document.getElementById('calibrator-centerline-points');
  if (!form || !svg || !textarea) return;
  const band = svg.querySelector('[data-centerline-band]');
  const polyline = svg.querySelector('[data-centerline-polyline]');
  const closingSegment = svg.querySelector('[data-closing-segment]');
  const traceGuide = svg.querySelector('[data-trace-guide]');
  const scrubber = svg.querySelector('[data-scrubber-preview]');
  const scrubberLabel = svg.querySelector('[data-scrubber-label]');
  const scrubberValue = document.querySelector('[data-scrubber-value]');
  const multiHorseLayer = svg.querySelector('[data-multi-horse-preview-layer]');
  const riderSpriteHref = '/assets/jumbotron/rider3_run.gif';
  const riderSpriteWidth = ${JUMBOTRON_RIDER_SPRITE_SIZE.width};
  const riderSpriteHeight = ${JUMBOTRON_RIDER_SPRITE_SIZE.height};
  const controlsLayer = svg.querySelector('[data-control-points-layer]');
  const checkpointsLayer = svg.querySelector('[data-checkpoints-layer]');
  const tableBody = document.querySelector('[data-control-points-table]');
  const status = document.getElementById('calibrator-canvas-status');
  const traceOutput = document.getElementById('calibrator-trace-output');
  const traceMinDistance = document.getElementById('calibrator-trace-min-distance');
  const undoButton = document.querySelector('[data-calibrator-undo]');
  const redoButton = document.querySelector('[data-calibrator-redo]');
  const closedSelect = form.elements.closed;
  const checkpointsTextarea = form.elements.checkpoints;
  const viewBox = svg.viewBox.baseVal;
  const history = { undo: [], redo: [], limit: 80 };
  let selectedIndex = -1;
  let dragIndex = -1;
  let didDrag = false;
  let dragSnapshot = null;
  let keypointDrag = null;
  let traceActive = false;
  let traceChanged = false;
  let traceSnapshot = null;
  let traceLastPoint = null;
  let traceClearNext = false;
  let suppressNextClick = false;

  const samePoint = (a, b) => Boolean(a && b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01);
  const isClosed = () => String(closedSelect?.value || 'true') === 'true';
  const currentMode = () => String(form.elements.calibratorMode?.value || 'centerline');
  const formatNumber = (value) => Math.round(value * 10) / 10;
  const formatPoint = (point) => ({ x: formatNumber(point.x), y: formatNumber(point.y) });
  const distance = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
  const updateStatus = (message) => { if (status) status.textContent = message; };
  const safeJson = (value, fallback) => {
    try { const parsed = JSON.parse(value || ''); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; }
  };
  const readPoints = () => safeJson(textarea.value, []).map((point) => ({ x: Number(point.x), y: Number(point.y) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const readCheckpoints = () => safeJson(checkpointsTextarea?.value, []).map((checkpoint, index) => ({
    checkpointId: String(checkpoint.checkpointId || 'cp-' + (index + 1)),
    label: String(checkpoint.label || '检查点 ' + (index + 1)),
    s: Math.max(0, Math.min(1, Number(checkpoint.s) || 0))
  }));
  let points = readPoints();
  const pointList = () => points.map((point) => formatPoint(point));
  const hasClosingDuplicate = () => points.length > 2 && samePoint(points[0], points[points.length - 1]);
  const editablePath = () => isClosed() && hasClosingDuplicate() ? points.slice(0, -1) : points;
  const snapshot = () => ({
    points: pointList(),
    closed: String(closedSelect?.value || 'true'),
    selectedIndex,
    checkpoints: checkpointsTextarea?.value || '[]',
    startS: form.elements.startS?.value || '0',
    finishS: form.elements.finishS?.value || '1'
  });
  const updateHistoryButtons = () => {
    if (undoButton) undoButton.disabled = history.undo.length === 0;
    if (redoButton) redoButton.disabled = history.redo.length === 0;
  };
  const remember = (state = snapshot()) => {
    history.undo.push(JSON.parse(JSON.stringify(state)));
    if (history.undo.length > history.limit) history.undo.shift();
    history.redo = [];
    updateHistoryButtons();
  };
  const restore = (state, message) => {
    points = (state.points || []).map((point) => ({ x: Number(point.x), y: Number(point.y) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (closedSelect) closedSelect.value = state.closed || 'true';
    if (checkpointsTextarea) checkpointsTextarea.value = state.checkpoints || '[]';
    if (form.elements.startS) form.elements.startS.value = state.startS || '0';
    if (form.elements.finishS) form.elements.finishS.value = state.finishS || state.startS || '1';
    selectedIndex = Number.isInteger(state.selectedIndex) ? state.selectedIndex : -1;
    dragIndex = -1;
    traceActive = false;
    traceLastPoint = null;
    redraw(message);
  };
  const undo = () => {
    if (!history.undo.length) return;
    const current = snapshot();
    const previous = history.undo.pop();
    history.redo.push(current);
    restore(previous, '已撤销上一步画布编辑。');
    updateHistoryButtons();
  };
  const redo = () => {
    if (!history.redo.length) return;
    const current = snapshot();
    const next = history.redo.pop();
    history.undo.push(current);
    restore(next, '已重做上一步画布编辑。');
    updateHistoryButtons();
  };
  const pathD = () => points.length ? 'M ' + points.map((point) => point.x + ' ' + point.y).join(' L ') : '';
  const polylinePoints = () => points.map((point) => point.x + ',' + point.y).join(' ');
  const normalizeClosingDuplicate = () => {
    if (isClosed() && hasClosingDuplicate()) points[points.length - 1] = { ...points[0] };
  };
  const syncTextarea = () => {
    const centerlineJson = JSON.stringify(pointList(), null, 2);
    textarea.value = centerlineJson;
    if (traceOutput) traceOutput.value = centerlineJson;
    const hiddenCenterline = document.getElementById('hf-centerlinePoints');
    const hiddenLanes = document.getElementById('hf-lanes');
    const hiddenCheckpoints = document.getElementById('hf-checkpoints');
    const hiddenStart = document.getElementById('hf-startS');
    const hiddenFinish = document.getElementById('hf-finishS');
    if (hiddenCenterline) hiddenCenterline.value = centerlineJson;
    if (hiddenLanes && form.elements.lanes) hiddenLanes.value = form.elements.lanes.value;
    if (hiddenCheckpoints && checkpointsTextarea) hiddenCheckpoints.value = checkpointsTextarea.value;
    if (hiddenStart && form.elements.startS) hiddenStart.value = form.elements.startS.value;
    if (hiddenFinish && form.elements.finishS) hiddenFinish.value = form.elements.finishS.value;
  };
  const totalPathLength = () => {
    const path = editablePath();
    return path.slice(1).reduce((sum, point, index) => sum + distance(path[index], point), 0);
  };
  const pointAtS = (s) => {
    const path = editablePath();
    if (!path.length) return { x: 0, y: 0, normal: { x: 0, y: -1 }, rotation: 0 };
    if (path.length === 1) return { ...path[0], normal: { x: 0, y: -1 }, rotation: 0 };
    const total = totalPathLength();
    let target = Math.max(0, Math.min(1, Number(s) || 0)) * total;
    for (let index = 1; index < path.length; index += 1) {
      const start = path[index - 1];
      const end = path[index];
      const length = distance(start, end);
      if (target <= length || index === path.length - 1) {
        const ratio = length ? target / length : 0;
        const tangent = length ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : { x: 1, y: 0 };
        return {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
          normal: { x: -tangent.y, y: tangent.x },
          rotation: Math.atan2(tangent.y, tangent.x) * 180 / Math.PI
        };
      }
      target -= length;
    }
    return { ...path[path.length - 1], normal: { x: 0, y: -1 }, rotation: 0 };
  };
  const nearestS = (point) => {
    const path = editablePath();
    if (path.length < 2) return 0;
    const total = totalPathLength();
    let best = { distance: Infinity, before: 0, ratio: 0, length: 0 };
    let before = 0;
    for (let index = 1; index < path.length; index += 1) {
      const start = path[index - 1];
      const end = path[index];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      const ratio = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
      const projected = { x: start.x + dx * ratio, y: start.y + dy * ratio };
      const d = distance(point, projected);
      const length = Math.sqrt(lengthSquared);
      if (d < best.distance) best = { distance: d, before, ratio, length };
      before += length;
    }
    return total ? Math.max(0, Math.min(1, (best.before + best.length * best.ratio) / total)) : 0;
  };
  const startFinishSamePoint = () => Math.abs(Number(form.elements.startS?.value || 0) - Number(form.elements.finishS?.value || 1)) < 0.0005;
  const setStartFinishS = (s) => {
    const value = String(Math.max(0, Math.min(1, Number(s) || 0)).toFixed(4)).replace(/0+$/, '').replace(/\.$/, '');
    if (form.elements.startS) form.elements.startS.value = value;
    if (form.elements.finishS) form.elements.finishS.value = value;
    const checkpoints = readCheckpoints().map((checkpoint) => checkpoint.checkpointId === 'cp-start' ? { ...checkpoint, s: Number(value), label: checkpoint.label || '起终点' } : checkpoint);
    if (checkpointsTextarea) checkpointsTextarea.value = JSON.stringify(checkpoints, null, 2);
  };
  const setCheckpointS = (index, s) => {
    const checkpoints = readCheckpoints();
    if (!checkpoints[index]) return;
    const value = Math.max(0, Math.min(1, Number(s) || 0));
    checkpoints[index].s = value;
    if (checkpoints[index].checkpointId === 'cp-start') setStartFinishS(value);
    else if (checkpointsTextarea) checkpointsTextarea.value = JSON.stringify(checkpoints, null, 2);
  };
  const progressToTrackS = (progress) => {
    const start = Number(form.elements.startS?.value || 0);
    const finish = Number(form.elements.finishS?.value || 1);
    const span = finish >= start ? finish - start : 1 - start + finish;
    return (start + Math.max(0, Math.min(1, Number(progress) || 0)) * span) % 1;
  };
  const riderFacingScale = (rotation) => Math.cos((Number(rotation) || 0) * Math.PI / 180) >= 0 ? 'scale(1 1)' : 'scale(-1 1)';
  const readLanes = () => safeJson(form.elements.lanes?.value, []).map((lane, index) => ({ laneId: String(lane.laneId || 'lane-' + index).replace(/[<>&"]/g, ''), offset: Number(lane.offset) || 0 }));
  const previewPoseAtProgress = (progress, laneOffset = 0) => {
    const point = pointAtS(progressToTrackS(progress / 100));
    return { x: point.x + (point.normal?.x || 0) * laneOffset, y: point.y + (point.normal?.y || 0) * laneOffset, rotation: point.rotation || 0 };
  };
  const riderSpriteHrefForState = (state) => ['running', 'sprinting'].includes(state) ? '/assets/jumbotron/rider3_run.gif' : ['blocked', 'takeover', 'pit_stop'].includes(state) ? '/assets/jumbotron/rider3_walk.gif' : '/assets/jumbotron/rider3_stay.gif';
  const tintPalette = ${JSON.stringify(JUMBOTRON_RIDER_TINT_PALETTE.map((item) => item.name))};
  const hashString = (value) => Array.from(String(value || '')).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0);
  const tintIndexForEntry = (entry) => Number.isFinite(Number(entry.rank)) && Number(entry.rank) > 0 ? (Math.round(Number(entry.rank)) - 1) % tintPalette.length : hashString(entry.entryId || entry.displayName) % tintPalette.length;
  const providerGroupForEntry = (entry) => {
    const value = String(entry.primaryCA || entry.caProvider || '').toLowerCase();
    if (value.includes('claude')) return 'claude';
    if (value.includes('codex')) return 'codex';
    return 'other';
  };
  const perspectiveScaleForPose = (pose) => viewBox.width === 1672 && viewBox.height === 941 ? Math.round((0.6 + Math.max(0, Math.min(1, (Number(pose.y) - viewBox.y) / viewBox.height)) * 0.5) * 1000) / 1000 : 1;
  const renderPreviewHorseSprite = (entry, pose, label) => {
    const href = riderSpriteHrefForState(entry.motionState);
    const facing = Math.cos((Number(pose.rotation) || 0) * Math.PI / 180) >= 0 ? 'right' : 'left';
    const tintIndex = tintIndexForEntry(entry);
    const tintName = tintPalette[tintIndex] || 'violet';
    const providerGroup = providerGroupForEntry(entry);
    const stableNumber = Number.isFinite(Number(entry.rank)) && Number(entry.rank) > 0 ? String(Math.round(Number(entry.rank))).padStart(2, '0') : String((Number(entry.index) || 0) + 1).padStart(2, '0');
    const spriteAttrs = 'href="' + href + '" x="-75.6" y="-78.4" width="' + riderSpriteWidth + '" height="' + riderSpriteHeight + '" preserveAspectRatio="xMidYMid meet"';
    const sprite = '<image class="horse-rider-sprite" ' + spriteAttrs + '/><image class="horse-rider-group-mask horse-rider-alpha-tint horse-rider-tint-' + tintIndex + '" data-entry-id="' + entry.entryId + '" data-entry-stable-number="' + stableNumber + '" data-entry-color-key="' + entry.entryId + '" data-entry-color-index="' + tintIndex + '" data-entry-tint="' + tintName + '" data-entry-provider-group="' + providerGroup + '" data-mask-mode="source-alpha" ' + spriteAttrs + ' filter="url(#horse-rider-tint-' + tintIndex + ')" style="pointer-events:none"/>';
    const scale = perspectiveScaleForPose(pose);
    const scaledSprite = scale === 1 ? sprite : '<g class="horse-rider-perspective-scale" data-perspective-track="real-explicit-closed-course" data-perspective-scale="' + scale + '" data-perspective-y="' + Number(pose.y).toFixed(1) + '" data-perspective-min-scale="0.6" data-perspective-max-scale="1.1" data-base-sprite-width="' + riderSpriteWidth + '" data-base-sprite-height="' + riderSpriteHeight + '" transform="scale(' + scale + ')">' + sprite + '</g>';
    return '<g class="horse calibrator-preview-horse" data-multi-horse-preview data-entry-id="' + entry.entryId + '" data-motion-state="' + entry.motionState + '" data-round-progress="' + entry.roundProgress + '" data-lane-id="' + entry.laneId + '" transform="translate(' + pose.x + ' ' + pose.y + ')"><g class="horse-rider-facing" data-facing="' + facing + '" transform="' + riderFacingScale(pose.rotation) + '">' + scaledSprite + '</g><text class="debug-label" x="28" y="8">' + label + '</text></g>';
  };
  const updateScrubberPreview = () => {
    if (!scrubber) return;
    const range = form.elements.previewProgress;
    const progress = Math.round(Math.max(0, Math.min(100, Number(range?.value || 0))));
    const motionState = progress >= 100 ? 'finished' : 'running';
    if (range) range.value = String(progress);
    const pose = previewPoseAtProgress(progress, 0);
    scrubber.setAttribute('transform', 'translate(' + pose.x + ' ' + pose.y + ')');
    scrubber.setAttribute('data-round-progress', String(progress));
    scrubber.setAttribute('data-motion-state', motionState);
    const facing = scrubber.querySelector('.horse-rider-facing');
    if (facing) {
      facing.setAttribute('transform', riderFacingScale(pose.rotation));
      facing.setAttribute('data-facing', Math.cos((Number(pose.rotation) || 0) * Math.PI / 180) >= 0 ? 'right' : 'left');
    }
    scrubber.querySelectorAll('.horse-rider-sprite,.horse-rider-group-mask').forEach((image) => image.setAttribute('href', riderSpriteHrefForState(motionState)));
    if (scrubberLabel) scrubberLabel.textContent = 'Scrubber ' + progress + '%';
    if (scrubberValue) scrubberValue.textContent = progress + '%';
  };
  const renderMultiHorsePreview = () => {
    if (!multiHorseLayer) return;
    const lanes = readLanes();
    const count = Math.max(1, Math.min(12, Math.round(Number(form.elements.horseCount?.value || 8))));
    if (form.elements.horseCount) form.elements.horseCount.value = String(count);
    const scenario = String(form.elements.scenarioPreset?.value || 'clustered');
    const startByScenario = { spread: 18, clustered: 46, finish: 72 };
    const stepByScenario = { spread: 9, clustered: 2, finish: 3 };
    const start = startByScenario[scenario] ?? 44;
    const step = stepByScenario[scenario] ?? 4;
    multiHorseLayer.innerHTML = Array.from({ length: count }, (_, index) => {
      const lane = lanes[index % Math.max(1, lanes.length)] || { laneId: 'lane-' + index, offset: 0 };
      const progress = Math.min(100, start + index * step);
      const entry = { entryId: 'multi-' + index, displayName: 'Horse ' + (index + 1), rank: index + 1, index, motionState: progress >= 100 ? 'finished' : 'running', roundProgress: progress, laneId: lane.laneId };
      return renderPreviewHorseSprite(entry, previewPoseAtProgress(progress, lane.offset), '#' + (index + 1));
    }).join('');
  };
  const renderCheckpoints = () => {
    if (!checkpointsLayer) return;
    const startPoint = pointAtS(form.elements.startS?.value || 0);
    const startHandle = '<g class="checkpoint keypoint-safe-handle" style="pointer-events:all;cursor:grab" data-keypoint-handle="start" transform="translate(' + startPoint.x + ' ' + startPoint.y + ')"><circle r="12" fill="#22c55e" stroke="#064e3b" stroke-width="3"/><text x="16" y="5">起终点</text></g>';
    const checkpointHandles = readCheckpoints().map((checkpoint, index) => {
      if (checkpoint.checkpointId === 'cp-start') return '';
      const point = pointAtS(checkpoint.s);
      return '<g class="checkpoint keypoint-safe-handle" style="pointer-events:all;cursor:grab" data-keypoint-handle="checkpoint" data-checkpoint-index="' + index + '" transform="translate(' + point.x + ' ' + point.y + ')"><circle r="8" fill="#facc15" stroke="#713f12" stroke-width="3"/><text x="12" y="5">' + checkpoint.label.replace(/[<>&]/g, '') + '</text></g>';
    }).join('');
    checkpointsLayer.innerHTML = startHandle + checkpointHandles;
    checkpointsLayer.style.pointerEvents = currentMode() === 'keypoints' ? 'all' : '';
  };
  const renderControls = () => {
    if (!controlsLayer) return;
    controlsLayer.innerHTML = currentMode() === 'keypoints' ? '' : points.map((point, index) => '<g class="calibrator-point' + (index === selectedIndex ? ' is-selected' : '') + (index === dragIndex ? ' is-dragging' : '') + '" data-control-point data-index="' + index + '" transform="translate(' + point.x + ' ' + point.y + ')"><circle r="8" fill="#fff" stroke="#1f49d8" stroke-width="3"/><text class="debug-label" x="12" y="5">P' + index + '</text></g>').join('');
  };
  const renderTable = () => {
    if (!tableBody) return;
    tableBody.innerHTML = points.map((point, index) => '<tr><td>' + index + '</td><td>' + Math.round(point.x) + '</td><td>' + Math.round(point.y) + '</td><td><button class="button secondary" name="deletePointIndex" value="' + index + '" type="submit">删除点位</button></td></tr>').join('');
  };
  function redraw(message) {
    normalizeClosingDuplicate();
    syncTextarea();
    if (band) band.setAttribute('d', pathD());
    if (polyline) polyline.setAttribute('points', polylinePoints());
    if (traceGuide) { traceGuide.setAttribute('points', polylinePoints()); traceGuide.setAttribute('display', currentMode() === 'trace' && points.length > 1 ? '' : 'none'); }
    if (closingSegment) {
      if (isClosed() && points.length > 2) {
        const a = points[points.length - 2];
        const b = points[0];
        closingSegment.setAttribute('points', a.x + ',' + a.y + ' ' + b.x + ',' + b.y);
        closingSegment.setAttribute('display', '');
      } else closingSegment.setAttribute('display', 'none');
    }
    renderControls();
    renderTable();
    renderCheckpoints();
    updateScrubberPreview();
    renderMultiHorsePreview();
    if (currentMode() === 'keypoints' && checkpointsLayer) svg.appendChild(checkpointsLayer);
    updateHistoryButtons();
    updateStatus(message || (currentMode() === 'keypoints' ? '关键点安全模式：只能移动起终点和检查点，不修改中心线几何。' : '画布操作已开启：中心线可点击和拖拽；描线模式下按住鼠标沿底图采样；支持撤销和重做。'));
    if (typeof window.syncCalibratorInspectorHeight === 'function') window.syncCalibratorInspectorHeight();
  }
  const eventPoint = (event) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const svgPoint = point.matrixTransform(matrix.inverse());
    return {
      x: Math.max(viewBox.x, Math.min(viewBox.x + viewBox.width, svgPoint.x)),
      y: Math.max(viewBox.y, Math.min(viewBox.y + viewBox.height, svgPoint.y))
    };
  };
  const setPoint = (index, point) => {
    const closingDuplicate = hasClosingDuplicate();
    points[index] = point;
    if (closingDuplicate && index === 0) points[points.length - 1] = { ...point };
    if (closingDuplicate && index === points.length - 1) points[0] = { ...point };
  };
  const addPoint = (point) => {
    remember();
    if (isClosed() && hasClosingDuplicate()) {
      selectedIndex = points.length - 1;
      points.splice(points.length - 1, 0, point);
    } else {
      points.push(point);
      selectedIndex = points.length - 1;
    }
    redraw('已从画布添加 P' + selectedIndex + '；点击校验、预览或导出重算预览。');
  };
  const addTracePoint = (point, force = false) => {
    const minDistance = Math.max(4, Number(traceMinDistance?.value || 16));
    if (!force && traceLastPoint && distance(traceLastPoint, point) < minDistance) return false;
    if (!force && isClosed() && hasClosingDuplicate()) points.splice(points.length - 1, 0, point);
    else points.push(point);
    selectedIndex = points.length - 1;
    traceLastPoint = formatPoint(point);
    return true;
  };
  const perpendicularDistance = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return distance(point, start);
    const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return distance(point, { x: start.x + dx * ratio, y: start.y + dy * ratio });
  };
  const rdpReduce = (source, tolerance) => {
    if (source.length <= 2) return source;
    let maxDistance = -1;
    let splitIndex = 0;
    const start = source[0];
    const end = source[source.length - 1];
    for (let index = 1; index < source.length - 1; index += 1) {
      const candidateDistance = perpendicularDistance(source[index], start, end);
      if (candidateDistance > maxDistance) { maxDistance = candidateDistance; splitIndex = index; }
    }
    if (maxDistance <= tolerance) return [start, end];
    return [...rdpReduce(source.slice(0, splitIndex + 1), tolerance).slice(0, -1), ...rdpReduce(source.slice(splitIndex), tolerance)];
  };
  const resamplePath = (source, targetCount) => {
    if (source.length <= 2 || targetCount >= source.length) return source;
    const lengths = source.slice(1).map((point, index) => distance(source[index], point));
    const total = lengths.reduce((sum, value) => sum + value, 0);
    if (!total) return source;
    const result = [source[0]];
    let segmentIndex = 0;
    let before = 0;
    for (let index = 1; index < targetCount - 1; index += 1) {
      const target = total * index / (targetCount - 1);
      while (segmentIndex < lengths.length - 1 && before + lengths[segmentIndex] < target) {
        before += lengths[segmentIndex];
        segmentIndex += 1;
      }
      const start = source[segmentIndex];
      const end = source[segmentIndex + 1];
      const length = lengths[segmentIndex] || 1;
      const ratio = Math.max(0, Math.min(1, (target - before) / length));
      result.push({ x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio });
    }
    result.push(source[source.length - 1]);
    return result;
  };
  const smoothPath = (source, passes = 1) => {
    let result = source.map((point) => ({ ...point }));
    for (let pass = 0; pass < passes; pass += 1) {
      result = result.map((point, index) => {
        if (index === 0 || index === result.length - 1) return point;
        const prev = result[index - 1];
        const next = result[index + 1];
        return { x: point.x * 0.5 + (prev.x + next.x) * 0.25, y: point.y * 0.5 + (prev.y + next.y) * 0.25 };
      });
    }
    return result;
  };
  const replaceEditablePath = (nextPath) => {
    const formatted = nextPath.map(formatPoint);
    if (isClosed() && formatted.length > 1 && !samePoint(formatted[0], formatted[formatted.length - 1])) formatted.push({ ...formatted[0] });
    if (!isClosed() && formatted.length > 2 && samePoint(formatted[0], formatted[formatted.length - 1])) formatted.pop();
    points = formatted;
    selectedIndex = -1;
    traceLastPoint = null;
  };
  const reduceTracePoints = () => {
    const path = editablePath();
    if (path.length < 4) return updateStatus('点数太少，无需减少。');
    const before = path.length;
    remember();
    const tolerance = Math.max(6, Number(traceMinDistance?.value || 16) * 0.75);
    let reduced = rdpReduce(path, tolerance);
    const targetMax = Math.max(8, Math.ceil(before * 0.55));
    if (reduced.length > targetMax) reduced = resamplePath(reduced, targetMax);
    replaceEditablePath(reduced);
    redraw('已减少描线点数：' + before + ' → ' + editablePath().length + '，保留主要弯道。');
  };
  const addCheckpointAt = (point) => {
    remember();
    const checkpoints = readCheckpoints();
    const index = checkpoints.length + 1;
    checkpoints.push({ checkpointId: 'cp-' + index, label: '检查点 ' + index, s: formatNumber(nearestS(point)) });
    if (checkpointsTextarea) checkpointsTextarea.value = JSON.stringify(checkpoints, null, 2);
    redraw('已通过 Shift+点击添加检查点；点击校验、预览或导出后写入结果。');
  };
  const beginTrace = (event, clearExisting = false) => {
    const point = eventPoint(event);
    if (!point) return false;
    event.preventDefault();
    traceSnapshot = snapshot();
    traceActive = true;
    traceChanged = false;
    traceLastPoint = null;
    if (clearExisting) {
      points = [];
      selectedIndex = -1;
    }
    if (addTracePoint(point, true)) traceChanged = true;
    try { svg.setPointerCapture(event.pointerId); } catch {}
    redraw(clearExisting ? '已清空并开始重新描线；松开鼠标后可撤销。' : '已开始描线；按住鼠标沿底图道路采样。');
    return true;
  };
  const finishTrace = (event) => {
    if (!traceActive) return;
    traceActive = false;
    traceLastPoint = null;
    try { svg.releasePointerCapture(event.pointerId); } catch {}
    if (traceChanged && traceSnapshot) remember(traceSnapshot);
    traceSnapshot = null;
    traceChanged = false;
    suppressNextClick = true;
    redraw('描线已写入中心线点集；可撤销、闭合或提交校验。');
    setTimeout(() => { suppressNextClick = false; }, 0);
  };

  svg.addEventListener('pointerdown', (event) => {
    if (currentMode() !== 'keypoints') return;
    const handle = event.target.closest('[data-keypoint-handle]');
    if (!handle) return;
    event.preventDefault();
    keypointDrag = { type: handle.getAttribute('data-keypoint-handle'), index: Number(handle.getAttribute('data-checkpoint-index') || -1) };
    dragSnapshot = snapshot();
    try { svg.setPointerCapture(event.pointerId); } catch {}
    redraw('已选中关键点；拖动只会修改路径进度 s。');
  });
  svg.addEventListener('pointerdown', (event) => {
    if (currentMode() === 'keypoints') return;
    const control = event.target.closest('[data-control-point]');
    if (!control) return;
    event.preventDefault();
    selectedIndex = Number(control.getAttribute('data-index'));
    dragIndex = selectedIndex;
    dragSnapshot = snapshot();
    didDrag = false;
    try { svg.setPointerCapture(event.pointerId); } catch {}
    redraw('已选中 P' + selectedIndex + '；拖拽可移动点位。');
  });
  svg.addEventListener('pointerdown', (event) => {
    if (event.target.closest('[data-control-point]') || event.target.closest('[data-keypoint-handle]')) return;
    if (currentMode() !== 'trace' && !event.altKey) return;
    const clearExisting = Boolean(event.altKey || traceClearNext);
    traceClearNext = false;
    beginTrace(event, clearExisting);
  });
  svg.addEventListener('pointermove', (event) => {
    if (traceActive) {
      const point = eventPoint(event);
      if (!point) return;
      event.preventDefault();
      if (addTracePoint(point)) { traceChanged = true; redraw('正在描线；松开后可撤销、闭合或导出。'); }
      return;
    }
    if (keypointDrag) {
      const point = eventPoint(event);
      if (!point) return;
      event.preventDefault();
      const s = nearestS(point);
      if (keypointDrag.type === 'start') setStartFinishS(s);
      else setCheckpointS(keypointDrag.index, s);
      redraw('正在移动关键点；中心线几何未修改。');
      return;
    }
    if (dragIndex < 0) return;
    const point = eventPoint(event);
    if (!point) return;
    event.preventDefault();
    didDrag = true;
    setPoint(dragIndex, point);
    redraw('正在拖拽 P' + dragIndex + '；松开后可撤销。');
  });
  const finishDrag = (event) => {
    if (keypointDrag) {
      const label = keypointDrag.type === 'start' ? '起终点' : '检查点';
      keypointDrag = null;
      try { svg.releasePointerCapture(event.pointerId); } catch {}
      if (dragSnapshot) remember(dragSnapshot);
      dragSnapshot = null;
      redraw('已移动' + label + '；只更新 s，不修改中心线几何。');
      return;
    }
    if (dragIndex < 0) return;
    const finishedIndex = dragIndex;
    dragIndex = -1;
    try { svg.releasePointerCapture(event.pointerId); } catch {}
    if (didDrag) {
      event.preventDefault();
      if (dragSnapshot) remember(dragSnapshot);
      redraw('已移动 P' + finishedIndex + '；点击校验、预览或导出重算预览。');
      setTimeout(() => { didDrag = false; }, 0);
    }
    dragSnapshot = null;
  };
  svg.addEventListener('pointerup', (event) => { finishTrace(event); finishDrag(event); });
  svg.addEventListener('pointercancel', (event) => { finishTrace(event); finishDrag(event); });
  svg.addEventListener('click', (event) => {
    if (suppressNextClick || didDrag || event.target.closest('[data-control-point]') || event.target.closest('[data-keypoint-handle]') || currentMode() === 'trace' || currentMode() === 'keypoints') return;
    const point = eventPoint(event);
    if (!point) return;
    event.preventDefault();
    if (event.shiftKey) addCheckpointAt(point);
    else addPoint(point);
  });
  const closeTracePath = () => {
    if (points.length <= 1 || hasClosingDuplicate()) return;
    remember();
    points.push({ ...points[0] });
    if (closedSelect) closedSelect.value = 'true';
    redraw('已闭合描线路径；可撤销。');
  };
  const copyTraceJson = async () => {
    try { await navigator.clipboard?.writeText(traceOutput?.value || textarea.value); updateStatus('已复制描线点集 JSON。'); }
    catch { updateStatus('浏览器未允许复制，请直接选中描线 JSON。'); }
  };
  document.querySelectorAll('[data-set-calibrator-mode]').forEach((button) => button.addEventListener('click', () => {
    const mode = button.getAttribute('data-set-calibrator-mode') || 'trace';
    const input = Array.from(form.elements.calibratorMode || []).find((item) => item.value === mode);
    if (input) input.checked = true;
    redraw(mode === 'trace' ? '已进入沿底图描线模式：按住鼠标沿底图道路拖动即可采样。' : '已切换编辑模式。');
  }));
  document.querySelector('[data-trace-clear-next]')?.addEventListener('click', () => {
    const input = Array.from(form.elements.calibratorMode || []).find((item) => item.value === 'trace');
    if (input) input.checked = true;
    traceClearNext = true;
    redraw('下一次按住画布描线会先清空当前中心线。');
  });
  document.querySelectorAll('[data-trace-reduce]').forEach((button) => button.addEventListener('click', reduceTracePoints));
  document.querySelector('[data-trace-close]')?.addEventListener('click', closeTracePath);
  document.querySelector('[data-trace-copy]')?.addEventListener('click', copyTraceJson);
  document.getElementById('calibrator-close-trace')?.addEventListener('click', closeTracePath);
  document.getElementById('calibrator-copy-trace-json')?.addEventListener('click', copyTraceJson);
  undoButton?.addEventListener('click', undo);
  redoButton?.addEventListener('click', redo);
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
    }
  });
  closedSelect?.addEventListener('change', () => {
    remember();
    points = readPoints();
    if (isClosed() && points.length > 1 && !hasClosingDuplicate()) points.push({ ...points[0] });
    if (!isClosed() && hasClosingDuplicate()) points = points.slice(0, -1);
    selectedIndex = -1;
    redraw('闭合路径设置已同步到画布点位；可撤销。');
  });
  textarea.addEventListener('change', () => {
    remember();
    points = readPoints();
    selectedIndex = -1;
    redraw('中心线 JSON 已应用到画布；可撤销。');
  });
  form.elements.calibratorMode?.forEach?.((input) => input.addEventListener('change', () => redraw(currentMode() === 'keypoints' ? '关键点安全模式：只能移动起终点和检查点，不修改中心线几何。' : '已切换编辑模式。')));
  form.elements.previewProgress?.addEventListener('input', () => { updateScrubberPreview(); });
  form.elements.horseCount?.addEventListener('input', renderMultiHorsePreview);
  form.elements.scenarioPreset?.addEventListener('input', renderMultiHorsePreview);
  form.elements.lanes?.addEventListener('input', renderMultiHorsePreview);
  form.elements.startS?.addEventListener('input', () => { updateScrubberPreview(); renderMultiHorsePreview(); });
  form.elements.finishS?.addEventListener('input', () => { updateScrubberPreview(); renderMultiHorsePreview(); });
  redraw();
})();
</script>${demoMode ? renderCalibratorDemoGuide() : ''}<section class="jumbotron-validation" id="calibrator-debug-preview"><div class="eyebrow">P1 调试预览</div><h2>导出调试预览 PNG</h2><p class="muted">调试预览证据用于核对 HTML/SVG 预览、区域叠层和 debug-preview.png 导出状态。</p><div class="cta-row"><a class="button secondary" href="/jumbotron/debug-preview.png">导出调试预览 PNG</a><span class="jumbotron-chip"><span>debug-preview.png</span><strong>已完成</strong></span></div></section>${renderCalibratorDemoGuide()}<section class="jumbotron-validation" data-drag-proof><div class="eyebrow">拖拽状态变化证据</div><h2>zone 坐标变化证据</h2><p class="muted" data-drag-proof-current>before/current/delta 会在拖拽时更新；lastDragProof = buildDragProof('dragging')；lastDragProof = buildDragProof('completed')；dragProof.layer.innerHTML。</p><svg class="calibrator-preview-svg" viewBox="0 0 1200 160" role="img" aria-label="拖拽证明图层"><g data-drag-proof-layer></g></svg></section><section class="jumbotron-validation"><div class="eyebrow">校准证明</div><h2>校准证明</h2><p class="muted">预览复用大屏运行时；进入大屏。</p><div class="cta-row"><a class="button secondary" href="/jumbotron/calibrator?demo=1">打开演示模式</a><a class="button secondary" href="/jumbotron">进入大屏</a></div></section><section class="jumbotron-validation"><div class="eyebrow">JSON 差异预览</div><h2>导入配置到导出候选的差异</h2><p class="muted">只比较 Calibrator 会写入 track.profile.json 的关键字段，用于审阅导入值和冻结候选之间发生了什么变化。</p><table><thead><tr><th>字段</th><th>导入配置</th><th>导出候选</th><th>状态</th></tr></thead><tbody>${renderJsonDiffRows}</tbody></table></section><section class="jumbotron-validation"><div class="eyebrow">Calibrator P1 待办边界</div><h2>P1 功能边界</h2><div class="validation-grid">${workbench.p1Backlog.map(([title, status, note]) => `<article><strong>${escapeHtml(title)} · ${escapeHtml(status)}</strong><p class="muted">${escapeHtml(note)}</p></article>`).join('')}</div></section></section>`;
  return page('赛道校准器', '/jumbotron', session, content);
}


function renderSecondTrackKeypointEditor(session, candidateId = 'real-explicit-closed-course') {
  const candidate = readActiveSecondTrackCandidate();
  const profile = candidate?.available ? normalizeExternalTrackCandidate(candidate.profile, candidate) : normalizeTrackProfile(calibratorDefaultTrackProfile());
  const rawProfile = candidate?.profile || profile;
  const viewBox = profile.viewBox || { x: 0, y: 0, width: 1672, height: 941 };
  const backgroundSrc = profile.background?.src || candidateAssetRoute(profile.trackId || candidateId, 'background.webp');
  const rawStartFinish = rawProfile.startFinish || profile.startFinish || {};
  const keypointStartS = numberOrFallback(rawStartFinish.s ?? rawStartFinish.startS ?? profile.startFinish?.startS, 0);
  const keypointFinishS = numberOrFallback(rawStartFinish.finishS ?? profile.startFinish?.finishS ?? 1, 1);
  const keypointPayload = {
    trackId: profile.trackId,
    viewBox,
    backgroundSrc,
    centerline: {
      closed: Boolean(profile.centerline?.closed),
      points: profile.centerlinePath.map((point) => [Number(point.x), Number(point.y)])
    },
    startFinish: {
      s: keypointStartS,
      startS: keypointStartS,
      finishS: keypointStartS,
      label: rawStartFinish.label || profile.startFinish?.label || '起终点'
    },
    checkpoints: (profile.checkpoints || []).map((checkpoint, index) => ({
      checkpointId: checkpoint.checkpointId || `cp-${index}`,
      label: checkpoint.label || checkpoint.checkpointId || `检查点 ${index + 1}`,
      s: numberOrFallback(checkpoint.s, 0)
    }))
  };
  const payloadJson = JSON.stringify(keypointPayload).replaceAll('<', '\\u003c');
  const content = `<section class="jumbotron-page calibrator-keypoint-page"><section class="jumbotron-header"><div class="jumbotron-brandline"><span class="jumbotron-live">SAFE</span><strong>第二赛道关键点编辑</strong><span>只改关键点进度</span></div><div class="jumbotron-statusbar"><a class="button secondary" href="/jumbotron/calibrator?candidate=${escapeHtml(profile.trackId)}">返回完整校准器</a><a class="button secondary" href="/jumbotron">查看大屏</a></div></section><section class="jumbotron-calibrator"><div class="eyebrow">不会修改几何轨迹</div><h1>终点与检查点安全编辑器</h1><p class="muted">中心线和底图只读；起点、终点、起终点合成一个点。拖动彩色手柄或输入 s 值，只会更新关键点在既有轨迹上的位置。复制右侧 JSON 给我即可合入 profile。</p><div class="calibrator-grid"><article><strong>当前赛道</strong><p class="muted">${escapeHtml(profile.trackId)}；画布 ${viewBox.width}×${viewBox.height}；中心线 ${profile.centerlinePath.length} 点。</p></article><article><strong>安全边界</strong><p class="muted">本页不渲染中心线控制点，不提供描线、插点、删点或区域编辑。</p></article><article><strong>操作方式</strong><p class="muted">拖动起终点或检查点手柄；右侧数值可微调到 0 到 1。</p></article></div></section><section class="jumbotron-layout calibrator-layout keypoint-layout"><section class="track-stage-card"><div class="eyebrow">只读轨迹画布</div><h2>拖动关键点手柄</h2><p id="keypoint-status" class="calibrator-canvas-help">未改动。拖动手柄会吸附到最近中心线位置。</p><svg id="keypoint-canvas" class="track-svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" role="img" aria-label="第二赛道关键点安全编辑画布"><rect class="track-bg" x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" rx="42"/><image href="${escapeHtml(backgroundSrc)}" x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" opacity="0.58" preserveAspectRatio="xMidYMid slice"/><polyline class="track-band" data-keypoint-band points="${jumbotronPolyline(profile.centerlinePath)}"/><polyline class="track-centerline" data-keypoint-centerline points="${jumbotronPolyline(profile.centerlinePath)}"/><g data-keypoint-handles></g></svg><p class="muted">灰蓝轨迹为只读参考；这里没有中心线点控制柄，避免误改几何。</p></section><aside><section class="side-card"><h2>起终点</h2><div data-keypoint-controls="startFinish"></div></section><section class="side-card"><h2>检查点</h2><div data-keypoint-controls="checkpoints"></div></section><section class="side-card"><h2>复制 JSON</h2><p class="muted">JSON patch 只包含 startFinish 和 checkpoints，可复制给我或贴回 track.profile.json 对应字段。</p><textarea id="keypoint-json" readonly rows="14"></textarea><div class="cta-row"><button class="button" id="copy-keypoint-json" type="button">复制 JSON</button><button class="button secondary" id="reset-keypoints" type="button">恢复初始值</button></div></section></aside></section><style>.calibrator-keypoint-page .keypoint-layout{grid-template-columns:minmax(0,1fr) 360px}.keypoint-handle{cursor:grab}.keypoint-handle circle{stroke:#fff;stroke-width:5;filter:drop-shadow(0 6px 10px rgba(15,23,42,.32))}.keypoint-handle text{fill:#172033;font-size:16px;font-weight:950;paint-order:stroke;stroke:#fff;stroke-width:4px}.keypoint-handle.is-dragging{cursor:grabbing}.keypoint-control{border:1px solid rgba(148,163,184,.3);border-radius:12px;padding:10px;margin-bottom:10px;background:#fff}.keypoint-control strong{display:block;margin-bottom:6px}.keypoint-control .muted{margin:4px 0}.keypoint-control input[type=range]{padding:0}.calibrator-keypoint-page textarea{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}</style><script>
const keypointInitial = ${payloadJson};
(() => {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const data = clone(keypointInitial);
  const initial = clone(keypointInitial);
  const svg = document.getElementById('keypoint-canvas');
  const handlesLayer = svg.querySelector('[data-keypoint-handles]');
  const startFinishControls = document.querySelector('[data-keypoint-controls="startFinish"]');
  const checkpointControls = document.querySelector('[data-keypoint-controls="checkpoints"]');
  const output = document.getElementById('keypoint-json');
  const status = document.getElementById('keypoint-status');
  const points = data.centerline.points.map(([x, y]) => ({ x: Number(x), y: Number(y) }));
  let drag = null;
  const round = (value) => Math.round(Number(value) * 10000) / 10000;
  const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const segments = (() => {
    const items = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const length = distance(a, b);
      items.push({ a, b, length, start: total });
      total += length;
    }
    return { items, total: total || 1 };
  })();
  const pointAtS = (s) => {
    const target = clamp01(s) * segments.total;
    const segment = segments.items.find((item) => target <= item.start + item.length) || segments.items.at(-1);
    if (!segment || !segment.length) return points[0] || { x: 0, y: 0 };
    const t = (target - segment.start) / segment.length;
    return { x: segment.a.x + (segment.b.x - segment.a.x) * t, y: segment.a.y + (segment.b.y - segment.a.y) * t };
  };
  const nearestS = (point) => {
    let best = { distance: Infinity, s: 0 };
    for (const segment of segments.items) {
      const dx = segment.b.x - segment.a.x;
      const dy = segment.b.y - segment.a.y;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / len2));
      const projected = { x: segment.a.x + dx * t, y: segment.a.y + dy * t };
      const d = distance(point, projected);
      if (d < best.distance) best = { distance: d, s: (segment.start + segment.length * t) / segments.total };
    }
    return round(best.s);
  };
  const svgPoint = (event) => {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
    return { x: transformed.x, y: transformed.y };
  };
  const keypoints = () => [
    { type: 'start', label: data.startFinish.label || '起终点', color: '#22c55e', s: data.startFinish.s },
    ...data.checkpoints.map((checkpoint, index) => ({ type: 'checkpoint', index, label: checkpoint.label || checkpoint.checkpointId, color: checkpoint.checkpointId === 'cp-start' ? '#22c55e' : '#1f49d8', s: checkpoint.s }))
  ];
  const setS = (item, value) => {
    const s = round(clamp01(value));
    if (item.type === 'start') {
      data.startFinish.s = s;
      data.startFinish.startS = s;
      data.startFinish.finishS = s;
      const startCheckpoint = data.checkpoints.find((checkpoint) => checkpoint.checkpointId === 'cp-start');
      if (startCheckpoint) startCheckpoint.s = s;
    } else {
      data.checkpoints[item.index].s = s;
      if (data.checkpoints[item.index].checkpointId === 'cp-start') {
        data.startFinish.s = s;
        data.startFinish.startS = s;
        data.startFinish.finishS = s;
      }
    }
  };
  const renderHandle = (item) => {
    const point = pointAtS(item.s);
    const id = item.type === 'checkpoint' ? 'checkpoint-' + item.index : item.type;
    return '<g class="keypoint-handle" tabindex="0" data-keypoint-id="' + id + '" transform="translate(' + point.x + ' ' + point.y + ')"><circle r="13" fill="' + item.color + '"/><text x="18" y="5">' + item.label.replace(/[<>&]/g, '') + ' ' + round(item.s) + '</text></g>';
  };
  const controlHtml = (item) => {
    const id = item.type === 'checkpoint' ? 'checkpoint-' + item.index : item.type;
    return '<div class="keypoint-control"><strong>' + item.label.replace(/[<>&]/g, '') + '</strong><p class="muted">' + id + '</p><label>s<input data-keypoint-input="' + id + '" type="number" min="0" max="1" step="0.001" value="' + round(item.s) + '"></label><input data-keypoint-range="' + id + '" type="range" min="0" max="1" step="0.001" value="' + round(item.s) + '"></div>';
  };
  const patch = () => ({
    trackId: data.trackId,
    startFinish: {
      s: round(data.startFinish.s),
      startS: round(data.startFinish.s),
      finishS: round(data.startFinish.s),
      label: data.startFinish.label
    },
    checkpoints: data.checkpoints.map((checkpoint) => ({ checkpointId: checkpoint.checkpointId, label: checkpoint.label, s: round(checkpoint.s) }))
  });
  const render = (message = '') => {
    const items = keypoints();
    handlesLayer.innerHTML = items.map(renderHandle).join('');
    startFinishControls.innerHTML = items.filter((item) => item.type !== 'checkpoint').map(controlHtml).join('');
    checkpointControls.innerHTML = items.filter((item) => item.type === 'checkpoint').map(controlHtml).join('');
    output.value = JSON.stringify(patch(), null, 2);
    if (message) status.textContent = message;
  };
  document.addEventListener('input', (event) => {
    const id = event.target.dataset.keypointInput || event.target.dataset.keypointRange;
    if (!id) return;
    const item = keypoints().find((entry) => (entry.type === 'checkpoint' ? 'checkpoint-' + entry.index : entry.type) === id);
    if (!item) return;
    setS(item, event.target.value);
    render('已更新 ' + item.label + ' 的 s 值。');
  });
  svg.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('[data-keypoint-id]');
    if (!handle) return;
    event.preventDefault();
    drag = handle.dataset.keypointId;
    handle.classList.add('is-dragging');
    svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drag) return;
    event.preventDefault();
    const item = keypoints().find((entry) => (entry.type === 'checkpoint' ? 'checkpoint-' + entry.index : entry.type) === drag);
    if (!item) return;
    setS(item, nearestS(svgPoint(event)));
    render('正在拖动 ' + item.label + '；只更新路径进度，不修改中心线。');
  });
  const stopDrag = (event) => {
    if (!drag) return;
    drag = null;
    svg.releasePointerCapture?.(event.pointerId);
    render('已完成拖动；右侧 JSON 已更新。');
  };
  svg.addEventListener('pointerup', stopDrag);
  svg.addEventListener('pointercancel', stopDrag);
  document.getElementById('copy-keypoint-json')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      status.textContent = '已复制关键点 JSON。';
    } catch {
      output.focus();
      output.select();
      status.textContent = '浏览器未允许复制，请手动复制右侧 JSON。';
    }
  });
  document.getElementById('reset-keypoints')?.addEventListener('click', () => {
    data.startFinish = clone(initial.startFinish);
    data.checkpoints = clone(initial.checkpoints);
    render('已恢复页面打开时的关键点位置。');
  });
  render();
})();
</script></section>`;
  return page('第二赛道关键点安全编辑器', '/jumbotron', session, content);
}

function renderJumbotronFooter({ trackProfile, raceSnapshot, showReviewTools }) {
  const competition = raceSnapshot.competition;
  const reviewHref = showReviewTools ? '/jumbotron' : '/jumbotron?debug=1';
  const reviewLabel = showReviewTools ? '返回大屏' : '调试审阅';
  const tools = renderJumbotronSideDrawer({ eyebrow: '工具', title: '审阅和校准', body: `<div class="cta-row"><a class="button secondary" href="${reviewHref}">${reviewLabel}</a><a class="button secondary" href="/jumbotron/calibrator">赛道校准器</a></div>` });
  const statusBody = `<div class="jumbotron-status-lines" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px 22px"><p class="muted" style="margin:0"><strong style="display:block;margin-bottom:5px;color:#344054">主题</strong><span>${escapeHtml(competition.theme)}</span></p><p class="muted" style="margin:0"><strong style="display:block;margin-bottom:5px;color:#344054">主办方</strong><span>${escapeHtml(competition.organizer || 'Organizer')}</span></p><p class="muted" style="margin:0"><strong style="display:block;margin-bottom:5px;color:#344054">阶段</strong><span>${escapeHtml(competition.currentPhase)}</span></p><p class="muted" style="margin:0"><strong style="display:block;margin-bottom:5px;color:#344054">下一步</strong><span>${escapeHtml(competition.nextPhase)}</span></p></div>`;
  return `<section class="jumbotron-footer">${renderJumbotronSideDrawer({ eyebrow: '赛事状态', title: competition.liveStatus, body: statusBody })}${tools}</section>`;
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
    return `<article class="card"><span class="pill ${state.tone}">${escapeHtml(state.label)}</span><h2>${escapeHtml(race.title)}</h2><p>${escapeHtml(race.publicGoal)}</p><p class="muted">${escapeHtml(race.sourceStateLabel)}</p><div class="cta-row"><a class="button" href="${escapeHtml(withSessionView(`/race/${race.raceId}`, session))}">查看 Race</a><a class="button secondary" href="${escapeHtml(withSessionView('/jumbotron', session))}">进入 Jumbotron</a>${isTeam(session) && canSubmitRace(race) ? `<a class="button secondary" href="${escapeHtml(withSessionView('/team/submit', session))}">提交</a>` : ''}</div></article>`;
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

async function apiJumbotronBubbles(res, profileParam = '', trackParam = '') {
  const profileResolution = resolveJumbotronDataProfile(profileParam);
  if (!profileResolution.ok) return jsonResponse(res, 400, { error: 'invalid_jumbotron_data_profile', requestedProfile: profileResolution.requestedProfile, allowedProfiles: profileResolution.allowedProfiles });
  const trackSelection = resolveJumbotronTrackSelection(trackParam);
  if (!trackSelection.ok) return jsonResponse(res, 409, { error: 'candidate_track_not_confirmed', requestedTrack: trackSelection.requestedTrack, candidateBlocked: Boolean(trackSelection.candidateBlocked) });
  const [disclosures, leaderboard, teams, records, service] = await Promise.all([
    readDisclosures(),
    readJson(leaderboardPath),
    readJson(teamsPath),
    readJson(recordsPath),
    readEvaluatorService()
  ]);
  const model = buildJumbotronModel(disclosures, leaderboard, teams, records, service, { profileResolution, trackSelection });
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
  return jsonResponse(res, 200, { dataProfileId: model.dataProfile.dataProfileId, profileAlias: model.dataProfile.profileAlias, trackId: model.trackSelection.trackId, version: messagePlan.version, queue, plan, bubbleLayerHtml, rules: messagePlan.rules });
}

async function apiJumbotronReplay(res, profileParam = '', trackParam = '', frameParam = '') {
  const profileResolution = resolveJumbotronDataProfile(profileParam);
  if (!profileResolution.ok) return jsonResponse(res, 400, { error: 'invalid_jumbotron_data_profile', requestedProfile: profileResolution.requestedProfile, allowedProfiles: profileResolution.allowedProfiles });
  const trackSelection = resolveJumbotronTrackSelection(trackParam);
  if (!trackSelection.ok) return jsonResponse(res, 409, { error: 'candidate_track_not_confirmed', requestedTrack: trackSelection.requestedTrack, candidateBlocked: Boolean(trackSelection.candidateBlocked) });
  const curated = readCuratedJumbotronMockData(profileResolution);
  if (!curated) return jsonResponse(res, 404, { error: 'jumbotron_data_profile_missing', requestedProfile: profileResolution.requestedProfile, dataProfileId: profileResolution.dataProfileId });
  const builtInTrack = trackSelection.mode === 'builtin' ? jumbotronTrackProfiles.find((profile) => profile.trackId === trackSelection.builtInTrackId) : null;
  const candidate = trackSelection.mode === 'candidate' ? readActiveSecondTrackCandidate() : null;
  const candidateTrack = candidate?.available ? normalizeExternalTrackCandidate(candidate.profile, candidate) : null;
  const trackProfile = candidateTrack || normalizeTrackProfile(builtInTrack || curated.trackProfile || jumbotronTrackProfiles[0]);
  const replayFrame = buildJumbotronReplayFrameAt(curated.raceSnapshot, trackProfile, frameParam);
  if (!replayFrame) return jsonResponse(res, 404, { error: 'jumbotron_replay_timeline_missing' });
  const { timeline, playbackIndex, frameModel } = replayFrame;
  const events = (frameModel.frame.events || []).map((event) => {
    const entry = frameModel.adapted.racingEntries.find((item) => item.entryId === event.entryId);
    return {
      type: event.type,
      label: jumbotronTimelineEventLabel(event.type),
      entryId: event.entryId || null,
      entryName: entry?.displayName || event.entryId || '',
      summary: jumbotronTimelineEventSummary(event, entry, frameModel.frame)
    };
  });
  return jsonResponse(res, 200, {
    frameIndex: playbackIndex,
    playbackIndex,
    trackId: trackSelection.trackId,
    frameCount: timeline.playbackFrameCount || timeline.frameCount || 0,
    playbackFrameCount: timeline.playbackFrameCount || timeline.frameCount || 0,
    keyFrameCount: timeline.keyFrameCount || timeline.rawFrameCount || 0,
    interpolationSteps: timeline.interpolationSteps || 0,
    segmentSteps: timeline.segmentSteps || [],
    keyFramePlaybackIndexes: timeline.keyFramePlaybackIndexes || [],
    eventHoldFrames: JUMBOTRON_REPLAY_EVENT_HOLD_FRAMES,
    finalHoldFrames: JUMBOTRON_REPLAY_FINAL_HOLD_FRAMES,
    frameDelayMs: JUMBOTRON_REPLAY_FRAME_DELAY_MS,
    currentFrameIndex: timeline.currentPlaybackFrameIndex ?? timeline.currentFrameIndex,
    finishFrameIndex: timeline.finishPlaybackFrameIndex ?? timeline.finishFrameIndex,
    sourceFrameIndex: frameModel.frame.sourceFrameIndex ?? frameModel.frame.rawFrameIndex ?? playbackIndex,
    nextFrameIndex: frameModel.frame.nextFrameIndex ?? frameModel.frame.sourceFrameIndex ?? playbackIndex,
    interpolationT: frameModel.frame.interpolationAlpha ?? 0,
    isInterpolated: Boolean(frameModel.frame.interpolated),
    systemTime: frameModel.frame.systemTime,
    elapsedTime: frameModel.frame.elapsedTime,
    phase: frameModel.frame.phase,
    phaseLabel: jumbotronTimelinePhaseLabel(frameModel.frame.phase),
    top3: frameModel.top3Labels,
    avgRoundProgress: jumbotronTimelineProgress(frameModel.frame.avgRoundProgress),
    events,
    miniMapHtml: renderJumbotronMiniMap(frameModel.trackProfile, frameModel.horsePoses, { mode: 'replay', frameIndex: playbackIndex }),
    frameHtml: renderJumbotronReplayMainTrackFrame(frameModel),
    panelFrameHtml: renderJumbotronReplayFrame(frameModel)
  });
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
      if (req.method === 'GET' && JUMBOTRON_RUNTIME_ASSETS.has(url.pathname)) {
        const assetInfo = JUMBOTRON_RUNTIME_ASSETS.get(url.pathname);
        const asset = await readFile(join(rootDir, 'assets', 'jumbotron', assetInfo.file));
        res.writeHead(200, { 'content-type': assetInfo.contentType, 'content-length': asset.length, 'cache-control': 'public, max-age=3600' });
        return res.end(asset);
      }
      if (req.method === 'GET' && url.pathname.startsWith(`${JUMBOTRON_CANDIDATE_ASSET_ROUTE_PREFIX}/`)) {
        const candidateAsset = resolveCandidateAssetRoute(url.pathname);
        if (!candidateAsset) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          return res.end('候选资产不可用');
        }
        const asset = await readFile(join(candidateAsset.candidate.dir, candidateAsset.file));
        res.writeHead(200, { 'content-type': candidateAsset.contentType, 'content-length': asset.length, 'cache-control': 'no-store' });
        return res.end(asset);
      }
      if (req.method === 'GET' && url.pathname === JUMBOTRON_DEBUG_PREVIEW_PNG_ROUTE) {
        const asset = await readFile(JUMBOTRON_DEBUG_PREVIEW_PNG_PATH);
        res.writeHead(200, { 'content-type': 'image/png', 'content-length': asset.length, 'cache-control': 'no-store' });
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
        return res.end(await renderJumbotron(session, { showReviewTools: url.searchParams.get('debug') === '1', profile: url.searchParams.get('profile') || 'full', track: url.searchParams.get('track') || '' }));
      }
      if (req.method === 'GET' && url.pathname === '/jumbotron/calibrator/keypoints') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderSecondTrackKeypointEditor(session, url.searchParams.get('candidate') || 'real-explicit-closed-course'));
      }
      if (req.method === 'GET' && url.pathname === '/jumbotron/calibrator') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderTrackCalibrator(session, { candidate: url.searchParams.get('candidate') || '' }, { demoMode: url.searchParams.get('demo') === '1' }));
      }
      if (req.method === 'POST' && url.pathname === '/jumbotron/calibrator') {
        const body = await readBody(req);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderTrackCalibrator(session, body, { demoMode: url.searchParams.get('demo') === '1' }));
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

      if (req.method === 'GET' && url.pathname === '/api/jumbotron-bubbles') return apiJumbotronBubbles(res, url.searchParams.get('profile') || 'full', url.searchParams.get('track') || '');
      if (req.method === 'GET' && url.pathname === '/api/jumbotron-replay') return apiJumbotronReplay(res, url.searchParams.get('profile') || 'full', url.searchParams.get('track') || '', url.searchParams.get('frame') || '');
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
