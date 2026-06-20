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

  // DEBUG: 直接显示原始值
  var debugHtml = 'activeSessions=' + data.activeSessions + ' | project=' + (data.currentProject || "null") + ' | rs=' + JSON.stringify(data.ridingStats);
  console.log("OVERVIEW DEBUG:", debugHtml);
  statsEl.innerHTML = '<div class="stat" style="grid-column:1/-1"><span class="num" style="font-size:11px">' + escapeHtml(debugHtml) + '</span></div>';

  const rs = data.ridingStats || {};
  statsEl.innerHTML =
    '<div class="stat"><span class="num">' + fmtDuration(rs.totalTime) + '</span><span class="label">骑行时长</span></div>' +
    '<div class="stat"><span class="num">' + ((rs.totalTokens || 0).toLocaleString()) + '</span><span class="label">消耗 Token</span></div>' +
    '<div class="stat"><span class="num">' + (rs.totalToolCalls || 0) + '</span><span class="label">工具调用</span></div>' +
    '<div class="stat"><span class="num">' + (rs.totalMessages || 0) + '</span><span class="label">骑行消息</span></div>';

  const health = data.activeSessions > 0 ? "active" : "not_configured";
  const labels = { active: "🟢 活跃", not_configured: "⚫ 未配置", failed: "🔴 异常" };
  $("#caHealth").textContent = labels[health] || health;
  $("#caProject").textContent = data.currentProject || "—";
  const sigStr = rs.signalTypes?.length ? " · " + rs.signalTypes.join(" ") : "";
  $("#caSessionId").textContent = (data.currentSessionId || "").slice(0, 20) + "…" + sigStr;

  const badge = $("#connectionBadge");
  if (health === "active") { badge.className = "badge active"; badge.textContent = "● 已连接"; }
  else if (health === "failed") { badge.className = "badge failed"; badge.textContent = "● 连接异常"; }
  else { badge.className = "badge pending"; badge.textContent = "● 未配置"; }

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
    });
  });
}

$("#projectFilter").addEventListener("change", function () { loadConversation(""); });
$("#refreshEvents").addEventListener("click", function () { loadConversation(""); });

// ═══════════════════════════════════════ 启动

$("#clock").textContent = new Date().toLocaleString("zh-CN");

(async function () {
  setupTabs();
  await loadOverview();
  await loadConversation("");
})();
