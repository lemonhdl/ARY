# ARY 架构图与组件图

本文给 A、B、C、D、E 五组一个统一的系统视图。用途不是替代任务文档，而是帮助所有人快速确认：

1. 自己所在的组件位置。
2. 数据和责任如何流动。
3. 为什么要用 shared contract、handoff manifest、authority mock 和 adapter。

## 1. 总体逻辑架构图

```mermaid
flowchart LR
    subgraph U[用户与使用场景]
        Public[Public Audience]
        Rider[Rider]
        Admin[Admin / Organizer]
        Screen[Venue Screen]
    end

    subgraph A[A 组 Rider 客户端]
        Desktop[DCR Desktop App]
        Events[Riding Signals / Session Snapshot / Signature]
    end

    subgraph B[B 组管理系统]
        AdminModel[Admin Read Models]
        PublishGov[Publication / Visibility Governance]
        Audit[Audit / Maintenance / Config]
    end

    subgraph D[D 组数据层]
        DataEngine[Deterministic Data Engine]
        FactData[Core Facts / Read Models]
        AuthorityMock[Authority Mock]
        FrontendExport[Frontend-Compatible Export]
    end

    subgraph E[E 组自动集成]
        Discover[Manifest Discovery]
        Validate[Contract Validation]
        Assemble[Assembly / Normalization]
        Fallback[Fallback Handling]
    end

    subgraph C[C 组前端产品壳]
        Adapter[Adapter Layer]
        PublicShell[Public Site / Race / Works / Results / Review / Rider]
        LiveShell[Live Hall]
        ScreenShell[Screen Display]
    end

    Public --> PublicShell
    Rider --> Desktop
    Admin --> AdminModel
    Screen --> ScreenShell

    Desktop --> Events
    Events --> Discover

    AdminModel --> PublishGov
    PublishGov --> Discover
    Audit --> Discover

    DataEngine --> FactData
    FactData --> AuthorityMock
    FactData --> FrontendExport
    AuthorityMock --> Discover
    FrontendExport --> Discover

    Discover --> Validate --> Assemble --> Fallback --> Adapter

    Adapter --> PublicShell
    Adapter --> LiveShell
    Adapter --> ScreenShell

    PublishGov -.公开判断规则.-> Adapter
    AuthorityMock -.统一数据面.-> Adapter
```

## 2. 组件职责图

```mermaid
flowchart TB
    Shared[Shared Contracts\n10 Shared Field Dictionary\n11 Publication Visibility Rules\n12 Authority Mock Spec\n13 Product Shell Adapter Spec\n14 Handoff Manifest Spec]

    AComp[A 组\nRider Client\n握手 / Push / Fetch / 签名 / 防重放]
    BComp[B 组\nAdmin Domain\nRoles / Dashboard / Maintenance / Audit / Config]
    CComp[C 组\nFrontend Shell\nPublic Pages / Live Hall / Screen Display]
    DComp[D 组\nData Layer\nDeterministic Generator / DB Lifecycle / Exports / Authority Mock]
    EComp[E 组\nAuto Integration\nDiscover / Validate / Compose / Fallback / Acceptance]

    Shared --> AComp
    Shared --> BComp
    Shared --> CComp
    Shared --> DComp
    Shared --> EComp

    AComp --> AHandoff[deliverables/a-rider\nhandoff.manifest.json\n事件样例 / 状态样例 / 签名样例]
    BComp --> BHandoff[deliverables/b-admin\nhandoff.manifest.json\n读模型样例 / 发布治理 / 审计样例]
    CComp --> CHandoff[deliverables/c-frontend\nhandoff.manifest.json\nroute / adapter / fallback / shell]
    DComp --> DHandoff[deliverables/d-data\nhandoff.manifest.json\nauthority mock / schema / mapping / source]

    AHandoff --> EComp
    BHandoff --> EComp
    CHandoff --> EComp
    DHandoff --> EComp

    EComp --> FinalAssembly[deliverables/e-integration\nassembly / compatibility report / fallback report / acceptance checklist]
```

## 3. 运行时读取关系图

```mermaid
flowchart LR
    RawA[A 组输入\nRiding Events / CA Status / Signature Samples]
    RawB[B 组输入\nDashboard / Publication / Visibility / Audit Samples]
    RawD[D 组输入\nAuthority Mock / Frontend Export / Optional DB Source]

    Integrator[E 组装配层]
    Adapter[C 组 Adapter]
    Pages[C 组页面壳]

    RawA --> Integrator
    RawB --> Integrator
    RawD --> Integrator
    Integrator --> Adapter
    Adapter --> Pages
```

这个图表达三个硬约束：

1. 页面层不直接读 A、B 的原始样例。
2. E 不直接改页面结构，只提供装配后的输入。
3. D 的 authority mock 是第一轮主数据面，但仍允许 E 注入 A、B 的 handoff 做统一验证和补齐。

## 4. 公开规则与事实边界

```mermaid
flowchart TB
    CA[Raw CA Session / Riding Signals]
    Projection[Projection / Live Process Views]
    Fact[Fact Data\nAwards / Reports / Published Works / Published Reviews]
    PublicSite[Public Site]
    AdminConsole[Admin Console]

    CA --> Projection
    CA --> AdminConsole
    Fact --> AdminConsole
    Fact --> PublicSite
    Projection --> PublicSite

    CA -.默认不公开.-> PublicSite
    Projection -.不是最终事实源.-> Fact
```

解释：

1. 原始 CA Session 默认不进公开端。
2. Projection 只服务过程展示，如 Live Hall / Screen Display。
3. Results / Review / Published Work / Public Profile 这类公开资产，必须以事实数据和发布态规则为准。

## 5. 组件落地建议

1. A、B、D 的交付要优先保证 manifest 完整和样例可消费，否则 E 无法自动发现。
2. C 的页面壳要优先围绕 adapter 边界收口，不要再让页面直接读散落 JSON。
3. E 的组装逻辑要以 contract 校验为第一步，不能先拼页面再补规范。
4. 如果需要一张给组员开会时快速讲解的图，优先使用本文第 2 节组件职责图。

## 6. 单机 Monorepo 部署图

```mermaid
flowchart TB
    Browser[Browser]

    subgraph Repo[Monorepo]
        subgraph App[Single Web App Process]
            Server[Node.js Native HTTP Server]
            PublicPages[Public / Race / Works / Results / Review / Profile]
            AdminPages[Admin Pages]
            LivePages[Live Hall / Screen Display]
            Adapter[Adapter / Normalizer]
            RuntimeStore[Runtime Data Store]
        end

        Deliverables[deliverables/*\nA / B / C / D handoff]
        Integrator[E Integration Script / Module]
        Mock[D authority-mock.json]
    end

    Browser --> Server
    Server --> PublicPages
    Server --> AdminPages
    Server --> LivePages
    Server --> Adapter
    Adapter --> RuntimeStore

    Deliverables --> Integrator
    Mock --> Integrator
    Integrator --> RuntimeStore
```

这个部署图强调的是：

1. 逻辑上仍然有 A、B、C、D、E 分工。
2. 但运行和部署上尽量收口到一个 monorepo、一个进程、一个 Web 应用。
3. 自动集成更适合作为仓库内脚本或同进程模块，而不是额外服务。