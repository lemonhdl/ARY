/**
 * DCR Desktop App — 消息签名模块（W9 防伪防篡改）
 *
 * 算法：Ed25519（Node.js 原生 crypto）
 * 签名范围：整个消息体 canonical JSON
 * 密钥：ARY 服务端生成，私钥下发至 DCR Desktop App
 *
 * 当前阶段：本地自生成密钥对做样例，生产环境密钥从 ARY 服务端获取。
 */

import { generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey } from "node:crypto";

// ══════════════════════════════════════════════════════
// 决策记录（对齐 ary-rider-client-spec.md §3.1）
// ══════════════════════════════════════════════════════

const DECISIONS = {
  algorithm: "Ed25519",
  keyGeneration: "ARY 服务端生成，用户每次登录生成当次密钥",
  keyDelivery: "登录后由服务端下发私钥至 DCR Desktop App",
  keyStorage: "仅内存（本次会话），客户端重启需重新登录获取新密钥",
  signingScope: "整个消息体（签名覆盖 JSON 全文）",
  signer: "DCR Desktop App",
  verifier: "ARY 服务端",
  canonicalization: "RFC 8785 JSON Canonicalization Scheme (JCS)",
  signaturePlacement: "消息内嵌 signature 字段（canonical JSON 不含 signature，签名后再附加）",
};

// ══════════════════════════════════════════════════════
// Canonical JSON（JCS 简化版）
// ══════════════════════════════════════════════════════

/**
 * 将 JSON 对象序列化为 canonical form。
 *
 * 规则（RFC 8785 子集）：
 * 1. 对象 key 按 UTF-8 字节序升序排列
 * 2. 字符串原样保留（不转义 Unicode）
 * 3. 数字按 ECMAScript 规范序列化
 * 4. 无多余空白字符
 * 5. null 值保留
 */
function canonicalize(obj) {
  if (obj === null) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") {
    if (Number.isFinite(obj)) return String(obj);
    return "null"; // Infinity, NaN → null per JCS
  }
  if (typeof obj === "string") return JSON.stringify(obj); // 保留 Unicode
  if (Array.isArray(obj)) {
    const items = obj.map(item => canonicalize(item));
    return "[" + items.join(",") + "]";
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj).sort((a, b) => {
      // 按 UTF-8 字节序排序
      const bufA = Buffer.from(a, "utf-8");
      const bufB = Buffer.from(b, "utf-8");
      for (let i = 0; i < Math.min(bufA.length, bufB.length); i++) {
        if (bufA[i] !== bufB[i]) return bufA[i] - bufB[i];
      }
      return bufA.length - bufB.length;
    });
    const pairs = keys.map(k => canonicalize(k) + ":" + canonicalize(obj[k]));
    return "{" + pairs.join(",") + "}";
  }
  return "null";
}

// ══════════════════════════════════════════════════════
// 密钥管理
// ══════════════════════════════════════════════════════

/**
 * 生成 Ed25519 密钥对。
 * 模拟 ARY 服务端的密钥生成逻辑。
 */
export function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

/**
 * 生成 Ed25519 密钥对（DER 格式，便于存储和传输）。
 */
export function generateKeyPairDER() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  return {
    publicKey: publicKey.toString("base64"),
    privateKey: privateKey.toString("base64"),
    publicKeyHex: Buffer.from(publicKey).toString("hex"),
  };
}

/**
 * 从 PEM 加载私钥。
 */
function loadPrivateKey(pem) {
  return createPrivateKey({ key: pem, format: "pem", type: "pkcs8" });
}

/**
 * 从 PEM 加载公钥。
 */
function loadPublicKey(pem) {
  return createPublicKey({ key: pem, format: "pem", type: "spki" });
}

// ══════════════════════════════════════════════════════
// 签名 & 验签
// ══════════════════════════════════════════════════════

/**
 * 对 RidingSignalMessage 签名。
 *
 * 流程：
 * 1. 从消息中移除 signature 字段（如果有）
 * 2. 对剩余字段做 canonical JSON 序列化
 * 3. 对 canonical bytes 做 Ed25519 签名
 * 4. 将签名附加回消息
 *
 * @param {object} message - 待签名的 RidingSignalMessage
 * @param {string} privateKeyPEM - Ed25519 私钥 PEM
 * @returns {object} 带有 signature 字段的消息
 */
export function signMessage(message, privateKeyPEM) {
  const key = loadPrivateKey(privateKeyPEM);

  // 1. 浅拷贝，移除已有 signature
  const payload = { ...message };
  delete payload.signature;

  // 2. canonical JSON
  const canonical = canonicalize(payload);
  const canonicalBytes = Buffer.from(canonical, "utf-8");

  // 3. 签名
  const sig = sign(null, canonicalBytes, key);
  const signatureBase64 = sig.toString("base64");

  // 4. 附加签名信息
  return {
    ...payload,
    signature: {
      algorithm: DECISIONS.algorithm,
      value: signatureBase64,
      canonicalJson: canonical.slice(0, 200) + (canonical.length > 200 ? "…" : ""), // 样例中截断展示
      canonicalLength: canonical.length,
      signedAt: new Date().toISOString(),
      __NOTE__: "签名覆盖 canonical JSON 全文。验签时需重新生成 canonical JSON 并与本签名比对。",
    },
  };
}

/**
 * 验签一条消息。
 *
 * @param {object} signedMessage - 带 signature 字段的消息
 * @param {string} publicKeyPEM - Ed25519 公钥 PEM
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verifyMessage(signedMessage, publicKeyPEM) {
  try {
    const key = loadPublicKey(publicKeyPEM);
    const sig = signedMessage.signature;
    if (!sig) return { valid: false, reason: "missing signature field" };
    if (sig.algorithm !== DECISIONS.algorithm) {
      return { valid: false, reason: `unknown algorithm: ${sig.algorithm}` };
    }

    // 重建 canonical JSON（移除 signature）
    const payload = { ...signedMessage };
    delete payload.signature;
    const canonical = canonicalize(payload);
    const canonicalBytes = Buffer.from(canonical, "utf-8");

    // 解码签名
    const signatureBytes = Buffer.from(sig.value, "base64");

    // 验签
    const ok = verify(null, canonicalBytes, key, signatureBytes);
    return ok
      ? { valid: true }
      : { valid: false, reason: "signature verification failed — message may be tampered or key mismatch" };
  } catch (e) {
    return { valid: false, reason: `verification error: ${e.message}` };
  }
}

// ══════════════════════════════════════════════════════
// 防篡改演示工具
// ══════════════════════════════════════════════════════

/**
 * 对一条已签名消息进行篡改，用于演示验签失败。
 */
export function tamperMessage(signedMessage, fieldPath, newValue) {
  const tampered = JSON.parse(JSON.stringify(signedMessage)); // 深拷贝
  const keys = fieldPath.split(".");
  let target = tampered;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!target[keys[i]]) target[keys[i]] = {};
    target = target[keys[i]];
  }
  target[keys[keys.length - 1]] = newValue;
  return tampered;
}

export { DECISIONS, canonicalize };
