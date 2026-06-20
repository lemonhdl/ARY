/**
 * DCR 防伪攻防演示
 *
 * 用法: node test-attack.js
 */

import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createChain, appendEntry, verifyChain, readChain } from "./chain-store.js";
import { captureFileState } from "./file-hash.js";

// ═══════════════════════════ 准备测试项目

const TEST_DIR = join(import.meta.dirname, ".test-project");
const SRC_DIR = join(TEST_DIR, "src");

if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
mkdirSync(SRC_DIR, { recursive: true });

console.log("=".repeat(60));
console.log("  DCR 防伪攻防演示");
console.log("=".repeat(60));

// ═══════════════════════════ 模拟 3 轮正常骑行

console.log("\n--- 正常骑行: 3 轮对话，代码逐轮增长 ---\n");

const chain = createChain({ cwd: TEST_DIR, sessionId: "demo", model: "deepseek-chat" });

// 第 1 轮
writeFileSync(join(SRC_DIR, "login.js"), "function login(){return true;}");
const s1 = captureFileState(TEST_DIR);
const e1 = appendEntry(chain, {
  prompt: "写登录页", usage: { total_tokens: 2500 }, duration: 120_000,
  fileHash: s1.fileHash, fileCount: s1.fileCount, gitStatus: s1.status,
});
console.log("第1轮  login.js 创建    files: " + s1.fileCount + "  hash: " + s1.fileHash.slice(0, 16) + "…");

// 第 2 轮
writeFileSync(join(SRC_DIR, "register.js"), "function register(){return true;}");
const s2 = captureFileState(TEST_DIR);
const e2 = appendEntry(chain, {
  prompt: "加注册页", usage: { total_tokens: 3100 }, duration: 180_000,
  fileHash: s2.fileHash, fileCount: s2.fileCount, gitStatus: s2.status,
});
console.log("第2轮  register.js 创建  files: " + s2.fileCount + "  hash: " + s2.fileHash.slice(0, 16) + "…");

// 第 3 轮
writeFileSync(join(SRC_DIR, "style.css"), ".btn{color:blue;}");
const s3 = captureFileState(TEST_DIR);
const e3 = appendEntry(chain, {
  prompt: "加样式", usage: { total_tokens: 1800 }, duration: 90_000,
  fileHash: s3.fileHash, fileCount: s3.fileCount, gitStatus: s3.status,
});
console.log("第3轮  style.css 创建   files: " + s3.fileCount + "  hash: " + s3.fileHash.slice(0, 16) + "…");

// ═══════════════════════════ 验证正常链

console.log("\n" + "=".repeat(60));
console.log("  场景 1: 正常骑行 → 提交验证");
console.log("=".repeat(60));

const r1 = verifyChain(chain);
console.log("\n  链验证: " + (r1.valid ? "✅ 通过" : "❌ 断裂"));
console.log("  条目数: " + r1.summary.totalEntries);
console.log("  文件哈希演进:");
for (const e of r1.entries) {
  console.log("    #" + e.index + " " + e.prompt.slice(0, 30) + " → " + (e.fileHash || "?").slice(0, 16) + "… 链hash: " + e.hash.slice(0, 16) + "…");
}

// ═══════════════════════════ 作弊 1: 篡改链上数据

console.log("\n" + "=".repeat(60));
console.log("  场景 2: 作弊 —— 篡改已记录的 fileHash");
console.log("=".repeat(60));

const lines = readFileSync(chain.file, "utf-8").trim().split("\n");
lines[2] = lines[2].replace(
  /"fileHash":"[a-f0-9]+"/,
  '"fileHash":"0000000000000000000000000000000000000000000000000000000000000000"'
);
writeFileSync(chain.file, lines.join("\n") + "\n", "utf-8");

const r2 = verifyChain(chain);
console.log("\n  链验证: " + (r2.valid ? "✅ 通过" : "❌ 断裂"));
console.log("  断点: #" + (r2.breaks.join(", #") || "无"));
if (!r2.valid) {
  const broken = r2.entries[r2.breaks[0]];
  console.log("  原因: entry #" + r2.breaks[0] + " 存证 hash 与重新计算不匹配");
  console.log("        fileHash 被改为 0000...但 hash 签的是原始值");
}

// ═══════════════════════════ 作弊 2: 删除中间轮次

console.log("\n" + "=".repeat(60));
console.log("  场景 3: 作弊 —— 删除第 2 轮，第 3→第 1 硬接");
console.log("=".repeat(60));

const chainC = createChain({ cwd: TEST_DIR, sessionId: "cheat-skip" });
const c1 = appendEntry(chainC, {
  prompt: "写登录页", usage: { total_tokens: 2500 }, duration: 120_000,
  fileHash: s1.fileHash, fileCount: s1.fileCount,
});
// 直接跳到第3轮（假装第2轮不存在）
const c3 = appendEntry(chainC, {
  prompt: "加样式", usage: { total_tokens: 1800 }, duration: 90_000,
  fileHash: s3.fileHash, fileCount: s3.fileCount,
});

// 链结构验证
const r3 = verifyChain(chainC);
console.log("\n  链结构: " + (r3.valid ? "✅ prevHash 咬合" : "❌ 断裂"));

// 但文件快照从 s1 直接跳到 s3——这需要用外部规则检测
console.log("  文件快照演进:");
console.log("    #0 " + r3.entries[0].fileHash.slice(0, 16) + "…  (只有 login.js)");
console.log("    #1 " + r3.entries[1].fileHash.slice(0, 16) + "…  (突然出现 register.js + style.css)");
console.log("  ⚠️  文件从 1 个直接跳到 3 个——register.js 没有对应的对话记录!");
console.log("  → 组织者对比文件演进路径 + 对话记录可以识破");

// ═══════════════════════════ 作弊 3: 外部修改文件

console.log("\n" + "=".repeat(60));
console.log("  场景 4: 作弊 —— 外部工具修改文件后重新快照");
console.log("=".repeat(60));

// 模拟：正常骑行结束后，作弊者用另一个 Agent 偷偷修好了 bug
const chainD = createChain({ cwd: TEST_DIR, sessionId: "external-fix" });
const d1 = appendEntry(chainD, {
  prompt: "写登录页", usage: { total_tokens: 1000 }, duration: 60000,
  fileHash: s1.fileHash, fileCount: s1.fileCount,
});

// 作弊者在外面用别的工具改了文件
writeFileSync(join(SRC_DIR, "login.js"), "function login(){/* externally fixed all bugs */ return 'perfect';}");
writeFileSync(join(SRC_DIR, "utils.js"), "function util(){return 'secret helper';}");
const sHacked = captureFileState(TEST_DIR);

const d2 = appendEntry(chainD, {
  prompt: "微调样式", usage: { total_tokens: 500 }, duration: 30000,
  fileHash: sHacked.fileHash, fileCount: sHacked.fileCount,
});

const r4 = verifyChain(chainD);
console.log("\n  链结构: " + (r4.valid ? "✅ 完整" : "❌ 断裂"));
console.log("  但注意: 第 2 轮只消耗了 500 tokens、30 秒");
console.log("  #1 文件快照却突然多了 utils.js，且 login.js 文件内容天翻地覆");
console.log("  → 500 tokens 不可能完成这种改动——外部校验发现用能-产出比异常");

// ═══════════════════════════ 总结

console.log("\n" + "=".repeat(60));
console.log("  结论");
console.log("=".repeat(60));
console.log("");
console.log("  防线                    防什么             怎么破");
console.log("  ─────────────────────────────────────────────────");
console.log("  链式哈希 (SHA256 前后咬合)   篡改已记录数据      改一个 → 全链断");
console.log("  文件快照 (每轮 git 追踪)    替换项目代码         文件演进路径对不上");
console.log("  外部校验 (tokens vs 产出)   隐藏外援           500 token 写不出 3 个文件");
console.log("");
console.log("  三条防线叠加 = 完整的防伪体系");
