/**
 * DCR Desktop App — Message Builder
 *
 * 将 Agent 原始事件转换为 ARY 标准 RidingSignalMessage。
 *
 * 支持两种输入格式：
 *   - Claude Code JSONL（Anthropic 内部事件格式）
 *   - DCR Chain Entry（统一 OpenAI Chat Completions 格式）
 *
 * 身份字段当前使用 identity-config.json 中的假数据，
 * 标注 __MOCK__，等服务端 API 就绪后替换。
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
// Claude Code JSONL 事件判断（Anthropic 格式）
// ══════════════════════════════════════════════════════

const SKIP_TYPES = new Set([
  "mode", "permission-mode", "file-history-snapshot",
  "system", "title", "todo", "summary",
]);

function isRealUserPrompt(event) {
  return event.type === "user"
    && event.message?.role === "user"
    && typeof event.message?.content === "string";
}

function isToolResult(event) {
  return event.type === "user"
    && event.message?.role === "user"
    && Array.isArray(event.message?.content);
}

function isAssistant(event) {
  return event.type === "assistant"
    && event.message?.role === "assistant";
}

function getAssistantBlocks(message) {
  if (!message?.content) return [];
  if (Array.isArray(message.content)) return message.content;
  if (typeof message.content === "string") return [{ type: "text", text: message.content }];
  return [];
}

function getAssistantText(event) {
  const blocks = getAssistantBlocks(event.message);
  return blocks.filter(b => b.type === "text").map(b => b.text).join(" ");
}

function hasToolUse(event) {
  const blocks = getAssistantBlocks(event.message);
  return blocks.some(b => b.type === "tool_use");
}

function getToolNames(event) {
  const blocks = getAssistantBlocks(event.message);
  return blocks.filter(b => b.type === "tool_use").map(b => b.name || "").filter(Boolean);
}

function getPromptText(event) {
  if (typeof event.message?.content === "string") return event.message.content;
  return "";
}

function extractTokens(event) {
  if (event.message?.usage) {
    return (event.message.usage.input_tokens || 0) + (event.message.usage.output_tokens || 0);
  }
  return 0;
}

// ══════════════════════════════════════════════════════
// Claude Code signal.type 推断
// ══════════════════════════════════════════════════════

function inferSignalType(event, context) {
  if (SKIP_TYPES.has(event.type)) return null;

  if (isRealUserPrompt(event)) {
    if (context.messageCount === 0) return "riding_started";
    const text = getPromptText(event);
    if (/卡住|不行|不对|报错|失败了|重来|stuck|error|fail/i.test(text)) return "task_blocked";
    return "task_progress";
  }

  if (isToolResult(event)) {
    const blocks = event.message.content;
    if (blocks.some(b => b.is_error)) return "risk_detected";
    return "task_progress";
  }

  if (isAssistant(event)) {
    if (hasToolUse(event)) {
      const names = getToolNames(event);
      if (names.some(n => /test|validate|check|lint|build/i.test(n))) return "validation_run";
    }
    return "task_progress";
  }

  return null;
}

function extractTechnicalActionsFromEvents(events) {
  const actions = {};
  for (const ev of events) {
    if (isAssistant(ev) && hasToolUse(ev)) {
      for (const name of getToolNames(ev)) {
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
// 统一格式（Chain Entry）→ RidingSignalMessage
// ══════════════════════════════════════════════════════

/**
 * 从 DCR Chain Entry（统一 OpenAI 格式）构造 RidingSignalMessage。
 */
function buildMessageFromChainEntry(entry, identity, overrides, sequence, counters) {
  const race = { ...identity.race, ...overrides.race };
  const rider = { ...identity.rider, ...overrides.rider };
  const ca = { ...identity.ca, ...overrides.ca };

  const caType = entry.agentType === "anthropic" ? "claude_code"
    : entry.agentType === "openai" ? "codex"
    : entry.agentType || ca.caType;

  // 推断 signal type
  let signalType = "task_progress";
  if (sequence === 0) signalType = "session_started";
  if (entry.toolCalls?.some(t => /test|validate|check|lint|build/i.test(t))) signalType = "validation_run";
  if (entry.status >= 400) signalType = "risk_detected";

  const msg = {
    schemaVersion: SCHEMA_VERSION,
    messageId: entry.requestId ? `msg_${entry.requestId.slice(0, 12)}` : `msg_${randomUUID().slice(0, 12)}`,
    idempotencyKey: [caType, race.raceId, rider.registrationId, ca.connectorId, entry.sessionId || "", `seq_${sequence}`].join(":"),
    sequence,
    timestamp: entry.timestamp || new Date().toISOString(),

    race: { ...race },
    rider: { ...rider },
    ca: {
      caConnectionId: ca.caConnectionId,
      caType,
      connectorId: ca.connectorId,
      connectorVersion: ca.connectorVersion,
      caProjectId: overrides.caProjectId || entry.projectDir || "__MOCK__unknown_project",
      caSessionId: overrides.caSessionId || entry.sessionId || "__MOCK__unknown_session",
    },

    signal: {
      kind: signalType === "risk_detected" ? "event" : "event",
      type: signalType,
      phase: inferPhase(signalType),
      taskStatus: inferTaskStatus(signalType),
      progressPercent: Math.min(95, Math.round((sequence / Math.max(entry.totalEntries || 100, 1)) * 100)),
    },

    counters: { ...counters },
    technicalActions: entry.toolNames?.map(n => ({ type: "tool_called", count: 1 })) || [],
    summary: {
      currentGoal: entry.promptPreview?.slice(0, 100) || "Agent Riding in progress",
      latestActivity: entry.contentPreview?.slice(0, 100) || entry.promptPreview?.slice(0, 100) || "Processing",
      riskLevel: entry.status >= 400 ? "high" : (entry.toolCalls?.length > 5 ? "medium" : "low"),
      riskReason: entry.status >= 400 ? `upstream status ${entry.status}` : "",
    },

    display: {
      role: "claude",
      text: entry.contentPreview?.slice(0, 500) || "",
      toolCalls: entry.toolCalls || [],
    },
  };

  return msg;
}

// ══════════════════════════════════════════════════════
// 主入口
// ══════════════════════════════════════════════════════

/**
 * 从 Claude Code JSONL 原始事件构造 RidingSignalMessage 数组。
 * （保留原有逻辑，向后兼容）
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
    if (!signalType) continue;

    ctx.messageCount++;
    counters.messageCount = ctx.messageCount;
    if (isAssistant(raw) && hasToolUse(raw)) counters.toolCallCount++;
    counters.tokens += extractTokens(raw);

    const finalType = ctx.messageCount === 1 ? "session_started" : signalType;

    const display = buildDisplay(raw);

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
        kind: "event",
        type: finalType,
        phase: inferPhase(finalType),
        taskStatus: inferTaskStatus(finalType),
        progressPercent: Math.min(95, Math.round((i / rawEvents.length) * 100)),
        ...(noteReason ? { noteReason } : {}),
      },

      counters: { ...counters },
      technicalActions: [],
      summary: buildSummary(raw, finalType, counters, ctx),
      display,
    };

    counters.allRidingMessageLength += JSON.stringify(msg).length;
    messages.push(msg);
  }

  const allTechActions = extractTechnicalActionsFromEvents(rawEvents);
  for (const msg of messages) {
    msg.technicalActions = allTechActions;
  }

  return messages;
}

/**
 * 从 DCR Chain Entries（统一 OpenAI 格式）构造 RidingSignalMessage 数组。
 *
 * @param {object[]} chainEntries - DCR chain store 的 entries
 * @param {object} sessionMeta - session 元信息
 * @param {object} overrides - 身份字段覆盖
 */
export function buildMessagesFromChain(chainEntries, sessionMeta = {}, overrides = {}) {
  const identity = loadIdentity();
  let sequence = 0;
  const counters = { tokens: 0, sessionCount: 1, messageCount: 0, toolCallCount: 0, allRidingMessageLength: 0 };
  const messages = [];

  for (const entry of chainEntries) {
    // 跳过基线条目
    if (entry.agentType === "baseline") continue;

    counters.messageCount++;
    counters.tokens += entry.usage?.total_tokens || entry.usage?.totalTokens || 0;
    counters.toolCallCount += (entry.toolCalls || []).length;

    // ① 骑手 Prompt
    if (entry.promptPreview) {
      const riderMsg = buildMessageFromChainEntry(entry, identity, { ...overrides, caProjectId: sessionMeta.cwd, caSessionId: sessionMeta.sessionId }, sequence, { ...counters });
      riderMsg.sequence = sequence++;
      riderMsg.display = { role: "rider", text: entry.promptPreview || "", toolCalls: [] };
      riderMsg.signal.type = sequence === 1 ? "session_started" : "task_progress";
      counters.allRidingMessageLength += JSON.stringify(riderMsg).length;
      messages.push(riderMsg);
    }

    // ② Agent 回复
    const claudeMsg = buildMessageFromChainEntry(entry, identity, { ...overrides, caProjectId: sessionMeta.cwd, caSessionId: sessionMeta.sessionId }, sequence, { ...counters });
    claudeMsg.sequence = sequence++;
    claudeMsg.display = { role: "claude", text: entry.contentPreview?.slice(0, 500) || "", toolCalls: entry.toolCalls || [], thinking: entry.toolCalls?.length > 0 };
    counters.allRidingMessageLength += JSON.stringify(claudeMsg).length;
    messages.push(claudeMsg);
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

function buildDisplay(event) {
  if (isRealUserPrompt(event)) {
    return { role: "rider", text: getPromptText(event), toolCalls: [] };
  }
  if (isToolResult(event)) {
    const blocks = event.message.content;
    const outputs = blocks.map(b => {
      const out = (b.content || "").toString();
      return out.length > 200 ? out.slice(0, 200) + "…" : out;
    });
    return { role: "tool", text: outputs.join("\n"), toolCalls: [] };
  }
  if (isAssistant(event)) {
    const blocks = getAssistantBlocks(event.message);
    const textParts = blocks.filter(b => b.type === "text").map(b => b.text);
    const toolNames = blocks.filter(b => b.type === "tool_use").map(b => b.name);
    const thinking = blocks.filter(b => b.type === "thinking").length > 0;
    return { role: "claude", text: textParts.join("\n"), toolCalls: toolNames, thinking };
  }
  return { role: "system", text: event.type || "", toolCalls: [] };
}

// ══════════════════════════════════════════════════════
// W9 签名集成
// ══════════════════════════════════════════════════════

export function signMessages(messages, privateKeyPEM) {
  return messages.map(m => signMessage(m, privateKeyPEM));
}

export function verifyMessages(signedMessages, publicKeyPEM) {
  const results = signedMessages.map((m, i) => ({
    index: i,
    messageId: m.messageId,
    ...verifyMessage(m, publicKeyPEM),
  }));
  return { allValid: results.every(r => r.valid), results };
}
