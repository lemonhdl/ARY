window.ARY_SAMPLE_DATA = {
  "metadata": {
    "name": "ARY Genesis Race Series sample data",
    "version": "0.1",
    "purpose": "ARY high-fidelity prototype sample data, not a production schema",
    "primaryViewport": "1920x1080",
    "statusSet": ["registration", "running", "judging", "completed", "archived", "upcoming"]
  },
  "series": {
    "title": "ARY Genesis Race Series",
    "subtitle": "智能体骑场 / 创世骑行系列赛",
    "tagline": "Ride Agents. Build the Future.",
    "positioning": "通过多领域 Agent Racing，让真实项目、过程证据、作品资产和能力标签被看见。"
  },
  "raceGroups": {
    "featuredRaceId": "bay-area-happy-trip",
    "liveRaceIds": ["bay-area-happy-trip", "smart-investment-analyst"],
    "registrationRaceIds": ["merchant-copilot", "health-habit-coach"],
    "judgingRaceIds": ["media-ops-agent"],
    "completedRaceIds": ["genesis-dogfood-race", "gov-service-navigator"],
    "upcomingRaceIds": ["medical-followup-assistant"]
  },
  "races": [
    {
      "id": "genesis-dogfood-race",
      "slug": "genesis-dogfood-race",
      "title": "创世骑行挑战赛",
      "domain": "self-dogfood",
      "status": "completed",
      "stageLabel": "创世案例 / 已完成",
      "summary": "参赛者骑行 Coding Agent 打造 ARY 的第一场创世赛，从混乱起跑到作品冲线，形成平台自己的开场故事。",
      "challenge": "用 Agent 协作开发 ARY 自身，让平台从第一场 self-dogfood Race 中诞生。",
      "primaryCta": "查看创世复盘",
      "secondaryCta": "查看优秀作品",
      "heroUse": "Latest Results / Review / Rider Profile",
      "schedule": {
        "registration": "已结束",
        "race": "已完成",
        "submission": "已锁定",
        "judging": "已完成",
        "results": "已发布"
      },
      "metrics": {
        "riders": 18,
        "activeRiders": 0,
        "sessions": 143,
        "submittedWorks": 12,
        "publicWorks": 8,
        "reports": 18,
        "evidenceRefs": 164
      },
      "awards": ["最佳自举作品", "最佳领域拆解", "最佳复盘"],
      "notes": ["不能作为 running 主赛事；它是 ARY 存在之后的创世复盘资产。"]
    },
    {
      "id": "media-ops-agent",
      "slug": "media-ops-agent",
      "title": "自媒体运营 Agent",
      "domain": "content-ops",
      "status": "judging",
      "stageLabel": "评审中",
      "summary": "开发一款可帮助主人规划选题、生成内容、发布排期、复盘数据和维护品牌语气的自媒体运营 Agent。",
      "challenge": "让 Agent 像运营助理一样持续协助内容生产和复盘，而不是只生成一次文案。",
      "primaryCta": "查看评审进度",
      "secondaryCta": "查看提交作品",
      "heroUse": "Judge View / Works / Review draft",
      "schedule": {
        "registration": "已结束",
        "race": "已完成",
        "submission": "已锁定",
        "judging": "进行中",
        "results": "待发布"
      },
      "metrics": {
        "riders": 32,
        "activeRiders": 0,
        "sessions": 219,
        "submittedWorks": 27,
        "publicWorks": 0,
        "reports": 0,
        "evidenceRefs": 238
      },
      "awards": ["最佳运营闭环", "最佳品牌语气", "最佳数据复盘"]
    },
    {
      "id": "bay-area-happy-trip",
      "slug": "bay-area-happy-trip",
      "title": "湾区开心游",
      "domain": "travel-local-life",
      "status": "running",
      "stageLabel": "进行中 / Live",
      "summary": "构建大湾区旅行、游玩伴随 Agent，像你身边手头的旅行达人和本地精英，让用户无所不知、玩得尽兴。",
      "challenge": "让 Agent 能理解用户偏好、实时位置、预算、交通、天气和本地文化，生成可信、好玩、可执行的旅行陪伴方案。",
      "primaryCta": "进入 Live Hall",
      "secondaryCta": "查看参赛作品",
      "heroUse": "Home featured race / Live Hall / Screen Display",
      "schedule": {
        "registration": "已结束",
        "race": "进行中",
        "submission": "开放中",
        "judging": "排队中",
        "results": "未发布"
      },
      "metrics": {
        "riders": 36,
        "activeRiders": 27,
        "sessions": 188,
        "submittedWorks": 14,
        "publicWorks": 0,
        "reports": 0,
        "evidenceRefs": 206
      },
      "awards": ["最佳旅行体验", "最佳本地洞察", "最佳实时规划", "最佳游玩复盘"],
      "live": {
        "ridingSignal": 82,
        "submitLeft": "02:18:44",
        "totalCost": "$512.70",
        "riskSignals": 5,
        "costWatchRiders": 3
      }
    },
    {
      "id": "smart-investment-analyst",
      "slug": "smart-investment-analyst",
      "title": "智能投研助理",
      "domain": "finance",
      "status": "running",
      "stageLabel": "进行中 / Live",
      "summary": "面向个人投资学习者的资料整理、术语解释、公司信息摘要和风险提示 Agent。",
      "challenge": "构建能帮助用户理解金融材料、整理风险点和形成学习笔记的投研辅助 Agent，不替代专业投资建议。",
      "primaryCta": "进入 Live Hall",
      "secondaryCta": "查看风险提示样例",
      "heroUse": "Hero live switcher secondary race / Risk-heavy Live Hall variant",
      "schedule": {
        "registration": "已结束",
        "race": "进行中",
        "submission": "开放中",
        "judging": "排队中",
        "results": "未发布"
      },
      "metrics": {
        "riders": 28,
        "activeRiders": 21,
        "sessions": 164,
        "submittedWorks": 9,
        "publicWorks": 0,
        "reports": 0,
        "evidenceRefs": 171
      },
      "safetyNotes": ["只做信息整理、术语解释和风险提示；不输出直接买卖建议。"]
    },
    {
      "id": "merchant-copilot",
      "slug": "merchant-copilot",
      "title": "网商经营 Copilot",
      "domain": "e-commerce",
      "status": "registration",
      "stageLabel": "报名中",
      "summary": "帮助小商家做选品、上架、客服、促销、复盘和库存提醒的网商经营 Agent。",
      "challenge": "让 Agent 成为小店主的运营副驾，能把商品、客户、内容和经营指标串起来。",
      "primaryCta": "立即报名",
      "secondaryCta": "查看赛题",
      "heroUse": "Registration Open / Home CTA",
      "schedule": {
        "registration": "开放中",
        "race": "未开始",
        "submission": "未开始",
        "judging": "未开始",
        "results": "未发布"
      },
      "metrics": {
        "riders": 0,
        "applicants": 41,
        "capacity": 60,
        "sessions": 0,
        "submittedWorks": 0
      },
      "awards": ["最佳经营闭环", "最佳客服体验", "最佳上架自动化"]
    },
    {
      "id": "health-habit-coach",
      "slug": "health-habit-coach",
      "title": "健康习惯教练",
      "domain": "health",
      "status": "registration",
      "stageLabel": "报名中",
      "summary": "帮助用户制定运动、睡眠、饮食和复盘计划的健康习惯陪伴 Agent。",
      "challenge": "构建一个长期陪伴型 Agent，帮助用户记录目标、跟踪习惯、生成反馈，但不提供医疗诊断。",
      "primaryCta": "立即报名",
      "secondaryCta": "查看安全边界",
      "heroUse": "Registration Open / Public conversion",
      "schedule": {
        "registration": "开放中",
        "race": "未开始",
        "submission": "未开始",
        "judging": "未开始",
        "results": "未发布"
      },
      "metrics": {
        "riders": 0,
        "applicants": 33,
        "capacity": 50,
        "sessions": 0,
        "submittedWorks": 0
      },
      "safetyNotes": ["只做习惯记录、计划建议和反馈提醒；不做诊断或治疗建议。"]
    },
    {
      "id": "gov-service-navigator",
      "slug": "gov-service-navigator",
      "title": "政务办事导航 Agent",
      "domain": "e-government",
      "status": "completed",
      "stageLabel": "已结束 / 赛果已发布",
      "summary": "帮助居民理解办事流程、材料清单、办理条件和进度提醒的政务流程导航 Agent。",
      "challenge": "把复杂政策流程转成清晰、可信、可执行的办事导航，不代办敏感事项。",
      "primaryCta": "查看赛果",
      "secondaryCta": "查看 Review",
      "heroUse": "Latest Results / Serious-domain case",
      "schedule": {
        "registration": "已结束",
        "race": "已完成",
        "submission": "已锁定",
        "judging": "已完成",
        "results": "已发布"
      },
      "metrics": {
        "riders": 24,
        "activeRiders": 0,
        "sessions": 137,
        "submittedWorks": 19,
        "publicWorks": 12,
        "reports": 24,
        "evidenceRefs": 148
      },
      "safetyNotes": ["只做流程导航和材料清单辅助；不替代官方办理和最终审核。"]
    },
    {
      "id": "medical-followup-assistant",
      "slug": "medical-followup-assistant",
      "title": "医疗随访助手",
      "domain": "medical",
      "status": "upcoming",
      "stageLabel": "即将开放 / 高敏边界",
      "summary": "帮助患者整理随访问题、用药提醒、复诊材料和健康记录的医疗随访辅助 Agent。",
      "challenge": "在高敏场景中训练 Agent 的解释边界、记录能力和低风险辅助，不做诊断。",
      "primaryCta": "订阅开放提醒",
      "secondaryCta": "查看安全说明",
      "heroUse": "Upcoming / Safety-boundary example",
      "schedule": {
        "registration": "即将开放",
        "race": "未开始",
        "submission": "未开始",
        "judging": "未开始",
        "results": "未发布"
      },
      "metrics": {
        "riders": 0,
        "watchers": 96,
        "capacity": 40,
        "sessions": 0,
        "submittedWorks": 0
      },
      "safetyNotes": ["不做诊断；不替代医生；只做随访准备、提醒和记录整理。"]
    }
  ],
  "riders": [
    {
      "id": "rider-mira",
      "name": "Mira Chen",
      "raceId": "bay-area-happy-trip",
      "organization": "HKU CS",
      "role": "rider",
      "caStatus": "active",
      "progress": 78,
      "cost": 24.6,
      "risk": "low",
      "workStatus": "draft",
      "skillTags": ["local reasoning", "route planning", "prompt debugging"]
    },
    {
      "id": "rider-ana",
      "name": "Ana Ruiz",
      "raceId": "bay-area-happy-trip",
      "organization": "SZU Design Lab",
      "role": "rider",
      "caStatus": "active",
      "progress": 72,
      "cost": 19.3,
      "risk": "low",
      "workStatus": "submitted",
      "skillTags": ["recovery loop", "UX framing", "validation"]
    },
    {
      "id": "rider-jun",
      "name": "Jun Park",
      "raceId": "bay-area-happy-trip",
      "organization": "CUHK Shenzhen",
      "role": "rider",
      "caStatus": "active",
      "progress": 61,
      "cost": 38.4,
      "risk": "cost_watch",
      "workStatus": "draft",
      "skillTags": ["tool orchestration", "map data", "cost control risk"]
    },
    {
      "id": "rider-rae",
      "name": "Rae Stone",
      "raceId": "bay-area-happy-trip",
      "organization": "GBA Builder Club",
      "role": "rider",
      "caStatus": "connected",
      "progress": 49,
      "cost": 17.8,
      "risk": "idle",
      "workStatus": "draft",
      "skillTags": ["persona design", "itinerary planning"]
    },
    {
      "id": "rider-owen",
      "name": "Owen Xu",
      "raceId": "smart-investment-analyst",
      "organization": "FinTech Studio",
      "role": "rider",
      "caStatus": "active",
      "progress": 69,
      "cost": 31.2,
      "risk": "safety_boundary",
      "workStatus": "draft",
      "skillTags": ["financial literacy", "risk explanation", "retrieval"]
    },
    {
      "id": "rider-sara",
      "name": "Sara Li",
      "raceId": "media-ops-agent",
      "organization": "Creator Lab",
      "role": "rider",
      "caStatus": "active",
      "progress": 100,
      "cost": 27.5,
      "risk": "low",
      "workStatus": "submitted",
      "skillTags": ["content workflow", "brand voice", "analytics"]
    }
  ],
  "works": [
    {
      "id": "work-gba-wander",
      "raceId": "bay-area-happy-trip",
      "riderId": "rider-mira",
      "title": "GBA WanderMate",
      "status": "draft",
      "visibility": "private",
      "summary": "三条湾区路线已经上墙：早茶、海岸、夜景，预算和交通都标清。",
      "demo": "mock://demo/gba-wandermate",
      "repo": "mock://repo/gba-wandermate",
      "evidenceRefs": ["ev-bay-001", "ev-bay-002"]
    },
    {
      "id": "work-localjoy",
      "raceId": "bay-area-happy-trip",
      "riderId": "rider-ana",
      "title": "LocalJoy Agent",
      "status": "submitted",
      "visibility": "review",
      "summary": "周末短途游作品，节奏轻快，适合第一次来湾区的朋友。",
      "demo": "mock://demo/localjoy-agent",
      "repo": "mock://repo/localjoy-agent",
      "evidenceRefs": ["ev-bay-003"]
    },
    {
      "id": "work-ary-forge",
      "raceId": "genesis-dogfood-race",
      "riderId": "rider-sara",
      "title": "ARY Forge Console",
      "status": "published",
      "visibility": "public",
      "summary": "第一场创世赛的指挥席作品，把赛道节奏、作品上墙和赛后播报放在同一块大屏里。",
      "demo": "mock://demo/ary-forge-console",
      "repo": "mock://repo/ary-forge-console",
      "awardIds": ["award-genesis-001"]
    },
    {
      "id": "work-genesis-track-kit",
      "raceId": "genesis-dogfood-race",
      "riderId": "rider-sara",
      "title": "Genesis Track Kit",
      "status": "published",
      "visibility": "public",
      "summary": "把创世赛的赛程、页面、评审摘录和公开资产整理成可复用的 Race Track 模板。",
      "demo": "mock://demo/genesis-track-kit",
      "repo": "mock://repo/genesis-track-kit",
      "awardIds": ["award-genesis-002"]
    },
    {
      "id": "work-review-board",
      "raceId": "genesis-dogfood-race",
      "riderId": "rider-sara",
      "title": "Review Board",
      "status": "published",
      "visibility": "public",
      "summary": "把评委摘录、作品亮点和赛后传播素材合并成一页公开 Review 看板。",
      "demo": "mock://demo/review-board",
      "repo": "mock://repo/review-board",
      "awardIds": ["award-genesis-003"]
    },
    {
      "id": "work-media-loop",
      "raceId": "media-ops-agent",
      "riderId": "rider-sara",
      "title": "Media Loop Pilot",
      "status": "submitted",
      "visibility": "review",
      "summary": "内容赛道已交卷，脚本、封面和排期正在评审席等分。",
      "demo": "mock://demo/media-loop-pilot",
      "repo": "mock://repo/media-loop-pilot",
      "evidenceRefs": ["ev-media-001"]
    },
    {
      "id": "work-civic-path",
      "raceId": "gov-service-navigator",
      "riderId": "rider-owen",
      "title": "Civic Path Navigator",
      "status": "published",
      "visibility": "public",
      "summary": "政务材料清单与流程解释 Agent，突出可信来源和官方入口回链。",
      "demo": "mock://demo/civic-path-navigator",
      "repo": "mock://repo/civic-path-navigator",
      "awardIds": ["award-gov-001"]
    },
    {
      "id": "work-service-map",
      "raceId": "gov-service-navigator",
      "riderId": "rider-owen",
      "title": "Service Map Brief",
      "status": "published",
      "visibility": "public",
      "summary": "把常见办事流程拆成条件、材料、入口、风险提示四个公开区块。",
      "demo": "mock://demo/service-map-brief",
      "repo": "mock://repo/service-map-brief",
      "awardIds": ["award-gov-002"]
    },
    {
      "id": "work-policy-checklist",
      "raceId": "gov-service-navigator",
      "riderId": "rider-owen",
      "title": "Policy Checklist Agent",
      "status": "published",
      "visibility": "public",
      "summary": "用清单方式帮助用户核对办理材料，同时保留官方渠道和最终审核边界。",
      "demo": "mock://demo/policy-checklist-agent",
      "repo": "mock://repo/policy-checklist-agent",
      "awardIds": ["award-gov-003"]
    }
  ],
  "liveProjections": [
    {
      "raceId": "bay-area-happy-trip",
      "updatedAt": "2026-06-14T13:58:00+08:00",
      "status": "healthy",
      "headlineMetrics": {
        "ridingSignal": 82,
        "activeRiders": 27,
        "sessions": 188,
        "submittedWorks": 14,
        "totalCost": "$512.70",
        "riskSignals": 5
      },
      "processLeaderboard": [
        { "rank": 1, "riderId": "rider-mira", "name": "Mira Chen", "score": 94.8, "label": "route reasoning" },
        { "rank": 2, "riderId": "rider-ana", "name": "Ana Ruiz", "score": 91.2, "label": "recovery loop" },
        { "rank": 3, "riderId": "rider-jun", "name": "Jun Park", "score": 88.5, "label": "tool orchestration" }
      ],
      "eventStream": [
        { "time": "10:42", "type": "session_summary", "text": "Mira 完成偏好建模和路线生成 checkpoint。" },
        { "time": "11:16", "type": "risk", "text": "Jun 进入 cost watch，但仍保持 active。" },
        { "time": "11:28", "type": "work", "text": "LocalJoy Agent 提交第一版 Demo。" },
        { "time": "11:47", "type": "idle", "text": "Rae 42 分钟无新 Session Summary。" }
      ]
    },
    {
      "raceId": "smart-investment-analyst",
      "updatedAt": "2026-06-14T13:55:00+08:00",
      "status": "healthy",
      "headlineMetrics": {
        "ridingSignal": 76,
        "activeRiders": 21,
        "sessions": 164,
        "submittedWorks": 9,
        "totalCost": "$438.20",
        "riskSignals": 8
      },
      "processLeaderboard": [
        { "rank": 1, "name": "Owen Xu", "score": 89.4, "label": "risk explanation" },
        { "rank": 2, "name": "Nina Cho", "score": 86.7, "label": "retrieval quality" },
        { "rank": 3, "name": "Leo Wang", "score": 84.1, "label": "summary clarity" }
      ],
      "eventStream": [
        { "time": "10:31", "type": "safety", "text": "系统提示：不得输出直接买卖建议。" },
        { "time": "11:08", "type": "session_summary", "text": "Owen 完成财报摘要和风险点解释。" }
      ]
    }
  ],
  "awards": [
    {
      "id": "award-genesis-001",
      "raceId": "genesis-dogfood-race",
      "name": "最佳自举作品",
      "rank": 1,
      "workId": "work-ary-forge",
      "riderName": "Sara Li",
      "reason": "第一场创世赛跑出了平台自己的起点，也留下了可以反复观看的冲线样本。"
    },
    {
      "id": "award-genesis-002",
      "raceId": "genesis-dogfood-race",
      "name": "最佳赛道沉淀",
      "rank": 2,
      "workId": "work-genesis-track-kit",
      "riderName": "Sara Li",
      "reason": "把一次性的比赛材料整理成后续赛事可以复用的 Track Kit。"
    },
    {
      "id": "award-genesis-003",
      "raceId": "genesis-dogfood-race",
      "name": "最佳复盘表达",
      "rank": 3,
      "workId": "work-review-board",
      "riderName": "Sara Li",
      "reason": "把作品、评语和公开证据摘要组织成可传播的赛后 Review 看板。"
    },
    {
      "id": "award-gov-001",
      "raceId": "gov-service-navigator",
      "name": "最佳可信流程",
      "rank": 1,
      "workId": "work-civic-path",
      "riderName": "Owen Xu",
      "reason": "以官方来源回链、流程解释和材料清单降低政务办事理解成本。"
    },
    {
      "id": "award-gov-002",
      "raceId": "gov-service-navigator",
      "name": "最佳流程拆解",
      "rank": 2,
      "workId": "work-service-map",
      "riderName": "Owen Xu",
      "reason": "把复杂办事路径拆成条件、材料、入口和风险提示，降低公众理解门槛。"
    },
    {
      "id": "award-gov-003",
      "raceId": "gov-service-navigator",
      "name": "最佳边界表达",
      "rank": 3,
      "workId": "work-policy-checklist",
      "riderName": "Owen Xu",
      "reason": "清楚说明 Agent 只做材料核对和流程解释，不替代官方审核。"
    }
  ],
  "reviews": [
    {
      "raceId": "genesis-dogfood-race",
      "status": "published",
      "summary": "创世骑行挑战赛从混乱起跑到作品冲线，留下了第一批可以被观看、被讲述、被继续追赶的赛场片段。",
      "featuredCases": ["ARY Forge Console", "Genesis Track Kit", "Review Board", "创世赛道开场", "第一批评委摘录"],
      "judgeComments": [
        "最有价值的是把混乱起跑跑成了能被观看、被追赶、被继续讲述的赛场作品。",
        "ARY 自己成为第一批作品，这是创世赛最好的开场。"
      ]
    },
    {
      "raceId": "gov-service-navigator",
      "status": "published",
      "summary": "政务办事导航 Agent 展示了 ARY 在严肃流程场景中的价值：流程拆解、可信引用和风险边界表达。",
      "featuredCases": ["Civic Path Navigator", "Service Map Brief", "Policy Checklist Agent"],
      "judgeComments": ["优秀作品没有试图代替官方办理，而是把流程理解和材料准备做得更清楚。"]
    }
  ],
  "publicEvidenceSummaries": [
    {
      "id": "pev-genesis-001",
      "raceId": "genesis-dogfood-race",
      "workId": "work-ary-forge",
      "riderId": "rider-sara",
      "sourceType": "session_summary",
      "visibility": "public",
      "summary": "从混乱开局中拆出 Race Gallery、作品墙和赛后复盘三条主线，形成可继续迭代的 ARY 起点。",
      "skillTags": ["race shaping", "system framing", "review writing"],
      "sourceRefLabel": "public session summary excerpt"
    },
    {
      "id": "pev-genesis-002",
      "raceId": "genesis-dogfood-race",
      "workId": "work-ary-forge",
      "riderId": "rider-sara",
      "sourceType": "judging_record_summary",
      "visibility": "public",
      "summary": "评审摘录确认作品能够把赛事节奏、作品上墙和公开复盘组织成一个可观看闭环。",
      "skillTags": ["product clarity", "public storytelling"],
      "sourceRefLabel": "published judge comment"
    },
    {
      "id": "pev-genesis-003",
      "raceId": "genesis-dogfood-race",
      "workId": "work-genesis-track-kit",
      "riderId": "rider-sara",
      "sourceType": "work_summary",
      "visibility": "public",
      "summary": "Track Kit 把赛程、页面和评审材料整理成后续 Race 可复用模板，降低下一场赛事启动成本。",
      "skillTags": ["template building", "race operations"],
      "sourceRefLabel": "published work summary"
    },
    {
      "id": "pev-genesis-004",
      "raceId": "genesis-dogfood-race",
      "workId": "work-review-board",
      "riderId": "rider-sara",
      "sourceType": "review_summary",
      "visibility": "public",
      "summary": "Review Board 把评审摘录、Evidence 摘要和获奖作品合并成可公开传播的赛后资产。",
      "skillTags": ["review writing", "asset packaging"],
      "sourceRefLabel": "published review summary"
    },
    {
      "id": "pev-gov-001",
      "raceId": "gov-service-navigator",
      "workId": "work-civic-path",
      "riderId": "rider-owen",
      "sourceType": "work_summary",
      "visibility": "public",
      "summary": "作品用官方来源回链、材料清单和流程拆解降低办事理解成本，没有替代官方办理。",
      "skillTags": ["trusted source", "risk boundary", "process clarity"],
      "sourceRefLabel": "published work summary"
    },
    {
      "id": "pev-gov-002",
      "raceId": "gov-service-navigator",
      "workId": "work-service-map",
      "riderId": "rider-owen",
      "sourceType": "session_summary",
      "visibility": "public",
      "summary": "骑行摘要显示 Rider 把办事路径拆成条件判断、材料准备、官方入口和风险提醒四个稳定区块。",
      "skillTags": ["process decomposition", "source verification"],
      "sourceRefLabel": "public session summary excerpt"
    },
    {
      "id": "pev-gov-003",
      "raceId": "gov-service-navigator",
      "workId": "work-policy-checklist",
      "riderId": "rider-owen",
      "sourceType": "judging_record_summary",
      "visibility": "public",
      "summary": "评审认为作品最清楚的地方是边界表达：Agent 做材料核对和流程解释，不替代官方结论。",
      "skillTags": ["boundary clarity", "public service UX"],
      "sourceRefLabel": "published judge comment"
    }
  ],
  "profiles": [
    {
      "riderId": "rider-mira",
      "displayName": "Mira Chen",
      "headline": "Agent Rider / Local-life builder",
      "featuredRaceIds": ["bay-area-happy-trip"],
      "featuredWorkIds": ["work-gba-wander"],
      "skillTags": ["local reasoning", "route planning", "prompt debugging", "evidence summary"],
      "stats": {
        "projects": 8,
        "sessions": 26,
        "completion": "92%",
        "ranking": "Top 15%"
      }
    },
    {
      "riderId": "rider-sara",
      "displayName": "Sara Li",
      "headline": "Agent Rider / Product systems builder",
      "featuredRaceIds": ["genesis-dogfood-race", "media-ops-agent"],
      "featuredWorkIds": ["work-ary-forge", "work-media-loop"],
      "skillTags": ["race shaping", "content workflow", "design systems", "review writing"],
      "stats": {
        "projects": 12,
        "sessions": 41,
        "completion": "95%",
        "ranking": "Top 8%"
      }
    }
  ],
  "caConnections": [
    {
      "raceProjectId": "rp-bay-mira",
      "raceId": "bay-area-happy-trip",
      "riderId": "rider-mira",
      "registrationStatus": "approved",
      "aggregateIngestionStatus": "active",
      "connectionHealth": "ok",
      "evidenceCompleteness": "good",
      "canSubmitWork": true,
      "connections": [
        { "name": "Claude Code", "caType": "claude_code", "status": "active", "lastSignal": "11:58", "sessions": 12 },
        { "name": "Route Tool Agent", "caType": "other", "status": "connected", "lastSignal": "11:41", "sessions": 3 }
      ]
    },
    {
      "raceProjectId": "rp-bay-jun",
      "raceId": "bay-area-happy-trip",
      "riderId": "rider-jun",
      "registrationStatus": "approved",
      "aggregateIngestionStatus": "active",
      "connectionHealth": "partial_failed",
      "evidenceCompleteness": "needs_review",
      "canSubmitWork": true,
      "connections": [
        { "name": "Claude Code", "caType": "claude_code", "status": "active", "lastSignal": "11:52", "sessions": 9 },
        { "name": "Map Scraper", "caType": "other", "status": "failed", "lastSignal": "10:49", "sessions": 1 }
      ]
    },
    {
      "raceProjectId": "rp-bay-rae",
      "raceId": "bay-area-happy-trip",
      "riderId": "rider-rae",
      "registrationStatus": "approved",
      "aggregateIngestionStatus": "connected",
      "connectionHealth": "no_recent_signal",
      "evidenceCompleteness": "gap",
      "canSubmitWork": true,
      "connections": [
        { "name": "Claude Code", "caType": "claude_code", "status": "connected", "lastSignal": "10:58", "sessions": 2 }
      ]
    },
    {
      "raceProjectId": "rp-merchant-new",
      "raceId": "merchant-copilot",
      "riderId": "rider-new",
      "registrationStatus": "approved",
      "aggregateIngestionStatus": "not_configured",
      "connectionHealth": "no_signal",
      "evidenceCompleteness": "not_started",
      "canSubmitWork": true,
      "connections": []
    }
  ],
  "reviewReadiness": [
    { "raceId": "bay-area-happy-trip", "riderId": "rider-jun", "label": "部分 CA 失败", "severity": "warning", "blocking": false, "text": "Map Scraper 连接失败；仍可提交作品，进入评审前风险提示。" },
    { "raceId": "bay-area-happy-trip", "riderId": "rider-rae", "label": "长时间无摘要", "severity": "danger", "blocking": false, "text": "42 分钟无新的 Session Summary；提示 Organizer / Judge 关注证据缺口。" },
    { "raceId": "media-ops-agent", "riderId": "rider-sara", "label": "待补二评", "severity": "warning", "blocking": false, "text": "9 份作品需要第二位 Judge 交叉评审。" },
    { "raceId": "merchant-copilot", "riderId": "rider-new", "label": "尚未接入 CA", "severity": "info", "blocking": false, "text": "Registration 已通过并生成 RaceProject；CA 未配置不是退赛，也不阻断后续提交。" }
  ],
  "judgeRubric": [
    { "key": "scoreResult", "label": "作品结果", "score": 86, "hint": "解决方案、Demo 完整度、可传播作品资产" },
    { "key": "scoreRiding", "label": "骑行能力", "score": 91, "hint": "过程推进、纠偏、成本控制、Evidence 完整度" }
  ],
  "opsStatus": [
    { "label": "GitHub 登录", "value": "98.6%", "status": "healthy", "detail": "登录成功率稳定" },
    { "label": "资料补全", "value": "82%", "status": "watch", "detail": "13 位用户待补资料" },
    { "label": "User.roles", "value": "4 pending", "status": "watch", "detail": "多角色切换待确认" },
    { "label": "CA 实时接入", "value": "partial", "status": "warning", "detail": "2 个证据缺口，1 个连接失败" },
    { "label": "Projection", "value": "healthy", "status": "healthy", "detail": "Live Hall 刷新 2.8s" },
    { "label": "Screen Console", "value": "ready", "status": "healthy", "detail": "模式切换首屏 < 1s" },
    { "label": "Report 发布", "value": "draft", "status": "watch", "detail": "未发布 Report 不进入公开端" },
    { "label": "Public Site", "value": "0.8s", "status": "healthy", "detail": "关键公开页面首屏目标 1s" }
  ],
  "screenFallbacks": [
    { "mode": "stable_projection", "label": "最近稳定 Projection", "detail": "Live 数据抖动时优先回退。" },
    { "mode": "static_notice", "label": "静态赛事公告", "detail": "Projection 不可用时展示阶段公告。" },
    { "mode": "static_leaderboard", "label": "静态榜单", "detail": "大屏不稳定时展示已发布或稳定榜单。" },
    { "mode": "works_showcase", "label": "公开作品轮播", "detail": "展示公开作品入口，不读取原始 Session。" }
  ],
  "consoleTasks": [
    {
      "raceId": "bay-area-happy-trip",
      "view": "organizer",
      "items": [
        { "label": "Evidence gap", "count": 2, "severity": "judge note" },
        { "label": "Cost watch", "count": 3, "severity": "warning" },
        { "label": "Idle risk", "count": 2, "severity": "danger" },
        { "label": "Judge assignments queued", "count": 18, "severity": "info" }
      ]
    },
    {
      "raceId": "media-ops-agent",
      "view": "judge",
      "items": [
        { "label": "Assigned works", "count": 27, "severity": "info" },
        { "label": "Reviews submitted", "count": 12, "severity": "info" },
        { "label": "Need second judge", "count": 9, "severity": "warning" }
      ]
    },
    {
      "raceId": "merchant-copilot",
      "view": "rider",
      "items": [
        { "label": "Registration open", "count": 41, "severity": "info" },
        { "label": "Profile completion needed", "count": 13, "severity": "warning" }
      ]
    }
  ]
}
