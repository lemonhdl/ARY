/**
 * DCR Local Proxy —— 透明中转站
 *
 * Claude Code 连到这里，DCR 原样转发到上游，过程中记录一切。
 *
 * 用法:
 *   node proxy.js
 *   Claude Code: ANTHROPIC_BASE_URL=http://localhost:3738
 */

import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { createChain, appendEntry, verifyChain, listChains, readChain } from "./chain-store.js";
import { captureFileState } from "./file-hash.js";

// ═══════════════════════════════ 配置

const LISTEN_PORT = parseInt(process.env.DCR_PROXY_PORT) || 3738;

// 上游：设为 Claude Code 原来连的那个地址（把 ANTHROPIC_BASE_URL 的值搬过来即可）
const UPSTREAM_URL = process.env.DCR_UPSTREAM_URL || "https://api.deepseek.com/anthropic";

// ═══════════════════════════════ 链

let activeChain = null;
function getOrCreateChain(sessionMeta = {}) {
  if (!activeChain) {
    activeChain = createChain(sessionMeta);
    console.log(`🔗 新骑行链: ${activeChain.chainId.slice(0, 8)}…`);
  }
  return activeChain;
}

// ═══════════════════════════════ 透明转发

function forwardToUpstream(targetUrl, method, headers, body) {
  return new Promise((resolve, reject) => {
    // 透传原始 Authorization，不做任何修改
    const fwdHeaders = { ...headers };
    delete fwdHeaders["host"];  // node http 模块会自动设

    const url = new URL(targetUrl);
    const isHttps = url.protocol === "https:";

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: fwdHeaders,
    };

    const transport = isHttps ? httpsRequest : httpRequest;
    const upstreamReq = transport(options, (upstreamRes) => {
      const chunks = [];
      upstreamRes.on("data", c => chunks.push(c));

      // 流式：逐块透传给 Claude Code 的同时也收集
      if (body) {
        upstreamRes._chunks = chunks;
      }

      upstreamRes.on("end", () => {
        resolve({
          status: upstreamRes.statusCode,
          headers: upstreamRes.headers,
          body: Buffer.concat(chunks).toString("utf-8"),
          bodyBytes: Buffer.concat(chunks),
          // 保留原始流引用，用于实时转发
          _stream: upstreamRes,
        });
      });
    });

    upstreamReq.on("error", reject);
    upstreamReq.setTimeout(600_000, () => { upstreamReq.destroy(); reject(new Error("upstream timeout")); });

    if (body) upstreamReq.write(body);
    upstreamReq.end();
  });
}

// ═══════════════════════════════ 元数据提取（兼容 Anthropic + OpenAI）

function extractMeta(reqText, resText, elapsed) {
  const meta = { model: "", prompt: "", usage: null, finishReason: "", toolCalls: [] };

  try {
    const req = JSON.parse(reqText);

    // ── 模型名 ──
    meta.model = req.model || "";

    // ── 用户 Prompt ──
    if (req.messages) {
      // OpenAI / Anthropic 通用
      const msgs = req.messages;
      // 取最后一条用户消息
      let lastUserMsg = null;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        const role = m.role || "";
        if (role === "user") { lastUserMsg = m; break; }
      }
      if (lastUserMsg?.content) {
        meta.prompt = extractText(lastUserMsg.content).slice(0, 500);
      }
    }

    // ── 工具定义 ──
    if (req.tools) {
      meta.toolNames = req.tools.map(t => t.name || t.function?.name || "?").filter(Boolean);
    }
  } catch { }

  try {
    const res = JSON.parse(resText);

    // ── 用量 ──
    if (res.usage) {
      // Anthropic: {input_tokens, output_tokens}
      // OpenAI: {prompt_tokens, completion_tokens, total_tokens}
      meta.usage = {
        input_tokens: res.usage.input_tokens || res.usage.prompt_tokens || 0,
        output_tokens: res.usage.output_tokens || res.usage.completion_tokens || 0,
        total_tokens: res.usage.total_tokens
          || (res.usage.input_tokens || 0) + (res.usage.output_tokens || 0)
          || (res.usage.prompt_tokens || 0) + (res.usage.completion_tokens || 0),
      };
    }

    // ── 响应内容 + 工具调用 ──
    if (res.choices?.[0]) {
      // OpenAI 格式
      const choice = res.choices[0];
      meta.finishReason = choice.finish_reason || "";
      if (choice.message?.tool_calls) {
        meta.toolCalls = choice.message.tool_calls.map(t => t.function?.name || "unknown");
      }
    } else if (res.content) {
      // Anthropic 格式
      meta.finishReason = res.stop_reason || "";
      meta.toolCalls = (res.content || [])
        .filter(b => b.type === "tool_use")
        .map(b => b.name || "unknown");
    }
  } catch { }

  meta.duration = elapsed;
  return meta;
}

// ═══════════════════════════════ SSE 流式响应提取

function extractMetaSSE(chunks, elapsed) {
  let usage = null;
  let finishReason = "";
  let text = "";
  let toolCalls = [];

  for (const chunk of chunks) {
    const line = chunk.trim();
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") continue;

    try {
      const obj = JSON.parse(data);

      // ── Anthropic SSE 格式 ──
      if (obj.type === "message_delta") {
        if (obj.usage) usage = obj.usage;
        if (obj.delta?.stop_reason) finishReason = obj.delta.stop_reason;
      }
      if (obj.type === "content_block_start" && obj.content_block?.type === "tool_use") {
        toolCalls.push(obj.content_block.name || "unknown");
      }
      if (obj.type === "content_block_delta" && obj.delta?.type === "text_delta") {
        text += obj.delta.text || "";
      }

      // ── OpenAI SSE 格式 ──
      if (obj.choices?.[0]) {
        const delta = obj.choices[0].delta || {};
        if (delta.content) text += delta.content;
        finishReason = obj.choices[0].finish_reason || finishReason;
        if (delta.tool_calls) {
          for (const t of delta.tool_calls) {
            if (t.function?.name) toolCalls.push(t.function.name);
          }
        }
      }
      if (obj.usage) usage = obj.usage;
      if (obj.x_groq?.usage) usage = obj.x_groq.usage;
    } catch { }
  }

  // 统一 usage 格式
  let usageOut = null;
  if (usage) {
    usageOut = {
      input_tokens: usage.input_tokens || usage.prompt_tokens || 0,
      output_tokens: usage.output_tokens || usage.completion_tokens || 0,
      total_tokens: usage.total_tokens
        || (usage.input_tokens || 0) + (usage.output_tokens || 0)
        || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
    };
  }

  return {
    model: "",
    prompt: "",
    usage: usageOut,
    finishReason,
    toolCalls: [...new Set(toolCalls)],
    textPreview: text.slice(0, 200),
    duration: elapsed,
  };
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join(" ");
  }
  return "";
}

// ═══════════════════════════════ 请求判断

function isApiRequest(url) {
  // Claude Code 的 API 请求路径（Anthropic 格式）
  return url?.startsWith("/v1/messages") || url?.startsWith("/v1/chat") || url?.startsWith("/anthropic");
}

// ═══════════════════════════════ 主服务器

const server = createServer(async (req, res) => {
  const startTime = Date.now();
  const requestId = randomUUID();

  // ── 控制面板 ──
  if ((req.method === "GET" && (req.url === "/" || req.url === "/panel"))) {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const html = readFileSync(join(import.meta.dirname, "panel.html"), "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(html);
  }

  // ── 管理端点 ──
  if (req.method === "GET" && req.url?.startsWith("/__dcr/")) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.url === "/__dcr/chain/status") {
      if (!activeChain) return res.end(JSON.stringify({ active: false }));
      const entries = readChain(activeChain);
      return res.end(JSON.stringify({
        active: true, chainId: activeChain.chainId,
        entryCount: entries.length,
        lastHash: entries[entries.length - 1]?.hash,
      }));
    }
    if (req.url === "/__dcr/chain/verify") {
      if (!activeChain) return res.end(JSON.stringify({ error: "no active chain" }));
      return res.end(JSON.stringify(verifyChain(activeChain)));
    }
    if (req.url === "/__dcr/chain/entries") {
      if (!activeChain) return res.end(JSON.stringify([]));
      return res.end(JSON.stringify(readChain(activeChain)));
    }
    if (req.url === "/__dcr/chains") {
      return res.end(JSON.stringify(listChains()));
    }
    // 代理实时状态（供 UI 轮询）
    if (req.url === "/__dcr/status") {
      const entries = activeChain ? readChain(activeChain) : [];
      const last = entries[entries.length - 1];
      return res.end(JSON.stringify({
        running: true,
        upstream: UPSTREAM_URL,
        chainId: activeChain?.chainId || null,
        totalEntries: entries.length,
        lastRequest: last ? {
          at: last.timestamp,
          model: last.model,
          path: last.path,
          duration: last.duration,
          tokens: last.usage?.total_tokens || last.usage?.totalTokens || 0,
          fileHash: last.fileHash?.slice(0, 16),
          fileCount: last.fileCount,
          gitStatus: last.gitStatus,
        } : null,
      }));
    }
    res.writeHead(404);
    return res.end("not found");
  }

  // ── 读请求体 ──
  const reqChunks = [];
  req.on("data", c => reqChunks.push(c));
  req.on("end", async () => {
    const reqBody = Buffer.concat(reqChunks).toString("utf-8");
    const targetUrl = UPSTREAM_URL + req.url;

    console.log(`🔄 [${requestId.slice(0, 8)}] ${req.method} ${req.url}`);

    try {
      // ── 转发 ──
      const upstreamResp = await forwardToUpstream(targetUrl, req.method, req.headers, reqBody);
      const elapsed = Date.now() - startTime;

      // ── 只记录 API 请求 ──
      if (isApiRequest(req.url)) {
        // 判断是否为流式响应
        const isStream = upstreamResp.headers["content-type"]?.includes("text/event-stream")
                      || (() => { try { return JSON.parse(reqBody).stream !== false; } catch { return true; } })();

        let meta;
        if (isStream) {
          const sseChunks = upstreamResp.body.split("\n").filter(l => l.startsWith("data: "));
          meta = extractMetaSSE(sseChunks, elapsed);
          // 从请求体补模型和 prompt
          try {
            const req = JSON.parse(reqBody);
            meta.model = req.model || "";
            if (!meta.prompt && req.messages) {
              const lastUser = [...req.messages].reverse().find(m => m.role === "user");
              if (lastUser?.content) meta.prompt = extractText(lastUser.content).slice(0, 500);
            }
          } catch { }
        } else {
          meta = extractMeta(reqBody, upstreamResp.body, elapsed);
        }
        const projectDir = process.env.DCR_PROJECT_DIR || process.cwd();
        const fileSnapshot = captureFileState(projectDir);

        const chain = getOrCreateChain({ cwd: projectDir });
        const entry = appendEntry(chain, {
          requestId,
          path: req.url, method: req.method,
          model: meta.model,
          promptPreview: meta.prompt.slice(0, 200),
          toolCalls: meta.toolCalls,
          usage: meta.usage,
          finishReason: meta.finishReason,
          duration: elapsed,
          status: upstreamResp.status,
          fileHash: fileSnapshot.fileHash,
          fileCount: fileSnapshot.fileCount,
          gitStatus: fileSnapshot.status,
        });

        console.log(`✅ [${requestId.slice(0, 8)}] ${elapsed}ms tokens=${meta.usage?.total_tokens || "?"} tools=${meta.toolCalls?.length || 0} files=${fileSnapshot.fileCount} hash=${entry.hash.slice(0, 12)}…`);
      } else {
        console.log(`   [${requestId.slice(0, 8)}] ${req.url} (non-API, skipped recording)`);
      }

      // ── 返回 ──
      res.writeHead(upstreamResp.status, upstreamResp.headers);
      res.end(upstreamResp.bodyBytes);
    } catch (err) {
      console.error(`❌ [${requestId.slice(0, 8)}] ${err.message}`);
      res.writeHead(502);
      res.end(JSON.stringify({ error: "proxy error", detail: err.message }));
    }
  });
});

server.listen(LISTEN_PORT, () => {
  console.log(`🔄 DCR Proxy 启动: http://localhost:${LISTEN_PORT}`);
  console.log(`   上游: ${UPSTREAM_URL}`);
  console.log(`   模式: 完全透明转发（Authorization 头部原样透传）`);
  console.log(`   管理: http://localhost:${LISTEN_PORT}/__dcr/chain/status`);
  console.log("");
  console.log("   Claude Code 配置:");
  console.log(`     ANTHROPIC_BASE_URL=http://localhost:${LISTEN_PORT}`);
  console.log("     ANTHROPIC_AUTH_TOKEN=你的真实 key（保持不变）");
});
