/**
 * DCR — 骑行哈希链存储（防伪核心）
 *
 * 每条消息的 hash = SHA256(prevHash + canonicalJSON(entry))
 * 链不断 = 中间没跳过、没插入、没从别处复制。
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ═══════════════════════════════ 路径（中转站自身目录下的 data/）

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DATA_DIR = join(__dirname, "data");
const SESSIONS_DIR = join(DATA_DIR, "sessions");

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ═══════════════════════════════ 哈希

function sha256(str) {
  return createHash("sha256").update(str, "utf-8").digest("hex");
}

const ZERO_HASH = "0".repeat(64);

/** 对 entry 做 canonical JSON 序列化 */
function canonicalEntry(entry) {
  const { hash, prevHash, ...payload } = entry;
  // 按 key 排序，无空白
  return JSON.stringify(payload, Object.keys(payload).sort());
}

/** 计算本条 entry 的链式 hash */
function computeHash(prevHash, entry) {
  return sha256(prevHash + canonicalEntry(entry));
}

// ═══════════════════════════════ 链操作

/**
 * 创建一条新链（对应一个骑行 Session）
 */
export function createChain(sessionMeta = {}) {
  ensureDir(SESSIONS_DIR);
  const chainId = randomUUID();
  const file = join(SESSIONS_DIR, `${chainId}.jsonl`);

  const chain = {
    chainId,
    createdAt: new Date().toISOString(),
    session: {
      cwd: sessionMeta.cwd || process.cwd(),
      startedAt: sessionMeta.startedAt || Date.now(),
      sessionId: sessionMeta.sessionId || "",
      model: sessionMeta.model || "",
    },
    entryCount: 0,
    file,
  };

  writeFileSync(file, JSON.stringify({ type: "chain_init", ...chain }) + "\n", "utf-8");
  return chain;
}

/**
 * 向链中追加一条骑行记录
 */
export function appendEntry(chain, entryData) {
  const prevEntry = readLastEntry(chain);
  const prevHash = prevEntry ? prevEntry.hash : ZERO_HASH;

  const entry = {
    index: chain.entryCount,
    timestamp: new Date().toISOString(),
    prevHash,
    ...entryData,
    hash: "",  // 下面算
  };

  entry.hash = computeHash(prevHash, entry);

  appendFileSync(chain.file, JSON.stringify(entry) + "\n", "utf-8");
  chain.entryCount++;

  return { ...entry };
}

/**
 * 读取链的最后一条记录
 */
export function readLastEntry(chain) {
  if (!existsSync(chain.file)) return null;
  try {
    const lines = readFileSync(chain.file, "utf-8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const obj = JSON.parse(lines[i]);
      if (obj.type !== "chain_init") return obj;
    }
  } catch { }
  return null;
}

/**
 * 读取链的全部 entry（不含 init）
 */
export function readChain(chain) {
  if (!existsSync(chain.file)) return [];
  try {
    return readFileSync(chain.file, "utf-8")
      .trim().split("\n")
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(e => e && e.type !== "chain_init");
  } catch {
    return [];
  }
}

/**
 * 验证整条链的完整性
 * @returns {{ valid: boolean, breaks: number[], entries: object[] }}
 */
export function verifyChain(chain) {
  const entries = readChain(chain);
  if (entries.length === 0) return { valid: true, breaks: [], entries };

  const breaks = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const expectedPrev = i === 0 ? ZERO_HASH : entries[i - 1].hash;

    if (e.prevHash !== expectedPrev) {
      breaks.push(i);
    }

    // 重算本条 hash
    const recomputed = computeHash(e.prevHash, e);
    if (recomputed !== e.hash) {
      if (!breaks.includes(i)) breaks.push(i);
    }
  }

  return {
    valid: breaks.length === 0,
    breaks,
    entries,
    summary: {
      totalEntries: entries.length,
      firstAt: entries[0]?.timestamp,
      lastAt: entries[entries.length - 1]?.timestamp,
      totalTokens: entries.reduce((s, e) => s + (e.usage?.total_tokens || e.usage?.totalTokens || 0), 0),
    },
  };
}

/**
 * 列出所有已保存的链
 */
export function listChains() {
  ensureDir(SESSIONS_DIR);
  if (!existsSync(SESSIONS_DIR)) return [];
  try {
    const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith(".jsonl"));
    return files.map(f => {
      const path = join(SESSIONS_DIR, f);
      const first = readFileSync(path, "utf-8").split("\n")[0];
      try {
        const init = JSON.parse(first);
        if (init.type !== "chain_init") return null; // 跳过非 init 行
        const entries = readChain({ file: path });
        const last = entries[entries.length - 1];
        return {
          chainId: init.chainId,
          createdAt: init.createdAt,
          session: init.session,
          entryCount: entries.length,
          lastEntryAt: last?.timestamp,
          totalTokens: entries.reduce((s, e) => s + (e.usage?.total_tokens || e.usage?.totalTokens || 0), 0),
          file: path,
        };
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } catch { return []; }
}

export { ZERO_HASH };
