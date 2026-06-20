/**
 * DCR Local Proxy —— 透明中转站
 *
 * Agent 连到这里，DCR 原样转发到上游，过程中记录一切。
 * 所有记录统一转换为 OpenAI Chat Completions 格式存储。
 *
 * 用法:
 *   node proxy.js
 *   Claude Code: ANTHROPIC_BASE_URL=http://localhost:3738
 *   Codex:       OPENAI_BASE_URL=http://localhost:3738
 *
 * 上游默认指向 One API，可通过 DCR_UPSTREAM_URL 覆盖。
 */

import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { URL } from "node:url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createChain, appendEntry, verifyChain, listChains, readChain } from "./chain-store.js";
import { captureFileState } from "./file-hash.js";
import {
  detectAgentType,
  normalizeRequest,
  extractMetaFromOpenAI,
  anthropicSSEToOpenAIChunk,
  getSSEAggregatedResponse,
  extractMetaFromOpenedSSE,
  anthropicResponseToOpenAI,
} from "./format-adapter.js";

// ═══════════════════════════════ 配置

const LISTEN_PORT = parseInt(process.env.DCR_PROXY_PORT) || 3738;
const __dirname_px = fileURLToPath(new URL(".", import.meta.url));
const DCR_CONFIG_DIR = join(__dirname_px, "data");
const DCR_CONFIG_FILE = join(DCR_CONFIG_DIR, "config.json");

function loadConfig() {
  try {
    if (existsSync(DCR_CONFIG_FILE)) {
      return JSON.parse(readFileSync(DCR_CONFIG_FILE, "utf-8"));
    }
  } catch { }
  return {};
}

function saveConfig(cfg) {
  if (!existsSync(DCR_CONFIG_DIR)) mkdirSync(DCR_CONFIG_DIR, { recursive: true });
  writeFileSync(DCR_CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

// 上游：配置文件 > 环境变量 > 默认值
const savedConfig = loadConfig();
let UPSTREAM_URL = savedConfig.upstreamUrl || process.env.DCR_UPSTREAM_URL || "http://localhost:3000";

// ═══════════════════════════════ 链（多用户隔离）

/** 用户+项目 → 链 映射，按 Authorization 哈希 + 项目路径哈希隔离 */
const userChains = new Map();

function chainKey(reqHeaders, projectDir) {
  const auth = reqHeaders["authorization"] || reqHeaders["x-api-key"] || "";
  const uid = createHash("sha256").update(auth).digest("hex").slice(0, 12);
  const pd = createHash("sha256").update(resolve(projectDir || ".")).digest("hex").slice(0, 8);
  return `${uid}:${pd}`;
}

function getOrCreateChain(reqHeaders, sessionMeta = {}) {
  const projectDir = process.env.DCR_PROJECT_DIR || process.cwd();
  const key = chainKey(reqHeaders, projectDir);
  if (userChains.has(key)) return userChains.get(key);
  const uid = createHash("sha256").update(reqHeaders["authorization"] || "").digest("hex").slice(0, 12);
  const chain = createChain({ ...sessionMeta, userId: uid, projectDir: resolve(projectDir) });
  userChains.set(key, chain);

  // 初始化基线快照：记录项目起点（可能是空文件夹）
  const baselineSnapshot = captureFileState(projectDir);
  appendEntry(chain, {
    requestId: "baseline",
    path: "/__baseline__",
    method: "INIT",
    agentType: "baseline",
    model: "",
    promptPreview: "[项目初始基线]",
    toolCalls: [],
    toolNames: [],
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    finishReason: "",
    contentPreview: "",
    duration: 0,
    status: 200,
    fileHash: baselineSnapshot.fileHash,
    fileCount: baselineSnapshot.fileCount,
    gitStatus: baselineSnapshot.status,
  });

  console.log(`🔗 新骑行链: ${chain.chainId.slice(0, 8)}… 用户: ${uid} 基线文件: ${baselineSnapshot.fileCount}`);
  return chain;
}

// ═══════════════════════════════ 透明转发

function forwardToUpstream(targetUrl, method, headers, body) {
  return new Promise((resolve, reject) => {
    // 透传原始 Authorization，不做任何修改
    const fwdHeaders = { ...headers };
    delete fwdHeaders["host"];

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

      upstreamRes.on("end", () => {
        const bodyStr = Buffer.concat(chunks).toString("utf-8");
        const bodyBytes = Buffer.concat(chunks);
        const sseLines = bodyStr.split("\n");

        resolve({
          status: upstreamRes.statusCode,
          headers: upstreamRes.headers,
          body: bodyStr,
          bodyBytes,
          sseLines,
          isSSE: upstreamRes.headers["content-type"]?.includes("text/event-stream"),
        });
      });
    });

    upstreamReq.on("error", reject);
    upstreamReq.setTimeout(600_000, () => { upstreamReq.destroy(); reject(new Error("upstream timeout")); });

    if (body) upstreamReq.write(body);
    upstreamReq.end();
  });
}

// ═══════════════════════════════ 请求判断

function isApiRequest(url) {
  return url?.startsWith("/v1/") || url?.startsWith("/anthropic");
}

// ═══════════════════════════════ 从 SSE Lines 解析 Anthropic 事件并聚合为 OpenAI 格式

function parseSSEToOpenAI(sseLines, openaiRequest, elapsed) {
  for (const line of sseLines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) continue;
    const data = trimmed.slice(6).trim();
    if (data === "[DONE]") {
      // OpenAI SSE 结束标记
      continue;
    }
    try {
      const obj = JSON.parse(data);
      anthropicSSEToOpenAIChunk(obj);
    } catch { }
  }
  const aggregated = getSSEAggregatedResponse();
  return extractMetaFromOpenedSSE(aggregated, openaiRequest, elapsed);
}

// ═══════════════════════════════ 从 OpenAI SSE 直接解析

function parseOpenAISSE(sseLines, openaiRequest, elapsed) {
  let contentAccum = "";
  let finishReason = "";
  let usage = null;
  const toolCalls = new Map();

  for (const line of sseLines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) continue;
    const data = trimmed.slice(6).trim();
    if (data === "[DONE]") continue;
    try {
      const obj = JSON.parse(data);
      const delta = obj.choices?.[0]?.delta;
      if (delta?.content) contentAccum += delta.content;
      if (obj.choices?.[0]?.finish_reason) finishReason = obj.choices[0].finish_reason;
      if (obj.usage) usage = obj.usage;

      // 收集 tool_calls（增量）
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const key = tc.index ?? 0;
          if (!toolCalls.has(key)) toolCalls.set(key, { id: tc.id || "", name: "", arguments: "" });
          const acc = toolCalls.get(key);
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }
    } catch { }
  }

  const aggregated = {
    id: `chatcmpl-${randomUUID().slice(0, 12)}`,
    object: "chat.completion",
    model: openaiRequest.model || "",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: contentAccum || null,
        ...(toolCalls.size > 0 ? {
          tool_calls: [...toolCalls.values()].map(tc => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          })),
        } : {}),
      },
      finish_reason: finishReason || "stop",
    }],
    ...(usage ? { usage } : {}),
  };

  return extractMetaFromOpenAI(aggregated, openaiRequest, elapsed);
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
      const allChains = [...userChains.values()];
      const total = allChains.reduce((s, c) => s + readChain(c).length, 0);
      return res.end(JSON.stringify({
        active: true, userCount: userChains.size, totalEntries: total,
        users: [...userChains.entries()].map(([key, chain]) => ({
          key, chainId: chain.chainId, entryCount: readChain(chain).length,
        })),
      }));
    }
    if (req.url === "/__dcr/chain/verify") {
      const all = listChains();
      const results = all.map(c => ({ chainId: c.chainId, ...verifyChain(c) }));
      return res.end(JSON.stringify({ chains: all.length, results }));
    }
    if (req.url === "/__dcr/chain/entries") {
      const allChains = [...userChains.values()];
      const allEntries = allChains.flatMap(c => readChain(c));
      allEntries.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
      return res.end(JSON.stringify(allEntries.slice(-50)));
    }
    if (req.url === "/__dcr/chains") {
      return res.end(JSON.stringify(listChains()));
    }
    // PUT /__dcr/config — 修改上游地址
    if (req.url === "/__dcr/config" && req.method === "PUT") {
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", () => {
        try {
          const { upstreamUrl } = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          if (!upstreamUrl || typeof upstreamUrl !== "string") throw new Error("invalid upstreamUrl");
          UPSTREAM_URL = upstreamUrl;
          const cfg = loadConfig();
          cfg.upstreamUrl = upstreamUrl;
          saveConfig(cfg);
          res.end(JSON.stringify({ ok: true, upstreamUrl }));
          console.log(`🔧 上游已切换: ${upstreamUrl}`);
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // GET /__dcr/config — 查看当前配置
    if (req.url === "/__dcr/config" && req.method === "GET") {
      return res.end(JSON.stringify({ upstreamUrl: UPSTREAM_URL }));
    }

    if (req.url === "/__dcr/status") {
      const allChains = [...userChains.values()];
      const allEntries = allChains.flatMap(c => readChain(c));
      allEntries.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
      const last = allEntries[allEntries.length - 1];
      return res.end(JSON.stringify({
        running: true,
        upstream: UPSTREAM_URL,
        userCount: userChains.size, chainCount: listChains().length,
        totalEntries: allEntries.length,
        lastRequest: last ? {
          at: last.timestamp,
          model: last.model,
          path: last.path,
          agentType: last.agentType,
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

    // ══════════════════════════════════════════
    // ① 格式检测（只看，不改）
    // ══════════════════════════════════════════

    const isAPI = isApiRequest(req.url);
    let agentType = "unknown";
    let openaiRequest = null;

    if (isAPI && reqBody) {
      const normalized = normalizeRequest(req.url, reqBody);
      agentType = normalized.agentType;
      openaiRequest = normalized.openaiRequest;
      openaiRequest._agentType = agentType;
    }

    console.log(`🔄 [${requestId.slice(0, 8)}] ${req.method} ${req.url} [${agentType}]`);

    // ══════════════════════════════════════════
    // ② 原样转发到上游（不做任何修改）
    // ══════════════════════════════════════════

    const targetUrl = UPSTREAM_URL + req.url;

    try {
      const upstreamResp = await forwardToUpstream(targetUrl, req.method, req.headers, reqBody);
      const elapsed = Date.now() - startTime;

      // ══════════════════════════════════════════
      // ③ 转为统一格式、记录
      // ══════════════════════════════════════════

      if (isAPI && openaiRequest) {
        let meta;

        if (upstreamResp.isSSE) {
          // 流式响应：按 Agent 类型分别解析
          if (agentType === "anthropic") {
            meta = parseSSEToOpenAI(upstreamResp.sseLines, openaiRequest, elapsed);
          } else {
            // OpenAI 格式的 SSE，直接解析
            meta = parseOpenAISSE(upstreamResp.sseLines, openaiRequest, elapsed);
          }
        } else {
          // 非流式响应
          try {
            const resJson = JSON.parse(upstreamResp.body);
            let openaiResponse;

            if (agentType === "anthropic" && resJson.type === "message") {
              // Anthropic 响应 → OpenAI 格式
              openaiResponse = anthropicResponseToOpenAI(resJson, openaiRequest.model);
            } else if (resJson.object === "chat.completion" || resJson.choices) {
              // 已经是 OpenAI 格式
              openaiResponse = resJson;
            } else {
              // 未知格式，尝试兜底
              openaiResponse = resJson;
            }

            meta = extractMetaFromOpenAI(openaiResponse, openaiRequest, elapsed);
          } catch {
            meta = extractMetaFromOpenAI({}, openaiRequest, elapsed);
          }
        }

        // ══════════════════════════════════════════
        // ④ 文件快照 + 链记录
        // ══════════════════════════════════════════

        const projectDir = process.env.DCR_PROJECT_DIR || process.cwd();
        const fileSnapshot = captureFileState(projectDir);

        const chain = getOrCreateChain(req.headers, { cwd: projectDir, model: meta.model });
        const entry = appendEntry(chain, {
          requestId,
          path: req.url,
          method: req.method,
          agentType,
          model: meta.model,
          promptPreview: meta.prompt?.slice(0, 200) || "",
          toolCalls: meta.toolCalls || [],
          toolNames: meta.toolNames || [],
          usage: meta.usage,
          finishReason: meta.finishReason,
          contentPreview: meta.contentPreview?.slice(0, 200) || "",
          duration: elapsed,
          status: upstreamResp.status,
          fileHash: fileSnapshot.fileHash,
          fileCount: fileSnapshot.fileCount,
          gitStatus: fileSnapshot.status,
        });

        console.log(`✅ [${requestId.slice(0, 8)}] ${elapsed}ms ${agentType} tokens=${meta.usage?.total_tokens || "?"} tools=${meta.toolCalls?.length || 0} files=${fileSnapshot.fileCount} hash=${entry.hash.slice(0, 12)}…`);
      } else if (req.url !== "/" && req.url !== "/panel") {
        console.log(`   [${requestId.slice(0, 8)}] ${req.url} (non-API, skipped recording)`);
      }

      // ══════════════════════════════════════════
      // ⑤ 返回原始响应（不做修改）
      // ══════════════════════════════════════════

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
  console.log(`   模式: 透明转发 + 统一 OpenAI 格式记录`);
  console.log(`   管理: http://localhost:${LISTEN_PORT}/__dcr/chain/status`);
  console.log("");
  console.log("   支持的 Agent:");
  console.log(`   ├─ Claude Code:  ANTHROPIC_BASE_URL=http://localhost:${LISTEN_PORT}`);
  console.log(`   ├─ Codex:        OPENAI_BASE_URL=http://localhost:${LISTEN_PORT}`);
  console.log(`   └─ 其他:        相应 BASE_URL → http://localhost:${LISTEN_PORT}`);
  console.log("");
  console.log("   原始请求/响应原样透传，不做任何修改。");
  console.log("   记录数据统一为 OpenAI Chat Completions 格式。");
});
