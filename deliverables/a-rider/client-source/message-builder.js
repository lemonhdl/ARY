/**
 * DCR Desktop App — Message Builder
 *
 * 把 Claude Code 原始 JSONL 事件转换为 ARY 标准 RidingSignalMessage。
 *
 * 身份字段当前使用 identity-config.json 中的假数据，
 * 标注 __MOCK__，等服务端 API 就绪后替换。
 *
 * Claude Code JSONL 实际格式（v2.1.x）:
 *   type 在顶层: "user" | "assistant" | "mode" | "permission-mode" | ...
 *   role 在 message 内: message.role = "user" | "assistant"
 *   user 消息: message.content 是纯字符串（真实 prompt）
 *             或 message.content 是 [{tool_use_id, type:"tool_result", content}]
 *   assistant 消息: message.content 是 [{type:"thinking"|"tool_use"|"text", ...}]
 *   token 用量: message.usage.input_tokens / output_tokens
 *   timestamp: ISO 8601 字符串
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { signMessage, verifyMessage } from "./signing.js";

// ══════════════════════════════════════════════════════
// 配置
// ══════════════════════════════════════════════════════

const IDENTITY_PATH = join(import.meta.dirname, "identity-config.json");
const SCHEMA_VERSION = "ary.ca.riding_signal.v0.1";

function loadIdentity() {
  if (existsSync(IDENTITY_PATH)) {
    return JSON.parse(readFileSync(IDENTITY_PATH, "utf-8"));
  }
  return {
    race: { raceId: "__MOCK__race_unknown", taskId: "__MOCK__task_unknown" },
    rider: { registrationId: "__MOCK__reg_unknown", raceProjectId: "__MOCK__rp_unknown" },
    ca: {
      caConnectionId: "__MOCK__conn_unknown",
      caType: "claude_code",
      connectorId: "__MOCK__dcr_desktop_v0.1",
      connectorVersion: "0.1.0",
    },
  };
}

// ══════════════════════════════════════════════════════
// 事件类型判断
// ══════════════════════════════════════════════════════

/** 需要跳过的系统事件类型（不产生骑行信号） */
const SKIP_TYPES = new Set([
  "mode", "permission-mode", "file-history-snapshot",
  "system", "title", "todo", "summary",
]);

/** 判断是否为真实用户 Prompt（非 tool_result） */
function isRealUserPrompt(event) {
  return event.type === "user"
    && event.message?.role === "user"
    && typeof event.message?.content === "string";
}

/** 判断是否为 tool_result 回传 */
function isToolResult(event) {
  return event.type === "user"
    && event.message?.role === "user"
    && Array.isArray(event.message?.content);
}

/** 判断是否为 assistant 消息 */
function isAssistant(event) {
  return event.type === "assistant"
    && event.message?.role === "assistant";
}

// ══════════════════════════════════════════════════════
// 内容提取（适配实际 JSONL 格式）
// ══════════════════════════════════════════════════════

/** 从 assistant message.content 数组中提取文本块 */
function getAssistantBlocks(message) {
  if (!message?.content) return [];
  if (Array.isArray(message.content)) return message.content;
  if (typeof message.content === "string") return [{ type: "text", text: message.content }];
  return [];
}

/** 从 assistant 消息中提取纯文本内容 */
function getAssistantText(event) {
  const blocks = getAssistantBlocks(event.message);
  return blocks
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join(" ");
}

/** 检查 assistant 消息是否包含 tool_use */
function hasToolUse(event) {
  const blocks = getAssistantBlocks(event.message);
  return blocks.some(b => b.type === "tool_use");
}

/** 获取 assistant 消息中的所有工具名称 */
function getToolNames(event) {
  const blocks = getAssistantBlocks(event.message);
  return blocks
    .filter(b => b.type === "tool_use")
    .map(b => b.name || "")
    .filter(Boolean);
}

/** 提取用户 prompt 文本 */
function getPromptText(event) {
  if (typeof event.message?.content === "string") return event.message.content;
  return "";
}

/** 从事件中提取 token 用量 */
function extractTokens(event) {
  if (event.message?.usage) {
    return (event.message.usage.input_tokens || 0) + (event.message.usage.output_tokens || 0);
  }
  return 0;
}

// ══════════════════════════════════════════════════════
// signal.type 推断
// ══════════════════════════════════════════════════════

/**
 * 从单条 Claude Code 事件推断 ARY signal.type。
 * 返回 null 表示此事件不产生骑行信号。
 */
function inferSignalType(event, context) {
  // 跳过系统事件
  if (SKIP_TYPES.has(event.type)) return null;

  // ── 真实用户 prompt ──────────────────────────────
  if (isRealUserPrompt(event)) {
    if (context.messageCount === 0) return "riding_started";
    const text = getPromptText(event);
    if (/卡住|不行|不对|报错|失败了|重来|stuck|error|fail/i.test(text)) {
      return "task_blocked";
    }
    return "task_progress";
  }

  // ── tool_result 回传 ─────────────────────────────
  if (isToolResult(event)) {
    // 检查 tool_result 是否包含错误
    const blocks = event.message.content;
    if (blocks.some(b => b.is_error)) return "risk_detected";
    return "task_progress";
  }

  // ── assistant 消息 ──────────────────────────────
  if (isAssistant(event)) {
    if (hasToolUse(event)) {
      const names = getToolNames(event);
      if (names.some(n => /test|validate|check|lint|build/i.test(n))) {
        return "validation_run";
      }
    }
    return "task_progress";
  }

  return null;
}

// ══════════════════════════════════════════════════════
// technicalActions 提取
// ══════════════════════════════════════════════════════

function extractTechnicalActionsFromEvents(events) {
  const actions = {};

  for (const ev of events) {
    if (isAssistant(ev) && hasToolUse(ev)) {
      const names = getToolNames(ev);
      for (const name of names) {
        let cat;
        if (/bash|terminal|shell|cmd|command/i.test(name)) cat = "command_executed";
        else if (/write|edit|create|update|replace/i.test(name)) cat = "file_changed";
        else if (/test|validate|check|lint|build/i.test(name)) cat = "test_run";
        else cat = "tool_called";
        actions[cat] = (actions[cat] || 0) + 1;
      }
    }
  }

  return Object.entries(actions).map(([type, count]) => ({ type, count }));
}

// ══════════════════════════════════════════════════════
// 消息构造（主入口）
// ══════════════════════════════════════════════════════

/**
 * 从 Claude Code JSONL 原始事件构造 RidingSignalMessage 数组。
 */
export function buildMessages(rawEvents, sessionMeta = {}, overrides = {}) {
  const identity = loadIdentity();
  const race = { ...identity.race, ...overrides.race };
  const rider = { ...identity.rider, ...overrides.rider };
  const ca = { ...identity.ca, ...overrides.ca };

  const caProjectId = sessionMeta.cwd || identity.ca.caProjectId || "__MOCK__unknown_project";
  const caSessionId = sessionMeta.sessionId || randomUUID();
  const connectorId = ca.connectorId;

  let sequence = 0;
  const counters = { tokens: 0, sessionCount: 1, messageCount: 0, toolCallCount: 0, allRidingMessageLength: 0 };
  const ctx = { messageCount: 0, messageIndex: 0 };
  const messages = [];

  for (let i = 0; i < rawEvents.length; i++) {
    const raw = rawEvents[i];
    const signalType = inferSignalType(raw, ctx);

    // 不产生信号的事件
    if (!signalType) continue;

    // 累加
    ctx.messageCount++;
    counters.messageCount = ctx.messageCount;
    if (isAssistant(raw) && hasToolUse(raw)) counters.toolCallCount++;
    counters.tokens += extractTokens(raw);

    const finalType = ctx.messageCount === 1 ? "session_started" : signalType;

    // 提取对话展示文本
    const display = buildDisplay(raw);

    // 构建信号描述
    let noteReason;
    if (signalType === "task_blocked") {
      noteReason = isRealUserPrompt(raw) ? getPromptText(raw).slice(0, 80) : "task_blocked";
    }

    const msg = {
      schemaVersion: SCHEMA_VERSION,
      messageId: `msg_${randomUUID().slice(0, 12)}`,
      idempotencyKey: [ca.caType, race.raceId, rider.registrationId, connectorId, caSessionId, `seq_${sequence}`].join(":"),
      sequence: sequence++,
      timestamp: raw.timestamp || new Date().toISOString(),

      race: { ...race },
      rider: { ...rider },
      ca: {
        caConnectionId: ca.caConnectionId,
        caType: ca.caType,
        connectorId,
        connectorVersion: ca.connectorVersion,
        caProjectId,
        caSessionId,
      },

      signal: {
        kind: signalType === "risk_detected" || signalType === "task_blocked" ? "event" : "event",
        type: finalType,
        phase: inferPhase(finalType),
        taskStatus: inferTaskStatus(finalType),
        progressPercent: Math.min(95, Math.round((i / rawEvents.length) * 100)),
        ...(noteReason ? { noteReason } : {}),
      },

      counters: { ...counters },
      technicalActions: [],  // 最后统一填充
      summary: buildSummary(raw, finalType, counters, ctx),

      // 对话展示层——给前端做聊天界面用的
      display,
    };

    counters.allRidingMessageLength += JSON.stringify(msg).length;
    messages.push(msg);
  }

  // 统一计算 technicalActions（从全部 assistant 事件中提取）
  const allTechActions = extractTechnicalActionsFromEvents(rawEvents);
  for (const msg of messages) {
    msg.technicalActions = allTechActions;
  }

  return messages;
}

/**
 * 构造失败状态消息（W5 接入失败上报）
 */
export function buildFailureMessage(reason, sessionMeta = {}, overrides = {}) {
  const identity = loadIdentity();
  const race = { ...identity.race, ...overrides.race };
  const rider = { ...identity.rider, ...overrides.rider };
  const ca = { ...identity.ca, ...overrides.ca };

  return [{
    schemaVersion: SCHEMA_VERSION,
    messageId: `msg_${randomUUID().slice(0, 12)}`,
    idempotencyKey: [ca.caType, race.raceId, rider.registrationId, "connection_failed", new Date().toISOString().replace(/[T:.\-]/g, "").slice(0, 14)].join(":"),
    timestamp: new Date().toISOString(),
    race: { ...race },
    rider: { ...rider },
    ca: {
      caConnectionId: ca.caConnectionId,
      caType: ca.caType,
      connectorId: ca.connectorId,
      connectorVersion: ca.connectorVersion,
      caProjectId: sessionMeta.cwd || "__MOCK__unknown_project",
      caSessionId: sessionMeta.sessionId || "__MOCK__unknown_session",
    },
    signal: { kind: "event", type: "risk_detected", phase: "paused", taskStatus: "blocked" },
    ingestion: {
      status: "failed",
      statusReason: reason || "ca_session_permission_denied",
      lastSyncedAt: new Date().toISOString(),
      scope: "ca_connection",
    },
  }];
}

/**
 * 构造 Session 快照摘要（W3 fetch 返回结构）
 */
export function buildSessionSnapshot(rawEvents, sessionMeta = {}, overrides = {}) {
  const identity = loadIdentity();
  const ca = { ...identity.ca, ...overrides.ca };
  const messages = buildMessages(rawEvents, sessionMeta, overrides);
  const last = messages[messages.length - 1] || {};
  const techActions = extractTechnicalActionsFromEvents(rawEvents);

  return {
    schemaVersion: "ary.ca.session_snapshot.v0.1",
    fetchedAt: new Date().toISOString(),
    ca: {
      caConnectionId: ca.caConnectionId,
      caType: ca.caType,
      caProjectId: sessionMeta.cwd || "__MOCK__unknown_project",
      caSessionId: sessionMeta.sessionId || "__MOCK__unknown_session",
    },
    session: {
      startedAt: sessionMeta.startedAt
        ? new Date(sessionMeta.startedAt).toISOString()
        : (rawEvents[0]?.timestamp || new Date().toISOString()),
      endedAt: null,
      lastActiveAt: rawEvents[rawEvents.length - 1]?.timestamp || new Date().toISOString(),
      messageCount: messages.length,
      toolCallCount: last.counters?.toolCallCount || 0,
      tokens: last.counters?.tokens || 0,
      allRidingMessageLength: messages.reduce((s, m) => s + JSON.stringify(m).length, 0),
    },
    task: {
      taskId: (overrides.race || identity.race).taskId,
      taskStatus: last.signal?.taskStatus || "in_progress",
      progressPercent: last.signal?.progressPercent || 0,
    },
    technicalActions: techActions,
    summary: {
      currentGoal: findLatestPrompt(rawEvents),
      latestActivity: last.summary?.latestActivity || "",
      riskLevel: last.summary?.riskLevel || "low",
      riskReason: last.summary?.riskReason || "",
    },
  };
}

/**
 * 生成 CAConnection 状态对象
 */
export function buildCAStatus(status, sessionMeta = {}, detail = {}) {
  const identity = loadIdentity();
  const valid = ["not_configured", "registered", "handshaken", "active", "failed"];
  if (!valid.includes(status)) throw new Error(`Invalid status: ${status}. Must be: ${valid.join(", ")}`);

  return {
    caConnectionId: detail.caConnectionId || identity.ca.caConnectionId,
    caType: identity.ca.caType,
    connectorId: identity.ca.connectorId,
    connectorVersion: identity.ca.connectorVersion,
    caProjectId: sessionMeta.cwd || "__MOCK__unknown_project",
    caSessionId: sessionMeta.sessionId || "__MOCK__unknown_session",
    ingestionStatus: status,
    registeredAt: status === "not_configured" ? null : (detail.registeredAt || new Date().toISOString()),
    handshakenAt: ["handshaken", "active", "failed"].includes(status)
      ? (detail.handshakenAt || new Date().toISOString()) : null,
    lastActiveAt: status === "active" ? (detail.lastActiveAt || new Date().toISOString()) : null,
    failedAt: status === "failed" ? (detail.failedAt || new Date().toISOString()) : null,
    statusReason: status === "failed" ? (detail.statusReason || "ca_session_permission_denied") : null,
    __NOTE__: "身份字段使用本地假数据。raceId/registrationId/raceProjectId 等服务端就绪后替换。",
  };
}

// ══════════════════════════════════════════════════════
// 辅助
// ══════════════════════════════════════════════════════

function inferPhase(type) {
  if (/finished|completed/i.test(type)) return "finished";
  if (/blocked|risk_detected/i.test(type)) return "paused";
  return "riding";
}

function inferTaskStatus(type) {
  if (/finished|completed/i.test(type)) return "completed";
  if (/blocked|risk_detected/i.test(type)) return "blocked";
  return "in_progress";
}

function buildSummary(event, signalType, counters, ctx) {
  let text = "";
  if (isRealUserPrompt(event)) text = getPromptText(event);
  else if (isAssistant(event)) text = getAssistantText(event);

  let risk = "low";
  if (signalType === "risk_detected" || signalType === "task_blocked") risk = "high";
  else if (counters.toolCallCount > 30) risk = "medium";

  return {
    currentGoal: ctx._taskGoal || "Agent Riding in progress",
    latestActivity: text.slice(0, 100) || "Processing",
    riskLevel: risk,
    riskReason: risk === "high" ? text.slice(0, 80) : "",
  };
}

function findLatestPrompt(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (isRealUserPrompt(events[i])) {
      return getPromptText(events[i]).slice(0, 120);
    }
  }
  return "Agent Riding in progress";
}

/** 从原始事件提取对话展示内容 */
function buildDisplay(event) {
  if (isRealUserPrompt(event)) {
    return {
      role: "rider",
      text: getPromptText(event),
      toolCalls: [],
    };
  }
  if (isToolResult(event)) {
    // tool_result — 显示工具输出摘要
    const blocks = event.message.content;
    const outputs = blocks.map(b => {
      const out = (b.content || "").toString();
      return out.length > 200 ? out.slice(0, 200) + "…" : out;
    });
    return {
      role: "tool",
      text: outputs.join("\n"),
      toolCalls: [],
    };
  }
  if (isAssistant(event)) {
    const blocks = getAssistantBlocks(event.message);
    const textParts = blocks.filter(b => b.type === "text").map(b => b.text);
    const toolNames = blocks.filter(b => b.type === "tool_use").map(b => b.name);
    const thinking = blocks.filter(b => b.type === "thinking").length > 0;
    return {
      role: "claude",
      text: textParts.join("\n"),
      toolCalls: toolNames,
      thinking,
    };
  }
  return { role: "system", text: event.type || "", toolCalls: [] };
}

// ══════════════════════════════════════════════════════
// W9 签名集成
// ══════════════════════════════════════════════════════

/**
 * 对消息数组批量签名。
 * @param {object[]} messages - buildMessages 的输出
 * @param {string} privateKeyPEM - Ed25519 私钥
 * @returns {object[]} 带签名的消息数组
 */
export function signMessages(messages, privateKeyPEM) {
  return messages.map(m => signMessage(m, privateKeyPEM));
}

/**
 * 验签消息数组。
 * @param {object[]} signedMessages - 带签名的消息
 * @param {string} publicKeyPEM - Ed25519 公钥
 * @returns {{ allValid: boolean, results: object[] }}
 */
export function verifyMessages(signedMessages, publicKeyPEM) {
  const results = signedMessages.map((m, i) => ({
    index: i,
    messageId: m.messageId,
    ...verifyMessage(m, publicKeyPEM),
  }));
  return {
    allValid: results.every(r => r.valid),
    results,
  };
}
