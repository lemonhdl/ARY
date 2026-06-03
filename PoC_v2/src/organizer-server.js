import { createServer } from 'node:http';
import { jsonResponse, readBody } from './storage.js';

function resultFor(answer, teamId) {
  const normalized = String(answer || '').trim();
  if (normalized.includes('满分答案')) {
    return {
      status: 'available',
      teamId,
      resultText: '本次提交已通过评测。',
      score: teamId === 'team_001' ? 92 : 86,
      resultSummary: teamId === 'team_001'
        ? '目标清楚，过程纠偏充分，结果可回放。'
        : '验证证据较完整，回放结构清楚。'
    };
  }
  return {
    status: 'available',
    teamId,
    resultText: '本次提交未达到通过标准。',
    score: 48,
    resultSummary: '提交内容不足以支持完整评价。'
  };
}

export function createOrganizerServer(port = 4401) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        return jsonResponse(res, 200, { status: 'ready' });
      }
      if (req.method === 'POST' && url.pathname === '/evaluate') {
        const body = await readBody(req);
        return jsonResponse(res, 200, resultFor(body.answer, body.teamId));
      }
      return jsonResponse(res, 404, { error: '未找到接口' });
    } catch (error) {
      return jsonResponse(res, 500, { error: error.message });
    }
  });
  server.listen(port);
  return server;
}
