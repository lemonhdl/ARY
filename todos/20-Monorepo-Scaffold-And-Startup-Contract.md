# Monorepo 目录骨架与启动约定

本文是在 `19-Monorepo-Single-Machine-Web-Decision.md` 之上继续往前推进的一步。目标不是讨论技术路线，而是把“单机 monorepo Web 应用”收敛成一套所有人都能照着落地的最小工程骨架。

## 1. 目标

第一轮工程骨架必须满足：

1. 新同学一眼能看懂目录。
2. A、B、C、D、E 的产物有明确落点。
3. 启动命令尽量统一成 1 到 2 条。
4. 不要求先起数据库。
5. 不要求先部署多服务。
6. 日常并行开发时尽量让每位同学只改自己目录，避免在同一批运行时代码文件上反复冲突。

## 2. 推荐目录结构

```text
ary/
├─ app/
│  ├─ server/
│  │  ├─ index.js
│  │  ├─ router.js
│  │  ├─ routes/
│  │  │  ├─ public.js
│  │  │  ├─ admin.js
│  │  │  ├─ live.js
│  │  │  ├─ screen.js
│  │  │  └─ api.js
│  │  ├─ services/
│  │  │  ├─ manifest-discovery.js
│  │  │  ├─ integration-service.js
│  │  │  ├─ publication-service.js
│  │  │  └─ runtime-store.js
│  │  └─ utils/
│  ├─ web/
│  │  ├─ public/
│  │  ├─ admin/
│  │  ├─ live/
│  │  ├─ screen/
│  │  ├─ assets/
│  │  └─ shared/
│  └─ adapter/
│     ├─ index.js
│     ├─ race-adapter.js
│     ├─ live-adapter.js
│     ├─ works-adapter.js
│     ├─ results-adapter.js
│     ├─ review-adapter.js
│     └─ profile-adapter.js
├─ runtime-data/
│  ├─ authority-mock.json
│  ├─ assembled-view.json
│  ├─ compatibility-report.json
│  └─ app-state/
├─ deliverables/
│  ├─ a-rider/
│  ├─ b-admin/
│  │  └─ admin-shell/
│  ├─ c-frontend/
│  │  └─ app-shell/
│  ├─ d-data/
│  └─ e-integration/
├─ scripts/
│  ├─ setup-runtime.js
│  ├─ assemble.js
│  ├─ validate-handoffs.js
│  └─ export-runtime.js
├─ docs/
├─ todos/
├─ package.json
└─ README.md
```

## 3. 为什么这样分

### 3.1 `app/server/`

只放单机 Web 应用运行所需的服务端代码。

职责：

1. 启动 HTTP 服务。
2. 托管静态页面和静态资源。
3. 暴露最小 API。
4. 读取 `runtime-data/`。

编辑纪律：

1. 默认只允许 E 维护这里的集成壳代码。
2. A、B、C、D 不把这里当日常并行开发目录。

### 3.2 `app/web/`

只放页面壳。

职责：

1. public 页面。
2. admin 页面。
3. live 页面。
4. screen 页面。
5. 共用前端资源。

编辑纪律：

1. 这里默认只保留已经接线完成、准备被单机应用直接托管的运行时代码。
2. 上游同学先在各自 `deliverables/` 目录提交页面壳，再由集成层决定何时提升进这里。

### 3.3 `app/adapter/`

只放页面层消费的数据适配器。

职责：

1. 把 `runtime-data/assembled-view.json` 转成页面可以直接消费的对象。
2. 做最小 fallback。
3. 不直接读 `deliverables/` 下上游原始 handoff。

编辑纪律：

1. 默认只允许 E 维护 adapter 接线。
2. 上游同学通过 `adapter-contract.md` 描述输入，而不是直接多人共改这里。

### 3.4 `runtime-data/`

这是第一轮运行时中心。

职责：

1. 保存 D 的 `authority-mock.json`。
2. 保存 E 装配后的统一运行视图。
3. 保存兼容性报告和临时状态。

### 3.5 `scripts/`

把“装配”和“启动”分开。

职责：

1. `setup-runtime.js`：准备运行态文件。
2. `assemble.js`：扫描 `deliverables/` 并生成 `assembled-view.json`。
3. `validate-handoffs.js`：校验 manifest 和必需产物。
4. `export-runtime.js`：导出或刷新运行时数据。

编辑纪律：

1. 默认只允许 E 维护这里。
2. 其他同学如需新增装配输入，改自己组的 handoff 契约，不直接改装配脚本。

### 3.6 `deliverables/`

这是并行开发的主战场。

职责：

1. 每位同学只在自己的组目录内提交实现产物。
2. 需要代码时，也优先把代码放在自己组目录下，例如 `deliverables/b-admin/admin-shell/`、`deliverables/c-frontend/app-shell/`。
3. E 只读取这里的 handoff 做自动校验和自动装配。

编辑纪律：

1. A 只改 `deliverables/a-rider/`。
2. B 只改 `deliverables/b-admin/`。
3. C 只改 `deliverables/c-frontend/`。
4. D 只改 `deliverables/d-data/`。
5. E 只改 `deliverables/e-integration/` 以及集成壳目录。
6. 非本组目录原则上不改；确需跨组改动时，应先把共用规则沉淀到公共契约文档。

## 4. 五组产物如何映射

### 4.1 A 组

仍然把正式 handoff 放在：

`deliverables/a-rider/`

但单机应用运行时不直接消费这里的所有原始文件，而是由 E 的装配脚本归一化后写入：

`runtime-data/assembled-view.json`

### 4.2 B 组

正式 handoff 放在：

`deliverables/b-admin/`

其发布态、可见性、Dashboard 等规则由 E 装配后进入运行态。

如需交付管理端页面壳、只读样例或静态资源，也放在 `deliverables/b-admin/` 内部子目录，不直接散落到 `app/`。

### 4.3 C 组

C 组的页面壳正式代码建议落在：

`deliverables/c-frontend/app-shell/`

如果还处在 handoff 阶段，可以先放：

`deliverables/c-frontend/`

当集成层确认某批页面壳已稳定可托管时，再由明确 owner 提升到 `app/web/`。

### 4.4 D 组

D 组权威主文件进入：

`runtime-data/authority-mock.json`

而不是让应用运行时再自己去翻复杂数据工程目录。

但 D 日常提交仍优先放在 `deliverables/d-data/`，由 setup / assemble 流程刷新运行态文件。

### 4.5 E 组

E 组主要落两处：

1. `scripts/` 中的装配脚本。
2. `app/server/services/` 中的运行时装配服务。

同时 E 负责把上游 handoff 接进正式运行壳，尽量保证 1 到 4 人不需要频繁编辑同一运行时代码目录。

## 5. 最小启动约定

目标是尽量统一成下面三类命令：

```text
npm run setup
npm run dev
npm run start
```

### 5.1 `npm run setup`

职责：

1. 检查 `runtime-data/authority-mock.json` 是否存在。
2. 检查 `deliverables/*/handoff.manifest.json`。
3. 生成初始 `runtime-data/assembled-view.json`。

### 5.2 `npm run dev`

职责：

1. 先执行一次运行态装配。
2. 启动单机 Node.js Web 服务。
3. 本机打开后即可访问页面。

### 5.3 `npm run start`

职责：

1. 在运行态文件已准备好的前提下，直接启动单机 Web 服务。

## 6. 推荐 `package.json` 脚本契约

```json
{
  "scripts": {
    "setup": "node scripts/setup-runtime.js",
    "validate": "node scripts/validate-handoffs.js",
    "assemble": "node scripts/assemble.js",
    "dev": "node scripts/assemble.js ; node app/server/index.js",
    "start": "node app/server/index.js"
  }
}
```

说明：

1. 这里只定义最小契约，不要求实现者一字不差照抄。
2. 但命令职责应尽量保持一致。
3. 如果后续要加 watcher 或更好的本地体验，也不应破坏这套最小命令语义。

## 7. 页面与路由建议

建议最小收口为：

1. `/`：Home / Race Gallery
2. `/race/:raceId`
3. `/live/:raceId`
4. `/works`
5. `/works/:workId`
6. `/results/:raceId`
7. `/review/:raceId`
8. `/rider/:riderId`
9. `/cooperation`
10. `/admin`
11. `/screen/:raceId`
12. `/api/*`

## 8. 运行时数据契约

应用运行时建议只认两类主文件：

1. `runtime-data/authority-mock.json`
2. `runtime-data/assembled-view.json`

其中：

1. 前者是 D 提供的权威底座。
2. 后者是 E 装配后的页面消费入口。

这样可以避免：

1. 页面直接读上游散文件。
2. 服务启动时动态扫描太多目录。
3. 部署时必须附带全套离线数据工程。

## 9. 明确不建议的工程做法

1. 不建议把 public、admin、live、screen 拆成 4 个独立前端项目。
2. 不建议把装配逻辑拆成独立网络服务。
3. 不建议为了 MVP 引入繁重构建链。
4. 不建议让应用启动依赖 PostgreSQL 已经运行。
5. 不建议让页面直接读取 `deliverables/` 下的原始 handoff 文件。

## 10. 实施优先级

### 第 1 步

先把目录骨架和脚本契约定下来。

### 第 2 步

先让 `runtime-data/authority-mock.json` 和 `assembled-view.json` 跑通。

### 第 3 步

再把 C 的页面壳挂到单机服务上。

### 第 4 步

最后才逐步把 A、B、D 的真实交付替换进来。

## 11. 对五组的直接要求

1. A 不要假设自己输出会被页面直接读取。
2. B 不要假设管理域规则会以独立服务方式部署。
3. C 不要假设会有单独前端工程或复杂框架支撑。
4. D 不要假设数据库一定在线才能启动产品。
5. E 不要把自动集成做成比主应用还重的系统。