/**
 * DCR Desktop App — 样例数据生成脚本
 *
 * 读取本地 Claude Code 数据，用 message-builder 生成 ARY 标准样例文件。
 *
 * 用法：node generate-samples.js
 *
 * 产出：
 *   samples/riding-events.sample.json  — 骑行事件样例
 *   samples/ca-status.sample.json      — CA 连接状态样例
 *   samples/session-snapshot.sample.json — Session 快照样例
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { buildMessages, buildFailureMessage, buildSessionSnapshot, buildCAStatus } from "./message-builder.js";

// ══════════════════════════════════════════════════════
// 路径
// ══════════════════════════════════════════════════════

const HOME = homedir();
const CLAUDE_DIR = join(HOME, ".claude");
const SESSIONS_DIR = join(CLAUDE_DIR, "sessions");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
const OUTPUT_DIR = join(import.meta.dirname, "samples");

/** 解码 Claude Code 项目目录名 */
function decodeProjectDir(dirName) {
  return dirName.replace(/--/g, "\\").replace(/-/g, ":\\").replace(/^([A-Z]):/, "$1:");
}

function encodeProjectPath(projectPath) {
  // C:\Users\ROG\Desktop\se\ARY → C--Users-ROG-Desktop-se-ARY
  // : → -, \ → -
  return projectPath.replace(/:/g, "-").replace(/\\/g, "-");
}

// ══════════════════════════════════════════════════════
// 读取 Claude Code 数据
// ══════════════════════════════════════════════════════

function readJSONL(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.trim().split("\n")
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readJSON(filePath) {
  if (!existsSync(filePath)) return null;
  try { return JSON.parse(readFileSync(filePath, "utf-8")); } catch { return null; }
}

// ══════════════════════════════════════════════════════
// 主逻辑
// ══════════════════════════════════════════════════════

console.log("🐎 DCR Desktop — 生成 ARY 样例数据\n");
console.log(`   Claude 数据目录: ${CLAUDE_DIR}\n`);

// 确保输出目录
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ── 1. 找到当前活跃的 session ──────────────────────────

const sessionFiles = existsSync(SESSIONS_DIR)
  ? readdirSync(SESSIONS_DIR).filter(f => f.endsWith(".json"))
  : [];

if (sessionFiles.length === 0) {
  console.log("⚠️  没有找到活跃 Session，生成纯 mock 样例。\n");
  generateMockOnly();
  process.exit(0);
}

// 取最近更新的 session
const sessions = sessionFiles
  .map(f => ({ ...readJSON(join(SESSIONS_DIR, f)), file: f }))
  .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

const activeSession = sessions[0];
console.log(`📋 当前 Session: PID ${activeSession.pid}`);
console.log(`   Session ID:  ${activeSession.sessionId}`);
console.log(`   工作目录:    ${activeSession.cwd}`);
console.log(`   状态:        ${activeSession.status}\n`);

// ── 2. 读取该 session 的对话 JSONL ─────────────────────

const projectDirName = encodeProjectPath(activeSession.cwd || "");
const sessionFile = join(PROJECTS_DIR, projectDirName, `${activeSession.sessionId}.jsonl`);

let rawEvents = [];
if (existsSync(sessionFile)) {
  rawEvents = readJSONL(sessionFile);
  console.log(`📄 对话文件:   ${sessionFile}`);
  console.log(`   事件数:      ${rawEvents.length}\n`);
} else {
  console.log(`⚠️  未找到对话文件: ${sessionFile}`);
  console.log("   尝试读取其他项目的最新 JSONL…\n");

  // 回退：找任意项目的最新 JSONL
  if (existsSync(PROJECTS_DIR)) {
    const projDirs = readdirSync(PROJECTS_DIR);
    for (const dir of projDirs) {
      const full = join(PROJECTS_DIR, dir);
      if (!existsSync(full)) continue;
      const files = readdirSync(full).filter(f => f.endsWith(".jsonl"));
      if (files.length > 0) {
        const path = join(full, files[0]);
        rawEvents = readJSONL(path);
        console.log(`   回退使用: ${path} (${rawEvents.length} 事件)\n`);
        break;
      }
    }
  }
}

// ── 3. 生成样例 ───────────────────────────────────────

const sampleNote = {
  __GENERATION_NOTE__: {
    generatedAt: new Date().toISOString(),
    source: "本地 Claude Code 数据",
    identityStatus: "身份字段（race.*, rider.*, ca.caConnectionId）使用假数据，标注 __MOCK__。服务端 API 就绪后替换。",
    schemaVersion: "ary.ca.riding_signal.v0.1",
  },
};

// ── 3a. riding-events.sample.json ─────────────────────

console.log("🔨 生成 riding-events.sample.json …");

const allMessages = buildMessages(rawEvents, {
  sessionId: activeSession.sessionId,
  cwd: activeSession.cwd,
  startedAt: activeSession.startedAt,
});

// 取正常事件流（前 5 条）
const normalEvents = allMessages.slice(0, 5);

// 构造一条乱序/重放样例（修改 sequence）
const replayEvent = allMessages.length > 2
  ? { ...allMessages[1], sequence: 99, idempotencyKey: allMessages[1].idempotencyKey + ":replay" }
  : null;

// 构造一条失败事件样例
const failureMessages = buildFailureMessage("ca_session_permission_denied", {
  sessionId: activeSession.sessionId,
  cwd: activeSession.cwd,
});
const failureEvent = failureMessages[0];

const ridingEventsSample = {
  ...sampleNote,
  description: "骑行事件样例集。至少 3 条正常事件 + 1 条乱序/重放 + 1 条失败事件。",
  normal: normalEvents,
  replayed: replayEvent ? [replayEvent] : [],
  failure: failureEvent ? [failureEvent] : [],
  stats: {
    totalMessagesGenerated: allMessages.length,
    signalTypes: [...new Set(allMessages.map(m => m.signal.type))],
    counters: allMessages.length > 0 ? allMessages[allMessages.length - 1].counters : {},
  },
};

writeFileSync(
  join(OUTPUT_DIR, "riding-events.sample.json"),
  JSON.stringify(ridingEventsSample, null, 2),
  "utf-8"
);
console.log(`   ✅ samples/riding-events.sample.json (${allMessages.length} 条消息)`);

// ── 3b. ca-status.sample.json ─────────────────────────

console.log("🔨 生成 ca-status.sample.json …");

const caStatusSample = {
  ...sampleNote,
  description: "CAConnection 状态样例，覆盖全部 5 种状态。",
  statuses: [
    buildCAStatus("not_configured", {}, { __scenario__: "选手尚未配置任何 CA 连接" }),
    buildCAStatus("registered", { cwd: activeSession.cwd, sessionId: activeSession.sessionId }, {
      registeredAt: new Date(Date.now() - 86400000).toISOString(),
      __scenario__: "CA 已登记但尚未完成握手",
    }),
    buildCAStatus("handshaken", { cwd: activeSession.cwd, sessionId: activeSession.sessionId }, {
      registeredAt: new Date(Date.now() - 86400000).toISOString(),
      handshakenAt: new Date(Date.now() - 3600000).toISOString(),
      __scenario__: "CA 已完成握手，等待首次有效 Session",
    }),
    buildCAStatus("active", { cwd: activeSession.cwd, sessionId: activeSession.sessionId }, {
      registeredAt: new Date(Date.now() - 86400000).toISOString(),
      handshakenAt: new Date(Date.now() - 3600000).toISOString(),
      lastActiveAt: new Date().toISOString(),
      __scenario__: "CA 连接活跃，正在产生骑行数据",
    }),
    buildCAStatus("failed", { cwd: activeSession.cwd, sessionId: activeSession.sessionId }, {
      registeredAt: new Date(Date.now() - 86400000).toISOString(),
      handshakenAt: new Date(Date.now() - 3600000).toISOString(),
      failedAt: new Date().toISOString(),
      statusReason: "ca_session_permission_denied",
      __scenario__: "CA 连接失败，权限被拒绝",
    }),
  ],
};

writeFileSync(
  join(OUTPUT_DIR, "ca-status.sample.json"),
  JSON.stringify(caStatusSample, null, 2),
  "utf-8"
);
console.log("   ✅ samples/ca-status.sample.json");

// ── 3c. session-snapshot.sample.json ───────────────────

console.log("🔨 生成 session-snapshot.sample.json …");

const snapshot = buildSessionSnapshot(rawEvents, {
  sessionId: activeSession.sessionId,
  cwd: activeSession.cwd,
  startedAt: activeSession.startedAt,
});

const snapshotSample = {
  ...sampleNote,
  description: "Session 快照样例，对应 W3 fetch 接口返回结构。",
  snapshot,
};

writeFileSync(
  join(OUTPUT_DIR, "session-snapshot.sample.json"),
  JSON.stringify(snapshotSample, null, 2),
  "utf-8"
);
console.log("   ✅ samples/session-snapshot.sample.json");

// ── 4. 汇总 ────────────────────────────────────────────

console.log(`\n✨ 全部样例已生成到 ${OUTPUT_DIR}/\n`);

// ══════════════════════════════════════════════════════
// 纯 mock 回退
// ══════════════════════════════════════════════════════

function generateMockOnly() {
  const identity = readJSON(join(import.meta.dirname, "identity-config.json"));

  // 构造几条 mock 原始事件
  const mockEvents = [
    { role: "user", message: { content: "帮我写一个登录页面" }, timestamp: Date.now() - 300000 },
    { role: "assistant", message: { content: [{ type: "text", text: "好的，我来创建登录页面。" }, { type: "tool_use", name: "Write", id: "t1" }] }, timestamp: Date.now() - 280000 },
    { role: "user", message: { content: "样式不对，背景改成白色" }, timestamp: Date.now() - 200000 },
    { role: "assistant", message: { content: [{ type: "text", text: "已修复，背景已改为白色。" }, { type: "tool_use", name: "Edit", id: "t2" }] }, timestamp: Date.now() - 180000 },
    { role: "user", message: { content: "现在加一个注册页面" }, timestamp: Date.now() - 100000 },
    { role: "assistant", message: { content: [{ type: "text", text: "正在添加注册页面…" }] }, timestamp: Date.now() - 80000 },
  ];

  const messages = buildMessages(mockEvents, {
    sessionId: "__MOCK__session_abc",
    cwd: "C:\\Users\\rider\\projects\\demo-app",
    startedAt: Date.now() - 3600000,
  });

  const ridingEventsSample = {
    ...sampleNote,
    description: "骑行事件样例集（纯 mock，无本地 Claude Code 数据）。",
    normal: messages.slice(0, 4),
    replayed: [{ ...messages[2], sequence: 99, idempotencyKey: messages[2].idempotencyKey + ":replay" }],
    failure: buildFailureMessage("ca_session_permission_denied", { sessionId: "__MOCK__session_abc" }),
    stats: { totalMessagesGenerated: messages.length },
  };

  writeFileSync(
    join(OUTPUT_DIR, "riding-events.sample.json"),
    JSON.stringify(ridingEventsSample, null, 2), "utf-8"
  );

  const caStatusSample = {
    ...sampleNote,
    description: "CAConnection 状态样例（纯 mock）。",
    statuses: [
      buildCAStatus("not_configured"),
      buildCAStatus("registered"),
      buildCAStatus("handshaken"),
      buildCAStatus("active"),
      buildCAStatus("failed", {}, { statusReason: "ca_session_permission_denied" }),
    ],
  };

  writeFileSync(
    join(OUTPUT_DIR, "ca-status.sample.json"),
    JSON.stringify(caStatusSample, null, 2), "utf-8"
  );

  const snapshot = buildSessionSnapshot(mockEvents);
  writeFileSync(
    join(OUTPUT_DIR, "session-snapshot.sample.json"),
    JSON.stringify({ ...sampleNote, description: "Session 快照样例（纯 mock）。", snapshot }, null, 2),
    "utf-8"
  );

  console.log(`✨ 纯 mock 样例已生成到 ${OUTPUT_DIR}/\n`);
}
