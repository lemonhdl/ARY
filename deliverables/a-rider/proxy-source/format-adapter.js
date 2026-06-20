/**
 * DCR Desktop App — Format Adapter
 *
 * 将所有 Agent 的请求/响应统一转换为 OpenAI Chat Completions 格式，
 * 仅用于内部记录，不修改原始请求/响应（原始数据原样透传）。
 *
 * 支持的格式：
 *   - Anthropic Messages API (Claude Code / Claude Agent SDK)
 *   - OpenAI Chat Completions API (Codex / ChatGPT / 各种兼容客户端)
 *
 * 扩展新 Agent 只需新增检测规则和 →OpenAI 转换函数。
 */

import { randomUUID } from "node:crypto";

// ══════════════════════════════════════════════════════
// Agent 类型检测
// ══════════════════════════════════════════════════════

/**
 * 通过请求 URL 和 body 检测 Agent 类型。
 *
 * 检测策略（按优先级）：
 * 1. URL 路径特征匹配
 * 2. 请求体结构特征匹配（兜底）
 *
 * @param {string} url - 请求 URL 路径
 * @param {object|string} body - 请求体（已解析或字符串）
 * @returns {'anthropic'|'openai'|'unknown'}
 */
export function detectAgentType(url, body) {
  const path = (url || "").toLowerCase();

  // ── 路径特征 ──
  // Anthropic Messages API: /v1/messages
  // DeepSeek Anthropic 兼容: /anthropic/v1/messages 或 /anthropic/messages
  if (path.includes("/v1/messages") && !path.includes("/chat")) return "anthropic";
  if (path.includes("/anthropic")) return "anthropic";

  // OpenAI Chat Completions: /v1/chat/completions
  if (path.includes("/chat/completions")) return "openai";

  // ── 请求体结构特征（路径不明确时） ──
  let parsed = body;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return "unknown"; }
  }
  if (!parsed || typeof parsed !== "object") return "unknown";

  // Anthropic: messages[].content 是数组 [{type, text}]
  if (parsed.messages?.length > 0) {
    const firstContent = parsed.messages[0].content;
    if (Array.isArray(firstContent) && firstContent.length > 0 && firstContent[0].type) {
      return "anthropic";
    }
    // OpenAI: messages[].content 是字符串，且有 role
    if (typeof firstContent === "string" && parsed.messages[0].role) {
      return "openai";
    }
  }

  return "unknown";
}

// ══════════════════════════════════════════════════════
// Anthropic → OpenAI 请求转换
// ══════════════════════════════════════════════════════

/**
 * Anthropic Messages API 请求 → OpenAI Chat Completions 请求。
 *
 * 映射关系：
 *   Anthropic                    OpenAI
 *   ─────────                    ──────
 *   system (str/array)  →  messages[] role:system
 *   messages[].role     →  messages[].role
 *   messages[].content  →  messages[].content (block数组 → 字符串/数组)
 *   tools[].name        →  tools[].function.name
 *   tools[].input_schema → tools[].function.parameters
 *   max_tokens          →  max_tokens
 *   stop_sequences      →  stop
 *   temperature         →  temperature
 *   top_p               →  top_p
 *   stream              →  stream
 *   metadata.user_id    →  user
 *
 * @param {object} anthropicReq - Anthropic 格式请求体
 * @returns {object} OpenAI 格式请求体
 */
export function anthropicRequestToOpenAI(anthropicReq) {
  const messages = [];

  // ── System prompt ──
  if (anthropicReq.system) {
    if (typeof anthropicReq.system === "string") {
      messages.push({ role: "system", content: anthropicReq.system });
    } else if (Array.isArray(anthropicReq.system)) {
      const text = anthropicReq.system
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("\n");
      if (text) messages.push({ role: "system", content: text });
    }
  }

  // ── Messages ──
  for (const msg of anthropicReq.messages || []) {
    const openaiMsg = { role: msg.role };

    if (typeof msg.content === "string") {
      openaiMsg.content = msg.content;
    } else if (Array.isArray(msg.content)) {
      // 检查是否全部是 text 块（可以简化为字符串）
      const textBlocks = msg.content.filter(b => b.type === "text");
      const toolUseBlocks = msg.content.filter(b => b.type === "tool_use");
      const toolResultBlocks = msg.content.filter(b => b.type === "tool_result");
      const imageBlocks = msg.content.filter(b => b.type === "image");

      if (msg.role === "user" && imageBlocks.length > 0) {
        // 多模态：保留数组结构
        openaiMsg.content = msg.content.map(b => {
          if (b.type === "text") return { type: "text", text: b.text };
          if (b.type === "image") return {
            type: "image_url",
            image_url: { url: `data:${b.source?.media_type || "image/png"};base64,${b.source?.data || ""}` },
          };
          if (b.type === "tool_result") return {
            role: "tool",
            tool_call_id: b.tool_use_id || "",
            content: typeof b.content === "string" ? b.content : JSON.stringify(b.content),
          };
          return b;
        });
      } else if (toolResultBlocks.length > 0) {
        // tool_result → role: tool
        openaiMsg.role = "tool";
        const tr = toolResultBlocks[0];
        openaiMsg.tool_call_id = tr.tool_use_id || "";
        openaiMsg.content = tr.content || "";
      } else if (textBlocks.length === msg.content.length) {
        // 纯文本 → 字符串
        openaiMsg.content = textBlocks.map(b => b.text).join("");
      } else {
        // 混合 → 保留数组
        openaiMsg.content = msg.content.map(b => {
          if (b.type === "text") return b.text;
          if (b.type === "tool_use") return `[tool_use: ${b.name}]`;
          if (b.type === "tool_result") return `[tool_result: ${b.tool_use_id}]`;
          return JSON.stringify(b);
        }).join("\n");
      }
    }

    // tool_calls（来自 assistant 消息中的 tool_use）
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      const toolUses = msg.content.filter(b => b.type === "tool_use");
      if (toolUses.length > 0) {
        openaiMsg.tool_calls = toolUses.map(tu => ({
          id: tu.id || `toolu_${randomUUID().slice(0, 8)}`,
          type: "function",
          function: {
            name: tu.name || "unknown",
            arguments: JSON.stringify(tu.input || {}),
          },
        }));
        // 保留 text 部分
        const texts = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
        openaiMsg.content = texts || null;
      }
    }

    messages.push(openaiMsg);
  }

  // ── Base ──
  const openaiReq = {
    model: anthropicReq.model || "",
    messages,
    max_tokens: anthropicReq.max_tokens || null,
    temperature: anthropicReq.temperature ?? null,
    top_p: anthropicReq.top_p ?? null,
    stream: anthropicReq.stream ?? true,
  };

  if (anthropicReq.stop_sequences?.length) openaiReq.stop = anthropicReq.stop_sequences;
  if (anthropicReq.metadata?.user_id) openaiReq.user = anthropicReq.metadata.user_id;

  // ── Tools ──
  if (anthropicReq.tools?.length) {
    openaiReq.tools = anthropicReq.tools.map(t => ({
      type: "function",
      function: {
        name: t.name || "unknown",
        description: t.description || "",
        parameters: t.input_schema || {},
      },
    }));
    // tool_choice
    if (anthropicReq.tool_choice) {
      const tc = anthropicReq.tool_choice;
      if (tc.type === "auto") openaiReq.tool_choice = "auto";
      else if (tc.type === "any") openaiReq.tool_choice = "required";
      else if (tc.type === "tool" && tc.name) {
        openaiReq.tool_choice = { type: "function", function: { name: tc.name } };
      }
    }
  }

  return openaiReq;
}

// ══════════════════════════════════════════════════════
// Anthropic → OpenAI 响应转换
// ══════════════════════════════════════════════════════

/**
 * Anthropic 非流式响应 → OpenAI Chat Completions 响应。
 */
export function anthropicResponseToOpenAI(anthropicRes, model) {
  // ── Content ──
  let content = "";
  const toolCalls = [];

  for (const block of anthropicRes.content || []) {
    if (block.type === "text") {
      content += (content ? "\n" : "") + block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id || `toolu_${randomUUID().slice(0, 8)}`,
        type: "function",
        function: {
          name: block.name || "unknown",
          arguments: JSON.stringify(block.input || {}),
        },
      });
    }
  }

  // ── Finish reason ──
  const finishMap = {
    "end_turn": "stop",
    "max_tokens": "length",
    "tool_use": "tool_calls",
    "stop_sequence": "stop",
  };
  const finishReason = finishMap[anthropicRes.stop_reason] || anthropicRes.stop_reason || "stop";

  // ── Usage ──
  const usage = anthropicRes.usage ? {
    prompt_tokens: anthropicRes.usage.input_tokens || 0,
    completion_tokens: anthropicRes.usage.output_tokens || 0,
    total_tokens: (anthropicRes.usage.input_tokens || 0) + (anthropicRes.usage.output_tokens || 0),
  } : null;

  return {
    id: anthropicRes.id || `chatcmpl-${randomUUID().slice(0, 12)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model || anthropicRes.model || "",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: content || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: finishReason,
    }],
    ...(usage ? { usage } : {}),
  };
}

// ══════════════════════════════════════════════════════
// Anthropic SSE → OpenAI SSE 事件转换
// ══════════════════════════════════════════════════════

let _responseId = "";
let _model = "";
let _contentAccum = "";
let _toolCallsAccum = [];
let _finishReason = "";
let _usage = null;
let _choiceIndex = 0;

function resetSSEState() {
  _responseId = `chatcmpl-${randomUUID().slice(0, 12)}`;
  _model = "";
  _contentAccum = "";
  _toolCallsAccum = [];
  _finishReason = "";
  _usage = null;
  _choiceIndex = 0;
}

/**
 * 将单条 Anthropic SSE 事件转换为 OpenAI SSE chunk。
 * 有状态：需要按顺序调用以保持上下文。
 *
 * Anthropic SSE 事件类型:
 *   message_start      → 初始化
 *   content_block_start → 内容块开始（text / tool_use）
 *   content_block_delta → 内容增量
 *   content_block_stop  → 内容块结束
 *   message_delta       → stop_reason + usage
 *   message_stop        → 最终结束
 *
 * @param {object} event - 已解析的 Anthropic SSE 事件
 * @param {string} event.type
 * @returns {object|null} OpenAI SSE chunk 或 null
 */
export function anthropicSSEToOpenAIChunk(event) {
  if (!event || !event.type) return null;

  switch (event.type) {
    case "message_start": {
      resetSSEState();
      _responseId = `chatcmpl-${randomUUID().slice(0, 12)}`;
      _model = event.message?.model || "";
      return {
        id: _responseId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: _model,
        choices: [{ index: 0, delta: { role: "assistant", content: "" } }],
      };
    }

    case "content_block_start": {
      const block = event.content_block || {};
      if (block.type === "tool_use") {
        const tc = {
          index: _toolCallsAccum.length,
          id: block.id || `toolu_${randomUUID().slice(0, 8)}`,
          type: "function",
          function: { name: block.name || "", arguments: "" },
        };
        _toolCallsAccum.push(tc);
        return {
          id: _responseId,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: _model,
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: tc.index,
                id: tc.id,
                type: "function",
                function: { name: tc.function.name, arguments: "" },
              }],
            },
          }],
        };
      }
      return null; // text block start — no chunk emitted
    }

    case "content_block_delta": {
      const delta = event.delta || {};
      if (delta.type === "text_delta") {
        _contentAccum += delta.text || "";
        return {
          id: _responseId,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: _model,
          choices: [{ index: 0, delta: { content: delta.text || "" } }],
        };
      }
      if (delta.type === "input_json_delta") {
        const tc = _toolCallsAccum[_toolCallsAccum.length - 1];
        if (tc) {
          tc.function.arguments += delta.partial_json || "";
          return {
            id: _responseId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: _model,
            choices: [{
              index: 0,
              delta: {
                tool_calls: [{
                  index: tc.index,
                  function: { arguments: delta.partial_json || "" },
                }],
              },
            }],
          };
        }
      }
      return null;
    }

    case "content_block_stop": {
      return null; // 无独立 chunk
    }

    case "message_delta": {
      const finishMap = {
        "end_turn": "stop",
        "max_tokens": "length",
        "tool_use": "tool_calls",
        "stop_sequence": "stop",
      };
      _finishReason = finishMap[event.delta?.stop_reason] || event.delta?.stop_reason || "";
      if (event.usage) {
        _usage = {
          prompt_tokens: event.usage.input_tokens || 0,
          completion_tokens: event.usage.output_tokens || 0,
          total_tokens: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0),
        };
      }
      return null; // 合并到 message_stop
    }

    case "message_stop": {
      const chunk = {
        id: _responseId,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: _model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: _finishReason || "stop",
        }],
      };
      if (_usage) chunk.usage = _usage;
      return chunk;
    }

    // ── Ping / error ──
    case "ping":
      return null;

    default:
      return null;
  }
}

/**
 * 获取当前累积的完整 OpenAI 响应（非流式聚合）。
 * 在 SSE 流结束后调用，返回完整的 Chat Completions 格式。
 */
export function getSSEAggregatedResponse() {
  return {
    id: _responseId,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: _model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: _contentAccum || null,
        ...(_toolCallsAccum.length > 0 ? {
          tool_calls: _toolCallsAccum.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        } : {}),
      },
      finish_reason: _finishReason || "stop",
    }],
    ...(_usage ? { usage: _usage } : {}),
  };
}

// ══════════════════════════════════════════════════════
// 统一入口
// ══════════════════════════════════════════════════════

/**
 * 将任意 Agent 格式的请求统一转换为 OpenAI Chat Completions 格式。
 *
 * @param {string} url - 请求 URL
 * @param {object|string} body - 请求体
 * @returns {{ agentType: string, openaiRequest: object }}
 */
export function normalizeRequest(url, body) {
  const agentType = detectAgentType(url, body);

  let parsed = body;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
  }

  let openaiRequest;
  switch (agentType) {
    case "anthropic":
      openaiRequest = anthropicRequestToOpenAI(parsed);
      break;
    case "openai":
      openaiRequest = parsed; // 已经是目标格式
      break;
    default:
      // 尽力而为：尝试按 Anthropic 解析，不行就原样保留
      if (parsed.messages && Array.isArray(parsed.messages)) {
        try {
          openaiRequest = anthropicRequestToOpenAI(parsed);
        } catch {
          openaiRequest = parsed;
        }
      } else {
        openaiRequest = parsed;
      }
  }

  return { agentType, openaiRequest };
}

/**
 * 从 OpenAI 格式响应中提取元数据（统一的元数据提取，不需要分 Anthropic/OpenAI 两套逻辑）。
 *
 * @param {object} openaiResponse - OpenAI Chat Completions 格式响应
 * @param {object} openaiRequest - OpenAI Chat Completions 格式请求
 * @param {number} elapsed - 耗时 ms
 * @returns {object} 元数据
 */
export function extractMetaFromOpenAI(openaiResponse, openaiRequest, elapsed) {
  const choice = openaiResponse?.choices?.[0] || {};

  const meta = {
    model: openaiResponse?.model || openaiRequest?.model || "",
    prompt: "",
    usage: null,
    finishReason: choice.finish_reason || "",
    toolCalls: [],
    contentPreview: "",
    duration: elapsed,
    agentType: openaiRequest._agentType || "unknown",
  };

  // ── Prompt ──
  if (openaiRequest?.messages) {
    const lastUser = [...openaiRequest.messages].reverse().find(m => m.role === "user");
    if (lastUser?.content) {
      meta.prompt = (typeof lastUser.content === "string"
        ? lastUser.content
        : JSON.stringify(lastUser.content)
      ).slice(0, 500);
    }
  }

  // ── Usage ──
  if (openaiResponse?.usage) {
    meta.usage = {
      input_tokens: openaiResponse.usage.prompt_tokens || 0,
      output_tokens: openaiResponse.usage.completion_tokens || 0,
      total_tokens: openaiResponse.usage.total_tokens || 0,
    };
  }

  // ── Tool Calls ──
  if (choice.message?.tool_calls) {
    meta.toolCalls = choice.message.tool_calls.map(t => t.function?.name || "unknown");
  }

  // ── Content ──
  if (choice.message?.content) {
    meta.contentPreview = choice.message.content.slice(0, 500);
  }

  // ── Tool Names from request ──
  if (openaiRequest?.tools) {
    meta.toolNames = openaiRequest.tools.map(t => t.function?.name || "?").filter(Boolean);
  }

  return meta;
}

/**
 * 从 OpenAI 格式 SSE 聚合结果中提取元数据。
 */
export function extractMetaFromOpenedSSE(aggregatedResponse, openaiRequest, elapsed) {
  return extractMetaFromOpenAI(aggregatedResponse, openaiRequest, elapsed);
}
