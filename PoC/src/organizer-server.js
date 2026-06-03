import { createServer } from 'node:http';
import { join } from 'node:path';
import { organizerDir, readJson, readBody, jsonResponse } from './storage.js';

const privateRacePath = join(organizerDir, 'private_race.json');
const testCasesPath = join(organizerDir, 'test_cases.json');

function calculateScore(solution, cases) {
  const normalized = String(solution || '').toLowerCase();
  const passed = cases.filter((item) => normalized.includes(item.expected)).length;
  return Math.round((passed / cases.length) * 100);
}

export function createOrganizerServer(port = 4101) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const privateRace = await readJson(privateRacePath);

      if (req.method === 'GET' && url.pathname === '/public-projection') {
        return jsonResponse(res, 200, privateRace.publicProjection);
      }

      if (req.method === 'GET' && url.pathname === '/private-inventory') {
        return jsonResponse(res, 200, {
          ownerLabel: '组织方',
          retainedDataTypes: [
            '完整 Race 私有定义',
            '完整 coding agent session 原文',
            'Organizer 私有筛选标准',
            '未公开项目材料',
            '后续披露策略'
          ],
          disclosedToAry: [
            'Race 公开投影',
            'Riding Record 摘要',
            'Prompt 摘要',
            'Agent Output 摘要',
            'Steering 摘要',
            '公开回放事件',
            '数据版本指纹'
          ],
          statement: '组织方只向 ARY 披露 Riding Record 公开投影，不上传完整 Race 私有数据或完整 session 原文。'
        });
      }

      if (req.method === 'POST' && url.pathname === '/mock-evaluation') {
        const body = await readBody(req);
        return jsonResponse(res, 200, {
          submissionSummary: String(body.answer || '').slice(0, 24),
          result: '这个小组的解答测评结果为:满分!',
          dataVersionHash: privateRace.publicProjection.dataVersionHash,
          evaluatedBy: 'Organizer local data processor',
          proof: 'Organizer 服务在线时完成本地评测并返回结果。'
        });
      }

      if (req.method === 'POST' && url.pathname === '/evaluate') {
        const body = await readBody(req);
        const testCases = await readJson(testCasesPath);
        const score = calculateScore(body.solution, testCases.cases);
        return jsonResponse(res, 200, {
          raceId: body.raceId,
          submissionId: body.submissionId,
          score,
          publicResult: score >= 67 ? '通过公开评测摘要' : '未通过公开评测摘要',
          dataVersionHash: privateRace.publicProjection.dataVersionHash,
          evaluatedBy: 'Organizer evaluator',
          proof: 'Organizer private evaluation data was used only on the Organizer side.'
        });
      }

      jsonResponse(res, 404, { error: '未找到接口' });
    } catch (error) {
      jsonResponse(res, 500, { error: error.message });
    }
  });

  server.listen(port);
  return server;
}
