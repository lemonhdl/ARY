const sampleData = window.ARY_SAMPLE_DATA;
const pageButtons = document.querySelectorAll("[data-page]");
const pagePanels = document.querySelectorAll("[data-page-panel]");
let currentRaceId = sampleData?.raceGroups?.featuredRaceId;
let currentResultsRaceId = sampleData?.raceGroups?.completedRaceIds?.[0];
let currentScreenMode = "live";
let currentWorkFilter = "public";
let homeRaceCarouselTimer;

function setPage(pageName) {
  if (pageName !== "works") hideWorkDetail();
  pagePanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.pagePanel === pageName);
  });
  pageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });
  requestAnimationFrame(() => {
    resizeAll();
    requestAnimationFrame(resizeAll);
  });
}

function getRace(id) {
  return sampleData?.races?.find((race) => race.id === id);
}

function getWork(id) {
  return sampleData?.works?.find((work) => work.id === id);
}

function getRider(id) {
  return sampleData?.riders?.find((rider) => rider.id === id);
}

function getProjection(raceId) {
  return sampleData?.liveProjections?.find((projection) => projection.raceId === raceId);
}

function statusText(status) {
  return {
    registration: "报名中",
    running: "进行中",
    judging: "评审中",
    completed: "已完成",
    archived: "已归档",
    upcoming: "即将开放",
  }[status] || status;
}

function workStatusText(status) {
  return {
    draft: "草稿展示",
    submitted: "已提交",
    published: "已发布",
  }[status] || status;
}

function visibilityText(visibility) {
  return {
    public: "公开展示",
    review: "评审预览",
    private: "内部预览",
  }[visibility] || visibility;
}

function isPublicWork(work) {
  return work?.visibility === "public" && work?.status === "published";
}

function getPublicWorks() {
  return (sampleData?.works || []).filter(isPublicWork);
}

function getPublicWorksForRace(raceId) {
  return getPublicWorks().filter((work) => work.raceId === raceId);
}

function getDisplayWorksForRace(raceId) {
  const racePublicWorks = getPublicWorksForRace(raceId);
  return racePublicWorks.length ? racePublicWorks : getPublicWorks();
}

function getPublishedAwardForWork(workId) {
  return (sampleData?.awards || []).find((item) => item.workId === workId);
}

function getFilteredWorksForRace(raceId, filter = currentWorkFilter) {
  const racePublicWorks = getPublicWorksForRace(raceId);
  const hasRacePublicWorks = racePublicWorks.length > 0;
  let works = hasRacePublicWorks ? racePublicWorks : getPublicWorks();
  if (filter === "unavailable") return { works: [], isFallback: false };
  if (filter === "awarded") {
    works = works.filter((work) => Boolean(getPublishedAwardForWork(work.id)));
    if (!works.length) works = getPublicWorks().filter((work) => Boolean(getPublishedAwardForWork(work.id)));
  }
  if (filter === "featured") works = works.filter((work) => Boolean(getPublishedAwardForWork(work.id)) || getPublicEvidenceForWork(work.id).length > 0).slice(0, 4);
  return { works, isFallback: !hasRacePublicWorks };
}

function workFilterLabel(filter) {
  return {
    public: "全部公开作品",
    featured: "精选公开作品",
    awarded: "获奖作品",
    unavailable: "评审中不可公开",
  }[filter] || "全部公开作品";
}

function getRaceCaConnections(raceId) {
  return (sampleData?.caConnections || []).filter((item) => item.raceId === raceId);
}

function getRaceReviewReadiness(raceId) {
  return (sampleData?.reviewReadiness || []).filter((item) => item.raceId === raceId);
}

function getConnectionStatusSummary(raceId) {
  const projects = getRaceCaConnections(raceId);
  const active = projects.filter((item) => item.aggregateIngestionStatus === "active").length;
  const failed = projects.filter((item) => ["failed", "partial_failed", "no_recent_signal"].includes(item.connectionHealth)).length;
  const notConfigured = projects.filter((item) => item.aggregateIngestionStatus === "not_configured").length;
  return { projects, active, failed, notConfigured };
}

function statusBadgeText(status) {
  return {
    healthy: "Healthy",
    watch: "Watch",
    warning: "Warning",
    danger: "Risk",
    info: "Info",
    ready: "Ready",
  }[status] || status;
}

function getPublicReview(raceId) {
  return sampleData?.reviews?.find((review) => review.raceId === raceId && review.status === "published");
}

function getPublishedAwards(raceId) {
  const race = getRace(raceId);
  const review = getPublicReview(raceId);
  if (race?.status !== "completed" || !review) return [];
  return (sampleData?.awards || []).filter((award) => award.raceId === raceId);
}

function getPublishedResultRaces() {
  return (sampleData?.races || []).filter((race) => race.status === "completed" && getPublicReview(race.id) && getPublishedAwards(race.id).length);
}

function domainText(domain) {
  return {
    "self-dogfood": "Self-dogfood",
    travel: "大湾区旅行",
    finance: "金融投研",
    commerce: "网商网购",
    health: "健康管理",
    government: "电子政务",
    medical: "医疗随访",
    media: "自媒体运营",
    "e-commerce": "网商网购",
    "content-ops": "自媒体运营",
  }[domain] || domain;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const resultCardCopy = {
  "genesis-dogfood-race": "第一场创世赛跑出了平台自己的起点，也留下了可以反复观看的冲线样本。",
  "gov-service-navigator": "把复杂办事路线跑成一张清晰通关图，让严肃场景也有了可展示的赛道作品。",
  "merchant-copilot": "小店主的选品、上新和复盘节奏被带进赛场，等待第一批 Rider 入场。",
  "health-habit-coach": "运动、睡眠和饮食被拆成每日可坚持的小目标，健康赛道正在集结。",
  "media-ops-agent": "选题、脚本、发布和复盘都已交卷，评审席正在寻找最稳的内容节奏。",
  "medical-followup-assistant": "随访提醒、复诊准备和问题清单即将开跑，医疗赛道保持克制而清晰。",
};

function text(selector, value) {
  const node = document.querySelector(selector);
  if (node && value !== undefined && value !== null) node.textContent = value;
}

function html(selector, value) {
  const node = document.querySelector(selector);
  if (node && value !== undefined && value !== null) node.innerHTML = value;
}

const homeRaceAssets = {
  "bay-area-happy-trip": {
    workTitle: "GBA WanderMate",
    workMeta: "湾区开心游 / Mira Chen / 三条湾区路线已经上墙：早茶、海岸、夜景，预算和交通都标清。",
    riderName: "Mira Chen",
    riderMeta: "HKU CS / local reasoning / route planning / prompt debugging",
  },
  "smart-investment-analyst": {
    workTitle: "Risk Briefing Notebook",
    workMeta: "智能投研助理 / Owen Xu / 财报摘要、风险边界和术语解释已进入作品墙。",
    riderName: "Owen Xu",
    riderMeta: "FinTech Studio / financial literacy / risk explanation / retrieval",
  },
};

function renderHomeRace(raceId) {
  const race = getRace(raceId);
  if (!race) return;
  currentRaceId = race.id;
  const projection = getProjection(race.id);
  const submitLabel = race.live?.submitLeft || "提交开放";
  const riskSignals = projection?.headlineMetrics?.riskSignals ?? race.live?.riskSignals ?? 0;
  const asset = homeRaceAssets[race.id] || homeRaceAssets["bay-area-happy-trip"];

  html(".hero-copy h1", escapeHtml(race.title));
  text(".hero-subtitle", `赛题：${race.challenge}`);
  html(
    ".hero-meta",
    `<span><b>${race.metrics.riders}</b> riders</span>
     <span><b>${race.metrics.activeRiders}</b> active</span>
     <span><b>${race.metrics.submittedWorks}</b> works</span>
     <span><b>${riskSignals}</b> signals</span>`,
  );
  html(
    ".hero-actions",
    `<button type="button" data-page="live">${escapeHtml(race.primaryCta)}</button>
     <button type="button" data-page="race">查看赛题</button>
     <button type="button" data-page="works">作品墙</button>
     <button type="button" data-page="results">赛果 / Review</button>
     <button type="button" data-page="screen">大屏展示</button>`,
  );
  html(
    ".benefit-row",
    `<article>
       <span class="icon-card">Work</span>
       <div>
         <h2>${escapeHtml(asset.workTitle)}</h2>
         <p>${escapeHtml(asset.workMeta)}</p>
         <button type="button" data-page="works">查看作品</button>
       </div>
     </article>
     <article>
       <span class="icon-card">Rider</span>
       <div>
         <h2>${escapeHtml(asset.riderName)}</h2>
         <p>${escapeHtml(asset.riderMeta)}</p>
         <button type="button" data-page="rider">查看档案</button>
       </div>
     </article>`,
  );
  document.querySelectorAll("[data-live-race]").forEach((button) => {
    button.classList.toggle("active", button.dataset.liveRace === race.id);
    button.setAttribute("aria-current", button.dataset.liveRace === race.id ? "true" : "false");
  });
}

function renderHomeLiveSwitcher() {
  html(
    ".hero-live-switcher",
    `${sampleData.raceGroups.liveRaceIds
       .map((raceId, index) => {
         const race = getRace(raceId);
         return `<button class="${index === 0 ? "active" : ""}" type="button" data-live-race="${escapeHtml(race.id)}" aria-label="切换到${escapeHtml(race.title)}" aria-current="${index === 0 ? "true" : "false"}"></button>`;
       })
       .join("")}`,
  );
}

function rotateHomeLiveRace() {
  const liveRaceIds = sampleData?.raceGroups?.liveRaceIds || [];
  if (liveRaceIds.length < 2 || !document.querySelector(".page-home.active")) return;
  const currentIndex = Math.max(0, liveRaceIds.indexOf(currentRaceId));
  const nextRaceId = liveRaceIds[(currentIndex + 1) % liveRaceIds.length];
  renderHomeRace(nextRaceId);
  renderPublicRaceContext(nextRaceId);
  requestAnimationFrame(resizeAll);
}

function restartHomeRaceCarousel() {
  window.clearInterval(homeRaceCarouselTimer);
  homeRaceCarouselTimer = window.setInterval(rotateHomeLiveRace, 6800);
}

function getRaceRulesSummary(race) {
  const statusRules = {
    registration: "报名阶段优先展示赛题、席位、申请状态和开赛提醒；尚未公开作品或赛果。",
    running: "进行中阶段优先展示 Live、Riders、Works 和阶段公告；Projection 只用于过程观看。",
    judging: "评审中阶段优先展示作品、评审进度和结果公布时间；未发布结果不进入公开端。",
    completed: "已结束阶段优先展示 Results、Review、Winning Works 和 Rider Profile；最终结果来自 Award / Report。",
    upcoming: "即将开放阶段只展示赛题预告、安全边界和开放提醒。",
  };
  const safety = race.safetyNotes?.join(" / ") || "公开端不展示原始 CA Session；Evidence 只展示公开摘要。";
  return `${statusRules[race.status] || statusRules.running} ${safety}`;
}

function getScheduleSummary(schedule = {}) {
  return [
    ["报名", schedule.registration || "未设置"],
    ["比赛", schedule.race || "未设置"],
    ["提交", schedule.submission || "未设置"],
    ["评审", schedule.judging || "未设置"],
    ["赛果", schedule.results || "未发布"],
  ];
}

function getPublicEvidenceForWork(workId) {
  return (sampleData?.publicEvidenceSummaries || []).filter((evidence) => evidence.workId === workId && evidence.visibility === "public");
}

function getPublicEvidenceForRider(riderId) {
  return (sampleData?.publicEvidenceSummaries || []).filter((evidence) => evidence.riderId === riderId && evidence.visibility === "public");
}

function getPublicEvidenceSummaryForWork(work) {
  const evidence = getPublicEvidenceForWork(work?.id);
  const race = getRace(work?.raceId);
  const award = sampleData?.awards?.find((item) => item.workId === work?.id);
  if (!work) return "暂无公开 Evidence 摘要。";
  if (evidence.length) return evidence.map((item) => `${item.sourceRefLabel}：${item.summary}`).join(" / ");
  if (award) return `Award 已发布，可公开引用评审理由：${award.reason}`;
  return `${race?.title || "当前赛事"} 的公开 Evidence 摘要待发布；不使用私有 RidingRecord。`;
}

function getProfileEvidenceSummary(profile, publicWorks, publicAwards) {
  const evidence = getPublicEvidenceForRider(profile.riderId).filter((item) => publicWorks.some((work) => work.id === item.workId));
  const awardNames = publicAwards.map((award) => award.name).join(" / ");
  if (evidence.length) return evidence.map((item) => `${item.sourceRefLabel}：${item.summary}`).join(" / ");
  if (publicAwards.length) return `公开奖项：${awardNames}。能力标签来自公开作品、Award 和 Review 摘要。`;
  return "暂无公开 Evidence 摘要；Rider Profile 不展示 private Work、原始 Session 或默认不公开的 rider_report。";
}

function getRacePageStateConfig(race) {
  const hasPublishedResults = getPublishedAwards(race.id).length > 0;
  const hasPublishedReview = Boolean(getPublicReview(race.id));
  const baseNav = [
    { label: "本页概览", description: "赛题、状态和公开规则", enabled: false, current: true },
    { label: "赛程规则", description: "本页下方卡片已展示", enabled: false, current: true },
    { label: "进入 Live Hall", page: "live", description: "看实时骑行过程", enabled: race.status === "running" },
    { label: "查看公开作品", page: "works", description: "只看已发布公开作品", enabled: ["running", "judging", "completed"].includes(race.status) },
    { label: "查看最终赛果", page: "results", description: "仅已发布 Award / Report", enabled: hasPublishedResults },
    { label: "查看赛后复盘", page: "review", description: "仅展示已发布复盘", enabled: hasPublishedReview },
    { label: "了解 Rider", page: "rider", description: "公开档案和 Evidence 摘要", enabled: ["running", "judging", "completed"].includes(race.status) },
  ];

  const configs = {
    registration: {
      phase: "报名中",
      headline: "报名与赛题确认优先",
      primary: `<button type="button" data-page="cooperation">报名 / 合作入口</button><button type="button" data-race-focus="schedule">赛程规则</button><button type="button" data-page="console">Console 示例</button><button type="button" data-page="home">赛事画廊</button>`,
      focusCards: ["报名 CTA", "Rules / Schedule", "席位与申请", "开赛提醒"],
    },
    running: {
      phase: "进行中",
      headline: "Live、Riders、Works 与阶段公告优先",
      primary: `<button type="button" data-page="live">Live Hall</button><button type="button" data-page="works">作品墙</button><button type="button" data-page="screen">大屏展示</button><button type="button" data-page="console" data-console-view="organizer">赛事工作台</button>`,
      focusCards: ["Live Hall", "Riders", "Works", "阶段公告"],
    },
    judging: {
      phase: "评审中",
      headline: "作品、评审进度与结果发布时间优先",
      primary: `<button type="button" data-page="works">公开作品墙</button><button type="button" data-console-view="judge" data-page="console">评审工作台</button><button type="button" data-page="results">已发布赛果</button><button type="button" data-page="cooperation">下一场报名</button>`,
      focusCards: ["Works", "评审进度", "结果公布时间", "公开状态"],
    },
    completed: {
      phase: "已结束",
      headline: "Results、Review、Winning Works 和 Rider Profile 优先",
      primary: `<button type="button" data-page="results">赛果榜单</button><button type="button" data-page="review">赛后 Review</button><button type="button" data-page="works">获奖作品</button><button type="button" data-page="rider">Rider 档案</button>`,
      focusCards: ["Results", "Review", "Winning Works", "Rider Profile"],
    },
    upcoming: {
      phase: "即将开放",
      headline: "开放提醒与赛题预告优先",
      primary: `<button type="button" data-page="cooperation">订阅开放提醒</button><button type="button" data-race-focus="schedule">安全边界</button><button type="button" data-page="home">赛事画廊</button><button type="button" data-page="login">登录入口</button>`,
      focusCards: ["开放提醒", "赛题预告", "安全边界", "合作入口"],
    },
  };

  return { ...(configs[race.status] || configs.running), nav: baseNav };
}

function renderRacePage(raceId) {
  const race = getRace(raceId);
  if (!race) return;
  const projection = getProjection(race.id);
  const schedule = race.schedule || {};
  const live = race.live || {};
  const activeRiders = race.metrics.activeRiders ?? 0;
  const config = getRacePageStateConfig(race);
  const publicWorksCount = getPublicWorksForRace(race.id).length;
  const publishedAwardsCount = getPublishedAwards(race.id).length;
  const scheduleSummary = getScheduleSummary(schedule);
  const rulesSummary = getRaceRulesSummary(race);

  text(".page-race .section-kicker", `${race.title} / ${config.phase} / ${race.stageLabel || "Race"}`);
  text(".race-hero-panel h1", race.title);
  text(".race-summary", `${race.challenge || race.summary} ${config.headline}。`);
  html(".race-cta-row", config.primary);
  html(
    ".race-state-grid",
    `<article class="state-card ${race.status === "registration" ? "active" : ""}"><span>Overview</span><b>${escapeHtml(config.phase)}</b><p>${race.metrics.riders ?? race.metrics.applicants ?? 0} 位相关 Rider / 申请</p></article>
     <article class="state-card ${["registration", "upcoming"].includes(race.status) ? "active" : ""}"><span>Rules / Schedule</span><b>${escapeHtml(schedule.registration || "未设置")}</b><p>Race：${escapeHtml(schedule.race || "未设置")}</p></article>
     <article class="state-card ${race.status === "running" ? "active" : ""}"><span>Live</span><b>${race.status === "running" ? "开放" : "非主入口"}</b><p>${activeRiders} 位正在骑行，${projection ? "Projection ready" : "Projection unavailable"}</p></article>
     <article class="state-card ${["running", "judging"].includes(race.status) ? "active" : ""}"><span>Works</span><b>${race.metrics.submittedWorks || 0} submitted</b><p>${publicWorksCount} 个公开作品，${schedule.submission || "提交状态未设置"}</p></article>
     <article class="state-card ${race.status === "completed" ? "active" : ""}"><span>Results / Review</span><b>${publishedAwardsCount ? "Published" : "Not public"}</b><p>${schedule.results || "未发布"}；未发布内容不进入公开导航</p></article>`,
  );
  const liveMessages = projection?.eventStream?.slice(0, 2).map((event) => `${event.time} ${event.text}`).join(" / ") || "Live Hall 将展示实时骑行过程。";
  const workLine = getDisplayWorksForRace(race.id).slice(0, 2).map((work) => work.title).join(" / ") || "作品发布后进入公开墙。";
  html(
    ".race-content-grid",
    `<article class="glass-card"><span>Live Focus</span><h2>${escapeHtml(domainText(race.domain))}</h2><p>${escapeHtml(liveMessages)}</p></article>
     <article class="glass-card"><span>Rules / Schedule</span><h2>${escapeHtml(schedule.race || race.stageLabel || statusText(race.status))}</h2><p>${scheduleSummary.map(([label, value]) => `${label}：${escapeHtml(value)}`).join(" / ")}</p></article>
     <article class="glass-card"><span>Works</span><h2>${race.metrics.riders ?? race.metrics.applicants ?? 0} 名 Rider</h2><p>${activeRiders} 位在线；公开作品：${publicWorksCount} 个；代表作品：${escapeHtml(workLine)}</p></article>
     <article class="glass-card"><span>Stage Rule</span><h2>${escapeHtml(config.headline)}</h2><p>${escapeHtml(rulesSummary)}</p></article>`,
  );
  html(
    ".right-dashboard",
    `<h2>这场比赛还能看什么</h2>
     ${config.nav
       .map((item) => {
         const stateClass = item.current ? "current" : item.enabled ? "active" : "disabled";
         const pageAttr = item.enabled && item.page ? `data-page="${item.page}"` : "";
         const disabledAttr = item.enabled ? "" : "aria-disabled=\"true\"";
         return `<button class="${stateClass}" type="button" ${pageAttr} ${disabledAttr}><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.description)}</small></button>`;
       })
       .join("")}
     <div class="race-nav-note"><span>为什么有些不能点</span><b>${escapeHtml(config.headline)}；未发布的 Results / Review 不会提前出现在公开端。</b></div>`,
  );
}

function renderLiveHall(raceId) {
  const race = getRace(raceId);
  if (!race) return;
  const projection = getProjection(race.id);
  const hasProjection = Boolean(projection);
  const live = race.live || {};
  const connectionSummary = getConnectionStatusSummary(race.id);
  const riskItems = getRaceReviewReadiness(race.id);

  text(".page-live .page-label span", hasProjection ? "Live Hall / Riding Now" : "Live Hall / Projection Fallback");
  text(".page-live .section-kicker", `${race.title} / ${statusText(race.status)}`);
  text(".page-live .live-header h1", `${race.title} Agent ${race.status === "running" ? "正在骑行" : "当前不在实时骑行"}`);
  html(
    ".live-metrics",
    `<article><span>Stage</span><b>${escapeHtml(statusText(race.status))}</b><p>${escapeHtml(race.stageLabel || "当前阶段")}</p></article>
     <article><span>Riders</span><b>${race.metrics.riders ?? race.metrics.applicants ?? 0} / ${race.metrics.activeRiders ?? 0} active</b><p>${race.status === "running" ? "当前赛事正在进行。" : "当前赛事不处于 running 状态。"}</p></article>
     <article><span>CA Health</span><b>${connectionSummary.active} active / ${connectionSummary.failed} risk</b><p>接入失败显示为证据缺口，不是退赛。</p></article>
     <article><span>Cost / Risk</span><b>${live.totalCost || "N/A"}</b><p>${live.costWatchRiders ?? 0} 位成本观察，${riskItems.length} 条评审前提示。</p></article>`,
  );
  html(
    ".event-stream",
    hasProjection
      ? [
          ...projection.eventStream.map((event) => `<article><b>${escapeHtml(event.time)}</b><span>${escapeHtml(event.text)}</span></article>`),
          `<article><b>Screen Console</b><span>从顶部 Console 或右侧工作台进入大屏控制；Projection 只用于现场观看。</span></article>`,
          `<article><b>Fallback</b><span>Live 不稳定时回退到最近稳定 Projection、公告或公开作品入口。</span></article>`,
        ]
          .slice(0, 4)
          .join("")
      : `<article><b>Fallback</b><span>当前 Race 没有可公开 Projection，Live Hall 不展示伪造实时事件。</span></article>`,
  );
  html(
    ".leaderboard-panel ol",
    hasProjection
      ? projection.processLeaderboard.map((item) => `<li><span>${String(item.rank).padStart(2, "0")}</span><b>${escapeHtml(item.name)}</b><em>${item.score}</em></li>`).join("")
      : `<li><span>--</span><b>暂无过程榜单</b><em>N/A</em></li>`,
  );
}

function renderWorksPage(raceId, filter = currentWorkFilter) {
  currentWorkFilter = filter;
  const race = getRace(raceId);
  const { works: publicWorks, isFallback } = getFilteredWorksForRace(raceId, filter);
  const racePublicWorks = getPublicWorksForRace(raceId);
  const privatePreviewCount = (sampleData?.works || []).filter((work) => work.raceId === raceId && !isPublicWork(work)).length;
  const unavailableCopy = `<article class="work-card review-hold-card"><span>评审中</span><h2>评审中作品暂不公开</h2><p>作品进入评审后会先留在评审席和办赛工作台，公开作品墙只展示已经发布的作品。等评审摘要和公开资产确认后，这些作品会自动进入公开展示。</p><div><b>${privatePreviewCount}</b><span>本场待公开作品</span></div><button type="button" data-page="console" data-console-view="judge">查看评审席</button></article>`;
  html(
    ".works-toolbar",
    `<button class="${filter === "public" ? "active" : ""}" type="button" data-work-filter="public">全部公开</button>
     <button class="${filter === "featured" ? "active" : ""}" type="button" data-work-filter="featured">精选</button>
     <button class="${filter === "awarded" ? "active" : ""}" type="button" data-work-filter="awarded">已获奖</button>
     <button class="${filter === "unavailable" ? "active" : ""}" type="button" data-work-filter="unavailable">评审中</button>
     <span>${escapeHtml(workFilterLabel(filter))} · 按公开发布时间展示</span>`,
  );
  html(
    ".work-grid",
    filter === "unavailable"
      ? unavailableCopy
      : publicWorks.length
        ? publicWorks
            .map((work, index) => {
              const workRace = getRace(work.raceId);
              const award = getPublishedAwardForWork(work.id);
              const isFallbackWork = isFallback && work.raceId !== raceId;
              const featuredClass = filter === "featured" && index === 0 ? " hero-work" : "";
              return `<article class="work-card${featuredClass}" data-work-card="${escapeHtml(work.id)}"><span>${isFallbackWork ? "其他赛事公开作品" : award ? "获奖公开作品" : "公开作品"}</span><h2>${escapeHtml(work.title)}</h2><p>${escapeHtml(work.summary)}</p><b>${escapeHtml(workRace.title)} / ${award ? escapeHtml(award.name) : escapeHtml(workStatusText(work.status))}</b><button type="button" data-work-id="${escapeHtml(work.id)}">查看详情</button></article>`;
            })
            .join("")
        : `<article class="work-card review-hold-card"><span>暂无作品</span><h2>暂无符合条件的公开作品</h2><p>当前筛选没有可展示作品。公开墙会保留版面给已发布作品，评审中和未发布内容不会提前出现。</p><button type="button" data-work-filter="public">返回全部公开</button></article>`,
  );
  hideWorkDetail();
  text(".page-works .module-title .section-kicker", `${race?.title || "当前赛事"} / ${workFilterLabel(filter)}`);
  text(".page-works .module-title h1", `${race?.title || "当前赛事"}作品墙`);
  text(".page-works .module-summary", `${racePublicWorks.length} 个本场公开作品 / ${privatePreviewCount} 个评审中作品暂不公开 / 当前展示 ${publicWorks.length} 个`);
  html(
    ".asset-matrix",
    `<h2>作品看板</h2>
     <div><span>当前筛选</span><b>${escapeHtml(workFilterLabel(filter))}</b></div>
     <div><span>公开作品</span><b>${racePublicWorks.length} 个本场作品</b></div>
     <div><span>精选</span><b>奖项与公开证据摘要</b></div>
     <div><span>已获奖</span><b>已发布 Award 作品</b></div>
     <div><span>评审中</span><b>${privatePreviewCount} 个等待发布</b></div>`,
  );
}

function renderPublicRaceContext(raceId = currentRaceId) {
  currentRaceId = raceId || sampleData?.raceGroups?.featuredRaceId;
  renderRacePage(currentRaceId);
  renderLiveHall(currentRaceId);
  renderWorksPage(currentRaceId);
  text(".screen-top span", `${getRace(currentRaceId)?.title || "当前赛事"} / Screen Display`);
  renderScreenDisplay(currentScreenMode);
}

function renderHomeLatestResults() {
  const publishedRaces = getPublishedResultRaces();
  html(
    ".latest-results-list",
    `<div class="card-head"><span>Latest Results</span><b>Published</b></div>
     ${publishedRaces
       .slice(0, 3)
       .map((race) => {
         const topAward = getPublishedAwards(race.id).sort((a, b) => a.rank - b.rank)[0];
         return `<div><span>${escapeHtml(race.title)}</span><b>${escapeHtml(topAward?.name || "已发布")}</b></div>`;
       })
       .join("")}`,
  );
}

function renderResultsAndReview(raceId = currentResultsRaceId) {
  const publishedRaces = getPublishedResultRaces();
  const race = getRace(raceId) && publishedRaces.some((item) => item.id === raceId) ? getRace(raceId) : publishedRaces[0];
  if (!race) {
    text(".page-results .module-title .section-kicker", "Results / Unavailable");
    text(".page-results .module-title h1", "暂无已发布赛果");
    text(".page-results .module-summary", "未发布 Results 不进入公开端。");
    html(".award-grid", `<article class="award-card result-card--completed"><span>No published results</span><b>暂无公开赛果</b><p>Results 必须来自 Award / Report，而不是 Projection。</p></article>`);
    html(".result-aside", `<h2>赛果来源</h2><div><b>结果</b><span>奖项与复盘已发布</span><em>官方确认</em></div>`);
    text(".page-review .section-kicker", "Review / Unavailable");
    text(".page-review .module-title h1", "暂无已发布 Review");
    text(".page-review .module-summary", "未发布 Review 不进入公开端。");
    text(".quote-card p", "公开端不展示 draft report 或原始 CA Session。");
    html(".review-card-grid", `<article><span>Unavailable</span><b>Review 未发布</b><p>未发布 Report 不进入公开端。</p></article>`);
    return;
  }

  currentResultsRaceId = race.id;
  const publishedAwards = getPublishedAwards(race.id);
  const review = getPublicReview(race.id);
  const judgeRubric = sampleData?.judgeRubric || [];
  const raceSwitcher = publishedRaces
    .map((item) => `<button class="${item.id === race.id ? "active" : ""}" type="button" data-results-race="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>`)
    .join("");

  text(".page-results .module-title .section-kicker", `${race.title} / 已发布赛果`);
  text(".page-results .module-title h1", `${race.title}赛果`);
  text(".page-results .module-summary", `${publishedAwards.length} 个已发布奖项 / Results 读取 Award 与公开 Report，不读取过程榜单`);
  html(
    ".award-grid",
    publishedAwards
      .map((award, index) => {
        const work = getWork(award.workId);
        const evidence = getPublicEvidenceForWork(award.workId);
        return `<article class="award-card ${index === 0 ? "result-card--completed" : ""}">
          <span>${escapeHtml(award.name)}</span>
          <b>${escapeHtml(work?.title || "未关联作品")}</b>
          <p>${escapeHtml(race.title)} / ${escapeHtml(award.riderName)}</p>
          <div class="award-meta"><em>Rank ${award.rank}</em><em>${evidence.length} evidence</em><em>Published</em></div>
          <small>${escapeHtml(award.reason)} ${evidence[0] ? `Evidence：${escapeHtml(evidence[0].summary)}` : ""}</small>
        </article>`;
      })
      .concat([
        `<article><span>作品结果榜</span><b>Award Leaderboard</b><p>最终作品结果读取 Award / Report / leaderboard_read_model。</p><small>不从 Live Projection 直接生成最终排名。</small></article>`,
        `<article><span>骑行能力榜</span><b>Riding Skill Highlights</b><p>${judgeRubric.map((item) => `${item.label} ${item.score}`).join(" / ")}</p><small>来自公开 Evidence、评审摘要和 Report。</small></article>`,
      ])
      .join(""),
  );
  html(
    ".result-aside",
    `<h2>Published Races</h2>
     <div class="result-race-switcher">${raceSwitcher}</div>
     <div><b>来源</b><span>奖项 / 复盘 / 公开证据摘要</span><em>官方确认</em></div>
     ${publishedAwards
       .map((award) => {
         const work = getWork(award.workId);
         const evidence = getPublicEvidenceForWork(award.workId);
         return `<div><b>${String(award.rank).padStart(2, "0")}</b><span>${escapeHtml(work?.title || award.name)}</span><em>${evidence.length} public evidence</em></div>`;
       })
       .join("")}
     <button type="button" data-page="review">查看 Review</button>`,
  );

  text(".page-review .section-kicker", `${race.title} / 公开复盘`);
  text(".page-review .module-title h1", `${race.title}复盘`);
  text(
    ".page-review .module-summary",
    review
      ? `${review.featuredCases.length} 个公开高光案例 / ${review.judgeComments.length} 条公开评委摘录 / ${race.metrics.evidenceRefs || 0} 个公开证据摘要`
      : "Review 未发布，不进入公开端",
  );
  text(".quote-card p", review?.summary || "未发布 Review 不进入公开端；公开端不展示 draft report 或原始 CA Session。");
  html(
    ".review-card-grid",
    review
      ? `<article><span>Review Summary</span><b>已发布复盘</b><p>${escapeHtml(review.summary)}</p></article>
         <article><span>Featured Cases</span><b>${review.featuredCases.length} 个公开案例</b><p>${review.featuredCases.map(escapeHtml).join(" / ")}</p></article>
         <article><span>Judge Comments</span><b>${review.judgeComments.length} 条公开摘录</b><p>${escapeHtml(review.judgeComments[0])}</p></article>
         <article><span>Evidence</span><b>公开摘要</b><p>Review 只引用公开 Evidence 摘要，不展示原始 Session。</p></article>
         <article><span>Race Link</span><b>${escapeHtml(race.title)}</b><p>Results / Review 与同一场 completed Race 绑定。</p></article>`
      : `<article><span>Unavailable</span><b>Review 未发布</b><p>未发布 Report 不进入公开端。</p></article>`,
  );
}

function renderRiderProfile(profile = sampleData?.profiles?.[0]) {
  if (!profile) return;
  const publicWorks = profile.featuredWorkIds.map(getWork).filter(isPublicWork);
  const publicRaces = profile.featuredRaceIds.map(getRace).filter(Boolean);
  const publicAwards = (sampleData?.awards || []).filter((award) => publicWorks.some((work) => work.id === award.workId));
  const publicEvidence = getPublicEvidenceForRider(profile.riderId).filter((item) => publicWorks.some((work) => work.id === item.workId));
  const evidenceCount = publicEvidence.length;
  const profileEvidenceSummary = getProfileEvidenceSummary(profile, publicWorks, publicAwards);
  const rider = getRider(profile.riderId);
  const caProject = (sampleData?.caConnections || []).find((item) => item.riderId === profile.riderId);

  text(".page-rider .module-title .section-kicker", "Rider Profile / Public Evidence Summary");
  text(".page-rider .module-title h1", profile.displayName);
  text(
    ".page-rider .module-summary",
    `${publicWorks.length} public works / ${publicAwards.length} awards / ${evidenceCount} public evidence refs / rider_report 默认不公开`,
  );
  text(".profile-card h2", profile.displayName);
  text(".profile-card p", profile.headline);
  html(
    ".profile-stats",
    `<span><b>${profile.stats.projects}</b> projects</span><span><b>${profile.stats.sessions}</b> sessions</span><span><b>${profile.stats.completion}</b> completion</span>`,
  );
  html(
    ".portfolio-grid",
    `<article><span>Public Works</span><b>${publicWorks.length ? publicWorks.map((work) => escapeHtml(work.title)).join(" / ") : "暂无公开作品"}</b></article>
     <article><span>Race Links</span><b>${publicRaces.length ? publicRaces.map((race) => escapeHtml(race.title)).join(" / ") : "暂无公开赛事回链"}</b></article>
     <article><span>Awards</span><b>${publicAwards.length ? publicAwards.map((award) => escapeHtml(award.name)).join(" / ") : "暂无公开奖项"}</b></article>
     <article><span>Evidence Summary</span><b>${escapeHtml(profileEvidenceSummary)}</b></article>
     <article><span>Skill Tags</span><b>${profile.skillTags.slice(0, 3).map(escapeHtml).join(" / ")}</b></article>
     <article><span>Riding Metrics</span><b>${rider ? `${rider.progress}% progress / $${rider.cost} cost / ${rider.risk}` : "仅展示公开摘要"}</b></article>
     <article><span>CA Health</span><b>${caProject ? `${caProject.aggregateIngestionStatus} / ${caProject.connectionHealth}` : "公开档案不展示原始连接"}</b></article>
     <article><span>资产边界</span><b>仅展示作品入口、公开证据摘要和已发布赛果</b></article>`,
  );
}

function getWorkDetailSections(work, race, rider, award, evidenceLabel) {
  return [
    ["Problem", race?.challenge || "围绕 Race 赛题解决真实任务。"],
    ["Solution", work.summary || "公开作品摘要待发布。"],
    ["代码入口", work.repo ? "作品仓库已关联" : "作品仓库待公开"],
    ["Riding Summary", evidenceLabel],
    ["Judge Comment", award?.reason || "评审摘要发布后展示。"],
    ["Author", `${rider?.name || award?.riderName || "Unknown Rider"} / ${race?.title || "Unknown Race"}`],
  ];
}

function renderWorkDetail(workId) {
  const publicWorks = getPublicWorks();
  const work = publicWorks.find((item) => item.id === workId);
  if (!work) {
    html(
      ".work-detail-panel",
      `<div class="work-detail-head"><span>No public work</span></div>
       <h2>暂无公开作品详情</h2>
       <p>当前没有可展示的公开作品详情。评审中作品会在发布后进入作品墙。</p>`,
    );
    document.querySelector(".work-detail-panel")?.classList.add("active");
    document.querySelector(".page-works")?.classList.add("detail-open");
    return;
  }
  const race = getRace(work.raceId);
  const rider = getRider(work.riderId);
  const award = sampleData?.awards?.find((item) => item.workId === work.id);
  const evidenceLabel = getPublicEvidenceSummaryForWork(work);
  const detailSections = getWorkDetailSections(work, race, rider, award, evidenceLabel);

  html(
    ".work-detail-panel",
    `<div class="work-detail-head">
       <span>Public Work Page</span>
       <button type="button" data-work-close>收起详情</button>
     </div>
     <h2>${escapeHtml(work.title)}</h2>
     <p>${escapeHtml(work.summary)}</p>
     <div class="work-detail-meta">
       <div><span>Race</span><b>${escapeHtml(race?.title || "Unknown Race")}</b></div>
       <div><span>Rider</span><b>${escapeHtml(rider?.name || award?.riderName || "Unknown Rider")}</b></div>
       <div><span>Status</span><b>${escapeHtml(workStatusText(work.status))}</b></div>
       <div><span>Visibility</span><b>${escapeHtml(visibilityText(work.visibility))}</b></div>
     </div>
     <div class="work-detail-grid">
       ${detailSections.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></article>`).join("")}
     </div>`,
  );
  document.querySelector(".work-detail-panel")?.classList.add("active");
  document.querySelector(".page-works")?.classList.add("detail-open");
}

function hideWorkDetail() {
  document.querySelector(".work-detail-panel")?.classList.remove("active");
  document.querySelector(".page-works")?.classList.remove("detail-open");
}

function getGrs002ScreenModeCopy() {
  const snapshot = grs002RuntimeState.snapshot;
  if (!snapshot) return null;
  const entries = [...(snapshot.entries || [])].sort((a, b) => a.rank - b.rank);
  const messages = snapshot.messages || [];
  const attentionItems = snapshot.attentionItems || [];
  const openAttention = attentionItems.filter((item) => item.status !== "resolved");
  const kpi = snapshot.kpi || {};
  const competition = snapshot.competition || {};
  return {
    live: {
      title: "Jumbotron Live View",
      metrics: [
        [`${kpi.completionRate || 0}%`, "completion"],
        [`${kpi.activeRiders || entries.length}`, "racing entries"],
        [kpi.totalTokensLabel || "--", "tokens"],
        [`${openAttention.length}`, "live notes"],
      ],
      panel: messages.slice(0, 5).map((message) => `<article><span>${escapeHtml(formatJumbotronEventLabel(message.type))}</span><b>${escapeHtml(cleanJumbotronCopy(message.summary))}</b></article>`).join(""),
    },
    leaderboard: {
      title: "GRS-002 TOP3",
      metrics: entries.slice(0, 3).map((entry) => [`#${entry.rank}`, entry.displayName]),
      panel: entries.slice(0, 3).map((entry) => `<article><span>${String(entry.rank).padStart(2, "0")} · ${escapeHtml(entry.gapLabel || "LIVE")}</span><b>${escapeHtml(entry.displayName)} · ${formatTokenCost(entry.tokenCost)}</b></article>`).join(""),
    },
    announcement: {
      title: "Race Announcement",
      metrics: [
        [competition.currentRound || "ROUND", "current"],
        [competition.elapsedTime || "LIVE", "elapsed"],
        [competition.liveStatus || "live", "status"],
        [competition.nextPhase || "next phase", "next"],
      ],
      panel: `<article><span>${escapeHtml(competition.title || "DevCompass Racing")}</span><b>${escapeHtml(competition.currentPhase || "赛事直播中")}</b></article>
              <article><span>Top 3</span><b>${entries.slice(0, 3).map((entry) => escapeHtml(entry.displayName)).join(" / ")}</b></article>`,
    },
    fallback: {
      title: "Live Notes Board",
      metrics: [
        [`${kpi.riskCount || 0}`, "follow-up"],
        [`${kpi.obstacleCount || 0}`, "pit stops"],
        [`${kpi.violationCount || 0}`, "review notes"],
        [`${openAttention.length}`, "open notes"],
      ],
      panel: openAttention.slice(0, 7).map((item) => `<article><span>${escapeHtml(formatJumbotronEventLabel(item.category))} · ${escapeHtml(formatJumbotronEventLabel(item.severity))}</span><b>${escapeHtml(item.entryName)}：${escapeHtml(cleanJumbotronCopy(item.summary))}</b></article>`).join(""),
    },
  };
}

function renderScreenDisplay(mode = "live") {
  currentScreenMode = mode;
  const featuredRace = getRace(currentRaceId || sampleData.raceGroups.featuredRaceId);
  const projection = getProjection(featuredRace.id);
  const live = featuredRace.live || {};
  const works = getDisplayWorksForRace(featuredRace.id).slice(0, 3);
  const grs002ModeCopy = getGrs002ScreenModeCopy();
  const modeCopy = {
    live: grs002ModeCopy?.live || {
      title: "Live Riding Board",
      metrics: [
        [`${featuredRace.metrics.activeRiders ?? 0}`, "active riders"],
        [`${featuredRace.metrics.sessions ?? 0}`, "sessions"],
        [`${live.costWatchRiders ?? 0}`, "cost watch"],
        [live.submitLeft || "N/A", "submit left"],
      ],
      panel: projection?.eventStream?.length
        ? projection.eventStream.map((event) => `<article><span>${escapeHtml(event.time)}</span><b>${escapeHtml(event.text)}</b></article>`).join("")
        : `<article><span>Fallback</span><b>当前 Race 没有可公开 Projection。</b></article>`,
    },
    leaderboard: grs002ModeCopy?.leaderboard || {
      title: "Process Leaderboard",
      metrics: projection?.processLeaderboard?.length ? projection.processLeaderboard.map((item) => [`#${item.rank}`, item.name]) : [["N/A", "no projection"]],
      panel: projection?.processLeaderboard?.length
        ? projection.processLeaderboard.map((item) => `<article><span>${String(item.rank).padStart(2, "0")}</span><b>${escapeHtml(item.name)} · ${item.score}</b></article>`).join("")
        : `<article><span>Fallback</span><b>当前 Race 没有过程榜单。</b></article>`,
    },
    works: {
      title: "Featured Works",
      metrics: works.map((work) => [workStatusText(work.status), work.title]),
      panel: works.map((work) => `<article><span>${escapeHtml(visibilityText(work.visibility))}</span><b>${escapeHtml(work.title)}</b></article>`).join(""),
    },
    announcement: grs002ModeCopy?.announcement || {
      title: "Race Announcement",
      metrics: [
        ["Output", "Screen Display"],
        ["Fallback", "Announcement"],
        ["Race", featuredRace.title],
        ["Status", statusText(featuredRace.status)],
      ],
      panel: `<article><span>Announcement</span><b>${escapeHtml(featuredRace.title)} 正在骑行，过程榜单仅用于现场观看，最终赛果以 Results 发布为准。</b></article>`,
    },
    fallback: grs002ModeCopy?.fallback || {
      title: "Stable Fallback Board",
      metrics: (sampleData?.screenFallbacks || []).slice(0, 4).map((item) => [item.label, item.mode]),
      panel: (sampleData?.screenFallbacks || [])
        .map((item) => `<article><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.detail)}</b></article>`)
        .join(""),
    },
  };
  const current = modeCopy[mode] || modeCopy.live;

  text(".screen-output h1", current.title);
  html(
    ".screen-metrics",
    current.metrics.map(([value, label]) => `<span><b>${escapeHtml(value)}</b> ${escapeHtml(label)}</span>`).join(""),
  );
  html(".screen-mode-panel", current.panel);
  document.querySelectorAll("[data-screen-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.screenMode === mode);
  });
}

function getConsoleTasks(raceId, view) {
  return sampleData?.consoleTasks?.find((task) => task.raceId === raceId && task.view === view)?.items || [];
}

function renderOpsGrid(cards) {
  return cards
    .map((card) => `<article><span>${escapeHtml(card.label)}</span><b>${escapeHtml(card.value)}</b><p>${escapeHtml(card.detail)}</p></article>`)
    .join("");
}

function renderOpsTable(items) {
  return items
    .map((item) => `<div><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.count)}</span><em>${escapeHtml(item.severity)}</em></div>`)
    .join("");
}

function renderCaConnectionRows(projects) {
  if (!projects.length) return `<div><b>No CAConnection</b><span>0</span><em>not configured</em></div>`;
  return projects
    .slice(0, 4)
    .map((project) => {
      const rider = getRider(project.riderId);
      return `<div><b>${escapeHtml(rider?.name || project.raceProjectId)}</b><span>${escapeHtml(project.aggregateIngestionStatus)} / ${escapeHtml(project.connectionHealth)}</span><em>${project.canSubmitWork ? "can submit" : "blocked"}</em></div>`;
    })
    .join("");
}

function renderStatusRows(items) {
  return items
    .map((item) => `<div><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.value ?? item.text ?? item.detail)}</span><em>${escapeHtml(statusBadgeText(item.status || item.severity || "info"))}</em></div>`)
    .join("");
}

function renderConsoleView(view = "organizer") {
  const featuredRace = getRace(currentRaceId || sampleData.raceGroups.featuredRaceId);
  const merchantRace = getRace("merchant-copilot");
  const mediaRace = getRace("media-ops-agent");
  const currentRaceTasks = getConsoleTasks(featuredRace.id, "organizer");
  const riderTasks = getConsoleTasks(merchantRace.id, "rider");
  const judgeTasks = getConsoleTasks(mediaRace.id, "judge");
  const projection = getProjection(featuredRace.id);
  const publicWorksCount = getPublicWorksForRace(featuredRace.id).length;
  const privateWorkCount = (sampleData?.works || []).filter((work) => work.raceId === featuredRace.id && !isPublicWork(work)).length;
  const caSummary = getConnectionStatusSummary(featuredRace.id);
  const reviewRisks = getRaceReviewReadiness(featuredRace.id);
  const judgeRubric = sampleData?.judgeRubric || [];
  const opsStatus = sampleData?.opsStatus || [];
  const screenFallbacks = sampleData?.screenFallbacks || [];
  const configs = {
    organizer: {
      kicker: `Organizer View / ${featuredRace.title} / managed Race`,
      title: `${featuredRace.title}指挥席`,
      summary: "主办方视角负责单场 Race 的报名、Rider、CA Status、Works、Judges、Judging、Awards、Reports 和展示调度；公开端只消费已发布结果。",
      cards: [
        { label: "Race", value: statusText(featuredRace.status), detail: featuredRace.stageLabel || "managed race" },
        { label: "Registrations", value: `${featuredRace.metrics.riders ?? 0} riders`, detail: "Organizer 可管理本场报名与选手名册" },
        { label: "CA Status", value: `${caSummary.active}/${caSummary.projects.length}`, detail: `${caSummary.failed} 个接入风险，失败不自动退赛` },
        { label: "Works", value: `${featuredRace.metrics.submittedWorks ?? 0}`, detail: `${publicWorksCount} 个公开；${privateWorkCount} 个不进公开端` },
        { label: "Judging", value: `${reviewRisks.length} risks`, detail: "评审前风险提示，不是资格硬门禁" },
        { label: "Reports", value: "draft", detail: "Report 发布后才进入 Results / Review" },
      ],
      tasks: currentRaceTasks,
      tableHtml: `${renderCaConnectionRows(caSummary.projects)}${renderOpsTable(reviewRisks.map((item) => ({ label: item.label, count: item.blocking ? "blocking" : "non-blocking", severity: item.severity })))}`,
      note: "权限范围：Organizer 只能管理 managed race；Award / Leaderboard draft 发布前不出现在 Public Site。",
      actions: `<button type="button" data-console-view="screen">配置大屏</button><button type="button" data-page="works">查看公开作品墙</button>`,
    },
    rider: {
      kicker: `Rider View / ${merchantRace.title} / own resources`,
      title: "Rider 参赛工作台示意",
      summary: "Rider 只管理自己的 Registration、RaceProject、CAConnection、Work、公开摘要和默认私有的 rider_report；不能查看其他人的私有过程。",
      cards: [
        { label: "Registration", value: "approved", detail: "通过后系统自动生成 RaceProject" },
        { label: "RaceProject", value: "created", detail: "Rider 进入已生成参赛工作区，不手动创建" },
        { label: "CA Setup", value: "optional during race", detail: "参赛过程中可继续登记多个 CAConnection" },
        { label: "Connection", value: "not_configured", detail: "未接入是证据缺口，不是退赛" },
        { label: "Work", value: "can submit", detail: "CA 失败不阻断 Work Submission" },
        { label: "Rider Report", value: "private", detail: "默认不公开，只展示给本人和授权管理端" },
      ],
      tasks: riderTasks,
      tableHtml: `${renderCaConnectionRows(getRaceCaConnections("merchant-copilot"))}${renderOpsTable((sampleData?.reviewReadiness || []).filter((item) => item.raceId === "merchant-copilot").map((item) => ({ label: item.label, count: "non-blocking", severity: item.severity })))}`,
      note: "权限范围：Rider 只能访问 own registration / own RaceProject / own Work；GitHub Repo 只能作为作品代码入口或 Evidence sourceRef。",
      actions: `<button type="button" data-page="cooperation">查看报名入口</button><button type="button" data-page="rider">查看公开档案</button>`,
    },
    judge: {
      kicker: `Judge View / ${mediaRace.title} / assigned works`,
      title: "Judge 评审工作台示意",
      summary: "Judge 只处理分配给自己的作品和评审记录，读取的是 assigned work context 下的 Evidence 摘要，不读取公开端不该暴露的原始 Session。",
      cards: [
        { label: "Assigned Works", value: `${mediaRace.metrics.submittedWorks}`, detail: "按 JudgeAssignment 分配，不是全场任意访问" },
        { label: "Work Detail", value: "visible", detail: "只看 assigned work context" },
        { label: "Evidence", value: "summary", detail: "评审上下文看摘要，不读 raw source" },
        { label: "scoreResult", value: `${judgeRubric.find((item) => item.key === "scoreResult")?.score ?? "--"}`, detail: "作品结果评分项" },
        { label: "scoreRiding", value: `${judgeRubric.find((item) => item.key === "scoreRiding")?.score ?? "--"}`, detail: "骑行能力评分项" },
        { label: "Comments", value: "draft", detail: "提交前 JudgingRecord 不公开" },
      ],
      tasks: judgeTasks,
      tableHtml: `${renderOpsTable(judgeRubric.map((item) => ({ label: item.label, count: item.score, severity: item.key })))}${renderOpsTable(getRaceReviewReadiness("media-ops-agent").map((item) => ({ label: item.label, count: "review risk", severity: item.severity })))}`,
      note: "权限范围：Judge 只能访问 assigned works 与相关 Evidence 摘要；最终 Award 仍由 Organizer/Admin 发布。",
      actions: `<button type="button" data-page="works">查看公开作品</button><button type="button" data-page="review">查看已发布 Review</button>`,
    },
    admin: {
      kicker: "Admin Console / User.roles / system scope",
      title: "Admin 账号与角色控制台示意",
      summary: "Admin Console 只承载账号、个人资料状态和 User.roles 维护，不承担赛事执行、CA 接入维护或数据运营职责。",
      cards: [
        { label: "GitHub Login", value: "entry", detail: "绑定 GitHub 后进入个人工作入口" },
        { label: "Users", value: "profiles", detail: "维护用户资料补全状态" },
        { label: "User.roles", value: "rider / judge / organizer / admin", detail: "用户可拥有多个角色" },
        { label: "System", value: "exception", detail: "必要系统管理和异常处理" },
        { label: "Not Race Ops", value: "separate", detail: "赛事执行仍回到 Race Console" },
        { label: "Public", value: "published only", detail: "未授权公众只能访问已公开、已发布资源" },
      ],
      tasks: [
        { label: "Profile completion", count: 13, severity: "follow-up" },
        { label: "Role update requests", count: 4, severity: "admin" },
        { label: "System exceptions", count: 2, severity: "audit" },
        { label: "GitHub sign-in checks", count: 1, severity: "info" },
      ],
      tableHtml: renderStatusRows(opsStatus),
      note: "权限范围：Admin 维护系统与角色，不替代 Organizer 的 managed race 工作，也不把私有资源推到公开端。",
      actions: `<button type="button" data-console-view="organizer">回到赛事工作台</button><button type="button" data-page="home">返回公开首页</button>`,
    },
    screen: {
      kicker: `Screen Console / ${featuredRace.title} / display control`,
      title: "Screen Console 控制台示意",
      summary: "Screen Console 负责选择 Race、Display Mode、Theme / Calibration 和展示控制；Screen Display 只负责输出，不承载配置工作台。",
      cards: [
        { label: "Race Selection", value: featuredRace.title, detail: "控制哪场 Race 上大屏" },
        { label: "Display Mode", value: currentScreenMode, detail: "Live / Leaderboard / Works / Announcement / Fallback" },
        { label: "Calibration", value: "1920×1080", detail: "现场全屏、远距离可读、可 fallback" },
        { label: "Projection", value: projection ? projection.status : "fallback", detail: "Projection 可重算，不是最终事实源" },
        { label: "Results Source", value: "Award / Report", detail: "最终赛果不读取过程榜单" },
        { label: "Output", value: "Screen Display", detail: "点击进入纯展示输出面" },
      ],
      tasks: [
        { label: "Live board", count: projection ? 1 : 0, severity: projection ? "ready" : "fallback" },
        { label: "Display modes", count: 5, severity: "ready" },
        { label: "Fallback announcement", count: 1, severity: "ready" },
        { label: "Output separation", count: 1, severity: "done" },
      ],
      tableHtml: renderStatusRows(screenFallbacks),
      note: "边界：右侧这里是控制台示意；正式大屏输出面是 Screen Display，不混入控制按钮。",
      actions: `<button type="button" data-page="screen">进入 Screen Display</button><button type="button" data-page="screen" data-screen-mode="leaderboard">切到榜单模式</button>`,
    },
  };
  const current = configs[view] || configs.organizer;

  html(
    ".console-main",
    `<p class="section-kicker">${escapeHtml(current.kicker)}</p>
     <h1>${escapeHtml(current.title)}</h1>
     <p>${escapeHtml(current.summary)}</p>
     <div class="console-action-row">${current.actions}</div>
     <div class="ops-grid">${renderOpsGrid(current.cards)}</div>
     <section class="ops-table ${current.tableClass || ""}">${current.tableHtml || renderOpsTable(current.tasks || [])}</section>
     <div class="console-scope-note"><span>Scope Rule</span><b>${escapeHtml(current.note)}</b></div>`,
  );
  document.querySelectorAll("[data-console-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.consoleView === view);
  });
}

function renderPrototypeData() {
  if (!sampleData) return;

  const featuredRace = getRace(sampleData.raceGroups.featuredRaceId);
  const genesisRace = getRace("genesis-dogfood-race");
  const govRace = getRace("gov-service-navigator");
  const mediaRace = getRace("media-ops-agent");
  const medicalRace = getRace("medical-followup-assistant");
  const merchantRace = getRace("merchant-copilot");
  const healthRace = getRace("health-habit-coach");
  const profile = sampleData.profiles[0];

  renderHomeLiveSwitcher();
  renderHomeRace(featuredRace.id);
  text(".featured-race .card-head span", "Open Registration");
  text(".featured-race .card-head b", "Open");
  text(".featured-race h3", merchantRace.title);
  text(".featured-race p", "小商家经营 Agent 赛道正在报名，选品、上新、客服和复盘将进入下一轮 Race。");
  html(
    ".featured-race .mini-stats",
    `<span><b>${merchantRace.metrics.applicants}</b> applicants</span>
     <span><b>${merchantRace.metrics.capacity}</b> seats</span>
     <span><b>Open</b> status</span>`,
  );
  html(
    ".featured-race .card-actions",
    `<button type="button" data-page="cooperation">报名入口</button>
     <button type="button" data-page="cooperation">办赛合作</button>`,
  );
  renderHomeLatestResults();
  html(
    ".past-races-list",
    `<div class="card-head"><span>Past Races</span><b>Archive</b></div>
     <div><span>${escapeHtml(mediaRace.title)}</span><b>${statusText(mediaRace.status)}</b></div>
     <div><span>${escapeHtml(medicalRace.title)}</span><b>${statusText(medicalRace.status)}</b></div>`,
  );
  html(
    ".cooperation-teaser",
    `<div class="card-head"><span>开放报名 / 合作入口</span><b>Open</b></div>
     <div><span>${escapeHtml(merchantRace.title)}</span><b>${statusText(merchantRace.status)}</b></div>
     <div><span>${escapeHtml(healthRace.title)}</span><b>${statusText(healthRace.status)}</b></div>`,
  );

  renderPublicRaceContext(featuredRace.id);
  renderResultsAndReview(genesisRace.id);
  renderRiderProfile(profile);

  text(".page-cooperation .section-kicker", "报名 / 办赛 / 赞助");
  text(".page-cooperation .module-title h1", "下一场 Race 如何加入");
  text(".page-cooperation .module-summary", `${merchantRace.title} 与 ${healthRace.title} 正在报名；企业、学校和社区可以发起自己的 Agent Racing 赛道。`);
  html(
    ".cooperation-grid",
    `<article class="glass-card"><span>报名参赛</span><h2>${escapeHtml(merchantRace.title)}</h2><p>${escapeHtml(merchantRace.summary)}</p><button type="button" data-page="race">${escapeHtml(merchantRace.secondaryCta)}</button></article>
     <article class="glass-card"><span>发起赛事</span><h2>定制 Race Track</h2><p>围绕真实业务挑战组织 Rider、评委、作品墙和现场展示。</p><button type="button" data-page="console">进入工作台</button></article>
     <article class="glass-card"><span>赞助合作</span><h2>作品与人才展示</h2><p>支持赛题、奖项、导师点评和赛后公开资产沉淀。</p><button type="button" data-page="home">返回赛事</button></article>`,
  );

  renderConsoleView("organizer");

  text(".screen-top span", `${featuredRace.title} / Bay Area Happy Trip`);
  renderScreenDisplay("live");
  text(".screen-demo-control h2", "Display Modes");
  text(".screen-demo-control div span", "Screen Console");
  text(".screen-demo-control div b", "切换现场展示模式");
  text(".screen-demo-control div p", "为现场大屏选择实时骑行、赛果榜、作品墙、公告或稳定备用画面。");
  renderPublicRaceContext(featuredRace.id);
}

document.addEventListener("click", (event) => {
  const workButton = event.target.closest("[data-work-id]");
  if (workButton) {
    renderWorkDetail(workButton.dataset.workId);
    return;
  }

  const workCloseButton = event.target.closest("[data-work-close]");
  if (workCloseButton) {
    hideWorkDetail();
    return;
  }

  const workFilterButton = event.target.closest("[data-work-filter]");
  if (workFilterButton) {
    renderWorksPage(currentRaceId, workFilterButton.dataset.workFilter);
    return;
  }

  const consoleViewButton = event.target.closest("[data-console-view]");
  if (consoleViewButton) {
    if (consoleViewButton.dataset.page) setPage(consoleViewButton.dataset.page);
    renderConsoleView(consoleViewButton.dataset.consoleView);
    return;
  }

  const screenModeButton = event.target.closest("[data-screen-mode]");
  if (screenModeButton) {
    renderScreenDisplay(screenModeButton.dataset.screenMode);
    if (screenModeButton.dataset.page) setPage(screenModeButton.dataset.page);
    return;
  }

  const raceFocusButton = event.target.closest("[data-race-focus]");
  if (raceFocusButton) {
    document.querySelector(".race-content-grid")?.classList.add("focus-pulse");
    window.setTimeout(() => document.querySelector(".race-content-grid")?.classList.remove("focus-pulse"), 900);
    return;
  }

  const resultsRaceButton = event.target.closest("[data-results-race]");
  if (resultsRaceButton) {
    renderResultsAndReview(resultsRaceButton.dataset.resultsRace);
    return;
  }

  const liveRaceButton = event.target.closest("[data-live-race]");
  if (liveRaceButton) {
    renderHomeRace(liveRaceButton.dataset.liveRace);
    renderPublicRaceContext(liveRaceButton.dataset.liveRace);
    restartHomeRaceCarousel();
    requestAnimationFrame(resizeAll);
    return;
  }

  const galleryDrawerButton = event.target.closest("[data-gallery-drawer-toggle]");
  if (galleryDrawerButton) {
    const drawer = galleryDrawerButton.closest(".gallery-drawer");
    const shouldOpen = !drawer.classList.contains("open");
    drawer.classList.toggle("open", shouldOpen);
    drawer.querySelectorAll("[data-gallery-drawer-toggle]").forEach((button) => {
      button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    });
    return;
  }

  const button = event.target.closest("[data-page]");
  if (!button) return;
  setPage(button.dataset.page);
});

const canvases = [
  { node: document.querySelector("#homeCanvas"), theme: "home" },
  { node: document.querySelector("#liveCanvas"), theme: "live" },
  { node: document.querySelector("#screenCanvas"), theme: "screen" },
].filter((item) => item.node);

const riderColors = ["#075bec", "#13a7ff", "#ffb12b", "#ff4b72"];
const grs002Assets = {
  trackProfileUrl: "./assets/grs002-jumbotron/track/track.profile.json",
  snapshotUrl: "./assets/grs002-jumbotron/data/curated-race-snapshot.json",
  backgroundUrl: "./assets/grs002-jumbotron/track/background.webp",
  sprites: {
    running: "./assets/grs002-jumbotron/sprites/rider3_run.webp",
    sprinting: "./assets/grs002-jumbotron/sprites/rider3_run.webp",
    slowed: "./assets/grs002-jumbotron/sprites/rider3_walk.webp",
    blocked: "./assets/grs002-jumbotron/sprites/rider3_stay.webp",
    idle: "./assets/grs002-jumbotron/sprites/rider3_stay.webp",
    finished: "./assets/grs002-jumbotron/sprites/rider3_stay.webp",
    stale: "./assets/grs002-jumbotron/sprites/rider3_stay.webp",
  },
};
const grs002RuntimeState = {
  trackProfile: null,
  snapshot: null,
  runtime: null,
  background: null,
  sprites: {},
  ready: false,
};

function getExternalJumbotronSnapshot() {
  return window.ARY_RUNTIME_VIEW?.grs002RaceSnapshot || window.ARY_RUNTIME_VIEW?.liveJumbotronSnapshot || window.ARY_ASSEMBLED_VIEW?.grs002RaceSnapshot || null;
}

function getCanvasRiders(time = performance.now(), source = "week3") {
  if (source === "grs002" && grs002RuntimeState.snapshot?.entries?.length) {
    return grs002RuntimeState.snapshot.entries.map((entry, index) => {
      const motionState = entry.motionState || (entry.status === "finished" ? "finished" : "running");
      const liveOffset = motionState === "finished" ? 0 : (time * (0.0024 - Math.min(index, 10) * 0.00008)) % 3;
      return {
        entryId: entry.entryId,
        name: entry.displayName,
        displayName: entry.displayName,
        riderName: entry.riderName,
        projectName: entry.projectName,
        rank: entry.rank,
        rankDelta: entry.rankDelta,
        score: entry.score,
        roundProgress: Math.min(100, Math.max(0, (entry.roundProgress || 0) + liveOffset)),
        phaseProgress: entry.phaseProgress,
        laneId: entry.laneId || `lane-${(index % 12) + 1}`,
        laneOffsetIndex: index % 12,
        motionState,
        color: entry.color || riderColors[index % riderColors.length],
        riskLevel: entry.riskLevel || "none",
        tokenCost: entry.tokenCost,
        primaryCA: entry.primaryCA,
        gapLabel: entry.gapLabel,
        latestMessage: entry.latestMessage,
      };
    });
  }

  const race = getRace(currentRaceId || sampleData.raceGroups.featuredRaceId);
  const projection = getProjection(race?.id);
  const leaderboardByName = new Map((projection?.processLeaderboard || []).map((item) => [item.name, item]));
  return (sampleData?.riders || [])
    .filter((rider) => rider.raceId === race?.id)
    .slice(0, 6)
    .map((rider, index) => {
      const name = rider.name.split(" ")[0];
      const boardItem = leaderboardByName.get(name) || leaderboardByName.get(rider.name);
      const baseProgress = boardItem ? Number(boardItem.score) % 100 : rider.progress ?? 40 + index * 9;
      const roundProgress = race?.status === "running" ? (baseProgress + time * (0.006 - index * 0.00045)) % 100 : Math.min(100, baseProgress);
      const motionState = race?.status === "running" ? (index === 1 ? "sprinting" : index === 3 ? "slowed" : "running") : "finished";
      return {
        entryId: rider.id,
        name,
        displayName: name,
        riderName: rider.name,
        rank: boardItem?.rank ?? index + 1,
        score: boardItem?.score ?? Math.round(baseProgress),
        roundProgress,
        laneId: `lane-${(index % 6) + 1}`,
        laneOffsetIndex: index % 12,
        motionState,
        color: riderColors[index] || "#075bec",
        lane: 0.18 + index * 0.2,
        speed: 0.0001 - index * 0.000008,
        phase: 0.08 + index * 0.22,
        riskLevel: rider.risk || "watch",
      };
    });
}

function resizeCanvas(canvas) {
  const width = canvas.offsetWidth || canvas.parentElement?.clientWidth || canvas.clientWidth || 1;
  const height = canvas.offsetHeight || canvas.parentElement?.clientHeight || canvas.clientHeight || 1;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  canvas.getContext("2d").setTransform(scale, 0, 0, scale, 0, 0);
}

function getCanvasLayoutSize(canvas) {
  return {
    width: canvas.offsetWidth || canvas.parentElement?.clientWidth || canvas.clientWidth || 1,
    height: canvas.offsetHeight || canvas.parentElement?.clientHeight || canvas.clientHeight || 1,
  };
}

function resizePrototypeStage() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080, 1);
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  document.documentElement.style.setProperty("--prototype-scale", String(safeScale));
  document.documentElement.style.setProperty("--prototype-stage-width", `${1920 * safeScale}px`);
  document.documentElement.style.setProperty("--prototype-stage-height", `${1080 * safeScale}px`);
}

function resizeAll() {
  resizePrototypeStage();
  canvases.forEach(({ node }) => {
    if (node.offsetWidth > 0 && node.offsetHeight > 0) resizeCanvas(node);
  });
}

function loadImageAsset(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function normalizeGrs002TrackProfile(profile) {
  return {
    ...profile,
    centerlinePath: profile.centerlinePath || profile.centerline?.points?.map(([x, y]) => ({ x, y })) || [],
    laneOffsets: profile.laneOffsets || profile.lanes?.map((lane) => lane.offset) || [0],
    checkpoints: profile.checkpoints || [],
  };
}

function createPrototypeTrackRuntime(trackProfile) {
  const profile = normalizeGrs002TrackProfile(trackProfile);
  const segments = profile.centerlinePath.slice(0, -1).map((point, index) => {
    const nextPoint = profile.centerlinePath[index + 1];
    const dx = nextPoint.x - point.x;
    const dy = nextPoint.y - point.y;
    const length = Math.hypot(dx, dy);
    const tangent = length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
    return { start: point, end: nextPoint, length, tangent, normal: { x: -tangent.y, y: tangent.x } };
  });
  const pathLength = segments.reduce((sum, segment) => sum + segment.length, 0);

  return {
    trackProfile: profile,
    sampleHorsePose(entry) {
      const normalizedProgress = Math.max(0, Math.min(1, entry.roundProgress / 100));
      const sample = sampleGrs002Path(segments, pathLength, normalizedProgress);
      const laneOffset = profile.laneOffsets[entry.laneOffsetIndex % profile.laneOffsets.length] || 0;
      return {
        entryId: entry.entryId,
        x: sample.point.x + sample.normal.x * laneOffset,
        y: sample.point.y + sample.normal.y * laneOffset,
        rotation: sample.rotation,
        state: entry.motionState,
        laneId: entry.laneId,
        zIndex: Math.round(1000 + normalizedProgress * 100 + entry.laneOffsetIndex),
      };
    },
    getCheckpoints() {
      return profile.checkpoints.map((checkpoint) => ({ ...checkpoint, pose: sampleGrs002Path(segments, pathLength, checkpoint.s) }));
    },
  };
}

function sampleGrs002Path(segments, pathLength, s) {
  const targetDistance = Math.max(0, Math.min(1, s)) * pathLength;
  let traversed = 0;
  for (const segment of segments) {
    if (traversed + segment.length >= targetDistance) {
      const localT = segment.length === 0 ? 0 : (targetDistance - traversed) / segment.length;
      return {
        point: {
          x: segment.start.x + (segment.end.x - segment.start.x) * localT,
          y: segment.start.y + (segment.end.y - segment.start.y) * localT,
        },
        tangent: segment.tangent,
        normal: segment.normal,
        rotation: Math.atan2(segment.tangent.y, segment.tangent.x) * 180 / Math.PI,
      };
    }
    traversed += segment.length;
  }
  const lastSegment = segments[segments.length - 1];
  return {
    point: lastSegment.end,
    tangent: lastSegment.tangent,
    normal: lastSegment.normal,
    rotation: Math.atan2(lastSegment.tangent.y, lastSegment.tangent.x) * 180 / Math.PI,
  };
}

async function initGrs002Runtime() {
  try {
    const [profileResponse, snapshotResponse, background, runSprite, walkSprite, staySprite] = await Promise.all([
      fetch(grs002Assets.trackProfileUrl),
      fetch(grs002Assets.snapshotUrl),
      loadImageAsset(grs002Assets.backgroundUrl),
      loadImageAsset(grs002Assets.sprites.running),
      loadImageAsset(grs002Assets.sprites.slowed),
      loadImageAsset(grs002Assets.sprites.idle),
    ]);
    const profile = await profileResponse.json();
    const snapshot = getExternalJumbotronSnapshot() || await snapshotResponse.json();
    grs002RuntimeState.trackProfile = normalizeGrs002TrackProfile(profile);
    grs002RuntimeState.snapshot = snapshot;
    grs002RuntimeState.runtime = createPrototypeTrackRuntime(profile);
    grs002RuntimeState.background = background;
    grs002RuntimeState.sprites = {
      running: runSprite,
      sprinting: runSprite,
      slowed: walkSprite || runSprite,
      blocked: staySprite || walkSprite || runSprite,
      idle: staySprite || walkSprite || runSprite,
      finished: staySprite || walkSprite || runSprite,
      stale: staySprite || walkSprite || runSprite,
    };
    grs002RuntimeState.ready = Boolean(grs002RuntimeState.runtime && grs002RuntimeState.background);
    renderGrs002LiveData();
  } catch (error) {
    grs002RuntimeState.ready = false;
  }
}

function formatTokenCost(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-- tokens";
  if (number >= 1000000) return `${(number / 1000000).toFixed(2)}M tokens`;
  if (number >= 1000) return `${Math.round(number / 1000)}K tokens`;
  return `${number} tokens`;
}

function formatJumbotronEventLabel(value) {
  const labels = {
    risk: "Follow-up",
    risk_alert: "Track Note",
    warning: "Track Note",
    obstacle: "Pit Stop",
    violation: "Review Note",
    info: "Live",
    milestone: "Milestone",
    progress_update: "Progress",
    strategy_change: "Strategy",
    takeover: "Remote Assist",
    pit_stop: "Pit Stop",
    quality_signal: "Quality",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };
  return labels[value] || String(value || "Live").replaceAll("_", " ");
}

function cleanJumbotronCopy(value) {
  return String(value || "")
    .replace(/风险/g, "关注")
    .replace(/异常提示/g, "现场提示")
    .replace(/异常/g, "提醒")
    .replace(/故障/g, "提示");
}

function renderGrs002LiveData() {
  const externalSnapshot = getExternalJumbotronSnapshot();
  if (externalSnapshot && externalSnapshot !== grs002RuntimeState.snapshot) grs002RuntimeState.snapshot = externalSnapshot;
  const snapshot = grs002RuntimeState.snapshot;
  if (!snapshot) return;
  const entries = [...(snapshot.entries || [])].sort((a, b) => a.rank - b.rank);
  const kpi = snapshot.kpi || {};
  const competition = snapshot.competition || {};
  const messages = snapshot.messages || [];
  const attentionItems = snapshot.attentionItems || [];
  const openAttention = attentionItems.filter((item) => item.status !== "resolved");

  text(".page-live .page-label span", "Live Hall / Jumbotron Runtime");
  text(".page-live .section-kicker", `${competition.title || "DevCompass Racing"} / ${competition.currentRound || "Live"}`);
  text(".page-live .live-header h1", `${competition.title || "DevCompass Racing"} 现场骑行`);
  text("#signalValue", `${kpi.completionRate || 0}%`);
  html(
    ".live-metrics",
    `<article><span>TOP 1</span><b>${escapeHtml(entries[0]?.displayName || "--")}</b><p>${escapeHtml(entries[0]?.gapLabel || "Leading")} · ${formatTokenCost(entries[0]?.tokenCost)}</p></article>
     <article><span>TOP 2 / 3</span><b>${entries.slice(1, 3).map((entry) => escapeHtml(entry.displayName)).join(" / ") || "--"}</b><p>${entries.slice(1, 3).map((entry) => `${escapeHtml(entry.gapLabel || `${entry.roundProgress}%`)} · ${formatTokenCost(entry.tokenCost)}`).join(" · ")}</p></article>
     <article><span>Token Cost</span><b>${escapeHtml(kpi.totalTokensLabel || "--")}</b><p>Codex ${escapeHtml(kpi.codexTokensLabel || "--")} / Claude ${escapeHtml(kpi.claudeTokensLabel || "--")}</p></article>
     <article><span>Live Notes</span><b>${openAttention.length} updates</b><p>${kpi.activeRiders || entries.length} entries · ${competition.elapsedTime || "Live"}</p></article>`,
  );
  html(
    ".event-stream",
    messages
      .slice(0, 6)
      .map((message) => {
        const entry = entries.find((item) => item.entryId === message.entryId);
        return `<article class="${message.severity === "warning" ? "event-warning" : ""}"><b>${escapeHtml(entry?.displayName || message.source)}</b><span>${escapeHtml(cleanJumbotronCopy(message.summary))}</span></article>`;
      })
      .join(""),
  );
  text(".leaderboard-panel h2", "GRS-002 TOP3");
  html(
    ".leaderboard-panel ol",
    entries
      .slice(0, 3)
      .map((entry) => `<li><span>${String(entry.rank).padStart(2, "0")}</span><b>${escapeHtml(entry.displayName)}</b><em>${formatTokenCost(entry.tokenCost)}</em></li>`)
      .join(""),
  );
}

function racePoint(progress, lane, width, height, theme) {
  const yBase = theme === "home" ? 0.63 : 0.55;
  return {
    x: width * (0.06 + progress * 0.88),
    y:
      height *
      (yBase +
        Math.sin(progress * Math.PI * 2.8 + lane * 3.6) * 0.16 +
        Math.cos(progress * Math.PI * 1.35) * 0.08 +
        (lane - 0.5) * 0.18),
  };
}

function drawSpeedLines(ctx, width, height, dark) {
  ctx.save();
  ctx.globalAlpha = dark ? 0.42 : 0.3;
  for (let i = 0; i < 34; i += 1) {
    const y = height * (0.12 + i * 0.026);
    const start = -width * 0.12 + i * 17;
    const end = width * (0.92 + (i % 6) * 0.02);
    const gradient = ctx.createLinearGradient(start, y, end, y - 60);
    gradient.addColorStop(0, "rgba(22,140,255,0)");
    gradient.addColorStop(0.45, dark ? "rgba(48,216,255,0.42)" : "rgba(22,140,255,0.26)");
    gradient.addColorStop(1, "rgba(22,140,255,0)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = i % 5 === 0 ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(start, y);
    ctx.lineTo(end, y - height * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBackground(ctx, width, height, theme) {
  const dark = theme === "screen";
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, dark ? "#06164a" : "#ffffff");
  bg.addColorStop(0.55, dark ? "#08215f" : "#eef7ff");
  bg.addColorStop(1, dark ? "#02091e" : "#dcecff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  drawSpeedLines(ctx, width, height, dark);

  const horizon = dark ? height * 0.7 : height * 0.62;
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.16)" : "rgba(7,91,236,0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i += 1) {
    ctx.beginPath();
    ctx.moveTo(width * 0.04, horizon + i * 18);
    ctx.quadraticCurveTo(width * 0.52, horizon - 110 + i * 6, width * 0.96, horizon + i * 22);
    ctx.stroke();
  }
}

function drawTrack(ctx, width, height, theme) {
  const dark = theme === "screen";
  ctx.strokeStyle = dark ? "rgba(48,216,255,0.72)" : "rgba(7,91,236,0.52)";
  ctx.lineWidth = theme === "screen" ? 6 : 4;
  ctx.beginPath();
  ctx.moveTo(width * 0.08, height * 0.82);
  ctx.bezierCurveTo(width * 0.24, height * 0.22, width * 0.48, height * 0.86, width * 0.68, height * 0.42);
  ctx.bezierCurveTo(width * 0.78, height * 0.22, width * 0.88, height * 0.44, width * 0.95, height * 0.26);
  ctx.stroke();
}

function drawRiderMarker(ctx, rider, width, height, time, theme, index) {
  const dark = theme === "screen";
  const progress = (rider.phase + time * rider.speed) % 1;
  const point = racePoint(progress, rider.lane, width, height, theme);
  const tail = racePoint(Math.max(0, progress - 0.09), rider.lane, width, height, theme);
  const radius = theme === "screen" ? 16 : 11;
  const trail = ctx.createLinearGradient(tail.x, tail.y, point.x, point.y);
  trail.addColorStop(0, "rgba(255,255,255,0)");
  trail.addColorStop(1, rider.color);
  ctx.strokeStyle = trail;
  ctx.lineWidth = theme === "screen" ? 8 : 5;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rider.color;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = dark ? "#ffffff" : "#06164a";
  ctx.font = `950 ${theme === "screen" ? 24 : 15}px Arial, sans-serif`;
  ctx.fillText(rider.name, point.x + radius + 8, point.y - radius - index);
}

function drawOverlay(ctx, width, height, time, theme) {
  const dark = theme === "screen";
  const signal = Math.round((getRace(currentRaceId || sampleData.raceGroups.featuredRaceId)?.live?.ridingSignal || 75) + Math.sin(time / 560) * 4);
  const cardX = theme === "home" ? 28 : 24;
  const cardY = theme === "home" ? 36 : 24;
  const labelY = cardY + (theme === "screen" ? 34 : 26);
  const valueY = cardY + (theme === "screen" ? 80 : 59);
  ctx.fillStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.82)";
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.24)" : "rgba(7,91,236,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, theme === "screen" ? 270 : 180, theme === "screen" ? 112 : 78, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark ? "#bfe3ff" : "#075bec";
  ctx.font = `950 ${theme === "screen" ? 15 : 12}px Arial, sans-serif`;
  ctx.fillText("RIDING SIGNAL", cardX + 18, labelY);
  ctx.fillStyle = dark ? "#ffffff" : "#075bec";
  ctx.font = `950 italic ${theme === "screen" ? 48 : 30}px Arial, sans-serif`;
  ctx.fillText(`${signal}%`, cardX + 18, valueY);
  text("#signalValue", `${signal}%`);
}

function drawGrs002RaceSurface(ctx, width, height, time, theme) {
  const { runtime, trackProfile, background } = grs002RuntimeState;
  if (!grs002RuntimeState.ready || !runtime || !trackProfile || !background) return false;

  ctx.clearRect(0, 0, width, height);
  const scale = Math.min(width / trackProfile.designSize.width, height / trackProfile.designSize.height);
  const drawWidth = trackProfile.designSize.width * scale;
  const drawHeight = trackProfile.designSize.height * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  ctx.save();
  ctx.fillStyle = theme === "screen" ? "#02091e" : "#eaf3ff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(background, offsetX, offsetY, drawWidth, drawHeight);
  ctx.globalAlpha = theme === "screen" ? 0.42 : 0.32;
  ctx.fillStyle = theme === "screen" ? "#06164a" : "#ffffff";
  ctx.fillRect(offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();

  drawGrs002Centerline(ctx, trackProfile, offsetX, offsetY, scale, theme);
  runtime.getCheckpoints().forEach((checkpoint) => drawGrs002Checkpoint(ctx, checkpoint, offsetX, offsetY, scale, theme));
  const posedEntries = getCanvasRiders(time, "grs002")
    .map((entry) => ({ entry, pose: runtime.sampleHorsePose(entry) }))
    .sort((a, b) => a.pose.zIndex - b.pose.zIndex);
  posedEntries.forEach(({ entry, pose }) => drawGrs002Rider(ctx, entry, pose, offsetX, offsetY, scale, theme));
  drawGrs002Bubbles(ctx, posedEntries, offsetX, offsetY, scale, theme, time);
  drawGrs002Ticker(ctx, width, height, theme, time);
  drawOverlay(ctx, width, height, time, theme);
  return true;
}

function drawGrs002Centerline(ctx, trackProfile, offsetX, offsetY, scale, theme) {
  const points = trackProfile.centerlinePath;
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = theme === "screen" ? "rgba(48,216,255,0.75)" : "rgba(7,91,236,0.54)";
  ctx.lineWidth = theme === "screen" ? 5 : 3;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = offsetX + point.x * scale;
    const y = offsetY + point.y * scale;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawGrs002Checkpoint(ctx, checkpoint, offsetX, offsetY, scale, theme) {
  const pose = checkpoint.pose;
  if (!pose?.point) return;
  const x = offsetX + pose.point.x * scale;
  const y = offsetY + pose.point.y * scale;
  ctx.save();
  ctx.fillStyle = theme === "screen" ? "rgba(255,255,255,0.88)" : "rgba(7,91,236,0.9)";
  ctx.strokeStyle = theme === "screen" ? "rgba(48,216,255,0.86)" : "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, theme === "screen" ? 8 : 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGrs002Rider(ctx, entry, pose, offsetX, offsetY, scale, theme) {
  const x = offsetX + pose.x * scale;
  const y = offsetY + pose.y * scale;
  const sprite = grs002RuntimeState.sprites[pose.state] || grs002RuntimeState.sprites.running;
  const spriteSize = theme === "screen" ? 42 : 32;
  const shouldShowLabel = entry.rank <= 3 || ["blocked", "takeover", "stale"].includes(entry.motionState);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((pose.rotation + 180) * Math.PI) / 180);
  ctx.shadowColor = theme === "screen" ? "rgba(48,216,255,0.36)" : "rgba(7,91,236,0.18)";
  ctx.shadowBlur = theme === "screen" ? 12 : 8;
  if (sprite) {
    ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
  } else {
    ctx.fillStyle = entry.color;
    ctx.beginPath();
    ctx.arc(0, 0, spriteSize / 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = entry.rank <= 3 ? "#075bec" : theme === "screen" ? "rgba(2,9,30,0.78)" : "rgba(255,255,255,0.9)";
  ctx.strokeStyle = entry.color || "rgba(7,91,236,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - 13, y - 14, theme === "screen" ? 13 : 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = entry.rank <= 3 || theme === "screen" ? "#fff" : "#06164a";
  ctx.font = `950 ${theme === "screen" ? 12 : 10}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(String(entry.rank), x - 13, y - 10);
  ctx.textAlign = "left";
  ctx.restore();

  if (!shouldShowLabel) return;
  const labelWidth = theme === "screen" ? 128 : 104;
  const labelHeight = theme === "screen" ? 34 : 28;
  ctx.save();
  ctx.fillStyle = theme === "screen" ? "rgba(2,9,30,0.7)" : "rgba(255,255,255,0.86)";
  ctx.strokeStyle = theme === "screen" ? "rgba(48,216,255,0.38)" : "rgba(7,91,236,0.22)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.roundRect(x + 15, y - 26, labelWidth, labelHeight, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = theme === "screen" ? "#ffffff" : "#06164a";
  ctx.font = `900 ${theme === "screen" ? 13 : 11}px Arial, sans-serif`;
  ctx.fillText(entry.displayName.slice(0, 14), x + 25, y - 7);
  ctx.fillStyle = theme === "screen" ? "#bfe3ff" : "#075bec";
  ctx.font = `780 ${theme === "screen" ? 10 : 9}px Arial, sans-serif`;
  ctx.fillText(`${Math.round(entry.roundProgress)}% · ${entry.gapLabel || entry.motionState}`, x + 25, y + 7);
  ctx.restore();
}

function drawGrs002Bubbles(ctx, posedEntries, offsetX, offsetY, scale, theme, time) {
  const snapshot = grs002RuntimeState.snapshot;
  const priority = { warning: 0, milestone: 1, risk_alert: 2, takeover: 3, progress_update: 4 };
  const allMessages = (snapshot?.messages || [])
    .filter((message) => message.displayMode === "bubble" || message.severity === "warning")
    .sort((a, b) => (priority[a.severity] ?? priority[a.type] ?? 9) - (priority[b.severity] ?? priority[b.type] ?? 9));
  if (!allMessages.length) return;
  const cycleMs = 6200;
  const visibleMs = 4300;
  const cycleIndex = Math.floor(time / cycleMs);
  const cycleT = time % cycleMs;
  if (cycleT > visibleMs) return;
  const fade = Math.min(1, cycleT / 600, (visibleMs - cycleT) / 700);
  const messages = [0, 1].map((offset) => allMessages[(cycleIndex * 2 + offset) % allMessages.length]).filter(Boolean);
  messages.forEach((message, index) => {
    const posed = posedEntries.find((item) => item.entry.entryId === message.entryId);
    if (!posed) return;
    const x = offsetX + posed.pose.x * scale + (index === 0 ? 28 : -166);
    const y = offsetY + posed.pose.y * scale - 60 - index * 10 + Math.sin(time / 700 + index) * 3;
    const width = theme === "screen" ? 214 : 184;
    const height = theme === "screen" ? 62 : 54;
    const isWarning = message.severity === "warning";
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    ctx.fillStyle = isWarning ? "rgba(255,177,43,0.9)" : theme === "screen" ? "rgba(2,9,30,0.72)" : "rgba(255,255,255,0.9)";
    ctx.strokeStyle = isWarning ? "rgba(255,255,255,0.78)" : theme === "screen" ? "rgba(48,216,255,0.46)" : "rgba(7,91,236,0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isWarning ? "#06164a" : theme === "screen" ? "#ffffff" : "#06164a";
    ctx.font = `900 ${theme === "screen" ? 12 : 10}px Arial, sans-serif`;
    ctx.fillText(formatJumbotronEventLabel(message.type).toUpperCase(), x + 12, y + 18);
    ctx.font = `820 ${theme === "screen" ? 14 : 12}px Arial, sans-serif`;
    wrapCanvasText(ctx, cleanJumbotronCopy(message.summary), x + 12, y + (theme === "screen" ? 38 : 34), width - 24, theme === "screen" ? 17 : 15, 2);
    ctx.restore();
  });
}

function wrapCanvasText(ctx, textValue, x, y, maxWidth, lineHeight, maxLines) {
  const chars = Array.from(String(textValue || ""));
  const lines = [];
  let current = "";
  chars.forEach((char) => {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  lines.slice(0, maxLines).forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function drawGrs002Ticker(ctx, width, height, theme, time) {
  const snapshot = grs002RuntimeState.snapshot;
  if (!snapshot) return;
  const tickerItems = [
    ...(snapshot.messages || []).filter((message) => message.displayMode === "ticker").map((message) => cleanJumbotronCopy(message.summary)),
    ...(snapshot.attentionItems || []).filter((item) => item.status !== "resolved").map((item) => `${item.entryName}：${cleanJumbotronCopy(item.summary)}`),
  ].slice(0, 10);
  if (!tickerItems.length) return;
  const tickerText = tickerItems.join("     •     ");
  const y = height - (theme === "screen" ? 52 : 36);
  const barHeight = theme === "screen" ? 42 : 30;
  ctx.save();
  ctx.fillStyle = theme === "screen" ? "rgba(2,9,30,0.76)" : "rgba(255,255,255,0.88)";
  ctx.strokeStyle = theme === "screen" ? "rgba(48,216,255,0.42)" : "rgba(7,91,236,0.18)";
  ctx.beginPath();
  ctx.roundRect(18, y, width - 36, barHeight, 13);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = theme === "screen" ? "#ffffff" : "#06164a";
  ctx.font = `900 ${theme === "screen" ? 18 : 13}px Arial, sans-serif`;
  const textWidth = ctx.measureText(tickerText).width;
  const offset = (time * 0.06) % (textWidth + width);
  ctx.save();
  ctx.rect(30, y, width - 60, barHeight);
  ctx.clip();
  ctx.fillText(tickerText, width - offset, y + (theme === "screen" ? 28 : 20));
  ctx.restore();
  ctx.restore();
}

function drawFrame(time) {
  canvases.forEach(({ node, theme }) => {
    const { width, height } = getCanvasLayoutSize(node);
    if (width < 1 || height < 1) return;
    const ctx = node.getContext("2d");
    if (["live", "screen"].includes(theme) && drawGrs002RaceSurface(ctx, width, height, time, theme)) return;
    drawBackground(ctx, width, height, theme);
    drawTrack(ctx, width, height, theme);
    getCanvasRiders(time).forEach((rider, index) => drawRiderMarker(ctx, rider, width, height, time, theme, index));
    drawOverlay(ctx, width, height, time, theme);
  });
  requestAnimationFrame(drawFrame);
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, width, height, radius) {
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    return this;
  };
}

renderPrototypeData();
restartHomeRaceCarousel();
resizeAll();
window.addEventListener("resize", resizeAll);
initGrs002Runtime();
requestAnimationFrame(drawFrame);
