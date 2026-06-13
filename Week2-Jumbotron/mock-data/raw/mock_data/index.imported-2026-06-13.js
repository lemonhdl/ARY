/**
 * mock_data —— DevCompass Racing / Jumupbotron(赛马大屏) 模拟数据入口
 *
 * 用法（打包器 / Vite / Svelte 环境，支持 JSON import）：
 *   import { raceSnapshot, entries, kpi, trackProfile, top3, byRank } from '@/mock_data';
 *
 * 数据来源（单一事实，互相交叉校验）：
 *   - race-snapshot.json          DCR RaceSnapshot（Adapter 输入）
 *   - racing-entry-snapshots.json RacingEntrySnapshot[]（Adapter 输出 / 运行时契约）
 *   - tracks/grandstand-oval/track.profile.json  赛道几何（运行时事实来源）
 *   - race-timeline.json          赛事时序帧序列（§5.4 Snapshot 序列，最后一帧=race-snapshot）
 *
 * 位置由数据派生：马匹 x/y 不在此提供，由 track-runtime 用 roundProgress + trackProfile 计算。
 */

import raceSnapshot from './race-snapshot.json';
import racingEntrySnapshots from './racing-entry-snapshots.json';
import trackProfile from './tracks/grandstand-oval/track.profile.json';
import raceTimeline from './race-timeline.json';

// —— 常用切片，直接给 UI 用 ——
export { raceSnapshot, racingEntrySnapshots, trackProfile, raceTimeline };

export const competition = raceSnapshot.competition;
export const kpi = raceSnapshot.kpi;
export const entries = raceSnapshot.entries;
export const messages = raceSnapshot.messages;
export const attentionItems = raceSnapshot.attentionItems;

/** 按 rank 升序（1 在前） */
export const byRank = [...entries].sort((a, b) => a.rank - b.rank);

/** 实时 TOP3（rank 1~3） */
export const top3 = byRank.slice(0, 3);

/** entryId → entry 查表 */
export const entryById = Object.fromEntries(entries.map((e) => [e.entryId, e]));

/**
 * 气泡降噪：每匹马最多 1 条，全局最多 maxBubbles 条，risk_alert / milestone 优先。
 * 与《子系统定义》§7.2 MVP 降噪策略一致（默认 3）。
 */
export function pickBubbles(maxBubbles = 3) {
  const priority = { risk_alert: 0, milestone: 1, strategy_change: 2, quality_signal: 3, progress_update: 4 };
  const perEntry = new Map();
  for (const m of messages) {
    if (m.displayMode !== 'bubble') continue;
    const prev = perEntry.get(m.entryId);
    if (!prev || (priority[m.type] ?? 9) < (priority[prev.type] ?? 9)) perEntry.set(m.entryId, m);
  }
  return [...perEntry.values()]
    .sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9))
    .slice(0, maxBubbles);
}

/** ticker 用：注意事项按时间倒序（最新在前） */
export const attentionFeed = [...attentionItems].sort(
  (a, b) => b.createdAt.localeCompare(a.createdAt)
);

// —— 时序帧序列（动态过程）——
/** 全部帧（F0..F7） */
export const frames = raceTimeline.frames;
/** 取第 i 帧（越界自动钳制） */
export function frameAt(i) {
  return frames[Math.max(0, Math.min(frames.length - 1, i | 0))];
}
/** 第 i 帧的 TOP3（entryId 数组） */
export function top3At(i) {
  return frameAt(i).top3;
}
/** 第 i 帧发生的事件（overtake / status_change / lead_change） */
export function eventsAt(i) {
  return frameAt(i).events;
}
/** Top3 发生变化的帧摘要 */
export const top3Changes = raceTimeline.top3Changes;
/** 当前直播帧索引（= race-snapshot 对应帧，冲线发生在其之后） */
export const currentFrameIndex = raceTimeline.currentFrameIndex;
/** 当前直播帧（其 entries 动态字段 = race-snapshot 状态） */
export const currentFrame = frames[currentFrameIndex];

export default {
  raceSnapshot,
  racingEntrySnapshots,
  trackProfile,
  raceTimeline,
  competition,
  kpi,
  entries,
  messages,
  attentionItems,
  byRank,
  top3,
  entryById,
  attentionFeed,
  pickBubbles,
  frames,
  frameAt,
  top3At,
  eventsAt,
  top3Changes,
  currentFrameIndex,
  currentFrame,
};
