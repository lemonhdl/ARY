import { createServer } from 'node:http';
import { join } from 'node:path';
import { aryStoreDir, organizerDir, readJson, listFiles, jsonResponse, readBody } from './storage.js';

const racesPath = join(aryStoreDir, 'races.json');
const raceLifecyclePath = join(aryStoreDir, 'race_lifecycle.json');
const ridingRecordsPath = join(aryStoreDir, 'riding_records.json');
const ridingRecordStepsPath = join(aryStoreDir, 'riding_record_steps.json');
const recordReplayEventsPath = join(aryStoreDir, 'record_replay_events.json');

const primaryAryEvidenceFiles = [
  'races.json',
  'race_lifecycle.json',
  'riding_records.json',
  'riding_record_steps.json',
  'record_replay_events.json'
];

const primaryOrganizerEvidenceFiles = [
  'private_race.json',
  'agent_session_sources.json',
  'private_review_notes.json'
];

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function page(title, active, content) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root{--ink:#111827;--muted:#64748b;--line:#e2e8f0;--bg:#f6f8fc;--card:#fff;--blue:#315cff;--blue2:#6c8cff;--navy:#111b3d;--green:#14a46c;--green-bg:#eafaf2;--amber:#b7791f;--amber-bg:#fff7db;--red:#d64545;--red-bg:#fff0f0;--purple:#6d28d9;--purple-bg:#f4efff;--shadow:0 18px 45px rgba(15,23,42,.10)}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#e9efff,transparent 34rem),var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:1180px;margin:0 auto;padding:26px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.brand{display:flex;align-items:center;gap:10px;font-weight:900}.mark{width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,var(--blue),#00b894);box-shadow:var(--shadow)}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a{color:#334155;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:999px;padding:9px 14px;font-weight:800}.nav a.active{background:var(--navy);color:#fff;border-color:var(--navy)}.hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:22px;align-items:stretch;margin-bottom:22px}.hero-main,.hero-side,.card{background:rgba(255,255,255,.94);border:1px solid rgba(226,232,240,.9);border-radius:26px;box-shadow:var(--shadow)}.hero-main{padding:34px;background:linear-gradient(135deg,#111b3d,#315cff);color:#fff;position:relative;overflow:hidden}.hero-main:after{content:"";position:absolute;right:-80px;top:-80px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.13)}.eyebrow{letter-spacing:.12em;text-transform:uppercase;font-size:12px;font-weight:900;color:#bcd0ff}.hero h1{font-size:42px;line-height:1.08;margin:10px 0}.hero p{color:#dbe6ff;font-size:16px;line-height:1.7;max-width:780px}.hero-side{padding:24px}.hero-side h2{margin:0 0 14px}.metric{display:grid;grid-template-columns:1fr 1fr;gap:10px}.metric div{background:#f8fafc;border:1px solid var(--line);border-radius:18px;padding:14px}.metric strong{display:block;font-size:24px}.cta-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.button{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:14px;padding:12px 16px;background:var(--blue);color:#fff;font-weight:900;text-decoration:none;cursor:pointer;box-shadow:0 12px 24px rgba(49,92,255,.24)}.button.secondary{background:#fff;color:var(--navy);box-shadow:none}.button:hover,.nav a:hover{transform:translateY(-1px)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.card{padding:20px}.card h2,.card h3{margin:0 0 12px}.muted{color:var(--muted);line-height:1.7}.pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;background:#edf2ff;color:#2446d8}.pill.green{background:var(--green-bg);color:#117b52}.pill.amber{background:var(--amber-bg);color:var(--amber)}.pill.red{background:var(--red-bg);color:var(--red)}.pill.purple{background:var(--purple-bg);color:var(--purple)}.pill.gray{background:#f1f5f9;color:#475569}.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.step{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px}.step span{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:999px;background:var(--navy);color:white;font-weight:900;font-size:12px;margin-right:6px}.boundary{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.boundary .card{min-height:260px}.boundary ul,.card ul{padding-left:20px;line-height:1.8}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#0f172a;color:#dbeafe;border-radius:18px;padding:16px;white-space:pre-wrap;overflow:auto;max-height:360px}.snapshot summary{cursor:pointer;font-weight:900;color:var(--navy);margin-bottom:10px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:18px;overflow:hidden;border:1px solid var(--line)}th,td{padding:13px;border-bottom:1px solid #eef2f7;text-align:left;vertical-align:top}th{background:#f1f5ff;color:#243b83}tr:last-child td{border-bottom:0}.timeline{display:grid;gap:14px}.event{display:grid;grid-template-columns:82px minmax(0,1fr);gap:14px;align-items:start}.event-no{width:54px;height:54px;border-radius:18px;background:var(--navy);color:white;display:flex;align-items:center;justify-content:center;font-weight:900}.hash{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}.record-meta{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.result-empty{text-align:center;padding:48px;color:var(--muted)}@media(max-width:860px){.hero,.boundary{grid-template-columns:1fr}.hero h1{font-size:32px}.topbar{align-items:flex-start;flex-direction:column}.shell{padding:16px}.metric{grid-template-columns:1fr}.event{grid-template-columns:1fr}}
</style>
</head>
<body><main class="shell"><header class="topbar"><div class="brand"><div class="mark"></div><div>ARY GRS 001<br><span class="muted">Agent Riding Record</span></div></div>${nav(active)}</header>${content}</main></body></html>`;
}

function nav(active) {
  const items = [
    ['/', 'Race'],
    ['/records', 'Riding Records'],
    ['/replay/record-session-02', '回放'],
    ['/evidence', '提交']
  ];
  return `<nav class="nav">${items.map(([href, label]) => `<a class="${active === href ? 'active' : ''}" href="${href}">${label}</a>`).join('')}</nav>`;
}

function labelForFile(file) {
  const labels = {
    'private_race.json': '原始赛事材料',
    'agent_session_sources.json': '完整协作记录',
    'private_review_notes.json': '评审依据',
    'races.json': '赛事展示信息',
    'race_lifecycle.json': '赛事阶段说明',
    'riding_records.json': 'Riding Record 列表',
    'riding_record_steps.json': '过程摘要',
    'record_replay_events.json': '回放事件'
  };
  return labels[file] || file;
}

function eventTypeClass(type) {
  const classes = {
    prompt: '',
    agent: 'purple',
    steering: 'amber',
    validation: 'green'
  };
  return classes[type] || 'gray';
}

function eventTypeLabel(type) {
  const labels = {
    prompt: 'Prompt',
    agent: 'Agent Output',
    steering: 'Steering',
    validation: 'Validation'
  };
  return labels[type] || type;
}

function findRecord(records, recordId) {
  return records.find((record) => record.recordId === recordId);
}

function recordSteps(steps, recordId) {
  return steps.filter((step) => step.recordId === recordId).sort((a, b) => a.stepNo - b.stepNo);
}

function replayEvents(events, recordId) {
  return events.filter((event) => event.recordId === recordId).sort((a, b) => a.eventNo - b.eventNo);
}

function hasSubmission(req) {
  return (req.headers.cookie || '').split(';').map((item) => item.trim()).includes('ary_submission=done');
}

function lockedContent(title = '提交后查看') {
  return page(title, '/evidence', `<section class="hero"><div class="hero-main"><div class="eyebrow">Submit Required</div><h1>请先提交答案</h1><p>Riding Record、详情和回放会在提交后显示。这样可以证明平台不会在参赛者提交前提前展示结果或过程内容。</p><div class="cta-row"><a class="button secondary" href="/evidence">去提交答案</a></div></div><aside class="hero-side"><h2>当前状态</h2><p class="muted">还没有提交记录。</p><p class="muted">示例答案可以填写：满分答案。</p></aside></section>`);
}

function parseFormBody(raw) {
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

async function readTextBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function readSubmission(req) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) return readBody(req);
  return parseFormBody(await readTextBody(req));
}

async function requestOrganizerEvaluation(organizerPort, answer) {
  try {
    const response = await fetch(`http://127.0.0.1:${organizerPort}/mock-evaluation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer })
    });
    if (!response.ok) throw new Error(`Organizer returned ${response.status}`);
    const result = await response.json();
    return {
      status: 'available',
      answer,
      resultText: result.result,
      evaluatedBy: result.evaluatedBy,
      dataVersionHash: result.dataVersionHash,
      proof: result.proof
    };
  } catch {
    return {
      status: 'missing',
      answer,
      resultText: null,
      evaluatedBy: null,
      dataVersionHash: null,
      proof: 'Organizer 数据处理器未在线，本次提交暂时无法评测。'
    };
  }
}

function renderEvaluationResult(testResult) {
  if (!testResult) {
    return `<div class="card"><span class="pill gray">等待提交</span><h2>还没有评测结果</h2><p class="muted">请先用参赛者身份提交一个答案。提交后，平台才会尝试评测并显示结果。</p></div>`;
  }
  if (testResult.status === 'available') {
    return `<div class="card"><span class="pill green">评测完成</span><h2>提交结果</h2><p class="muted">你的提交：</p><p class="code">${escapeHtml(testResult.answer)}</p><p class="muted">评测结果：</p><p class="code">${escapeHtml(testResult.resultText)}</p><p class="muted">这是本次提交产生的评测结果。</p></div>`;
  }
  return `<div class="card"><span class="pill red">数据缺失</span><h2>本次提交暂时无法评测</h2><p class="muted">你的提交：</p><p class="code">${escapeHtml(testResult.answer)}</p><p class="muted">平台当前没有足够数据完成评测。</p></div>`;
}

function renderSubmissionForm() {
  return `<form class="card" method="post" action="/evaluate"><span class="pill amber">参赛者提交</span><h2>提交一个答案触发评测</h2><p class="muted">这里用 mock 字符串代表参赛者提交。示例可以填：满分答案。</p><textarea name="answer" rows="4" style="width:100%;border:1px solid var(--line);border-radius:16px;padding:12px;font:inherit">满分答案</textarea><div class="cta-row"><button class="button" type="submit">提交并评测</button></div></form>`;
}

async function renderHome() {
  const races = await readJson(racesPath);
  const records = await readJson(ridingRecordsPath);
  const lifecycle = await readJson(raceLifecyclePath);
  const race = races[0];
  return page('ARY GRS 001 Agent Riding Record', '/', `<section class="hero"><div class="hero-main"><div class="eyebrow">ARY Genesis Race Series</div><h1>${escapeHtml(race.title)}</h1><p>${escapeHtml(race.summary)}</p><div class="cta-row"><a class="button secondary" href="/records">查看 Riding Records</a><a class="button secondary" href="/replay/record-session-02">回放示例 Record</a><a class="button secondary" href="/evidence">提交答案</a></div></div><aside class="hero-side"><h2>当前赛事</h2><div class="metric"><div><span class="muted">Records</span><strong>${records.length}</strong></div><div><span class="muted">Status</span><strong>${escapeHtml(race.status)}</strong></div></div><p class="muted">这里展示已经发布的赛事信息和 Riding Record。</p></aside></section><section class="grid"><div class="card"><span class="pill green">Agent Riding</span><h2>展示过程，而不只是结果</h2><p class="muted">Riding Record 展示 Prompt、Agent Output 和 Steering，说明 Rider 如何驾驭 Agent 推进真实项目。</p></div><div class="card"><span class="pill amber">数据安全</span><h2>只展示允许公开的内容</h2><p class="muted">平台展示赛事信息、过程摘要和回放内容，不展示未公开材料。</p></div><div class="card"><span class="pill purple">Race 生命周期</span><h2>创建、发布、组织、展示</h2><div class="steps">${lifecycle.map((item, index) => `<div class="step"><span>${index + 1}</span>${escapeHtml(item.phase)}</div>`).join('')}</div></div></section>`);
}

async function renderRecords(unlocked = false) {
  if (!unlocked) return lockedContent('Riding Records');
  const records = await readJson(ridingRecordsPath);
  const cards = records.map((record) => `<article class="card"><span class="pill green">Riding Record</span><h2>${escapeHtml(record.title)}</h2><p class="muted">${escapeHtml(record.summary)}</p><div class="record-meta"><span class="pill purple">Agent ${escapeHtml(record.agent)}</span><span class="pill amber">Rider ${escapeHtml(record.rider)}</span><span class="pill">${record.stepCount} steps</span>${record.publicTags.map((tag) => `<span class="pill gray">${escapeHtml(tag)}</span>`).join('')}</div><p class="muted">这条记录展示一次可回放的 Agent Riding 过程。</p><div class="cta-row"><a class="button" href="/records/${encodeURIComponent(record.recordId)}">查看详情</a><a class="button secondary" href="/replay/${encodeURIComponent(record.recordId)}">回放</a></div></article>`).join('');
  return page('Riding Records', '/records', `<section class="hero"><div class="hero-main"><div class="eyebrow">Riding Records</div><h1>Agent Riding 过程记录</h1><p>每条 Record 都把 Prompt、Agent Output 和 Steering 整理成可展示、可回放的过程证据。</p></div><aside class="hero-side"><h2>公开记录</h2><div class="metric"><div><span class="muted">Record 数</span><strong>${records.length}</strong></div><div><span class="muted">Agent</span><strong>Claude Code</strong></div></div><p class="muted">你可以查看详情，也可以按事件流回放。</p></aside></section><section class="grid">${cards}</section>`);
}

async function renderRecordDetail(recordId, unlocked = false) {
  if (!unlocked) return lockedContent('Record Detail');
  const records = await readJson(ridingRecordsPath);
  const steps = await readJson(ridingRecordStepsPath);
  const record = findRecord(records, recordId);
  if (!record) return page('Record not found', '/records', '<div class="card result-empty">未找到 Riding Record。</div>');
  const rows = recordSteps(steps, recordId).map((step) => `<tr><td><strong>${step.stepNo}</strong></td><td>${escapeHtml(step.promptSummary)}</td><td>${escapeHtml(step.agentOutputSummary)}</td><td>${escapeHtml(step.steeringSummary)}</td><td>${escapeHtml(step.ridingSignal)}</td></tr>`).join('');
  return page(record.title, '/records', `<section class="hero"><div class="hero-main"><div class="eyebrow">Record Detail</div><h1>${escapeHtml(record.title)}</h1><p>${escapeHtml(record.summary)}</p><div class="cta-row"><a class="button secondary" href="/replay/${encodeURIComponent(record.recordId)}">回放这条 Record</a><a class="button secondary" href="/records">返回 Records</a></div></div><aside class="hero-side"><h2>Record 概览</h2><div class="metric"><div><span class="muted">Agent</span><strong>${escapeHtml(record.agent)}</strong></div><div><span class="muted">Steps</span><strong>${record.stepCount}</strong></div></div><p class="muted">这页展示一次 Agent Riding 的关键步骤。</p></aside></section><section class="grid"><div class="card"><span class="pill">Prompt</span><h2>人类给出目标和约束</h2><p class="muted">Prompt 摘要展示 Rider 如何把任务讲清楚，并把 Docs、数据安全和交付边界交给 Agent。</p></div><div class="card"><span class="pill purple">Agent Output</span><h2>Agent 执行和产出</h2><p class="muted">Agent Output 摘要展示 Agent 如何搜索、实现、复核、验证，并把工作变成可运行系统。</p></div><div class="card"><span class="pill amber">Steering</span><h2>人类纠偏和收敛</h2><p class="muted">Steering 摘要展示 Rider 如何防止 Agent 跑偏，例如从普通评测网站收回到 ARY Agent Riding。</p></div></section><section class="card" style="margin-top:16px"><h2>公开步骤摘要</h2><table><thead><tr><th>#</th><th>Prompt</th><th>Agent Output</th><th>Steering</th><th>Riding Signal</th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

async function renderReplay(recordId, unlocked = false) {
  if (!unlocked) return lockedContent('Replay');
  const records = await readJson(ridingRecordsPath);
  const events = await readJson(recordReplayEventsPath);
  const record = findRecord(records, recordId);
  if (!record) return page('Replay not found', '/records', '<div class="card result-empty">未找到可回放的 Riding Record。</div>');
  const eventCards = replayEvents(events, recordId).map((event) => `<article class="card event"><div class="event-no">${event.eventNo}</div><div><span class="pill ${eventTypeClass(event.type)}">${eventTypeLabel(event.type)}</span><h2>${escapeHtml(event.title)}</h2><p class="muted">${escapeHtml(event.content)}</p></div></article>`).join('');
  return page(`${record.title} 回放`, '/replay/record-session-02', `<section class="hero"><div class="hero-main"><div class="eyebrow">Replay</div><h1>${escapeHtml(record.title)}</h1><p>这不是普通提交结果，而是一次 Agent Riding 的过程回放：目标下达、Agent 执行、用户 Steering、验证交付。</p><div class="cta-row"><a class="button secondary" href="/records/${encodeURIComponent(record.recordId)}">查看详情</a><a class="button secondary" href="/evidence">查看数据边界</a></div></div><aside class="hero-side"><h2>回放对象</h2><p class="muted">${escapeHtml(record.summary)}</p><p class="muted">回放内容按关键事件组织。</p></aside></section><section class="timeline">${eventCards}</section>`);
}

async function renderEvidence(evaluationResult = null) {
  return page('提交与评测', '/evidence', `<section class="hero"><div class="hero-main"><div class="eyebrow">Submit</div><h1>提交答案并查看评测状态</h1><p>参赛者提交答案后，平台会给出本次提交的评测状态。没有提交时不会提前显示结果。</p></div><aside class="hero-side"><h2>当前流程</h2><div class="metric"><div><span class="muted">Step 1</span><strong>提交</strong></div><div><span class="muted">Step 2</span><strong>评测</strong></div></div><p class="muted">平台只展示参赛者需要知道的信息。</p></aside></section><section class="grid" style="margin-bottom:16px">${renderSubmissionForm()}${renderEvaluationResult(evaluationResult)}<div class="card"><span class="pill green">数据安全</span><h2>结果不会提前出现</h2><ul class="muted"><li>未提交时，页面没有评测结果。</li><li>数据不可用时，提交会显示数据缺失。</li><li>数据可用时，提交会显示本次评测结果。</li></ul></div></section><section class="grid"><div class="card"><h2>平台展示内容</h2><ul class="muted"><li>赛事信息</li><li>Riding Record</li><li>过程回放</li><li>提交状态和评测结果</li></ul></div><div class="card"><h2>不会展示的内容</h2><ul class="muted"><li>未公开材料</li><li>未公开过程记录</li><li>评审细则</li><li>未公开的处理细节</li></ul></div><div class="card"><h2>这能证明什么</h2><p class="muted">平台可以组织和展示赛事，也可以在提交后返回评测状态；当数据不可用时，平台不会凭空给出结果。</p></div></section>`);
}

export function createAryServer(port = 4100, organizerPort = 4101) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderHome());
      }
      if (req.method === 'GET' && url.pathname === '/records') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderRecords(hasSubmission(req)));
      }
      if (req.method === 'GET' && url.pathname.startsWith('/records/')) {
        const recordId = decodeURIComponent(url.pathname.split('/')[2] || '');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderRecordDetail(recordId, hasSubmission(req)));
      }
      if (req.method === 'GET' && url.pathname.startsWith('/replay/')) {
        const recordId = decodeURIComponent(url.pathname.split('/')[2] || '');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderReplay(recordId, hasSubmission(req)));
      }
      if (req.method === 'GET' && url.pathname === '/evidence') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await renderEvidence());
      }
      if (req.method === 'POST' && url.pathname === '/evaluate') {
        const submission = await readSubmission(req);
        const answer = String(submission.answer || '').trim();
        const result = await requestOrganizerEvaluation(organizerPort, answer || '满分答案');
        if ((req.headers['content-type'] || '').includes('application/json')) {
          return jsonResponse(res, 200, result);
        }
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'set-cookie': 'ary_submission=done; Path=/; SameSite=Lax'
        });
        return res.end(await renderEvidence(result));
      }
      if (req.method === 'GET' && url.pathname === '/api/evidence') {
        return jsonResponse(res, 200, {
          organizerExperiment: null,
          aryFiles: await listFiles(aryStoreDir),
          organizerFiles: await listFiles(organizerDir),
          publicRecords: await readJson(ridingRecordsPath),
          publicSteps: await readJson(ridingRecordStepsPath),
          replayEvents: await readJson(recordReplayEventsPath),
          raceLifecycle: await readJson(raceLifecyclePath),
          dataBoundary: {
            organizerRetainsFullSources: true,
            aryStoresProjectionOnly: true,
            aryDoesNotStoreFullPrivateRace: true
          }
        });
      }
      jsonResponse(res, 404, { error: '未找到接口' });
    } catch (error) {
      jsonResponse(res, 500, { error: error.message });
    }
  });
  server.listen(port);
  return server;
}
