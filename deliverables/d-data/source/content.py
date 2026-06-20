# -*- coding: utf-8 -*-
"""
content.py —— D 组数据层的「内容池 / 领域素材」单一来源。

设计目标:
1. 所有真实风格中文文案、赛事定义、骑手名册、技能标签、事件模板都集中在这里。
2. generate.py 只负责「按不变量把这些素材编织成事实链」,不在生成逻辑里散落硬编码文案。
3. 全部为纯数据(无随机、无时间),保证确定性、可重复、可提交、可 diff。

赛事集合刻意对齐 design-prototype/data/sample-races.json 的 id / title / domain / summary,
以便 C 组前端「零改动或低改动」消费;同时把生命周期补齐为
registration / running / judging / completed / archived / upcoming 全覆盖。
"""

# 时间基准:确定性生成的统一锚点(不使用 now(),保证可 diff)
TIME_BASE = "2026-06-14T13:58:00+08:00"
GENERATED_AT = "2026-06-14T06:00:00.000Z"   # UTC,对应离线生成快照时刻

CONTRACT_VERSION = "0.1.0"
DATA_VERSION = "0.1.0"

# --------------------------------------------------------------------------- #
# 1. 八场赛事:覆盖 registration / running / judging / completed / archived / upcoming
# --------------------------------------------------------------------------- #
# 字段说明:
#   lifecycle 元信息 + 前端展示字段(stageLabel/summary/challenge/cta/heroUse/schedule/metrics)
#   plan: 生成器据此扩展事实链的规模与形态
RACES = [
    {
        "id": "bay-area-happy-trip",
        "slug": "bay-area-happy-trip",
        "title": "湾区开心游",
        "domain": "travel-local-life",
        "status": "running",
        "stageLabel": "进行中 / Live",
        "summary": "构建大湾区旅行、游玩伴随 Agent,像你身边手头的旅行达人和本地精英,让用户无所不知、玩得尽兴。",
        "challenge": "让 Agent 能理解用户偏好、实时位置、预算、交通、天气和本地文化,生成可信、好玩、可执行的旅行陪伴方案。",
        "primaryCta": "进入 Live Hall",
        "secondaryCta": "查看参赛作品",
        "heroUse": "Home featured race / Live Hall / Screen Display",
        "schedule": {"registration": "已结束", "race": "进行中", "submission": "开放中", "judging": "排队中", "results": "未发布"},
        "metrics": {"riders": 36, "activeRiders": 27, "sessions": 188, "submittedWorks": 14, "publicWorks": 0, "reports": 0, "evidenceRefs": 206},
        "awards": ["最佳旅行体验", "最佳本地洞察", "最佳实时规划", "最佳游玩复盘"],
        "live": {"ridingSignal": 82, "submitLeft": "02:18:44", "totalCost": "$512.70", "riskSignals": 5, "costWatchRiders": 3},
        "featured": True,
    },
    {
        "id": "smart-investment-analyst",
        "slug": "smart-investment-analyst",
        "title": "智能投研助理",
        "domain": "finance",
        "status": "running",
        "stageLabel": "进行中 / Live",
        "summary": "面向个人投资学习者的资料整理、术语解释、公司信息摘要和风险提示 Agent。",
        "challenge": "构建能帮助用户理解金融材料、整理风险点和形成学习笔记的投研辅助 Agent,不替代专业投资建议。",
        "primaryCta": "进入 Live Hall",
        "secondaryCta": "查看风险提示样例",
        "heroUse": "Hero live switcher secondary race / Risk-heavy Live Hall variant",
        "schedule": {"registration": "已结束", "race": "进行中", "submission": "开放中", "judging": "排队中", "results": "未发布"},
        "metrics": {"riders": 28, "activeRiders": 21, "sessions": 164, "submittedWorks": 9, "publicWorks": 0, "reports": 0, "evidenceRefs": 171},
        "awards": ["最佳风险表达", "最佳资料整理", "最佳学习笔记"],
        "live": {"ridingSignal": 76, "submitLeft": "03:02:10", "totalCost": "$438.20", "riskSignals": 8, "costWatchRiders": 2},
        "safetyNotes": ["只做信息整理、术语解释和风险提示;不输出直接买卖建议。"],
        "safetySensitive": True,
    },
    {
        "id": "media-ops-agent",
        "slug": "media-ops-agent",
        "title": "自媒体运营 Agent",
        "domain": "content-ops",
        "status": "judging",
        "stageLabel": "评审中",
        "summary": "开发一款可帮助主人规划选题、生成内容、发布排期、复盘数据和维护品牌语气的自媒体运营 Agent。",
        "challenge": "让 Agent 像运营助理一样持续协助内容生产和复盘,而不是只生成一次文案。",
        "primaryCta": "查看评审进度",
        "secondaryCta": "查看提交作品",
        "heroUse": "Judge View / Works / Review draft",
        "schedule": {"registration": "已结束", "race": "已完成", "submission": "已锁定", "judging": "进行中", "results": "待发布"},
        "metrics": {"riders": 32, "activeRiders": 0, "sessions": 219, "submittedWorks": 27, "publicWorks": 0, "reports": 0, "evidenceRefs": 238},
        "awards": ["最佳运营闭环", "最佳品牌语气", "最佳数据复盘"],
    },
    {
        "id": "merchant-copilot",
        "slug": "merchant-copilot",
        "title": "网商经营 Copilot",
        "domain": "e-commerce",
        "status": "registration",
        "stageLabel": "报名中",
        "summary": "帮助小商家做选品、上架、客服、促销、复盘和库存提醒的网商经营 Agent。",
        "challenge": "让 Agent 成为小店主的运营副驾,能把商品、客户、内容和经营指标串起来。",
        "primaryCta": "立即报名",
        "secondaryCta": "查看赛题",
        "heroUse": "Registration Open / Home CTA",
        "schedule": {"registration": "开放中", "race": "未开始", "submission": "未开始", "judging": "未开始", "results": "未发布"},
        "metrics": {"riders": 0, "applicants": 41, "capacity": 60, "sessions": 0, "submittedWorks": 0},
        "awards": ["最佳经营闭环", "最佳客服体验", "最佳上架自动化"],
    },
    {
        "id": "health-habit-coach",
        "slug": "health-habit-coach",
        "title": "健康习惯教练",
        "domain": "health",
        "status": "registration",
        "stageLabel": "报名中",
        "summary": "帮助用户制定运动、睡眠、饮食和复盘计划的健康习惯陪伴 Agent。",
        "challenge": "构建一个长期陪伴型 Agent,帮助用户记录目标、跟踪习惯、生成反馈,但不提供医疗诊断。",
        "primaryCta": "立即报名",
        "secondaryCta": "查看安全边界",
        "heroUse": "Registration Open / Public conversion",
        "schedule": {"registration": "开放中", "race": "未开始", "submission": "未开始", "judging": "未开始", "results": "未发布"},
        "metrics": {"riders": 0, "applicants": 33, "capacity": 50, "sessions": 0, "submittedWorks": 0},
        "safetyNotes": ["只做习惯记录、计划建议和反馈提醒;不做诊断或治疗建议。"],
        "safetySensitive": True,
    },
    {
        "id": "gov-service-navigator",
        "slug": "gov-service-navigator",
        "title": "政务办事导航 Agent",
        "domain": "e-government",
        "status": "completed",
        "stageLabel": "已结束 / 赛果已发布",
        "summary": "帮助居民理解办事流程、材料清单、办理条件和进度提醒的政务流程导航 Agent。",
        "challenge": "把复杂政策流程转成清晰、可信、可执行的办事导航,不代办敏感事项。",
        "primaryCta": "查看赛果",
        "secondaryCta": "查看 Review",
        "heroUse": "Latest Results / Serious-domain case",
        "schedule": {"registration": "已结束", "race": "已完成", "submission": "已锁定", "judging": "已完成", "results": "已发布"},
        "metrics": {"riders": 24, "activeRiders": 0, "sessions": 137, "submittedWorks": 19, "publicWorks": 12, "reports": 24, "evidenceRefs": 148},
        "awards": ["最佳可信流程", "最佳材料清单", "最佳进度提醒"],
        "safetyNotes": ["只做流程导航和材料清单辅助;不替代官方办理和最终审核。"],
        "safetySensitive": True,
    },
    {
        "id": "genesis-dogfood-race",
        "slug": "genesis-dogfood-race",
        "title": "创世骑行挑战赛",
        "domain": "self-dogfood",
        "status": "archived",
        "stageLabel": "创世案例 / 已归档",
        "summary": "参赛者骑行 Coding Agent 打造 ARY 的第一场创世赛,从混乱起跑到作品冲线,形成平台自己的开场故事;现已归档为创世资产。",
        "challenge": "用 Agent 协作开发 ARY 自身,让平台从第一场 self-dogfood Race 中诞生。",
        "primaryCta": "查看创世复盘",
        "secondaryCta": "查看优秀作品",
        "heroUse": "Archived genesis asset / Results / Review / Rider Profile",
        "schedule": {"registration": "已结束", "race": "已完成", "submission": "已锁定", "judging": "已完成", "results": "已发布(已归档)"},
        "metrics": {"riders": 18, "activeRiders": 0, "sessions": 143, "submittedWorks": 12, "publicWorks": 8, "reports": 18, "evidenceRefs": 164},
        "awards": ["最佳自举作品", "最佳领域拆解", "最佳复盘"],
        "notes": ["归档赛事,仍保留已发布的公开资产;不作为 running 主赛事。"],
        "archivedAt": "2026-05-30T12:00:00+08:00",
    },
    {
        "id": "medical-followup-assistant",
        "slug": "medical-followup-assistant",
        "title": "医疗随访助手",
        "domain": "medical",
        "status": "upcoming",
        "stageLabel": "即将开放 / 高敏边界",
        "summary": "帮助患者整理随访问题、用药提醒、复诊材料和健康记录的医疗随访辅助 Agent。",
        "challenge": "在高敏场景中训练 Agent 的解释边界、记录能力和低风险辅助,不做诊断。",
        "primaryCta": "订阅开放提醒",
        "secondaryCta": "查看安全说明",
        "heroUse": "Upcoming / Safety-boundary example / Empty-riding sample",
        "schedule": {"registration": "即将开放", "race": "未开始", "submission": "未开始", "judging": "未开始", "results": "未发布"},
        "metrics": {"riders": 0, "watchers": 96, "capacity": 40, "sessions": 0, "submittedWorks": 0},
        "safetyNotes": ["不做诊断;不替代医生;只做随访准备、提醒和记录整理。"],
        "safetySensitive": True,
        "emptyRidingSample": True,
    },
]

# --------------------------------------------------------------------------- #
# 2. 骑手名册(GitHub 登录风格 + 中文展示名)与组织
# --------------------------------------------------------------------------- #
RIDER_POOL = [
    ("rider-mira", "mira-chen", "Mira Chen", "陈思源", "HKU CS"),
    ("rider-ana", "ana-ruiz", "Ana Ruiz", "阮安娜", "SZU Design Lab"),
    ("rider-jun", "jun-park", "Jun Park", "朴俊", "CUHK Shenzhen"),
    ("rider-rae", "rae-stone", "Rae Stone", "石蕾", "GBA Builder Club"),
    ("rider-owen", "owen-xu", "Owen Xu", "徐欧文", "FinTech Studio"),
    ("rider-sara", "sara-li", "Sara Li", "李莎", "Creator Lab"),
    ("rider-nina", "nina-cho", "Nina Cho", "赵妮娜", "Quant Reading Group"),
    ("rider-leo", "leo-wang", "Leo Wang", "王乐", "Open Civic Lab"),
    ("rider-iris", "iris-tan", "Iris Tan", "谭一然", "City Service Studio"),
    ("rider-kai", "kai-zhou", "Kai Zhou", "周凯", "Health Builders"),
    ("rider-vera", "vera-mok", "Vera Mok", "莫薇", "Care Systems Lab"),
    ("rider-tom", "tom-ho", "Tom Ho", "何同", "Indie Merchant Guild"),
]

ORGANIZER = ("user-org-genesis", "ary-genesis-ops", "ARY 赛事运营官", "组委会", "ARY Organizing Committee")
JUDGES = [
    ("user-judge-lin", "judge-lin", "Lin Zhao", "赵琳", "Domain Review Panel"),
    ("user-judge-park", "judge-park", "David Park", "朴大卫", "Engineering Review Panel"),
    ("user-judge-mei", "judge-mei", "Mei Sun", "孙梅", "Trust & Safety Panel"),
]
ADMIN = ("user-admin-root", "ary-admin", "ARY 系统管理员", "平台管理员", "ARY Platform Ops")

SKILL_TAGS = {
    "travel-local-life": ["local reasoning", "route planning", "prompt debugging", "itinerary planning", "evidence summary"],
    "finance": ["financial literacy", "risk explanation", "retrieval", "summary clarity", "compliance boundary"],
    "content-ops": ["content workflow", "brand voice", "analytics", "scheduling", "review writing"],
    "e-commerce": ["catalog automation", "customer support", "promotion design", "inventory alert"],
    "health": ["habit tracking", "feedback loop", "plan shaping", "safety boundary"],
    "e-government": ["process decomposition", "trusted sourcing", "material checklist", "progress reminder"],
    "self-dogfood": ["race shaping", "design systems", "tool orchestration", "review writing"],
    "medical": ["followup prep", "medication reminder", "record organizing", "safety boundary"],
}

# --------------------------------------------------------------------------- #
# 3. 实时事件 / Projection 事件流模板(脱敏后可进 Live Hall,不含原始 CA Session)
# --------------------------------------------------------------------------- #
EVENT_TEMPLATES = {
    "session_summary": ["{name} 完成偏好建模和路线生成 checkpoint。", "{name} 完成财报摘要和风险点解释。", "{name} 完成一轮内容选题与排期复盘。"],
    "risk": ["{name} 进入 cost watch,但仍保持 active。", "{name} 触发风险提示,已记录到风险面板。"],
    "work": ["{title} 提交第一版 Demo。", "{title} 更新提交并补充证据引用。"],
    "idle": ["{name} {minutes} 分钟无新 Session Summary。"],
    "safety": ["系统提示:不得输出直接买卖建议。", "系统提示:高敏场景仅做信息整理,不做诊断。"],
}

# 评审 / 复盘 文案模板
JUDGE_COMMENTS = {
    "genesis-dogfood-race": [
        "最有价值的是把混乱起跑跑成了能被观看、被追赶、被继续讲述的赛场作品。",
        "ARY 自己成为第一批作品,这是创世赛最好的开场。",
    ],
    "gov-service-navigator": [
        "优秀作品没有试图代替官方办理,而是把流程理解和材料准备做得更清楚。",
        "可信来源回链和材料清单显著降低了政务办事的理解成本。",
    ],
}
REVIEW_SUMMARY = {
    "genesis-dogfood-race": "创世骑行挑战赛从混乱起跑到作品冲线,留下了第一批可以被观看、被讲述、被继续追赶的赛场片段,现已归档为创世资产。",
    "gov-service-navigator": "政务办事导航 Agent 展示了 ARY 在严肃流程场景中的价值:流程拆解、可信引用和风险边界表达。",
}
AWARD_REASONS = {
    "genesis-dogfood-race": "第一场创世赛跑出了平台自己的起点,也留下了可以反复观看的冲线样本。",
    "gov-service-navigator": "以官方来源回链、流程解释和材料清单降低政务办事理解成本。",
}
