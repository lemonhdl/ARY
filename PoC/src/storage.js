import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const rootDir = new URL('..', import.meta.url).pathname;
export const aryStoreDir = join(rootDir, 'ary-public-store');
export const aryProtectedDir = join(rootDir, 'ary-protected-store');
export const organizerDir = join(rootDir, 'organizer-private');

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function listFiles(dir) {
  return (await readdir(dir)).sort();
}

export function jsonResponse(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
