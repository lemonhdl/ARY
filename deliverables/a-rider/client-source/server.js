/**
 * DCR Desktop App — Server
 *
 * 读取本地 Claude Code 数据，提供 HTTP API 给前端展示。
 * 第一轮雏形：只做场景读取 + 客户端显示，签名/push 后续迭代。
 */

import { createServer } from "node:http";
import { readFile, readdir, stat, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createReadStream, readFileSync, existsSync } from "node:fs";
import { buildMessages, buildSessionSnapshot, buildFailureMessage } from "./message-builder.js";
import { listChains, readChain, verifyChain } from "./chain-store.js";

// ── 路径工具 ────────────────────────────────────────────────

const HOME = homedir();
const CLAUDE_DIR = join(HOME, ".claude");
const SESSIONS_DIR = join(CLAUDE_DIR, "sessions");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
const HISTORY_FILE = join(CLAUDE_DIR, "history.jsonl");

// ── 工具函数 ────────────────────────────────────────────────

/** 解码 Claude Code 的项目目录名 → 实际路径 */
function decodeProjectDir(dirName) {
  // C--Users-ROG-Desktop-se-ARY → C:\Users\ROG\Desktop\se\ARY
  return dirName.replace(/^([A-Z])--/, "$1:\\").replace(/-/g, "\\");
}

/** 对项目路径做安全编码，匹配 Claude Code 目录命名 */
function encodeProjectPath(projectPath) {
  // C:\Users\ROG\Desktop\se\ARY → C--Users-ROG-Desktop-se-ARY
  return projectPath.replace(/:/g, "-").replace(/\\/g, "-");
}

/** 读取 JSONL 文件所有行 */
async function readJSONL(filePath) {
  if (!existsSync(filePath)) return [];
  const lines = [];
  try {
    const content = await readFile(filePath, "utf-8");
    for (const line of content.trim().split("\n")) {
      if (line.trim()) {
        try { lines.push(JSON.parse(line)); } catch { /* skip malformed */ }
      }
    }
  } catch { /* file may be locked or missing */ }
  return lines;
}

/** 读取 JSONL 最后 N 行（高效，只读尾部） */
async function readJSONLTail(filePath, n = 50) {
  if (!existsSync(filePath)) return [];
  const all = await readJSONL(filePath);
  return all.slice(-n);
}

/** 安全 JSON 读取 */
async function readJSONSafe(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── 数据读取层 ────────────────────────────────────────────────

/** 获取所有活跃 session（从 sessions/ 目录） */
async function getActiveSessions() {
  if (!existsSync(SESSIONS_DIR)) return [];
  const files = await readdir(SESSIONS_DIR);
  const sessions = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const data = await readJSONSafe(join(SESSIONS_DIR, file));
    if (data) sessions.push(data);
  }
  return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** 获取所有已知项目 */
async function getProjects() {
  if (!existsSync(PROJECTS_DIR)) return [];
  const dirs = await readdir(PROJECTS_DIR);
  const projects = [];
  for (const dir of dirs) {
    const fullPath = join(PROJECTS_DIR, dir);
    const s = await stat(fullPath);
    if (!s.isDirectory()) continue;
    // 检查是否有 session JSONL 文件
    const files = await readdir(fullPath);
    const jsonlFiles = files.filter(f => f.endsWith(".jsonl"));
    const memoryDir = files.includes("memory");
    projects.push({
      dirName: dir,
      decodedPath: decodeProjectDir(dir),
      sessionCount: jsonlFiles.length,
      hasMemory: memoryDir,
      sessionFiles: jsonlFiles,
    });
  }
  return projects;
}

/** 获取某项目的所有 conversation 事件 */
async function getProjectEvents(projectDirName, limit = 100) {
  const projectDir = join(PROJECTS_DIR, projectDirName);
  if (!existsSync(projectDir)) return [];

  const files = await readdir(projectDir);
  const jsonlFiles = files.filter(f => f.endsWith(".jsonl"));

  const allEvents = [];
  for (const file of jsonlFiles) {
    const sessionId = file.replace(".jsonl", "");
    const lines = await readJSONLTail(join(projectDir, file), limit);
    for (const line of lines) {
      allEvents.push({ ...line, _sessionId: sessionId, _sourceFile: file });
    }
  }

  return allEvents
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .slice(-limit);
}

/** 获取最近的历史记录 */
async function getRecentHistory(limit = 30) {
  if (!existsSync(HISTORY_FILE)) return [];
  const lines = await readJSONLTail(HISTORY_FILE, limit);
  return lines.reverse(); // 最新的在前
}

/** 获取总览摘要 */
async function getOverview() {
  const sessions = await getActiveSessions();
  const projects = await getProjects();
  const history = await getRecentHistory(5);

  const debug = {
    sessionsFound: sessions.length,
    sessionsStatuses: sessions.map(s => s.status),
    sessionsDir: SESSIONS_DIR,
    exists: existsSync(SESSIONS_DIR),
  };

  const activeSession = sessions.find(s => s.status === "busy") || sessions[0];
  const totalSessions = sessions.length;
  const activeSessions = sessions.filter(s => s.status === "busy").length || (sessions.length > 0 ? 1 : 0);

  // 统计事件总数
  let totalEvents = 0;
  for (const proj of projects) {
    for (const sf of proj.sessionFiles) {
      try {
        const content = await readFile(join(PROJECTS_DIR, proj.dirName, sf), "utf-8");
        totalEvents += content.trim().split("\n").filter(Boolean).length;
      } catch { }
    }
  }

  // ── 从当前活跃 session 计算骑行汇总 ──────────────────
  let ridingStats = { totalTokens: 0, totalMessages: 0, totalToolCalls: 0, totalTime: 0, signalTypes: [] };

  if (activeSession) {
    try {
      const projDir = join(PROJECTS_DIR, encodeProjectPath(activeSession.cwd || ""));
      const sf = join(projDir, `${activeSession.sessionId}.jsonl`);
      const rawEvents = await readJSONL(sf);
      const messages = buildMessages(rawEvents, {
        sessionId: activeSession.sessionId,
        cwd: activeSession.cwd,
        startedAt: activeSession.startedAt,
      });
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        const first = messages[0];
        ridingStats.totalTokens = last.counters?.tokens || 0;
        ridingStats.totalMessages = messages.length;
        ridingStats.totalToolCalls = last.counters?.toolCallCount || 0;
        ridingStats.totalTime = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
        ridingStats.signalTypes = [...new Set(messages.map(m => m.signal?.type).filter(Boolean))];
      }
    } catch (e) { console.error("ridingStats error:", e.message); }
  }

  return {
    claudeDir: CLAUDE_DIR,
    totalSessions,
    activeSessions,
    totalProjects: projects.length,
    totalEvents,
    currentProject: activeSession?.cwd || null,
    currentSessionId: activeSession?.sessionId || null,
    recentPrompts: history,
    ridingStats,
    _debug: debug,
  };
}

// ── MIME 映射 ────────────────────────────────────────────────

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function extOf(p) {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.slice(i).toLowerCase() : "";
}

// ── HTTP 路由 ────────────────────────────────────────────────

async function handleAPI(pathname, req, res) {
  // CORS + 防缓存
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  try {
    // GET /api/overview
    if (pathname === "/api/overview" && req.method === "GET") {
      const data = await getOverview();
      return { status: 200, body: data };
    }

    // GET /api/sessions
    if (pathname === "/api/sessions" && req.method === "GET") {
      const sessions = await getActiveSessions();
      return { status: 200, body: sessions };
    }

    // GET /api/sessions/:pid
    const sessMatch = pathname.match(/^\/api\/sessions\/(\d+)$/);
    if (sessMatch && req.method === "GET") {
      const pid = sessMatch[1];
      const data = await readJSONSafe(join(SESSIONS_DIR, `${pid}.json`));
      if (!data) return { status: 404, body: { error: "session not found" } };
      return { status: 200, body: data };
    }

    // GET /api/sessions/:pid/events
    const eventsMatch = pathname.match(/^\/api\/sessions\/(\d+)\/events$/);
    if (eventsMatch && req.method === "GET") {
      const pid = eventsMatch[1];
      const sessionData = await readJSONSafe(join(SESSIONS_DIR, `${pid}.json`));
      if (!sessionData) return { status: 404, body: { error: "session not found" } };

      const projectDirName = encodeProjectPath(sessionData.cwd || "");
      const projectDir = join(PROJECTS_DIR, projectDirName);
      const sessionFile = join(projectDir, `${sessionData.sessionId}.jsonl`);
      const events = await readJSONLTail(sessionFile, 200);
      return { status: 200, body: { session: sessionData, events } };
    }

    // GET /api/ary/messages — ARY 标准消息流
    if (pathname === "/api/ary/messages" && req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const pid = url.searchParams.get("pid");
      const limit = parseInt(url.searchParams.get("limit") || "100");

      // 找目标 session
      const sessions = await getActiveSessions();
      const target = pid
        ? sessions.find(s => String(s.pid) === pid)
        : sessions.find(s => s.status === "busy") || sessions[0];

      if (!target) return { status: 404, body: { error: "no active session found" } };

      const projectDirName = encodeProjectPath(target.cwd || "");
      const projectDir = join(PROJECTS_DIR, projectDirName);
      const sessionFile = join(projectDir, `${target.sessionId}.jsonl`);
      const rawEvents = await readJSONL(sessionFile);

      // 用 message-builder 转换
      const messages = buildMessages(rawEvents.slice(-limit), {
        sessionId: target.sessionId,
        cwd: target.cwd,
        startedAt: target.startedAt,
      });

      return {
        status: 200,
        body: {
          session: { pid: target.pid, sessionId: target.sessionId, cwd: target.cwd, status: target.status },
          messageCount: messages.length,
          signalTypes: [...new Set(messages.map(m => m.signal.type))],
          messages: messages.slice(-50),  // 返回最近 50 条
        },
      };
    }

    // GET /api/ary/snapshot — Session 快照（W3 fetch 格式）
    if (pathname === "/api/ary/snapshot" && req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const pid = url.searchParams.get("pid");

      const sessions = await getActiveSessions();
      const target = pid
        ? sessions.find(s => String(s.pid) === pid)
        : sessions.find(s => s.status === "busy") || sessions[0];

      if (!target) return { status: 404, body: { error: "no active session found" } };

      const projectDirName = encodeProjectPath(target.cwd || "");
      const projectDir = join(PROJECTS_DIR, projectDirName);
      const sessionFile = join(projectDir, `${target.sessionId}.jsonl`);
      const rawEvents = await readJSONL(sessionFile);

      const snapshot = buildSessionSnapshot(rawEvents, {
        sessionId: target.sessionId,
        cwd: target.cwd,
        startedAt: target.startedAt,
      });

      return { status: 200, body: snapshot };
    }

    // GET /api/chain — 列出所有哈希链
    if (pathname === "/api/chain" && req.method === "GET") {
      const chains = listChains();
      return { status: 200, body: chains };
    }

    // GET /api/chain/:chainId — 单条链详情（含完整性校验）
    const chainMatch = pathname.match(/^\/api\/chain\/([^\/]+)$/);
    if (chainMatch && req.method === "GET") {
      const chainId = chainMatch[1];
      const chains = listChains();
      const chain = chains.find(c => c.chainId === chainId);
      if (!chain) return { status: 404, body: { error: "chain not found" } };
      const entries = readChain(chain);
      const verification = verifyChain(chain);
      return { status: 200, body: { chain, entries, verification } };
    }

    // GET /api/projects
    if (pathname === "/api/projects" && req.method === "GET") {
      const projects = await getProjects();
      return { status: 200, body: projects };
    }

    // GET /api/projects/:dirName/events
    const projMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/events$/);
    if (projMatch && req.method === "GET") {
      const dirName = decodeURIComponent(projMatch[1]);
      const url = new URL(req.url, "http://localhost");
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const events = await getProjectEvents(dirName, limit);
      return { status: 200, body: { dirName, events } };
    }

    // GET /api/history
    if (pathname === "/api/history" && req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const limit = parseInt(url.searchParams.get("limit") || "30");
      const history = await getRecentHistory(limit);
      return { status: 200, body: history };
    }

    // GET /api/projects/:dirName/memory
    const memMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/memory$/);
    if (memMatch && req.method === "GET") {
      const dirName = decodeURIComponent(memMatch[1]);
      const memDir = join(PROJECTS_DIR, dirName, "memory");
      if (!existsSync(memDir)) return { status: 200, body: [] };
      const files = await readdir(memDir);
      const memories = [];
      for (const f of files) {
        const content = await readFile(join(memDir, f), "utf-8");
        memories.push({ file: f, content });
      }
      return { status: 200, body: memories };
    }

    return { status: 404, body: { error: "not found" } };
  } catch (err) {
    return { status: 500, body: { error: err.message } };
  }
}

// ── 静态文件服务 ────────────────────────────────────────────────

const PUBLIC_DIR = join(import.meta.dirname, "public");

async function serveStatic(pathname, res) {
  let filePath = join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);

  // 防止目录遍历
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    await access(filePath);
    const contentType = MIME[extOf(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    const stream = createReadStream(filePath);
    stream.pipe(res);
    stream.on("error", () => {
      res.writeHead(500);
      res.end("Stream error");
    });
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

// ── 主入口 ────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT) || 3737;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API 路由
  if (pathname.startsWith("/api/")) {
    const { status, body } = await handleAPI(pathname, req, res);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body, null, 2));
    return;
  }

  // 静态文件
  await serveStatic(pathname, res);
});

server.listen(PORT, () => {
  console.log(`🐎 DCR Desktop App running at http://localhost:${PORT}`);
  console.log(`   Claude data: ${CLAUDE_DIR}`);
  console.log(`   Projects:    ${PROJECTS_DIR}`);
  console.log(`   Sessions:    ${SESSIONS_DIR}`);
});
