/**
 * build-timeline.mjs —— 由「进度矩阵 + 状态矩阵」生成赛事时序帧序列 race-timeline.json。
 *
 * 13 帧（10:16:40 → 10:22:22），分三段：
 *   - 起跑 start（idx0..1）：发车，roundProgress 从 ~0 起步。
 *   - 比赛 race（idx2..9）：追赶、反超、风险、状态切换；idx9 = race-snapshot.json「当前直播帧」。
 *   - 冲线 finish（idx10..12）：领先者冲过终点进入 finished 状态，前三名陆续冲线锁定名次。
 *
 * currentFrameIndex=9 标记「当前画面」= race-snapshot；冲线段是它之后的演化。
 * 单一事实来源：rank / rankDelta / overtake / status_change / finished 全部由本脚本派生，
 * 保证帧间自洽（进度单调、各帧 rank 为 1..N 置换、idx9 严格等于 race-snapshot）。
 * 顺带把 race-snapshot.json 每个 entry 的 rankDelta 回写为「开赛→当前的净名次变化 = rank@idx2 - rank@idx9」。
 *
 * 复跑：mock_data/ 下 `node build-timeline.mjs`
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ORDER = [
  'ent-ai-sudoku', 'ent-devcompass', 'ent-travel-aiar', 'ent-study-copilot',
  'ent-docpilot', 'ent-codelab', 'ent-dataforge', 'ent-pixelmind',
  'ent-chatops-hub', 'ent-finsight', 'ent-mediscribe', 'ent-greenroute',
];
const NAMES = {
  'ent-ai-sudoku': 'AI Sudoku', 'ent-devcompass': 'DevCompass Racing', 'ent-travel-aiar': 'Travel AIAR',
  'ent-study-copilot': 'Study Copilot', 'ent-docpilot': 'DocPilot', 'ent-codelab': 'CodeLab',
  'ent-dataforge': 'DataForge', 'ent-pixelmind': 'PixelMind', 'ent-chatops-hub': 'ChatOps Hub',
  'ent-finsight': 'FinSight', 'ent-mediscribe': 'MediScribe', 'ent-greenroute': 'GreenRoute',
};

const CURRENT = 9; // idx9 = race-snapshot 当前直播帧

// 13 帧时间轴
const TIMES = [
  { systemTime: '10:16:40', elapsedTime: '01:19:39', phase: 'start' },
  { systemTime: '10:17:20', elapsedTime: '01:20:19', phase: 'start' },
  { systemTime: '10:18:08', elapsedTime: '01:21:07', phase: 'race' },
  { systemTime: '10:18:40', elapsedTime: '01:21:39', phase: 'race' },
  { systemTime: '10:19:20', elapsedTime: '01:22:19', phase: 'race' },
  { systemTime: '10:20:00', elapsedTime: '01:22:59', phase: 'race' },
  { systemTime: '10:20:40', elapsedTime: '01:23:39', phase: 'race' },
  { systemTime: '10:21:10', elapsedTime: '01:24:09', phase: 'race' },
  { systemTime: '10:21:30', elapsedTime: '01:24:29', phase: 'race' },
  { systemTime: '10:21:38', elapsedTime: '01:24:37', phase: 'race' }, // idx9 = race-snapshot
  { systemTime: '10:21:55', elapsedTime: '01:24:54', phase: 'finish' },
  { systemTime: '10:22:08', elapsedTime: '01:25:07', phase: 'finish' },
  { systemTime: '10:22:22', elapsedTime: '01:25:21', phase: 'finish' },
];

// roundProgress 矩阵（idx0..12）。idx9 列 = race-snapshot.json 当前值；起跑从 ~0，冲线到 1.0。
const RP = {
  //                 start          race(idx2..9)                                       finish
  'ent-ai-sudoku':    [0.160, 0.384, 0.640, 0.690, 0.740, 0.788, 0.838, 0.882, 0.912, 0.930, 0.985, 1.000, 1.000],
  'ent-devcompass':   [0.150, 0.360, 0.600, 0.646, 0.692, 0.740, 0.788, 0.824, 0.836, 0.872, 0.945, 0.988, 1.000],
  'ent-travel-aiar':  [0.153, 0.367, 0.612, 0.660, 0.706, 0.752, 0.794, 0.822, 0.838, 0.845, 0.918, 0.968, 1.000],
  'ent-study-copilot':[0.146, 0.351, 0.585, 0.630, 0.676, 0.722, 0.760, 0.786, 0.800, 0.808, 0.858, 0.912, 0.958],
  'ent-docpilot':     [0.140, 0.336, 0.560, 0.604, 0.648, 0.696, 0.730, 0.744, 0.752, 0.760, 0.760, 0.760, 0.760],
  'ent-codelab':      [0.128, 0.306, 0.510, 0.560, 0.612, 0.660, 0.692, 0.710, 0.722, 0.728, 0.790, 0.845, 0.892],
  'ent-dataforge':    [0.124, 0.297, 0.495, 0.548, 0.602, 0.648, 0.676, 0.688, 0.690, 0.690, 0.690, 0.690, 0.690],
  'ent-pixelmind':    [0.136, 0.327, 0.545, 0.580, 0.612, 0.636, 0.650, 0.654, 0.655, 0.655, 0.702, 0.740, 0.792],
  'ent-chatops-hub':  [0.132, 0.318, 0.530, 0.566, 0.596, 0.610, 0.610, 0.610, 0.611, 0.612, 0.612, 0.612, 0.612],
  'ent-finsight':     [0.118, 0.282, 0.470, 0.500, 0.524, 0.540, 0.550, 0.556, 0.559, 0.560, 0.600, 0.636, 0.682],
  'ent-mediscribe':   [0.112, 0.269, 0.448, 0.482, 0.505, 0.512, 0.514, 0.515, 0.515, 0.515, 0.515, 0.515, 0.515],
  'ent-greenroute':   [0.105, 0.252, 0.420, 0.440, 0.452, 0.460, 0.465, 0.468, 0.470, 0.470, 0.470, 0.470, 0.470],
};

// 状态覆盖：[startFrame, endFrame, status, motionState]，未覆盖区间默认 running/running
const OVERRIDES = {
  'ent-ai-sudoku':    [[7, 10, 'running', 'sprinting'], [11, 12, 'finished', 'finished']],
  'ent-devcompass':   [[7, 7, 'running', 'sprinting'], [10, 11, 'running', 'sprinting'], [12, 12, 'finished', 'finished']],
  'ent-travel-aiar':  [[10, 11, 'running', 'sprinting'], [12, 12, 'finished', 'finished']],
  'ent-study-copilot':[[6, 9, 'running', 'slowed'], [10, 12, 'running', 'sprinting']],
  'ent-docpilot':     [[6, 6, 'running', 'slowed'], [7, 12, 'blocked', 'blocked']],
  'ent-codelab':      [[3, 12, 'running', 'sprinting']],
  'ent-dataforge':    [[4, 6, 'running', 'sprinting'], [7, 12, 'pit_stop', 'pit_stop']],
  'ent-pixelmind':    [[5, 8, 'running', 'slowed'], [10, 12, 'running', 'sprinting']],
  'ent-chatops-hub':  [[5, 12, 'takeover', 'takeover']],
  'ent-finsight':     [[5, 9, 'running', 'slowed'], [10, 12, 'running', 'sprinting']],
  'ent-mediscribe':   [[6, 12, 'stale', 'stale']],
  'ent-greenroute':   [[4, 8, 'running', 'slowed'], [9, 12, 'idle', 'idle']],
};
function stateAt(id, f) {
  for (const [s, e, status, motion] of OVERRIDES[id] || []) if (f >= s && f <= e) return { status, motionState: motion };
  return { status: 'running', motionState: 'running' };
}

const F = TIMES.length;
// 每队首次进入 finished 的帧（用于冲线后名次锁定）
const finishFrameOf = {};
for (const id of ORDER) {
  finishFrameOf[id] = Infinity;
  for (let f = 0; f < F; f++) if (stateAt(id, f).status === 'finished') { finishFrameOf[id] = f; break; }
}
// 每帧 rank：已冲线者按 finishFrame 升序在前，未冲线者按 roundProgress 降序；平局按 ORDER
const rankByFrame = [];
for (let f = 0; f < F; f++) {
  const keyFinish = (id) => (f >= finishFrameOf[id] ? finishFrameOf[id] : Infinity);
  const sorted = [...ORDER].sort((a, b) =>
    (keyFinish(a) - keyFinish(b)) || (RP[b][f] - RP[a][f]) || (ORDER.indexOf(a) - ORDER.indexOf(b)));
  const m = {}; sorted.forEach((id, i) => (m[id] = i + 1));
  rankByFrame.push(m);
}

// ---- 自洽校验 ----
let fail = 0; const bad = (m) => { fail++; console.log('FAIL:', m); };
for (const id of ORDER) for (let f = 1; f < F; f++) if (RP[id][f] < RP[id][f - 1] - 1e-9) bad(`${id} 进度回退 @idx${f}`);
for (let f = 0; f < F; f++) {
  const ranks = Object.values(rankByFrame[f]).sort((a, b) => a - b);
  if (ranks.join() !== ORDER.map((_, i) => i + 1).join()) bad(`idx${f} rank 非 1..N 置换`);
}

// ---- 构造帧 + 事件 ----
const kindOf = (to) => to === 'finished' ? 'finish'
  : (['blocked', 'stale', 'takeover'].includes(to) ? 'risk' : (to === 'pit_stop' ? 'pit_stop' : 'info'));
const frames = [];
for (let f = 0; f < F; f++) {
  const entries = ORDER.map((id) => {
    const rank = rankByFrame[f][id];
    const prev = f === 0 ? rank : rankByFrame[f - 1][id];
    return { entryId: id, rank, rankDelta: prev - rank, roundProgress: RP[id][f], ...stateAt(id, f) };
  }).sort((a, b) => a.rank - b.rank);

  const events = [];
  if (f === 0) events.push({ type: 'race_start', summary: '发车！12 支队伍起跑' });
  if (f > 0) {
    for (const id of ORDER) {
      const from = rankByFrame[f - 1][id], to = rankByFrame[f][id];
      if (to < from) {
        const passed = ORDER.filter((o) => rankByFrame[f - 1][o] < rankByFrame[f - 1][id] && rankByFrame[f][o] > rankByFrame[f][id]);
        if (passed.length) events.push({ type: 'overtake', entryId: id, entryName: NAMES[id], fromRank: from, toRank: to, passed: passed.map((o) => NAMES[o]) });
      }
    }
    for (const id of ORDER) {
      const a = stateAt(id, f - 1).status, b = stateAt(id, f).status;
      if (a !== b) events.push({ type: 'status_change', entryId: id, entryName: NAMES[id], from: a, to: b, kind: kindOf(b) });
    }
    const t1p = Object.keys(rankByFrame[f - 1]).find((k) => rankByFrame[f - 1][k] === 1);
    const t1c = Object.keys(rankByFrame[f]).find((k) => rankByFrame[f][k] === 1);
    if (t1p !== t1c) events.push({ type: 'lead_change', entryId: t1c, entryName: NAMES[t1c] });
  }

  frames.push({
    frameIndex: f, ...TIMES[f],
    isCurrent: f === CURRENT,
    avgRoundProgress: Math.round(ORDER.reduce((s, id) => s + RP[id][f], 0) / ORDER.length * 1000) / 1000,
    top3: entries.slice(0, 3).map((e) => e.entryId),
    entries, events,
  });
}

// Top3 变化摘要
const top3Changes = [];
for (let f = 1; f < F; f++) if (frames[f].top3.join() !== frames[f - 1].top3.join())
  top3Changes.push({ frameIndex: f, t: TIMES[f].systemTime, from: frames[f - 1].top3.map((i) => NAMES[i]), to: frames[f].top3.map((i) => NAMES[i]) });

const timeline = {
  schemaVersion: '1.0.0',
  kind: 'RaceTimeline',
  generatedAt: '2026-06-08T10:21:38+08:00',
  competitionId: 'grs001-dcr-2026',
  trackId: 'grandstand-oval',
  note: '赛事时序帧序列（§5.4 Snapshot 序列）。13 帧覆盖 10:16:40→10:22:22，分起跑/比赛/冲线三段。currentFrameIndex=9 标记「当前直播帧」并严格等于 race-snapshot.json；冲线段(10..12)为其之后的演化，领先者进入 finished。每帧仅含动态字段（rank/rankDelta/roundProgress/status/motionState）+ events；静态字段按 entryId 从 race-snapshot.json 取。位置仍由 roundProgress 经 track-runtime 派生，不写死 x/y。',
  frameCount: F,
  startFrameIndex: 0,
  currentFrameIndex: CURRENT,
  finishFrameIndex: frames.findIndex((fr) => fr.events.some((e) => e.type === 'status_change' && e.kind === 'finish')),
  frameIntervalNote: '帧间隔约 13~48 秒，非等距；时间见各帧 systemTime/elapsedTime。',
  finalFrameAlignsWith: 'race-snapshot.json (= frames[currentFrameIndex])',
  eventTypes: ['race_start', 'overtake', 'status_change', 'lead_change'],
  phases: { start: '起跑 idx0..1', race: '比赛 idx2..9（idx9=当前直播帧）', finish: '冲线 idx10..12' },
  top3Changes,
  frames,
};
writeFileSync('race-timeline.json', JSON.stringify(timeline, null, 2) + '\n', 'utf8');

// ---- 回写 race-snapshot.json 的净 rankDelta（开赛 idx2 → 当前 idx9）----
const snap = JSON.parse(readFileSync('race-snapshot.json', 'utf8'));
const netDelta = {}; ORDER.forEach((id) => (netDelta[id] = rankByFrame[2][id] - rankByFrame[CURRENT][id]));
let sum = 0; for (const e of snap.entries) { e.rankDelta = netDelta[e.entryId]; sum += e.rankDelta; }
if (sum !== 0) bad('净 rankDelta Σ≠0');
writeFileSync('race-snapshot.json', JSON.stringify(snap, null, 2) + '\n', 'utf8');

// ---- 打印摘要 ----
console.log('排名演变（行=队伍最终序，列=idx0..12；▲起跑 ●当前 ⚑冲线）：');
console.log('队伍'.padEnd(20), TIMES.map((_, i) => (i === CURRENT ? '●' + i : 'i' + i)).map(s => s.padStart(3)).join(' '));
for (const id of ORDER) console.log(NAMES[id].padEnd(20), Array.from({ length: F }, (_, f) => String(rankByFrame[f][id]).padStart(3)).join(' '));
console.log('\nTop3 变化：'); top3Changes.forEach((c) => console.log(`  ${c.t}  [${c.from.join(', ')}] -> [${c.to.join(', ')}]`));
console.log('\n冲线 finished：'); ORDER.filter(id => finishFrameOf[id] < Infinity).forEach(id => console.log(`  ${NAMES[id]} @ ${TIMES[finishFrameOf[id]].systemTime} (idx${finishFrameOf[id]})`));
const evN = frames.reduce((s, fr) => s + fr.events.length, 0);
console.log(`\n事件总数：${evN} | 帧数：${F} | currentFrameIndex=${CURRENT}`);
console.log(fail === 0 ? '\nTIMELINE OK — 自洽校验全过，已写 race-timeline.json 并回写 rankDelta' : `\n${fail} 项 FAIL`);
