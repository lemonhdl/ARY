import { createServer } from 'node:http';
import { jsonResponse, readBody } from './storage.js';

function resultFor(body) {
  const answer = String(body.answer || '').trim();
  const ridingRecord = String(body.ridingRecord || '').trim();
  const hasCoreProof = answer.includes('Organizer') && answer.includes('ARY');
  const hasRidingEvidence = ridingRecord.includes('Riding Plan') && ridingRecord.includes('Validation');
  if (hasCoreProof && hasRidingEvidence) {
    return {
      status: 'available',
      teamId: body.teamId,
      resultText: '评测完成。',
      score: body.teamId === 'team_001' ? 92 : 86,
      resultSummary: '方案说明了 Organizer 数据留侧、ARY 公开披露和整理后的 Riding Record。'
    };
  }
  return {
    status: 'available',
    teamId: body.teamId,
    resultText: '评测完成。',
    score: 58,
    resultSummary: '提交内容还不能完整证明 GRS001 的主命题。'
  };
}

export function createOrganizerServer(port = 4401) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        return jsonResponse(res, 200, { status: 'ready', source: 'organizer' });
      }
      if (req.method === 'POST' && url.pathname === '/evaluate') {
        const body = await readBody(req);
        return jsonResponse(res, 200, resultFor(body));
      }
      return jsonResponse(res, 404, { error: '未找到' });
    } catch (error) {
      return jsonResponse(res, 500, { error: error.message });
    }
  });
  server.listen(port);
  return server;
}
