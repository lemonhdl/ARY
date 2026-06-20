/**
 * DCR — 项目文件哈希（防代码被替换）
 *
 * 每轮对话后对 Git 工作区做快照，和对话哈希绑定。
 * 如果文件中途被外部工具替换，哈希链就断了。
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

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
