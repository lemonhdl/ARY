/**
 * DCR Desktop App — Frontend
 */

// ═══════════════════════════════════════ 工具

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " " + fmtTime(ts);
}
function fmtDuration(ms) {
  if (!ms || ms < 0) return "—";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return sec + "s";
  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m " + (sec % 60) + "s";
  const hr = Math.floor(min / 60);
  return hr + "h " + (min % 60) + "m";
}
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ═══════════════════════════════════════ API

const API = {
  async fetch(path) {
    try { const r = await fetch(path, { cache: "no-cache" }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    catch (e) { console.error(path, e); return null; }
  },
  overview()     { return this.fetch("/api/overview"); },
  sessions()     { return this.fetch("/api/sessions"); },
  projects()     { return this.fetch("/api/projects"); },
  aryMessages(pid, limit) { return this.fetch("/api/ary/messages?pid=" + (pid || "") + "&limit=" + (limit || 200)); },
  chains()          { return this.fetch("/api/chain"); },
  chain(id)         { return this.fetch("/api/chain/" + id); },
  chainMessages(id) { return this.fetch("/api/chain/" + (id||"") + "/messages"); },
  aryChainMessages(){ return this.fetch("/api/ary/chain-messages"); },
  config()          { return this.fetch("/api/config"); },
  async saveConfig(cfg) { try { const r = await fetch("/api/config", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(cfg) }); return r.ok ? await r.json() : null; } catch(e) { return null; } },
};

// ═══════════════════════════════════════ 对话渲染

const SIGNAL_BADGE = {
  session_started: "🟢", session_completed: "✅",
  riding_started: "🟢", riding_finished: "🏁",
  task_started: "▶️", task_progress: "📝", task_completed: "✅", task_blocked: "🚫",
  risk_detected: "⚠️", validation_run: "🧪",
  cost_updated: "💰", milestone_reached: "🎯", artifact_linked: "🔗",
};

function renderMsgCard(msg, i, prevTokens, firstTs) {
  const d = msg.display || {};
  const role = d.role;
  if (role !== "rider" && role !== "claude") return "";

  const text = d.text || "";
  if (!text.trim()) return "";

  const sig = msg.signal || {};
  const st = sig.type || "?";
  const badge = SIGNAL_BADGE[st] || "📌";
  const c = msg.counters || {};
  const s = msg.summary || {};

  // 本条统计
  const tokenDelta = (c.tokens || 0) - (prevTokens || 0);
  const tokenStr = tokenDelta > 0 ? "+" + tokenDelta.toLocaleString() + " 🪙" : "";
  const elapsed = firstTs ? fmtDuration(new Date(msg.timestamp).getTime() - new Date(firstTs).getTime()) : "";

  // 折叠面板 ID
  const metaId = "meta-" + i + "-" + (msg.sequence || i);

  return `
    <div class="chat-msg ${role}">
      <div class="chat-head" onclick="var el=document.getElementById('${metaId}');el.style.display=el.style.display==='none'?'block':'none'">
        <span class="chat-role">${role === "rider" ? "🐎 Rider" : "🤖 Claude"}</span>
        <span class="chat-badge">${badge} ${st}</span>
        ${elapsed ? '<span class="chat-elapsed">⏱ ' + elapsed + '</span>' : ""}
        ${tokenStr ? '<span class="chat-tokens">' + tokenStr + '</span>' : ""}
        <span class="chat-time">${fmtTime(msg.timestamp)}</span>
        <span class="chat-expand">▸</span>
      </div>
      <div class="chat-body">
        <div class="chat-text ${role === "rider" ? "rider-text" : "claude-text"}">${escapeHtml(text)}</div>
      </div>
      <div class="ary-meta" id="${metaId}" style="display:none">
        <div class="meta-grid">
          <div class="meta-item"><label>signal.type</label><span>${badge} ${st}</span></div>
          <div class="meta-item"><label>phase</label><span>${sig.phase || "—"}</span></div>
          <div class="meta-item"><label>taskStatus</label><span>${sig.taskStatus || "—"}</span></div>
          <div class="meta-item"><label>riskLevel</label><span class="risk-${s.riskLevel || "low"}">${s.riskLevel || "low"}</span></div>
          <div class="meta-item"><label>sequence</label><span>#${msg.sequence ?? i}</span></div>
          <div class="meta-item"><label>累计 tokens</label><span>🪙 ${(c.tokens || 0).toLocaleString()}</span></div>
          <div class="meta-item"><label>累计 toolCalls</label><span>🔧 ${c.toolCallCount || 0}</span></div>
          <div class="meta-item"><label>累计 messages</label><span>💬 ${c.messageCount || 0}</span></div>
        </div>
        <div class="meta-row"><label>messageId</label><code>${escapeHtml(msg.messageId || "")}</code></div>
        <div class="meta-row"><label>idempotencyKey</label><code>${escapeHtml(msg.idempotencyKey || "")}</code></div>
        ${sig.noteReason ? '<div class="meta-row"><label>noteReason</label><span class="note">' + escapeHtml(sig.noteReason) + '</span></div>' : ""}
        ${msg.technicalActions?.length ? '<div class="meta-row"><label>technicalActions</label><span>' + msg.technicalActions.map(function(a){return a.type + "×" + a.count}).join(", ") + '</span></div>' : ""}
        <div class="meta-row"><label>caSessionId</label><code>${escapeHtml((msg.ca?.caSessionId || "").slice(0, 20))}…</code></div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════ 页面加载

async function loadOverview() {
  var statsEl = $("#overviewStats");
  if (!statsEl) return;

  var data = null;
  try {
    data = await API.overview();
  } catch(e) {
    statsEl.innerHTML = '<div class="stat"><span class="num">ERR</span><span class="label">' + escapeHtml(e.message) + '</span></div>';
    return;
  }

  if (!data) {
    statsEl.innerHTML = '<div class="stat"><span class="num">NULL</span><span class="label">data is null</span></div>';
    return;
  }

  const px = data.proxyStatus || {};
  const proxyOnline = px.online;
  const rs = data.ridingStats || {};

  statsEl.innerHTML =
    '<div class="stat"><span class="num">' + fmtDuration(rs.totalTime) + '</span><span class="label">骑行时长</span></div>' +
    '<div class="stat"><span class="num">' + ((rs.totalTokens || 0).toLocaleString()) + '</span><span class="label">消耗 Token</span></div>' +
    '<div class="stat"><span class="num">' + (rs.totalToolCalls || 0) + '</span><span class="label">工具调用</span></div>' +
    '<div class="stat"><span class="num">' + (rs.totalMessages || 0) + '</span><span class="label">骑行消息</span></div>';

  $("#caHealth").textContent = proxyOnline ? "🟢 中转站已连接 · " + (px.userCount||0) + "用户在线" : "🔴 中转站未连接";
  $("#caProject").textContent = proxyOnline ? (px.upstream || "—") : "—";
  currentProjectDir = data.currentProject || "";
  var subLabel = document.getElementById("submitProjectLabel");
  if (subLabel) subLabel.textContent = "项目: " + (currentProjectDir || "未配置");
  $("#caSessionId").textContent = proxyOnline ? (px.totalEntries||0) + " 条记录 · " + (px.chainCount||0) + "链" : "检查 localhost:3738 是否启动";

  var riderEl = document.getElementById("riderInfo");
  if (riderEl) {
    var pj = data.currentProject || "—";
    var chains = data.chains || [];
    var activeChain = chains[0];
    riderEl.innerHTML =
      '<div class="ca-row"><span>项目</span><span class="val">' + escapeHtml(pj.slice(-40)) + '</span></div>' +
      '<div class="ca-row"><span>记录链</span><span class="val">' + chains.length + '链 · ' + (activeChain?.entryCount||0) + '条</span></div>' +
      '<div class="ca-row"><span>总 Token</span><span class="val">' + ((data.ridingStats?.totalTokens||0).toLocaleString()) + '</span></div>';
  }

  const badge = $("#connectionBadge");
  if (proxyOnline) { badge.className = "badge active"; badge.textContent = "● 已连接"; }
  else { badge.className = "badge failed"; badge.textContent = "● 离线"; }

  $("#promptList").innerHTML = (data.recentPrompts || []).map(function (p) {
    return '<li><span class="time">' + fmtTime(p.timestamp) + '</span>' + escapeHtml((p.display || "").slice(0, 60)) + '</li>';
  }).join("") || '<li style="color:var(--muted)">暂无记录</li>';
}

async function loadConversation(pid) {
  var container = $("#eventStream");
  container.innerHTML = '<div class="loading">加载对话…</div>';

  var data = await API.aryMessages(pid, 300);
  if (!data || !data.messages || !data.messages.length) {
    container.innerHTML = '<div class="loading">暂无对话</div>';
    return;
  }

  var html = '<div class="conv-stats"><span>📡 ' + data.messageCount + ' 条消息</span><span>🏷 ' + (data.signalTypes || []).join(" · ") + '</span><span>📋 ' + (data.session?.sessionId || "").slice(0, 12) + '…</span><span>🖥 ' + (data.session?.cwd || "") + '</span></div>';

  var firstTs = data.messages[0]?.timestamp || null;
  var prevTokens = 0;

  for (var i = 0; i < data.messages.length; i++) {
    var msg = data.messages[i];
    var card = renderMsgCard(msg, i, prevTokens, firstTs);
    if (card) html += card;
    prevTokens = msg.counters?.tokens || prevTokens;
  }

  container.innerHTML = html;
}

async function loadSessions() {
  var container = $("#sessionList");
  container.innerHTML = '<div class="loading">加载中…</div>';
  var sessions = await API.sessions();
  if (!sessions || !sessions.length) { container.innerHTML = '<div class="loading">暂无 Session</div>'; return; }
  container.innerHTML = sessions.map(function (s) {
    var cls = s.status === "busy" ? "busy" : s.status === "idle" ? "idle" : "dead";
    return '<div class="session-item" data-pid="' + s.pid + '"><div class="session-left"><span class="session-pid">PID ' + s.pid + '</span><span class="session-path">' + (s.cwd || "—") + '</span><span style="font-size:10px;color:var(--muted)">' + (s.sessionId || "").slice(0, 16) + '…</span></div><div class="session-right"><span class="session-status ' + cls + '">' + (s.status || "?") + '</span><div class="session-time">' + fmtDate(s.startedAt) + '</div></div></div>';
  }).join("");

  container.querySelectorAll(".session-item").forEach(function (el) {
    el.addEventListener("click", function () { switchToConversation(el.dataset.pid); });
  });
}

async function loadProjects() {
  var container = $("#projectList");
  container.innerHTML = '<div class="loading">加载中…</div>';
  var projects = await API.projects();
  if (!projects || !projects.length) { container.innerHTML = '<div class="loading">暂无追踪项目</div>'; return; }
  container.innerHTML = projects.map(function (p) {
    return '<div class="project-item" data-dir="' + p.dirName + '"><div class="proj-left"><span class="proj-name">📁 ' + p.dirName + '</span><span class="proj-path">' + p.decodedPath + '</span><span class="proj-sessions">' + p.sessionCount + ' session(s)</span></div>' + (p.hasMemory ? '<span class="proj-memory">🧠</span>' : "") + '</div>';
  }).join("");
}

async function switchToConversation(pid) {
  $$("#tabs .tab").forEach(function (t) { t.classList.remove("active"); });
  $("#tabs").querySelector('[data-tab="events"]').classList.add("active");
  $$(".tab-content").forEach(function (c) { c.classList.remove("active"); });
  $("#tab-events").classList.add("active");
  await loadConversation(pid);
}

// ═══════════════════════════════════════ 哈希链

async function loadChain() {
  var container = $("#chainView");
  container.innerHTML = '<div class="loading">加载哈希链…</div>';

  var chains = await API.chains();
  if (!chains || !chains.length) {
    container.innerHTML = '<div class="loading">暂无骑行链<br><small>启动 DCR Proxy 后，Claude Code 的每次请求会自动记录</small></div>';
    return;
  }

  // 默认展示第一条链的详情
  var detail = await API.chain(chains[0].chainId);
  var v = detail.verification || {};
  var c = detail.chain || chains[0];
  var entries = detail.entries || [];

  var html = '<div class="chain-header">' +
    '<div class="chain-status ' + (v.valid ? 'valid' : 'broken') + '">' +
    (v.valid ? '✅ 链完整' : '❌ 链断裂！发现 ' + (v.breaks || []).length + ' 处断点') +
    '</div>' +
    '<div class="chain-meta">' +
    '<span>🔗 ' + (c.chainId || "").slice(0, 16) + '…</span>' +
    '<span>📋 ' + (c.entryCount || entries.length) + ' 条记录</span>' +
    '<span>🪙 ' + ((v.summary && v.summary.totalTokens) || c.totalTokens || 0).toLocaleString() + ' tokens</span>' +
    (entries.length > 0 && entries[0].fileCount ? '<span>📁 ' + entries[0].fileCount + ' 文件</span>' : '') +
    '</div>' +
    '</div>';

  if (v.breaks && v.breaks.length > 0) {
    html += '<div class="chain-breaks">⚠️ 断点位置: ' + v.breaks.join(", ") + '</div>';
  }

  // 链条目列表
  html += '<div class="chain-entries">';
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var hashShort = (e.hash || "").slice(0, 14);
    var prevShort = (e.prevHash || "").slice(0, 14);
    var broken = v.breaks && v.breaks.indexOf(i) >= 0;

    html += '<div class="chain-entry' + (broken ? ' broken' : '') + '">' +
      '<div class="ce-head">' +
      '<span class="ce-index">#' + (e.index != null ? e.index : i) + '</span>' +
      '<span class="ce-model">' + escapeHtml(e.model || "") + '</span>' +
      '<span class="ce-duration">' + (e.duration || 0) + 'ms</span>' +
      '<span class="ce-tokens">' + ((e.usage && (e.usage.total_tokens || e.usage.totalTokens)) || 0).toLocaleString() + ' 🪙</span>' +
      (e.stream ? '<span class="ce-stream">SSE</span>' : '') +
      (broken ? '<span class="ce-broken">❌ 断裂</span>' : '<span class="ce-ok">✅</span>') +
      '</div>' +
      '<div class="ce-hashes">' +
      '<code>prev: ' + prevShort + '…</code>' +
      '<code>hash: ' + hashShort + '…</code>' +
      (e.fileHash ? '<code>files: ' + e.fileHash.slice(0, 14) + '…</code>' : '') +
      '</div>' +
      (e.promptPreview ? '<div class="ce-prompt">💬 ' + escapeHtml(e.promptPreview.slice(0, 100)) + '</div>' : '') +
      (e.textPreview ? '<div class="ce-text">🤖 ' + escapeHtml(e.textPreview.slice(0, 100)) + '</div>' : '') +
      (e.error ? '<div class="ce-error">❌ ' + escapeHtml(e.error) + '</div>' : '') +
      '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
}

// ═══════════════════════════════════════ 标签 + 筛选

function setupTabs() {
  $$("#tabs .tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = tab.dataset.tab;
      $$("#tabs .tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      $$(".tab-content").forEach(function (c) { c.classList.remove("active"); });
      $("#tab-" + target).classList.add("active");
      if (target === "sessions") loadSessions();
      if (target === "projects") loadProjects();
      if (target === "events") loadConversation("");
      if (target === "chain") loadChain();
    });
  });
}

$("#projectFilter").addEventListener("change", function () { loadConversation(""); });
$("#refreshEvents").addEventListener("click", function () { loadConversation(""); });

// ═══════════════════════════════════════ 启动

$("#clock").textContent = new Date().toLocaleString("zh-CN");

// ── 连接配置 ──
var proxyUrlInput = document.getElementById("proxyUrlInput");
var projectDirInput = document.getElementById("projectDirInput");
var upstreamInput = document.getElementById("upstreamInput");
var upstreamStatus = document.getElementById("upstreamStatus");
if (proxyUrlInput && upstreamInput) {
  (async function loadConfig() {
    try {
      var cfg = await API.config();
      proxyUrlInput.value = cfg.proxyUrl || "http://localhost:3738";
      projectDirInput.value = cfg.projectDir || "";
      upstreamInput.value = cfg.upstreamUrl || "";
      currentProjectDir = cfg.projectDir || "";
      proxyUrlInput.onchange = saveCfg;
      projectDirInput.onchange = saveCfg;
      upstreamStatus.textContent = cfg.upstreamUrl ? "已配置" : "请填写 LLM API 端点";
    } catch(e) { upstreamStatus.textContent = "读取配置失败"; }
  })();
  async function saveCfg() {
    var purl = proxyUrlInput.value.trim() || "http://localhost:3738";
    var pdir = projectDirInput.value.trim();
    var url = upstreamInput.value.trim();
    currentProjectDir = pdir;
    var subLabel = document.getElementById("submitProjectLabel");
    if (subLabel) subLabel.textContent = "项目: " + (pdir || "未配置");
    var ok = await API.saveConfig({ proxyUrl: purl, projectDir: pdir, upstreamUrl: url });
    upstreamStatus.textContent = ok ? "✅ 已保存" : "保存失败";
  }
  document.getElementById("upstreamSave").onclick = saveCfg;
}

// ── 提交 ──
var currentProjectDir = "";
document.getElementById("submitBtn").onclick = async function() {
  var resultEl = document.getElementById("submitResult");
  if (!currentProjectDir) { resultEl.textContent = "❌ 未配置项目路径"; return; }
  resultEl.textContent = "⏳ 正在生成快照…";
  try {
    var r = await fetch("/api/submit", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({projectDir: currentProjectDir}) });
    var data = await r.json();
    if (data.error) { resultEl.textContent = "❌ " + data.error; return; }
    var s = data.snapshot;
    var v = data.verification;
    resultEl.innerHTML =
      '<div style="margin-top:4px">📁 ' + s.fileCount + ' 文件 · ' + (s.totalSize/1024).toFixed(0) + ' KB</div>' +
      '<div style="margin-top:2px">🔑 ' + (s.snapshotHash||"").slice(0,16) + '…</div>' +
      '<div style="margin-top:4px;color:' + (v.valid ? 'var(--green)' : 'var(--red)') + ';font-weight:600">' + v.verdict + '</div>' +
      (v.matchCount > 0 ? '<div style="margin-top:2px">匹配点: ' + v.matchCount + ' / ' + v.chainEntryCount + ' 条目</div>' : '');
  } catch(e) { resultEl.textContent = "❌ 请求失败: " + e.message; }
};

(async function () {
  setupTabs();
  await loadOverview();
  await loadConversation("");
})();
