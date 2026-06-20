# authority-mock.json 结构说明（schema）

`authority-mock.json` 是第一轮唯一权威 mock,也是单机 Web 应用的运行时主入口。本文件描述其每个顶层键的结构、
枚举取值,以及到 `todos/10-Shared-Field-Dictionary.md` 共享 View 的映射。

> 由 `source/generate.py` 确定性生成,请勿手改。重新生成:`python generate.py`。

## 0. 顶层结构

```jsonc
{
  "metadata": { ... },
  "races": [ RaceSummary ],
  "liveProjections": [ LiveProjectionView ],
  "works": [ PublishedWorkView ],
  "results": [ PublishedResultView ],   // 按赛事聚合的已发布赛果
  "awards": [ ... ],                    // PublishedResultView 的颗粒来源(奖项粒度)
  "reviews": [ PublishedReviewView ],
  "profiles": [ PublicRiderProfileView ],
  "dashboard": DashboardOverview,
  "caStatuses": [ CAConnectionStatusView ],
  "projectionStatuses": [ ProjectionStatus ],
  "publishedArtifacts": [ PublishedArtifactStatus ],
  "auditLogs": [ AuditLogEntry ]
}
```

顶层键与 `todos/12` §3「最低对象覆盖」一一对应;`results` 为额外的按赛事聚合视图(便于 C 的 Results 页直接消费),
`awards` 仍是其颗粒来源。`assemble.js` 读取的 `races/liveProjections/works/awards/reviews/profiles/dashboard`
全部存在,向后兼容。

## 1. metadata

| 字段 | 类型 | 说明 |
|---|---|---|
| `source` | string | 固定 `ary-d-data-generator` |
| `dataVersion` / `contractVersion` | string | 数据/契约版本 |
| `generatedAt` | string(ISO) | 生成时刻(固定基准,可 diff) |
| `deterministic` | bool | 恒为 `true` |
| `seed` | number | 随机种子 |

## 2. races —— `RaceSummary[]`

透传 `design-prototype/data/sample-races.json` 的全部前端展示字段(前端零改动消费),并补充派生计数。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` / `slug` / `title` | string | 赛事标识与标题(adapter 读取 `id`/`title`) |
| `domain` | string | 领域 |
| `status` | `RaceStatus` | `registration\|running\|judging\|completed\|archived\|upcoming` |
| `stageLabel` / `summary` / `challenge` | string | 展示文案(adapter 读取 `summary`) |
| `schedule` | object | registration/race/submission/judging/results 文案 |
| `metrics` | object | 策划用展示聚合数(riders/sessions/...,见 coverage-report §取舍) |
| `live` | object? | 仅 running 赛事:ridingSignal/submitLeft/totalCost/riskSignals |
| `awards` | string[] | 奖项名单(策划) |
| `safetyNotes` / `notes` | string[]? | 安全边界 / 备注 |
| `publicWorkCount` | number | 该赛事 visibility=public 的作品数(派生) |

## 3. liveProjections —— `LiveProjectionView[]`

只包含进行中(running)赛事的实时投影;**只用 Projection 与脱敏事件流,不含原始 CA Session / 签名**。

| 字段 | 类型 | 说明 |
|---|---|---|
| `raceId` | string | |
| `updatedAt` | string(ISO) | |
| `status` | `ProjectionHealth` | `healthy\|degraded\|failed\|stale` |
| `headlineMetrics` | object | ridingSignal/activeRiders/sessions/submittedWorks/totalCost/riskSignals |
| `processLeaderboard` | array | `{rank, riderId, name, score, label}`(过程榜,非最终事实源) |
| `eventStream` | array | `{time, type, text}`(脱敏事件) |

## 4. works —— `PublishedWorkView[]`

**全量作品**(便于管理端),每条携带公开判定字段。**公开端必须按 `visibility==='public'` 过滤**
(见 `todos/11` §3)。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` / `raceId` / `riderId` / `title` | string | |
| `status` | `draft\|submitted\|published` | |
| `visibility` | `WorkVisibility` | `private\|review\|public\|hidden` |
| `published` | bool | `status==='published'` |
| `publishedAt` | string(ISO)\|null | |
| `summary` / `demo` / `repo` | string | |
| `isPublic` | bool | `visibility==='public'`,公开端过滤用 |

不变量保证:public 作品 ⇒ status∈{submitted,published}(不会出现 public+draft / public+hidden)。

## 5. results —— `PublishedResultView[]` ；awards —— 颗粒来源

`results` 按赛事聚合,仅含 `completed/archived` 且已发布的赛果:

| 字段 | 类型 | 说明 |
|---|---|---|
| `raceId` / `title` / `status` | | |
| `published` | bool | 恒 `true` |
| `publicationStatus` | string | 恒 `published`(等价判定字段) |
| `awards` | array | `{id, raceId, name, rank, workId, riderName, reason}` |
| `leaderboard` | array | 最终榜 |

`awards`(顶层)是奖项粒度来源,字段同上。所有 award 指向的作品均为 public(不变量 9/11 保证)。

## 6. reviews —— `PublishedReviewView[]`

仅含已发布(`completed/archived`)赛事:

| 字段 | 类型 | 说明 |
|---|---|---|
| `raceId` | string | |
| `status` / `published` | `published` / `true` | |
| `summary` | string | |
| `featuredCases` | string[] | 仅取 public 作品标题 |
| `judgeComments` | string[] | |

## 7. profiles —— `PublicRiderProfileView[]`

**只含公开档案**(`isPublic===true`),**不含原始 RidingRecord / CA Session**(见 `todos/11` §3 Rider Profile)。

| 字段 | 类型 | 说明 |
|---|---|---|
| `riderId` / `displayName` / `headline` | string | |
| `featuredRaceIds` | string[] | |
| `featuredWorkIds` | string[] | 仅引用 public 作品 |
| `skillTags` | string[] | |
| `stats` | object | projects/sessions/completion/ranking |
| `isPublic` | bool | 恒 `true` |

## 8. dashboard —— `DashboardOverview`

管理端摘要(单例对象)。`adapter` 读取 `totalUsers / activeRaces / systemHealth`,这三个键保证存在。

| 字段 | 类型 |
|---|---|
| `totalUsers` / `totalRaces` / `activeRaces` / `runningRaces` / `registrationOpenRaces` | number |
| `totalRiders` / `totalWorks` / `publishedWorks` / `hiddenWorks` / `totalAwards` | number |
| `pendingJudgements` / `riskSignals` / `caFailed` | number |
| `projectionHealth` | object(raceId → ProjectionHealth) |
| `systemHealth` | string |

## 9. caStatuses —— `CAConnectionStatusView[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `raceId` / `riderId` / `riderName` / `provider` | string | |
| `health` | `CAConnectionHealth` | `not_configured\|registered\|handshaken\|active\|failed\|disabled` |
| `lastSignalAt` | string(ISO)\|null | |
| `riskNote` | string\|null | 风险提示(cost watch / safety boundary / CA failed / idle) |

## 10. projectionStatuses —— `ProjectionStatus[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `raceId` | string | |
| `health` | `ProjectionHealth` | 四态齐全(healthy/degraded/failed/stale) |
| `lastUpdate` | string(ISO) | |
| `note` | string | |

## 11. publishedArtifacts —— `PublishedArtifactStatus[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` / `raceId` / `refId` | string | |
| `type` | `result\|review\|report\|work` | |
| `status` | `draft\|submitted\|review\|published` | 公开端仅取 `published`;`submitted` 仅出现于 `type=work`(作品已提交未发布) |
| `published` | bool | |
| `publishedAt` | string(ISO)\|null | |

## 12. auditLogs —— `AuditLogEntry[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` / `at` / `actor` / `action` / `target` | string | |
| `severity` | `info\|notice\|warning\|danger` | |
| `detail` | string | |

---

## 枚举汇总(与 `todos/10` §2 对齐)

| 枚举 | 取值 |
|---|---|
| `RaceStatus` | registration / running / judging / completed / archived / upcoming |
| `WorkVisibility` | private / review / public / hidden |
| `ProjectionHealth` | healthy / degraded / failed / stale |
| `CAConnectionHealth` | not_configured / registered / handshaken / active / failed / disabled |
