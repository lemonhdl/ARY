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
import { launchOneAPI, waitForOneAPI } from "./one-api-launcher.js";

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

// 上游（LLM 端点）：配置文件 > 环境变量 > 默认 DeepSeek Anthropic
const savedConfig = loadConfig();
let UPSTREAM_URL = savedConfig.upstreamUrl || process.env.DCR_UPSTREAM_URL || "https://api.deepseek.com/anthropic";

// One API 转换服务地址（本地自动启动）
let ONE_API_URL = null;
let oneApiAvailable = false;

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
  const meta = extractMetaFromOpenedSSE(aggregated, openaiRequest, elapsed);
  meta._openaiResponse = JSON.stringify(aggregated).slice(0, 16000);
  return meta;
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
    // ② 原样转发——Agent 请求/响应不做任何修改
    // ══════════════════════════════════════════

    const targetUrl = UPSTREAM_URL + req.url;

    try {
      const upstreamResp = await forwardToUpstream(targetUrl, req.method, req.headers, reqBody);
      const elapsed = Date.now() - startTime;

      // ══════════════════════════════════════════
      // ③ 调用 One API 转换 + 记录
      // ══════════════════════════════════════════

      if (isAPI && openaiRequest) {
        let meta;
        const canConvert = agentType === "anthropic" || agentType === "openai";

        // ── 通过 One API 的 /v1/convert 做格式转换 ──
        let convertedByOneAPI = false;
        if (oneApiAvailable && canConvert) {
          try {
            const convertRes = await fetch(`${ONE_API_URL}/v1/convert`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Original-Format": agentType },
              body: reqBody,
              signal: AbortSignal.timeout(5000),
            });
            if (convertRes.ok) {
              const converted = await convertRes.json();
              if (converted.request) {
                openaiRequest = converted.request;
                convertedByOneAPI = true;
              }
            }
          } catch { /* One API 不可用时降级到本地转换 */ }
        }

        if (!canConvert) {
          // ═══ 保底：格式不支持，直接保存原始信息 ═══
          console.log(`   ⚠️ 未知格式 [${agentType}]，One API 不可用且本地不支持，保存原始数据`);
          meta = {
            model: openaiRequest.model || "",
            prompt: "",
            usage: null,
            finishReason: "",
            toolCalls: [],
            contentPreview: "",
            duration: elapsed,
            agentType,
            _raw: true,
            _rawReason: `格式 [${agentType}] 不在本地支持列表 (anthropic/openai) 中，One API ${oneApiAvailable ? "可用但转换失败" : "不可用"}，原始数据已保存`,
            _rawRequest: reqBody.slice(0, 4000),
            _rawResponse: upstreamResp.body.slice(0, 4000),
          };
          try {
            const req = JSON.parse(reqBody);
            const msgs = req.messages || [];
            const lastUser = [...msgs].reverse().find(m => m.role === "user");
            if (lastUser?.content) {
              meta.prompt = typeof lastUser.content === "string"
                ? lastUser.content.slice(0, 500)
                : JSON.stringify(lastUser.content).slice(0, 500);
            }
          } catch { }
        } else if (upstreamResp.isSSE) {
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
              // 未知格式，保留原始
              openaiResponse = resJson;
            }

            meta = extractMetaFromOpenAI(openaiResponse, openaiRequest, elapsed);
            meta._openaiResponse = JSON.stringify(openaiResponse).slice(0, 16000);
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
          agentType,
          model: meta.model,
          rider: meta.prompt || "",                       // 骑手原话
          agent: meta.contentPreview || "",               // Agent 回复文本
          toolCalls: meta.toolCalls || [],                // 工具名（体现哈希里）
          usage: meta.usage,
          duration: elapsed,
          status: upstreamResp.status,
          fileHash: fileSnapshot.fileHash,
          fileCount: fileSnapshot.fileCount,
          gitStatus: fileSnapshot.status,
          _raw: meta._raw || false,
          ...(meta._raw ? { _rawReason: meta._rawReason, _rawRequest: meta._rawRequest, _rawResponse: meta._rawResponse } : {}),
        });

        const convertTag = convertedByOneAPI ? "[OneAPI]" : "[local]";
        console.log(`✅ [${requestId.slice(0, 8)}] ${elapsed}ms ${agentType} ${convertTag} tokens=${meta.usage?.total_tokens || "?"} tools=${meta.toolCalls?.length || 0} files=${fileSnapshot.fileCount} hash=${entry.hash.slice(0, 12)}…`);
      } else if (req.url !== "/" && req.url !== "/panel") {
        console.log(`   [${requestId.slice(0, 8)}] ${req.url} (non-API, skipped recording)`);
      }

      // ══════════════════════════════════════════
      // ⑤ 原样返回——Agent 零感知
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

server.listen(LISTEN_PORT, async () => {
  // ── 1. 自动启动 One API ──
  const oneApiPort = parseInt(process.env.ONE_API_PORT) || 3000;
  const oneApiUrl = `http://localhost:${oneApiPort}`;
  let oneApiOnline = false;

  const oneApi = launchOneAPI({ port: oneApiPort });
  if (oneApi) {
    oneApiOnline = await waitForOneAPI(oneApiUrl);
  }

  // ── 2. 如果 One API 就绪，用它作为上游（格式能力继承） ──
  if (oneApiOnline) {
    ONE_API_URL = oneApiUrl;
    oneApiAvailable = true;
  }

  console.log(`🔄 DCR Proxy 启动: http://localhost:${LISTEN_PORT}`);
  console.log(`   上游 LLM:  ${UPSTREAM_URL}`);
  console.log(`   模式: 透明转发 + 统一 OpenAI 格式记录`);

  if (oneApiOnline) {
    console.log(`   🟢 One API 在线 (${oneApiUrl}) — 格式转换: One API /v1/convert`);
  } else {
    console.log(`   🟡 One API 未就绪 — 格式转换: 内置 format-adapter`);
  }

  console.log(`   管理: http://localhost:${LISTEN_PORT}/__dcr/chain/status`);
  console.log("");
  console.log(`   Claude Code: ANTHROPIC_BASE_URL=http://localhost:${LISTEN_PORT}`);
  console.log(`   Codex:       OPENAI_BASE_URL=http://localhost:${LISTEN_PORT}`);
  if (oneApiOnline) {
    console.log(`   One API 管理: ${oneApiUrl}  (root / 123456)`);
  }
});
