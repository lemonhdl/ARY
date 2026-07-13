# ARY 发布态与可见性规则

版本：v0.1  
状态：草案 / 第一轮集成口径  
适用范围：Public Site、Live Hall、Screen Display、Admin / Maintenance、后续统一 mock 与 adapter  

## 1. 文档目的

本文用于冻结第一轮集成里最容易混乱的两类规则：

1. 一个内容是否“已发布”。
2. 一个内容是否“可公开展示”。

这两件事必须分开。`published` 解决“能不能作为正式对外结果/摘要出现”，`visibility` 解决“允许谁看”。

## 2. 总原则

### 2.1 Public 总原则

`Public` 只能访问已公开、已发布资源。

这条口径来自 `docs/ary-permission-matrix.md`，也是本文所有细则的最高约束。

### 2.2 原始过程数据总原则

1. 原始 CA Session 默认不公开。
2. Public 永不读取原始 CA Session。
3. Public 只读取脱敏后的 Evidence 摘要、Projection 摘要、已发布 Results、已发布 Review / Report 和公开 Rider Profile。

### 2.3 Projection 总原则

1. Projection 只用于过程展示。
2. Projection 不是最终事实源。
3. Live Hall / Screen Display 可展示 Projection。
4. Results / Review 不得把 Projection 当最终赛果。

## 3. 两条判断轴

### 3.1 发布态 `publicationStatus`

发布态回答的是：这个对象是否已经被允许作为正式对外资产使用。

推荐统一枚举：

`draft | generated | reviewed | published | withdrawn | failed`

含义：

1. `draft`：草稿，只能内部看。
2. `generated`：系统生成但未人工确认。
3. `reviewed`：已完成内部复核，但还未正式对外发布。
4. `published`：允许作为正式对外内容。
5. `withdrawn`：曾经发布过，但已撤回。
6. `failed`：生成或发布流程失败。

### 3.2 可见性 `visibility`

可见性回答的是：这个对象允许被谁看。

推荐第一轮统一枚举：

`private | review | public | hidden`

含义：

1. `private`：仅内部或对象所有者范围可见。
2. `review`：仅评审 / 内部演示范围可见。
3. `public`：允许进入公开端。
4. `hidden`：已被下线，不得进入公开端。

## 4. 最终公开判定公式

### 4.1 Works

`Work` 进入 Public Site 的必要条件：

1. `visibility = public`
2. 内容未被 `hidden`

第一轮不额外要求 `publicationStatus`，因为现有原型和字段字典里对作品主要靠 `visibility` 管理公开边界。

补充：

1. `private` 和 `review` 不得默认出现在公开作品墙。
2. 如果在 demo 中临时展示 `review` 内容，必须明确标成 `internal preview`，不能伪装成公开资产。

### 4.2 Results / Award

`Result` 进入 Public Site 的必要条件：

1. `publicationStatus = published`
2. 对应 Race 已进入 `completed` 或等价正式结果阶段

第一轮建议直接在 `PublishedResultView` 中补 `published: boolean`，不要让前端再靠 `completed race` 猜测。

### 4.3 Review / race_report / review_summary

进入 Public Site 的必要条件：

1. `publicationStatus = published`
2. `visibility = public`

说明：

1. `review_summary`、`race_report` 只有“已发布且公开可见”时，Public 才能访问。
2. `rider_report` 默认不公开，只允许对应 Rider、managed race Organizer 和 Admin 查看，除非后续单独增加公开发布规则。

### 4.4 Rider Profile

`Rider Profile` 进入 Public Site 的必要条件：

1. `visibility = public`
2. 不包含原始 RidingRecord / 原始 CA Session
3. 公开能力标签来自公开 Evidence / Report 摘要，而不是私有原始材料

### 4.5 Evidence Summary

Public 只能读取“可公开的 Evidence 摘要”，必要条件：

1. Evidence 已脱敏
2. 不是原始 CA Session
3. `visibility = public` 或等价公开标记

### 4.6 Live Hall / Screen Display

进入公开观看面的条件与 Results 不同：

1. 可以展示 Projection 和脱敏事件流。
2. 不要求 `published`，因为它是赛时过程展示，不是赛后正式结果。
3. 仍然不得展示原始 CA Session、未脱敏原始日志、私有作品内容。

## 5. 对象级规则

### 5.1 Race

| 对象 | 公开判定 | 备注 |
| --- | --- | --- |
| Race Summary | 可公开 | 首页、Race Page、Gallery 可用 |
| Race Schedule | 可公开 | 以公开赛事信息为准 |
| Race Metrics | 部分公开 | 聚合指标可公开，敏感后台指标不公开 |

### 5.2 Work

| 字段 / 对象 | 公开端是否可见 | 条件 |
| --- | --- | --- |
| `title` / `summary` | 可见 | `visibility=public` |
| `demo` / `repo` | 条件可见 | 对外允许公开时才展示 |
| `evidenceRefs` | 不直接公开 | 只做内部关联 |
| `awardIds` | 可见 | 作品已公开时可显示获奖关系 |

### 5.3 Result / Award

| 字段 / 对象 | 公开端是否可见 | 条件 |
| --- | --- | --- |
| 奖项名、名次、作品、骑手、理由摘要 | 可见 | `publicationStatus=published` |
| 未发布结果 | 不可见 | 可在管理端显示 |

### 5.4 Review / Report

| 字段 / 对象 | 公开端是否可见 | 条件 |
| --- | --- | --- |
| `review.summary` | 可见 | `published + public` |
| `featuredCases` | 条件可见 | 已发布且内容可公开 |
| `judgeComments` | 条件可见 | 只能展示公开摘要，不是原始私密评审 |
| `rider_report` | 默认不可见 | 除非未来单独增加公开规则 |

### 5.5 Rider Profile

| 字段 / 对象 | 公开端是否可见 | 条件 |
| --- | --- | --- |
| `displayName` / `headline` / `skillTags` / `stats` | 可见 | `visibility=public` |
| 原始 RidingRecord / 原始 Session | 不可见 | 永不进入公开端 |
| 公开可信标识 | 条件可见 | 只能展示公开摘要或 badge，不展示内部校验细节 |

## 6. 角色与 owner 规则

### 6.1 第一轮临时 owner 口径

在最终边界会裁定前，先使用下面的临时口径，保证集成不阻塞：

| 动作 | 第一轮临时 owner | 备注 |
| --- | --- | --- |
| 发布 Results | Organizer | Admin 保留系统级兜底能力 |
| 撤回 Results | Organizer / Admin | 需记录原因 |
| 发布 Review / race_report | Organizer | Admin 保留系统级兜底能力 |
| 隐藏 Work | Admin | 与管理系统设计一致 |
| 隐藏 Rider Profile | Admin | 与管理系统设计一致 |
| 公开 / 下线公开 Evidence 摘要 | Organizer / Admin | 需遵守不公开原始 Session 的上位规则 |

说明：这只是第一轮集成口径，不代表最终产品治理口径已彻底定稿。

### 6.2 审计要求

以下动作必须写入审计日志：

1. Results 发布 / 撤回。
2. Review / Report 发布 / 撤回。
3. Work `visibility` 变更。
4. Rider Profile `visibility` 变更。
5. 公开 Evidence 摘要的上下线操作。

## 7. 页面读取规则

### 7.1 Home / Race Gallery

允许读取：

1. 公开赛事摘要
2. 已发布赛果摘要
3. 已发布 Review 入口
4. 公开作品精选
5. 公开 Rider 精选

不得读取：

1. 未发布 Results
2. 未发布 Review
3. `private / review / hidden` 作品
4. 非公开 Rider Profile

### 7.2 Race Page

允许读取：

1. Race 上下文
2. 公开可见的 Results / Review / Works 入口
3. running 态时进入 Live Hall

不得读取：

1. 私有评审记录
2. 原始 CA Session

### 7.3 Works / Work Page

默认只展示 `visibility = public` 的作品。

如果 demo 阶段为了演示临时展示 `review` 内容，页面必须显式标注 `mock / internal preview`。

### 7.4 Results

只展示 `publicationStatus = published` 的结果，不允许把过程榜单或未发布结果伪装成正式赛果。

### 7.5 Review

只展示 `published + public` 的复盘摘要与公开评委摘录。未发布时应显示 `unavailable` 或内部草稿态，而不是静默假装已公开。

### 7.6 Rider Profile

只展示公开档案；不展示原始 RidingRecord / 原始 CA Session；能力标签只能来自公开摘要。

### 7.7 Live Hall / Screen Display

允许读取 Projection、聚合指标、脱敏事件流；不得读取原始 Session、私有 Work 内容、私密评审材料。

## 8. 和字段字典的对应关系

本文对下列共享对象提供上位约束：

1. `PublishedWorkView.visibility`
2. `PublishedResultView.published`
3. `PublishedReviewView.status`
4. `PublicRiderProfileView.visibility`
5. `CAConnectionStatusView.riskHint`
6. `PublishedArtifactStatus.status`

建议后续把字段字典中的这些对象都映射到本文规则，而不是各页面单独发明判断条件。

## 9. 第一轮实现建议

### 9.1 统一布尔辅助字段

为降低前端判断复杂度，建议 adapter 在第一轮统一输出这些辅助字段：

1. `isPublicVisible`
2. `isPublished`
3. `isPublicPublished`

建议计算规则：

1. `isPublicVisible = visibility === 'public'`
2. `isPublished = publicationStatus === 'published' || published === true`
3. `isPublicPublished = isPublicVisible && isPublished`

### 9.2 第一轮前端最小判断

1. Works：只渲染 `isPublicVisible`。
2. Results：只渲染 `isPublished`。
3. Review：只渲染 `isPublicPublished`。
4. Rider Profile：只渲染 `isPublicVisible`。
5. Live Hall / Screen：只渲染脱敏 Projection 数据，不走 `published` 判定。

## 10. 当前未决项

1. Results 的最终唯一 owner 是否保留给 Organizer，还是切到 Admin。
2. `review_summary` 与 `race_report` 是否共用完全相同的发布状态机。
3. `Work` 是否需要补独立 `publicationStatus`，还是第一轮继续仅靠 `visibility`。
4. `Rider Profile` 的默认可见性是 `private` 还是 `public`。
5. `Evidence Summary` 的最小公开字段集合还需 A / D 进一步确认。

## 11. 当前结论

第一轮集成可以先按以下最小规则落地：

1. Public 只能读已公开、已发布资源。
2. Work 主要靠 `visibility` 控公开边界。
3. Result / Review / Report 主要靠 `published` 或 `publicationStatus` 控正式对外边界。
4. Live Hall / Screen Display 可以展示过程 Projection，但永不展示原始 CA Session。
5. 所有上下线和发布动作都必须可审计。