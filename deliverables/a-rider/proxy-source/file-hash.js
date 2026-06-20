/**
 * DCR — 项目文件哈希（防代码被替换）
 *
 * 每轮对话后对 Git 工作区做快照，和对话哈希绑定。
 * 如果文件中途被外部工具替换，哈希链就断了。
 */

import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
// 提交存储目录：环境变量 > 中转站自身目录 ~/.dcr/submissions
const __dirname_fh = fileURLToPath(new URL(".", import.meta.url));
function getSubmissionsDir() {
  return process.env.DCR_SUBMISSIONS_DIR || join(__dirname_fh, "data", "submissions");
}

/**
 * 获取 Git 工作区状态和文件内容哈希
 * @param {string} projectDir - 项目根目录
 * @returns {{ status: string, fileHash: string, files: string[] }}
 */
export function captureFileState(projectDir) {
  const dir = resolve(projectDir || process.cwd());
  const files = getTrackedFiles(dir);
  const fileHash = hashFiles(dir, files);
  const status = getGitStatus(dir);

  return {
    status,           // git status 摘要
    fileHash,         // 所有追踪文件的组合哈希
    files,            // 文件列表
    fileCount: files.length,
  };
}

/**
 * 获取 Git 追踪的所有文件列表
 */
function getTrackedFiles(dir) {
  try {
    const out = execSync("git ls-files", { cwd: dir, encoding: "utf-8", timeout: 5000 });
    return out.trim().split("\n").filter(Boolean).sort();
  } catch {
    // 不是 git 仓库，退回到目录扫描
    return getDirectoryFiles(dir);
  }
}

/**
 * 非 git 仓库时扫描目录文件（返回相对路径）
 */
function getDirectoryFiles(dir) {
  const files = [];
  function walk(d, prefix) {
    try {
      const entries = readdirSync(d);
      for (const e of entries) {
        if (e.startsWith(".") || e === "node_modules" || e === ".git") continue;
        const full = join(d, e);
        const rel = prefix ? prefix + "/" + e : e;
        try {
          if (statSync(full).isDirectory()) { walk(full, rel); }
          else { files.push(rel); }
        } catch { }
      }
    } catch { }
  }
  walk(dir, "");
  return files.sort();
}

/**
 * 对所有文件计算组合哈希
 */
function hashFiles(dir, fileList) {
  const h = createHash("sha256");

  for (const file of fileList.slice(0, 1000)) { // 上限 1000 个文件
    const fullPath = join(dir, file);
    try {
      const content = readFileSync(fullPath);
      h.update(file);
      h.update(":");
      h.update(content);
      h.update("\n");
    } catch { }
  }

  return h.digest("hex");
}

/**
 * 获取 git status 摘要
 */
function getGitStatus(dir) {
  try {
    const out = execSync("git status --porcelain", { cwd: dir, encoding: "utf-8", timeout: 5000 });
    if (!out.trim()) return "clean";
    const lines = out.trim().split("\n").length;
    return `${lines} files changed`;
  } catch {
    return "non-git";
  }
}

/**
 * 对比两次快照，检测文件变化
 */
export function diffFileStates(before, after) {
  if (!before || !after) return { changed: false, reason: "missing snapshot" };

  if (before.fileHash === after.fileHash) {
    return { changed: false };
  }

  // 找出哪些文件变了
  const beforeSet = new Set(before.files || []);
  const afterSet = new Set(after.files || []);

  const added = [...afterSet].filter(f => !beforeSet.has(f));
  const removed = [...beforeSet].filter(f => !afterSet.has(f));

  return {
    changed: true,
    beforeHash: before.fileHash.slice(0, 16),
    afterHash: after.fileHash.slice(0, 16),
    added,
    removed,
  };
}

// ══════════════════════════════════════════════════════
// 项目提交 & 验证（作品提交）
// ══════════════════════════════════════════════════════

/**
 * 对项目目录做完整快照，生成提交清单。
 */
export function buildSubmissionSnapshot(projectDir) {
  const dir = resolve(projectDir || process.cwd());
  const files = getTrackedFiles(dir);
  const manifest = [];
  let totalSize = 0;

  for (const file of files.slice(0, 2000)) {
    const fullPath = join(dir, file);
    try {
      const content = readFileSync(fullPath);
      const fileHash = createHash("sha256").update(content).digest("hex");
      const size = content.length;
      totalSize += size;
      manifest.push({ path: file, sha256: fileHash, size });
    } catch {
      manifest.push({ path: file, sha256: null, size: 0, error: "unreadable" });
    }
  }

  const snapshotHash = createHash("sha256")
    .update(manifest.map(f => f.path + ":" + f.sha256).join("\n"))
    .digest("hex");

  return {
    snapshotHash,
    files: manifest,
    totalSize,
    fileCount: manifest.length,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * 验证项目提交是否与链条目中的文件快照一致。
 */
export function verifySubmissionAgainstChain(submission, chainEntries) {
  if (!chainEntries || chainEntries.length === 0) {
    return { valid: false, matches: [], verdict: "无链条目——项目未经 DCR 中转站记录" };
  }

  const chainHashes = new Set(
    chainEntries.filter(e => e.fileHash).map(e => e.fileHash)
  );

  const matches = [];
  for (const entry of chainEntries) {
    if (!entry.fileHash) continue;
    if (entry.fileHash === submission.snapshotHash) {
      matches.push({
        entryIndex: entry.index,
        timestamp: entry.timestamp,
        fileHash: entry.fileHash.slice(0, 16),
        fileCount: entry.fileCount,
        model: entry.model,
      });
    }
  }

  const exactMatch = chainHashes.has(submission.snapshotHash);

  return {
    valid: exactMatch,
    submissionHash: submission.snapshotHash.slice(0, 16),
    matches: matches.slice(0, 10),
    matchCount: matches.length,
    chainEntryCount: chainEntries.length,
    verdict: exactMatch
      ? "✅ 完整匹配——提交快照与中转站记录一致"
      : matches.length > 0
        ? "⚠️ 部分匹配——找到 " + matches.length + " 个历史匹配点，但最终提交不完全一致"
        : "❌ 不匹配——提交快照不在链条目中，文件可能被替换",
  };
}

// ══════════════════════════════════════════════════════
// 提交持久化存储
// ══════════════════════════════════════════════════════

/**
 * 将项目文件持久化存储到 ~/.dcr/submissions/<id>/
 * @param {string} projectDir - 项目目录
 * @param {string} chainId - 关联的链 ID
 * @returns {{ submissionId, storedDir, manifest, verification }}
 */
export function storeSubmission(projectDir, chainId) {
  const dir = resolve(projectDir || process.cwd());
  const snapshot = buildSubmissionSnapshot(dir);
  const submissionId = randomUUID();
  const base = getSubmissionsDir();
  const storedDir = join(base, submissionId);

  if (!existsSync(base)) mkdirSync(base, { recursive: true });
  mkdirSync(storedDir, { recursive: true });

  // 复制所有文件到存储目录
  let copied = 0;
  const copyErrors = [];
  for (const f of snapshot.files) {
    const src = join(dir, f.path);
    const dst = join(storedDir, f.path);
    try {
      const dstDir = join(storedDir, basename(f.path) === f.path ? "" : f.path.substring(0, f.path.lastIndexOf("/")));
      if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });
      copyFileSync(src, dst);
      copied++;
    } catch (e) {
      copyErrors.push({ path: f.path, error: e.message });
    }
  }

  // 写提交清单
  const manifest = {
    submissionId,
    chainId,
    submittedAt: new Date().toISOString(),
    sourceDir: dir,
    storedDir,
    snapshot,
    copied,
    totalFiles: snapshot.fileCount,
    errors: copyErrors,
  };
  writeFileSync(join(storedDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

  return manifest;
}

/**
 * 列出所有已存储的提交
 */
export function listSubmissions() {
  const base = getSubmissionsDir();
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter(f => {
      try { return statSync(join(base, f)).isDirectory(); } catch { return false; }
    })
    .map(id => {
      try {
        const m = JSON.parse(readFileSync(join(base, id, "manifest.json"), "utf-8"));
        return { submissionId: m.submissionId, chainId: m.chainId, submittedAt: m.submittedAt, sourceDir: m.sourceDir, fileCount: m.copied, totalFiles: m.totalFiles, snapshotHash: m.snapshot?.snapshotHash?.slice(0, 16), storedDir: m.storedDir };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/**
 * 获取单个提交详情
 */
export function getSubmission(submissionId) {
  const base = getSubmissionsDir();
  const manifestPath = join(base, submissionId, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(readFileSync(manifestPath, "utf-8"));
}
