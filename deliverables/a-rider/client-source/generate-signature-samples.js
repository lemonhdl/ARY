/**
 * 生成 signature-samples.json（W9 交付产物）
 */

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  generateKeyPair, signMessage, verifyMessage, tamperMessage, canonicalize, DECISIONS,
} from "./signing.js";
import { buildMessages } from "./message-builder.js";

const OUT = join(import.meta.dirname, "samples");
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// ═══════════════════════════════════════════════
// 1. 生成密钥对
// ═══════════════════════════════════════════════

const { publicKey, privateKey } = generateKeyPair();

// ═══════════════════════════════════════════════
// 2. 造一条样例消息
// ═══════════════════════════════════════════════

const sampleMessages = buildMessages(
  [
    {
      type: "user",
      message: { role: "user", content: "帮我写一个登录页面，带用户名密码和验证码" },
      timestamp: "2026-06-19T10:00:00.000Z",
    },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "好的，我来创建登录页面，包括表单、验证和样式。" },
          { type: "tool_use", name: "Write", id: "t1", input: {} },
        ],
        usage: { input_tokens: 1500, output_tokens: 200 },
      },
      timestamp: "2026-06-19T10:01:00.000Z",
    },
  ],
  { sessionId: "__SAMPLE__session_abc", cwd: "C:\\Users\\rider\\projects\\demo" }
);

const unsignedMsg = sampleMessages[1] || sampleMessages[0];

// ═══════════════════════════════════════════════
// 3. 展示 canonical JSON
// ═══════════════════════════════════════════════

const payloadForCanon = { ...unsignedMsg };
delete payloadForCanon.signature;
const canonicalFull = canonicalize(payloadForCanon);

// ═══════════════════════════════════════════════
// 4. 签名
// ═══════════════════════════════════════════════

const signed = signMessage(unsignedMsg, privateKey);

// ═══════════════════════════════════════════════
// 5. 验签（成功）
// ═══════════════════════════════════════════════

const verifyOk = verifyMessage(signed, publicKey);

// ═══════════════════════════════════════════════
// 6. 篡改 → 验签失败
// ═══════════════════════════════════════════════

const tampered = tamperMessage(signed, "signal.type", "fraudulent");
const verifyTampered = verifyMessage(tampered, publicKey);

// ═══════════════════════════════════════════════
// 7. 密钥不匹配 → 验签失败
// ═══════════════════════════════════════════════

const { publicKey: otherPubKey } = generateKeyPair();
const verifyWrongKey = verifyMessage(signed, otherPubKey);

// ═══════════════════════════════════════════════
// 输出
// ═══════════════════════════════════════════════

const sample = {
  __GENERATION_NOTE__: {
    generatedAt: new Date().toISOString(),
    description: "Ed25519 消息签名样例。密钥对为本地生成，生产环境由 ARY 服务端下发。",
    decisions: DECISIONS,
  },

  // 样例密钥对（仅供本地演示）
  demoKeyPair: {
    __WARNING__: "以下密钥对仅为演示生成。生产环境中，私钥由 ARY 服务端在登录后下发，不落盘。",
    publicKeyPEM: publicKey.slice(0, 120) + "…",
    privateKeyPEM: privateKey.slice(0, 80) + "…（生产环境仅内存）",
  },

  // canonical JSON 说明
  canonicalization: {
    scheme: "RFC 8785 JCS (JSON Canonicalization Scheme)",
    rules: [
      "对象 key 按 UTF-8 字节序升序",
      "字符串原样保留 Unicode",
      "无多余空白字符",
      "数字按 ECMAScript 规范序列化",
      "签名前从消息中移除 signature 字段",
    ],
    example: {
      before: JSON.stringify(payloadForCanon, null, 2).slice(0, 200) + "…",
      after: canonicalFull.slice(0, 300) + "…",
      length: canonicalFull.length,
    },
  },

  // 正常签名
  signing: {
    unsignedMessage: unsignedMsg,
    signedMessage: signed,
    note: "签名过程：移除 signature 字段 → canonical JSON → Ed25519 签名 → 附加 signature",
  },

  // 验签结果
  verification: {
    success: verifyOk,
    description: "合法签名验签通过。公钥与签名时使用的私钥匹配，且消息未被篡改。",

    tampered: {
      tamperedField: "signal.type",
      originalValue: unsignedMsg.signal?.type,
      tamperedValue: "fraudulent",
      verificationResult: verifyTampered,
      description: "消息被篡改后验签失败。即使只改一个字段，签名也不再匹配。",
    },

    wrongKey: {
      verificationResult: verifyWrongKey,
      description: "使用不匹配的公钥验签失败。攻击者无法用自己生成的密钥对伪造合法 CA 的消息。",
    },
  },

  // 集成指南
  integrationNotes: {
    forARXServer: [
      "登录后调用 Ed25519 密钥生成，公钥留存，私钥下发给 DCR Desktop App",
      "接收 push 消息时，提取 signature.value，用对应公钥验签",
      "验签失败的消息拒收或进入隔离审计",
      "每条消息独立签名，不依赖 session 级状态",
    ],
    forDCRDesktop: [
      "私钥仅保存在内存中，不写入磁盘",
      "客户端重启后需重新登录获取新密钥",
      "签名前先移除 signature 字段再做 canonical JSON",
      "每条 push 消息都须签名",
    ],
  },
};

writeFileSync(join(OUT, "signature-samples.json"), JSON.stringify(sample, null, 2), "utf-8");
console.log("✅ samples/signature-samples.json");
console.log("   Ed25519 | canonical JSON | 签名成功 | 篡改检测 | 密钥不匹配检测");
