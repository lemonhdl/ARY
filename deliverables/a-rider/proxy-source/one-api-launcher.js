/**
 * One API 启动器 — DCR 中转站的格式转换引擎
 *
 * 自动启动本地 One API 实例，管理其生命周期。
 * DCR 退出时自动关闭 One API。
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ONE_API_BIN = join(__dirname, "vendor", "one-api.exe");

/**
 * 启动 One API，返回子进程引用。
 * @param {object} opts
 * @param {number} opts.port - One API 监听端口，默认 3000
 * @param {string} opts.dataDir - 数据目录，默认 ./vendor/one-api-data
 * @returns {{ process: ChildProcess, url: string, port: number }}
 */
export function launchOneAPI(opts = {}) {
  const port = opts.port || parseInt(process.env.ONE_API_PORT) || 3000;
  const dataDir = opts.dataDir || join(__dirname, "vendor", "one-api-data");
  const logDir = opts.logDir || join(dataDir, "logs");

  // 确保数据目录存在
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  try {
    const child = spawn(ONE_API_BIN, [
      "--port", String(port),
      "--log-dir", logDir,
    ], {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        SQL_DSN: process.env.ONE_API_SQL_DSN || "",
        SESSION_SECRET: process.env.ONE_API_SESSION_SECRET || "dcr-one-api",
        TZ: process.env.TZ || "Asia/Shanghai",
      },
    });

    child.stdout.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) console.log(`[one-api] ${msg}`);
    });

    child.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes("http")) console.error(`[one-api:err] ${msg}`);
    });

    child.on("error", (err) => {
      console.error(`❌ One API 启动失败: ${err.message}`);
    });

    child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`❌ One API 异常退出 (code ${code})`);
      }
    });

    // 确保 DCR 退出时关闭 One API
    const cleanup = () => {
      try { child.kill("SIGTERM"); } catch { }
    };
    process.on("exit", cleanup);
    process.on("SIGINT", () => { cleanup(); process.exit(); });
    process.on("SIGTERM", () => { cleanup(); process.exit(); });

    return {
      process: child,
      url: `http://localhost:${port}`,
      port,
    };
  } catch (e) {
    console.error(`❌ 无法启动 One API: ${e.message}`);
    return null;
  }
}

/**
 * 等待 One API 就绪（轮询 /api/status）
 */
export async function waitForOneAPI(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        console.log(`🟢 One API 就绪: ${url}`);
        return true;
      }
    } catch { }
    await new Promise(r => setTimeout(r, 500));
  }
  console.error(`🟡 One API 启动超时 (${timeoutMs}ms)，继续使用内置格式检测`);
  return false;
}
