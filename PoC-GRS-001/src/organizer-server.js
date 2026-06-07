import { createServer } from 'node:http';
import { join } from 'node:path';
import { jsonResponse, organizerDir, readBody, readJson } from './storage.js';

const raceSourcePath = join(organizerDir, 'race_source.json');
const evaluatorServicePath = join(organizerDir, 'evaluator_service.json');

async function sourceReady() {
  const service = await readJson(evaluatorServicePath);
  const sources = await readJson(raceSourcePath);
  const source = sources[0];
  return Boolean(service.enabled && source?.sourceStatus === 'available' && source?.lifecycleStatus === 'open');
}

async function resultFor(body) {
  const ready = await sourceReady();
  if (!ready) {
    return {
      status: 'missing',
      teamId: body.teamId,
      resultText: '数据缺失，暂无法评分。',
      score: null,
      resultSummary: '等待 Organizer 数据恢复后再评分。'
    };
  }
  const answer = String(body.answer || '').trim();
  const ridingRecord = String(body.ridingRecord || '').trim();
  const hasCoreProof = answer.includes('Organizer') && answer.includes('公开披露');
  const hasRidingEvidence = ridingRecord.includes('计划') && ridingRecord.includes('验收') && ridingRecord.includes('复盘');
  if (hasCoreProof && hasRidingEvidence) {
    return {
      status: 'available',
      teamId: body.teamId,
      resultText: '评测完成。',
      score: body.teamId === 'team_001' ? 96 : 88,
      resultSummary: '源数据留侧，公开披露、状态实验和回放记录成立。'
    };
  }
  return {
    status: 'available',
    teamId: body.teamId,
    resultText: '评测完成。',
    score: 58,
    resultSummary: '尚未完整证明 GRS001 主命题。'
  };
}

export function createOrganizerServer(port = 4401) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        return jsonResponse(res, 200, { status: await sourceReady() ? 'ready' : 'missing', source: 'organizer' });
      }
      if (req.method === 'POST' && url.pathname === '/evaluate') {
        const body = await readBody(req);
        return jsonResponse(res, 200, await resultFor(body));
      }
      return jsonResponse(res, 404, { error: '未找到' });
    } catch (error) {
      return jsonResponse(res, 500, { error: error.message });
    }
  });
  server.listen(port);
  return server;
}
