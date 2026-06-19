# B 组交付目录

本目录用于交付管理系统读取模型、发布治理样例和审计样例。已按 `todos/02-B-Admin-Publishing.md` §11 的要求完成全部 10 项核心交付和 6 个可选 admin-shell 页面。

---

# 1. 核心交付

| # | 文件名 | 类型 | 说明 |
|---|--------|------|------|
| 1 | `handoff.manifest.json` | manifest | E 组自动集成发现入口，声明全部 10 个必需产物和 1 个可选产物 |
| 2 | `admin-read-models.md` | 文档 | 4 个共享读取模型（DashboardOverview / ProjectionStatus / PublishedArtifactStatus / AuditLogEntry）+ 3 个补充模型（UserRolesView / ProfileCompletionView / SystemConfigView）的字段定义、样例指引和 C/D/E 消费说明 |
| 3 | `maintenance-ops.md` | 文档 | 4 类内部维护操作说明：Work 可见性变更、Rider Profile 可见性变更、Projection 手动重算、Report 手动重跑，含操作流程、约束、权限和接口边界 |
| 4 | `dashboard-overview.sample.json` | 样例数据 | 平台总览卡片 + 赛事状态分布（7 种状态） + CA 接入全局健康 + 性能指标 + Top 3 热门赛事 |
| 5 | `projection-status.sample.json` | 样例数据 | 11 条 Projection 状态记录，覆盖 `healthy` / `degraded` / `failed` / `stale` 四种健康状态，涉及 4 场 Race 的 6 种 Projection 类型 |
| 6 | `published-artifacts.sample.json` | 样例数据 | 22 条发布态记录：Result 3 态（published/draft/withdrawn）、Review 2 态、Report 3 态（含 rider_report）、Work 4 种 visibility、Rider Profile 2 态 |
| 7 | `audit-log.sample.json` | 样例数据 | 10 条审计日志，覆盖全部 8 类操作：role_change / admin_login / projection_rebuild / report_regenerate / work_visibility_change / profile_visibility_change / config_update / access_denied |
| 8 | `user-roles.sample.json` | 样例数据 | 15 个用户覆盖所有角色组合：纯 admin、纯 organizer、纯 judge、纯 rider、多角色、无角色、资料未补全 |
| 9 | `profile-completion.sample.json` | 样例数据 | 12 条记录覆盖已补全/部分补全/未补全三种状态 + 全局补全率统计 |
| 10 | `system-config.sample.json` | 样例数据 | 13 个配置项，按 ca_connector / feature_flag / system_param 三类分组 |

## 1.1 可选 admin-shell 页面

| # | 文件名 | 对应模块 | 说明 |
|---|--------|---------|------|
| 11 | `admin-shell/index.html` | 壳框架 | Admin Console 入口，含 sidebar 导航和 Dashboard 内容区 |
| 12 | `admin-shell/dashboard.html` | M2 系统运行仪表盘 | 平台总览卡片、赛事状态分布、热门赛事、CA 全局健康、性能指标 |
| 13 | `admin-shell/users.html` | M1 账号与角色管理 | 用户列表（搜索/筛选）、用户详情、角色授予与撤销（含变更原因）、资料补全状态 |
| 14 | `admin-shell/maintenance.html` | M3 内部数据维护 | Projection 状态查看与重算、公开展示异常处理（隐藏/恢复）、Report 重跑 |
| 15 | `admin-shell/audit-log.html` | M5 审计日志 | 按操作类型/结果筛选、详情展开、8 类操作全量展示 |
| 16 | `admin-shell/config.html` | M4 系统配置 | 功能开关（toggle）、CA Connector 配置、系统参数，按类别分组展示 |

---

# 2. 如何验证交付物已满足管理系统需求

以下验证步骤按从简单到深入的顺序排列，覆盖结构校验、契约一致性和需求覆盖率三个维度。

## 2.1 结构校验 — E 组自动发现

确认 E 组可以自动发现 B 组交付物：

```bash
cd ARY
node scripts/validate-handoffs.js
```

预期输出中 `b-admin` 的 `exists` 为 `true`。其他组（a-rider、c-frontend、d-data）为 `false` 是正常的，表示它们尚未交付。

进一步确认 manifest 声明的所有必需产物都存在：

```bash
node -e "
const fs = require('node:fs');
const m = JSON.parse(fs.readFileSync('deliverables/b-admin/handoff.manifest.json','utf8'));
for (const a of m.artifacts) {
  if (!a.required) continue;
  if (a.path.endsWith('/')) continue;
  const ok = fs.existsSync(a.path);
  console.log((ok ? '✅' : '❌') + ' ' + a.name + ' -> ' + a.path);
}
"
```

期望输出：全部 9 个 required 产物显示 ✅。

## 2.2 JSON 语法校验

确认全部样例 JSON 文件是合法的 JSON：

```bash
node -e "
const fs = require('node:fs');
const files = [
  'deliverables/b-admin/dashboard-overview.sample.json',
  'deliverables/b-admin/projection-status.sample.json',
  'deliverables/b-admin/published-artifacts.sample.json',
  'deliverables/b-admin/audit-log.sample.json',
  'deliverables/b-admin/user-roles.sample.json',
  'deliverables/b-admin/profile-completion.sample.json',
  'deliverables/b-admin/system-config.sample.json',
  'deliverables/b-admin/handoff.manifest.json'
];
let allOk = true;
for (const f of files) {
  try { JSON.parse(fs.readFileSync(f,'utf8')); console.log('✅ ' + f); }
  catch(e) { console.log('❌ ' + f + ': ' + e.message); allOk = false; }
}
console.log(allOk ? '\n全部 JSON 文件语法正确。' : '\n存在非法 JSON 文件！');
"
```

期望输出：全部 8 个文件 ✅。

## 2.3 共享字段字典一致性校验

验证所有样例数据中使用的枚举值符合 `todos/10-Shared-Field-Dictionary.md`：

```bash
node -e "
const fs = require('node:fs');

// 共享枚举定义
const ProjectionHealth = new Set(['healthy','degraded','failed','stale']);
const RaceStatus = new Set(['registration','running','judging','completed','archived','upcoming']);
const WorkVisibility = new Set(['private','review','public','hidden']);
const CAConnectionHealth = new Set(['not_configured','registered','handshaken','active','failed','disabled']);

let ok = true;

// 检查 projection-status
const ps = JSON.parse(fs.readFileSync('deliverables/b-admin/projection-status.sample.json','utf8'));
for (const p of ps.projections) {
  if (!ProjectionHealth.has(p.health)) { console.log('❌ 非法 ProjectionHealth: ' + p.health + ' in ' + p.raceId); ok = false; }
}
console.log('✅ ProjectionHealth 枚举值全部合法（healthy/degraded/failed/stale）');

// 检查 published-artifacts
const pa = JSON.parse(fs.readFileSync('deliverables/b-admin/published-artifacts.sample.json','utf8'));
for (const a of pa.artifacts) {
  if (a.visibility && !WorkVisibility.has(a.visibility)) { console.log('❌ 非法 WorkVisibility: ' + a.visibility + ' in ' + a.artifactId); ok = false; }
}
console.log('✅ WorkVisibility 枚举值全部合法（private/review/public/hidden）');

// 检查 dashboard-overview 中的 status
const dash = JSON.parse(fs.readFileSync('deliverables/b-admin/dashboard-overview.sample.json','utf8'));
for (const s of Object.keys(dash.raceStatusDistribution)) {
  if (!RaceStatus.has(s)) { console.log('❌ 非法 RaceStatus: ' + s); ok = false; }
}
console.log('✅ RaceStatus 枚举值全部合法');

console.log(ok ? '\n共享字段字典一致性校验通过。' : '\n存在不一致！');
"
```

期望输出：三项枚举校验全部通过。

## 2.4 发布态可见性规则校验

验证 `published-artifacts.sample.json` 中的 `isPubliclyVisible` 字段严格遵守 `todos/11-Publication-Visibility-Rules.md`：

```bash
node -e "
const fs = require('node:fs');
const pa = JSON.parse(fs.readFileSync('deliverables/b-admin/published-artifacts.sample.json','utf8'));
let ok = true;
for (const a of pa.artifacts) {
  let expected = false;
  if (a.artifactType === 'work' || a.artifactType === 'rider_profile') expected = a.visibility === 'public';
  else if (a.artifactType === 'result' || a.artifactType === 'review') expected = a.publicationStatus === 'published';
  else if (a.artifactType === 'report') expected = a.publicationStatus === 'published';
  if (a.isPubliclyVisible !== expected) {
    console.log('❌ ' + a.artifactId + ': isPubliclyVisible=' + a.isPubliclyVisible + ' expected=' + expected);
    ok = false;
  }
}
console.log(ok ? '✅ 全部 22 条发布态记录的 isPubliclyVisible 判定与 rules 一致。' : '❌ 存在判定错误！');
"
```

期望输出：全部 22 条记录的判定一致。

## 2.5 需求覆盖校验

验证样例数据是否完整覆盖了 `todos/02-B-Admin-Publishing.md` 的要求：

```bash
node -e "
const fs = require('node:fs');

let ok = true;

// 1. 检查 published-artifacts 覆盖的发布态
const pa = JSON.parse(fs.readFileSync('deliverables/b-admin/published-artifacts.sample.json','utf8'));
const resultStates = [...new Set(pa.artifacts.filter(a=>a.artifactType==='result').map(a=>a.publicationStatus))];
const reviewStates = [...new Set(pa.artifacts.filter(a=>a.artifactType==='review').map(a=>a.publicationStatus))];
const reportStates = [...new Set(pa.artifacts.filter(a=>a.artifactType==='report').map(a=>a.publicationStatus))];
const workVis = [...new Set(pa.artifacts.filter(a=>a.artifactType==='work').map(a=>a.visibility))];
const profileVis = [...new Set(pa.artifacts.filter(a=>a.artifactType==='rider_profile').map(a=>a.visibility))];

console.log('Result states:', resultStates, resultStates.includes('published')&&resultStates.includes('withdrawn') ? '✅' : '❌ 缺少 published/withdrawn');
console.log('Review states:', reviewStates);
console.log('Report states:', reportStates);
console.log('Work visibility:', workVis, workVis.length===4 ? '✅ 四态全覆盖' : '❌');
console.log('Profile visibility:', profileVis);

// 2. 检查 Projection 健康状态
const ps = JSON.parse(fs.readFileSync('deliverables/b-admin/projection-status.sample.json','utf8'));
const healthSet = new Set(ps.projections.map(p=>p.health));
console.log('ProjectionHealth:', [...healthSet], healthSet.size===4 ? '✅ 四态全覆盖' : '❌');

// 3. 检查审计日志操作类型
const al = JSON.parse(fs.readFileSync('deliverables/b-admin/audit-log.sample.json','utf8'));
const actionSet = new Set(al.logs.map(l=>l.actionType));
const required = ['role_change','admin_login','projection_rebuild','report_regenerate','work_visibility_change','profile_visibility_change','config_update','access_denied'];
console.log('AuditLog actions:', [...actionSet], required.every(a=>actionSet.has(a)) ? '✅ 全部 8 类操作覆盖' : '❌');

// 4. 检查 user-roles 角色覆盖
const ur = JSON.parse(fs.readFileSync('deliverables/b-admin/user-roles.sample.json','utf8'));
const allRoles = new Set(ur.users.flatMap(u=>u.roles));
const hasEmpty = ur.users.some(u=>u.roles.length===0);
const hasMulti = ur.users.some(u=>u.roles.length>=2);
console.log('User roles:', [...allRoles], hasEmpty?'✅ 含无角色用户':'❌', hasMulti?'✅ 含多角色用户':'❌');

// 5. 检查 profile-completion 状态覆盖
const pc = JSON.parse(fs.readFileSync('deliverables/b-admin/profile-completion.sample.json','utf8'));
const hasComplete = pc.users.some(u=>u.profileCompleted);
const hasIncomplete = pc.users.some(u=>!u.profileCompleted);
console.log('Profile completion:', hasComplete?'✅ 含已补全':'❌', hasIncomplete?'✅ 含未补全':'❌');

// 6. 检查 system-config 分类覆盖
const sc = JSON.parse(fs.readFileSync('deliverables/b-admin/system-config.sample.json','utf8'));
const cats = new Set(sc.configs.map(c=>c.category));
console.log('Config categories:', [...cats], cats.has('ca_connector')&&cats.has('feature_flag')&&cats.has('system_param')?'✅ 三类全覆盖':'❌');

// 7. 检查 dashboard-overview 必要字段
const dash = JSON.parse(fs.readFileSync('deliverables/b-admin/dashboard-overview.sample.json','utf8'));
const hasOverview = dash.overview && dash.overview.totalUsers > 0;
const hasDist = dash.raceStatusDistribution && Object.keys(dash.raceStatusDistribution).length >= 6;
const hasCA = dash.caHealth && dash.caHealth.totalRegistrations > 0;
const hasPerf = dash.performance && dash.performance.loginSuccessRate !== undefined;
console.log('Dashboard:', hasOverview?'✅ overview':'❌', hasDist?'✅ raceStatusDistribution':'❌', hasCA?'✅ caHealth':'❌', hasPerf?'✅ performance':'❌');
"
```

期望输出：全部检查项均通过 ✅。

## 2.6 admin-shell 页面手动验证

启动单机 Web 应用后，在浏览器中逐页验证：

```bash
# 1. 启动应用
cd ARY
npm run dev

# 2. 浏览器访问以下页面
```

| 页面 | URL | 验证点 |
|------|-----|--------|
| Admin 首页 / Dashboard | `http://127.0.0.1:3000/admin/` | 展示平台总览卡片、赛事分布、CA 健康、性能指标 |
| 用户与角色 | `http://127.0.0.1:3000/admin/users.html` | 用户列表可见、可按角色/资料状态筛选、可弹出角色编辑对话框 |
| 数据维护 | `http://127.0.0.1:3000/admin/maintenance.html` | Projection 列表、重算按钮、Work/Profile 隐藏/恢复按钮、Report 重跑按钮 |
| 审计日志 | `http://127.0.0.1:3000/admin/audit-log.html` | 日志列表、操作类型/结果筛选、详情展开 |
| 系统配置 | `http://127.0.0.1:3000/admin/config.html` | 功能开关 toggle、CA Connector 配置、系统参数展示 |

> **注意**：admin-shell 页面通过 `/api/runtime/assembled-view` 读取数据。如果 assembled-view 中尚无 dashboard / projectionStatuses / publishedArtifacts / auditLogs / systemConfigs 等字段，页面会显示空状态或提示信息。这是预期行为——这些字段需要 E 组在装配时从 B 组 handoff 注入，或 D 组在 authority-mock.json 中补齐。

## 2.7 集成验收（供 E 组使用）

E 组在自动装配时，应额外校验以下规则：

1. **Manifest 完整性**：`deliverables/b-admin/handoff.manifest.json` 中 `required: true` 的产物一个不少。
2. **公开数据隔离**：遍历 `assembled-view.json` 中所有来自 B 组 published-artifacts 的数据，确认 `isPubliclyVisible = false` 的条目未泄露到公开端路由（`/public/`、`/works/`、`/results/`、`/review/`、`/rider/` 对应的数据面）。
3. **原始数据不公开**：公开端数据中不包含 `raw_ca_session`、`raw_riding_record` 等字段。
4. **Projection 非事实源**：Results / Review 页面消费的 Award 和 Report 数据来源不是 Projection。

---

# 3. 与团队其他模块的对接清单

| 消费方 | 需要 B 组提供什么 | 对应文件 |
|--------|------------------|---------|
| C（前端壳） | admin 页面可消费的读取模型定义 | `admin-read-models.md` |
| C（前端壳） | 公开/非公开判定规则 | `published-artifacts.sample.json`（`isPubliclyVisible` 字段）、`maintenance-ops.md`、`todos/11-Publication-Visibility-Rules.md` |
| D（数据层） | authority-mock 中 dashboard / projectionStatuses / publishedArtifacts / auditLogs 的 field spec | `admin-read-models.md` |
| D（数据层） | 用户角色、资料补全、系统配置的样例数据 | `user-roles.sample.json`、`profile-completion.sample.json`、`system-config.sample.json` |
| E（自动集成） | handoff manifest + 全部样例 | `handoff.manifest.json` + 所有 `.sample.json` 和 `.md` 文件 |
| E（自动集成） | 装配后需校验的公开规则 | `maintenance-ops.md` §6、`admin-read-models.md` §7 |
