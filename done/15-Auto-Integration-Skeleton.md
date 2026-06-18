# 自动集成骨架说明

本文是 `05-E-Auto-Integration.md` 的执行级补充，目标是让第 5 人不再从零设计集成器，而是直接按本文骨架实现自动发现、自动校验、自动装配和自动验收。

## 1. 骨架目标

集成器必须做到：

1. 自动扫描 A 到 D 的 handoff。
2. 自动校验交付完整性与契约兼容性。
3. 自动装配统一运行输入。
4. 自动生成兼容性、fallback、验收三类报告。
5. 在部分上游缺失时仍能保留第一轮可演示主路径。

## 2. 建议目录结构

```text
deliverables/
├─ a-rider/
├─ b-admin/
├─ c-frontend/
├─ d-data/
└─ e-integration/
   ├─ handoff.manifest.json
   ├─ integration-readme.md
   ├─ assembly-plan.md
   ├─ compatibility-report.md
   ├─ fallback-report.md
   ├─ acceptance-checklist.md
   ├─ assembly/
   │  ├─ discover/
   │  ├─ validate/
   │  ├─ compose/
   │  ├─ reports/
   │  └─ runtime/
   └─ artifacts/
      ├─ normalized-inputs/
      ├─ assembled-model/
      └─ snapshots/
```

说明：

1. `discover/` 负责扫描 manifest。
2. `validate/` 负责版本、文件、字段、公开规则校验。
3. `compose/` 负责把 A/B/D 输入合成给 C 的 adapter。
4. `reports/` 负责生成兼容性和 fallback 报告。
5. `runtime/` 负责把装配结果挂接到产品壳。

## 3. 集成流水线

### 阶段 1：Discover

输入：

1. `deliverables/a-rider/handoff.manifest.json`
2. `deliverables/b-admin/handoff.manifest.json`
3. `deliverables/c-frontend/handoff.manifest.json`
4. `deliverables/d-data/handoff.manifest.json`

输出：

1. 发现结果清单
2. 缺失 manifest 清单

失败规则：

1. A/B/C/D 任一 manifest 缺失，记录为 `blocking-missing-manifest`。
2. 但第一轮仍允许继续跑到 fallback 评估阶段。

### 阶段 2：Validate

校验维度：

1. manifest 结构是否合法。
2. `required` 产物是否存在。
3. `contractVersion` 是否兼容。
4. 是否满足 `10-Shared-Field-Dictionary.md`。
5. 是否违反 `11-Publication-Visibility-Rules.md`。

输出：

1. `compatibility-report.md`
2. 结构化校验结果 JSON 或内部对象

失败分级：

1. `blocking`: 无法继续装配。
2. `degraded`: 可继续，但会触发 fallback。
3. `warning`: 不阻断，但需要人工关注。

### 阶段 3：Normalize

目标：把各组输入先归一成统一中间层，而不是直接灌页面。

最小归一对象：

1. `normalized-rider-input.json`
2. `normalized-admin-input.json`
3. `normalized-shell-input.json`
4. `normalized-data-input.json`

规则：

1. A 的输入只归一为事件流和 CA 状态辅助面。
2. B 的输入只归一为发布/可见性/管理摘要面。
3. D 的输入始终是主数据面。
4. C 的输入是页面依赖和 adapter 壳约束，不是主业务数据。

### 阶段 4：Compose

装配顺序固定为：

1. 以 D 的 `authority-mock.json` 为主数据面。
2. 用 B 的发布态与管理模型覆盖 D 中对应治理字段。
3. 用 A 的事件样例和 CA 状态样例补充 Live Hall / replay 输入。
4. 依据 C 的 `page-dependencies.json` 和 `adapter-contract.md` 输出最终 `assembled-view-model.json`。

输出：

1. `artifacts/assembled-model/assembled-view-model.json`
2. `artifacts/assembled-model/public-view-model.json`
3. `artifacts/assembled-model/admin-view-model.json`

### 阶段 5：Fallback

当上游输入不完整时，fallback 顺序固定为：

1. 优先保留 D 的主 mock。
2. A 缺失时，Live Hall 退回 D 的静态 event stream / projection。
3. B 缺失时，公开判断退回 D 中已声明的 `published` / `visibility` 字段，但必须记为 `degraded`。
4. C 缺失时，无法挂接页面壳，记为 `blocking`。

输出：

1. `fallback-report.md`
2. fallback 使用点列表

### 阶段 6：Runtime Attach

目标：把装配好的 view model 提供给 C 的产品壳。

最小要求：

1. 首页读取 `RaceSummary`。
2. Live Hall 读取 `LiveProjectionView` 与脱敏事件流。
3. Works / Results / Review / Profile 读取已过滤后的公开数据。
4. 管理端摘要读取 `DashboardOverview` 与 `ProjectionStatus`。

### 阶段 7：Acceptance

自动验收至少检查：

1. 首页可展示 featured race。
2. Race Page 可根据状态跳转到正确入口。
3. Live Hall 不显示原始 CA Session。
4. Works 不显示 `private / review / hidden`。
5. Results 不显示未发布赛果。
6. Review 不显示未发布摘要。
7. Rider Profile 只显示公开档案。
8. 管理端可看到 dashboard 摘要。

输出：

1. `acceptance-checklist.md`
2. 验收通过 / 降级 / 失败结论

## 4. 结构化状态模型

建议 E 的集成器内部把每个上游组都归一成同一状态对象：

```json
{
  "group": "a-rider",
  "manifestFound": true,
  "requiredArtifactsOk": true,
  "contractCompatible": true,
  "publicationRulesCompatible": true,
  "status": "ok",
  "severity": "none",
  "notes": []
}
```

建议 `status` 枚举：

1. `ok`
2. `degraded`
3. `blocking`

## 5. 伪代码骨架

```text
loadContracts()
discoverManifests()
validateManifests()
validateArtifacts()
normalizeInputs()
composeAuthorityModel()
applyPublicationVisibilityRules()
attachToShell()
runAcceptanceChecks()
emitReports()
```

展开后建议顺序：

```text
contracts = load contracts from todos/
handoffs = discover manifests under deliverables/
validation = validate handoffs against manifest spec
normalized = normalize A/B/C/D inputs
assembled = compose D as base, overlay B, enrich with A, target C adapter
publicModel = filter assembled with publication/visibility rules
adminModel = derive dashboard + projection + audit read models
runtime = expose publicModel/adminModel to shell
reports = write compatibility/fallback/acceptance outputs
```

## 6. 报告格式建议

### 6.1 `compatibility-report.md`

按组输出：

1. 是否找到 manifest
2. 必需文件是否齐全
3. 是否契约兼容
4. 是否影响集成

### 6.2 `fallback-report.md`

按页面 / 模块输出：

1. 使用了哪个 fallback
2. 为什么触发 fallback
3. 是否影响演示主路径

### 6.3 `acceptance-checklist.md`

按用户路径输出：

1. Public path
2. Live path
3. Results / Review path
4. Admin summary path

## 7. 第一轮实现最低要求

第 5 人的第一轮集成实现，至少要真正落地以下能力：

1. 自动发现 handoff.manifest。
2. 自动判断 A/B/C/D 是否缺必需文件。
3. 自动用 D 作为主 mock 进行装配。
4. 自动套用发布态 / 可见性规则。
5. 自动生成三份报告。

## 8. 不应在集成器里做的事

1. 不直接改 C 的页面代码来规避数据问题。
2. 不自己发明第二套字段字典。
3. 不在没有记录的情况下静默吞掉上游缺陷。
4. 不把未发布内容偷偷塞进公开端来“看起来可演示”。

## 9. 与现有文档的关系

1. 任务边界以 `05-E-Auto-Integration.md` 为准。
2. manifest 结构以 `14-Handoff-Manifest-Spec.md` 为准。
3. 共享字段以 `10-Shared-Field-Dictionary.md` 为准。
4. 公开判断以 `11-Publication-Visibility-Rules.md` 为准。
5. 主数据源以 `12-Authority-Mock-Data-Spec.md` 为准。

## 10. 当前建议

如果要尽快推进第 5 人实现，优先顺序应是：

1. 先实现 `discover + validate`。
2. 再实现 `compose + fallback`。
3. 最后实现 `runtime attach + acceptance`。

这样即使前 4 人交付还不完整，第 5 人也能先产出可执行的兼容性和缺口报告。