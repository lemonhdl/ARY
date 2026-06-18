# 单机 Monorepo Web 应用技术路线决策

## 1. 目标

本决策只服务一个目标：让 ARY 第一轮实现、集成、部署都尽量简单。

因此默认采用：

1. 单仓库 `monorepo`
2. 单机部署
3. 单个 Web 应用
4. 单个后端进程
5. 尽量原生、尽量少依赖、尽量少框架

## 2. 总体决策

### 2.1 部署形态

第一轮默认不是多服务系统，不拆独立前端站点、独立 API 服务、独立管理端服务、独立集成服务。

而是统一落成一个单机 Web 应用：

1. 一个进程提供 HTTP 服务。
2. 一个进程同时托管公开端、管理端、Screen 页面和最小 API。
3. 所有页面通过同一个应用访问同一份运行时数据。

### 2.2 仓库形态

统一放在一个 monorepo 中，避免跨仓库同步、版本漂移和部署脚本分裂。

### 2.3 技术栈原则

1. 能用平台原生能力解决，就不用重框架。
2. 能不用第三方依赖，就不用第三方依赖。
3. 能不引入构建链，就不引入构建链。
4. 能通过简单目录约定解决，就不额外引入复杂工程体系。
5. 能通过目录 ownership 降低冲突，就不要让多人长期共改同一实现目录。

### 2.4 协作原则

monorepo 只统一仓库，不等于所有人都直接改同一层运行时代码。

第一轮默认采用 handoff-first 协作方式：

1. A、B、C、D 先在各自 `deliverables/<group>/` 目录内完成产物。
2. E 只读取这些 handoff，不反向要求 1 到 4 人直接改 `app/`、`scripts/`、`runtime-data/`。
3. `app/` 下运行时代码默认由集成壳维护者统一接线，避免多人在同一批页面壳、adapter 和 server 文件上频繁冲突。
4. 如确需把 handoff 提升为正式运行时代码，也应由 E 或明确指定 owner 做一次性合并，不作为日常多人并行开发路径。

## 3. 推荐技术栈

### 3.1 运行时

建议统一使用 Node.js 作为唯一运行时。

原因：

1. 当前仓库已有静态原型和 JS 资产。
2. 前后端都能用同一种语言组织。
3. Node.js 自带 `http`、`fs`、`path`、`url`、`crypto`、`test` 等基础能力，足够覆盖 MVP 第一轮。

### 3.2 前端

前端建议使用：

1. 原生 HTML
2. 原生 CSS
3. 原生 JavaScript ES Modules

不建议第一轮引入：

1. React
2. Vue
3. Next.js
4. Nuxt
5. Vite 绑定型复杂工程结构

如确实需要脚手架，只允许把它当初始化工具，最终运行时仍应尽量保持无框架依赖。

### 3.3 后端

后端建议使用 Node.js 原生模块：

1. `node:http`
2. `node:fs`
3. `node:path`
4. `node:url`
5. `node:crypto`

第一轮不建议引入：

1. Express
2. Koa
3. NestJS
4. Fastify

不是因为它们不能用，而是当前项目最重要的是集成与部署简单，而不是抽象层丰富。

### 3.4 数据存储

第一轮运行态优先建议：

1. 直接消费 D 交付的 `authority-mock.json`
2. 必要时在本地使用简单 JSON 文件作为运行态存储
3. 导入导出都走文件

这意味着：

1. D 原始数据工程中的 PostgreSQL、确定性生成器、schema、seed 仍然有价值
2. 但它们更适合作为离线生成工具或后续增强能力
3. 第一轮部署不应把“必须先起数据库”作为强依赖

## 4. 推荐目录结构

```text
ary/
├─ app/
│  ├─ server/
│  │  ├─ index.js
│  │  ├─ routes/
│  │  ├─ services/
│  │  └─ storage/
│  ├─ web/
│  │  ├─ public/
│  │  ├─ admin/
│  │  ├─ live/
│  │  ├─ screen/
│  │  └─ shared/
│  └─ adapter/
├─ packages/
│  └─ shared-contracts/
├─ runtime-data/
│  ├─ authority-mock.json
│  └─ app-state/
├─ deliverables/
│  ├─ a-rider/
│  ├─ b-admin/
│  │  └─ admin-shell/
│  ├─ c-frontend/
│  │  └─ app-shell/
│  ├─ d-data/
│  └─ e-integration/
├─ todos/
└─ scripts/
```

如果想更简单，也可以不拆 `packages/`，只保留：

1. `app/server`
2. `app/web`
3. `app/adapter`
4. `runtime-data`
5. `deliverables`

## 5. 五组职责如何映射到单机 Web 应用

### 5.1 A 组

A 的真实桌面客户端职责保留。

但在第一轮单机 Web 应用落地时，A 至少要能提供：

1. 可回放样例
2. 本地模拟器输出
3. 可被单机应用导入的事件数据

也就是说，第一轮不要求必须先部署独立桌面客户端，先让单机应用能消费 A 的输入更重要。

目录 ownership：

1. A 默认只改 `deliverables/a-rider/`。
2. 不要求 A 直接改 Web 运行时代码。

### 5.2 B 组

B 的管理域能力直接落在同一个 Web 应用的 admin 路由和服务模块中，不拆成独立后台服务。

目录 ownership：

1. B 默认只改 `deliverables/b-admin/`。
2. 如需交付管理端页面壳或静态资源，放在 `deliverables/b-admin/admin-shell/`。
3. B 不直接改 `app/server/`、`app/adapter/`，由集成层读取 handoff 后接线。

### 5.3 C 组

C 的公开端、Live Hall、Screen Display 都作为同一 Web 应用中的静态页面或模板页面存在。

目录 ownership：

1. C 默认只改 `deliverables/c-frontend/`。
2. 如需交付真实页面壳代码，放在 `deliverables/c-frontend/app-shell/`。
3. C 不直接改 `app/server/`、`scripts/` 或其他组目录。

### 5.4 D 组

D 的 PostgreSQL / generator / export 工程保留为数据生产工具。

但第一轮部署最小闭环里，D 交给应用运行的主入口应是：

`runtime-data/authority-mock.json`

目录 ownership：

1. D 默认只改 `deliverables/d-data/`。
2. 运行态主文件 `runtime-data/authority-mock.json` 由 setup / assemble 流程消费，不要求 D 直接改运行态目录。

### 5.5 E 组

E 的自动集成不再被理解为“独立部署一个集成服务”，而是：

1. 扫描 `deliverables/`
2. 校验 manifest
3. 归一化上游产物
4. 生成运行时可消费数据
5. 写入 `runtime-data/`

可以是同仓库中的脚本、服务模块或启动前装配步骤。

目录 ownership：

1. E 默认负责 `app/server/`、`app/adapter/`、`scripts/` 和 `runtime-data/` 的接线与装配。
2. E 不直接改 A、B、C、D 组目录中的实现细节，只读取他们的 handoff。
3. 如果需要把某组 handoff 提升进正式运行壳，由 E 统一执行并保留来源说明。

## 6. 明确不建议的方向

第一轮不建议走：

1. 微服务
2. 多仓库
3. 前后端完全分离并各自独立部署
4. 为 MVP 引入消息队列
5. 为 MVP 引入容器编排
6. 为 MVP 强制引入数据库集群
7. 为 MVP 引入重型前端框架
8. 为 MVP 引入重型后端框架

## 7. 最小部署目标

一个新同学拿到仓库后，理想上只需要：

1. 安装 Node.js
2. 拉取仓库
3. 准备好 `runtime-data/authority-mock.json` 或运行一次装配脚本
4. 执行一个启动命令
5. 打开浏览器访问本机地址

如果第一轮做不到这个程度，就说明实现和部署仍然太复杂。

## 8. 推荐启动方式

目标应该尽量收敛到这种体验：

```text
npm run setup
npm run dev
```

或者更进一步：

```text
npm run start
```

其中：

1. `setup` 只负责准备本地运行数据
2. `dev` 启动单个 Node.js 进程
3. `start` 用于最简部署启动

## 9. 对现有任务包的执行含义

1. `todos/18-Architecture-Component-Diagram.md` 中的逻辑组件保留，但部署上应收口为一个单机应用。
2. `todos/03-C-Frontend-Shell.md` 应优先按原生 HTML / CSS / JS 实现页面壳。
3. `todos/04-D-Authority-Mock-Data.md` 应把 `authority-mock.json` 作为第一轮运行时主入口，而不是让数据库成为部署前置条件。
4. E 的自动集成优先实现为仓库内脚本或同进程模块，而不是独立服务。